// scripts/check-company-tables.cjs
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  try {
    const tables = [
      'companies',
      'company_permissions',
      'categories',
      'products',
      'raw_materials',
      'sales',
      'cash_register',
      'payments',
      'stock_transactions',
      'customers',
      'user_companies',
      'users'
    ];

    for (const t of tables) {
      const col = t === 'companies' ? 'id' : 'company_id';
      const [rows] = await conn.query(
        `SELECT COUNT(*) as count FROM ${t} WHERE ${col} IN ('comp_1792411565628', 'comp_1792478189028')`
      );
      console.log(`${t}: ${rows[0].count} rows`);
    }

    const [salesRows] = await conn.query(
      "SELECT id, company_id, bill_number FROM sales WHERE id LIKE 'comp_%'"
    );
    console.log("Sales with comp_ prefix in ID:", salesRows);
  } finally {
    await conn.end();
  }
}

main().catch(console.error);
