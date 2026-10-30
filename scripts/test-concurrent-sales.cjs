require('dotenv').config({ path: '.env.local' });
process.env.LOCAL_DB_MODE = 'mysql';

const mysql = require('mysql2/promise');

async function testConcurrentSales() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const conn = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  try {
    console.log('Testing simultaneous sale insertion and stock deductions...');
    const companyId = 'COMP-0001';
    
    // Pick an existing product from COMP-0001
    const [products] = await conn.query('SELECT id, name, stock FROM products WHERE company_id = ? LIMIT 1', [companyId]);
    if (!products || products.length === 0) {
      throw new Error('No products found for COMP-0001');
    }
    const testProduct = products[0];
    const initialStock = Number(testProduct.stock);
    console.log(`Test product: ${testProduct.name} (${testProduct.id}), initial stock: ${initialStock}`);

    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const datePrefix = `${dd}${mm}${yy}`;

    // Simulate 2 cashiers checking out concurrently at the exact same millisecond
    const cashier1 = async () => {
      const c = await mysql.createConnection({
        host, port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
        database: 'local_billing_db'
      });
      try {
        await c.beginTransaction();
        const [seqRow] = await c.query('SELECT last_seq FROM bill_sequences WHERE company_id = ? AND date_prefix = ? FOR UPDATE', [companyId, datePrefix]);
        const nextSeq = (seqRow && seqRow[0] ? Number(seqRow[0].last_seq) : 0) + 1;
        await c.query('UPDATE bill_sequences SET last_seq = ? WHERE company_id = ? AND date_prefix = ?', [nextSeq, companyId, datePrefix]);
        const billNumber = `BILL-${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
        const saleId = `${companyId}_${billNumber}`;

        await c.query(
          `INSERT INTO sales (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, created_at)
           VALUES (?, ?, ?, '[]', 100, 0, 5, 0, 105, 'Cash', 'paid', NOW())`,
          [saleId, companyId, billNumber]
        );
        await c.query('UPDATE products SET stock = stock - 1 WHERE id = ? AND company_id = ?', [testProduct.id, companyId]);
        await c.commit();
        return { billNumber, saleId };
      } catch (err) {
        await c.rollback();
        throw err;
      } finally {
        await c.end();
      }
    };

    const cashier2 = async () => {
      const c = await mysql.createConnection({
        host, port: Number(process.env.MYSQL_PORT || 3306),
        user: process.env.MYSQL_USER, password: process.env.MYSQL_PASSWORD,
        database: 'local_billing_db'
      });
      try {
        await c.beginTransaction();
        const [seqRow] = await c.query('SELECT last_seq FROM bill_sequences WHERE company_id = ? AND date_prefix = ? FOR UPDATE', [companyId, datePrefix]);
        const nextSeq = (seqRow && seqRow[0] ? Number(seqRow[0].last_seq) : 0) + 1;
        await c.query('UPDATE bill_sequences SET last_seq = ? WHERE company_id = ? AND date_prefix = ?', [nextSeq, companyId, datePrefix]);
        const billNumber = `BILL-${datePrefix}-${String(nextSeq).padStart(3, '0')}`;
        const saleId = `${companyId}_${billNumber}`;

        await c.query(
          `INSERT INTO sales (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, created_at)
           VALUES (?, ?, ?, '[]', 200, 0, 10, 0, 210, 'UPI', 'paid', NOW())`,
          [saleId, companyId, billNumber]
        );
        await c.query('UPDATE products SET stock = stock - 2 WHERE id = ? AND company_id = ?', [testProduct.id, companyId]);
        await c.commit();
        return { billNumber, saleId };
      } catch (err) {
        await c.rollback();
        throw err;
      } finally {
        await c.end();
      }
    };

    const [res1, res2] = await Promise.all([cashier1(), cashier2()]);
    console.log('Cashier 1 checkout result:', res1);
    console.log('Cashier 2 checkout result:', res2);

    if (res1.billNumber === res2.billNumber) {
      throw new Error(`Duplicate bill number generated: ${res1.billNumber}`);
    }

    // Verify stock deduction: should have decremented by 1 + 2 = 3
    const [updatedProduct] = await conn.query('SELECT stock FROM products WHERE id = ?', [testProduct.id]);
    const finalStock = Number(updatedProduct[0].stock);
    console.log(`Product stock after 2 sales: ${finalStock} (expected: ${initialStock - 3})`);

    if (finalStock !== initialStock - 3) {
      throw new Error(`Stock deduction mismatch! Expected ${initialStock - 3}, got ${finalStock}`);
    }

    console.log('PASS: Simultaneous multi-cashier checkout completed safely without duplicates or lost updates!');

    // Clean up test sales and restore stock
    await conn.query('DELETE FROM sales WHERE id IN (?, ?)', [res1.saleId, res2.saleId]);
    await conn.query('UPDATE products SET stock = ? WHERE id = ?', [initialStock, testProduct.id]);
    console.log('Test cleanup complete, stock restored.');
  } finally {
    await conn.end();
  }
}

testConcurrentSales().catch(err => {
  console.error('Concurrent sales test failed:', err);
  process.exit(1);
});
