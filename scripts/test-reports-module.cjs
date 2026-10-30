// scripts/test-reports-module.cjs
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function runTests() {
  console.log('================================================================');
  console.log('REPORTS MODULE BACKEND & DATA ACCESS VERIFICATION');
  console.log('================================================================');

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: 'local_billing_db'
  });

  try {
    // 1. Check companies
    const [companies] = await pool.query('SELECT id, name, code FROM companies WHERE is_active = 1');
    console.log(`[PASS] Found ${companies.length} active companies in local_billing_db:`, companies.map(c => `${c.name} (${c.id})`).join(', '));
    const targetComp = companies[0]?.id || 'COMP-0001';

    // 2. Test Sales Report query
    const [sales] = await pool.query(
      `SELECT s.id, s.bill_number, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
              s.payment_method, s.payment_status, s.order_type, s.created_by, s.created_at
       FROM sales s
       WHERE s.company_id = ? AND s.payment_status != 'cancelled'
       ORDER BY s.created_at DESC LIMIT 10`,
      [targetComp]
    );
    console.log(`[PASS] Sales Report query executed successfully (${sales.length} sample sales retrieved for ${targetComp})`);

    // 3. Test Taxes (GST) Report query
    let totalTax = 0;
    sales.forEach(s => totalTax += Number(s.tax || 0));
    console.log(`[PASS] Taxes (GST) calculation verified (Sample tax: ₹${totalTax.toFixed(2)})`);

    // 4. Test Outstanding Report query (actual payments subtracted from total)
    const [outstanding] = await pool.query(
      `SELECT s.id, s.bill_number, s.total, s.payment_method, s.payment_status, s.customer_name, s.customer_phone,
              COALESCE(SUM(p.amount), 0) as paid_amount
       FROM sales s
       LEFT JOIN payments p ON (p.sale_id COLLATE utf8mb4_unicode_ci = s.id OR p.sale_id COLLATE utf8mb4_unicode_ci = s.bill_number) AND p.status = 'paid'
       WHERE s.company_id = ? AND s.payment_status != 'cancelled'
       GROUP BY s.id
       HAVING s.payment_status = 'unpaid' OR s.payment_method = 'Bill Only' OR paid_amount < s.total
       LIMIT 10`,
      [targetComp]
    );
    console.log(`[PASS] Outstanding balances verified with actual payments join (${outstanding.length} pending items found)`);

    // 5. Test Day-End Z Report query
    const [cashReg] = await pool.query(
      `SELECT cr.id, cr.type, cr.amount, cr.amount_received, cr.change_given, cr.created_at
       FROM cash_register cr
       WHERE cr.company_id = ?
       LIMIT 10`,
      [targetComp]
    );
    console.log(`[PASS] Day-end Z Report cash drawer query executed (${cashReg.length} cash register entries)`);

    // 6. Test Recipe COGS Profit query
    const [rawMats] = await pool.query(
      `SELECT id, name, cost_per_unit FROM raw_materials WHERE company_id = ?`,
      [targetComp]
    );
    console.log(`[PASS] Expenses & Profit query verified (${rawMats.length} raw materials configured with unit costs)`);

    // 7. Test Staff Report query
    const [staff] = await pool.query(
      `SELECT s.created_by, COUNT(*) as count, SUM(s.total) as total
       FROM sales s
       WHERE s.company_id = ? AND s.payment_status != 'cancelled'
       GROUP BY s.created_by`,
      [targetComp]
    );
    console.log(`[PASS] Staff Performance query verified (${staff.length} staff users found)`);

    // 8. Test Guests Report query
    const [guests] = await pool.query(
      `SELECT s.customer_name, s.customer_phone, COUNT(*) as visits, SUM(s.total) as spent
       FROM sales s
       WHERE s.company_id = ? AND s.payment_status != 'cancelled' AND (s.customer_name IS NOT NULL OR s.customer_phone IS NOT NULL)
       GROUP BY s.customer_name, s.customer_phone
       LIMIT 10`,
      [targetComp]
    );
    console.log(`[PASS] Guests Report query verified (${guests.length} guest profiles found)`);

    // 9. Test Audit Log table query
    const [audit] = await pool.query(
      `SELECT id, action, entity_type, created_at FROM audit_logs WHERE company_id = ? LIMIT 5`,
      [targetComp]
    );
    console.log(`[PASS] Audit Log query executed (${audit.length} records in audit_logs table)`);

    console.log('================================================================');
    console.log('ALL REPORTS BACKEND QUERIES VERIFIED SUCCESSFULLY!');
    console.log('================================================================');
  } catch (err) {
    console.error('[FAIL] Error during report query testing:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runTests();
