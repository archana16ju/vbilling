import mysql from "mysql2/promise";

const globalForMySQL = globalThis as typeof globalThis & {
  mysqlPool?: mysql.Pool;
};

/**
 * Returns true strictly when explicitly configured for local MySQL mode
 * via LOCAL_DB_MODE=mysql.
 */
export function isLocalMySqlMode(): boolean {
  return process.env.LOCAL_DB_MODE === "mysql";
}

function createPool(): mysql.Pool {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const user = process.env.MYSQL_USER;
  const database = process.env.MYSQL_DATABASE;
  const password = process.env.MYSQL_PASSWORD;

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Safety violation: Local MySQL host must be 127.0.0.1 or localhost (found '${host}').`
    );
  }

  if (!user || !database || password === undefined) {
    throw new Error(
      "Missing local MySQL configuration. Please ensure MYSQL_USER and MYSQL_PASSWORD are set in .env.local."
    );
  }

  if (database !== "local_billing_db") {
    throw new Error(
      `Safety violation: Local development is strictly restricted to database 'local_billing_db' (found '${database}').`
    );
  }

  return mysql.createPool({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user,
    password,
    database: "local_billing_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  });
}

/**
 * Lazily retrieves the MySQL pool only when in local MySQL mode.
 * Never executes on module load.
 */
export function getMysqlPool(): mysql.Pool {
  if (!isLocalMySqlMode()) {
    throw new Error(
      "Attempted to access local MySQL pool when LOCAL_DB_MODE is not set to 'mysql'."
    );
  }

  if (!globalForMySQL.mysqlPool) {
    globalForMySQL.mysqlPool = createPool();
  }

  return globalForMySQL.mysqlPool;
}

/**
 * Executes a callback within an atomic MySQL transaction with automatic rollback on error.
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
