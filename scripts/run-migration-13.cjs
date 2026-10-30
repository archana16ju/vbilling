require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function run() {
  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('Safety error: Must only run on local_billing_db');
  }
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Safety error: Host must be local');
  }

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  try {
    const [dbRows] = await conn.query('SELECT DATABASE() AS db');
    console.log('Connected database:', dbRows[0].db);

    // 1. Create table bill_sequences
    console.log('Creating bill_sequences table...');
    await conn.query(`
      CREATE TABLE IF NOT EXISTS bill_sequences (
        company_id VARCHAR(64) NOT NULL,
        date_prefix VARCHAR(10) NOT NULL,
        last_seq INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (company_id, date_prefix)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    // 2. Scan existing sales in local_billing_db to populate initial sequences
    console.log('Populating existing sequences from sales table...');
    const [salesRows] = await conn.query(`
      SELECT COALESCE(company_id, 'COMP-0001') AS company_id, bill_number 
      FROM sales 
      WHERE bill_number IS NOT NULL
    `);

    const highestPerKey = new Map();

    for (const row of salesRows) {
      const compId = row.company_id || 'COMP-0001';
      const parts = (row.bill_number || '').split('-');
      if (parts.length >= 3 && parts[0] === 'BILL') {
        const datePrefix = parts[1];
        const seq = parseInt(parts[2], 10);
        if (!isNaN(seq)) {
          const key = `${compId}_${datePrefix}`;
          const existing = highestPerKey.get(key);
          if (!existing || seq > existing.maxSeq) {
            highestPerKey.set(key, { companyId: compId, datePrefix, maxSeq: seq });
          }
        }
      }
    }

    for (const val of highestPerKey.values()) {
      if (!val.companyId) continue;
      await conn.query(`
        INSERT INTO bill_sequences (company_id, date_prefix, last_seq)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq))
      `, [val.companyId, val.datePrefix, val.maxSeq]);
      console.log(`Initialized sequence for company ${val.companyId}, date ${val.datePrefix} -> ${val.maxSeq}`);
    }

    // 3. Record migration in _migrations table
    await conn.query(`
      INSERT INTO _migrations (version, name) VALUES (13, '013_create_bill_sequences_for_atomic_concurrency')
      ON DUPLICATE KEY UPDATE name = VALUES(name);
    `);

    console.log('Migration 13 successfully applied to local_billing_db!');
  } finally {
    await conn.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
