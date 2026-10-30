require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function runMigration24() {
  console.log('========================================================');
  console.log('Running Migration 24: Delivery, Online Orders & Tracking');
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

    // 1. Alter deliveries table for order source, tracking, status history, and GPS
    console.log('1. Checking and enhancing deliveries table...');
    if (!(await columnExists('deliveries', 'order_source'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN order_source VARCHAR(50) DEFAULT 'Terminal' AFTER bill_id");
      console.log('Added order_source to deliveries');
    }
    if (!(await columnExists('deliveries', 'online_order_id'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN online_order_id VARCHAR(100) NULL AFTER order_source");
      console.log('Added online_order_id to deliveries');
    }
    if (!(await columnExists('deliveries', 'tracking_token'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN tracking_token VARCHAR(64) NULL AFTER online_order_id");
      console.log('Added tracking_token to deliveries');
    }
    if (!(await columnExists('deliveries', 'status_history'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN status_history JSON NULL AFTER delivery_notes");
      console.log('Added status_history to deliveries');
    }
    if (!(await columnExists('deliveries', 'latitude'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN latitude DECIMAL(10, 7) NULL AFTER status_history");
      console.log('Added latitude to deliveries');
    }
    if (!(await columnExists('deliveries', 'longitude'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN longitude DECIMAL(10, 7) NULL AFTER latitude");
      console.log('Added longitude to deliveries');
    }
    if (!(await columnExists('deliveries', 'location_updated_at'))) {
      await conn.query("ALTER TABLE deliveries ADD COLUMN location_updated_at TIMESTAMP NULL AFTER longitude");
      console.log('Added location_updated_at to deliveries');
    }

    // Indexes on deliveries
    if (!(await indexExists('deliveries', 'idx_deliveries_source'))) {
      await conn.query('ALTER TABLE deliveries ADD INDEX idx_deliveries_source (company_id, order_source)');
    }
    if (!(await indexExists('deliveries', 'idx_deliveries_online_id'))) {
      await conn.query('ALTER TABLE deliveries ADD INDEX idx_deliveries_online_id (company_id, online_order_id)');
    }
    if (!(await indexExists('deliveries', 'idx_deliveries_token'))) {
      await conn.query('ALTER TABLE deliveries ADD INDEX idx_deliveries_token (tracking_token)');
    }
    if (!(await indexExists('deliveries', 'uq_deliveries_company_bill'))) {
      try {
        await conn.query('ALTER TABLE deliveries ADD UNIQUE KEY uq_deliveries_company_bill (company_id, bill_id)');
      } catch (e) {
        console.warn('Notice on uq_deliveries_company_bill:', e.message);
      }
    }

    // Populate tracking_token for existing delivery rows if null
    const [delRows] = await conn.query("SELECT id FROM deliveries WHERE tracking_token IS NULL OR tracking_token = ''");
    for (const d of delRows) {
      const token = 'trk_' + Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
      await conn.query('UPDATE deliveries SET tracking_token = ? WHERE id = ?', [token, d.id]);
    }

    // 2. Alter sales table for order_source and online_order_id
    console.log('2. Checking and enhancing sales table...');
    if (!(await columnExists('sales', 'order_source'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN order_source VARCHAR(50) DEFAULT 'Terminal' AFTER order_type");
      console.log('Added order_source to sales');
    }
    if (!(await columnExists('sales', 'online_order_id'))) {
      await conn.query("ALTER TABLE sales ADD COLUMN online_order_id VARCHAR(100) NULL AFTER order_source");
      console.log('Added online_order_id to sales');
    }
    if (!(await indexExists('sales', 'idx_sales_source'))) {
      await conn.query('ALTER TABLE sales ADD INDEX idx_sales_source (company_id, order_source)');
    }
    if (!(await indexExists('sales', 'idx_sales_online_order_id'))) {
      await conn.query('ALTER TABLE sales ADD INDEX idx_sales_online_order_id (company_id, online_order_id)');
    }

    // 3. Create online_order_configs table
    console.log('3. Checking and creating online_order_configs table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS online_order_configs (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        platform VARCHAR(50) NOT NULL,
        display_name VARCHAR(100) NOT NULL,
        is_enabled TINYINT(1) DEFAULT 0,
        api_key VARCHAR(255) NULL,
        api_secret VARCHAR(255) NULL,
        store_id VARCHAR(100) NULL,
        webhook_secret VARCHAR(255) NULL,
        auto_accept TINYINT(1) DEFAULT 1,
        connection_status VARCHAR(50) DEFAULT 'disconnected',
        last_sync_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_platform_company (company_id, platform),
        INDEX idx_ooc_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
    console.log('online_order_configs table ready.');

    // 4. Record migration in _migrations
    await conn.query(`
      INSERT INTO _migrations (version, name, applied_at)
      VALUES (24, '024_delivery_online_orders_and_tracking', NOW())
      ON DUPLICATE KEY UPDATE applied_at = NOW();
    `);

    console.log('Migration 24 applied successfully!');
  } finally {
    conn.release();
    await pool.end();
  }
}

runMigration24().catch((err) => {
  console.error('Migration 24 failed:', err);
  process.exit(1);
});
