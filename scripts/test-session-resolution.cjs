// scripts/test-session-resolution.cjs
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  const conn = await pool.getConnection();
  try {
    // 1. Check user company-1 in DB
    const [uRows] = await conn.query("SELECT id, username, role, company_id FROM users WHERE username = 'company-1'");
    console.log("User company-1 in DB:", uRows[0]);

    if (!uRows || uRows.length === 0) {
      throw new Error("company-1 user not found");
    }

    const user = uRows[0];

    // Simulate session having old company ID
    const staleSession = {
      userId: user.id,
      username: user.username,
      role: 'company_admin',
      companyId: 'comp_1792411565628' // old ID in stale cookie
    };

    console.log("Stale session companyId:", staleSession.companyId);

    // Dynamic resolution logic
    const [freshUserRows] = await conn.query(
      'SELECT company_id FROM users WHERE id = ? LIMIT 1',
      [staleSession.userId]
    );

    if (freshUserRows && freshUserRows.length > 0 && freshUserRows[0].company_id) {
      staleSession.companyId = freshUserRows[0].company_id;
    }

    console.log("Resolved session companyId:", staleSession.companyId);

    if (staleSession.companyId === 'COMP-0001') {
      console.log("[PASS] Stale session companyId successfully refreshed to COMP-0001 from database!");
    } else {
      console.error("[FAIL] Resolution failed!");
      process.exit(1);
    }

    // Check authorization test
    const targetComp = 'COMP-0001';
    const [authRows] = await conn.query(
      "SELECT id FROM user_companies WHERE user_id = ? AND company_id = ? UNION SELECT id FROM users WHERE id = ? AND company_id = ?",
      [user.id, targetComp, user.id, targetComp]
    );

    if (authRows.length > 0) {
      console.log("[PASS] User is verified and authorized for COMP-0001 in DB!");
    } else {
      console.error("[FAIL] User not authorized!");
      process.exit(1);
    }

  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
