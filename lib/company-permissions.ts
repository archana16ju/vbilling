import { getMysqlPool, isLocalMySqlMode } from './mysql';
import { resolveCompanyPoolAndContext } from './mysql-company';
import { ensureLocalMySqlInitialized } from './mysql-init';
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { getSession } from './auth-session';

export {
  BASE_DASHBOARD_COLLECTION_MODULES,
  DASHBOARD_COLLECTION_MODULES,
  DEFAULT_DASHBOARD_PERMISSIONS,
  type DashboardModuleDefinition,
  type CompanyPermissions,
} from './dashboard-modules';

import {
  BASE_DASHBOARD_COLLECTION_MODULES,
  DEFAULT_DASHBOARD_PERMISSIONS,
  type DashboardModuleDefinition,
  type CompanyPermissions,
} from './dashboard-modules';

export type CompanyModule =
  | 'users'
  | 'products'
  | 'categories'
  | 'raw_materials'
  | 'rawMaterials'
  | 'sales_and_bills'
  | 'sales'
  | 'bills'
  | 'inventory'
  | 'customers'
  | 'customer'
  | 'payments'
  | 'payment'
  | 'stores'
  | 'reports'
  | 'settings'
  | string;

/**
 * Dynamically discovers all active dashboard modules and collections:
 * 1. Predefined standard business modules (Users, Products, Categories, Raw Materials, Sales, Customers, etc.)
 * 2. Any database tables dynamically created in MySQL (e.g. new entities created via migrations or scripts)
 * 3. Registered custom modules stored in `registered_modules` or `company_permissions.custom_modules`
 */
export async function getDynamicDashboardModules(): Promise<DashboardModuleDefinition[]> {
  const modulesMap = new Map<string, DashboardModuleDefinition>();

  // 1. Pre-fill standard base modules
  for (const mod of BASE_DASHBOARD_COLLECTION_MODULES) {
    modulesMap.set(mod.key, { ...mod });
  }

  if (isLocalMySqlMode()) {
    try {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();

      // System, join or internal sub-tables to skip
      const IGNORED_TABLES = new Set([
        '_migrations',
        'companies',
        'user_companies',
        'company_permissions',
        'company_settings',
        'bill_sequences',
        'bill_items',
        'cash_register',
        'stock_transactions',
        'registered_modules',
        'raw_materials',
        'stores',
        'payments',
        'audit_logs',
        'purchase_orders',
        'suppliers',
        'deliveries',
        'delivery_persons',
      ]);

      // 2. Discover dynamically from app/(dashboard) directory
      try {
        const fs = await import('fs');
        const path = await import('path');
        const dashboardDir = path.join(process.cwd(), 'app', '(dashboard)');
        if (fs.existsSync(dashboardDir)) {
          const entries = fs.readdirSync(dashboardDir, { withFileTypes: true });
          const IGNORED_FOLDERS = new Set(['super-admin', 'dashboard', 'layout.tsx', 'raw-materials']);

          for (const entry of entries) {
            if (entry.isDirectory() && !IGNORED_FOLDERS.has(entry.name)) {
              let key = entry.name;
              if (key === 'sales') key = 'sales_and_bills';

              if (!modulesMap.has(key)) {
                const label = key
                  .split('-')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
                modulesMap.set(key, {
                  key,
                  label,
                  desc: `Access and management for the ${label.toLowerCase()} collection and page`,
                  isCustom: true,
                });
              }
            }
          }
        }
      } catch (dirErr) {
        console.warn('Failed to scan dashboard directory for routes:', dirErr);
      }

      // 3. Discover from live MySQL tables
      try {
        const [tables]: any = await pool.query('SHOW TABLES');
        if (Array.isArray(tables)) {
          for (const row of tables) {
            const tableName = Object.values(row)[0] as string;
            if (!tableName || IGNORED_TABLES.has(tableName)) continue;

            // Map aliases to existing module keys
            let mappedKey = tableName;
            if (tableName === 'sales') mappedKey = 'sales_and_bills';

            if (!modulesMap.has(mappedKey)) {
              // Convert table_name to Clean Title
              const label = tableName
                .split('_')
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ');

              modulesMap.set(mappedKey, {
                key: mappedKey,
                label,
                desc: `Access and management for the ${label.toLowerCase()} collection and records`,
                isCustom: true,
              });
            }
          }
        }
      } catch (tableErr) {
        console.warn('Failed to query tables for module discovery:', tableErr);
      }

      // 3. Discover from registered_modules table if it exists
      try {
        const [registered]: any = await pool.query('SELECT * FROM registered_modules');
        if (Array.isArray(registered)) {
          for (const reg of registered) {
            if (reg.key_name && !IGNORED_TABLES.has(reg.key_name) && !modulesMap.has(reg.key_name)) {
              modulesMap.set(reg.key_name, {
                key: reg.key_name,
                label: reg.label || reg.key_name,
                desc: reg.description || `Custom collection module for ${reg.label}`,
                isCustom: true,
              });
            }
          }
        }
      } catch {}

      // 4. Discover any custom modules stored across company_permissions
      try {
        const [rows]: any = await pool.query(
          'SELECT custom_modules FROM company_permissions WHERE custom_modules IS NOT NULL'
        );
        for (const r of rows) {
          if (!r.custom_modules) continue;
          let parsed: any = null;
          try {
            parsed = typeof r.custom_modules === 'string' ? JSON.parse(r.custom_modules) : r.custom_modules;
          } catch {}

          if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(parsed)) {
              if (!IGNORED_TABLES.has(k) && !modulesMap.has(k)) {
                const label = k
                  .split('_')
                  .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                  .join(' ');
                modulesMap.set(k, {
                  key: k,
                  label,
                  desc: `Custom collection module: ${label}`,
                  isCustom: true,
                });
              }
            }
          }
        }
      } catch {}
    } catch (err) {
      console.error('Error in getDynamicDashboardModules:', err);
    }
  }

  return Array.from(modulesMap.values());
}

/**
 * Super Admin helper to register a new collection or module explicitly.
 */
export async function registerCustomDashboardModule(
  keyName: string,
  label: string,
  description?: string
): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();
  const pool = getMysqlPool();

  const cleanKey = keyName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  await pool.query(
    `INSERT INTO registered_modules (key_name, label, description)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE label = VALUES(label), description = VALUES(description)`,
    [cleanKey, label, description || `Access and manage ${label} collection`]
  );

  return true;
}

function mapRowToPermissions(row: any, companyId: string): CompanyPermissions {
  if (!row) {
    return {
      companyId,
      ...DEFAULT_DASHBOARD_PERMISSIONS,
    } as CompanyPermissions;
  }

  let customModules: Record<string, boolean> = {};
  if (row.custom_modules) {
    try {
      customModules = typeof row.custom_modules === 'string'
        ? JSON.parse(row.custom_modules)
        : row.custom_modules;
    } catch {}
  }

  const rawMaterialsEnabled = row.module_raw_materials !== undefined && row.module_raw_materials !== null
    ? Boolean(row.module_raw_materials)
    : (customModules.stocks !== undefined ? Boolean(customModules.stocks) : true);

  const salesAndBillsEnabled = Boolean(
    (row.module_sales === undefined || Boolean(row.module_sales)) &&
    (row.module_bills === undefined || Boolean(row.module_bills))
  );

  const customersEnabled = row.module_customers !== undefined && row.module_customers !== null
    ? Boolean(row.module_customers)
    : (customModules.customers !== undefined ? Boolean(customModules.customers) : true);

  const terminalEnabled = customModules.terminal !== undefined ? Boolean(customModules.terminal) : true;
  const kitchenEnabled = customModules.kitchen !== undefined ? Boolean(customModules.kitchen) : true;
  const tablesEnabled = customModules.tables !== undefined ? Boolean(customModules.tables) : true;
  const companiesEnabled = customModules.companies !== undefined ? Boolean(customModules.companies) : true;
  const stocksEnabled = customModules.stocks !== undefined ? Boolean(customModules.stocks) : rawMaterialsEnabled;

  const permissions: CompanyPermissions = {
    id: row.id,
    companyId: row.company_id || companyId,
    terminal: terminalEnabled,
    kitchen: kitchenEnabled,
    tables: tablesEnabled,
    sales_and_bills: salesAndBillsEnabled,
    companies: companiesEnabled,
    products: Boolean(row.module_products),
    stocks: stocksEnabled,
    categories: Boolean(row.module_categories),
    customers: customersEnabled,
    users: Boolean(row.module_users),
    settings: Boolean(row.module_settings),
    // Aliases for compatibility with billing endpoints
    inventory: stocksEnabled,
    raw_materials: stocksEnabled,
    rawMaterials: stocksEnabled,
    sales: salesAndBillsEnabled,
    bills: salesAndBillsEnabled,
    customer: customersEnabled,
    custom_modules: customModules,
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    ...customModules,
  };

  return permissions;
}

// Short-lived in-memory cache for company permissions to optimize collection switching
const companyPermissionsCache = new Map<string, { permissions: CompanyPermissions; expiresAt: number }>();

export function clearCompanyPermissionsCache(companyId?: string) {
  if (companyId) {
    companyPermissionsCache.delete(companyId);
  } else {
    companyPermissionsCache.clear();
  }
}

/**
 * Retrieves the module permissions for a company.
 * If no record exists yet, creates a default enabled record.
 */
export async function getCompanyPermissions(companyId: string): Promise<CompanyPermissions> {
  if (!isLocalMySqlMode()) {
    return {
      companyId,
      ...DEFAULT_DASHBOARD_PERMISSIONS,
    } as CompanyPermissions;
  }

  const cached = companyPermissionsCache.get(companyId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }

  await ensureLocalMySqlInitialized();

  let pool = getMysqlPool();
  try {
    const resolved = await resolveCompanyPoolAndContext(companyId);
    pool = resolved.pool;
  } catch (err) {
    // fallback to legacy pool
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT * FROM company_permissions WHERE company_id = ?',
    [companyId]
  );

  if (rows && rows.length > 0) {
    const res = mapRowToPermissions(rows[0], companyId);
    companyPermissionsCache.set(companyId, { permissions: res, expiresAt: Date.now() + 5000 });
    return res;
  }

  // Insert default full permissions for company
  const id = `cp_${companyId}`;
  await pool.query<ResultSetHeader>(
    `INSERT IGNORE INTO company_permissions (
      id, company_id, module_users, module_products, module_categories, module_sales, 
      module_bills, module_inventory, module_settings
    ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1)`,
    [id, companyId]
  );

  const defaultRes = {
    id,
    companyId,
    ...DEFAULT_DASHBOARD_PERMISSIONS,
  } as CompanyPermissions;
  companyPermissionsCache.set(companyId, { permissions: defaultRes, expiresAt: Date.now() + 5000 });
  return defaultRes;
}

/**
 * Updates module permissions for a company (Super Admin only).
 */
export async function updateCompanyPermissions(
  companyId: string,
  permissions: Partial<CompanyPermissions>
): Promise<boolean> {
  if (!isLocalMySqlMode()) return false;
  await ensureLocalMySqlInitialized();

  let pool = getMysqlPool();
  try {
    const resolved = await resolveCompanyPoolAndContext(companyId);
    pool = resolved.pool;
  } catch (err) {
    // fallback to legacy pool
  }
  const id = `cp_${companyId}`;

  const current = await getCompanyPermissions(companyId);

  const users = permissions.users !== undefined ? (permissions.users ? 1 : 0) : (current.users ? 1 : 0);
  const products = permissions.products !== undefined ? (permissions.products ? 1 : 0) : (current.products ? 1 : 0);
  const categories = permissions.categories !== undefined ? (permissions.categories ? 1 : 0) : (current.categories ? 1 : 0);
  const settings = permissions.settings !== undefined ? (permissions.settings ? 1 : 0) : (current.settings ? 1 : 0);

  // Stocks maps to both module_raw_materials and module_inventory
  const stocksVal = permissions.stocks !== undefined
    ? permissions.stocks
    : (permissions.raw_materials !== undefined ? permissions.raw_materials : (permissions.inventory !== undefined ? permissions.inventory : current.stocks));
  const rawMaterials = stocksVal !== undefined ? (stocksVal ? 1 : 0) : (current.stocks ? 1 : 0);

  // Sales & Bills maps to both module_sales and module_bills
  const salesBillsVal = permissions.sales_and_bills !== undefined
    ? permissions.sales_and_bills
    : (permissions.sales !== undefined ? permissions.sales : permissions.bills);
  const salesAndBills = salesBillsVal !== undefined ? (salesBillsVal ? 1 : 0) : (current.sales_and_bills ? 1 : 0);

  const customersVal = permissions.customers !== undefined ? permissions.customers : permissions.customer;
  const customers = customersVal !== undefined ? (customersVal ? 1 : 0) : (current.customers !== false ? 1 : 0);
  const payments = 1;
  const reports = 1;

  const terminalVal = permissions.terminal !== undefined ? Boolean(permissions.terminal) : (current.terminal !== false);
  const kitchenVal = permissions.kitchen !== undefined ? Boolean(permissions.kitchen) : (current.kitchen !== false);
  const tablesVal = permissions.tables !== undefined ? Boolean(permissions.tables) : (current.tables !== false);
  const companiesVal = permissions.companies !== undefined ? Boolean(permissions.companies) : (current.companies !== false);

  // Capture any custom collection modules
  const knownKeys = new Set([
    'id', 'companyId', 'users', 'products', 'categories', 'settings',
    'terminal', 'kitchen', 'tables', 'companies', 'stocks',
    'raw_materials', 'rawMaterials', 'inventory', 'sales_and_bills', 'sales', 'bills',
    'customers', 'customer', 'updatedAt', 'custom_modules'
  ]);

  const customModules: Record<string, boolean> = { ...(current.custom_modules || {}) };
  customModules.terminal = terminalVal;
  customModules.kitchen = kitchenVal;
  customModules.tables = tablesVal;
  customModules.companies = companiesVal;
  customModules.stocks = stocksVal !== false;

  for (const [k, v] of Object.entries(permissions)) {
    if (!knownKeys.has(k) && typeof v === 'boolean') {
      customModules[k] = v;
    }
  }

  // Check which columns exist in company_permissions table
  const [cols]: any = await pool.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = 'company_permissions'`
  );
  const colNames = new Set(cols.map((c: any) => c.COLUMN_NAME));

  const hasRawMatCol = colNames.has('module_raw_materials');
  const hasCustomCol = colNames.has('custom_modules');
  const hasCustCol = colNames.has('module_customers');
  const hasPayCol = colNames.has('module_payments');
  const hasRepCol = colNames.has('module_reports');

  if (hasCustCol && hasPayCol && hasRepCol && hasRawMatCol && hasCustomCol) {
    await pool.query(
      `INSERT INTO company_permissions (
        id, company_id, module_users, module_products, module_categories,
        module_sales, module_bills, module_customers, module_payments, module_reports,
        module_inventory, module_raw_materials, module_settings, custom_modules
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        module_users = VALUES(module_users),
        module_products = VALUES(module_products),
        module_categories = VALUES(module_categories),
        module_sales = VALUES(module_sales),
        module_bills = VALUES(module_bills),
        module_customers = VALUES(module_customers),
        module_payments = VALUES(module_payments),
        module_reports = VALUES(module_reports),
        module_inventory = VALUES(module_inventory),
        module_raw_materials = VALUES(module_raw_materials),
        module_settings = VALUES(module_settings),
        custom_modules = VALUES(custom_modules)`,
      [
        id,
        companyId,
        users,
        products,
        categories,
        salesAndBills,
        salesAndBills,
        customers,
        payments,
        reports,
        rawMaterials,
        rawMaterials,
        settings,
        JSON.stringify(customModules)
      ]
    );
  } else if (hasRawMatCol && hasCustomCol) {
    await pool.query(
      `INSERT INTO company_permissions (
        id, company_id, module_users, module_products, module_categories,
        module_sales, module_bills, module_inventory, module_raw_materials,
        module_settings, custom_modules
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        module_users = VALUES(module_users),
        module_products = VALUES(module_products),
        module_categories = VALUES(module_categories),
        module_sales = VALUES(module_sales),
        module_bills = VALUES(module_bills),
        module_inventory = VALUES(module_inventory),
        module_raw_materials = VALUES(module_raw_materials),
        module_settings = VALUES(module_settings),
        custom_modules = VALUES(custom_modules)`,
      [
        id,
        companyId,
        users,
        products,
        categories,
        salesAndBills,
        salesAndBills,
        rawMaterials,
        rawMaterials,
        settings,
        JSON.stringify(customModules)
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO company_permissions (
        id, company_id, module_users, module_products, module_categories,
        module_sales, module_bills, module_inventory, module_settings
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        module_users = VALUES(module_users),
        module_products = VALUES(module_products),
        module_categories = VALUES(module_categories),
        module_sales = VALUES(module_sales),
        module_bills = VALUES(module_bills),
        module_inventory = VALUES(module_inventory),
        module_settings = VALUES(module_settings)`,
      [
        id,
        companyId,
        users,
        products,
        categories,
        salesAndBills,
        salesAndBills,
        rawMaterials,
        settings
      ]
    );
  }

  clearCompanyPermissionsCache(companyId);
  return true;
}

/**
 * Server-side authorization check: verifies whether a specific module is enabled
 * for the requested company context.
 * Super Admins are always permitted.
 * Company Admins are strictly blocked if the module is disabled.
 */
export async function assertCompanyModuleEnabled(companyId: string, moduleName: CompanyModule): Promise<void> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: Authentication required.');
  }

  // Super Admin has bypass access
  if (session.role === 'super_admin') {
    return;
  }

  // Company Admin can only access their own company
  if (session.role === 'company_admin') {
    if (session.companyId && session.companyId !== companyId) {
      if (isLocalMySqlMode()) {
        let pool = getMysqlPool();
        try {
          const resolved = await resolveCompanyPoolAndContext(companyId, session);
          pool = resolved.pool;
        } catch (err) {
          // fallback
        }
        const [rows]: any = await pool.query(
          "SELECT id FROM user_companies WHERE user_id = ? AND company_id = ? UNION SELECT id FROM users WHERE id = ? AND company_id = ?",
          [session.userId, companyId, session.userId, companyId]
        );
        if (!rows || rows.length === 0) {
          throw new Error(`Unauthorized: You are not authorized to access company '${companyId}'.`);
        }
      } else {
        throw new Error(`Unauthorized: You are not authorized to access company '${companyId}'.`);
      }
    }
  }

  const permissions = await getCompanyPermissions(companyId);

  let isEnabled = true;

  if (moduleName === 'stocks' || moduleName === 'raw_materials' || moduleName === 'rawMaterials' || moduleName === 'inventory') {
    isEnabled = permissions.stocks !== false && permissions.raw_materials !== false && permissions.inventory !== false;
  } else if (moduleName === 'sales_and_bills' || moduleName === 'sales' || moduleName === 'bills') {
    isEnabled = permissions.sales_and_bills !== false && permissions.sales !== false && permissions.bills !== false;
  } else if (moduleName === 'users' || moduleName === 'user') {
    isEnabled = permissions.users !== false;
  } else if (moduleName === 'customers' || moduleName === 'customer') {
    isEnabled = permissions.customers !== false;
  } else if (moduleName === 'terminal') {
    isEnabled = permissions.terminal !== false;
  } else if (moduleName === 'kitchen') {
    isEnabled = permissions.kitchen !== false;
  } else if (moduleName === 'tables') {
    isEnabled = permissions.tables !== false;
  } else if (moduleName === 'companies') {
    isEnabled = permissions.companies !== false;
  } else if (moduleName in permissions) {
    isEnabled = permissions[moduleName] !== false;
  } else if (permissions.custom_modules && moduleName in permissions.custom_modules) {
    isEnabled = permissions.custom_modules[moduleName] !== false;
  }

  if (!isEnabled) {
    let formatted = moduleName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    if (moduleName === 'inventory' || moduleName === 'raw_materials' || moduleName === 'rawMaterials' || moduleName === 'stocks') {
      formatted = 'Stocks';
    } else if (moduleName === 'sales' || moduleName === 'bills' || moduleName === 'sales_and_bills') {
      formatted = 'Sales & Bills';
    }
    throw new Error(`Access Denied: The '${formatted}' module is currently disabled for this company by the Super Admin.`);
  }
}
