import mysql from "mysql2/promise";
import { getCompanyPool, isValidDatabaseName, closeCompanyPool, getMasterPool, isLocalMySqlMode } from "./mysql";
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
export function generateCompanyDatabaseName(companyIdOrCode: string): string {
  const str = companyIdOrCode.toLowerCase().trim();
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
    const padded = String(match[1]).padStart(3, "0");
    return `company_${padded}_db`;
  }

  const clean = str.replace(/[^a-z0-9]/g, "_").replace(/^_+|_+$/g, "");
  return `company_${clean}_db`;
}

function getDirectServerConnection() {
  if (!isLocalMySqlMode()) {
    throw new Error("Safety violation: Direct MySQL connection is strictly restricted to local MySQL mode.");
  }

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
  if (!isLocalMySqlMode()) {
    throw new Error("Safety violation: Company database provisioning is strictly restricted to local MySQL mode.");
  }

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
    : generateCompanyDatabaseName(cleanId);

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
