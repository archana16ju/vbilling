const fs = require('fs');
const mysql = require('mysql2/promise');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => { const p = l.indexOf('='); if(p>0) process.env[l.slice(0,p).trim()] = l.slice(p+1).trim(); });

(async () => {
  const pool = mysql.createPool({ host: '127.0.0.1', user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });

  console.log('Updating raw material batches to 999.000 and syncing raw_materials.stock to 999.000...');

  // 1. Update all raw material batches to current_quantity = 999.000, initial_quantity = 999.000
  const [bRes] = await pool.query(
    `UPDATE product_batches 
     SET current_quantity = 999.000, initial_quantity = 999.000, status = 'active'
     WHERE item_type = 'raw_material'`
  );
  console.log(`Updated ${bRes.affectedRows} raw material batches to 999.000.`);

  // 2. Update raw materials stock to 999.000
  const [rmRes] = await pool.query(
    `UPDATE raw_materials 
     SET stock = 999.000, status = 'In Stock'
     WHERE stock < 999`
  );
  console.log(`Updated ${rmRes.affectedRows} raw materials back to 999.000.`);

  // 3. Verify how many items are in 'to-buy' condition (stock <= low_stock_limit)
  const [toBuyRows] = await pool.query(
    `SELECT id, name, stock, low_stock_limit 
     FROM raw_materials 
     WHERE stock <= low_stock_limit`
  );
  console.log(`Raw materials requiring reorder (in TO BUY): ${toBuyRows.length}`);
  if (toBuyRows.length > 0) {
    console.table(toBuyRows);
  }

  await pool.end();
})();
