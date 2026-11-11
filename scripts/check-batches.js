const fs = require('fs');
const mysql = require('mysql2/promise');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => { const p = l.indexOf('='); if(p>0) process.env[l.slice(0,p).trim()] = l.slice(p+1).trim(); });

(async () => {
  const pool = mysql.createPool({ host: '127.0.0.1', user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD, database: process.env.MYSQL_DATABASE });
  const [rows] = await pool.query('SELECT pb.id, pb.item_type, pb.item_id, pb.batch_number, pb.current_quantity, pb.min_stock_level, pb.status, rm.name as rm_name, rm.stock as rm_stock FROM product_batches pb LEFT JOIN raw_materials rm ON pb.item_id = rm.id WHERE pb.item_type = "raw_material"');
  console.log('Raw material batches in product_batches count:', rows.length);
  console.table(rows.slice(0, 15));
  await pool.end();
})();
