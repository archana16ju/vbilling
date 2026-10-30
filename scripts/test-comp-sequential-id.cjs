// scripts/test-comp-sequential-id.cjs
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
    const [companies] = await conn.query("SELECT id, name, code, is_active FROM companies ORDER BY id ASC");
    console.log("Existing Companies:", companies);

    const [perms] = await conn.query("SELECT company_id FROM company_permissions");
    console.log("Company permissions company_ids:", perms.map(p => p.company_id));

    const [users] = await conn.query("SELECT username, company_id FROM users WHERE company_id IS NOT NULL");
    console.log("Users company_ids:", users);

    const [sales] = await conn.query("SELECT id, company_id, bill_number FROM sales WHERE company_id IS NOT NULL");
    console.log("Sales records:", sales);

    // Test next sequential company ID calculation
    let maxSeq = 0;
    for (const c of companies) {
      const match = (c.id || "").match(/^COMP-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }
    const nextSeq = maxSeq + 1;
    const nextId = `COMP-${String(nextSeq).padStart(4, "0")}`;
    console.log(`[PASS] Next generated company ID will be: ${nextId}`);

    if (companies.some(c => c.id === 'COMP-0001') && companies.some(c => c.id === 'COMP-0002') && nextId === 'COMP-0003') {
      console.log("[PASS] Company IDs correctly formatted and sequential (COMP-0001, COMP-0002 -> COMP-0003)!");
    } else {
      console.error("[FAIL] Unexpected company ID values!");
      process.exit(1);
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
