const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: 'local_billing_db'
  });

  await conn.query(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id VARCHAR(64) PRIMARY KEY,
      company_id VARCHAR(64) NOT NULL,
      raw_material_id VARCHAR(64) NOT NULL,
      type VARCHAR(50) NOT NULL,
      quantity_before DECIMAL(12, 3) DEFAULT 0,
      quantity_changed DECIMAL(12, 3) NOT NULL,
      quantity_after DECIMAL(12, 3) DEFAULT 0,
      date BIGINT NOT NULL,
      reason VARCHAR(255),
      reference_id VARCHAR(64),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_stock_tx_company (company_id),
      INDEX idx_stock_tx_raw_mat (raw_material_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    CREATE TABLE IF NOT EXISTS payments (
      id VARCHAR(64) PRIMARY KEY,
      company_id VARCHAR(64) NOT NULL,
      sale_id VARCHAR(64) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_method VARCHAR(50) NOT NULL,
      reference VARCHAR(255),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_payments_company (company_id),
      INDEX idx_payments_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await conn.query(`
    INSERT IGNORE INTO _migrations (version, name) 
    VALUES (8, '008_ensure_stock_transactions_and_payments_tables');
  `);

  console.log('Migration 8 recorded and verified in local_billing_db');
  await conn.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
