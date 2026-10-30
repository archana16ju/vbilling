// scripts/run-migration-10.cjs
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
    async function indexExists(table, indexName) {
      const [rows] = await conn.query(
        `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, indexName]
      );
      return rows.length > 0;
    }

    // 1. Drop global uq_sales_bill_number so companies have independent numbering
    if (await indexExists("sales", "uq_sales_bill_number")) {
      await conn.query("ALTER TABLE sales DROP INDEX uq_sales_bill_number");
      console.log("[PASS] Dropped global unique index uq_sales_bill_number from sales");
    } else {
      console.log("[INFO] Global index uq_sales_bill_number does not exist");
    }

    // 2. Add company-scoped unique constraint uq_company_bill (company_id, bill_number)
    if (!(await indexExists("sales", "uq_company_bill"))) {
      await conn.query("ALTER TABLE sales ADD UNIQUE KEY uq_company_bill (company_id, bill_number)");
      console.log("[PASS] Added company-scoped unique constraint uq_company_bill (company_id, bill_number)");
    } else {
      console.log("[INFO] uq_company_bill index already exists");
    }

    // 3. Fix existing sales to start from BILL-201026-001 for each company
    // Company 1: update BILL-201026-002 -> BILL-201026-001
    await conn.query(
      "UPDATE sales SET id = 'comp_1792411565628_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792411565628' AND bill_number = 'BILL-201026-002'"
    );
    await conn.query(
      "UPDATE cash_register SET sale_id = 'comp_1792411565628_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792411565628' AND bill_number = 'BILL-201026-002'"
    );
    await conn.query(
      "UPDATE payments SET sale_id = 'comp_1792411565628_BILL-201026-001', reference_number = 'BILL-201026-001' WHERE company_id = 'comp_1792411565628' AND (sale_id = 'BILL-201026-002' OR reference_number = 'BILL-201026-002')"
    );
    console.log("[PASS] Adjusted Company 1 sale to BILL-201026-001");

    // Company 2: update BILL-201026-003 -> BILL-201026-001
    await conn.query(
      "UPDATE sales SET id = 'comp_1792478189028_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792478189028' AND bill_number = 'BILL-201026-003'"
    );
    await conn.query(
      "UPDATE cash_register SET sale_id = 'comp_1792478189028_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792478189028' AND bill_number = 'BILL-201026-003'"
    );
    await conn.query(
      "UPDATE payments SET sale_id = 'comp_1792478189028_BILL-201026-001', reference_number = 'BILL-201026-001' WHERE company_id = 'comp_1792478189028' AND (sale_id = 'BILL-201026-003' OR reference_number = 'BILL-201026-003')"
    );
    console.log("[PASS] Adjusted Company 2 sale to BILL-201026-001");

    // Record migration 10 if _migrations exists
    const [migRows] = await conn.query("SELECT version FROM _migrations WHERE version = 10");
    if (migRows.length === 0) {
      await conn.query("INSERT INTO _migrations (version, name) VALUES (10, '010_company_scoped_bill_numbers')");
      console.log("[PASS] Recorded migration 10 in _migrations");
    }

    const [sales] = await conn.query("SELECT id, company_id, bill_number, total FROM sales");
    console.log("Current sales:", sales);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error("Migration 10 failed:", err);
  process.exit(1);
});
