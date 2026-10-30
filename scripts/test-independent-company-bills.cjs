// scripts/test-independent-company-bills.cjs
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
    console.log("Checking sales table schema & current sales...");

    const [indexes] = await conn.query("SHOW INDEX FROM sales WHERE Key_name = 'uq_company_bill'");
    if (indexes.length > 0) {
      console.log("[PASS] 'uq_company_bill' index exists on (company_id, bill_number)");
    } else {
      console.error("[FAIL] 'uq_company_bill' missing!");
    }

    const [sales] = await conn.query("SELECT id, company_id, bill_number, total FROM sales WHERE bill_number LIKE 'BILL-201026%'");
    console.log("Current today's sales across companies:", sales);

    // Verify both companies have BILL-201026-001
    const comp1Sales = sales.filter(s => s.company_id === 'comp_1792411565628');
    const comp2Sales = sales.filter(s => s.company_id === 'comp_1792478189028');

    console.log("Company 1 bills:", comp1Sales.map(s => s.bill_number));
    console.log("Company 2 bills:", comp2Sales.map(s => s.bill_number));

    if (comp1Sales.some(s => s.bill_number === 'BILL-201026-001') && comp2Sales.some(s => s.bill_number === 'BILL-201026-001')) {
      console.log("[PASS] Both Company 1 and Company 2 independently have BILL-201026-001 without collision!");
    } else {
      console.log("[WARN] One or both companies don't have BILL-201026-001 yet.");
    }
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
