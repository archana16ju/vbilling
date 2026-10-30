// scripts/run-migration-22.cjs
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function runMigration22() {
  console.log('Running Migration 22: Staff Collection and Salaries Setup...');
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '2006',
    database: 'local_billing_db'
  });

  const conn = await pool.getConnection();

  try {
    // 1. Staff table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS staff (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        branch_id VARCHAR(64) NULL,
        user_id VARCHAR(64) NULL,
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) NULL,
        role VARCHAR(100) DEFAULT 'Cashier',
        phone VARCHAR(50) NULL,
        pay_type VARCHAR(50) DEFAULT 'Monthly',
        base_amount DECIMAL(12,2) DEFAULT 0.00,
        allowances JSON NULL,
        deductions JSON NULL,
        include_in_payroll TINYINT(1) DEFAULT 1,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_staff_company (company_id),
        INDEX idx_staff_user (user_id),
        INDEX idx_staff_active (company_id, is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('[PASS] Staff table created/verified.');

    // 2. Attendance enhancements
    const [attCols] = await conn.query("SHOW COLUMNS FROM attendance LIKE 'staff_id'");
    if (attCols.length === 0) {
      await conn.query("ALTER TABLE attendance ADD COLUMN staff_id VARCHAR(64) NULL AFTER user_id, ADD INDEX idx_attendance_staff (staff_id)");
      console.log('[PASS] Added staff_id column to attendance.');
    }

    const [markCols] = await conn.query("SHOW COLUMNS FROM attendance LIKE 'mark_code'");
    if (markCols.length === 0) {
      await conn.query("ALTER TABLE attendance ADD COLUMN mark_code VARCHAR(10) NULL AFTER status");
      console.log('[PASS] Added mark_code column to attendance.');
    }

    await conn.query("ALTER TABLE attendance MODIFY COLUMN clock_in DATETIME NULL");
    console.log('[PASS] Attendance clock_in column made nullable.');

    // Record migration 22 in _migrations
    await conn.query(`
      INSERT INTO _migrations (version, name, applied_at)
      VALUES (22, '022_create_staff_collection_and_salaries', NOW())
      ON DUPLICATE KEY UPDATE name = '022_create_staff_collection_and_salaries'
    `);

    // 3. Seed default staff for COMP-0001 (XYZ Hotal) if not already present
    const [existingStaff] = await conn.query("SELECT id, name FROM staff WHERE company_id = 'COMP-0001'");
    if (existingStaff.length === 0) {
      console.log('Seeding initial staff members from reference image for COMP-0001...');
      const sampleStaff = [
        {
          id: 'staff_anand_01',
          company_id: 'COMP-0001',
          user_id: 'u_cashier_1792496898046',
          username: 'cashier',
          name: 'Anand Subramanian',
          role: 'Cashier',
          pay_type: 'Monthly',
          base_amount: 25000.00,
        },
        {
          id: 'staff_ganesh_02',
          company_id: 'COMP-0001',
          user_id: null,
          username: null,
          name: 'Ganesh B',
          role: 'Staff',
          pay_type: 'Monthly',
          base_amount: 18000.00,
        },
        {
          id: 'staff_priya_03',
          company_id: 'COMP-0001',
          user_id: null,
          username: null,
          name: 'Priya Venkatesh',
          role: 'Staff',
          pay_type: 'Monthly',
          base_amount: 20000.00,
        },
        {
          id: 'staff_ravi_04',
          company_id: 'COMP-0001',
          user_id: null,
          username: null,
          name: 'Ravi Kumar',
          role: 'Staff',
          pay_type: 'Monthly',
          base_amount: 16000.00,
        },
        {
          id: 'staff_suresh_05',
          company_id: 'COMP-0001',
          user_id: null,
          username: null,
          name: 'Suresh M',
          role: 'Staff',
          pay_type: 'Monthly',
          base_amount: 15000.00,
        },
      ];

      for (const s of sampleStaff) {
        await conn.query(
          `INSERT INTO staff (id, company_id, user_id, username, name, role, pay_type, base_amount, is_active, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
          [s.id, s.company_id, s.user_id, s.username, s.name, s.role, s.pay_type, s.base_amount]
        );
      }
      console.log('[PASS] Seeded 5 staff members for COMP-0001.');
    } else {
      console.log(`[PASS] Found ${existingStaff.length} existing staff members for COMP-0001.`);
    }

    console.log('Migration 22 completed successfully!');
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration22().catch(err => {
  console.error('Migration 22 failed:', err);
  process.exit(1);
});
