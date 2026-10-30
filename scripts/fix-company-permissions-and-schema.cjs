// scripts/fix-company-permissions-and-schema.cjs
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
    // 1. Ensure company_name column exists in users table
    const [colRows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_name'`
    );
    if (colRows.length === 0) {
      await conn.query("ALTER TABLE users ADD COLUMN company_name VARCHAR(255) NULL AFTER company_id");
      console.log("[PASS] Added company_name column to users table");
    } else {
      console.log("[PASS] company_name column already exists in users table");
    }

    // 2. Populate company_name for existing users with company_id
    await conn.query(`
      UPDATE users u
      INNER JOIN companies c ON u.company_id = c.id
      SET u.company_name = c.name
      WHERE u.company_name IS NULL OR u.company_name = ''
    `);
    console.log("[PASS] Populated company_name for existing users from companies table");

    // 3. Reset module_inventory and module_raw_materials to 1 (enabled) for all active companies
    await conn.query(`
      UPDATE company_permissions 
      SET module_inventory = 1, module_raw_materials = 1, module_sales = 1, module_bills = 1, module_products = 1, module_categories = 1, module_users = 1, module_settings = 1
    `);
    console.log("[PASS] Enabled all dashboard collection permissions for active companies");

    const [perms] = await conn.query("SELECT * FROM company_permissions");
    console.log("Current company_permissions:", perms);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Script failed:", err);
  process.exit(1);
});
