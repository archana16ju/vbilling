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

  try {
    const [rows] = await pool.query('SELECT version, name, applied_at FROM _migrations ORDER BY version DESC LIMIT 5');
    console.log('Current migrations in local_billing_db:');
    console.table(rows);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('Error checking migrations:', err);
  process.exit(1);
});
