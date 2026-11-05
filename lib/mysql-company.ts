import { cookies } from "next/headers";
import { getMysqlPool, withMySqlTransaction, isLocalMySqlMode } from "./mysql";
import { ensureLocalMySqlInitialized } from "./mysql-init";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { getSession } from "./auth-session";

export interface Company {
  id: string;
  name: string;
  code: string;
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
 * Server-side authorization check:
 * Resolves and validates the active company for the logged-in user.
 * NEVER trusts an unverified company ID from the client!
 */
export async function getAuthorizedCompanyContext(): Promise<Company> {
  if (!isLocalMySqlMode()) {
    throw new Error("getAuthorizedCompanyContext is strictly available in local MySQL mode.");
  }

  const cookieStore = await cookies();
  const session = await getSession();
  const authId = session?.userId || cookieStore.get("auth_id")?.value;
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const requestedCompanyId = cookieStore.get("auth_company_id")?.value;

  if (!authRole) {
    throw new Error("Unauthorized: User is not authenticated.");
  }

  const cacheKey = `${authRole}:${authId || 'no_id'}:${requestedCompanyId || 'default'}`;
  const cached = companyContextCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.company;
  }

  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();

  // 1. SUPER_ADMIN USER: Can view any company context
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
      try {
        cookieStore.set("auth_company_id", defaultCompany.id, { path: "/" });
      } catch {}
      companyContextCache.set(cacheKey, { company: defaultCompany, expiresAt: Date.now() + 5000 });
      return defaultCompany;
    }

    throw new Error("No active companies found. Please create a company.");
  }

  // 2. COMPANY_ADMIN USER: Strictly isolated to their assigned company
  if (authRole === "company_admin") {
    if (!authId) {
      throw new Error("Unauthorized: Active user session ID is missing.");
    }

    // First check user's direct company_id
    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT c.* FROM companies c
       INNER JOIN users u ON u.company_id = c.id
       WHERE u.id = ? AND c.is_active = 1`,
      [authId]
    );

    if (userRows && userRows.length > 0) {
      const assignedComp = mapRowToCompany(userRows[0]);
      try {
        cookieStore.set("auth_company_id", assignedComp.id, { path: "/" });
      } catch {}
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
      try {
        cookieStore.set("auth_company_id", assignedComp.id, { path: "/" });
      } catch {}
      companyContextCache.set(cacheKey, { company: assignedComp, expiresAt: Date.now() + 5000 });
      return assignedComp;
    }

    throw new Error(`Unauthorized: Company Admin '${authId}' is not assigned to any active company.`);
  }

  // 3. CASHIER USER: Strictly isolated to their assigned company
  if (!authId) {
    throw new Error("Unauthorized: Active user session ID is missing.");
  }

  const [assignedRows] = await pool.query<RowDataPacket[]>(
    `SELECT c.* FROM companies c
     INNER JOIN user_companies uc ON c.id = uc.company_id
     WHERE uc.user_id = ? AND c.is_active = 1`,
    [authId]
  );

  if (!assignedRows || assignedRows.length === 0) {
    throw new Error(`Unauthorized: User '${authId}' is not assigned to any active company.`);
  }

  if (requestedCompanyId) {
    const matched = assignedRows.find((r) => r.id === requestedCompanyId);
    if (matched) {
      const comp = mapRowToCompany(matched);
      companyContextCache.set(cacheKey, { company: comp, expiresAt: Date.now() + 5000 });
      return comp;
    }
  }

  const authorizedCompany = mapRowToCompany(assignedRows[0]);
  try {
    cookieStore.set("auth_company_id", authorizedCompany.id, { path: "/" });
  } catch {}

  companyContextCache.set(cacheKey, { company: authorizedCompany, expiresAt: Date.now() + 5000 });
  return authorizedCompany;
}

/**
 * Retrieves companies according to role:
 * Super Admin: receives all companies.
 * Company Admin / Cashier: receives ONLY their assigned company!
 */
export async function getAllCompanies(): Promise<Company[]> {
  if (!isLocalMySqlMode()) return [];
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const authId = session?.userId || cookieStore.get("auth_id")?.value;

  const pool = getMysqlPool();

  if (authRole === "super_admin") {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT c.*, COUNT(uc.id) AS user_count
      FROM companies c
      LEFT JOIN user_companies uc ON c.id = uc.company_id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    return rows.map(mapRowToCompany);
  }

  if (authRole === "company_admin") {
    const [rows] = await pool.query<RowDataPacket[]>(`
      SELECT c.*, COUNT(uc.id) AS user_count
      FROM companies c
      LEFT JOIN user_companies uc ON c.id = uc.company_id
      LEFT JOIN users u ON u.company_id = c.id
      WHERE (u.id = ? OR uc.user_id = ?) AND c.is_active = 1
      GROUP BY c.id
      ORDER BY c.name ASC
    `, [authId, authId]);
    return rows.map(mapRowToCompany);
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
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;

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
  const [allCompanies] = await pool.query<RowDataPacket[]>(
    "SELECT id FROM companies"
  );
  let maxSeq = 0;
  for (const c of allCompanies) {
    const match = (c.id || "").match(/^COMP-(\d+)$/i);
    if (match) {
      const num = parseInt(match[1], 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  }
  const nextSeq = maxSeq + 1;
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

    const [rows] = await conn.query<RowDataPacket[]>(
      "SELECT * FROM companies WHERE id = ?",
      [newId]
    );
    return mapRowToCompany(rows[0]);
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
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;

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
  return result.affectedRows > 0;
}

/**
 * Deletes a company and cleans up associated records (Strictly Super Admin only)
 */
export async function deleteCompany(id: string): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;

  if (authRole !== "super_admin") {
    throw new Error("Access denied: Only Super Admin privileges can delete a company.");
  }

  const pool = getMysqlPool();
  return await withMySqlTransaction(async (conn) => {
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
    return result.affectedRows > 0;
  });
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
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;

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

  return true;
}

/**
 * Creates a cashier user account directly for a specific company
 * Allowed for:
 * 1. Super Admin
 * 2. Company Admin assigned to this company
 */
export async function createCompanyCashier(data: {
  companyId: string;
  username: string;
  password: string;
}): Promise<{ id: string; username: string }> {
  if (!isLocalMySqlMode()) throw new Error("Local MySQL mode is required.");
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const authId = session?.userId || cookieStore.get("auth_id")?.value;

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

  return await withMySqlTransaction(async (conn) => {
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
}

/**
 * Removes a user assignment from a company
 */
export async function removeUserFromCompany(userId: string, companyId: string): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const authId = session?.userId || cookieStore.get("auth_id")?.value;

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

    // Company Admin cannot remove another admin or super_admin
    const [targetUser] = await pool.query<RowDataPacket[]>("SELECT role FROM users WHERE id = ?", [userId]);
    const allowedStaffRoles = ['cashier', 'manager', 'chef', 'waiter'];
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

  return result.affectedRows > 0;
}

/**
 * Retrieves all users assigned to a specific company
 */
export async function getCompanyUsers(companyId: string): Promise<UserCompanyAssignment[]> {
  if (!isLocalMySqlMode()) return [];
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const authId = session?.userId || cookieStore.get("auth_id")?.value;

  // Company Admins can only view users for their own assigned company
  if (authRole === "company_admin") {
    const pool = getMysqlPool();
    const [assigned] = await pool.query<RowDataPacket[]>(
      `SELECT u.id FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.company_id = ?
       WHERE u.id = ? AND (u.company_id = ? OR uc.company_id = ?)`,
      [companyId, authId, companyId, companyId]
    );
    if (!assigned || assigned.length === 0) {
      throw new Error("Access denied: You are not authorized to view users for this company.");
    }
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

  // Company Admin can view only cashiers of their company
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
export async function switchActiveCompany(companyId: string): Promise<{ success: boolean; company?: Company; error?: string }> {
  if (!isLocalMySqlMode()) return { success: false, error: "MySQL mode not active" };
  await ensureLocalMySqlInitialized();

  const session = await getSession();
  const cookieStore = await cookies();
  const rawRole = session?.role || cookieStore.get("auth_role")?.value;
  const authRole = rawRole === "admin" ? "company_admin" : rawRole;
  const authId = session?.userId || cookieStore.get("auth_id")?.value;

  const pool = getMysqlPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM companies WHERE id = ? AND is_active = 1",
    [companyId]
  );

  if (!rows || rows.length === 0) {
    return { success: false, error: "Company not found or inactive." };
  }

  // Authorization enforcement: non-super_admin must be assigned to the company
  if (authRole !== "super_admin") {
    const [assigned] = await pool.query<RowDataPacket[]>(
      `SELECT u.id FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id AND uc.company_id = ?
       WHERE u.id = ? AND (u.company_id = ? OR uc.company_id = ?)`,
      [companyId, authId, companyId, companyId]
    );
    if (!assigned || assigned.length === 0) {
      return { success: false, error: "Unauthorized: You are not authorized to switch to this company." };
    }
  }

  const selected = mapRowToCompany(rows[0]);

  // Clear in-memory company context cache immediately
  clearCompanyContextCache();

  // Update session token so getSession() and /api/auth/me reflect the switched company
  try {
    const { updateSessionCompany } = await import('./auth-session');
    await updateSessionCompany(selected.id, selected.name);
  } catch {}

  cookieStore.set("auth_company_id", selected.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    secure: false,
  });

  return { success: true, company: selected };
}
