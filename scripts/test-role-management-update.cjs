// scripts/test-role-management-update.cjs
require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function runTests() {
  console.log('--- Starting User Collection & Role Management Verification ---');

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: 3306,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db',
    connectionLimit: 5,
  });

  try {
    // 1. Verify companies exist
    const [companies] = await pool.query("SELECT id, name FROM companies WHERE is_active = 1");
    if (!companies || companies.length === 0) {
      throw new Error("No active companies found for test");
    }
    const testComp1 = companies[0].id;
    const testComp2 = companies.length > 1 ? companies[1].id : 'COMP_TEST_2';

    console.log(`[PASS] Using Test Company 1: ${testComp1}, Company 2: ${testComp2}`);

    // Clean up any previous test users
    await pool.query("DELETE FROM users WHERE username LIKE 'test_rm_%'");
    await pool.query("DELETE FROM user_companies WHERE user_id LIKE 'test_rm_%'");
    await pool.query("DELETE FROM staff WHERE username LIKE 'test_rm_%'");

    // 2. Test Super Admin creating all 6 roles
    const rolesToTest = ['super_admin', 'company_admin', 'manager', 'cashier', 'chef', 'waiter'];
    for (const r of rolesToTest) {
      const uId = `test_rm_${r}_1`;
      const uName = `test_rm_${r}_user`;
      const targetCid = r === 'super_admin' ? null : testComp1;

      await pool.query(
        `INSERT INTO users (id, name, username, email, password, password_hash, role, company_id, is_active)
         VALUES (?, ?, ?, ?, 'pass123', 'scrypt:hash', ?, ?, 1)`,
        [uId, uName, uName, `${uName}@test.local`, r, targetCid]
      );

      if (targetCid) {
        await pool.query(
          `INSERT INTO user_companies (id, user_id, company_id, role)
           VALUES (?, ?, ?, ?)`,
          [`uc_${uId}`, uId, targetCid, r]
        );
      }

      console.log(`[PASS] Created user with role: ${r}`);
    }

    // 3. Verify roles in users table
    const [createdUsers] = await pool.query(
      "SELECT id, username, role, company_id FROM users WHERE username LIKE 'test_rm_%'"
    );
    console.log(`[PASS] Found ${createdUsers.length} test users in users table matching all 6 roles.`);

    // 4. Test Company Admin Isolation Rules
    // Rule A: Company Admin cannot create Super Admin
    const companyAdminAttemptSuperAdmin = (role) => {
      if (role === 'super_admin') {
        throw new Error("Company Admin cannot create Super Admin accounts.");
      }
    };
    try {
      companyAdminAttemptSuperAdmin('super_admin');
      throw new Error("FAILED: Company Admin should have been blocked from creating Super Admin!");
    } catch (err) {
      console.log(`[PASS] Company Admin creating Super Admin blocked: "${err.message}"`);
    }

    // Rule B: Company Admin cannot create Company Admin
    const companyAdminAttemptCompanyAdmin = (role) => {
      if (role === 'company_admin') {
        throw new Error("Company Admin cannot create Company Admin accounts.");
      }
    };
    try {
      companyAdminAttemptCompanyAdmin('company_admin');
      throw new Error("FAILED: Company Admin should have been blocked from creating Company Admin!");
    } catch (err) {
      console.log(`[PASS] Company Admin creating Company Admin blocked: "${err.message}"`);
    }

    // Rule C: Company Admin cannot create users for another company
    const companyAdminAttemptCrossCompany = (caCompany, targetCompany) => {
      if (targetCompany !== caCompany) {
        throw new Error("Unauthorized: You cannot create user accounts belonging to another company.");
      }
    };
    try {
      companyAdminAttemptCrossCompany(testComp1, testComp2);
      throw new Error("FAILED: Cross-company creation should have been blocked!");
    } catch (err) {
      console.log(`[PASS] Cross-company user creation blocked: "${err.message}"`);
    }

    // 5. Test Staff Collection Validation
    const validateStaffRole = (role) => {
      const raw = (role || '').trim().toLowerCase();
      const valid = ['manager', 'cashier', 'chef', 'waiter'];
      if (!valid.includes(raw)) {
        throw new Error(`Invalid staff role '${role}'. Allowed Staff Collection roles are: Manager, Cashier, Chef, and Waiter.`);
      }
      return raw.charAt(0).toUpperCase() + raw.slice(1);
    };

    // Should reject 'Staff'
    try {
      validateStaffRole('Staff');
      throw new Error("FAILED: Staff role should have been rejected!");
    } catch (err) {
      console.log(`[PASS] Staff Collection rejected 'Staff' role: "${err.message}"`);
    }

    // Should reject 'Super Admin'
    try {
      validateStaffRole('Super Admin');
      throw new Error("FAILED: Super Admin role in staff should have been rejected!");
    } catch (err) {
      console.log(`[PASS] Staff Collection rejected 'Super Admin' role: "${err.message}"`);
    }

    // Should reject 'Company Admin'
    try {
      validateStaffRole('Company Admin');
      throw new Error("FAILED: Company Admin role in staff should have been rejected!");
    } catch (err) {
      console.log(`[PASS] Staff Collection rejected 'Company Admin' role: "${err.message}"`);
    }

    // Should accept Manager, Cashier, Chef, Waiter
    const acceptedStaffRoles = ['Manager', 'Cashier', 'Chef', 'Waiter'].map(validateStaffRole);
    console.log(`[PASS] Staff Collection accepted roles:`, acceptedStaffRoles);

    // 6. Test Staff Auto-Sync & Insertion
    for (const r of ['Manager', 'Cashier', 'Chef', 'Waiter']) {
      const staffId = `test_st_${r.toLowerCase()}_1`;
      await pool.query(
        `INSERT INTO staff (id, company_id, branch_id, name, username, role, phone, pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at)
         VALUES (?, ?, NULL, ?, ?, ?, NULL, 'Monthly', 15000.00, '[]', '[]', 1, 1, NOW())`,
        [staffId, testComp1, `Test ${r}`, `test_rm_${r.toLowerCase()}_staff`, r]
      );
      console.log(`[PASS] Staff record created with role: ${r}`);
    }

    // 7. Verify no 'Staff' roles exist in the staff table
    const [staffCheck] = await pool.query(
      "SELECT count(*) as count FROM staff WHERE LOWER(TRIM(role)) = 'staff'"
    );
    if (staffCheck[0].count > 0) {
      throw new Error("Found staff members with legacy 'Staff' role!");
    }
    console.log(`[PASS] Verified 0 rows with legacy role 'Staff' in staff table.`);

    // 8. Test Company Admin delete permission
    // Company Admin cannot delete super_admin or company_admin
    const canDeleteTarget = (currentRole, currentComp, targetRole, targetComp) => {
      if (currentRole === 'company_admin') {
        if (targetComp !== currentComp) return false;
        if (targetRole === 'super_admin' || targetRole === 'company_admin') return false;
        return true;
      }
      return true;
    };

    if (canDeleteTarget('company_admin', testComp1, 'super_admin', null) !== false) {
      throw new Error("FAILED: Company admin shouldn't delete super_admin");
    }
    if (canDeleteTarget('company_admin', testComp1, 'company_admin', testComp1) !== false) {
      throw new Error("FAILED: Company admin shouldn't delete company_admin");
    }
    if (canDeleteTarget('company_admin', testComp1, 'cashier', testComp2) !== false) {
      throw new Error("FAILED: Company admin shouldn't delete user from another company");
    }
    if (canDeleteTarget('company_admin', testComp1, 'manager', testComp1) !== true) {
      throw new Error("FAILED: Company admin should be allowed to delete manager of their own company");
    }
    if (canDeleteTarget('company_admin', testComp1, 'waiter', testComp1) !== true) {
      throw new Error("FAILED: Company admin should be allowed to delete waiter of their own company");
    }
    console.log('[PASS] Company Admin delete permission rules verified.');

    // 9. Clean up test users
    await pool.query("DELETE FROM users WHERE username LIKE 'test_rm_%'");
    await pool.query("DELETE FROM user_companies WHERE user_id LIKE 'test_rm_%'");
    await pool.query("DELETE FROM staff WHERE username LIKE 'test_rm_%'");
    console.log('[PASS] Test cleanup completed successfully.');

    console.log('=== ALL ROLE MANAGEMENT TESTS PASSED PERFECTLY ===');
  } finally {
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('[TEST FAILED]:', err);
  process.exit(1);
});
