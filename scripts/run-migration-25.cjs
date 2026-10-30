require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function runMigration25() {
  console.log('========================================================');
  console.log('Running Migration 25: Waiter Role & Dine-In Table Orders');
  console.log('========================================================');

  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('SAFETY CHECK FAILED: Refusing to run on non-local database.');
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db',
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

    async function indexExists(table, indexName) {
      const [rows] = await conn.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
         WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
      );
      return rows.length > 0;
    }

    // 1. Create dine_in_orders table
    console.log('1. Creating dine_in_orders table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS dine_in_orders (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        order_number VARCHAR(100) NOT NULL,
        kot_id VARCHAR(64) NULL,
        table_id VARCHAR(64) NULL,
        table_name VARCHAR(100) NOT NULL,
        waiter_id VARCHAR(64) NULL,
        waiter_name VARCHAR(255) NULL,
        guest_count INT DEFAULT 1,
        items JSON NOT NULL,
        total_amount DECIMAL(12,2) DEFAULT 0.00,
        kitchen_status VARCHAR(50) DEFAULT 'PREPARING',
        serving_status VARCHAR(50) DEFAULT 'Pending',
        notes TEXT NULL,
        bill_id VARCHAR(100) NULL,
        created_by VARCHAR(100) DEFAULT 'Cashier',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dine_in_company (company_id),
        INDEX idx_dine_in_waiter (company_id, waiter_id),
        INDEX idx_dine_in_table (company_id, table_id),
        INDEX idx_dine_in_kitchen_status (kitchen_status),
        INDEX idx_dine_in_serving_status (serving_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('[PASS] dine_in_orders table ready.');

    // 2. Add waiter and table columns to sales table
    console.log('2. Enhancing sales table with waiter and table fields...');
    if (!(await columnExists('sales', 'table_id'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN table_id VARCHAR(64) NULL AFTER customer_phone");
      console.log('Added table_id to sales');
    }
    if (!(await columnExists('sales', 'table_name'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN table_name VARCHAR(100) NULL AFTER table_id");
      console.log('Added table_name to sales');
    }
    if (!(await columnExists('sales', 'waiter_id'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN waiter_id VARCHAR(64) NULL AFTER table_name");
      console.log('Added waiter_id to sales');
    }
    if (!(await columnExists('sales', 'waiter_name'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN waiter_name VARCHAR(255) NULL AFTER waiter_id");
      console.log('Added waiter_name to sales');
    }
    if (!(await columnExists('sales', 'serving_status'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN serving_status VARCHAR(50) DEFAULT 'Served' AFTER waiter_name");
      console.log('Added serving_status to sales');
    }

    if (!(await indexExists('sales', 'idx_sales_waiter'))) {
      await conn.query('ALTER TABLE sales ADD INDEX idx_sales_waiter (company_id, waiter_id)');
      console.log('Added idx_sales_waiter index');
    }
    if (!(await indexExists('sales', 'idx_sales_table'))) {
      await conn.query('ALTER TABLE sales ADD INDEX idx_sales_table (company_id, table_id)');
      console.log('Added idx_sales_table index');
    }

    // 3. Seed sample Waiters in staff and users table for COMP-0001
    console.log('3. Seeding sample Waiters in Staff and Users collections...');
    const [compRows] = await conn.query("SELECT id, name FROM companies WHERE id = 'COMP-0001'");
    if (compRows.length > 0) {
      const compId = compRows[0].id;
      const compName = compRows[0].name;

      // Seed Waiter 1: Ramesh
      const [existingWaiter1] = await conn.query(
        "SELECT id FROM staff WHERE company_id = ? AND (username = 'waiter' OR name LIKE 'Ramesh%')",
        [compId]
      );
      if (existingWaiter1.length === 0) {
        const staffId1 = 'st_waiter_01';
        const userId1 = 'u_waiter_01';
        // Add to users
        await conn.query(`
          INSERT INTO users (id, name, username, email, password, role, company_id, company_name, is_active)
          VALUES (?, 'Ramesh Kumar', 'waiter', 'waiter@local.test', 'waiter123', 'waiter', ?, ?, 1)
          ON DUPLICATE KEY UPDATE role = 'waiter'
        `, [userId1, compId, compName]);

        // Add to user_companies
        await conn.query(`
          INSERT IGNORE INTO user_companies (id, user_id, company_id, role)
          VALUES ('uc_waiter_01', ?, ?, 'waiter')
        `, [userId1, compId]);

        // Add to staff
        await conn.query(`
          INSERT INTO staff (id, company_id, branch_id, user_id, name, username, role, phone, pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at)
          VALUES (?, ?, NULL, ?, 'Ramesh Kumar', 'waiter', 'Waiter', '9876543210', 'Monthly', 14000.00, '[]', '[]', 1, 1, NOW())
        `, [staffId1, compId, userId1]);

        console.log('[PASS] Created sample waiter "Ramesh Kumar" (username: waiter, password: waiter123)');
      }

      // Seed Waiter 2: Suresh
      const [existingWaiter2] = await conn.query(
        "SELECT id FROM staff WHERE company_id = ? AND (username = 'waiter2' OR name LIKE 'Suresh%')",
        [compId]
      );
      if (existingWaiter2.length === 0) {
        const staffId2 = 'st_waiter_02';
        const userId2 = 'u_waiter_02';
        // Add to users
        await conn.query(`
          INSERT INTO users (id, name, username, email, password, role, company_id, company_name, is_active)
          VALUES (?, 'Suresh Verma', 'waiter2', 'waiter2@local.test', 'waiter123', 'waiter', ?, ?, 1)
          ON DUPLICATE KEY UPDATE role = 'waiter'
        `, [userId2, compId, compName]);

        // Add to user_companies
        await conn.query(`
          INSERT IGNORE INTO user_companies (id, user_id, company_id, role)
          VALUES ('uc_waiter_02', ?, ?, 'waiter')
        `, [userId2, compId]);

        // Add to staff
        await conn.query(`
          INSERT INTO staff (id, company_id, branch_id, user_id, name, username, role, phone, pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at)
          VALUES (?, ?, NULL, ?, 'Suresh Verma', 'waiter2', 'Waiter', '9876543212', 'Monthly', 14500.00, '[]', '[]', 1, 1, NOW())
        `, [staffId2, compId, userId2]);

        console.log('[PASS] Created sample waiter "Suresh Verma" (username: waiter2, password: waiter123)');
      }
    }

    // 4. Record migration in _migrations
    console.log('4. Recording migration 25 in _migrations...');
    await conn.query(`
      INSERT INTO _migrations (version, name)
      VALUES (25, '025_add_waiter_role_and_dine_in_orders')
      ON DUPLICATE KEY UPDATE name = VALUES(name)
    `);

    console.log('========================================================');
    console.log('Migration 25 completed successfully!');
    console.log('========================================================');
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration25().catch((err) => {
  console.error('Migration 25 failed:', err);
  process.exit(1);
});
