const fs = require('fs');
const mysql = require('mysql2/promise');
const env = fs.readFileSync('.env.local', 'utf8');
env.split('\n').forEach(l => { const p = l.indexOf('='); if(p>0) process.env[l.slice(0,p).trim()] = l.slice(p+1).trim(); });

async function main() {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
  });

  console.log('Checking current addon links in products...');
  const [beforeRows] = await pool.query(
    "SELECT COUNT(*) as withAddons FROM products WHERE addon_group_ids IS NOT NULL AND addon_group_ids != '[]'"
  );
  console.log('Products with addons before:', beforeRows[0].withAddons);

  console.log('Removing all addons from all products...');
  const [result] = await pool.query(
    "UPDATE products SET addon_group_ids = JSON_ARRAY()"
  );
  console.log(`Updated ${result.affectedRows} products: addon_group_ids set to JSON_ARRAY().`);

  const [afterRows] = await pool.query(
    "SELECT COUNT(*) as withAddons FROM products WHERE JSON_LENGTH(addon_group_ids) > 0"
  );
  console.log('Products with active addons after:', afterRows[0].withAddons);

  // Check sample products
  const [samples] = await pool.query(
    "SELECT id, name, stock, is_batch_tracked, min_stock, addon_group_ids FROM products LIMIT 5"
  );
  console.log('\nSample products (verifying nothing else was touched):');
  console.table(samples);

  await pool.end();
}

main().catch(console.error);
