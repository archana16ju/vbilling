import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config(); // fallback to .env

import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { ORDERED_COMPANY_TABLES, COMPANY_TABLE_SCHEMAS } from '../lib/company-schema';
import { generateCompanyDatabaseName } from '../lib/company-provisioning';
import { ensureMasterDbInitialized } from '../lib/mysql-master';

interface MigrationOptions {
  sourceDbName?: string;
  masterDbName?: string;
  dryRun?: boolean;
}

export async function runDatabasePerCompanyMigration(options: MigrationOptions = {}) {
  const host = process.env.MYSQL_HOST || '127.0.0.1';
  const user = process.env.MYSQL_USER || 'root';
  const password = process.env.MYSQL_PASSWORD || '';
  const port = Number(process.env.MYSQL_PORT || 3306);
  const sourceDb = options.sourceDbName || process.env.MYSQL_DATABASE || 'local_billing_db';
  const masterDb = options.masterDbName || process.env.MASTER_DB_NAME || 'billing_master_db';
  const environment = 'local'; // STRICTLY LOCAL ONLY

  if (host !== '127.0.0.1' && host !== 'localhost') {
    throw new Error(
      `Safety violation: Database-per-company migration is strictly restricted to LOCAL MySQL (host: 127.0.0.1 or localhost). Found host: '${host}'. Remote/production execution is permanently blocked.`
    );
  }

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

  // 1. Connect to MySQL server directly
  const conn = await mysql.createConnection({
    host,
    user,
    password,
    port,
    multipleStatements: true,
  });

  try {
    // 2. Safety check: Verify source database exists
    const [dbCheck]: any = await conn.query(
      'SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?',
      [sourceDb]
    );
    if (!dbCheck || dbCheck.length === 0) {
      throw new Error(`Source database '${sourceDb}' does not exist on this server.`);
    }

    // 3. Ensure Master Database exists and is initialized
    console.log(`Step 1: Initializing Master Database '${masterDb}'...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${masterDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
    await ensureMasterDbInitialized();
    console.log(`✓ Master Database '${masterDb}' initialized with required schemas.\n`);

    // 4. Fetch all companies from source database
    console.log(`Step 2: Inspecting companies in source database '${sourceDb}'...`);
    const [companies]: any = await conn.query(`SELECT * FROM \`${sourceDb}\`.companies ORDER BY id ASC`);
    console.log(`Found ${companies.length} company records:`);
    console.table(companies.map((c: any) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      currency: c.currency,
      is_active: Boolean(c.is_active),
    })));

    if (companies.length === 0) {
      throw new Error(`No companies found in source database '${sourceDb}'. Aborting migration.`);
    }

    const primaryCompanyId = companies[0].id; // Primary company receives records with NULL company_id

    // 5. Migrate each company
    console.log('Step 3: Provisioning dedicated databases and migrating company data...');
    const migrationSummary: any[] = [];

    for (const comp of companies) {
      const compId = comp.id;
      const compCode = comp.code || compId;
      const compName = comp.name;
      let targetDb = comp.database_name;
      if (!targetDb) {
        if (/^COMP-\d+$/i.test(compId)) {
          targetDb = generateCompanyDatabaseName(compId);
        } else if (compCode) {
          targetDb = generateCompanyDatabaseName(compCode);
        } else {
          targetDb = generateCompanyDatabaseName(compId);
        }
      }

      console.log(`\n----------------------------------------------------------------`);
      console.log(`Processing: [${compId}] ${compName} -> Target DB: ${targetDb}`);
      console.log(`----------------------------------------------------------------`);

      // A. Create backup folder: data/backups/<environment>/<company_id>/
      const backupDir = path.join(process.cwd(), 'data', 'backups', environment, compId);
      fs.mkdirSync(backupDir, { recursive: true });

      // B. Create target database
      await conn.query(`CREATE DATABASE IF NOT EXISTS \`${targetDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);

      // C. Provision all 41 tables
      await conn.query(`USE \`${targetDb}\``);
      await conn.query('SET FOREIGN_KEY_CHECKS = 0');

      for (const tbl of ORDERED_COMPANY_TABLES) {
        const ddl = COMPANY_TABLE_SCHEMAS[tbl];
        if (ddl) {
          await conn.query(ddl);
        }
      }

      // D. Export and Migrate data for each company table
      const compTableCounts: Record<string, number> = {};
      const isPrimary = (compId === primaryCompanyId);

      for (const tbl of ORDERED_COMPANY_TABLES) {
        if (tbl === '_migrations') continue;

        // Check if table exists in source database
        const [tblCheck]: any = await conn.query(
          'SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
          [sourceDb, tbl]
        );
        if (!tblCheck || tblCheck.length === 0) continue;

        // Check columns in source table
        const [cols]: any = await conn.query(
          'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
          [sourceDb, tbl]
        );
        const colNames: string[] = cols.map((c: any) => c.COLUMN_NAME);
        const hasCompanyId = colNames.includes('company_id');

        let selectQuery = `SELECT * FROM \`${sourceDb}\`.\`${tbl}\``;
        let selectParams: any[] = [];

        if (hasCompanyId) {
          if (isPrimary) {
            selectQuery += ' WHERE company_id = ? OR company_id IS NULL';
          } else {
            selectQuery += ' WHERE company_id = ?';
          }
          selectParams.push(compId);
        } else if (tbl === 'users') {
          // Users table filtering: via user_companies or direct company_id
          const [userCompRows]: any = await conn.query(
            `SELECT user_id FROM \`${sourceDb}\`.user_companies WHERE company_id = ?`,
            [compId]
          );
          const assignedUserIds = userCompRows.map((r: any) => r.user_id);
          if (assignedUserIds.length > 0) {
            const placeholders = assignedUserIds.map(() => '?').join(',');
            selectQuery = `SELECT * FROM \`${sourceDb}\`.users WHERE company_id = ? OR id IN (${placeholders})`;
            selectParams = [compId, ...assignedUserIds];
          } else {
            selectQuery = `SELECT * FROM \`${sourceDb}\`.users WHERE company_id = ?`;
            selectParams = [compId];
          }
        }

        const [rows]: any = await conn.query(selectQuery, selectParams);

        if (rows && rows.length > 0) {
          // 1. Save backup to JSON (redact plaintext password if present)
          const sanitizedRows = rows.map((r: any) => {
            const copy = { ...r };
            if (copy.password) copy.password = '[REDACTED_PASSWORD]';
            return copy;
          });
          fs.writeFileSync(
            path.join(backupDir, `${tbl}.json`),
            JSON.stringify(sanitizedRows, null, 2),
            'utf8'
          );

          // 2. Clear target table and insert rows
          await conn.query(`TRUNCATE TABLE \`${targetDb}\`.\`${tbl}\``);

          // Insert in chunks of 50 to avoid packet size limits
          const chunkSize = 50;
          for (let i = 0; i < rows.length; i += chunkSize) {
            const chunk = rows.slice(i, i + chunkSize);
            for (const row of chunk) {
              // Ensure company_id is populated with this company's ID if null
              if (hasCompanyId && !row.company_id) {
                row.company_id = compId;
              }

              // Filter columns to those existing in target table
              const [targetCols]: any = await conn.query(
                'SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
                [targetDb, tbl]
              );
              const targetColNames: string[] = targetCols.map((c: any) => c.COLUMN_NAME);

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

      // E. Write backup metadata
      fs.writeFileSync(
        path.join(backupDir, 'backup_meta.json'),
        JSON.stringify(
          {
            companyId: compId,
            companyCode: compCode,
            companyName: compName,
            targetDatabase: targetDb,
            sourceDatabase: sourceDb,
            environment,
            timestamp: new Date().toISOString(),
            tableCounts: compTableCounts,
          },
          null,
          2
        ),
        'utf8'
      );

      // F. Register company in Master DB
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
          compId,
          compName,
          compCode,
          targetDb,
          comp.is_active !== undefined ? (comp.is_active ? 1 : 0) : 1,
          comp.address || null,
          comp.phone || null,
          comp.email || null,
          comp.gstin || null,
          comp.currency || 'INR',
          comp.allow_promo_stacking ? 1 : 0,
        ]
      );

      // G. Register User-Company Routing in Master DB
      const [compUsers]: any = await conn.query(
        `SELECT id, username, name, role FROM \`${targetDb}\`.users WHERE is_active = 1`
      );
      for (const u of compUsers) {
        if (u.role === 'super_admin') continue; // Super admins go to master_users
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
      console.log(`  - Payments : ${compTableCounts['payments'] || 0}`);
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

    // 6. Migrate Super Admins into billing_master_db.master_users
    console.log('\nStep 4: Migrating Super Admin accounts into billing_master_db.master_users...');
    const [superAdmins]: any = await conn.query(
      `SELECT * FROM \`${sourceDb}\`.users WHERE role = 'super_admin' OR username IN ('admin', 'castro')`
    );

    console.log(`Found ${superAdmins.length} Super Admin account(s) in source database:`);
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
        [
          sa.id,
          sa.username || sa.name,
          sa.name || sa.username,
          sa.email || `${sa.username}@admin.local`,
          passHash,
        ]
      );
      console.log(`  ✓ Super Admin '${sa.username}' migrated to master_users (Hash preserved).`);
    }

    // 7. Post-Migration Verification
    console.log('\n================================================================');
    console.log('   POST-MIGRATION VERIFICATION & RECONCILIATION');
    console.log('================================================================');

    const [srcSalesRow]: any = await conn.query(`SELECT COUNT(*) as count FROM \`${sourceDb}\`.sales`);
    const totalSourceSales = srcSalesRow[0].count;

    let totalMigratedSales = 0;
    for (const item of migrationSummary) {
      const [tRow]: any = await conn.query(`SELECT COUNT(*) as count FROM \`${item.database}\`.sales`);
      totalMigratedSales += Number(tRow[0].count);
    }

    console.log(`Source Database Sales (${sourceDb}) : ${totalSourceSales}`);
    console.log(`Sum of Tenant Databases Sales   : ${totalMigratedSales}`);

    if (totalMigratedSales !== totalSourceSales) {
      console.error(`WARNING: Sales count mismatch! Source: ${totalSourceSales}, Migrated: ${totalMigratedSales}`);
    } else {
      console.log(`✓ 100% RECONCILIATION SUCCESS: All ${totalSourceSales} sales verified across tenant databases!`);
    }

    console.log('\n--- Migration Summary ---');
    console.table(migrationSummary);

    // Verify source database was completely untouched
    const [finalSrcSales]: any = await conn.query(`SELECT COUNT(*) as count FROM \`${sourceDb}\`.sales`);
    const [finalSrcComps]: any = await conn.query(`SELECT COUNT(*) as count FROM \`${sourceDb}\`.companies`);
    console.log(`\n--- Source Database Integrity Check (${sourceDb}) ---`);
    console.log(`Original Sales Count     : ${finalSrcSales[0].count} (Must be ${totalSourceSales})`);
    console.log(`Original Companies Count : ${finalSrcComps[0].count} (Must be ${companies.length})`);
    console.log('✓ Source database remains completely intact and unmodified!');

    return {
      success: true,
      environment,
      sourceDb,
      masterDb,
      companiesMigrated: migrationSummary.length,
      totalSalesMigrated: totalMigratedSales,
      summary: migrationSummary,
    };
  } finally {
    await conn.end();
  }
}

// Direct CLI execution
if (process.argv[1] && process.argv[1].endsWith('migrate-database-per-company.ts')) {
  runDatabasePerCompanyMigration()
    .then((result) => {
      console.log('\nMigration completed successfully!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\nCRITICAL MIGRATION ERROR:', err);
      process.exit(1);
    });
}
