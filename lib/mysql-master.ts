import mysql from "mysql2/promise";
import { getMasterPool, withMasterTransaction, isLocalMySqlMode } from "./mysql";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { verifyPassword } from "./users";

export interface MasterCompany {
  id: string;
  name: string;
  code: string;
  databaseName: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  status: "active" | "inactive" | "provisioning" | "failed";
  isActive: boolean;
  provisioningStatus: "pending" | "in_progress" | "completed" | "failed";
  provisioningError?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  currency: string;
  allowPromoStacking: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface MasterUser {
  id: string;
  username: string;
  name: string;
  email?: string;
  passwordHash: string;
  role: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface UserCompanyRoute {
  id: string;
  userId: string;
  username: string;
  companyId: string;
  databaseName: string;
  role: string;
  accountStatus: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ResolveRouteResult {
  resolved: boolean;
  route?: UserCompanyRoute;
  ambiguous: boolean;
  error?: string;
  matches: Array<{
    companyId: string;
    companyCode: string;
    companyName: string;
    role: string;
  }>;
}

let masterInitPromise: Promise<void> | null = null;

function getDirectServerConnection() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const port = Number(process.env.MYSQL_PORT || 3306);

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Safety violation: Master DB host must be 127.0.0.1 or localhost (found '${host}'). Remote production access blocked.`
    );
  }

  return mysql.createConnection({ host, user, password, port });
}

/**
 * Initializes the central Master Database ('billing_master_db') and its core tables.
 * Safe to call idempotently.
 */
export async function ensureMasterDbInitialized(): Promise<void> {
  if (!isLocalMySqlMode()) {
    return;
  }

  if (masterInitPromise) {
    return masterInitPromise;
  }

  masterInitPromise = (async () => {
    // 1. Connect without selecting database to ensure billing_master_db exists
    const serverConn = await getDirectServerConnection();
    try {
      await serverConn.query(`
        CREATE DATABASE IF NOT EXISTS \`billing_master_db\`
        CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
      `);
    } finally {
      await serverConn.end();
    }

    // 2. Connect to billing_master_db via pool and initialize master tables
    const pool = getMasterPool();

    // Table: master_companies
    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_companies (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        database_name VARCHAR(100) NOT NULL UNIQUE,
        db_host VARCHAR(255) NULL,
        db_port INT NULL,
        db_user VARCHAR(255) NULL,
        db_password VARCHAR(255) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
        is_active TINYINT(1) NOT NULL DEFAULT 0,
        provisioning_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        provisioning_error TEXT NULL,
        address TEXT NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        gstin VARCHAR(50) NULL,
        currency VARCHAR(10) DEFAULT 'INR',
        allow_promo_stacking TINYINT(1) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_mc_status (status),
        INDEX idx_mc_active (is_active),
        INDEX idx_mc_code (code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: master_users (Super Admins)
    // Strictly requires password_hash. Plaintext password column is strictly excluded.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_mu_username (username)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Safely remove legacy plaintext 'password' column if it exists from earlier prototype
    try {
      const [cols]: any = await pool.query(
        "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'billing_master_db' AND TABLE_NAME = 'master_users' AND COLUMN_NAME = 'password'"
      );
      if (cols && cols.length > 0) {
        await pool.query("ALTER TABLE master_users DROP COLUMN password");
      }
    } catch {}

    // Table: user_company_routing
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_company_routing (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        username VARCHAR(255) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        database_name VARCHAR(100) NOT NULL,
        role VARCHAR(50) NOT NULL,
        account_status VARCHAR(50) NOT NULL DEFAULT 'active',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_company_username (company_id, username),
        INDEX idx_routing_username (username),
        INDEX idx_routing_user_id (user_id),
        INDEX idx_routing_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: master_settings
    await pool.query(`
      CREATE TABLE IF NOT EXISTS master_settings (
        setting_key VARCHAR(100) PRIMARY KEY,
        setting_value LONGTEXT NOT NULL,
        description VARCHAR(255) NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: _migrations (Master schema tracking)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Table: login_activities (Master Authentication & Session Monitoring)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_activities (
        id VARCHAR(64) PRIMARY KEY,
        session_id VARCHAR(64) NOT NULL,
        user_id VARCHAR(64) NULL,
        username VARCHAR(255) NOT NULL,
        employee_name VARCHAR(255) NULL,
        company_id VARCHAR(64) NULL,
        company_name VARCHAR(255) NULL,
        login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        logout_at TIMESTAMP NULL,
        last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        session_status ENUM('active', 'logged_out', 'terminated', 'expired') DEFAULT 'active',
        login_status ENUM('success', 'failed') DEFAULT 'success',
        failure_reason VARCHAR(255) NULL,
        device_type VARCHAR(50) NOT NULL DEFAULT 'Browser',
        browser_info VARCHAR(255) NULL,
        ip_address VARCHAR(45) NULL,
        terminated_by VARCHAR(64) NULL,
        terminated_at TIMESTAMP NULL,
        INDEX idx_la_user (user_id),
        INDEX idx_la_company (company_id),
        INDEX idx_la_session (session_id),
        INDEX idx_la_status (session_status),
        INDEX idx_la_login_at (login_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  })().catch((err) => {
    masterInitPromise = null;
    throw err;
  });

  return masterInitPromise;
}

function mapRowToMasterCompany(r: any): MasterCompany {
  return {
    id: r.id,
    name: r.name,
    code: r.code,
    databaseName: r.database_name,
    dbHost: r.db_host || undefined,
    dbPort: r.db_port ? Number(r.db_port) : undefined,
    dbUser: r.db_user || undefined,
    status: r.status || "provisioning",
    isActive: Boolean(r.is_active),
    provisioningStatus: r.provisioning_status || "pending",
    provisioningError: r.provisioning_error || null,
    address: r.address || undefined,
    phone: r.phone || undefined,
    email: r.email || undefined,
    gstin: r.gstin || undefined,
    currency: r.currency || "INR",
    allowPromoStacking: Boolean(r.allow_promo_stacking),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  };
}

/**
 * Retrieves all registered companies from the Master Database.
 */
export async function getMasterCompanies(): Promise<MasterCompany[]> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM master_companies ORDER BY created_at ASC"
  );
  return rows.map(mapRowToMasterCompany);
}

/**
 * Retrieves a single company by its unique Company ID from the Master Database.
 */
export async function getMasterCompanyById(id: string): Promise<MasterCompany | null> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM master_companies WHERE id = ? LIMIT 1",
    [id]
  );
  return rows.length > 0 ? mapRowToMasterCompany(rows[0]) : null;
}

/**
 * Retrieves a single company by its unique Company Code from the Master Database.
 */
export async function getMasterCompanyByCode(code: string): Promise<MasterCompany | null> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM master_companies WHERE code = ? LIMIT 1",
    [code.toUpperCase()]
  );
  return rows.length > 0 ? mapRowToMasterCompany(rows[0]) : null;
}

/**
 * Retrieves a single company by its allocated Database Name from the Master Database.
 */
export async function getMasterCompanyByDatabase(databaseName: string): Promise<MasterCompany | null> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM master_companies WHERE database_name = ? LIMIT 1",
    [databaseName]
  );
  return rows.length > 0 ? mapRowToMasterCompany(rows[0]) : null;
}

/**
 * Upserts a company registration record in the Master Database.
 */
export async function upsertMasterCompany(company: {
  id: string;
  name: string;
  code: string;
  databaseName: string;
  dbHost?: string;
  dbPort?: number;
  dbUser?: string;
  status?: "active" | "inactive" | "provisioning" | "failed";
  isActive?: boolean;
  provisioningStatus?: "pending" | "in_progress" | "completed" | "failed";
  provisioningError?: string | null;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  currency?: string;
  allowPromoStacking?: boolean;
}): Promise<void> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  await pool.query(
    `INSERT INTO master_companies (
      id, name, code, database_name, db_host, db_port, db_user,
      status, is_active, provisioning_status, provisioning_error,
      address, phone, email, gstin, currency, allow_promo_stacking
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      name = VALUES(name),
      code = VALUES(code),
      database_name = VALUES(database_name),
      db_host = VALUES(db_host),
      db_port = VALUES(db_port),
      db_user = VALUES(db_user),
      status = VALUES(status),
      is_active = VALUES(is_active),
      provisioning_status = VALUES(provisioning_status),
      provisioning_error = VALUES(provisioning_error),
      address = VALUES(address),
      phone = VALUES(phone),
      email = VALUES(email),
      gstin = VALUES(gstin),
      currency = VALUES(currency),
      allow_promo_stacking = VALUES(allow_promo_stacking)`,
    [
      company.id,
      company.name,
      company.code.toUpperCase(),
      company.databaseName,
      company.dbHost || null,
      company.dbPort || null,
      company.dbUser || null,
      company.status || "provisioning",
      company.isActive ? 1 : 0,
      company.provisioningStatus || "pending",
      company.provisioningError || null,
      company.address || null,
      company.phone || null,
      company.email || null,
      company.gstin || null,
      company.currency || "INR",
      company.allowPromoStacking ? 1 : 0,
    ]
  );
}

/**
 * Updates the provisioning status of a company in the Master Database.
 */
export async function updateMasterCompanyProvisioningStatus(
  companyId: string,
  status: "active" | "inactive" | "provisioning" | "failed",
  provisioningStatus: "pending" | "in_progress" | "completed" | "failed",
  error?: string | null
): Promise<void> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const isActive = status === "active" && provisioningStatus === "completed" ? 1 : 0;

  await pool.query(
    `UPDATE master_companies 
     SET status = ?, provisioning_status = ?, is_active = ?, provisioning_error = ?, updated_at = NOW()
     WHERE id = ?`,
    [status, provisioningStatus, isActive, error || null, companyId]
  );
}

// ============================================================================
// SUPER ADMIN SECURITY (MASTER USERS)
// ============================================================================

/**
 * Registers or updates a Super Admin user account in master_users.
 * Strictly enforces secure password hashes (scrypt format). Plaintext passwords rejected.
 */
export async function createMasterSuperAdmin(user: {
  id: string;
  username: string;
  name: string;
  email?: string;
  passwordHash: string;
  isActive?: boolean;
}): Promise<void> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const cleanUser = user.username.toLowerCase().trim();
  const hash = user.passwordHash.trim();

  if (!hash.startsWith("scrypt:")) {
    throw new Error(
      "Security violation: Super Admin accounts strictly require an scrypt password hash. Plaintext passwords are prohibited."
    );
  }

  await pool.query(
    `INSERT INTO master_users (id, username, name, email, password_hash, role, is_active)
     VALUES (?, ?, ?, ?, ?, 'super_admin', ?)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       email = VALUES(email),
       password_hash = VALUES(password_hash),
       is_active = VALUES(is_active),
       updated_at = NOW()`,
    [
      user.id,
      cleanUser,
      user.name.trim(),
      user.email || null,
      hash,
      user.isActive !== false ? 1 : 0,
    ]
  );
}

/**
 * Retrieves a Super Admin account from master_users by username.
 */
export async function getMasterSuperAdminByUsername(username: string): Promise<MasterUser | null> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT id, username, name, email, password_hash, role, is_active, created_at, updated_at FROM master_users WHERE username = ? LIMIT 1",
    [username.toLowerCase().trim()]
  );

  if (!rows || rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    username: r.username,
    name: r.name,
    email: r.email || undefined,
    passwordHash: r.password_hash,
    role: r.role,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  };
}

/**
 * Verifies credentials for Super Admin using constant-time verification.
 */
export async function verifyMasterSuperAdminCredentials(
  username: string,
  plainPassword: string
): Promise<MasterUser | null> {
  const superAdmin = await getMasterSuperAdminByUsername(username);
  if (!superAdmin || !superAdmin.isActive) return null;

  const valid = verifyPassword(plainPassword, superAdmin.passwordHash);
  return valid ? superAdmin : null;
}

// ============================================================================
// USER ROUTING & UNAMBIGUOUS COMPANY RESOLUTION
// ============================================================================

/**
 * Sets or updates a user routing entry in the Master Database.
 */
export async function setUserCompanyRoute(route: {
  id?: string;
  userId: string;
  username: string;
  companyId: string;
  databaseName: string;
  role: string;
  accountStatus?: string;
  isActive?: boolean;
}): Promise<void> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const routeId = route.id || `ucr_${route.companyId}_${route.userId}`;

  await pool.query(
    `INSERT INTO user_company_routing (
      id, user_id, username, company_id, database_name, role, account_status, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      user_id = VALUES(user_id),
      database_name = VALUES(database_name),
      role = VALUES(role),
      account_status = VALUES(account_status),
      is_active = VALUES(is_active)`,
    [
      routeId,
      route.userId,
      route.username.toLowerCase().trim(),
      route.companyId,
      route.databaseName,
      route.role,
      route.accountStatus || "active",
      route.isActive !== undefined ? (route.isActive ? 1 : 0) : 1,
    ]
  );
}

/**
 * Retrieves routing matches for a username across companies from the Master Database.
 */
export async function getUserCompanyRoutes(username: string): Promise<UserCompanyRoute[]> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM user_company_routing 
     WHERE username = ? AND is_active = 1`,
    [username.toLowerCase().trim()]
  );

  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    companyId: r.company_id,
    databaseName: r.database_name,
    role: r.role,
    accountStatus: r.account_status,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
    updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
  }));
}

/**
 * Resolves user company route unambiguously.
 * Prevents account hijacking or wrong-tenant selection when duplicate usernames exist across companies.
 *
 * @param params.username Target username
 * @param params.companyIdentifier Optional Company ID (e.g. 'COMP-0001') or Code (e.g. 'XYZ')
 */
export async function resolveUserCompanyRoute(params: {
  username: string;
  companyIdentifier?: string;
}): Promise<ResolveRouteResult> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const cleanUser = params.username.toLowerCase().trim();
  const cleanComp = (params.companyIdentifier || "").trim();

  // 1. If explicit companyIdentifier is provided, resolve strictly to that company
  if (cleanComp) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT ucr.*, mc.code as company_code, mc.name as company_name, mc.is_active as comp_is_active, mc.status as comp_status
       FROM user_company_routing ucr
       INNER JOIN master_companies mc ON ucr.company_id = mc.id
       WHERE ucr.username = ? 
         AND (ucr.company_id = ? OR mc.code = ?)
       LIMIT 1`,
      [cleanUser, cleanComp, cleanComp.toUpperCase()]
    );

    if (rows && rows.length > 0) {
      const r = rows[0];
      if (r.comp_is_active === 0 || r.comp_status === "inactive") {
        return {
          resolved: false,
          ambiguous: false,
          error: `Company '${r.company_name || cleanComp}' is inactive or suspended.`,
          matches: [],
        };
      }
      if (r.is_active === 0) {
        return {
          resolved: false,
          ambiguous: false,
          error: `User account in company '${r.company_name || cleanComp}' is deactivated.`,
          matches: [],
        };
      }
      return {
        resolved: true,
        ambiguous: false,
        route: {
          id: r.id,
          userId: r.user_id,
          username: r.username,
          companyId: r.company_id,
          databaseName: r.database_name,
          role: r.role,
          accountStatus: r.account_status,
          isActive: Boolean(r.is_active),
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
        },
        matches: [],
      };
    }

    return {
      resolved: false,
      ambiguous: false,
      error: `User '${cleanUser}' was not found in company '${cleanComp}'.`,
      matches: [],
    };
  }

  // 2. No companyIdentifier provided: check all companies where username exists
  const [matchesRows] = await pool.query<RowDataPacket[]>(
    `SELECT ucr.*, mc.code as company_code, mc.name as company_name
     FROM user_company_routing ucr
     INNER JOIN master_companies mc ON ucr.company_id = mc.id
     WHERE ucr.username = ? 
       AND ucr.is_active = 1
       AND mc.is_active = 1`,
    [cleanUser]
  );

  if (!matchesRows || matchesRows.length === 0) {
    return {
      resolved: false,
      ambiguous: false,
      error: `User '${cleanUser}' does not exist or is inactive.`,
      matches: [],
    };
  }

  // Exactly 1 match found across all companies: safe deterministic resolution
  if (matchesRows.length === 1) {
    const r = matchesRows[0];
    return {
      resolved: true,
      ambiguous: false,
      route: {
        id: r.id,
        userId: r.user_id,
        username: r.username,
        companyId: r.company_id,
        databaseName: r.database_name,
        role: r.role,
        accountStatus: r.account_status,
        isActive: Boolean(r.is_active),
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
        updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : Date.now(),
      },
      matches: [],
    };
  }

  // Multiple companies contain this username: refuse to guess! Mark ambiguous.
  const options = matchesRows.map((r) => ({
    companyId: r.company_id,
    companyCode: r.company_code,
    companyName: r.company_name,
    role: r.role,
  }));

  return {
    resolved: false,
    ambiguous: true,
    error: `Ambiguous user account: Username '${cleanUser}' exists in ${matchesRows.length} different companies. Please specify your company code.`,
    matches: options,
  };
}

/**
 * Retrieves a master setting by key.
 */
export async function getMasterSetting(key: string): Promise<string | null> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT setting_value FROM master_settings WHERE setting_key = ? LIMIT 1",
    [key]
  );

  return rows.length > 0 ? rows[0].setting_value : null;
}

/**
 * Sets a master global setting.
 */
export async function setMasterSetting(
  key: string,
  value: string,
  description?: string
): Promise<void> {
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  await pool.query(
    `INSERT INTO master_settings (setting_key, setting_value, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       setting_value = VALUES(setting_value),
       description = VALUES(description),
       updated_at = NOW()`,
    [key, value, description || null]
  );
}

export interface LoginActivityEntry {
  id?: string;
  sessionId: string;
  userId?: string | null;
  username: string;
  employeeName?: string | null;
  companyId?: string | null;
  companyName?: string | null;
  sessionStatus?: 'active' | 'logged_out' | 'terminated' | 'expired';
  loginStatus?: 'success' | 'failed';
  failureReason?: string | null;
  deviceType?: string;
  browserInfo?: string | null;
  ipAddress?: string | null;
}

/**
 * Records a login attempt (successful or failed) in the master database.
 */
export async function recordLoginActivity(entry: LoginActivityEntry): Promise<string> {
  if (!isLocalMySqlMode()) return entry.sessionId;
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  const id = entry.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pool.query(
    `INSERT INTO login_activities (
      id, session_id, user_id, username, employee_name, company_id, company_name,
      session_status, login_status, failure_reason, device_type, browser_info, ip_address, login_at, last_activity_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      entry.sessionId,
      entry.userId || null,
      entry.username,
      entry.employeeName || null,
      entry.companyId || null,
      entry.companyName || null,
      entry.sessionStatus || (entry.loginStatus === 'failed' ? 'expired' : 'active'),
      entry.loginStatus || 'success',
      entry.failureReason || null,
      entry.deviceType || 'Browser',
      entry.browserInfo || null,
      entry.ipAddress || '127.0.0.1',
    ]
  );

  return id;
}

/**
 * Updates session status (logged_out or terminated) in master database.
 */
export async function updateLoginSessionStatus(
  sessionId: string,
  status: 'active' | 'logged_out' | 'terminated' | 'expired',
  terminatedBy?: string
): Promise<boolean> {
  if (!isLocalMySqlMode() || !sessionId) return false;
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  if (status === 'terminated') {
    await pool.query(
      `UPDATE login_activities 
       SET session_status = 'terminated', terminated_by = ?, terminated_at = NOW(), last_activity_at = NOW()
       WHERE session_id = ?`,
      [terminatedBy || 'admin', sessionId]
    );
  } else if (status === 'logged_out') {
    await pool.query(
      `UPDATE login_activities 
       SET session_status = 'logged_out', logout_at = NOW(), last_activity_at = NOW()
       WHERE session_id = ? AND session_status = 'active'`,
      [sessionId]
    );
  } else {
    await pool.query(
      `UPDATE login_activities 
       SET session_status = ?, last_activity_at = NOW()
       WHERE session_id = ?`,
      [status, sessionId]
    );
  }

  return true;
}

/**
 * Checks if a session has been terminated by an administrator.
 */
export async function isSessionTerminated(sessionId: string): Promise<boolean> {
  if (!isLocalMySqlMode() || !sessionId) return false;
  try {
    await ensureMasterDbInitialized();
    const pool = getMasterPool();

    const [rows]: any = await pool.query(
      `SELECT session_status FROM login_activities WHERE session_id = ? ORDER BY login_at DESC LIMIT 1`,
      [sessionId]
    );

    if (rows && rows.length > 0) {
      return rows[0].session_status === 'terminated' || rows[0].session_status === 'logged_out';
    }
  } catch (err: any) {
    console.warn('isSessionTerminated check notice:', err.message);
  }
  return false;
}

/**
 * Updates the last activity time for an active session.
 */
export async function updateSessionHeartbeat(sessionId: string): Promise<void> {
  if (!isLocalMySqlMode() || !sessionId) return;
  try {
    const pool = getMasterPool();
    await pool.query(
      `UPDATE login_activities SET last_activity_at = NOW() WHERE session_id = ? AND session_status = 'active'`,
      [sessionId]
    );
  } catch {}
}

/**
 * Queries login activities with multi-tenant filtering.
 */
export async function getLoginActivities(filters: {
  companyId?: string | null;
  username?: string;
  deviceType?: string;
  sessionStatus?: string;
  loginStatus?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<any[]> {
  if (!isLocalMySqlMode()) return [];
  await ensureMasterDbInitialized();
  const pool = getMasterPool();

  let query = `
    SELECT 
      id, session_id as sessionId, user_id as userId, username, employee_name as employeeName,
      company_id as companyId, company_name as companyName, login_at as loginAt, logout_at as logoutAt,
      last_activity_at as lastActivityAt, session_status as sessionStatus, login_status as loginStatus,
      failure_reason as failureReason, device_type as deviceType, browser_info as browserInfo,
      ip_address as ipAddress, terminated_by as terminatedBy, terminated_at as terminatedAt
    FROM login_activities
    WHERE 1=1
  `;
  const params: any[] = [];

  if (filters.companyId && filters.companyId !== 'all') {
    query += ` AND company_id = ?`;
    params.push(filters.companyId);
  }

  if (filters.username) {
    query += ` AND (LOWER(username) LIKE ? OR LOWER(employee_name) LIKE ?)`;
    const term = `%${filters.username.toLowerCase()}%`;
    params.push(term, term);
  }

  if (filters.deviceType && filters.deviceType !== 'all') {
    query += ` AND device_type = ?`;
    params.push(filters.deviceType);
  }

  if (filters.sessionStatus && filters.sessionStatus !== 'all') {
    query += ` AND session_status = ?`;
    params.push(filters.sessionStatus);
  }

  if (filters.loginStatus && filters.loginStatus !== 'all') {
    query += ` AND login_status = ?`;
    params.push(filters.loginStatus);
  }

  if (filters.startDate) {
    query += ` AND login_at >= ?`;
    params.push(filters.startDate);
  }

  if (filters.endDate) {
    query += ` AND login_at <= ?`;
    params.push(filters.endDate);
  }

  query += ` ORDER BY login_at DESC LIMIT ?`;
  params.push(filters.limit || 200);

  const [rows]: any = await pool.query(query, params);
  return rows;
}
