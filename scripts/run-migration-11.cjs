// scripts/run-migration-11.cjs
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
    const migrationsMap = [
      { oldId: 'comp_1792411565628', newId: 'COMP-0001' },
      { oldId: 'comp_1792478189028', newId: 'COMP-0002' }
    ];

    const tables = [
      'company_permissions',
      'categories',
      'products',
      'raw_materials',
      'stock_transactions',
      'customers',
      'user_companies',
      'users'
    ];

    await conn.beginTransaction();

    for (const { oldId, newId } of migrationsMap) {
      console.log(`Migrating ${oldId} -> ${newId}...`);

      // Update companies table
      await conn.query("UPDATE companies SET id = ? WHERE id = ?", [newId, oldId]);

      // Update related tables
      for (const t of tables) {
        await conn.query(`UPDATE ${t} SET company_id = ? WHERE company_id = ?`, [newId, oldId]);
      }

      // Update sales table (id and company_id)
      await conn.query(
        "UPDATE sales SET id = CONCAT(?, SUBSTRING(id, LENGTH(?)+1)), company_id = ? WHERE company_id = ?",
        [newId, oldId, newId, oldId]
      );

      // Update cash_register (sale_id, company_id)
      await conn.query(
        "UPDATE cash_register SET sale_id = CONCAT(?, SUBSTRING(sale_id, LENGTH(?)+1)), company_id = ? WHERE company_id = ?",
        [newId, oldId, newId, oldId]
      );

      // Update payments (sale_id, company_id)
      await conn.query(
        "UPDATE payments SET sale_id = CONCAT(?, SUBSTRING(sale_id, LENGTH(?)+1)), company_id = ? WHERE company_id = ?",
        [newId, oldId, newId, oldId]
      );
    }

    // Record migration 11 if _migrations exists
    const [migRows] = await conn.query("SELECT version FROM _migrations WHERE version = 11");
    if (migRows.length === 0) {
      await conn.query("INSERT INTO _migrations (version, name) VALUES (11, '011_format_company_ids_as_comp_0001')");
      console.log("[PASS] Recorded migration 11 in _migrations");
    }

    await conn.commit();
    console.log("[PASS] Successfully migrated company IDs to COMP-0001 and COMP-0002!");

    const [companies] = await conn.query("SELECT id, name, code FROM companies");
    console.log("Current companies:", companies);

    const [sales] = await conn.query("SELECT id, company_id, bill_number FROM sales");
    console.log("Current sales:", sales);
  } catch (err) {
    await conn.rollback();
    console.error("Migration 11 failed, rolled back:", err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
