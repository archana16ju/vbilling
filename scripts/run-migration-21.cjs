require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('Refusing to run migration on non-local database.');
  }

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

    console.log('1. Creating attendance table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS attendance (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        branch_id VARCHAR(64) NULL,
        user_id VARCHAR(64) NOT NULL,
        date DATE NOT NULL,
        clock_in TIMESTAMP NOT NULL,
        clock_out TIMESTAMP NULL,
        working_hours DECIMAL(6,2) DEFAULT 0.00,
        status VARCHAR(20) DEFAULT 'Present',
        notes TEXT NULL,
        corrected_by VARCHAR(64) NULL,
        correction_reason TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_att_company (company_id),
        INDEX idx_att_user (user_id),
        INDEX idx_att_date (date),
        INDEX idx_att_company_user_date (company_id, user_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('2. Creating shifts table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS shifts (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        branch_id VARCHAR(64) NULL,
        terminal_id VARCHAR(64) NULL,
        cashier_id VARCHAR(64) NOT NULL,
        opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL,
        opening_cash DECIMAL(12,2) DEFAULT 0.00,
        expected_closing_cash DECIMAL(12,2) DEFAULT 0.00,
        counted_closing_cash DECIMAL(12,2) DEFAULT 0.00,
        cash_sales DECIMAL(12,2) DEFAULT 0.00,
        cash_refunds DECIMAL(12,2) DEFAULT 0.00,
        cash_paid_in DECIMAL(12,2) DEFAULT 0.00,
        cash_paid_out DECIMAL(12,2) DEFAULT 0.00,
        closing_difference DECIMAL(12,2) DEFAULT 0.00,
        status VARCHAR(30) DEFAULT 'Open',
        closing_notes TEXT NULL,
        closed_by_user_id VARCHAR(64) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shifts_company (company_id),
        INDEX idx_shifts_cashier (cashier_id),
        INDEX idx_shifts_status (company_id, status),
        INDEX idx_shifts_opened (opened_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('3. Checking shift_id columns in sales and cash_register...');
    if (!(await columnExists('sales', 'shift_id'))) {
      await conn.query('ALTER TABLE sales ADD COLUMN shift_id VARCHAR(64) NULL AFTER company_id, ADD INDEX idx_sales_shift (shift_id);');
      console.log('Added shift_id column to sales.');
    }
    if (!(await columnExists('cash_register', 'shift_id'))) {
      await conn.query('ALTER TABLE cash_register ADD COLUMN shift_id VARCHAR(64) NULL AFTER company_id, ADD INDEX idx_cash_reg_shift (shift_id);');
      console.log('Added shift_id column to cash_register.');
    }

    console.log('4. Creating expenses table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        branch_id VARCHAR(64) NULL,
        expense_date DATE NOT NULL,
        category VARCHAR(50) NOT NULL,
        description TEXT NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        payment_method VARCHAR(50) DEFAULT 'Cash',
        payment_reference VARCHAR(100) NULL,
        recorded_by_user_id VARCHAR(64) NOT NULL,
        approved_by_user_id VARCHAR(64) NULL,
        supplier_id VARCHAR(64) NULL,
        attachment_url TEXT NULL,
        status VARCHAR(20) DEFAULT 'Pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_expenses_company (company_id),
        INDEX idx_expenses_category (company_id, category),
        INDEX idx_expenses_date (expense_date),
        INDEX idx_expenses_status (company_id, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    console.log('5. Ensuring audit_logs table and columns...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NULL,
        branch_id VARCHAR(64) NULL,
        user_id VARCHAR(64) NULL,
        terminal_id VARCHAR(64) NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(64) NULL,
        details JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_company (company_id),
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    if (!(await columnExists('audit_logs', 'branch_id'))) {
      await conn.query('ALTER TABLE audit_logs ADD COLUMN branch_id VARCHAR(64) NULL AFTER company_id');
    }
    if (!(await columnExists('audit_logs', 'terminal_id'))) {
      await conn.query('ALTER TABLE audit_logs ADD COLUMN terminal_id VARCHAR(64) NULL AFTER user_id');
    }
    try {
      await conn.query('ALTER TABLE audit_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    } catch (e) {
      console.warn('audit_logs collation notice:', e.message);
    }

    console.log('6. Recording migration 21...');
    await conn.query(`
      INSERT IGNORE INTO _migrations (version, name)
      VALUES (21, '021_create_attendance_shifts_expenses_and_extend_audit_logs');
    `);

    console.log('Migration 21 completed successfully!');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
