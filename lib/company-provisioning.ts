import mysql from "mysql2/promise";
import { getCompanyPool, isValidDatabaseName, closeCompanyPool, getMasterPool, getMysqlPool } from "./mysql";
import {
  ensureMasterDbInitialized,
  getMasterCompanyById,
  upsertMasterCompany,
  updateMasterCompanyProvisioningStatus,
} from "./mysql-master";
import { ORDERED_COMPANY_TABLES, COMPANY_TABLE_SCHEMAS } from "./company-schema";
import { RowDataPacket } from "mysql2";

export interface ProvisionCompanyOptions {
  companyId: string;
  companyCode: string;
  companyName: string;
  customDatabaseName?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  currency?: string;
  allowPromoStacking?: boolean;

  // Configurable tax settings
  taxConfig?: {
    cgstRate?: number;
    sgstRate?: number;
    enableTaxes?: boolean;
  };

  // Discretionary charges: default to false (inactive)
  enableServiceCharge?: boolean;
  serviceChargeRate?: number;
  enablePackingCharge?: boolean;
  packingChargeAmount?: number;
}

export interface ProvisionCompanyResult {
  success: boolean;
  companyId: string;
  companyCode: string;
  databaseName: string;
  tablesCreated: number;
  message: string;
}

/**
 * Generates a standard, safe database name from company ID or code.
 * Example: 'COMP-0004' -> 'company_004_db', 'TESTA' -> 'company_testa_db'
 */
export function generateCompanyDatabaseName(companyIdOrCode: string, companyName?: string): string {
  let num = 1;
  const match = companyIdOrCode.match(/(\d+)/);
  if (match) {
    num = parseInt(match[1], 10);
  }
  const padded = String(num).padStart(3, "0");

  let nameSlug = "";
  if (companyName) {
    nameSlug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  } else {
    const clean = companyIdOrCode.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    if (!clean.startsWith("comp") && clean !== "default") {
      nameSlug = clean;
    }
  }

  if (nameSlug) {
    return `c${padded}_${nameSlug}_db`;
  }
  return `c${padded}_db`;
}

function getDirectServerConnection() {
  const host = process.env.MYSQL_HOST || "127.0.0.1";
  const user = process.env.MYSQL_USER || "root";
  const password = process.env.MYSQL_PASSWORD || "";
  const port = Number(process.env.MYSQL_PORT || 3306);

  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `Safety violation: Local MySQL host must be 127.0.0.1 or localhost (found '${host}'). Remote production access blocked.`
    );
  }

  return mysql.createConnection({ host, user, password, port });
}

/**
 * Checks whether a database already exists on the MySQL server and whether it contains tables.
 */
export async function checkDatabaseExistence(
  dbName: string
): Promise<{ exists: boolean; tableCount: number }> {
  if (!isValidDatabaseName(dbName)) {
    throw new Error(`Invalid database name '${dbName}'.`);
  }

  const conn = await getDirectServerConnection();
  try {
    const [dbRows]: any = await conn.query(
      "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
      [dbName]
    );

    if (!dbRows || dbRows.length === 0) {
      return { exists: false, tableCount: 0 };
    }

    const [tableRows]: any = await conn.query(
      "SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ?",
      [dbName]
    );

    return { exists: true, tableCount: Number(tableRows[0]?.count || 0) };
  } finally {
    await conn.end();
  }
}

/**
 * Reusable company database provisioning service.
 * Creates an independent database, builds all 41 tables with indexes,
 * seeds default settings, permissions, taxes, and charges, and updates master registry.
 */
export async function provisionCompanyDatabase(
  options: ProvisionCompanyOptions
): Promise<ProvisionCompanyResult> {
  await ensureMasterDbInitialized();

  const cleanId = options.companyId.trim();
  const cleanCode = options.companyCode.trim().toUpperCase();
  const cleanName = options.companyName.trim();

  if (!cleanId || !cleanCode || !cleanName) {
    throw new Error("Company ID, code, and name are required for database provisioning.");
  }

  // 1. Determine and strictly validate database name
  const databaseName = options.customDatabaseName
    ? options.customDatabaseName.trim()
    : generateCompanyDatabaseName(cleanId, cleanName);

  if (!isValidDatabaseName(databaseName)) {
    const errorMsg = `Safety violation: Generated or requested database name '${databaseName}' is invalid. Allowed: alphanumeric and underscores (3-64 chars).`;
    const fallbackDbName = (databaseName.replace(/[^a-zA-Z0-9_]/g, "_").substring(0, 60) || "invalid_db") + "_err";
    try {
      await upsertMasterCompany({
        id: cleanId,
        name: cleanName,
        code: cleanCode,
        databaseName: fallbackDbName,
        status: "failed",
        isActive: false,
        provisioningStatus: "failed",
        provisioningError: errorMsg,
      });
    } catch {}
    throw new Error(errorMsg);
  }

  // 2. Safety check: Check if database exists and contains existing tables
  const dbStatus = await checkDatabaseExistence(databaseName);
  const existingMasterComp = await getMasterCompanyById(cleanId);

  if (dbStatus.exists && dbStatus.tableCount > 0) {
    if (existingMasterComp && existingMasterComp.provisioningStatus === "completed") {
      return {
        success: true,
        companyId: cleanId,
        companyCode: cleanCode,
        databaseName,
        tablesCreated: dbStatus.tableCount,
        message: `Database '${databaseName}' is already fully provisioned for company '${cleanId}'. Existing data preserved without overwrite.`,
      };
    }

    throw new Error(
      `Safety Violation: Database '${databaseName}' already exists on MySQL with ${dbStatus.tableCount} tables. Overwriting or resetting existing databases is strictly prohibited.`
    );
  }

  // 3. Register company in master database as 'provisioning'
  await upsertMasterCompany({
    id: cleanId,
    name: cleanName,
    code: cleanCode,
    databaseName,
    status: "provisioning",
    isActive: false,
    provisioningStatus: "in_progress",
    provisioningError: null,
    address: options.address,
    phone: options.phone,
    email: options.email,
    gstin: options.gstin,
    currency: options.currency || "INR",
    allowPromoStacking: options.allowPromoStacking || false,
  });

  try {
    // 4. Create database on server with utf8mb4 encoding
    const serverConn = await getDirectServerConnection();
    try {
      await serverConn.query(
        `CREATE DATABASE IF NOT EXISTS \`${databaseName}\`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
      );
    } finally {
      await serverConn.end();
    }

    // 5. Connect to the new company database via connection pool
    const companyPool = getCompanyPool(databaseName);

    // 6. Create all 41 required tables in order
    let tablesCreatedCount = 0;
    for (const tableName of ORDERED_COMPANY_TABLES) {
      const ddl = COMPANY_TABLE_SCHEMAS[tableName];
      if (!ddl) {
        throw new Error(`Missing schema definition for table '${tableName}'.`);
      }
      await companyPool.query(ddl);
      tablesCreatedCount++;
    }

    
    // 6b. Seed company row into tenant companies table
    await companyPool.query(
      `INSERT INTO companies (id, name, code, address, phone, email, gstin, currency, is_active, allow_promo_stacking)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code)`,
      [
        cleanId,
        cleanName,
        cleanCode,
        options.address || null,
        options.phone || null,
        options.email || null,
        options.gstin || null,
        options.currency || "INR",
        options.allowPromoStacking ? 1 : 0,
      ]
    );

    // 7. Initialize default company settings
    const invoicePrefix = cleanCode.substring(0, 8) || "INV";
    await companyPool.query(
      `INSERT INTO company_settings (
        id, company_id, tax_rate, tax_inclusive, invoice_prefix,
        receipt_header, receipt_footer, printer_width
      ) VALUES (?, ?, 5.00, 1, ?, ?, ?, '80mm')
      ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [
        `cs_${cleanId}`,
        cleanId,
        invoicePrefix,
        `${cleanName}\nWelcome!`,
        "Thank you for your visit!",
      ]
    );

    // 8. Initialize default company permissions
    await companyPool.query(
      `INSERT INTO company_permissions (
        id, company_id, module_users, module_products, module_categories,
        module_sales, module_bills, module_customers, module_payments,
        module_inventory, module_raw_materials, module_reports, module_settings
      ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
      ON DUPLICATE KEY UPDATE updated_at = NOW()`,
      [`cp_${cleanId}`, cleanId]
    );

    // 9. Initialize taxes (configurable rates, active by default unless explicitly disabled)
    const taxesEnabled = options.taxConfig?.enableTaxes !== false;
    const cgstRate = options.taxConfig?.cgstRate != null ? Number(options.taxConfig.cgstRate) : 2.50;
    const sgstRate = options.taxConfig?.sgstRate != null ? Number(options.taxConfig.sgstRate) : 2.50;

    await companyPool.query(
      `INSERT IGNORE INTO taxes (id, company_id, name, rate, applies_to, is_active)
       VALUES 
         (?, ?, 'CGST', ?, 'Every bill', ?),
         (?, ?, 'SGST', ?, 'Every bill', ?)`,
      [
        `tax_cgst_${cleanId}`, cleanId, cgstRate, taxesEnabled ? 1 : 0,
        `tax_sgst_${cleanId}`, cleanId, sgstRate, taxesEnabled ? 1 : 0
      ]
    );

    // 10. Initialize charges: Discretionary charges are INACTIVE (is_active = 0) by default
    // Only enabled if explicitly requested in provisioning options
    const serviceChargeActive = options.enableServiceCharge === true;
    const serviceChargeVal = options.serviceChargeRate != null ? Number(options.serviceChargeRate) : 5.00;

    const packingChargeActive = options.enablePackingCharge === true;
    const packingChargeVal = options.packingChargeAmount != null ? Number(options.packingChargeAmount) : 10.00;

    await companyPool.query(
      `INSERT IGNORE INTO charges (id, company_id, name, type, value, applies_to, is_active)
       VALUES
         (?, ?, 'Service charge', 'percentage', ?, 'Dine In', ?),
         (?, ?, 'Packing', 'fixed', ?, 'Takeaway, Delivery', ?)`,
      [
        `charge_svc_${cleanId}`, cleanId, serviceChargeVal, serviceChargeActive ? 1 : 0,
        `charge_pack_${cleanId}`, cleanId, packingChargeVal, packingChargeActive ? 1 : 0
      ]
    );

    // 11. Mark provisioning as completed and activate company in master database
    await updateMasterCompanyProvisioningStatus(
      cleanId,
      "active",
      "completed",
      null
    );

    return {
      success: true,
      companyId: cleanId,
      companyCode: cleanCode,
      databaseName,
      tablesCreated: tablesCreatedCount,
      message: `Company '${cleanName}' database '${databaseName}' provisioned successfully with ${tablesCreatedCount} tables.`,
    };
  } catch (error: any) {
    console.error(`Provisioning error for company '${cleanId}':`, error.message);

    await updateMasterCompanyProvisioningStatus(
      cleanId,
      "failed",
      "failed",
      error.message || "Unknown provisioning failure"
    );

    // Close cached pool for failed database to allow clean recovery
    await closeCompanyPool(databaseName, true);

    throw new Error(
      `Company database provisioning failed for '${cleanId}': ${error.message}`
    );
  }
}

/**
 * Safely drops a company database and evicts any active connection pool.
 */
export async function deprovisionCompanyDatabase(databaseName: string): Promise<boolean> {
  if (!databaseName || !isValidDatabaseName(databaseName)) {
    return false;
  }

  // Never drop system or master databases
  const protectedDbs = [
    "information_schema",
    "mysql",
    "performance_schema",
    "sys",
    "billing_master_db",
    "local_billing_db",
  ];
  if (protectedDbs.includes(databaseName.toLowerCase())) {
    throw new Error(`Safety violation: Refusing to drop protected database '${databaseName}'.`);
  }

  // 1. Evict and close any active connection pool in memory
  try {
    await closeCompanyPool(databaseName, true);
  } catch (err) {
    console.warn(`Warning closing pool for '${databaseName}':`, err);
  }

  // 2. Drop the physical database
  const serverConn = await getDirectServerConnection();
  try {
    await serverConn.query(`DROP DATABASE IF EXISTS \`${databaseName}\``);
    return true;
  } finally {
    await serverConn.end();
  }
}

/**
 * Rearranges remaining active companies to maintain sequential codes (COMP-0001, COMP-0002, ...)
 * and synchronized database names (c001_<name>_db, c002_<name>_db, ...) without any numbering gaps.
 */
export async function resequenceCompanies(): Promise<void> {
  await ensureMasterDbInitialized();
  const masterPool = getMasterPool();

  // 1. Fetch all active companies ordered by existing creation date or current ID
  const [activeCompanies]: any = await masterPool.query(
    "SELECT * FROM master_companies ORDER BY created_at ASC, id ASC"
  );

  if (!activeCompanies || activeCompanies.length === 0) return;

  const serverConn = await getDirectServerConnection();

  try {
    for (let i = 0; i < activeCompanies.length; i++) {
      const comp = activeCompanies[i];
      const seq = i + 1;
      const expectedId = `COMP-${String(seq).padStart(4, "0")}`;
      const expectedDb = generateCompanyDatabaseName(expectedId, comp.name);
      const currentId = comp.id;
      const currentDb = comp.database_name;

      if (currentId === expectedId && currentDb === expectedDb) {
        continue; // Already aligned
      }

      console.log(`[Resequence] Moving Company [${currentId} -> ${expectedId}] DB [${currentDb} -> ${expectedDb}]`);

      // A. Rename database if database name needs to change
      if (currentDb && currentDb !== expectedDb) {
        // Check if currentDb exists on MySQL
        const [dbCheck]: any = await serverConn.query(
          "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = ?",
          [currentDb]
        );

        if (dbCheck && dbCheck.length > 0) {
          // Close in-memory pool for old database
          await closeCompanyPool(currentDb, true);

          // Create new database
          await serverConn.query(
            `CREATE DATABASE IF NOT EXISTS \`${expectedDb}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
          );

          // Move all tables atomically
          const [tables]: any = await serverConn.query(`SHOW TABLES IN \`${currentDb}\``);
          for (const row of tables) {
            const tbl = Object.values(row)[0] as string;
            await serverConn.query(`RENAME TABLE \`${currentDb}\`.\`${tbl}\` TO \`${expectedDb}\`.\`${tbl}\``);
          }

          // Drop old database
          await serverConn.query(`DROP DATABASE IF EXISTS \`${currentDb}\``);

          // Update company_id in tenant database
          try {
            await serverConn.query(
              `UPDATE \`${expectedDb}\`.companies SET id = ? WHERE id = ?`,
              [expectedId, currentId]
            );
            await serverConn.query(
              `UPDATE \`${expectedDb}\`.users SET company_id = ? WHERE company_id = ?`,
              [expectedId, currentId]
            );
            await serverConn.query(
              `UPDATE \`${expectedDb}\`.products SET company_id = ? WHERE company_id = ?`,
              [expectedId, currentId]
            );
            await serverConn.query(
              `UPDATE \`${expectedDb}\`.categories SET company_id = ? WHERE company_id = ?`,
              [expectedId, currentId]
            );
          } catch (tErr) {
            console.warn(`Tenant tables internal update warning in ${expectedDb}:`, tErr);
          }
        }
      }

      // B. Update master_companies table (using temp ID to avoid unique key collision if needed)
      const tempId = `TEMP-${Date.now()}-${seq}`;
      await masterPool.query(
        "UPDATE master_companies SET id = ?, database_name = ? WHERE id = ?",
        [tempId, expectedDb, currentId]
      );
      await masterPool.query(
        "UPDATE master_companies SET id = ? WHERE id = ?",
        [expectedId, tempId]
      );

      // C. Update user_company_routing
      await masterPool.query(
        "UPDATE user_company_routing SET company_id = ?, database_name = ? WHERE company_id = ?",
        [expectedId, expectedDb, currentId]
      );

      // D. Update local_billing_db tables for backwards compatibility
      try {
        const pool = getMysqlPool();
        await pool.query("UPDATE companies SET id = ? WHERE id = ?", [expectedId, currentId]);
        await pool.query("UPDATE users SET company_id = ? WHERE company_id = ?", [expectedId, currentId]);
        await pool.query("UPDATE user_companies SET company_id = ? WHERE company_id = ?", [expectedId, currentId]);
        await pool.query("UPDATE company_permissions SET id = ?, company_id = ? WHERE company_id = ?", [`cp_${expectedId}`, expectedId, currentId]);
      } catch (localErr) {
        console.warn("Local billing db sync warning on resequence:", localErr);
      }
    }
  } finally {
    await serverConn.end();
  }
}
