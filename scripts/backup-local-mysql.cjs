require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function backup() {
  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('Refusing to backup non-local database: ' + process.env.MYSQL_DATABASE);
  }
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error('Host is not local: ' + host);
  }

  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  try {
    const [tables] = await conn.query('SHOW TABLES');
    const tableKey = Object.keys(tables[0])[0];
    const backupData = {
      timestamp: new Date().toISOString(),
      database: 'local_billing_db',
      tables: {}
    };

    for (const t of tables) {
      const tableName = t[tableKey];
      const [rows] = await conn.query(`SELECT * FROM \`${tableName}\``);
      backupData.tables[tableName] = rows;
      console.log(`Backed up table ${tableName}: ${rows.length} rows`);
    }

    const backupDir = path.join(__dirname, '..', 'data', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const backupFile = path.join(backupDir, `local_billing_db_${Date.now()}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`Backup completed successfully to ${backupFile}`);
  } finally {
    await conn.end();
  }
}

backup().catch(err => {
  console.error('Backup failed:', err);
  process.exit(1);
});
