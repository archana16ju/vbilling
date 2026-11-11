const fs = require('fs');
const mysql = require('mysql2/promise');

const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach((l) => {
  const p = l.indexOf('=');
  if (p > 0) process.env[l.slice(0, p).trim()] = l.slice(p + 1).trim();
});

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  async function columnExists(table, column) {
    const [rows] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [table, column]
    );
    return rows.length > 0;
  }

  if (!(await columnExists('products', 'min_stock'))) {
    await conn.query('ALTER TABLE products ADD COLUMN min_stock DECIMAL(10,3) DEFAULT 5.000 AFTER discount');
    console.log('Added products.min_stock');
  }

  if (!(await columnExists('raw_materials', 'status'))) {
    await conn.query("ALTER TABLE raw_materials ADD COLUMN status VARCHAR(50) DEFAULT 'In Stock' AFTER linked_products_json");
    console.log('Added raw_materials.status');
  }

  if (!(await columnExists('raw_materials', 'last_replenished_at'))) {
    await conn.query('ALTER TABLE raw_materials ADD COLUMN last_replenished_at TIMESTAMP NULL AFTER status');
    console.log('Added raw_materials.last_replenished_at');
  }

  if (!(await columnExists('stock_transactions', 'raw_material_name'))) {
    await conn.query('ALTER TABLE stock_transactions ADD COLUMN raw_material_name VARCHAR(255) NULL AFTER raw_material_id');
    console.log('Added stock_transactions.raw_material_name');
  }

  await conn.query("INSERT IGNORE INTO _migrations (version, name) VALUES (38, '038_add_min_stock_and_replenishment_fields')");
  console.log('Migration 38 applied and recorded successfully!');

  await conn.end();
}

main().catch(console.error);
