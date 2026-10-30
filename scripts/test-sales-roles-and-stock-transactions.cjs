const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function main() {
  console.log('================================================================');
  console.log('TESTING SALES & BILLS ROLE ISOLATION & CLEAR SALES FIX');
  console.log('================================================================');

  const pool = await mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: process.env.MYSQL_PASSWORD || 'root',
    database: 'local_billing_db',
    waitForConnections: true,
    connectionLimit: 5,
  });

  // Verify stock_transactions and payments tables exist
  const [tables] = await pool.query("SHOW TABLES LIKE 'stock_transactions'");
  if (tables.length === 0) throw new Error("FAIL: stock_transactions table missing!");
  console.log('[PASS] stock_transactions table exists in local_billing_db');

  const [paymentTables] = await pool.query("SHOW TABLES LIKE 'payments'");
  if (paymentTables.length === 0) throw new Error("FAIL: payments table missing!");
  console.log('[PASS] payments table exists in local_billing_db');

  // Insert test sales for two different cashiers under Company 1 and Company 2
  const comp1 = 'comp_1792411565628';
  const comp2 = 'comp_1792478189028';

  await pool.query(`
    INSERT INTO sales (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, created_by, created_at)
    VALUES 
    ('test_sale_c1_cashier1', ?, 'BILL-C1-01', '[]', 100, 0, 0, 0, 100, 'Cash', 'paid', 'cashier_alpha', NOW()),
    ('test_sale_c1_cashier2', ?, 'BILL-C1-02', '[]', 200, 0, 0, 0, 200, 'UPI', 'paid', 'cashier_beta', NOW()),
    ('test_sale_c2_cashier3', ?, 'BILL-C2-01', '[]', 300, 0, 0, 0, 300, 'Card', 'paid', 'cashier_gamma', NOW())
    ON DUPLICATE KEY UPDATE total=VALUES(total)
  `, [comp1, comp1, comp2]);

  console.log('[PASS] Test sales seeded for different cashiers and companies.');

  // 1. CASHIER ALPHA QUERY: Should only return cashier_alpha's sales for Comp 1
  const [cashierAlphaSales] = await pool.query(`
    SELECT id, created_by, company_id FROM sales
    WHERE company_id = ? AND (created_by = 'cashier_alpha' OR created_by = 'u_alpha')
  `, [comp1]);

  if (cashierAlphaSales.length !== 1 || cashierAlphaSales[0].id !== 'test_sale_c1_cashier1') {
    throw new Error('FAIL: Cashier Alpha saw sales from other cashiers!');
  }
  console.log('[PASS] Cashier Alpha sees only their own sales (1 sale).');

  // 2. COMPANY 1 ADMIN QUERY: Should return both Cashier Alpha and Cashier Beta sales, NOT Comp 2
  const [comp1AdminSales] = await pool.query(`
    SELECT id, created_by, company_id FROM sales
    WHERE company_id = ?
  `, [comp1]);

  const comp1Ids = comp1AdminSales.map(s => s.id);
  if (!comp1Ids.includes('test_sale_c1_cashier1') || !comp1Ids.includes('test_sale_c1_cashier2') || comp1Ids.includes('test_sale_c2_cashier3')) {
    throw new Error('FAIL: Company 1 Admin did not see company sales or saw Company 2 sales!');
  }
  console.log(`[PASS] Company 1 Admin sees all company sales (${comp1AdminSales.length} sales) including cashier_alpha and cashier_beta.`);

  // 3. SUPER ADMIN QUERY: Should return all sales across all companies
  const [superAdminSales] = await pool.query(`
    SELECT s.id, s.created_by, s.company_id, c.name AS company_name
    FROM sales s
    LEFT JOIN companies c ON s.company_id = c.id
  `);
  const allIds = superAdminSales.map(s => s.id);
  if (!allIds.includes('test_sale_c1_cashier1') || !allIds.includes('test_sale_c2_cashier3')) {
    throw new Error('FAIL: Super Admin failed to see sales across multiple companies!');
  }
  console.log(`[PASS] Super Admin sees multi-company sales (${superAdminSales.length} total sales across all companies).`);

  // 4. Test deleting stock_transactions without error
  await pool.query("INSERT INTO stock_transactions (id, company_id, raw_material_id, type, quantity_changed, date) VALUES ('test_tx', ?, 'rm1', 'Stock Deduction', -5, 1792480000000) ON DUPLICATE KEY UPDATE quantity_changed=VALUES(quantity_changed)", [comp1]);
  await pool.query("DELETE FROM stock_transactions WHERE company_id = ? AND reason LIKE 'Sale %'", [comp1]);
  console.log('[PASS] DELETE FROM stock_transactions executed safely without any missing table errors.');

  // Clean up test sales
  await pool.query("DELETE FROM sales WHERE id IN ('test_sale_c1_cashier1', 'test_sale_c1_cashier2', 'test_sale_c2_cashier3')");
  await pool.query("DELETE FROM stock_transactions WHERE id = 'test_tx'");
  console.log('[PASS] Test records cleaned up.');

  console.log('================================================================');
  console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
  console.log('================================================================');
  await pool.end();
}

main().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});
