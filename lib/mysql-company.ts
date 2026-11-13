import { cookies } from "next/headers";
import mysql from "mysql2/promise";
import { getMysqlPool, withMySqlTransaction, isLocalMySqlMode, getMasterPool, getCompanyPool } from "./mysql";
import { ensureLocalMySqlInitialized } from "./mysql-init";
import { ensureMasterDbInitialized } from "./mysql-master";
import { ensureCompanyTablesExist } from "./company-schema";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { getSession, SessionData } from "./auth-session";

export interface Company {
  id: string;
  name: string;
  code: string;
  databaseName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  currency: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  userCount?: number;
}

export interface UserCompanyAssignment {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  userRole?: string;
  companyId: string;
  companyName?: string;
  companyCode?: string;
  role: string;
  createdAt: number;
}

function mapRowToCompany(row: any): Company {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    databaseName: row.database_name || row.databaseName || undefined,
    address: row.address || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    gstin: row.gstin || undefined,
    currency: row.currency || "INR",
    isActive: Boolean(row.is_active),
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    userCount: row.user_count !== undefined ? Number(row.user_count) : undefined,
  };
}

// Short-lived in-memory cache for authorized company context to accelerate navigation
const companyContextCache = new Map<string, { company: Company; expiresAt: number }>();

export function clearCompanyContextCache(targetId?: string) {
  if (targetId) {
    for (const key of companyContextCache.keys()) {
      if (key.includes(targetId)) companyContextCache.delete(key);
    }
  } else {
    companyContextCache.clear();
  }
}

/**
 * Legacy resolution fallback against 'local_billing_db' for unmigrated companies.
 */
async function getLegacyAuthorizedCompanyContext(
  authRole: string,
  authId: string | undefined,
  requestedCompanyId: string | undefined,
  cacheKey: string
): Promise<Company> {
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();

  if (authRole === "super_admin") {
    if (requestedCompanyId) {
      const [rows] = await pool.query<RowDataPacket[]>(
        "SELECT * FROM companies WHERE id = ? AND is_active = 1",
        [requestedCompanyId]
      );
      if (rows && rows.length > 0) {
        const comp = mapRowToCompany(rows[0]);
        companyContextCache.set(cacheKey, { company: comp, expiresAt: Date.now() + 5000 });
        return comp;
      }
    }

    const [allActive] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM companies WHERE is_active = 1 ORDER BY id = 'comp_default' DESC, created_at ASC LIMIT 1"
    );

    if (allActive && allActive.length > 0) {
      const defaultCompany = mapRowToCompany(allActive[0]);
      companyContextCache.set(cacheKey, { company: defaultCompany, expiresAt: Date.now() + 5000 });
      return defaultCompany;
    }

    throw new Error("No active companies found in legacy database.");
  }

  if (!authId) {
    throw new Error("Unauthorized: Active user session ID is missing.");
  }

  // Check direct company_id in users
  const [userRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.* FROM companies c
     INNER JOIN users u ON u.company_id = c.id
     WHERE u.id = ? AND c.is_active = 1`,
    [authId]
  );

  if (userRows && userRows.length > 0) {
    const assignedComp = mapRowToCompany(userRows[0]);
    companyContextCache.set(cacheKey, { company: assignedComp, expiresAt: Date.now() + 5000 });
    return assignedComp;
  }

  // Fallback check user_companies
  const [assignedRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.* FROM companies c
     INNER JOIN user_companies uc ON c.id = uc.company_id
     WHERE uc.user_id = ? AND c.is_active = 1`,
    [authId]
  );

  if (assignedRows && assignedRows.length > 0) {
    const assignedComp = mapRowToCompany(assignedRows[0]);
    companyContextCache.set(cacheKey, { company: assignedComp, expiresAt: Date.now() + 5000 });
    return assignedComp;
  }

  throw new Error(`Unauthorized: User '${authId}' is not assigned to any active company.`);
}

/**
 * Server-side authorization check:
 * Resolves and validates the active company for the logged-in user.
 * NEVER trusts an unverified company ID or database name from the client!
 * Non-super-admin users are strictly isolated to their assigned company database.
 */
export async function getAuthorizedCompanyContext(explicitSession?: SessionData): Promise<Company> {
  if (!isLocalMySqlMode()) {
    throw new Error("getAuthorizedCompanyContext is strictly available in local MySQL mode.");
  }

  let cookieStore: any = null;
  let cookieAuthCompanyId: string | undefined;
  let cookieRole: string | undefined;
  let cookieAuthId: string | undefined;

  try {
    cookieStore = await cookies();
    cookieAuthCompanyId = cookieStore.get("auth_company_id")?.value;
    cookieRole = cookieStore.get("auth_role")?.value;
    cookieAuthId = cookieStore.get("auth_id")?.value;
  } catch {
    // Outside Next.js request context (e.g. background tasks or unit tests)
  }

  const session = explicitSession || (await getSession());
  const authId = session?.userId || cookieAuthId;
  const rawRole = session?.role || cookieRole;
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (!authRole) {
    throw new Error("Unauthorized: User is not authenticated.");
  }

  const cacheKey = `${authRole}:${authId || "no_id"}:${cookieAuthCompanyId || "none"}:${session?.companyId || "none"}`;
  const cached = companyContextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.company;
  }

  await ensureMasterDbInitialized();
  const masterPool = getMasterPool();

  // 1. SUPER_ADMIN USER: Can view/switch any active company context
  if (authRole === "super_admin") {
    const targetId = cookieAuthCompanyId || session?.companyId;

    if (targetId) {
      const [mRows] = await masterPool.query<RowDataPacket[]>(
        "SELECT * FROM master_companies WHERE id = ? AND is_active = 1",
        [targetId]
      );
      if (mRows && mRows.length > 0) {
        const comp = mapRowToCompany(mRows[0]);
        companyContextCache.set(cacheKey, { company: comp, expiresAt: Date.now() + 5000 });
        return comp;
      }
    }

    // Default to first active company in master_companies
    const [allActive] = await masterPool.query<RowDataPacket[]>(
      "SELECT * FROM master_companies WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1"
    );

    if (allActive && allActive.length > 0) {
      const defaultCompany = mapRowToCompany(allActive[0]);
      if (cookieStore) {
        try {
          cookieStore.set("auth_company_id", defaultCompany.id, { path: "/" });
        } catch {}
      }
      companyContextCache.set(cacheKey, { company: defaultCompany, expiresAt: Date.now() + 5000 });
      return defaultCompany;
    }

    // Fallback to legacy local_billing_db
    return await getLegacyAuthorizedCompanyContext(authRole, authId, targetId, cacheKey);
  }

  // 2. TENANT ROLES (company_admin, cashier, manager, chef, waiter, delivery_staff):
  // Non-super-admin users are strictly locked to their session-authenticated companyId.
  const assignedCompanyId = session?.companyId;

  if (!assignedCompanyId) {
    // If not in session, attempt lookup in user_company_routing
    if (authId) {
      const [rRows] = await masterPool.query<RowDataPacket[]>(
        "SELECT company_id FROM user_company_routing WHERE (user_id = ? OR username = ?) AND is_active = 1 LIMIT 1",
        [authId, session?.username || ""]
      );
      if (rRows && rRows.length > 0) {
        const targetId = rRows[0].company_id;
        const [mRows] = await masterPool.query<RowDataPacket[]>(
          "SELECT * FROM master_companies WHERE id = ? LIMIT 1",
          [targetId]
        );
        if (mRows && mRows.length > 0) {
          if (mRows[0].is_active === 0 || mRows[0].status === "inactive") {
            throw new Error(`Unauthorized: Company '${mRows[0].name || targetId}' is inactive.`);
          }
          const comp = mapRowToCompany(mRows[0]);
          companyContextCache.set(cacheKey, { company: comp, expiresAt: Date.now() + 5000 });
          return comp;
        }
      }
    }

    // Fallback to legacy local_billing_db
    return await getLegacyAuthorizedCompanyContext(authRole, authId, cookieAuthCompanyId, cacheKey);
  }

  // CRITICAL SECURITY ENFORCEMENT:
  // If client-supplied auth_company_id cookie does not match the session's assigned companyId,
  // this is an unauthorized cross-company access attempt! Reject immediately!
  if (cookieAuthCompanyId && cookieAuthCompanyId !== assignedCompanyId) {
    throw new Error(
      `Unauthorized: Cross-company access is strictly forbidden. User '${session?.username || authId}' belonging to company '${assignedCompanyId}' cannot access company '${cookieAuthCompanyId}'.`
    );
  }

  // Look up company in master_companies
  const [masterRows] = await masterPool.query<RowDataPacket[]>(
    "SELECT * FROM master_companies WHERE id = ? LIMIT 1",
    [assignedCompanyId]
  );

  if (masterRows && masterRows.length > 0) {
    const row = masterRows[0];
    if (row.is_active === 0 || row.status === "inactive") {
      throw new Error(`Unauthorized: Company '${row.name || assignedCompanyId}' is currently inactive.`);
    }
    const comp = mapRowToCompany(row);
    companyContextCache.set(cacheKey, { company: comp, expiresAt: Date.now() + 5000 });
    return comp;
  }

  // Fallback to legacy local_billing_db for unmigrated companies
  return await getLegacyAuthorizedCompanyContext(authRole, authId, cookieAuthCompanyId, cacheKey);
}

/**
 * Retrieves the authorized MySQL connection pool and company context for the current request.
 * Resolves the company database securely from the server session and master database.
 * Strictly prevents cross-company access and rejects inactive companies.
 */
export async function getAuthorizedCompanyPool(
  explicitSession?: SessionData
): Promise<{ pool: mysql.Pool; company: Company }> {
  const company = await getAuthorizedCompanyContext(explicitSession);
  if (company.databaseName) {
    const pool = getCompanyPool(company.databaseName);
    await ensureCompanyTablesExist(pool, company.databaseName);
    return { pool, company };
  }
  // Fallback to legacy single database pool if databaseName is not defined
  const pool = getMysqlPool();
  await ensureCompanyTablesExist(pool, "local_billing_db");
  return { pool, company };
}

/**
 * Resolves the connection pool and company record for a given company ID or current session context.
 * If companyId is specified, looks up in master_companies, falling back to legacy companies.
 * If companyId is not specified, uses getAuthorizedCompanyPool().
 */
export async function resolveCompanyPoolAndContext(
  explicitCompanyId?: string,
  explicitSession?: SessionData
): Promise<{ pool: mysql.Pool; company: Company }> {
  if (!explicitCompanyId) {
    return await getAuthorizedCompanyPool(explicitSession);
  }

  await ensureMasterDbInitialized();
  const masterPool = getMasterPool();

  // Try master_companies
  const [rows] = await masterPool.query<RowDataPacket[]>(
    'SELECT * FROM master_companies WHERE (id = ? OR code = ?) AND is_active = 1 LIMIT 1',
    [explicitCompanyId, explicitCompanyId.toUpperCase()]
  );

  if (rows && rows.length > 0) {
    const company = mapRowToCompany(rows[0]);
    const pool = company.databaseName ? getCompanyPool(company.databaseName) : getMysqlPool();
    await ensureCompanyTablesExist(pool, company.databaseName);
    return { pool, company };
  }

  // Fallback to legacy local_billing_db
  await ensureLocalMySqlInitialized();
  const legacyPool = getMysqlPool();
  await ensureCompanyTablesExist(legacyPool, "local_billing_db");
  const [legacyRows] = await legacyPool.query<RowDataPacket[]>(
    'SELECT * FROM companies WHERE id = ? AND is_active = 1 LIMIT 1',
    [explicitCompanyId]
  );

  if (legacyRows && legacyRows.length > 0) {
    const company = mapRowToCompany(legacyRows[0]);
    return { pool: legacyPool, company };
  }

  // If not found, fallback to authorized company context
  return await getAuthorizedCompanyPool(explicitSession);
}

/**
 * Retrieves companies according to role:
 * Super Admin: receives all registered companies in master DB.
 * Company Admin / Cashier / Staff: receives ONLY their assigned company!
 */
export async function getAllCompanies(explicitSession?: SessionData): Promise<Company[]> {
  if (!isLocalMySqlMode()) return [];
  await ensureMasterDbInitialized();
  const masterPool = getMasterPool();

  let session: SessionData | null = explicitSession || null;
  let authRole: string | undefined = session?.role;
  let authId: string | undefined = session?.userId;

  if (!session) {
    try {
      session = await getSession();
      const cookieStore = await cookies();
      const rawRole = session?.role || cookieStore.get("auth_role")?.value;
      authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;
      authId = session?.userId || cookieStore.get("auth_id")?.value;
    } catch {}
  }

  if (authRole === "super_admin") {
    const [rows] = await masterPool.query<RowDataPacket[]>(`
      SELECT mc.*,
        (SELECT COUNT(*) FROM user_company_routing ucr WHERE ucr.company_id = mc.id AND ucr.is_active = 1) AS user_count
      FROM master_companies mc
      ORDER BY mc.name ASC
    `);
    if (rows && rows.length > 0) {
      return rows.map(mapRowToCompany);
    }

    // Fallback to legacy
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();
    const [legacyRows] = await pool.query<RowDataPacket[]>(`
      SELECT c.*, COUNT(uc.id) AS user_count
      FROM companies c
      LEFT JOIN user_companies uc ON c.id = uc.company_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return legacyRows.map(mapRowToCompany);
  }

  if (authRole === "company_admin" || authRole === "cashier" || authRole === "manager") {
    const userCompanyId = session?.companyId;
    if (userCompanyId) {
      const [rows] = await masterPool.query<RowDataPacket[]>(`
        SELECT mc.*,
          (SELECT COUNT(*) FROM user_company_routing ucr WHERE ucr.company_id = mc.id AND ucr.is_active = 1) AS user_count
        FROM master_companies mc
        WHERE mc.id = ? AND mc.is_active = 1
        ORDER BY mc.name ASC
      `, [userCompanyId]);
      if (rows && rows.length > 0) {
        return rows.map(mapRowToCompany);
      }
    }

    if (authId) {
      const [rows] = await masterPool.query<RowDataPacket[]>(`
        SELECT mc.*,
          (SELECT COUNT(*) FROM user_company_routing ucr WHERE ucr.company_id = mc.id AND ucr.is_active = 1) AS user_count
        FROM master_companies mc
        INNER JOIN user_company_routing ucr ON mc.id = ucr.company_id
        WHERE ucr.user_id = ? AND mc.is_active = 1
        GROUP BY mc.id
        ORDER BY mc.name ASC
      `, [authId]);
      if (rows && rows.length > 0) {
        return rows.map(mapRowToCompany);
      }
    }

    // Fallback to legacy
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();
    const [legacyRows] = await pool.query<RowDataPacket[]>(`
      SELECT c.*, COUNT(uc.id) AS user_count
      FROM companies c
      LEFT JOIN user_companies uc ON c.id = uc.company_id
      LEFT JOIN users u ON u.company_id = c.id
      WHERE (u.id = ? OR uc.user_id = ?) AND c.is_active = 1
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [authId, authId]);
    return legacyRows.map(mapRowToCompany);
  }

  return [];
}

/**
 * Creates a new company (Strictly Super Admin only)
 */
export async function createCompany(data: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  currency?: string;
}): Promise<Company> {
  if (!isLocalMySqlMode()) throw new Error("Local MySQL mode is required.");
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (authRole !== "super_admin") {
    throw new Error("Access denied: Only Super Admin privileges can create a company.");
  }

  const cleanName = data.name.trim();
  const cleanCode = data.code.trim().toUpperCase();

  if (!cleanName || !cleanCode) {
    throw new Error("Company name and unique company code are required.");
  }

  const pool = getMysqlPool();

  // Generate next sequential company ID in the format COMP-0001, COMP-0002, COMP-0003...
  let allCompanies: RowDataPacket[] = [];
  try {
    const masterPool = getMasterPool();
    const [mComps] = await masterPool.query<RowDataPacket[]>("SELECT id FROM master_companies");
    allCompanies = mComps || [];
  } catch {
    const [localComps] = await pool.query<RowDataPacket[]>("SELECT id FROM companies");
    allCompanies = localComps || [];
  }

  const usedSeqs = new Set<number>();
  for (const c of allCompanies) {
    const match = (c.id || "").match(/^COMP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num)) usedSeqs.add(num);
    }
  }
  let nextSeq = 1;
  while (usedSeqs.has(nextSeq)) {
    nextSeq++;
  }
  const newId = `COMP-${String(nextSeq).padStart(4, "0")}`;

  // Check unique code
  const [existingCode] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM companies WHERE code = ?",
    [cleanCode]
  );
  if (existingCode && existingCode.length > 0) {
    throw new Error(`A company with code '${cleanCode}' already exists.`);
  }

  return await withMySqlTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO companies (id, name, code, address, phone, email, gstin, currency, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        newId,
        cleanName,
        cleanCode,
        data.address || null,
        data.phone || null,
        data.email || null,
        data.gstin || null,
        data.currency || "INR",
      ]
    );

    // Seed full module permissions for new company
    await conn.query(
      `INSERT INTO company_permissions (
        id, company_id, module_users, module_products, module_categories, module_sales,
        module_bills, module_customers, module_payments, module_inventory, module_reports, module_settings
      ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)`,
      [`cp_${newId}`, newId]
    );

    const [rows] = await conn.query<RowDataPacket[]>("SELECT * FROM companies WHERE id = ?", [newId]);
    const createdComp = mapRowToCompany(rows[0]);

    // Also auto-provision in Master DB and create dedicated company database
    try {
      const { provisionCompanyDatabase } = await import("./company-provisioning");
      await provisionCompanyDatabase({
        companyId: newId,
        companyCode: cleanCode,
        companyName: cleanName,
        address: data.address,
        phone: data.phone,
        email: data.email,
        gstin: data.gstin,
        currency: data.currency || "INR",
      });
    } catch (provErr) {
      console.warn("Master DB provisioning warning on createCompany:", provErr);
    }

    return createdComp;
  });
}

/**
 * Updates company details or activates/deactivates company (Strictly Super Admin only)
 */
export async function updateCompany(
  id: string,
  data: Partial<Omit<Company, "id" | "createdAt" | "updatedAt">>
): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (authRole !== "super_admin") {
    throw new Error("Access denied: Only Super Admin privileges can modify company details.");
  }

  const pool = getMysqlPool();
  const sets: string[] = [];
  const params: any[] = [];

  if (data.name !== undefined) { sets.push("name = ?"); params.push(data.name.trim()); }
  if (data.code !== undefined) { sets.push("code = ?"); params.push(data.code.trim().toUpperCase()); }
  if (data.address !== undefined) { sets.push("address = ?"); params.push(data.address); }
  if (data.phone !== undefined) { sets.push("phone = ?"); params.push(data.phone); }
  if (data.email !== undefined) { sets.push("email = ?"); params.push(data.email); }
  if (data.gstin !== undefined) { sets.push("gstin = ?"); params.push(data.gstin); }
  if (data.currency !== undefined) { sets.push("currency = ?"); params.push(data.currency); }
  if (data.isActive !== undefined) { sets.push("is_active = ?"); params.push(data.isActive ? 1 : 0); }

  if (sets.length === 0) return true;

  params.push(id);
  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE companies SET ${sets.join(", ")} WHERE id = ?`,
    params
  );

  // Sync to Master DB if registered
  try {
    const masterPool = getMasterPool();
    await masterPool.query<ResultSetHeader>(
      `UPDATE master_companies SET ${sets.join(", ")} WHERE id = ?`,
      params
    );
  } catch (mErr) {
    // Non-fatal if company only exists in legacy DB
  }

  return result.affectedRows > 0;
}

/**
 * Deletes a company and cleans up associated records (Strictly Super Admin only)
 */
export async function deleteCompany(id: string): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (authRole !== "super_admin") {
    throw new Error("Access denied: Only Super Admin privileges can delete a company.");
  }

  // 1. Identify target company's database before removing records
  let targetDbName: string | null = null;
  try {
    const masterPool = getMasterPool();
    const [mRows] = await masterPool.query<RowDataPacket[]>(
      "SELECT database_name FROM master_companies WHERE id = ?",
      [id]
    );
    if (mRows && mRows.length > 0) {
      targetDbName = mRows[0].database_name;
    }
  } catch {}

  const pool = getMysqlPool();
  const deleted = await withMySqlTransaction(async (conn) => {
    await conn.query("DELETE FROM company_permissions WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM user_companies WHERE company_id = ?", [id]);
    await conn.query("UPDATE users SET company_id = NULL WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM products WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM categories WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM sales WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM customers WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM payments WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM raw_materials WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM stock_transactions WHERE company_id = ?", [id]);
    await conn.query("DELETE FROM cash_register WHERE company_id = ?", [id]);
    const [result] = await conn.query<ResultSetHeader>("DELETE FROM companies WHERE id = ?", [id]);
    try {
      const masterPool = getMasterPool();
      await masterPool.query("DELETE FROM user_company_routing WHERE company_id = ?", [id]);
      await masterPool.query("DELETE FROM master_companies WHERE id = ?", [id]);
    } catch {}
    return result.affectedRows > 0;
  });

  // 2. Drop the physical tenant database if it exists
  if (targetDbName) {
    try {
      const { deprovisionCompanyDatabase } = await import("./company-provisioning");
      await deprovisionCompanyDatabase(targetDbName);
    } catch (deprovErr) {
      console.warn(`Failed to deprovision database '${targetDbName}':`, deprovErr);
    }
  }

  // 3. Automatically rearrange remaining active companies to maintain sequential codes (COMP-0001, COMP-0002, ...)
  try {
    const { resequenceCompanies } = await import("./company-provisioning");
    await resequenceCompanies();
  } catch (resErr) {
    console.warn("Failed to resequence companies after deletion:", resErr);
  }

  return deleted;
}

/**
 * Assigns a user to a company (Super Admin only)
 */
export async function assignUserToCompany(
  userId: string,
  companyId: string,
  role: string = "cashier"
): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (authRole !== "super_admin") {
    throw new Error("Access denied: Super Admin privileges required to assign users to companies.");
  }

  const pool = getMysqlPool();

  const [cRows] = await pool.query<RowDataPacket[]>("SELECT id FROM companies WHERE id = ?", [companyId]);
  if (!cRows || cRows.length === 0) {
    throw new Error("Target company does not exist.");
  }

  const [uRows] = await pool.query<RowDataPacket[]>("SELECT id FROM users WHERE id = ?", [userId]);
  if (!uRows || uRows.length === 0) {
    throw new Error("Target user does not exist.");
  }

  const id = `uc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await pool.query(
    `INSERT INTO user_companies (id, user_id, company_id, role)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE role = VALUES(role)`,
    [id, userId, companyId, role]
  );

  if (role === "company_admin") {
    await pool.query("UPDATE users SET company_id = ? WHERE id = ?", [companyId, userId]);
  }

  // Also sync to Master DB routing
  try {
    const masterPool = getMasterPool();
    const [mcRows] = await masterPool.query<RowDataPacket[]>(
      "SELECT id, database_name FROM master_companies WHERE id = ?",
      [companyId]
    );
    if (mcRows && mcRows.length > 0) {
      const dbName = mcRows[0].database_name;
      const username = (uRows[0] as any).username || (uRows[0] as any).name || userId;
      await masterPool.query(
        `INSERT INTO user_company_routing (id, user_id, username, company_id, database_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE database_name = VALUES(database_name), role = VALUES(role)`,
        [`ucr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, userId, username, companyId, dbName, role]
      );
    }
  } catch {}

  return true;
}

/**
 * Creates a cashier user account directly for a specific company
 */
export async function createCompanyCashier(data: {
  companyId: string;
  username: string;
  password: string;
}): Promise<{ id: string; username: string }> {
  if (!isLocalMySqlMode()) throw new Error("Local MySQL mode is required.");
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  let authId = session?.userId;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
    if (!authId) authId = cookieStore.get("auth_id")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (authRole !== "super_admin") {
    const pool = getMysqlPool();
    const [assigned] = await pool.query<RowDataPacket[]>(
      `SELECT u.id FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.company_id = ?
       WHERE u.id = ? AND (u.company_id = ? OR uc.company_id = ?)`,
      [data.companyId, authId, data.companyId, data.companyId]
    );
    if (!assigned || assigned.length === 0) {
      throw new Error("Access denied: You can only create cashiers for your own assigned company.");
    }
  }

  const cleanUsername = data.username.trim();
  const cleanPassword = data.password.trim();

  if (!cleanUsername || !cleanPassword) {
    throw new Error("Username and password are required for the cashier account.");
  }

  const pool = getMysqlPool();

  const [existingUser] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM users WHERE username = ?",
    [cleanUsername]
  );
  if (existingUser && existingUser.length > 0) {
    throw new Error(`Username '${cleanUsername}' already exists. Please choose a different username.`);
  }

  const [compRows] = await pool.query<RowDataPacket[]>(
    "SELECT id, name FROM companies WHERE id = ? AND is_active = 1",
    [data.companyId]
  );
  if (!compRows || compRows.length === 0) {
    throw new Error("Target company does not exist or is inactive.");
  }

  const companyName = compRows[0].name;
  const userId = `u_cashier_${Date.now()}`;
  const ucId = `uc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const createdCashier = await withMySqlTransaction(async (conn) => {
    await conn.query(
      `INSERT INTO users (id, name, username, email, password, role, company_id, company_name, is_active)
       VALUES (?, ?, ?, ?, ?, 'cashier', ?, ?, 1)`,
      [userId, cleanUsername, cleanUsername, `${cleanUsername}@local.test`, cleanPassword, data.companyId, companyName]
    );

    await conn.query(
      `INSERT INTO user_companies (id, user_id, company_id, role)
       VALUES (?, ?, ?, 'cashier')`,
      [ucId, userId, data.companyId]
    );

    return { id: userId, username: cleanUsername };
  });

  // Sync to tenant DB and Master DB routing if registered in master
  try {
    const { pool: tenantPool, company: compCtx } = await resolveCompanyPoolAndContext(data.companyId);
    if (compCtx.databaseName) {
      const { hashPassword } = await import("./users");
      const hashed = hashPassword(cleanPassword);
      await tenantPool.query(
        `INSERT INTO users (id, name, username, email, password, password_hash, role, company_id, company_name, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 'cashier', ?, ?, 1)
         ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
        [userId, cleanUsername, cleanUsername, `${cleanUsername}@local.test`, hashed, hashed, data.companyId, compCtx.name]
      );

      const masterPool = getMasterPool();
      await masterPool.query(
        `INSERT INTO user_company_routing (id, user_id, username, company_id, database_name, role, is_active)
         VALUES (?, ?, ?, ?, ?, 'cashier', 1)
         ON DUPLICATE KEY UPDATE database_name = VALUES(database_name), role = VALUES(role)`,
        [`ucr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, userId, cleanUsername, data.companyId, compCtx.databaseName]
      );
    }
  } catch {}

  return createdCashier;
}

/**
 * Removes a user assignment from a company
 */
export async function removeUserFromCompany(userId: string, companyId: string): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  let authId = session?.userId;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
    if (!authId) authId = cookieStore.get("auth_id")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  const pool = getMysqlPool();

  if (authRole !== "super_admin") {
    const [assigned] = await pool.query<RowDataPacket[]>(
      `SELECT u.id FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.company_id = ?
       WHERE u.id = ? AND (u.company_id = ? OR uc.company_id = ?)`,
      [companyId, authId, companyId, companyId]
    );
    if (!assigned || assigned.length === 0) {
      throw new Error("Access denied: You can only remove users from your assigned company.");
    }

    const [targetUser] = await pool.query<RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [userId]);
    const allowedStaffRoles = ["cashier", "manager", "chef", "waiter"];
    if (targetUser && !allowedStaffRoles.includes(targetUser[0]?.role)) {
      throw new Error("Access denied: Company Admins cannot remove Administrator accounts.");
    }
  }

  const [result] = await pool.query<ResultSetHeader>(
    "DELETE FROM user_companies WHERE user_id = ? AND company_id = ?",
    [userId, companyId]
  );

  const [remaining] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM user_companies WHERE user_id = ?",
    [userId]
  );
  if (!remaining || remaining.length === 0) {
    await pool.query("DELETE FROM users WHERE id = ? AND role = 'cashier'", [userId]);
  }

  try {
    const masterPool = getMasterPool();
    await masterPool.query("DELETE FROM user_company_routing WHERE user_id = ? AND company_id = ?", [userId, companyId]);
    const { pool: tenantPool } = await resolveCompanyPoolAndContext(companyId);
    await tenantPool.query("UPDATE users SET is_active = 0 WHERE id = ?", [userId]);
  } catch {}

  return result.affectedRows > 0;
}

/**
 * Retrieves all users assigned to a specific company
 */
export async function getCompanyUsers(companyId: string): Promise<UserCompanyAssignment[]> {
  if (!isLocalMySqlMode()) return [];
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  let authId = session?.userId;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
    if (!authId) authId = cookieStore.get("auth_id")?.value;
  } catch {}
  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  if (authRole === "company_admin") {
    const pool = getMysqlPool();
    const [assigned] = await pool.query<RowDataPacket[]>(
      `SELECT u.id FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.company_id = ?
       WHERE u.id = ? AND (u.company_id = ? OR uc.company_id = ?)`,
      [companyId, authId, companyId, companyId]
    );
    if (!assigned || assigned.length === 0) {
      // Also check master routing
      try {
        const masterPool = getMasterPool();
        const [mAssigned] = await masterPool.query<RowDataPacket[]>(
          "SELECT id FROM user_company_routing WHERE user_id = ? AND company_id = ? AND is_active = 1",
          [authId, companyId]
        );
        if (!mAssigned || mAssigned.length === 0) {
          throw new Error("Access denied: You are not authorized to view users for this company.");
        }
      } catch (checkErr: any) {
        if (checkErr.message.includes("Access denied")) throw checkErr;
      }
    }
  }

  // Check master DB routing first
  try {
    const masterPool = getMasterPool();
    const [mcRows] = await masterPool.query<RowDataPacket[]>(
      "SELECT id, name FROM master_companies WHERE id = ?",
      [companyId]
    );
    if (mcRows && mcRows.length > 0) {
      let masterQuery = `
        SELECT ucr.id, ucr.user_id, ucr.company_id, ucr.role, ucr.created_at,
               ucr.username as user_name, ucr.username as user_username, ucr.role as global_role,
               mc.name as company_name, mc.code as company_code
        FROM user_company_routing ucr
        INNER JOIN master_companies mc ON ucr.company_id = mc.id
        WHERE ucr.company_id = ? AND ucr.is_active = 1
      `;
      const masterParams: any[] = [companyId];
      if (authRole === "company_admin") {
        masterQuery += " AND ucr.role = 'cashier'";
      }
      masterQuery += " ORDER BY ucr.username ASC";
      const [mRows] = await masterPool.query<RowDataPacket[]>(masterQuery, masterParams);
      if (mRows && mRows.length > 0) {
        return mRows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          userName: r.user_name || r.user_username,
          userEmail: `${r.user_name}@local.test`,
          userRole: r.global_role === "admin" ? "company_admin" : r.global_role,
          companyId: r.company_id,
          companyName: r.company_name,
          role: r.role,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        }));
      }
    }
  } catch (mErr) {
    // fallback to legacy
  }

  const pool = getMysqlPool();
  let query = `
    SELECT uc.id, uc.user_id, uc.company_id, uc.role, uc.created_at,
           u.name as user_name, u.username as user_username, u.email as user_email, u.role as global_role,
           c.name as company_name, c.code as company_code
    FROM user_companies uc
    INNER JOIN users u ON uc.user_id = u.id
    INNER JOIN companies c ON uc.company_id = c.id
    WHERE uc.company_id = ?
  `;
  const params: any[] = [companyId];

  if (authRole === "company_admin") {
    query += " AND uc.role = 'cashier'";
  }

  query += " ORDER BY u.name ASC";
  const [rows] = await pool.query<RowDataPacket[]>(query, params);

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    userName: r.user_name || r.user_username,
    userEmail: r.user_email,
    userRole: r.global_role === "admin" ? "company_admin" : r.global_role,
    companyId: r.company_id,
    companyName: r.company_name,
    companyCode: r.company_code,
    role: r.role === "admin" ? "company_admin" : r.role,
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
  }));
}

/**
 * Retrieves companies assigned to a user
 */
export async function getUserAssignedCompanies(userId: string): Promise<Company[]> {
  if (!isLocalMySqlMode()) return [];
  await ensureLocalMySqlInitialized();

  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT c.* FROM companies c
     LEFT JOIN user_companies uc ON c.id = uc.company_id
     LEFT JOIN users u ON u.company_id = c.id
     WHERE (uc.user_id = ? OR u.id = ?) AND c.is_active = 1
     GROUP BY c.id
     ORDER BY c.name ASC`,
    [userId, userId]
  );

  return rows.map(mapRowToCompany);
}

/**
 * Switches the active company cookie for the current session.
 * Super Admins can switch to any active company.
 * Company Admins and Cashiers can ONLY switch to their assigned company!
 */
export async function switchActiveCompany(
  companyId: string
): Promise<{ success: boolean; company?: Company; error?: string }> {
  if (!isLocalMySqlMode()) return { success: false, error: "MySQL mode not active" };
  await ensureMasterDbInitialized();
  const masterPool = getMasterPool();

  const session = await getSession();
  let cookieStore: any = null;
  let rawRole = session?.role;
  let authId = session?.userId;
  try {
    cookieStore = await cookies();
    if (!rawRole) rawRole = cookieStore.get("auth_role")?.value;
    if (!authId) authId = cookieStore.get("auth_id")?.value;
  } catch {}

  const authRole = (rawRole as string) === "admin" ? "company_admin" : rawRole;

  // 1. Try master_companies
  const [rows] = await masterPool.query<RowDataPacket[]>(
    "SELECT * FROM master_companies WHERE id = ? AND is_active = 1",
    [companyId]
  );

  let selected: Company | null = null;
  if (rows && rows.length > 0) {
    // If non-super_admin, verify user has authorization to access this company
    if (authRole !== "super_admin") {
      if (session?.companyId && session.companyId !== companyId) {
        return { success: false, error: "Unauthorized: You are not authorized to switch to another company." };
      }
      const [assigned] = await masterPool.query<RowDataPacket[]>(
        "SELECT id FROM user_company_routing WHERE company_id = ? AND (user_id = ? OR username = ?) AND is_active = 1",
        [companyId, authId, session?.username || ""]
      );
      if (!assigned || assigned.length === 0) {
        return { success: false, error: "Unauthorized: You are not authorized to switch to this company." };
      }
    }
    selected = mapRowToCompany(rows[0]);
  } else {
    // Fallback to legacy
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();
    const [legacyRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM companies WHERE id = ? AND is_active = 1",
      [companyId]
    );
    if (!legacyRows || legacyRows.length === 0) {
      return { success: false, error: "Company not found or inactive." };
    }
    if (authRole !== "super_admin") {
      const [assigned] = await pool.query<RowDataPacket[]>(
        `SELECT u.id FROM users u
         LEFT JOIN user_companies uc ON u.id = uc.company_id
         WHERE u.id = ? AND (u.company_id = ? OR uc.company_id = ?)`,
        [companyId, authId, companyId, companyId]
      );
      if (!assigned || assigned.length === 0) {
        return { success: false, error: "Unauthorized: You are not authorized to switch to this company." };
      }
    }
    selected = mapRowToCompany(legacyRows[0]);
  }

  // Clear in-memory company context cache immediately
  clearCompanyContextCache();

  // Update session token so getSession() and /api/auth/me reflect the switched company
  try {
    const { updateSessionCompany } = await import("./auth-session");
    await updateSessionCompany(selected.id, selected.name, selected.databaseName);
  } catch {}

  if (cookieStore) {
    try {
      cookieStore.set("auth_company_id", selected.id, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
        sameSite: "lax",
        secure: false,
      });
    } catch {}
  }

  return { success: true, company: selected };
}
