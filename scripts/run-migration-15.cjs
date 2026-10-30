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
    const [cols] = await conn.query('DESCRIBE raw_materials');
    const existing = new Set(cols.map(c => c.Field));

    if (!existing.has('purchase_unit')) {
      await conn.query("ALTER TABLE raw_materials ADD COLUMN purchase_unit VARCHAR(50) DEFAULT NULL AFTER unit");
      console.log('Added purchase_unit to raw_materials');
    }
    if (!existing.has('conversion_factor')) {
      await conn.query("ALTER TABLE raw_materials ADD COLUMN conversion_factor DECIMAL(10,4) DEFAULT 1.0 AFTER purchase_unit");
      console.log('Added conversion_factor to raw_materials');
    }
    if (!existing.has('category')) {
      await conn.query("ALTER TABLE raw_materials ADD COLUMN category VARCHAR(100) DEFAULT NULL AFTER name");
      console.log('Added category to raw_materials');
    }
    if (!existing.has('supplier_name')) {
      await conn.query("ALTER TABLE raw_materials ADD COLUMN supplier_name VARCHAR(255) DEFAULT NULL AFTER cost_per_unit");
      console.log('Added supplier_name to raw_materials');
    }
    if (!existing.has('shelf_life_days')) {
      await conn.query("ALTER TABLE raw_materials ADD COLUMN shelf_life_days INT DEFAULT NULL AFTER supplier_name");
      console.log('Added shelf_life_days to raw_materials');
    }

    // Record migration 15
    const [migRows] = await conn.query("SELECT version FROM _migrations WHERE version = 15");
    if (migRows.length === 0) {
      await conn.query("INSERT INTO _migrations (version, name) VALUES (15, 'add_extended_raw_materials_fields')");
      console.log('[PASS] Recorded migration 15 in _migrations');
    }

    console.log('[SUCCESS] Migration 15 complete!');
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
