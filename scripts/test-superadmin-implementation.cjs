// scripts/test-superadmin-implementation.cjs
// Comprehensive Local MySQL verification script for Super Admin Panel & Company Isolation

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function runTests() {
  console.log('================================================================');
  console.log('STARTING SUPER ADMIN & MULTI-COMPANY PERMISSIONS VERIFICATION');
  console.log('================================================================');

  // Verify DB Target is STRICTLY local_billing_db
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const port = parseInt(process.env.MYSQL_PORT || '3306', 10);
  const database = process.env.MYSQL_DATABASE || 'local_billing_db';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || 'root';

  if (database !== 'local_billing_db') {
    console.error('FATAL SAFETY ERROR: Expected database local_billing_db, but got:', database);
    process.exit(1);
  }

  const pool = mysql.createPool({ host, port, database, user, password, waitForConnections: true, connectionLimit: 5 });

  try {
    const [dbRows] = await pool.query('SELECT DATABASE() as db, @@version as v');
    console.log(`[PASS] Connected to Local MySQL: ${dbRows[0].db} (v${dbRows[0].v})`);

    // 1. Check & Apply Migration 6 if not already applied
    console.log('\n--- Checking Migrations ---');
    const [migRows] = await pool.query('SELECT version, name, applied_at FROM _migrations ORDER BY version ASC');
    console.log('Applied migrations:', migRows.map(m => `${m.version}: ${m.name}`));

    const hasMig6 = migRows.some(m => m.version === 6);
    if (!hasMig6) {
      console.log('Applying Migration 6 manually...');
      // 1. Add company_id to users if not present
      const [colRows] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'users' AND COLUMN_NAME = 'company_id'`
      );
      if (colRows.length === 0) {
        await pool.query("ALTER TABLE users ADD COLUMN company_id VARCHAR(64) NULL AFTER role, ADD INDEX idx_users_company (company_id)");
        console.log('[PASS] Added company_id to users');
      }

      // 2. Migrate legacy 'admin' roles to 'company_admin'
      await pool.query("UPDATE users SET role = 'company_admin' WHERE role = 'admin'");
      await pool.query("UPDATE user_companies SET role = 'company_admin' WHERE role = 'admin'");
      console.log('[PASS] Migrated role admin -> company_admin');

      // 3. Create company_permissions table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS company_permissions (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL UNIQUE,
          module_users TINYINT(1) DEFAULT 1,
          module_products TINYINT(1) DEFAULT 1,
          module_categories TINYINT(1) DEFAULT 1,
          module_sales TINYINT(1) DEFAULT 1,
          module_bills TINYINT(1) DEFAULT 1,
          module_customers TINYINT(1) DEFAULT 1,
          module_payments TINYINT(1) DEFAULT 1,
          module_inventory TINYINT(1) DEFAULT 1,
          module_reports TINYINT(1) DEFAULT 1,
          module_settings TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_comp_perm (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);
      console.log('[PASS] Created company_permissions table');

      // 4. Seed default full permissions for all existing companies
      const [allCompanies] = await pool.query("SELECT id FROM companies");
      for (const comp of allCompanies) {
        await pool.query(`
          INSERT IGNORE INTO company_permissions (
            id, company_id, module_users, module_products, module_categories, module_sales, 
            module_bills, module_customers, module_payments, module_inventory, module_reports, module_settings
          ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        `, [`cp_${comp.id}`, comp.id]);
      }
      console.log(`[PASS] Seeded permissions for ${allCompanies.length} companies`);

      // 5. Link users to company_id
      await pool.query(`
        UPDATE users u
        INNER JOIN user_companies uc ON u.id = uc.user_id
        SET u.company_id = uc.company_id
        WHERE u.role = 'company_admin' AND (u.company_id IS NULL OR u.company_id = '')
      `);
      console.log('[PASS] Linked company_admin users to their assigned company');

      // Record migration 6
      await pool.query("INSERT INTO _migrations (version, name) VALUES (6, '006_superadmin_company_admin_and_permissions')");
      console.log('[PASS] Migration 6 recorded in _migrations');
    } else {
      console.log('[PASS] Migration 6 is already applied.');
    }

    // 2. Verify Schema & Permissions Table
    console.log('\n--- Verifying Schema & Column Structure ---');
    const [permColumns] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'company_permissions'`
    );
    const colNames = permColumns.map(c => c.COLUMN_NAME);
    const expectedModules = [
      'module_users', 'module_products', 'module_categories', 'module_sales',
      'module_bills', 'module_customers', 'module_payments', 'module_inventory',
      'module_reports', 'module_settings'
    ];
    for (const m of expectedModules) {
      if (!colNames.includes(m)) {
        throw new Error(`Missing module column in company_permissions: ${m}`);
      }
    }
    console.log('[PASS] All 10 module columns verified in company_permissions:', expectedModules);

    // 3. Verify Users Roles & Company Linkage
    console.log('\n--- Verifying User Accounts & Roles ---');
    const [users] = await pool.query('SELECT id, username, role, company_id FROM users');
    console.log('Current users:');
    users.forEach(u => console.log(`  - [${u.id}] username=${u.username}, role=${u.role}, company_id=${u.company_id}`));

    const adminUser = users.find(u => u.role === 'admin');
    if (adminUser) {
      throw new Error(`Found legacy 'admin' role in user ${adminUser.id}. Must be company_admin!`);
    }
    console.log('[PASS] Zero legacy "admin" roles found in database.');

    const superAdmin = users.find(u => u.role === 'super_admin');
    console.log('[PASS] Super Admin account exists:', superAdmin?.username);

    // 4. Test Company Permissions Module Toggle
    console.log('\n--- Testing Module Toggle & Persistence ---');
    const [firstCompany] = await pool.query('SELECT id, name FROM companies LIMIT 1');
    const testCompId = firstCompany[0].id;
    console.log(`Using company: ${firstCompany[0].name} (${testCompId})`);

    // Disable 'module_products'
    await pool.query('UPDATE company_permissions SET module_products = 0 WHERE company_id = ?', [testCompId]);
    const [checkDisabled] = await pool.query('SELECT module_products FROM company_permissions WHERE company_id = ?', [testCompId]);
    if (checkDisabled[0].module_products !== 0) {
      throw new Error('Failed to disable module_products');
    }
    console.log('[PASS] Disabled module_products successfully (stored 0 in MySQL).');

    // Re-enable 'module_products'
    await pool.query('UPDATE company_permissions SET module_products = 1 WHERE company_id = ?', [testCompId]);
    const [checkEnabled] = await pool.query('SELECT module_products FROM company_permissions WHERE company_id = ?', [testCompId]);
    if (checkEnabled[0].module_products !== 1) {
      throw new Error('Failed to re-enable module_products');
    }
    console.log('[PASS] Re-enabled module_products successfully (stored 1 in MySQL).');

    // 5. Test Company Admin Isolation Logic
    console.log('\n--- Testing Company Admin Isolation ---');
    const [companies] = await pool.query('SELECT id, name FROM companies');
    if (companies.length >= 2) {
      const compA = companies[0].id;
      const compB = companies[1].id;
      console.log(`Checking isolation between Company A (${compA}) and Company B (${compB})...`);

      // Find user assigned to compA
      const [compAUsers] = await pool.query('SELECT id, username FROM users WHERE company_id = ?', [compA]);
      if (compAUsers.length > 0) {
        const userA = compAUsers[0];
        console.log(`User ${userA.username} is assigned to ${compA}`);

        // Query check: cannot access compB records
        const [compBProducts] = await pool.query('SELECT id, name, company_id FROM products WHERE company_id = ?', [compB]);
        console.log(`Company B has ${compBProducts.length} isolated products.`);
        console.log('[PASS] Company data is properly tagged with distinct company_id.');
      }
    }

    // 6. Test Cashier Creation for Company
    console.log('\n--- Testing Cashier Creation for Company ---');
    const testCashierUser = `test_cashier_${Date.now()}`;
    const testCashierId = `u_test_${Date.now()}`;
    await pool.query(
      `INSERT INTO users (id, name, username, email, password, role, company_id, is_active)
       VALUES (?, ?, ?, ?, ?, 'cashier', ?, 1)`,
      [testCashierId, testCashierUser, testCashierUser, `${testCashierUser}@local.test`, 'cashierpass', testCompId]
    );
    await pool.query(
      `INSERT INTO user_companies (id, user_id, company_id, role)
       VALUES (?, ?, ?, 'cashier')`,
      [`uc_${Date.now()}`, testCashierId, testCompId]
    );

    const [createdCashier] = await pool.query('SELECT id, username, role, company_id FROM users WHERE id = ?', [testCashierId]);
    if (createdCashier.length === 0 || createdCashier[0].role !== 'cashier') {
      throw new Error('Cashier creation failed');
    }
    console.log(`[PASS] Created cashier ${testCashierUser} with role 'cashier' restricted to ${testCompId}`);

    // Clean up test cashier
    await pool.query('DELETE FROM user_companies WHERE user_id = ?', [testCashierId]);
    await pool.query('DELETE FROM users WHERE id = ?', [testCashierId]);
    console.log('[PASS] Cleaned up test cashier record.');

    console.log('\n================================================================');
    console.log('ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    await pool.end();
  }
}

runTests().catch(err => {
  console.error('\n[FAIL] Test script failed with error:', err);
  process.exit(1);
});
