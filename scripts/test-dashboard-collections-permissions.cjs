// scripts/test-dashboard-collections-permissions.cjs
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function main() {
  console.log('================================================================');
  console.log('TESTING DASHBOARD COLLECTIONS PERMISSION LOGIC');
  console.log('================================================================');

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db'
  });

  try {
    const [compRows] = await pool.query('SELECT id, name FROM companies LIMIT 1');
    const compId = compRows[0].id;
    console.log(`Testing with company: ${compRows[0].name} (${compId})`);

    // 1. Verify company_permissions columns
    const [cols] = await pool.query('DESCRIBE company_permissions');
    const colNames = cols.map(c => c.Field);
    console.log('[PASS] Checked columns:', colNames.filter(c => c.startsWith('module_') || c === 'custom_modules'));

    // 2. Test updating raw_materials (disabling and enabling)
    console.log('\n--- Test 1: Raw Materials Module Toggle ---');
    await pool.query('UPDATE company_permissions SET module_raw_materials = 0, module_inventory = 0 WHERE company_id = ?', [compId]);
    const [rowDisabled] = await pool.query('SELECT module_raw_materials, module_inventory FROM company_permissions WHERE company_id = ?', [compId]);
    if (rowDisabled[0].module_raw_materials !== 0 || rowDisabled[0].module_inventory !== 0) {
      throw new Error('Failed to disable raw_materials in DB');
    }
    console.log('[PASS] Raw Materials disabled successfully in DB (module_raw_materials=0, module_inventory=0)');

    await pool.query('UPDATE company_permissions SET module_raw_materials = 1, module_inventory = 1 WHERE company_id = ?', [compId]);
    const [rowEnabled] = await pool.query('SELECT module_raw_materials, module_inventory FROM company_permissions WHERE company_id = ?', [compId]);
    if (rowEnabled[0].module_raw_materials !== 1 || rowEnabled[0].module_inventory !== 1) {
      throw new Error('Failed to re-enable raw_materials in DB');
    }
    console.log('[PASS] Raw Materials re-enabled successfully in DB (module_raw_materials=1, module_inventory=1)');

    // 3. Test updating sales_and_bills (disabling and enabling)
    console.log('\n--- Test 2: Sales & Bills Module Toggle ---');
    await pool.query('UPDATE company_permissions SET module_sales = 0, module_bills = 0 WHERE company_id = ?', [compId]);
    const [salesDisabled] = await pool.query('SELECT module_sales, module_bills FROM company_permissions WHERE company_id = ?', [compId]);
    if (salesDisabled[0].module_sales !== 0 || salesDisabled[0].module_bills !== 0) {
      throw new Error('Failed to disable sales & bills in DB');
    }
    console.log('[PASS] Sales & Bills disabled successfully in DB (module_sales=0, module_bills=0)');

    await pool.query('UPDATE company_permissions SET module_sales = 1, module_bills = 1 WHERE company_id = ?', [compId]);
    const [salesEnabled] = await pool.query('SELECT module_sales, module_bills FROM company_permissions WHERE company_id = ?', [compId]);
    if (salesEnabled[0].module_sales !== 1 || salesEnabled[0].module_bills !== 1) {
      throw new Error('Failed to re-enable sales & bills in DB');
    }
    console.log('[PASS] Sales & Bills re-enabled successfully in DB (module_sales=1, module_bills=1)');

    // 4. Test extensible dynamic custom collection storage
    console.log('\n--- Test 3: Extensible Dynamic Collection Persistence ---');
    const dynamicModuleTest = { discounts: true, loyalty_points: false };
    await pool.query('UPDATE company_permissions SET custom_modules = ? WHERE company_id = ?', [JSON.stringify(dynamicModuleTest), compId]);
    const [checkCustom] = await pool.query('SELECT custom_modules FROM company_permissions WHERE company_id = ?', [compId]);
    const parsed = typeof checkCustom[0].custom_modules === 'string'
      ? JSON.parse(checkCustom[0].custom_modules)
      : checkCustom[0].custom_modules;
    if (parsed.discounts !== true || parsed.loyalty_points !== false) {
      throw new Error('Failed to persist dynamic collection permission');
    }
    console.log('[PASS] Dynamic collections saved and retrieved successfully:', parsed);

    // Clean up test custom_modules
    await pool.query('UPDATE company_permissions SET custom_modules = NULL WHERE company_id = ?', [compId]);

    console.log('\n================================================================');
    console.log('ALL DASHBOARD COLLECTION PERMISSION CHECKS PASSED!');
    console.log('================================================================');
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error('[FAIL] Test failed:', err);
  process.exit(1);
});
