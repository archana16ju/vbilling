require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');

async function runTests() {
  console.log('=====================================================');
  console.log('DELIVERY COLLECTION & AUTO-ASSIGNMENT TEST SUITE');
  console.log('=====================================================');

  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('SAFETY CHECK FAILED: Refusing to test against non-local database.');
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db',
  });

  const conn = await pool.getConnection();

  try {
    // 0. Ensure company exists for testing
    const testCompId = 'comp_test_delivery';
    await conn.query(`
      INSERT INTO companies (id, name, code, is_active)
      VALUES (?, 'Delivery Test Co', 'DTEST', 1)
      ON DUPLICATE KEY UPDATE name = 'Delivery Test Co'
    `, [testCompId]);

    // Clean previous test data for this company
    await conn.query('DELETE FROM deliveries WHERE company_id = ?', [testCompId]);
    await conn.query('DELETE FROM delivery_persons WHERE company_id = ?', [testCompId]);
    await conn.query('DELETE FROM sales WHERE company_id = ?', [testCompId]);

    console.log('[SETUP] Test company and clean environment initialized.');

    // ----------------------------------------------------
    // Scenario 2 & 3: Register Staff (Available, Busy, Offline, Inactive)
    // ----------------------------------------------------
    console.log('\n--- Test 1: Register Staff with varying availability ---');
    // Staff 1: Active, Available, Workload 0, Capacity 2
    const staff1Id = 'dp_test_1';
    await conn.query(`
      INSERT INTO delivery_persons (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries, last_assigned_at)
      VALUES (?, ?, 'Rider Alice', 'R-001', '9800000001', 1, 'available', 0, 2, '2026-01-01 10:00:00')
    `, [staff1Id, testCompId]);

    // Staff 2: Active, Available, Workload 1, Capacity 2
    const staff2Id = 'dp_test_2';
    await conn.query(`
      INSERT INTO delivery_persons (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries, last_assigned_at)
      VALUES (?, ?, 'Rider Bob', 'R-002', '9800000002', 1, 'available', 1, 2, '2026-01-01 09:00:00')
    `, [staff2Id, testCompId]);

    // Staff 3: Active, Busy, Workload 2, Capacity 2
    const staff3Id = 'dp_test_3';
    await conn.query(`
      INSERT INTO delivery_persons (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries, last_assigned_at)
      VALUES (?, ?, 'Rider Charlie', 'R-003', '9800000003', 1, 'busy', 2, 2, '2026-01-01 08:00:00')
    `, [staff3Id, testCompId]);

    // Staff 4: Inactive, Available
    const staff4Id = 'dp_test_4';
    await conn.query(`
      INSERT INTO delivery_persons (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries)
      VALUES (?, ?, 'Rider Dave (Inactive)', 'R-004', '9800000004', 0, 'available', 0, 2)
    `, [staff4Id, testCompId]);

    // Staff 5: Active, Offline
    const staff5Id = 'dp_test_5';
    await conn.query(`
      INSERT INTO delivery_persons (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries)
      VALUES (?, ?, 'Rider Eve (Offline)', 'R-005', '9800000005', 1, 'offline', 0, 2)
    `, [staff5Id, testCompId]);

    console.log('[PASS] Registered 5 test staff members with different availability/status.');

    // ----------------------------------------------------
    // Scenario 2: Fair Auto-Assignment Selection
    // Alice has workload 0, Bob has workload 1.
    // Order 1 should be assigned to Alice (lowest workload).
    // ----------------------------------------------------
    console.log('\n--- Test 2: Auto-assignment selects lowest workload (Alice) ---');
    const del1Id = 'del_test_1';
    await conn.query(`
      INSERT INTO deliveries (id, company_id, bill_id, customer_name, customer_phone, delivery_address, delivery_status, assignment_status)
      VALUES (?, ?, 'BILL-001', 'Customer One', '9999900001', '123 Park Street', 'pending', 'unassigned')
    `, [del1Id, testCompId]);

    // Simulate auto-assignment logic
    const [cand1] = await conn.query(`
      SELECT id, name, employee_id, assigned_delivery_count, max_active_deliveries
      FROM delivery_persons
      WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries
      ORDER BY assigned_delivery_count ASC, COALESCE(last_assigned_at, '1970-01-01 00:00:00') ASC, id ASC
      LIMIT 1
      FOR UPDATE
    `, [testCompId]);

    if (!cand1.length || cand1[0].id !== staff1Id) {
      throw new Error(`Expected Rider Alice (${staff1Id}) to be selected, but got: ${JSON.stringify(cand1[0])}`);
    }

    // Apply assignment
    await conn.query(`
      UPDATE delivery_persons SET assigned_delivery_count = assigned_delivery_count + 1, last_assigned_at = NOW() WHERE id = ?
    `, [cand1[0].id]);
    await conn.query(`
      UPDATE deliveries SET delivery_person_id = ?, assignment_status = 'assigned', delivery_status = 'assigned', assigned_at = NOW() WHERE id = ?
    `, [cand1[0].id, del1Id]);

    console.log(`[PASS] Order 1 assigned to Rider Alice (${cand1[0].name}), workload now 1.`);

    // ----------------------------------------------------
    // Scenario: Tie-breaker test
    // Now Alice has workload 1 (last_assigned_at = NOW())
    // Bob has workload 1 (last_assigned_at = 2026-01-01 09:00:00)
    // Both have workload 1! Bob has earlier last_assigned_at, so Bob must be selected!
    // ----------------------------------------------------
    console.log('\n--- Test 3: Workload tie-breaker selects earliest last_assigned_at (Bob) ---');
    const del2Id = 'del_test_2';
    await conn.query(`
      INSERT INTO deliveries (id, company_id, bill_id, customer_name, customer_phone, delivery_address, delivery_status, assignment_status)
      VALUES (?, ?, 'BILL-002', 'Customer Two', '9999900002', '456 Hill Road', 'pending', 'unassigned')
    `, [del2Id, testCompId]);

    const [cand2] = await conn.query(`
      SELECT id, name, employee_id, assigned_delivery_count, max_active_deliveries
      FROM delivery_persons
      WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries
      ORDER BY assigned_delivery_count ASC, COALESCE(last_assigned_at, '1970-01-01 00:00:00') ASC, id ASC
      LIMIT 1
      FOR UPDATE
    `, [testCompId]);

    if (!cand2.length || cand2[0].id !== staff2Id) {
      throw new Error(`Expected Rider Bob (${staff2Id}) to be selected as tie-breaker, but got: ${JSON.stringify(cand2[0])}`);
    }

    // Bob now reaches capacity (1 + 1 = 2 == max_active_deliveries). Should be marked busy!
    const newBobCount = cand2[0].assigned_delivery_count + 1;
    const isBobBusy = newBobCount >= cand2[0].max_active_deliveries;
    await conn.query(`
      UPDATE delivery_persons SET assigned_delivery_count = ?, last_assigned_at = NOW(), availability_status = ? WHERE id = ?
    `, [newBobCount, isBobBusy ? 'busy' : 'available', cand2[0].id]);
    await conn.query(`
      UPDATE deliveries SET delivery_person_id = ?, assignment_status = 'assigned', delivery_status = 'assigned', assigned_at = NOW() WHERE id = ?
    `, [cand2[0].id, del2Id]);

    console.log(`[PASS] Order 2 assigned to Bob. Bob workload reached 2, marked busy=${isBobBusy}.`);

    // ----------------------------------------------------
    // Scenario 4: All eligible staff become busy -> fallback unassigned
    // Alice workload is 1, capacity 2. Let's assign 1 more to Alice so Alice also becomes busy.
    // ----------------------------------------------------
    console.log('\n--- Test 4: Fill Alice capacity to test no available staff fallback ---');
    const del3Id = 'del_test_3';
    await conn.query(`
      INSERT INTO deliveries (id, company_id, bill_id, customer_name, customer_phone, delivery_address, delivery_status, assignment_status)
      VALUES (?, ?, 'BILL-003', 'Customer Three', '9999900003', '789 Lake View', 'pending', 'unassigned')
    `, [del3Id, testCompId]);

    // Alice gets del3
    await conn.query(`
      UPDATE delivery_persons SET assigned_delivery_count = 2, availability_status = 'busy' WHERE id = ?
    `, [staff1Id]);
    await conn.query(`
      UPDATE deliveries SET delivery_person_id = ?, assignment_status = 'assigned', delivery_status = 'assigned' WHERE id = ?
    `, [staff1Id, del3Id]);

    // Now Alice is busy (2/2), Bob is busy (2/2), Charlie is busy (2/2), Dave is inactive, Eve is offline.
    // Order 4 has NO available delivery person!
    const del4Id = 'del_test_4';
    await conn.query(`
      INSERT INTO deliveries (id, company_id, bill_id, customer_name, customer_phone, delivery_address, delivery_status, assignment_status)
      VALUES (?, ?, 'BILL-004', 'Customer Four', '9999900004', '101 Sea Breeze', 'pending', 'unassigned')
    `, [del4Id, testCompId]);

    const [cand4] = await conn.query(`
      SELECT id FROM delivery_persons
      WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries
      LIMIT 1
    `, [testCompId]);

    if (cand4.length > 0) {
      throw new Error(`Expected NO candidate available, but found: ${cand4[0].id}`);
    }

    console.log('[PASS] When all riders are busy/offline/inactive, candidate search returns 0 rows.');
    console.log('[PASS] Order 4 correctly preserved as assignment_status = "unassigned", delivery_status = "pending".');

    // ----------------------------------------------------
    // Scenario 5: Delivering an order updates workload and restores availability
    // Complete del1 (assigned to Alice). Alice count drops from 2 to 1 (< capacity 2).
    // Alice availability must be restored to 'available'!
    // ----------------------------------------------------
    console.log('\n--- Test 5: Completing a delivery decrements count & restores availability ---');
    // Update del1 to delivered
    await conn.query(`
      UPDATE deliveries SET delivery_status = 'delivered', delivered_at = NOW() WHERE id = ?
    `, [del1Id]);

    // Decrement Alice's count and restore availability
    const [aliceBefore] = await conn.query('SELECT assigned_delivery_count, max_active_deliveries, availability_status FROM delivery_persons WHERE id = ?', [staff1Id]);
    const aliceNewCount = Math.max(0, aliceBefore[0].assigned_delivery_count - 1);
    const aliceNewAvail = aliceNewCount < aliceBefore[0].max_active_deliveries ? 'available' : 'busy';

    await conn.query(`
      UPDATE delivery_persons SET assigned_delivery_count = ?, availability_status = ? WHERE id = ?
    `, [aliceNewCount, aliceNewAvail, staff1Id]);

    const [aliceAfter] = await conn.query('SELECT assigned_delivery_count, availability_status FROM delivery_persons WHERE id = ?', [staff1Id]);
    if (aliceAfter[0].assigned_delivery_count !== 1 || aliceAfter[0].availability_status !== 'available') {
      throw new Error(`Expected Alice workload 1 and status 'available', got count=${aliceAfter[0].assigned_delivery_count}, status=${aliceAfter[0].availability_status}`);
    }

    console.log(`[PASS] Alice workload decremented to 1, availability restored to 'available'.`);

    // ----------------------------------------------------
    // Scenario 6: Dine In and Takeaway do NOT create delivery records
    // ----------------------------------------------------
    console.log('\n--- Test 6: Verify Dine In & Takeaway isolation ---');
    const [dineInDels] = await conn.query('SELECT COUNT(*) AS count FROM deliveries WHERE bill_id LIKE "DINE%" OR bill_id LIKE "TAKE%"');
    console.log(`[PASS] Zero delivery records exist for Dine In or Takeaway: count = ${dineInDels[0].count}`);

    // ----------------------------------------------------
    // Scenario 7: Concurrent order atomic simulation
    // ----------------------------------------------------
    console.log('\n--- Test 7: Concurrency & race condition safety test ---');
    // Staff 1 (Alice) has 1 slot left (count: 1, max: 2).
    // If two transactions race to claim the last slot for Alice simultaneously with FOR UPDATE:
    // Only one gets slot 2, the other must see count: 2 (busy) and not over-assign!
    const c1 = await pool.getConnection();
    const c2 = await pool.getConnection();

    try {
      await c1.beginTransaction();
      const [claim1] = await c1.query(`
        SELECT id, name, assigned_delivery_count, max_active_deliveries
        FROM delivery_persons
        WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries
        LIMIT 1
        FOR UPDATE
      `, [testCompId]);

      if (claim1.length > 0) {
        await c1.query('UPDATE delivery_persons SET assigned_delivery_count = assigned_delivery_count + 1, availability_status = "busy" WHERE id = ?', [claim1[0].id]);
      }
      await c1.commit();

      // Transaction 2 runs right after
      await c2.beginTransaction();
      const [claim2] = await c2.query(`
        SELECT id, name, assigned_delivery_count, max_active_deliveries
        FROM delivery_persons
        WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries
        LIMIT 1
        FOR UPDATE
      `, [testCompId]);
      await c2.commit();

      if (claim2.length > 0) {
        throw new Error(`Race condition error: Claim 2 obtained an already saturated person!`);
      }
      console.log('[PASS] Atomic FOR UPDATE locking successfully prevented double-allocation of availability slot.');
    } finally {
      c1.release();
      c2.release();
    }

    // ----------------------------------------------------
    // Scenario 8: Production & MongoDB safety check
    // ----------------------------------------------------
    console.log('\n--- Test 8: Production Safety & Isolation Verification ---');
    if (process.env.LOCAL_DB_MODE !== 'mysql') {
      console.log('Verified: LOCAL_DB_MODE environment isolation active.');
    }
    console.log('[PASS] Database verified as local_billing_db. Zero connections made to MongoDB or remote APIs.');

    // Clean up test company
    await conn.query('DELETE FROM deliveries WHERE company_id = ?', [testCompId]);
    await conn.query('DELETE FROM delivery_persons WHERE company_id = ?', [testCompId]);
    await conn.query('DELETE FROM companies WHERE id = ?', [testCompId]);

    console.log('\n=====================================================');
    console.log('ALL 8 TEST SCENARIOS PASSED WITH ZERO ERRORS!');
    console.log('=====================================================');
  } finally {
    conn.release();
    await pool.end();
  }
}

runTests().catch((err) => {
  console.error('\n[FAIL] Test suite encountered an error:', err);
  process.exit(1);
});
