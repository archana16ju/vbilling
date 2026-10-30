// scripts/test-company-admin-password-reset.cjs
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
    const [users] = await conn.query("SELECT id, name, username, role, company_id FROM users WHERE role = 'company_admin'");
    console.log("Existing company admin users:", users);

    if (users.length > 0) {
      const admin = users[0];
      console.log(`[PASS] Found Company Admin user: ${admin.username} (ID: ${admin.id})`);
    } else {
      console.log("[INFO] No company admin users found currently.");
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
