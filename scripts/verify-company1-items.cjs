const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'local_billing_db'
  });

  const [cats] = await conn.query('SELECT id, name, image FROM categories WHERE company_id = ? ORDER BY name ASC', ['COMP-0001']);
  console.log('Categories for COMP-0001:');
  for (const c of cats) {
    const [pCount] = await conn.query('SELECT count(*) as count FROM products WHERE company_id = ? AND category_id = ?', ['COMP-0001', c.id]);
    console.log(`- ${c.name} (${c.id}): ${pCount[0].count} products | Image: ${c.image ? c.image : 'None'}`);
  }

  const [total] = await conn.query('SELECT count(*) as count FROM products WHERE company_id = ?', ['COMP-0001']);
  console.log('\nTotal products in COMP-0001:', total[0].count);

  await conn.end();
}

verify().catch(console.error);
