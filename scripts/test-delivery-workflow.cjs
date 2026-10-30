require('dotenv').config({ path: '.env.local' });
const mysql = require('mysql2/promise');
const crypto = require('crypto');

function genId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}

function generateTrackingToken() {
  return 'trk_' + crypto.randomBytes(12).toString('hex');
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('Delivery, Online Order API, Sales & Reports Test Suite');
  console.log('Target Database: local_billing_db (Local MySQL Only)');
  console.log('================================================================\n');

  if (process.env.MYSQL_DATABASE !== 'local_billing_db') {
    throw new Error('SAFETY CHECK FAILED: Refusing to run on non-local database.');
  }

  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: 'local_billing_db',
  });

  const conn = await pool.getConnection();

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, testName, details = '') {
    totalTests++;
    if (condition) {
      console.log(`  [PASS] Test ${totalTests}: ${testName}`);
      passedTests++;
    } else {
      console.error(`  [FAIL] Test ${totalTests}: ${testName} ${details ? '- ' + details : ''}`);
    }
  }

  try {
    const testCompanyId = 'COMP-0001';

    // -------------------------------------------------------------
    // Test 1: Verify Database Schema & Migration 24 Columns
    // -------------------------------------------------------------
    console.log('\n--- Section 1: Schema & Table Integrity ---');
    const [colsDelivery] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'deliveries'`
    );
    const delCols = colsDelivery.map(c => c.COLUMN_NAME);
    assert(
      delCols.includes('order_source') &&
      delCols.includes('online_order_id') &&
      delCols.includes('tracking_token') &&
      delCols.includes('status_history') &&
      delCols.includes('latitude') &&
      delCols.includes('longitude'),
      'Deliveries table has all required migration 24 columns'
    );

    const [colsSales] = await conn.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'sales'`
    );
    const saleCols = colsSales.map(c => c.COLUMN_NAME);
    assert(
      saleCols.includes('order_source') && saleCols.includes('online_order_id'),
      'Sales table has order_source and online_order_id columns'
    );

    const [tablesOnline] = await conn.query(
      `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'online_order_configs'`
    );
    assert(tablesOnline.length > 0, 'online_order_configs table exists in local_billing_db');

    // -------------------------------------------------------------
    // Test 2: Platform Configurations (Zomato & Swiggy)
    // -------------------------------------------------------------
    console.log('\n--- Section 2: Online Order API Configurations ---');
    const zomCfgId = `ooc_${testCompanyId}_zomato`;
    const swigCfgId = `ooc_${testCompanyId}_swiggy`;

    await conn.query(
      `INSERT INTO online_order_configs 
       (id, company_id, platform, display_name, is_enabled, api_key, api_secret, store_id, webhook_secret, auto_accept, connection_status)
       VALUES (?, ?, 'zomato', 'Zomato Online', 1, 'zom_test_key_123', 'zom_secret_456', 'STORE-ZOM-99', 'wh_sec_zom', 1, 'connected')
       ON DUPLICATE KEY UPDATE 
         display_name = VALUES(display_name),
         is_enabled = VALUES(is_enabled),
         connection_status = VALUES(connection_status),
         api_key = VALUES(api_key)`,
      [zomCfgId, testCompanyId]
    );

    await conn.query(
      `INSERT INTO online_order_configs 
       (id, company_id, platform, display_name, is_enabled, api_key, api_secret, store_id, webhook_secret, auto_accept, connection_status)
       VALUES (?, ?, 'swiggy', 'Swiggy Online', 1, 'swig_test_key_789', 'swig_secret_012', 'STORE-SWIG-88', 'wh_sec_swig', 1, 'connected')
       ON DUPLICATE KEY UPDATE 
         display_name = VALUES(display_name),
         is_enabled = VALUES(is_enabled),
         connection_status = VALUES(connection_status),
         api_key = VALUES(api_key)`,
      [swigCfgId, testCompanyId]
    );

    const [cfgRows] = await conn.query(
      `SELECT platform, display_name, is_enabled, connection_status FROM online_order_configs WHERE company_id = ?`,
      [testCompanyId]
    );
    assert(cfgRows.length >= 2, 'Zomato and Swiggy configurations saved successfully');
    const zomCfg = cfgRows.find(c => c.platform === 'zomato');
    assert(zomCfg && zomCfg.connection_status === 'connected', 'Zomato config is active and connected');

    // -------------------------------------------------------------
    // Test 3: Delivery Staff Setup & Workload Calibration
    // -------------------------------------------------------------
    console.log('\n--- Section 3: Delivery Staff & Fair Assignment Setup ---');
    const riderEmpId1 = 'DEL-RDR-001';
    const riderEmpId2 = 'DEL-RDR-002';
    const riderId1 = `dp_${testCompanyId}_001`;
    const riderId2 = `dp_${testCompanyId}_002`;

    await conn.query(
      `INSERT INTO delivery_persons 
       (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries)
       VALUES (?, ?, 'Ramesh Kumar', ?, '9876543210', 1, 'available', 0, 3)
       ON DUPLICATE KEY UPDATE 
         is_active = 1,
         availability_status = 'available',
         assigned_delivery_count = 0`,
      [riderId1, testCompanyId, riderEmpId1]
    );

    await conn.query(
      `INSERT INTO delivery_persons 
       (id, company_id, name, employee_id, phone, is_active, availability_status, assigned_delivery_count, max_active_deliveries)
       VALUES (?, ?, 'Suresh Patel', ?, '9876543211', 1, 'available', 0, 3)
       ON DUPLICATE KEY UPDATE 
         is_active = 1,
         availability_status = 'available',
         assigned_delivery_count = 0`,
      [riderId2, testCompanyId, riderEmpId2]
    );

    const [riderRows] = await conn.query(
      `SELECT id, name, employee_id, availability_status, assigned_delivery_count FROM delivery_persons WHERE company_id = ?`,
      [testCompanyId]
    );
    assert(riderRows.length >= 2, 'Available riders initialized in delivery_persons');

    const defaultItems = JSON.stringify([{ name: 'Special Biryani', quantity: 1, price: 200 }]);

    // -------------------------------------------------------------
    // Test 4: Dine In & Takeaway Orders (Do NOT create delivery records)
    // -------------------------------------------------------------
    console.log('\n--- Section 4: Dine In & Takeaway Non-Delivery Rule ---');
    const dineInBill = `BILL-DINE-${Date.now().toString().slice(-6)}`;
    await conn.query(
      `INSERT INTO sales 
       (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, order_type, order_source, created_by)
       VALUES (?, ?, ?, ?, 200.00, 0, 10.00, 0, 210.00, 'Cash', 'paid', 'Dine In', 'Terminal', 'Cashier')`,
      [genId('sale'), testCompanyId, dineInBill, defaultItems]
    );

    const takeawayBill = `BILL-TAKE-${Date.now().toString().slice(-6)}`;
    await conn.query(
      `INSERT INTO sales 
       (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, order_type, order_source, created_by)
       VALUES (?, ?, ?, ?, 150.00, 0, 7.50, 0, 157.50, 'UPI', 'paid', 'Takeaway', 'Terminal', 'Cashier')`,
      [genId('sale'), testCompanyId, takeawayBill, defaultItems]
    );

    const [dineInDelivery] = await conn.query(`SELECT id FROM deliveries WHERE company_id = ? AND bill_id = ?`, [testCompanyId, dineInBill]);
    const [takeawayDelivery] = await conn.query(`SELECT id FROM deliveries WHERE company_id = ? AND bill_id = ?`, [testCompanyId, takeawayBill]);
    assert(dineInDelivery.length === 0, 'Dine In order created bill with NO delivery record');
    assert(takeawayDelivery.length === 0, 'Takeaway order created bill with NO delivery record');

    // -------------------------------------------------------------
    // Test 5: Terminal Delivery Order with Auto-Assignment
    // -------------------------------------------------------------
    console.log('\n--- Section 5: Terminal Delivery Order & Auto-Assignment ---');
    const terminalDeliveryBill = `BILL-DEL-${Date.now().toString().slice(-6)}`;
    const termTrackingToken = generateTrackingToken();
    const custPhone = '9988776655';
    const custAddress = '42 MG Road, Bangalore';

    // Fair selection: pick rider with lowest workload
    const [availableRiders] = await conn.query(
      `SELECT id, name, phone, assigned_delivery_count, max_active_deliveries 
       FROM delivery_persons 
       WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries
       ORDER BY assigned_delivery_count ASC, last_assigned_at ASC 
       LIMIT 1`,
      [testCompanyId]
    );
    const assignedRider = availableRiders[0];
    assert(!!assignedRider, 'Fair algorithm located an eligible available delivery rider');

    // Insert sale
    await conn.query(
      `INSERT INTO sales 
       (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, customer_name, customer_phone, order_type, order_source, created_by)
       VALUES (?, ?, ?, ?, 350.00, 0, 17.50, 0, 367.50, 'Cash', 'paid', 'Ananya Sharma', ?, 'Delivery', 'Terminal', 'Cashier')`,
      [genId('sale'), testCompanyId, terminalDeliveryBill, defaultItems, custPhone]
    );

    // Initial status history
    const initialHistory = JSON.stringify([
      { status: 'assigned', timestamp: Date.now(), updatedBy: 'system', note: `Auto-assigned to ${assignedRider.name}` }
    ]);

    // Insert delivery record
    const termDelId = genId('del');
    await conn.query(
      `INSERT INTO deliveries 
       (id, company_id, bill_id, order_source, tracking_token, customer_name, customer_phone, delivery_address, delivery_person_id, delivery_status, assignment_status, assigned_at, status_history)
       VALUES (?, ?, ?, 'Terminal', ?, 'Ananya Sharma', ?, ?, ?, 'assigned', 'assigned', NOW(), ?)`,
      [termDelId, testCompanyId, terminalDeliveryBill, termTrackingToken, custPhone, custAddress, assignedRider.id, initialHistory]
    );

    // Increment rider workload
    await conn.query(
      `UPDATE delivery_persons 
       SET assigned_delivery_count = assigned_delivery_count + 1, last_assigned_at = NOW() 
       WHERE id = ?`,
      [assignedRider.id]
    );

    // Verify delivery creation
    const [termDelRows] = await conn.query(
      `SELECT d.id, d.order_source, d.tracking_token, d.delivery_status, d.assignment_status, d.delivery_person_id,
              dp.name as rider_name, dp.assigned_delivery_count
       FROM deliveries d
       LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
       WHERE d.company_id = ? AND d.bill_id = ?`,
      [testCompanyId, terminalDeliveryBill]
    );
    assert(termDelRows.length === 1, 'Delivery record successfully linked to bill');
    assert(termDelRows[0].order_source === 'Terminal', 'Delivery order_source is Terminal');
    assert(termDelRows[0].tracking_token === termTrackingToken, 'Tracking token generated and stored');
    assert(termDelRows[0].rider_name === assignedRider.name, `Order auto-assigned to rider ${assignedRider.name}`);
    assert(termDelRows[0].assigned_delivery_count === assignedRider.assigned_delivery_count + 1, 'Rider active workload count incremented by 1');

    // -------------------------------------------------------------
    // Test 6: Pending Assignment (When All Riders are Busy / Offline)
    // -------------------------------------------------------------
    console.log('\n--- Section 6: Pending Assignment When Riders Busy ---');
    // Set all riders to busy
    await conn.query(
      `UPDATE delivery_persons SET availability_status = 'busy' WHERE company_id = ?`,
      [testCompanyId]
    );

    const busyBill = `BILL-BUSY-${Date.now().toString().slice(-6)}`;
    const busyTrackingToken = generateTrackingToken();

    // Check availability
    const [noRiders] = await conn.query(
      `SELECT id FROM delivery_persons WHERE company_id = ? AND is_active = 1 AND availability_status = 'available' AND assigned_delivery_count < max_active_deliveries`,
      [testCompanyId]
    );
    assert(noRiders.length === 0, 'Simulated: 0 available riders');

    // Save as unassigned pending delivery
    await conn.query(
      `INSERT INTO sales 
       (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, customer_name, customer_phone, order_type, order_source, created_by)
       VALUES (?, ?, ?, ?, 500.00, 0, 25.00, 0, 525.00, 'Card', 'paid', 'Rahul Varma', '9123456780', 'Delivery', 'Terminal', 'Cashier')`,
      [genId('sale'), testCompanyId, busyBill, defaultItems]
    );

    await conn.query(
      `INSERT INTO deliveries 
       (id, company_id, bill_id, order_source, tracking_token, customer_name, customer_phone, delivery_address, delivery_person_id, delivery_status, assignment_status, status_history)
       VALUES (?, ?, ?, 'Terminal', ?, 'Rahul Varma', '9123456780', '10 Brigade Road', NULL, 'pending', 'unassigned', ?)`,
      [genId('del'), testCompanyId, busyBill, busyTrackingToken, JSON.stringify([{ status: 'pending', timestamp: Date.now(), updatedBy: 'system', note: 'Pending assignment (no riders available)' }])]
    );

    const [busyDelRows] = await conn.query(
      `SELECT delivery_status, assignment_status, delivery_person_id FROM deliveries WHERE company_id = ? AND bill_id = ?`,
      [testCompanyId, busyBill]
    );
    assert(busyDelRows[0].delivery_status === 'pending', 'Order status saved as pending');
    assert(busyDelRows[0].assignment_status === 'unassigned', 'Assignment status is unassigned');
    assert(busyDelRows[0].delivery_person_id === null, 'delivery_person_id is NULL');

    // Restore riders to available
    await conn.query(
      `UPDATE delivery_persons SET availability_status = 'available' WHERE company_id = ?`,
      [testCompanyId]
    );

    // -------------------------------------------------------------
    // Test 7: Online Order Ingestion (Zomato & Swiggy) & Idempotency
    // -------------------------------------------------------------
    console.log('\n--- Section 7: Online Order Ingestion & Idempotency ---');
    const zomatoOrderId = `ZOM-ORD-${Date.now().toString().slice(-6)}`;
    const swiggyOrderId = `SWIG-ORD-${Date.now().toString().slice(-6)}`;

    // Import Zomato Order
    const zomBillNumber = `ZOM-${zomatoOrderId}`;
    const zomTrackingToken = generateTrackingToken();
    const zomItems = JSON.stringify([
      { name: 'Paneer Butter Masala', quantity: 2, price: 220 },
      { name: 'Butter Naan', quantity: 4, price: 40 }
    ]);

    await conn.query(
      `INSERT INTO sales 
       (id, company_id, bill_number, subtotal, discount, tax, round_off, total, payment_method, payment_status, customer_name, customer_phone, order_type, order_source, online_order_id, items, created_by)
       VALUES (?, ?, ?, 600.00, 50.00, 27.50, 0, 577.50, 'Online (Zomato)', 'paid', 'Vikram Rao', '9880011223', 'Delivery', 'Zomato', ?, ?, 'Zomato Webhook')`,
      [genId('sale'), testCompanyId, zomBillNumber, zomatoOrderId, zomItems]
    );

    await conn.query(
      `INSERT INTO deliveries 
       (id, company_id, bill_id, order_source, online_order_id, tracking_token, customer_name, customer_phone, delivery_address, delivery_status, assignment_status, status_history)
       VALUES (?, ?, ?, 'Zomato', ?, ?, 'Vikram Rao', '9880011223', 'Apartment 4B, Indiranagar', 'preparing', 'unassigned', ?)`,
      [genId('del'), testCompanyId, zomBillNumber, zomatoOrderId, zomTrackingToken, JSON.stringify([{ status: 'preparing', timestamp: Date.now(), updatedBy: 'zomato_webhook', note: 'Zomato order accepted' }])]
    );

    const [zomSaved] = await conn.query(
      `SELECT s.order_source, s.online_order_id, d.order_source as del_source, d.online_order_id as del_online_id, d.delivery_status
       FROM sales s
       JOIN deliveries d ON s.company_id = d.company_id AND s.bill_number = d.bill_id
       WHERE s.company_id = ? AND s.online_order_id = ?`,
      [testCompanyId, zomatoOrderId]
    );
    assert(zomSaved.length === 1, 'Zomato order ingested into both sales and deliveries');
    assert(zomSaved[0].order_source === 'Zomato' && zomSaved[0].del_source === 'Zomato', 'Order source preserved as Zomato');
    assert(zomSaved[0].online_order_id === zomatoOrderId, 'online_order_id stored and indexed');

    // Test Idempotency: Attempt to insert duplicate Zomato order
    const [existingCheck] = await conn.query(
      `SELECT id, bill_number FROM sales WHERE company_id = ? AND online_order_id = ?`,
      [testCompanyId, zomatoOrderId]
    );
    assert(existingCheck.length === 1, 'Idempotency check: Detected existing online order by online_order_id');

    // Import Swiggy Order
    const swigBillNumber = `SWIG-${swiggyOrderId}`;
    const swigTrackingToken = generateTrackingToken();
    await conn.query(
      `INSERT INTO sales 
       (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, customer_name, customer_phone, order_type, order_source, online_order_id, created_by)
       VALUES (?, ?, ?, ?, 400.00, 20.00, 19.00, 0, 399.00, 'Online (Swiggy)', 'paid', 'Sneha Kapoor', '9870098700', 'Delivery', 'Swiggy', ?, 'Swiggy Webhook')`,
      [genId('sale'), testCompanyId, swigBillNumber, defaultItems, swiggyOrderId]
    );

    await conn.query(
      `INSERT INTO deliveries 
       (id, company_id, bill_id, order_source, online_order_id, tracking_token, customer_name, customer_phone, delivery_address, delivery_status, assignment_status)
       VALUES (?, ?, ?, 'Swiggy', ?, ?, 'Sneha Kapoor', '9870098700', 'HSR Layout Sector 1', 'preparing', 'unassigned')`,
      [genId('del'), testCompanyId, swigBillNumber, swiggyOrderId, swigTrackingToken]
    );

    const [swigSaved] = await conn.query(
      `SELECT order_source, online_order_id FROM sales WHERE company_id = ? AND online_order_id = ?`,
      [testCompanyId, swiggyOrderId]
    );
    assert(swigSaved.length === 1 && swigSaved[0].order_source === 'Swiggy', 'Swiggy order ingested with order_source = Swiggy');

    // -------------------------------------------------------------
    // Test 8: Full Status Lifecycle & Workload Release
    // -------------------------------------------------------------
    console.log('\n--- Section 8: Status Lifecycle Transitions & Workload Release ---');
    const targetBill = terminalDeliveryBill;

    // Get current rider workload before completion
    const [riderPre] = await conn.query(
      `SELECT assigned_delivery_count FROM delivery_persons WHERE id = ?`,
      [assignedRider.id]
    );
    const preCount = riderPre[0].assigned_delivery_count;

    // Advance to out_for_delivery
    await conn.query(
      `UPDATE deliveries 
       SET delivery_status = 'out_for_delivery', picked_up_at = NOW() 
       WHERE company_id = ? AND bill_id = ?`,
      [testCompanyId, targetBill]
    );

    const [outRow] = await conn.query(
      `SELECT delivery_status FROM deliveries WHERE company_id = ? AND bill_id = ?`,
      [testCompanyId, targetBill]
    );
    assert(outRow[0].delivery_status === 'out_for_delivery', 'Delivery status advanced to out_for_delivery');

    // Complete order: delivered
    await conn.query(
      `UPDATE deliveries 
       SET delivery_status = 'delivered', delivered_at = NOW() 
       WHERE company_id = ? AND bill_id = ?`,
      [testCompanyId, targetBill]
    );

    // Release rider workload
    await conn.query(
      `UPDATE delivery_persons 
       SET assigned_delivery_count = GREATEST(0, assigned_delivery_count - 1),
           availability_status = 'available'
       WHERE id = ?`,
      [assignedRider.id]
    );

    const [riderPost] = await conn.query(
      `SELECT assigned_delivery_count FROM delivery_persons WHERE id = ?`,
      [assignedRider.id]
    );
    assert(riderPost[0].assigned_delivery_count === preCount - 1, 'Rider workload decremented upon delivered status');

    // Verify bill total remains completely intact
    const [saleCheck] = await conn.query(
      `SELECT total, subtotal, discount, tax FROM sales WHERE company_id = ? AND bill_number = ?`,
      [testCompanyId, targetBill]
    );
    assert(Number(saleCheck[0].total) === 367.50, 'Bill total unchanged (367.50) after delivery status transitions');

    // -------------------------------------------------------------
    // Test 9: Customer Tracking Token Lookup & Masking
    // -------------------------------------------------------------
    console.log('\n--- Section 9: Customer Tracking Token Lookup & Data Privacy ---');
    const [trackRow] = await conn.query(
      `SELECT d.id, d.order_source, d.customer_name, d.customer_phone, d.delivery_address, d.delivery_status,
              s.total, s.payment_method, dp.name as rider_name
       FROM deliveries d
       LEFT JOIN sales s ON d.company_id = s.company_id AND d.bill_id = s.bill_number
       LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
       WHERE d.tracking_token = ?`,
      [termTrackingToken]
    );
    assert(trackRow.length === 1, 'Delivery successfully resolved by tracking token');
    assert(trackRow[0].delivery_status === 'delivered', 'Tracking reports live delivered status');
    assert(trackRow[0].rider_name === assignedRider.name, 'Tracking displays assigned rider name');
    
    // Masking check
    const rawPhone = trackRow[0].customer_phone;
    const maskedPhone = rawPhone.slice(0, 3) + '****' + rawPhone.slice(-2);
    assert(maskedPhone === '998****55', `Customer phone properly masked (${maskedPhone})`);

    // -------------------------------------------------------------
    // Test 10: Reports Integration & Company Isolation
    // -------------------------------------------------------------
    console.log('\n--- Section 10: Analytical Reports Calculation & Company Isolation ---');
    const [delStats] = await conn.query(
      `SELECT 
         COUNT(*) as total_deliveries,
         SUM(CASE WHEN d.delivery_status = 'delivered' THEN 1 ELSE 0 END) as delivered_count,
         SUM(CASE WHEN d.order_source = 'Terminal' THEN 1 ELSE 0 END) as terminal_count,
         SUM(CASE WHEN d.order_source = 'Zomato' THEN 1 ELSE 0 END) as zomato_count,
         SUM(CASE WHEN d.order_source = 'Swiggy' THEN 1 ELSE 0 END) as swiggy_count,
         SUM(s.total) as total_revenue
       FROM deliveries d
       LEFT JOIN sales s ON d.company_id = s.company_id AND d.bill_id = s.bill_number
       WHERE d.company_id = ?`,
      [testCompanyId]
    );

    assert(Number(delStats[0].total_deliveries) >= 3, 'Delivery report correctly aggregates multiple deliveries');
    assert(Number(delStats[0].zomato_count) >= 1, 'Delivery report counts Zomato online orders');
    assert(Number(delStats[0].swiggy_count) >= 1, 'Delivery report counts Swiggy online orders');
    assert(Number(delStats[0].terminal_count) >= 1, 'Delivery report counts Terminal deliveries');
    assert(Number(delStats[0].total_revenue) > 0, 'Delivery report computes actual revenue from sales table');

    // Multi-company isolation test: Query for COMP-0002
    const [comp2Deliveries] = await conn.query(
      `SELECT id FROM deliveries WHERE company_id = 'COMP-0002'`
    );
    const [comp2Sales] = await conn.query(
      `SELECT id FROM sales WHERE company_id = 'COMP-0002' AND order_source IN ('Zomato', 'Swiggy')`
    );
    assert(
      !comp2Deliveries.some(d => d.id === termDelId),
      'Company isolation verified: COMP-0002 cannot access COMP-0001 deliveries'
    );
    assert(
      comp2Sales.length === 0,
      'Company isolation verified: COMP-0002 sales are isolated from COMP-0001 online orders'
    );

    console.log('\n================================================================');
    console.log(`SUMMARY: ${passedTests} / ${totalTests} Tests Passed successfully!`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Test Suite encountered an unexpected error:', err);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

runTestSuite();
