import mysql from "mysql2/promise";

interface CompanyPoolEntry {
  pool: mysql.Pool;
  databaseName: string;
  lastUsedAt: number;
  activeQueries: number;
}

const globalForMySQL = globalThis as typeof globalThis & {
  mysqlPool?: mysql.Pool;
  masterPool?: mysql.Pool;
  companyPools?: Map<string, CompanyPoolEntry>;
};

if (!globalForMySQL.companyPools) {
  globalForMySQL.companyPools = new Map<string, CompanyPoolEntry>();
}

/**
 * Strict pool sizing configuration.
 * Safe limit of 3-4 connections per company pool to keep cumulative connections
 * safely within MySQL's default max_connections (151).
 */
const COMPANY_POOL_CONFIG = {
  connectionLimit: 4,
  maxIdle: 1,
  idleTimeout: 15000, // 15 seconds
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const MASTER_POOL_CONFIG = {
  connectionLimit: 10,
  maxIdle: 2,
  idleTimeout: 30000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
};

const MAX_CACHED_COMPANY_POOLS = 25;

/**
 * Validates that database name contains only safe alphanumeric characters and underscores.
 * Prevents SQL injection or path traversal via database names.
 */
export function isValidDatabaseName(dbName: string): boolean {
  return /^[a-zA-Z0-9_]{3,64}$/.test(dbName);
}

/**
 * Returns true strictly when explicitly configured for local MySQL mode.
 */
export function isLocalMySqlMode(): boolean {
  return process.env.LOCAL_DB_MODE === "mysql";
}

/**
 * Pre-flight host safety validation:
 * Strictly blocks any connection attempts outside local development (127.0.0.1 or localhost).
 */
function getMysqlConfig() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const user = process.env.MYSQL_USER;
  const password = process.env.MYSQL_PASSWORD;
  const port = Number(process.env.MYSQL_PORT || 3306);

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Safety violation: Local MySQL host must be 127.0.0.1 or localhost (found '${host}'). Remote production access blocked.`
    );
  }

  if (!user || password === undefined) {
    throw new Error(
      "Missing local MySQL configuration. Please ensure MYSQL_USER and MYSQL_PASSWORD are set."
    );
  }

  return { host, user, password, port };
}

/**
 * Legacy connection pool for 'local_billing_db'.
 * Preserved for backward compatibility during Phase 2.
 */
function createLegacyPool(): mysql.Pool {
  const { host, user, password, port } = getMysqlConfig();
  const database = process.env.MYSQL_DATABASE || "local_billing_db";

  return mysql.createPool({
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 20,
    maxIdle: 5,
    idleTimeout: 30000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

/**
 * Retrieves the legacy MySQL pool for local_billing_db.
 */
export function getMysqlPool(): mysql.Pool {
  if (!globalForMySQL.mysqlPool) {
    globalForMySQL.mysqlPool = createLegacyPool();
  }
  return globalForMySQL.mysqlPool;
}

/**
 * Retrieves the central Master Database connection pool ('billing_master_db').
 * Creates the pool lazily, preserves master availability, and reuses it across all requests.
 */
export function getMasterPool(): mysql.Pool {
  if (!globalForMySQL.masterPool) {
    const { host, user, password, port } = getMysqlConfig();

    globalForMySQL.masterPool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: "billing_master_db",
      waitForConnections: true,
      ...MASTER_POOL_CONFIG,
    });
  }

  return globalForMySQL.masterPool;
}

/**
 * Evicts the least recently used idle pool if cache capacity is reached.
 * Never evicts pools that have active queries running.
 */
async function evictOldestIdlePoolIfNeeded(): Promise<void> {
  const entries = globalForMySQL.companyPools!;
  if (entries.size < MAX_CACHED_COMPANY_POOLS) return;

  let oldestKey: string | null = null;
  let oldestTime = Infinity;

  for (const [dbName, entry] of entries.entries()) {
    if (entry.activeQueries === 0 && entry.lastUsedAt < oldestTime) {
      oldestTime = entry.lastUsedAt;
      oldestKey = dbName;
    }
  }

  if (oldestKey) {
    const entry = entries.get(oldestKey);
    if (entry) {
      entries.delete(oldestKey);
      try {
        await entry.pool.end();
      } catch (err: any) {
        console.warn(`[Pool Eviction] Error closing idle pool for ${oldestKey}:`, err.message);
      }
    }
  }
}

/**
 * Creates or retrieves a cached connection pool for a specific company database.
 * Reuses pools to prevent connection leaks and adheres to safe connection limits (3-4).
 *
 * @param databaseName Safe database name (e.g. 'company_001_db')
 */
export function getCompanyPool(databaseName: string): mysql.Pool {
  if (!isValidDatabaseName(databaseName)) {
    throw new Error(`Safety violation: Invalid company database name '${databaseName}'.`);
  }

  const pools = globalForMySQL.companyPools!;
  let entry = pools.get(databaseName);

  if (!entry) {
    // Check if eviction is necessary before creating new pool
    evictOldestIdlePoolIfNeeded().catch(() => {});

    const { host, user, password, port } = getMysqlConfig();

    const pool = mysql.createPool({
      host,
      port,
      user,
      password,
      database: databaseName,
      waitForConnections: true,
      ...COMPANY_POOL_CONFIG,
    });

    entry = {
      pool,
      databaseName,
      lastUsedAt: Date.now(),
      activeQueries: 0,
    };

    pools.set(databaseName, entry);
  } else {
    entry.lastUsedAt = Date.now();
  }

  return entry.pool;
}

/**
 * Tracks active query start for a company database to prevent premature pool cleanup.
 */
export function trackCompanyQueryStart(databaseName: string): void {
  const entry = globalForMySQL.companyPools?.get(databaseName);
  if (entry) {
    entry.activeQueries++;
    entry.lastUsedAt = Date.now();
  }
}

/**
 * Tracks active query completion for a company database.
 */
export function trackCompanyQueryEnd(databaseName: string): void {
  const entry = globalForMySQL.companyPools?.get(databaseName);
  if (entry) {
    entry.activeQueries = Math.max(0, entry.activeQueries - 1);
    entry.lastUsedAt = Date.now();
  }
}

/**
 * Safely closes and evicts a specific company database connection pool from cache.
 * Refuses to close if active queries are still using it.
 */
export async function closeCompanyPool(
  databaseName: string,
  force = false
): Promise<boolean> {
  const pools = globalForMySQL.companyPools;
  if (!pools) return true;

  const entry = pools.get(databaseName);
  if (!entry) return true;

  if (!force && entry.activeQueries > 0) {
    console.warn(
      `[Pool Warning] Refusing to close pool for '${databaseName}' while ${entry.activeQueries} active queries are in progress.`
    );
    return false;
  }

  pools.delete(databaseName);
  try {
    await entry.pool.end();
    return true;
  } catch (err: any) {
    console.warn(`Error closing pool for ${databaseName}:`, err.message);
    return false;
  }
}

/**
 * Cleans up idle company database pools that have exceeded maxIdleAgeMs.
 * Never closes pools with active queries, and preserves master pool availability.
 */
export async function cleanupIdleCompanyPools(
  maxIdleAgeMs = 5 * 60 * 1000 // 5 minutes default
): Promise<number> {
  const pools = globalForMySQL.companyPools;
  if (!pools) return 0;

  const now = Date.now();
  let closedCount = 0;

  for (const [dbName, entry] of Array.from(pools.entries())) {
    if (entry.activeQueries === 0 && now - entry.lastUsedAt > maxIdleAgeMs) {
      pools.delete(dbName);
      try {
        await entry.pool.end();
        closedCount++;
      } catch (err: any) {
        console.warn(`Error closing idle pool for ${dbName}:`, err.message);
      }
    }
  }

  return closedCount;
}

/**
 * Closes all active connection pools (master, company pools, and legacy pool).
 */
export async function closeAllPools(): Promise<void> {
  if (globalForMySQL.companyPools) {
    for (const [dbName, entry] of globalForMySQL.companyPools.entries()) {
      try {
        await entry.pool.end();
      } catch (err: any) {
        console.warn(`Error closing pool for ${dbName}:`, err.message);
      }
    }
    globalForMySQL.companyPools.clear();
  }

  if (globalForMySQL.masterPool) {
    try {
      await globalForMySQL.masterPool.end();
    } catch {}
    globalForMySQL.masterPool = undefined;
  }

  if (globalForMySQL.mysqlPool) {
    try {
      await globalForMySQL.mysqlPool.end();
    } catch {}
    globalForMySQL.mysqlPool = undefined;
  }
}

/**
 * Returns the number of currently cached company connection pools.
 */
export function getCachedCompanyPoolsCount(): number {
  return globalForMySQL.companyPools ? globalForMySQL.companyPools.size : 0;
}

/**
 * Returns diagnostic metadata for all cached company connection pools.
 */
export function getCompanyPoolsDiagnostics(): Array<{
  databaseName: string;
  activeQueries: number;
  idleTimeMs: number;
}> {
  if (!globalForMySQL.companyPools) return [];
  const now = Date.now();
  return Array.from(globalForMySQL.companyPools.values()).map((e) => ({
    databaseName: e.databaseName,
    activeQueries: e.activeQueries,
    idleTimeMs: now - e.lastUsedAt,
  }));
}

/**
 * Checks whether a specific company database pool is currently active and cached.
 */
export function hasCompanyPool(databaseName: string): boolean {
  return globalForMySQL.companyPools ? globalForMySQL.companyPools.has(databaseName) : false;
}

/**
 * Executes a callback within an atomic transaction on the legacy MySQL pool.
 */
export async function withMySqlTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getMysqlPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Error during transaction rollback:", rollbackErr);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Executes a callback within an atomic transaction on the Master database.
 */
export async function withMasterTransaction<T>(
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  const pool = getMasterPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error("Error during master transaction rollback:", rollbackErr);
    }
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Executes a callback within an atomic transaction on a specific Company database.
 * Tracks active queries to protect pool from premature cleanup.
 */
export async function withCompanyTransaction<T>(
  databaseName: string,
  callback: (connection: mysql.PoolConnection) => Promise<T>
): Promise<T> {
  trackCompanyQueryStart(databaseName);
  const pool = getCompanyPool(databaseName);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackErr) {
      console.error(`Error during transaction rollback for ${databaseName}:`, rollbackErr);
    }
    throw error;
  } finally {
    connection.release();
    trackCompanyQueryEnd(databaseName);
  }
}
