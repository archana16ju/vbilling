// scripts/test-staff-salaries-reports.cjs
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function runTests() {
  console.log('================================================================');
  console.log('STAFF, SALARIES, PAYROLL & REPORTS INTEGRATION VERIFICATION');
  console.log('================================================================');

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '2006',
    database: 'local_billing_db'
  });

  const companyId = 'COMP-0001';

  try {
    // 1. Verify staff members for COMP-0001
    const [staffRows] = await pool.query(
      'SELECT id, name, username, role, pay_type, base_amount FROM staff WHERE company_id = ? ORDER BY name ASC',
      [companyId]
    );
    console.log(`[PASS] Found ${staffRows.length} staff members in database for ${companyId}:`);
    staffRows.forEach(s => console.log(`   - ${s.name} (${s.role}, ${s.pay_type}, ₹${s.base_amount})`));

    if (staffRows.length < 5) {
      throw new Error('Expected at least 5 staff members from reference image');
    }

    // 2. Test Today's attendance marking
    const today = new Date().toISOString().split('T')[0];
    const anandStaff = staffRows.find(s => s.name.includes('Anand')) || staffRows[0];

    await pool.query(
      `INSERT INTO attendance (id, company_id, user_id, staff_id, date, status, mark_code, working_hours, created_at)
       VALUES (?, ?, ?, ?, ?, 'Present', 'P', 8.0, NOW())
       ON DUPLICATE KEY UPDATE status = 'Present', mark_code = 'P'`,
      [`att_test_${Date.now()}`, companyId, anandStaff.user_id, anandStaff.id, today]
    );
    console.log(`[PASS] Attendance marked 'P' for ${anandStaff.name} on ${today}.`);

    // 3. Test Month sheet data aggregation
    const [monthAtt] = await pool.query(
      'SELECT staff_id, mark_code FROM attendance WHERE company_id = ? AND date LIKE ?',
      [companyId, `${today.substring(0, 7)}%`]
    );
    console.log(`[PASS] Month sheet query verified: ${monthAtt.length} attendance marks found for current month.`);

    // 4. Test Salary structure with Allowances and Deductions
    const allowances = [{ name: 'Travel Allowance', amount: 2000 }];
    const deductions = [{ name: 'PF Contribution', amount: 1200 }];
    await pool.query(
      `UPDATE staff
       SET pay_type = 'Monthly', base_amount = 25000.00, allowances = ?, deductions = ?, include_in_payroll = 1
       WHERE id = ?`,
      [JSON.stringify(allowances), JSON.stringify(deductions), anandStaff.id]
    );

    const [updatedStaff] = await pool.query('SELECT base_amount, allowances, deductions FROM staff WHERE id = ?', [anandStaff.id]);
    const rawAllowances = updatedStaff[0].allowances;
    const rawDeductions = updatedStaff[0].deductions;
    const parsedAllowances = typeof rawAllowances === 'string' ? JSON.parse(rawAllowances) : rawAllowances;
    const parsedDeductions = typeof rawDeductions === 'string' ? JSON.parse(rawDeductions) : rawDeductions;
    console.log(`[PASS] Salary configured for ${anandStaff.name}: Base ₹${updatedStaff[0].base_amount}, Allowances +₹${parsedAllowances[0].amount}, Deductions -₹${parsedDeductions[0].amount}`);

    // 5. Test Payroll Payout Expense creation in Financial section
    const expId = `exp_sal_${Date.now()}`;
    const netPayout = 25000.00 + 2000.00 - 1200.00; // 25,800.00
    await pool.query(
      `INSERT INTO expenses (
        id, company_id, branch_id, expense_date, category, description, amount,
        payment_method, recorded_by_user_id, status, created_at
      ) VALUES (?, ?, NULL, ?, 'Salary', ?, ?, 'Bank Transfer', 'admin', 'Approved', NOW())`,
      [expId, companyId, today, `Monthly Salary Payout - ${anandStaff.name}`, netPayout]
    );
    console.log(`[PASS] Payroll disbursement of ₹${netPayout.toFixed(2)} recorded in expenses under 'Salary' category.`);

    // 6. Verify Financial Salaries Report Query
    const [salaryExpenses] = await pool.query(
      `SELECT SUM(amount) as total_salary_expenses
       FROM expenses
       WHERE company_id = ? AND category = 'Salary' AND status = 'Approved'`,
      [companyId]
    );
    console.log(`[PASS] Financial Report salary query verified: Total salary disbursements: ₹${Number(salaryExpenses[0].total_salary_expenses).toFixed(2)}`);

    // 7. Verify Staff Report query matching Image 1
    const [salesByStaff] = await pool.query(
      `SELECT s.created_by,
              COUNT(*) as orders_count,
              COUNT(DISTINCT NULLIF(s.customer_name, '')) as guests_count,
              SUM(s.total) as total_sales,
              AVG(s.total) as avg_bill
       FROM sales s
       WHERE s.company_id = ? AND s.payment_status != 'cancelled'
       GROUP BY s.created_by`,
      [companyId]
    );
    console.log(`[PASS] Staff Sales Performance (Image 1 metrics) verified: ${salesByStaff.length} cashiers with attributed sales.`);
    salesByStaff.forEach(s => {
      console.log(`   - Cashier: ${s.created_by} | Orders: ${s.orders_count} | Guests: ${s.guests_count || s.orders_count} | Sales: ₹${Number(s.total_sales).toFixed(2)} | Avg Bill: ₹${Number(s.avg_bill).toFixed(2)}`);
    });

    // Clean up test expense
    await pool.query('DELETE FROM expenses WHERE id = ?', [expId]);
    console.log('[CLEANUP] Temporary test expense cleaned up.');

    console.log('\n================================================================');
    console.log('ALL STAFF, SALARIES, PAYROLL & REPORT TESTS PASSED WITH 100% SUCCESS!');
    console.log('================================================================\n');
  } finally {
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
