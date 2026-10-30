// scripts/run-migration-12.cjs
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
    const [dbRows] = await conn.query("SELECT DATABASE() AS current_db");
    if (dbRows[0].current_db !== 'local_billing_db') {
      throw new Error("Safety check failed: not in local_billing_db");
    }

    // Check if migration 12 already applied
    const [migRows] = await conn.query("SELECT version FROM _migrations WHERE version = 12");
    if (migRows.length > 0) {
      console.log("Migration 12 already applied.");
      return;
    }

    await conn.beginTransaction();

    console.log("Applying Migration 12: audit_logs, company_settings, bill_items, stores...");

    // 1. Audit logs table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NULL,
        user_id VARCHAR(64) NULL,
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(64) NULL,
        details JSON NULL,
        ip_address VARCHAR(45) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_company (company_id),
        INDEX idx_audit_user (user_id),
        INDEX idx_audit_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 2. Company settings table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS company_settings (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL UNIQUE,
        tax_rate DECIMAL(5,2) DEFAULT 5.00,
        tax_inclusive TINYINT(1) DEFAULT 1,
        invoice_prefix VARCHAR(20) DEFAULT 'BILL',
        receipt_header TEXT NULL,
        receipt_footer TEXT NULL,
        printer_width VARCHAR(10) DEFAULT '80mm',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_settings_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 3. Bill items table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bill_items (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        sale_id VARCHAR(64) NOT NULL,
        product_id VARCHAR(64) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity DECIMAL(10,3) NOT NULL,
        unit_price DECIMAL(10,2) NOT NULL,
        tax_rate DECIMAL(5,2) DEFAULT 0,
        total DECIMAL(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bill_items_company (company_id),
        INDEX idx_bill_items_sale (sale_id),
        INDEX idx_bill_items_product (product_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 4. Stores / Branches table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL,
        address TEXT NULL,
        phone VARCHAR(50) NULL,
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_stores_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // Seed default settings for all existing companies
    const [companies] = await conn.query("SELECT id FROM companies");
    for (const comp of companies) {
      await conn.query(`
        INSERT IGNORE INTO company_settings (id, company_id, tax_rate, tax_inclusive, invoice_prefix, receipt_header, receipt_footer)
        VALUES (?, ?, 5.00, 1, 'BILL', 'Thank you for your visit!', 'Please visit again!')
      `, [`cs_${comp.id}`, comp.id]);
    }

    // Record migration 12
    await conn.query("INSERT INTO _migrations (version, name) VALUES (12, '012_add_audit_settings_and_stores_tables')");

    await conn.commit();
    console.log("Migration 12 applied successfully!");
  } catch (err) {
    await conn.rollback();
    console.error("Migration 12 failed:", err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
