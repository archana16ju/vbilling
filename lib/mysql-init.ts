import { getMysqlPool, isLocalMySqlMode } from "./mysql";
import { runMySqlMigrations } from "./mysql-migrations";

let initPromise: Promise<void> | null = null;

/**
 * Initializes and verifies the local MySQL connection, verifying
 * that the connected database is strictly 'local_billing_db' and
 * applying any versioned migrations.
 */
export async function ensureLocalMySqlInitialized(): Promise<void> {
  if (!isLocalMySqlMode()) {
    return;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const pool = getMysqlPool();
      const [rows]: any = await pool.query("SELECT DATABASE() AS db");
      const currentDb = rows[0]?.db;

      if (currentDb !== "local_billing_db") {
        throw new Error(
          `Local MySQL Safety Violation: Connected database is '${currentDb}', expected strictly 'local_billing_db'.`
        );
      }

      // Automatically run migrations
      await runMySqlMigrations();
    } catch (err: any) {
      // Clear promise so subsequent calls can retry if server recovers
      initPromise = null;
      console.error("Local MySQL initialization error:", err.message);
      throw new Error(`Local MySQL Failed: ${err.message}. Never falling back to MongoDB.`);
    }
  })();

  return initPromise;
}
