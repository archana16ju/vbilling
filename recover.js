async function run() {
  const sqlite3 = require('better-sqlite3');
  const path = require('path');
  const dbPath = path.join('C:/Users/ADMIN/.billing-software/BillingOfflineStorage/database', 'local_storage.db');
  const db = new sqlite3(dbPath);
  const rows = db.prepare('SELECT * FROM offline_bills WHERE sync_status = \'PENDING_SYNC\'').all();
  console.log('Pending Bills found:', rows.length);
  for (const row of rows) {
     const sale = JSON.parse(row.data);
     sale.id = row.id;
     console.log('Syncing', sale.id);
     const res = await fetch('http://localhost:3000/api/db/recordSale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sale)
     });
     const result = await res.json();
     console.log('Result:', result);
     if (result.success) {
        db.prepare('UPDATE offline_bills SET sync_status = \'COMPLETED\' WHERE id = ?').run(sale.id);
     }
  }
}
run();