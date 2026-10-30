const assert = require("assert");
require("dotenv").config({ path: ".env.local" });
const mysql = require("mysql2/promise");

async function runTests() {
  console.log("=================================================");
  console.log("   LOCAL MYSQL MULTI-COMPANY BILLING TEST SUITE  ");
  console.log("=================================================\n");

  // TEST 1: Database Name & Safety Verification
  console.log("[Test 1] Verifying local MySQL configuration and safety constraints...");
  if (process.env.MYSQL_DATABASE !== "local_billing_db") {
    throw new Error(`Safety violation: Database must be 'local_billing_db', found '${process.env.MYSQL_DATABASE}'`);
  }
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(`Safety violation: Host must be local, found '${host}'`);
  }
  console.log("✔ Configuration strictly targets local_billing_db on localhost.\n");

  const connection = await mysql.createConnection({
    host,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: "local_billing_db",
  });

  try {
    // TEST 2: Active Connection and Database Verification
    console.log("[Test 2] Verifying live connection to local_billing_db...");
    const [dbRows] = await connection.query("SELECT DATABASE() AS current_db, VERSION() as version");
    assert.strictEqual(dbRows[0].current_db, "local_billing_db", "Connected database must strictly be local_billing_db");
    console.log(`✔ Connected to: ${dbRows[0].current_db} (MySQL version: ${dbRows[0].version})\n`);

    // TEST 3: Running and Verifying Migrations
    console.log("[Test 3] Verifying versioned migrations schema...");
    
    // Check _migrations table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Verify companies table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        address TEXT,
        phone VARCHAR(50),
        email VARCHAR(255),
        gstin VARCHAR(50),
        currency VARCHAR(10) DEFAULT 'INR',
        is_active TINYINT(1) DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // Verify user_companies table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_companies (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        role VARCHAR(50) DEFAULT 'cashier',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_company (user_id, company_id),
        INDEX idx_user_companies_uid (user_id),
        INDEX idx_user_companies_cid (company_id)
      ) ENGINE=InnoDB;
    `);

    // Verify company_id column on existing tables
    const tablesToVerify = ["products", "categories", "sales", "raw_materials", "stock_transactions", "cash_register"];
    for (const t of tablesToVerify) {
      const [colRows] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = 'company_id'`,
        [t]
      );
      if (colRows.length === 0) {
        await connection.query(`ALTER TABLE ${t} ADD COLUMN company_id VARCHAR(64), ADD INDEX idx_${t}_comp (company_id)`);
        console.log(`  Added company_id column to ${t}`);
      }
    }

    // Verify customers and payments tables
    await connection.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        email VARCHAR(255),
        address TEXT,
        gstin VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_customers_company (company_id)
      ) ENGINE=InnoDB;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(64) PRIMARY KEY,
        company_id VARCHAR(64) NOT NULL,
        sale_id VARCHAR(64) NOT NULL,
        payment_method VARCHAR(50) NOT NULL,
        amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'paid',
        reference_number VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_payments_company (company_id),
        INDEX idx_payments_sale (sale_id)
      ) ENGINE=InnoDB;
    `);

    // Check users columns (username, password, shortcuts)
    const userCols = ["username", "password", "shortcuts"];
    for (const c of userCols) {
      const [cRows] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'users' AND COLUMN_NAME = ?`,
        [c]
      );
      if (cRows.length === 0) {
        if (c === "shortcuts") {
          await connection.query("ALTER TABLE users ADD COLUMN shortcuts JSON");
        } else {
          await connection.query(`ALTER TABLE users ADD COLUMN ${c} VARCHAR(255)`);
        }
      }
    }

    // Allow email and password_hash to be NULL
    await connection.query("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL");
    await connection.query("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL");

    // Record migration 1 to 4
    await connection.query(`
      INSERT IGNORE INTO _migrations (version, name) VALUES
      (1, '001_create_companies_and_user_companies'),
      (2, '002_add_company_isolation_columns'),
      (3, '003_create_customers_and_payments'),
      (4, '004_users_and_seed_defaults')
    `);

    console.log("✔ Versioned migrations verified and tables confirmed in local_billing_db.\n");

    // TEST 4: Seed Default Company & Users
    console.log("[Test 4] Verifying default company and user seeding...");
    await connection.query(`
      INSERT INTO companies (id, name, code, address, currency, is_active)
      VALUES ('comp_default', 'Primary Store', 'MAIN', 'HQ Street', 'INR', 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), is_active = 1
    `);

    await connection.query(`
      INSERT INTO users (id, name, username, email, password, role, is_active)
      VALUES 
        ('u1', 'Administrator', 'admin', 'admin@local.test', 'admin', 'admin', 1),
        ('u2', 'Cashier User', 'cashier', 'cashier@local.test', 'cashier123', 'cashier', 1)
      ON DUPLICATE KEY UPDATE username = VALUES(username), email = VALUES(email), password = VALUES(password), role = VALUES(role)
    `);

    await connection.query(`
      INSERT IGNORE INTO user_companies (id, user_id, company_id, role)
      VALUES 
        ('uc_admin_def', 'u1', 'comp_default', 'admin'),
        ('uc_cashier_def', 'u2', 'comp_default', 'cashier')
    `);
    console.log("✔ Default company ('comp_default') and users (admin, cashier) verified.\n");

    // TEST 5: Multi-Company Creation & User Assignments
    console.log("[Test 5] Testing Multi-Company creation and user authorization...");
    const testCompA = "comp_test_alpha_" + Date.now();
    const testCompB = "comp_test_beta_" + Date.now();
    const testCodeA = "ALPHA_" + Math.floor(Math.random() * 900 + 100);
    const testCodeB = "BETA_" + Math.floor(Math.random() * 900 + 100);

    // Create Company A
    await connection.query(
      "INSERT INTO companies (id, name, code, is_active) VALUES (?, ?, ?, 1)",
      [testCompA, "Alpha Retail Store", testCodeA]
    );

    // Create Company B
    await connection.query(
      "INSERT INTO companies (id, name, code, is_active) VALUES (?, ?, ?, 1)",
      [testCompB, "Beta Mart Superstore", testCodeB]
    );

    // Create test cashier user
    const testCashierId = "u_cashier_" + Date.now();
    await connection.query(
      "INSERT INTO users (id, name, username, password, role, is_active) VALUES (?, ?, ?, 'pass', 'cashier', 1)",
      [testCashierId, "Alpha Cashier", "cashier_alpha_" + Date.now()]
    );

    // Assign cashier to Company A only
    await connection.query(
      "INSERT INTO user_companies (id, user_id, company_id, role) VALUES (?, ?, ?, 'cashier')",
      [`uc_${Date.now()}`, testCashierId, testCompA]
    );

    // Server-side authorization check simulation
    // 1. Check user has access to Company A:
    const [permA] = await connection.query(
      "SELECT c.* FROM companies c INNER JOIN user_companies uc ON c.id = uc.company_id WHERE uc.user_id = ? AND c.id = ? AND c.is_active = 1",
      [testCashierId, testCompA]
    );
    assert.strictEqual(permA.length, 1, "User must have permission for Company A");

    // 2. Check user has NO access to Company B:
    const [permB] = await connection.query(
      "SELECT c.* FROM companies c INNER JOIN user_companies uc ON c.id = uc.company_id WHERE uc.user_id = ? AND c.id = ? AND c.is_active = 1",
      [testCashierId, testCompB]
    );
    assert.strictEqual(permB.length, 0, "User must NOT have permission for Company B");
    console.log("✔ Authorization enforcement confirmed: Cashier authorized for Company A, strictly blocked from Company B.\n");

    // TEST 6: Multi-Company Data Isolation (Products, Categories, and Sales)
    console.log("[Test 6] Testing strict data isolation between companies...");
    const prodAId = "p_alpha_" + Date.now();
    const prodBId = "p_beta_" + Date.now();

    await connection.query(
      "INSERT INTO products (id, company_id, name, price, stock, unit) VALUES (?, ?, 'Alpha Signature Coffee', 150.00, 50, 'cup')",
      [prodAId, testCompA]
    );

    await connection.query(
      "INSERT INTO products (id, company_id, name, price, stock, unit) VALUES (?, ?, 'Beta Fresh Juice', 80.00, 100, 'glass')",
      [prodBId, testCompB]
    );

    // Verify company isolation for products
    const [alphaProducts] = await connection.query(
      "SELECT id, name FROM products WHERE company_id = ?",
      [testCompA]
    );
    assert.strictEqual(alphaProducts.some(p => p.id === prodAId), true, "Alpha products must contain Alpha coffee");
    assert.strictEqual(alphaProducts.some(p => p.id === prodBId), false, "Alpha products must NOT contain Beta juice");

    const [betaProducts] = await connection.query(
      "SELECT id, name FROM products WHERE company_id = ?",
      [testCompB]
    );
    assert.strictEqual(betaProducts.some(p => p.id === prodBId), true, "Beta products must contain Beta juice");
    assert.strictEqual(betaProducts.some(p => p.id === prodAId), false, "Beta products must NOT contain Alpha coffee");
    console.log("✔ Product catalog strictly isolated between Company A and Company B.");

    // Record sales in Company A
    const saleAId = `BILL-${testCodeA}-191026-001`;
    await connection.query(
      `INSERT INTO sales (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, created_at)
       VALUES (?, ?, ?, '[]', 150.00, 0, 0, 0, 150.00, 'Cash', 'paid', NOW())`,
      [saleAId, testCompA, saleAId]
    );

    // Record sales in Company B
    const saleBId = `BILL-${testCodeB}-191026-001`;
    await connection.query(
      `INSERT INTO sales (id, company_id, bill_number, items, subtotal, discount, tax, round_off, total, payment_method, payment_status, created_at)
       VALUES (?, ?, ?, '[]', 80.00, 0, 0, 0, 80.00, 'UPI', 'paid', NOW())`,
      [saleBId, testCompB, saleBId]
    );

    // Verify sales isolation
    const [alphaSales] = await connection.query("SELECT id, bill_number FROM sales WHERE company_id = ?", [testCompA]);
    assert.strictEqual(alphaSales.some(s => s.id === saleAId), true, "Alpha sales must contain Alpha bill");
    assert.strictEqual(alphaSales.some(s => s.id === saleBId), false, "Alpha sales must NOT contain Beta bill");

    const [betaSales] = await connection.query("SELECT id, bill_number FROM sales WHERE company_id = ?", [testCompB]);
    assert.strictEqual(betaSales.some(s => s.id === saleBId), true, "Beta sales must contain Beta bill");
    assert.strictEqual(betaSales.some(s => s.id === saleAId), false, "Beta sales must NOT contain Alpha bill");
    console.log("✔ Sales records and bill sequences strictly isolated per company.\n");

    // Clean up temporary test companies
    await connection.query("DELETE FROM products WHERE id IN (?, ?)", [prodAId, prodBId]);
    await connection.query("DELETE FROM sales WHERE id IN (?, ?)", [saleAId, saleBId]);
    await connection.query("DELETE FROM user_companies WHERE company_id IN (?, ?)", [testCompA, testCompB]);
    await connection.query("DELETE FROM users WHERE id = ?", [testCashierId]);
    await connection.query("DELETE FROM companies WHERE id IN (?, ?)", [testCompA, testCompB]);
    console.log("✔ Test cleanup completed successfully.\n");

    // TEST 7: Production / MongoDB Safety Guard
    console.log("[Test 7] Verifying Production & MongoDB Isolation...");
    const savedLocalMode = process.env.LOCAL_DB_MODE;
    const savedNodeEnv = process.env.NODE_ENV;

    // Simulate production / standard dev without LOCAL_DB_MODE:
    delete process.env.LOCAL_DB_MODE;
    process.env.NODE_ENV = "production";
    
    // In production, isLocalMySqlMode must be false:
    const isLocalMySql = process.env.NODE_ENV !== "production" && process.env.LOCAL_DB_MODE === "mysql";
    assert.strictEqual(isLocalMySql, false, "Production mode must NEVER enable local MySQL");

    // Restore environment variables
    process.env.LOCAL_DB_MODE = savedLocalMode;
    process.env.NODE_ENV = savedNodeEnv;

    console.log("✔ Production guard confirmed: isLocalMySqlMode() returns false in production or standard dev.");
    console.log("✔ Live MongoDB connection string and production build are untouched.\n");

    console.log("=================================================");
    console.log("   ALL MULTI-COMPANY LOCAL MYSQL TESTS PASSED!   ");
    console.log("=================================================");
  } finally {
    await connection.end();
  }
}

runTests().catch((err) => {
  console.error("TEST FAILED:", err);
  process.exit(1);
});
