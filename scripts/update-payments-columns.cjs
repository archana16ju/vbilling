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

  const [cols] = await conn.query('DESCRIBE payments');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('status')) {
    await conn.query("ALTER TABLE payments ADD COLUMN status VARCHAR(50) DEFAULT 'paid' AFTER amount");
    console.log('Added status column to payments');
  }

  if (!colNames.includes('reference_number')) {
    await conn.query('ALTER TABLE payments ADD COLUMN reference_number VARCHAR(255) NULL AFTER status');
    console.log('Added reference_number column to payments');
  }

  await conn.query(
    "INSERT IGNORE INTO _migrations (version, name) VALUES (9, '009_add_status_and_reference_to_payments')"
  );

  console.log('Successfully recorded migration 9 in local_billing_db');
  await conn.end();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
