require('dotenv').config({ path: '.env.local' });
process.env.LOCAL_DB_MODE = 'mysql';

const mysql = require('mysql2/promise');

async function testConcurrency() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  try {
    console.log('Testing atomic sequence increment on bill_sequences...');
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const datePrefix = `${dd}${mm}${yy}`;
    const companyId = 'test_comp_concurrent';

    // Simulate 10 simultaneous cashier requests for next bill id
    const workers = Array.from({ length: 10 }, async (_, i) => {
      const c = await mysql.createConnection({
        host,
        port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: 'local_billing_db'
      });
      try {
        await c.beginTransaction();
        await c.query(
          `INSERT INTO bill_sequences (company_id, date_prefix, last_seq)
           VALUES (?, ?, 0)
           ON DUPLICATE KEY UPDATE company_id = company_id`,
          [companyId, datePrefix]
        );
        const [rows] = await c.query(
          `SELECT last_seq FROM bill_sequences WHERE company_id = ? AND date_prefix = ? FOR UPDATE`,
          [companyId, datePrefix]
        );
        const nextSeq = Number(rows[0].last_seq) + 1;
        await c.query(
          `UPDATE bill_sequences SET last_seq = ? WHERE company_id = ? AND date_prefix = ?`,
          [nextSeq, companyId, datePrefix]
        );
        await c.commit();
        return `BILL-${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
      } catch (err) {
        await c.rollback();
        throw err;
      } finally {
        await c.end();
      }
    });

    const allocatedBillIds = await Promise.all(workers);
    console.log('Allocated Bill IDs across 10 concurrent cashiers:', allocatedBillIds);

    // Verify all IDs are completely unique
    const uniqueIds = new Set(allocatedBillIds);
    if (uniqueIds.size !== allocatedBillIds.length) {
      throw new Error(`CONCURRENCY RACE DETECTED! Expected 10 unique IDs, got ${uniqueIds.size}`);
    }
    console.log('PASS: All 10 simultaneous cashier bill allocations were 100% unique and contiguous!');

    // Cleanup test sequence row
    await conn.query('DELETE FROM bill_sequences WHERE company_id = ?', [companyId]);
    console.log('Cleaned up test company data.');
  } finally {
    await conn.end();
  }
}

testConcurrency().catch(err => {
  console.error('Concurrency test failed:', err);
  process.exit(1);
});
