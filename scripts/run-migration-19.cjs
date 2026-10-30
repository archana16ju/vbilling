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
    // 1. Delivery Persons Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS delivery_persons (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        employee_id VARCHAR(100) NOT NULL,
        phone VARCHAR(50) NOT NULL,
        is_active TINYINT(1) DEFAULT 1,
        availability_status VARCHAR(20) DEFAULT 'available',
        assigned_delivery_count INT DEFAULT 0,
        max_active_deliveries INT DEFAULT 3,
        last_assigned_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_dp_company (company_id),
        INDEX idx_dp_availability (company_id, is_active, availability_status),
        UNIQUE KEY uq_dp_company_emp (company_id, employee_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Deliveries Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS deliveries (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        bill_id VARCHAR(64) NOT NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_phone VARCHAR(50) NOT NULL,
        delivery_address TEXT NOT NULL,
        delivery_person_id VARCHAR(64) NULL,
        delivery_status VARCHAR(50) DEFAULT 'pending',
        assignment_status VARCHAR(50) DEFAULT 'unassigned',
        order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        assigned_at TIMESTAMP NULL,
        picked_up_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        delivery_notes TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_deliveries_company (company_id),
        INDEX idx_deliveries_bill (company_id, bill_id),
        INDEX idx_deliveries_person (delivery_person_id),
        INDEX idx_deliveries_status (company_id, delivery_status),
        INDEX idx_deliveries_assignment (company_id, assignment_status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Record migration 19
    const [migRows] = await conn.query("SELECT version FROM _migrations WHERE version = 19");
    if (migRows.length === 0) {
      await conn.query("INSERT INTO _migrations (version, name) VALUES (19, '019_create_delivery_persons_and_deliveries')");
      console.log('[PASS] Recorded migration 19 in _migrations');
    }

    console.log('[SUCCESS] Migration 19 complete!');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
