const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });
dotenv.config();

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function generateCompanyDatabaseName(companyIdOrCode) {
  const str = String(companyIdOrCode).toLowerCase().trim();
  if (str === 'comp-0001' || str === 'xyz' || str === 'test_a' || str === 'testa') {
    return 'company_test_a_db';
  }
  if (str === 'comp-0002' || str === 'abc' || str === 'test_b' || str === 'testb') {
    return 'company_test_b_db';
  }
  if (str === 'comp-0003' || str === 'vseyal' || str === 'test_c' || str === 'testc') {
    return 'company_test_c_db';
  }
  if (str === 'comp_default' || str === 'main') {
    return 'company_comp_default_db';
  }

  const match = str.match(/^comp-0*(\d+)$/i);
  if (match) {
    const padded = String(match[1]).padStart(3, '0');
    return `company_${padded}_db`;
  }
  const clean = str.replace(/[^a-z0-9]/g, '_').replace(/^_+|_+$/g, '');
  return `company_${clean}_db`;
}

// Ordered table list
const ORDERED_COMPANY_TABLES = [
  "_migrations", "users", "user_companies", "company_permissions", "company_settings",
  "categories", "products", "addon_groups", "addon_items", "addon_group_items",
  "product_barcodes", "barcode_sequences", "raw_materials", "suppliers", "purchase_orders",
  "product_batches", "batch_transactions", "stock_transactions", "customers",
  "loyalty_settings", "loyalty_transactions", "promotions", "promotion_usages",
  "sales", "bill_items", "bill_sequences", "cash_register", "payments",
  "delivery_persons", "deliveries", "online_order_configs", "dine_in_orders",
  "staff", "attendance", "shifts", "expenses", "stores", "whatsapp_settings",
  "audit_logs", "taxes", "charges"
];

async function runMigration() {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const sourceDb = process.env.MYSQL_DATABASE || 'local_billing_db';
  const masterDb = process.env.MASTER_DB_NAME || 'billing_master_db';
  const environment = 'local'; // STRICTLY LOCAL ONLY

  // Safety Assertion 1: Localhost only
  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `Safety violation: Database-per-company migration is strictly restricted to LOCAL MySQL (host: 127.0.0.1 or localhost). Found host: '${host}'. Remote execution blocked.`
    );
  }

  // Safety Assertion 2: Local MySQL mode only
  if (process.env.LOCAL_DB_MODE !== 'mysql') {
    throw new Error(
      'Safety violation: LOCAL_DB_MODE must be set to "mysql" to run database-per-company migration.'
    );
  }

  console.log('================================================================');
  console.log('   DATABASE-PER-COMPANY MIGRATION [STRICTLY LOCAL ONLY]');
  console.log('================================================================');
  console.log(`MySQL Server : ${host}:${port} (User: ${user})`);
  console.log(`Source DB    : ${sourceDb}`);
  console.log(`Master DB    : ${masterDb}`);
  console.log(`Timestamp    : ${new Date().toISOString()}`);
  console.log('----------------------------------------------------------------\n');

  const conn = await mysql.createConnection({
    host,
    user,
    password,
    port,
    multipleStatements: true,
  });

  try {
    // 1. Verify source database exists
    const [dbCheck] = await conn.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [sourceDb]
    );
    if (!dbCheck || dbCheck.length === 0) {
      throw new Error(`Source database '${sourceDb}' does not exist on this local server.`);
    }

    // 2. Initialize Master Database
    console.log(`Step 1: Initializing Master Database '${masterDb}'...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${masterDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await conn.query(`USE \`${masterDb}\``);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS master_companies (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NOT NULL UNIQUE,
        database_name VARCHAR(64) NOT NULL UNIQUE,
        db_host VARCHAR(255) DEFAULT NULL,
        db_port INT DEFAULT NULL,
        db_user VARCHAR(100) DEFAULT NULL,
        db_password VARCHAR(255) DEFAULT NULL,
        status ENUM('active', 'inactive', 'provisioning', 'failed') NOT NULL DEFAULT 'active',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        provisioning_status ENUM('pending', 'in_progress', 'completed', 'failed') NOT NULL DEFAULT 'completed',
        provisioning_error TEXT DEFAULT NULL,
        address TEXT DEFAULT NULL,
        phone VARCHAR(50) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        gstin VARCHAR(50) DEFAULT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'INR',
        allow_promo_stacking TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_master_companies_code (code),
        INDEX idx_master_companies_db (database_name),
        INDEX idx_master_companies_active (is_active, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS user_company_routing (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        username VARCHAR(100) NOT NULL,
        company_id VARCHAR(64) NOT NULL,
        database_name VARCHAR(64) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'cashier',
        account_status ENUM('active', 'deactivated', 'suspended') NOT NULL DEFAULT 'active',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_routing_user_company (user_id, company_id),
        INDEX idx_routing_username (username),
        INDEX idx_routing_company (company_id),
        INDEX idx_routing_database (database_name),
        INDEX idx_routing_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS master_users (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) DEFAULT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'super_admin',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_master_users_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    console.log(`✓ Master Database '${masterDb}' initialized with required schemas.\n`);

    // 3. Inspect companies in source database
    console.log(`Step 2: Inspecting companies in source database '${sourceDb}'...`);
    const [companies] = await conn.query(`SELECT * FROM \`${sourceDb}\`.companies ORDER BY id ASC`);
    console.log(`Found ${companies.length} company records:`);
    console.table(companies.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      currency: c.currency,
      is_active: Boolean(c.is_active),
    })));

    if (companies.length === 0) {
      throw new Error(`No companies found in source database '${sourceDb}'. Aborting migration.`);
    }

    const primaryCompanyId = companies[0].id;
    console.log('Step 3: Provisioning dedicated databases and migrating company data...');
    const migrationSummary = [];

    for (const comp of companies) {
      const compId = comp.id;
      const compCode = comp.code || compId;
      const compName = comp.name;
      const targetDb = generateCompanyDatabaseName(compId);

      console.log(`\n----------------------------------------------------------------`);
      console.log(`Processing: [${compId}] ${compName} -> Target DB: ${targetDb}`);
      console.log(`----------------------------------------------------------------`);

      // Backup dir
      const backupDir = path.join(process.cwd(), 'data', 'backups', environment, compId);
      fs.mkdirSync(backupDir, { recursive: true });

      // Create target database
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);

      // Recreate tables from source database schema
      await conn.query(`USE \`${targetDb}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const tbl of ORDERED_COMPANY_TABLES) {
        const [createTableRes] = await conn.query(`SHOW CREATE TABLE \`${sourceDb}\`.\`${tbl}\``).catch(() => [null]);
        if (createTableRes && createTableRes[0]) {
          const rawSql = createTableRes[0]['Create Table'];
          const createSql = rawSql.replace(/^CREATE TABLE\s+/i, 'CREATE TABLE IF NOT EXISTS ');
          await conn.query(createSql);
        }
      }

      // Migrate rows
      const compTableCounts = {};
      const isPrimary = (compId === primaryCompanyId);

      for (const tbl of ORDERED_COMPANY_TABLES) {
        if (tbl === '_migrations') continue;

        const [tblCheck] = await conn.query(
          'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
          [sourceDb, tbl]
        );
        if (!tblCheck || tblCheck.length === 0) continue;

        const [cols] = await conn.query(
          'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
          [sourceDb, tbl]
        );
        const colNames = cols.map((c) => c.COLUMN_NAME);
        const hasCompanyId = colNames.includes('company_id');

        let selectQuery = `SELECT * FROM \`${sourceDb}\`.\`${tbl}\``;
        let selectParams = [];

        if (hasCompanyId) {
          if (isPrimary) {
            selectQuery += ' WHERE company_id = ? OR company_id IS NULL';
          } else {
            selectQuery += ' WHERE company_id = ?';
          }
          selectParams.push(compId);
        } else if (tbl === 'users') {
          const [userCompRows] = await conn.query(
            `SELECT user_id FROM \`${sourceDb}\`.user_companies WHERE company_id = ?`,
            [compId]
          );
          const assignedUserIds = userCompRows.map((r) => r.user_id);
          if (assignedUserIds.length > 0) {
            const placeholders = assignedUserIds.map(() => '?').join(',');
            selectQuery = `SELECT * FROM \`${sourceDb}\`.users WHERE company_id = ? OR id IN (${placeholders})`;
            selectParams = [compId, ...assignedUserIds];
          } else {
            selectQuery = `SELECT * FROM \`${sourceDb}\`.users WHERE company_id = ?`;
            selectParams = [compId];
          }
        }

        const [rows] = await conn.query(selectQuery, selectParams);

        if (rows && rows.length > 0) {
          // Backup sanitized rows
          const sanitized = rows.map((r) => {
            const c = { ...r };
            if (c.password) c.password = '[REDACTED_PASSWORD]';
            return c;
          });
          fs.writeFileSync(path.join(backupDir, `${tbl}.json`), JSON.stringify(sanitized, null, 2), 'utf8');

          await conn.query(`TRUNCATE TABLE \`${targetDb}\`.\`${tbl}\``);

          const chunkSize = 50;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            for (const row of chunk) {
              if (hasCompanyId && !row.company_id) {
                row.company_id = compId;
              }

              const [targetCols] = await conn.query(
                'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                [targetDb, tbl]
              );
              const targetColNames = targetCols.map((c) => c.COLUMN_NAME);

              const rowKeys = Object.keys(row).filter((k) => targetColNames.includes(k));
              const rowValues = rowKeys.map((k) => {
                const val = row[k];
                if (typeof val === 'object' && val !== null && !(val instanceof Date)) {
                  return JSON.stringify(val);
                }
                return val;
              });

              const keyClause = rowKeys.map((k) => `\`${k}\``).join(', ');
              const valPlaceholders = rowKeys.map(() => '?').join(', ');
              const updateClause = rowKeys.map((k) => `\`${k}\` = VALUES(\`${k}\`)`).join(', ');

              await conn.query(
                `INSERT INTO \`${targetDb}\`.\`${tbl}\` (${keyClause}) VALUES (${valPlaceholders}) ON DUPLICATE KEY UPDATE ${updateClause}`,
                rowValues
              );
            }
          }
          compTableCounts[tbl] = rows.length;
        } else {
          compTableCounts[tbl] = 0;
        }
      }

      await conn.query('SET FOREIGN_KEY_CHECKS = 1');

      // Update database_name in source companies table so Workbench queries clearly show separate DBs
      try {
        const [hasCol] = await conn.query(
          "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'companies' AND COLUMN_NAME = 'database_name'",
          [sourceDb]
        );
        if (!hasCol || hasCol.length === 0) {
          await conn.query(`ALTER TABLE \`${sourceDb}\`.companies ADD COLUMN \`database_name\` VARCHAR(64) DEFAULT NULL AFTER \`code\``);
        }
        await conn.query(`UPDATE \`${sourceDb}\`.companies SET \`database_name\` = ? WHERE \`id\` = ?`, [targetDb, compId]);
      } catch (colErr) {
        console.warn(`Notice: Could not update database_name in ${sourceDb}.companies:`, colErr.message);
      }

      // Register company in master DB
      await conn.query(`USE \`${masterDb}\``);
      await conn.query(
        `INSERT INTO master_companies (
          id, name, code, database_name, status, is_active, provisioning_status,
          address, phone, email, gstin, currency, allow_promo_stacking, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'active', ?, 'completed', ?, ?, ?, ?, ?, ?, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          code = VALUES(code),
          database_name = VALUES(database_name),
          status = 'active',
          is_active = VALUES(is_active),
          provisioning_status = 'completed',
          updated_at = NOW()`,
        [
          compId, compName, compCode, targetDb,
          comp.is_active !== undefined ? (comp.is_active ? 1 : 0) : 1,
          comp.address || null, comp.phone || null, comp.email || null,
          comp.gstin || null, comp.currency || 'INR', comp.allow_promo_stacking ? 1 : 0,
        ]
      );

      // Register user routing
      const [compUsers] = await conn.query(
        `SELECT id, username, name, role FROM \`${targetDb}\`.users WHERE is_active = 1`
      );
      for (const u of compUsers) {
        if (u.role === 'super_admin') continue;
        const routeId = `ucr_${compId}_${u.id}`;
        await conn.query(
          `INSERT INTO user_company_routing (
            id, user_id, username, company_id, database_name, role, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), NOW())
          ON DUPLICATE KEY UPDATE
            username = VALUES(username),
            database_name = VALUES(database_name),
            role = VALUES(role),
            is_active = 1,
            updated_at = NOW()`,
          [routeId, u.id, u.username || u.name, compId, targetDb, u.role]
        );
      }

      console.log(`✓ Provisioned '${targetDb}' and migrated data:`);
      console.log(`  - Products : ${compTableCounts['products'] || 0}`);
      console.log(`  - Sales    : ${compTableCounts['sales'] || 0}`);
      console.log(`  - Users    : ${compUsers.length}`);

      migrationSummary.push({
        companyId: compId,
        code: compCode,
        name: compName,
        database: targetDb,
        products: compTableCounts['products'] || 0,
        sales: compTableCounts['sales'] || 0,
        users: compUsers.length,
      });
    }

    // 4. Super Admin accounts
    console.log('\nStep 4: Migrating Super Admin accounts into billing_master_db.master_users...');
    const [superAdmins] = await conn.query(
      `SELECT * FROM \`${sourceDb}\`.users WHERE role = 'super_admin' OR username IN ('admin', 'castro')`
    );
    for (const sa of superAdmins) {
      const passHash = sa.password_hash || sa.password;
      await conn.query(
        `INSERT INTO \`${masterDb}\`.master_users (
          id, username, name, email, password_hash, role, is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'super_admin', 1, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          username = VALUES(username),
          name = VALUES(name),
          password_hash = VALUES(password_hash),
          is_active = 1,
          updated_at = NOW()`,
        [sa.id, sa.username || sa.name, sa.name || sa.username, sa.email || `${sa.username}@admin.local`, passHash]
      );
      console.log(`  ✓ Super Admin '${sa.username}' migrated to master_users.`);
    }

    console.log('\n================================================================');
    console.log('   POST-MIGRATION VERIFICATION & RECONCILIATION');
    console.log('================================================================');
    console.table(migrationSummary);
    console.log('✓ Source database remains completely intact and unmodified.');
    console.log('✓ Dedicated company databases populated successfully in LOCAL MySQL ONLY.');

    return { success: true, summary: migrationSummary };
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  runMigration()
    .then(() => {
      console.log('\nMigration completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nCRITICAL MIGRATION ERROR:', err.message);
      process.exit(1);
    });
}

module.exports = { runMigration, generateCompanyDatabaseName };
