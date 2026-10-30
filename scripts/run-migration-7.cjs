// scripts/run-migration-7.cjs
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  const conn = await pool.getConnection();
  try {
    async function columnExists(table, column) {
      const [rows] = await conn.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows.length > 0;
    }

    if (!(await columnExists("company_permissions", "module_raw_materials"))) {
      await conn.query("ALTER TABLE company_permissions ADD COLUMN module_raw_materials TINYINT(1) DEFAULT 1 AFTER module_inventory");
      await conn.query("UPDATE company_permissions SET module_raw_materials = module_inventory");
      console.log("[PASS] Added module_raw_materials to company_permissions");
    } else {
      console.log("[PASS] module_raw_materials already exists");
    }

    if (!(await columnExists("company_permissions", "custom_modules"))) {
      await conn.query("ALTER TABLE company_permissions ADD COLUMN custom_modules JSON NULL AFTER module_settings");
      console.log("[PASS] Added custom_modules JSON to company_permissions");
    } else {
      console.log("[PASS] custom_modules already exists");
    }

    // Record migration 7 if _migrations exists
    const [migRows] = await conn.query("SELECT version FROM _migrations WHERE version = 7");
    if (migRows.length === 0) {
      await conn.query("INSERT INTO _migrations (version, name) VALUES (7, '007_add_raw_materials_and_custom_modules_permissions')");
      console.log("[PASS] Recorded migration 7 in _migrations");
    }

    const [cols] = await conn.query("DESCRIBE company_permissions");
    console.log("Current company_permissions columns:", cols.map(c => c.Field));
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Migration 7 failed:", err);
  process.exit(1);
});
