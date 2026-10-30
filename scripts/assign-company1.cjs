// scripts/assign-company1.cjs
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  await pool.query("UPDATE users SET company_id = 'comp_1792411565628' WHERE id = 'u1792413342180'");
  await pool.query("INSERT IGNORE INTO user_companies (id, user_id, company_id, role) VALUES ('uc_u1792413342180', 'u1792413342180', 'comp_1792411565628', 'company_admin')");
  console.log("Successfully linked company-1 user to company-1!");
  await pool.end();
}

main().catch(console.error);
