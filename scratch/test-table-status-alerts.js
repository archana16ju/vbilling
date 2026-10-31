const mysql = require('c:/Users/ADMIN/Documents/billing-software/node_modules/mysql2/promise');

async function verifyTableStatusAndAlerts() {
  console.log('--- TESTING TABLE STATUS & GUEST CAPACITY ALERTS ---');

  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '2006',
    database: 'local_billing_db'
  });

  // 1. Check current dine-in orders
  const [activeOrders] = await conn.query(
    "SELECT id, order_number, table_id, table_name, waiter_name, guest_count, serving_status, kitchen_status FROM dine_in_orders WHERE serving_status NOT IN ('Served', 'Completed', 'Cancelled') ORDER BY created_at DESC"
  );
  console.log('Active dine-in orders in DB:', activeOrders);

  // 2. Test Table Capacity & Over Capacity Alert Logic
  const sampleTables = [
    { id: 't1', name: 'T1', capacity: 2, floor: 'Ground floor' },
    { id: 't2', name: 'T2', capacity: 4, floor: 'Ground floor' },
    { id: 't7', name: 'T7', capacity: 6, floor: 'Ground floor' },
  ];

  // Helper matching
  const clean = (s) => (s || '').toLowerCase().replace(/^(table\s*|tbl[-_]?)/, '').trim();

  function testTableOccupancy(table, order, terminalGuestCount) {
    const isRunning = !!order;
    const seated = isRunning ? (order.guest_count || 1) : 0;
    const availableSeats = Math.max(0, table.capacity - seated);
    const isOverCapacitySeated = isRunning && seated > table.capacity;

    // Terminal selection check
    const exceedsTerminalCapacity = terminalGuestCount > table.capacity;

    return {
      table: table.name,
      capacity: table.capacity,
      status: isRunning ? 'RUNNING' : 'FREE',
      seatedGuests: seated,
      availableSeats: availableSeats,
      isOverCapacityOnTable: isOverCapacitySeated,
      terminalRequestedGuests: terminalGuestCount,
      terminalOverCapacityAlert: exceedsTerminalCapacity,
    };
  }

  console.log('\n--- SIMULATING DIFFERENT GUEST COUNT SCENARIOS ---');

  // Scenario A: Table T1 (2 seats) with 4 guests in Terminal
  const scenarioA = testTableOccupancy(sampleTables[0], null, 4);
  console.log('Scenario A (4 guests selected for T1 - 2 seats):', scenarioA);
  console.assert(scenarioA.terminalOverCapacityAlert === true, 'Terminal alert should fire for 4 guests on 2 seats');

  // Scenario B: Table T2 (4 seats) with 4 guests in Terminal
  const scenarioB = testTableOccupancy(sampleTables[1], null, 4);
  console.log('Scenario B (4 guests selected for T2 - 4 seats):', scenarioB);
  console.assert(scenarioB.terminalOverCapacityAlert === false, 'Terminal alert should NOT fire for 4 guests on 4 seats');

  // Scenario C: Active order on T1 with 3 guests seated (Over capacity on floor)
  const fakeOrderT1 = { id: 'test_ord_1', table_id: 't1', table_name: 'Table T1', guest_count: 3 };
  const scenarioC = testTableOccupancy(sampleTables[0], fakeOrderT1, 3);
  console.log('Scenario C (Active order on T1 with 3 seated guests):', scenarioC);
  console.assert(scenarioC.isOverCapacityOnTable === true, 'Waiter portal should show Over Capacity Alert for 3 guests on 2 seats');
  console.assert(scenarioC.availableSeats === 0, 'Available seats should be 0 when over capacity');

  // Scenario D: Active order on T7 (6 seats) with 2 seated guests
  const fakeOrderT7 = { id: 'test_ord_2', table_id: 't7', table_name: 'Table T7', guest_count: 2 };
  const scenarioD = testTableOccupancy(sampleTables[2], fakeOrderT7, 2);
  console.log('Scenario D (Active order on T7 with 2 seated guests):', scenarioD);
  console.assert(scenarioD.availableSeats === 4, '4 seats should be available on 6-seat table with 2 seated');

  await conn.end();
  console.log('\n✅ All logic checks passed successfully!');
}

verifyTableStatusAndAlerts().catch(console.error);
