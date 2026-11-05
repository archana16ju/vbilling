import mysql from "mysql2/promise";
import { getMysqlPool, isLocalMySqlMode } from "./mysql";

export interface Migration {
  version: number;
  name: string;
  up: (conn: mysql.PoolConnection) => Promise<void>;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "001_create_companies_and_user_companies",
    up: async (conn) => {
      // 1. Companies table
      await conn.query(`
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. User-to-Company assignments table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS user_companies (
          id VARCHAR(64) PRIMARY KEY,
          user_id VARCHAR(64) NOT NULL,
          company_id VARCHAR(64) NOT NULL,
          role VARCHAR(50) DEFAULT 'cashier',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_user_company (user_id, company_id),
          INDEX idx_user_companies_uid (user_id),
          INDEX idx_user_companies_cid (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    },
  },
  {
    version: 2,
    name: "002_add_company_isolation_columns",
    up: async (conn) => {
      // Helper to check if column exists
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      // Add company_id to products
      if (!(await columnExists("products", "company_id"))) {
        await conn.query(
          "ALTER TABLE products ADD COLUMN company_id VARCHAR(64) AFTER category_id, ADD INDEX idx_products_company (company_id);"
        );
      }

      // Add company_id to categories
      if (!(await columnExists("categories", "company_id"))) {
        await conn.query(
          "ALTER TABLE categories ADD COLUMN company_id VARCHAR(64) AFTER name, ADD INDEX idx_categories_company (company_id);"
        );
      }

      // Add company_id to sales
      if (!(await columnExists("sales", "company_id"))) {
        await conn.query(
          "ALTER TABLE sales ADD COLUMN company_id VARCHAR(64) AFTER bill_number, ADD INDEX idx_sales_company (company_id);"
        );
      }

      // Add company_id to raw_materials
      if (!(await columnExists("raw_materials", "company_id"))) {
        await conn.query(
          "ALTER TABLE raw_materials ADD COLUMN company_id VARCHAR(64) AFTER name, ADD INDEX idx_raw_materials_company (company_id);"
        );
      }

      // Add company_id to stock_transactions
      if (!(await columnExists("stock_transactions", "company_id"))) {
        await conn.query(
          "ALTER TABLE stock_transactions ADD COLUMN company_id VARCHAR(64) AFTER raw_material_id, ADD INDEX idx_stock_tx_company (company_id);"
        );
      }

      // Add company_id to cash_register
      if (!(await columnExists("cash_register", "company_id"))) {
        await conn.query(
          "ALTER TABLE cash_register ADD COLUMN company_id VARCHAR(64) AFTER bill_number, ADD INDEX idx_cash_reg_company (company_id);"
        );
      }
    },
  },
  {
    version: 3,
    name: "003_create_customers_and_payments",
    up: async (conn) => {
      // Customers table
      await conn.query(`
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // Payments table
      await conn.query(`
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
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    },
  },
  {
    version: 4,
    name: "004_users_and_seed_defaults",
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      if (!(await columnExists("users", "username"))) {
        await conn.query("ALTER TABLE users ADD COLUMN username VARCHAR(255) UNIQUE AFTER name");
      }
      if (!(await columnExists("users", "password"))) {
        await conn.query("ALTER TABLE users ADD COLUMN password VARCHAR(255) AFTER password_hash");
      }
      if (!(await columnExists("users", "shortcuts"))) {
        await conn.query("ALTER TABLE users ADD COLUMN shortcuts JSON AFTER role");
      }

      // Allow email and password_hash to be NULL
      await conn.query("ALTER TABLE users MODIFY COLUMN email VARCHAR(255) NULL");
      await conn.query("ALTER TABLE users MODIFY COLUMN password_hash VARCHAR(255) NULL");

      // Seed default company if none exists
      const defaultCompanyId = "comp_default";
      const [existingCompanies]: any = await conn.query("SELECT id FROM companies WHERE id = ?", [defaultCompanyId]);
      if (existingCompanies.length === 0) {
        await conn.query(`
          INSERT INTO companies (id, name, code, address, phone, email, currency, is_active)
          VALUES (?, 'Primary Store', 'MAIN', '123 Main Street', '9876543210', 'store@example.com', 'INR', 1)
        `, [defaultCompanyId]);
      }

      // Seed admin user
      const [adminRows]: any = await conn.query("SELECT id FROM users WHERE username = 'admin' OR id = 'u1'");
      let adminId = "u1";
      if (adminRows.length === 0) {
        await conn.query(`
          INSERT INTO users (id, name, username, email, password, role, is_active)
          VALUES ('u1', 'Administrator', 'admin', 'admin@local.test', 'admin', 'admin', 1)
        `);
      } else {
        adminId = adminRows[0].id;
        await conn.query(`
          UPDATE users SET username = 'admin', email = 'admin@local.test', password = 'admin', role = 'admin', is_active = 1 WHERE id = ?
        `, [adminId]);
      }

      // Seed cashier user
      const [cashierRows]: any = await conn.query("SELECT id FROM users WHERE username = 'cashier' OR id = 'u2'");
      let cashierId = "u2";
      if (cashierRows.length === 0) {
        await conn.query(`
          INSERT INTO users (id, name, username, email, password, role, is_active)
          VALUES ('u2', 'Cashier User', 'cashier', 'cashier@local.test', 'cashier', 'cashier123', 'cashier', 1)
        `);
      } else {
        cashierId = cashierRows[0].id;
        await conn.query(`
          UPDATE users SET username = 'cashier', email = 'cashier@local.test', password = 'cashier123', role = 'cashier', is_active = 1 WHERE id = ?
        `, [cashierId]);
      }

      // Assign admin and cashier to default company
      await conn.query(`
        INSERT IGNORE INTO user_companies (id, user_id, company_id, role)
        VALUES 
          ('uc_admin_default', ?, ?, 'admin'),
          ('uc_cashier_default', ?, ?, 'cashier')
      `, [adminId, defaultCompanyId, cashierId, defaultCompanyId]);

      // Assign existing products, categories, sales, raw_materials without company_id to defaultCompanyId
      await conn.query("UPDATE products SET company_id = ? WHERE company_id IS NULL OR company_id = ''", [defaultCompanyId]);
      await conn.query("UPDATE categories SET company_id = ? WHERE company_id IS NULL OR company_id = ''", [defaultCompanyId]);
      await conn.query("UPDATE sales SET company_id = ? WHERE company_id IS NULL OR company_id = ''", [defaultCompanyId]);
      await conn.query("UPDATE raw_materials SET company_id = ? WHERE company_id IS NULL OR company_id = ''", [defaultCompanyId]);
      await conn.query("UPDATE stock_transactions SET company_id = ? WHERE company_id IS NULL OR company_id = ''", [defaultCompanyId]);
      await conn.query("UPDATE cash_register SET company_id = ? WHERE company_id IS NULL OR company_id = ''", [defaultCompanyId]);
    },
  },
  {
    version: 5,
    name: "005_standardize_database_collation",
    up: async (conn) => {
      const tablesToAlign = [
        "companies",
        "user_companies",
        "cash_register",
        "customers",
        "payments",
        "stock_transactions",
        "_migrations",
      ];
      for (const table of tablesToAlign) {
        try {
          await conn.query(
            `ALTER TABLE ${table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`
          );
        } catch (e: any) {
          console.warn(`Warning converting collation for table ${table}:`, e.message);
        }
      }
    },
  },
  {
    version: 6,
    name: "006_superadmin_company_admin_and_permissions",
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      // 1. Add company_id to users if not present
      if (!(await columnExists("users", "company_id"))) {
        await conn.query("ALTER TABLE users ADD COLUMN company_id VARCHAR(64) NULL AFTER role, ADD INDEX idx_users_company (company_id)");
      }

      // 2. Migrate legacy 'admin' roles to 'company_admin'
      await conn.query("UPDATE users SET role = 'company_admin' WHERE role = 'admin'");
      await conn.query("UPDATE user_companies SET role = 'company_admin' WHERE role = 'admin'");

      // 3. Create company_permissions table for module-level enable/disable
      await conn.query(`
        CREATE TABLE IF NOT EXISTS company_permissions (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL UNIQUE,
          module_users TINYINT(1) DEFAULT 1,
          module_products TINYINT(1) DEFAULT 1,
          module_categories TINYINT(1) DEFAULT 1,
          module_sales TINYINT(1) DEFAULT 1,
          module_bills TINYINT(1) DEFAULT 1,
          module_customers TINYINT(1) DEFAULT 1,
          module_payments TINYINT(1) DEFAULT 1,
          module_inventory TINYINT(1) DEFAULT 1,
          module_reports TINYINT(1) DEFAULT 1,
          module_settings TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_comp_perm (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 4. Seed default full permissions for all existing companies
      const [allCompanies]: any = await conn.query("SELECT id FROM companies");
      for (const comp of allCompanies) {
        await conn.query(`
          INSERT IGNORE INTO company_permissions (
            id, company_id, module_users, module_products, module_categories, module_sales, 
            module_bills, module_customers, module_payments, module_inventory, module_reports, module_settings
          ) VALUES (?, ?, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1)
        `, [`cp_${comp.id}`, comp.id]);
      }

      // 5. Link existing company-1 user to company-1 if present
      await conn.query(`
        UPDATE users u
        INNER JOIN user_companies uc ON u.id = uc.user_id
        SET u.company_id = uc.company_id
        WHERE u.role = 'company_admin' AND (u.company_id IS NULL OR u.company_id = '')
      `);
    },
  },
  {
    version: 7,
    name: "007_add_raw_materials_and_custom_modules_permissions",
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      if (!(await columnExists("company_permissions", "module_raw_materials"))) {
        await conn.query("ALTER TABLE company_permissions ADD COLUMN module_raw_materials TINYINT(1) DEFAULT 1 AFTER module_inventory");
        await conn.query("UPDATE company_permissions SET module_raw_materials = module_inventory");
      }

      if (!(await columnExists("company_permissions", "custom_modules"))) {
        await conn.query("ALTER TABLE company_permissions ADD COLUMN custom_modules JSON NULL AFTER module_settings");
      }
    },
  },
  {
    version: 8,
    name: "008_ensure_stock_transactions_and_payments_tables",
    up: async (conn) => {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS stock_transactions (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          raw_material_id VARCHAR(64) NOT NULL,
          type VARCHAR(50) NOT NULL,
          quantity_before DECIMAL(12, 3) DEFAULT 0,
          quantity_changed DECIMAL(12, 3) NOT NULL,
          quantity_after DECIMAL(12, 3) DEFAULT 0,
          date BIGINT NOT NULL,
          reason VARCHAR(255),
          reference_id VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_stock_tx_company (company_id),
          INDEX idx_stock_tx_raw_mat (raw_material_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS payments (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          sale_id VARCHAR(64) NOT NULL,
          amount DECIMAL(12, 2) NOT NULL,
          payment_method VARCHAR(50) NOT NULL,
          reference VARCHAR(255),
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_payments_company (company_id),
          INDEX idx_payments_sale (sale_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    },
  },
  {
    version: 9,
    name: "009_add_status_and_reference_to_payments",
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      if (!(await columnExists("payments", "status"))) {
        await conn.query("ALTER TABLE payments ADD COLUMN status VARCHAR(50) DEFAULT 'paid' AFTER amount");
      }
      if (!(await columnExists("payments", "reference_number"))) {
        await conn.query("ALTER TABLE payments ADD COLUMN reference_number VARCHAR(255) NULL AFTER status");
      }
    },
  },
  {
    version: 10,
    name: "010_company_scoped_bill_numbers",
    up: async (conn) => {
      async function indexExists(table: string, indexName: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, indexName]
        );
        return rows.length > 0;
      }

      // 1. Drop global uq_sales_bill_number so companies have independent numbering
      if (await indexExists("sales", "uq_sales_bill_number")) {
        await conn.query("ALTER TABLE sales DROP INDEX uq_sales_bill_number");
      }

      // 2. Add company-scoped unique constraint uq_company_bill (company_id, bill_number)
      if (!(await indexExists("sales", "uq_company_bill"))) {
        await conn.query("ALTER TABLE sales ADD UNIQUE KEY uq_company_bill (company_id, bill_number)");
      }

      // 3. Fix existing sales to start from BILL-201026-001 for each company
      // Company 1: update BILL-201026-002 -> BILL-201026-001
      await conn.query(
        "UPDATE sales SET id = 'comp_1792411565628_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792411565628' AND bill_number = 'BILL-201026-002'"
      );
      await conn.query(
        "UPDATE cash_register SET sale_id = 'comp_1792411565628_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792411565628' AND bill_number = 'BILL-201026-002'"
      );
      await conn.query(
        "UPDATE payments SET sale_id = 'comp_1792411565628_BILL-201026-001', reference_number = 'BILL-201026-001' WHERE company_id = 'comp_1792411565628' AND (sale_id = 'BILL-201026-002' OR reference_number = 'BILL-201026-002')"
      );

      // Company 2: update BILL-201026-003 -> BILL-201026-001
      await conn.query(
        "UPDATE sales SET id = 'comp_1792478189028_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792478189028' AND bill_number = 'BILL-201026-003'"
      );
      await conn.query(
        "UPDATE cash_register SET sale_id = 'comp_1792478189028_BILL-201026-001', bill_number = 'BILL-201026-001' WHERE company_id = 'comp_1792478189028' AND bill_number = 'BILL-201026-003'"
      );
      await conn.query(
        "UPDATE payments SET sale_id = 'comp_1792478189028_BILL-201026-001', reference_number = 'BILL-201026-001' WHERE company_id = 'comp_1792478189028' AND (sale_id = 'BILL-201026-003' OR reference_number = 'BILL-201026-003')"
      );
    },
  },
  {
    version: 11,
    name: "011_format_company_ids_as_comp_0001",
    up: async (conn) => {
      const migrationsMap = [
        { oldId: "comp_1792411565628", newId: "COMP-0001" },
        { oldId: "comp_1792478189028", newId: "COMP-0002" },
      ];

      const tables = [
        "company_permissions",
        "categories",
        "products",
        "raw_materials",
        "stock_transactions",
        "customers",
        "user_companies",
        "users",
      ];

      for (const { oldId, newId } of migrationsMap) {
        await conn.query("UPDATE companies SET id = ? WHERE id = ?", [newId, oldId]);
        for (const t of tables) {
          await conn.query(`UPDATE ${t} SET company_id = ? WHERE company_id = ?`, [newId, oldId]);
        }
        await conn.query(
          "UPDATE sales SET id = CONCAT(?, SUBSTRING(id, LENGTH(?)+1)), company_id = ? WHERE company_id = ?",
          [newId, oldId, newId, oldId]
        );
        await conn.query(
          "UPDATE cash_register SET sale_id = CONCAT(?, SUBSTRING(sale_id, LENGTH(?)+1)), company_id = ? WHERE company_id = ?",
          [newId, oldId, newId, oldId]
        );
        await conn.query(
          "UPDATE payments SET sale_id = CONCAT(?, SUBSTRING(sale_id, LENGTH(?)+1)), company_id = ? WHERE company_id = ?",
          [newId, oldId, newId, oldId]
        );
      }
    },
  },
  {
    version: 12,
    name: "012_add_audit_settings_and_stores_tables",
    up: async (conn) => {
      // 1. Audit logs table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NULL,
          user_id VARCHAR(64) NULL,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(64) NULL,
          details JSON NULL,
          ip_address VARCHAR(45) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_company (company_id),
          INDEX idx_audit_user (user_id),
          INDEX idx_audit_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 2. Company settings table (taxes, receipt formatting, invoice prefix)
      await conn.query(`
        CREATE TABLE IF NOT EXISTS company_settings (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL UNIQUE,
          tax_rate DECIMAL(5,2) DEFAULT 5.00,
          tax_inclusive TINYINT(1) DEFAULT 1,
          invoice_prefix VARCHAR(20) DEFAULT 'BILL',
          receipt_header TEXT NULL,
          receipt_footer TEXT NULL,
          printer_width VARCHAR(10) DEFAULT '80mm',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_settings_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 3. Normalized bill items table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS bill_items (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          sale_id VARCHAR(64) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          quantity DECIMAL(10,3) NOT NULL,
          unit_price DECIMAL(10,2) NOT NULL,
          tax_rate DECIMAL(5,2) DEFAULT 0,
          total DECIMAL(12,2) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_bill_items_company (company_id),
          INDEX idx_bill_items_sale (sale_id),
          INDEX idx_bill_items_product (product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 4. Stores / Branches table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS stores (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) NOT NULL,
          address TEXT NULL,
          phone VARCHAR(50) NULL,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_stores_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // Seed default settings for all existing companies
      const [companies]: any = await conn.query("SELECT id FROM companies");
      for (const comp of companies) {
        await conn.query(`
          INSERT IGNORE INTO company_settings (id, company_id, tax_rate, tax_inclusive, invoice_prefix, receipt_header, receipt_footer)
          VALUES (?, ?, 5.00, 1, 'BILL', 'Thank you for your visit!', 'Please visit again!')
        `, [`cs_${comp.id}`, comp.id]);
      }
    },
  },
  {
    version: 13,
    name: "013_create_bill_sequences_for_atomic_concurrency",
    up: async (conn) => {
      // 1. Bill Sequences table for race-condition-free multi-cashier billing
      await conn.query(`
        CREATE TABLE IF NOT EXISTS bill_sequences (
          company_id VARCHAR(64) NOT NULL,
          date_prefix VARCHAR(10) NOT NULL,
          last_seq INT UNSIGNED NOT NULL DEFAULT 0,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (company_id, date_prefix)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 2. Pre-populate sequences from existing sales table to maintain continuous numbering
      const [salesRows]: any = await conn.query(`
        SELECT COALESCE(company_id, 'COMP-0001') AS company_id, bill_number 
        FROM sales 
        WHERE bill_number IS NOT NULL
      `);

      const highestPerKey = new Map<string, { companyId: string; datePrefix: string; maxSeq: number }>();

      for (const row of salesRows) {
        const compId = row.company_id || 'COMP-0001';
        const parts = (row.bill_number || '').split('-');
        if (parts.length >= 3 && parts[0] === 'BILL') {
          const datePrefix = parts[1];
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq)) {
            const key = `${compId}_${datePrefix}`;
            const existing = highestPerKey.get(key);
            if (!existing || seq > existing.maxSeq) {
              highestPerKey.set(key, { companyId: compId, datePrefix, maxSeq: seq });
            }
          }
        }
      }

      for (const val of highestPerKey.values()) {
        if (!val.companyId) continue;
        await conn.query(`
          INSERT INTO bill_sequences (company_id, date_prefix, last_seq)
          VALUES (?, ?, ?)
          ON DUPLICATE KEY UPDATE last_seq = GREATEST(last_seq, VALUES(last_seq))
        `, [val.companyId, val.datePrefix, val.maxSeq]);
      }
    },
  },
  {
    version: 14,
    name: 'add_order_type_to_sales',
    up: async (conn) => {
      const [cols]: any = await conn.query('DESCRIBE sales');
      const hasOrderType = cols.some((c: any) => c.Field === 'order_type');
      if (!hasOrderType) {
        await conn.query("ALTER TABLE sales ADD COLUMN order_type VARCHAR(50) DEFAULT 'Dine In' AFTER customer_name");
      }
    },
  },
  {
    version: 15,
    name: 'add_extended_raw_materials_fields',
    up: async (conn) => {
      const [cols]: any = await conn.query('DESCRIBE raw_materials');
      const existing = new Set(cols.map((c: any) => c.Field));

      if (!existing.has('purchase_unit')) {
        await conn.query("ALTER TABLE raw_materials ADD COLUMN purchase_unit VARCHAR(50) DEFAULT NULL AFTER unit");
      }
      if (!existing.has('conversion_factor')) {
        await conn.query("ALTER TABLE raw_materials ADD COLUMN conversion_factor DECIMAL(10,4) DEFAULT 1.0 AFTER purchase_unit");
      }
      if (!existing.has('category')) {
        await conn.query("ALTER TABLE raw_materials ADD COLUMN category VARCHAR(100) DEFAULT NULL AFTER name");
      }
      if (!existing.has('supplier_name')) {
        await conn.query("ALTER TABLE raw_materials ADD COLUMN supplier_name VARCHAR(255) DEFAULT NULL AFTER cost_per_unit");
      }
      if (!existing.has('shelf_life_days')) {
        await conn.query("ALTER TABLE raw_materials ADD COLUMN shelf_life_days INT DEFAULT NULL AFTER supplier_name");
      }
    },
  },
  {
    version: 16,
    name: 'add_order_note_and_customer_phone_to_sales',
    up: async (conn) => {
      const [cols]: any = await conn.query('DESCRIBE sales');
      const existing = new Set(cols.map((c: any) => c.Field));

      if (!existing.has('order_note')) {
        await conn.query("ALTER TABLE sales ADD COLUMN order_note TEXT DEFAULT NULL AFTER order_type");
      }
      if (!existing.has('customer_phone')) {
        await conn.query("ALTER TABLE sales ADD COLUMN customer_phone VARCHAR(50) DEFAULT NULL AFTER customer_name");
      }
    },
  },
  {
    version: 17,
    name: '017_create_registered_modules_table',
    up: async (conn) => {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS registered_modules (
          key_name VARCHAR(64) PRIMARY KEY,
          label VARCHAR(255) NOT NULL,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);
    },
  },
  {
    version: 18,
    name: '018_create_suppliers_and_purchase_orders',
    up: async (conn) => {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS suppliers (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          email VARCHAR(255),
          address TEXT,
          balance_owed DECIMAL(12,2) DEFAULT 0.00,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_suppliers_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS purchase_orders (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          supplier_id VARCHAR(64) NOT NULL,
          supplier_name VARCHAR(255) NOT NULL,
          order_date DATE NOT NULL,
          total_amount DECIMAL(12,2) DEFAULT 0.00,
          paid_amount DECIMAL(12,2) DEFAULT 0.00,
          owed_amount DECIMAL(12,2) DEFAULT 0.00,
          state VARCHAR(50) DEFAULT 'Delivered',
          items_json TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_po_company (company_id),
          INDEX idx_po_supplier (supplier_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    },
  },
  {
    version: 19,
    name: '019_create_delivery_persons_and_deliveries',
    up: async (conn) => {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS delivery_persons (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          employee_id VARCHAR(100) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          is_active TINYINT(1) DEFAULT 1,
          availability_status VARCHAR(20) DEFAULT 'available',
          assigned_delivery_count INT DEFAULT 0,
          max_active_deliveries INT DEFAULT 3,
          last_assigned_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_dp_company (company_id),
          INDEX idx_dp_availability (company_id, is_active, availability_status),
          UNIQUE KEY uq_dp_company_emp (company_id, employee_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          bill_id VARCHAR(64) NOT NULL,
          customer_name VARCHAR(255) NOT NULL,
          customer_phone VARCHAR(50) NOT NULL,
          delivery_address TEXT NOT NULL,
          delivery_person_id VARCHAR(64) NULL,
          delivery_status VARCHAR(50) DEFAULT 'pending',
          assignment_status VARCHAR(50) DEFAULT 'unassigned',
          order_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_at TIMESTAMP NULL,
          picked_up_at TIMESTAMP NULL,
          delivered_at TIMESTAMP NULL,
          delivery_notes TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_deliveries_company (company_id),
          INDEX idx_deliveries_bill (company_id, bill_id),
          INDEX idx_deliveries_person (delivery_person_id),
          INDEX idx_deliveries_status (company_id, delivery_status),
          INDEX idx_deliveries_assignment (company_id, assignment_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    },
  },
  {
    version: 20,
    name: '020_add_company_theme_settings',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      if (!(await columnExists('company_settings', 'theme_config'))) {
        await conn.query(`
          ALTER TABLE company_settings
          ADD COLUMN theme_config JSON NULL AFTER printer_width;
        `);
      }

      await conn.query(`
        CREATE TABLE IF NOT EXISTS system_settings (
          setting_key VARCHAR(100) PRIMARY KEY,
          setting_value JSON NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      await conn.query(`
        INSERT IGNORE INTO system_settings (setting_key, setting_value)
        VALUES (
          'default_theme',
          JSON_OBJECT(
            'id', 'black-cherry',
            'name', 'Black Cherry',
            'gradientStart', '#1F0715',
            'gradientMid', '#701A3B',
            'gradientEnd', '#DB2777',
            'accentColor', '#DB2777',
            'accentHover', '#BE185D',
            'glowColor', 'rgba(219, 39, 119, 0.45)',
            'activeBorderColor', '#DB2777',
            'badgeBg', 'rgba(219, 39, 119, 0.15)',
            'badgeText', '#F472B6'
          )
        );
      `);
    },
  },
  {
    version: 21,
    name: '021_create_attendance_shifts_expenses_and_extend_audit_logs',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      // 1. Attendance table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS attendance (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          branch_id VARCHAR(64) NULL,
          user_id VARCHAR(64) NOT NULL,
          date DATE NOT NULL,
          clock_in TIMESTAMP NOT NULL,
          clock_out TIMESTAMP NULL,
          working_hours DECIMAL(6,2) DEFAULT 0.00,
          status VARCHAR(20) DEFAULT 'Present',
          notes TEXT NULL,
          corrected_by VARCHAR(64) NULL,
          correction_reason TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_att_company (company_id),
          INDEX idx_att_user (user_id),
          INDEX idx_att_date (date),
          INDEX idx_att_company_user_date (company_id, user_id, date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Shifts table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS shifts (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          branch_id VARCHAR(64) NULL,
          terminal_id VARCHAR(64) NULL,
          cashier_id VARCHAR(64) NOT NULL,
          opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          closed_at TIMESTAMP NULL,
          opening_cash DECIMAL(12,2) DEFAULT 0.00,
          expected_closing_cash DECIMAL(12,2) DEFAULT 0.00,
          counted_closing_cash DECIMAL(12,2) DEFAULT 0.00,
          cash_sales DECIMAL(12,2) DEFAULT 0.00,
          cash_refunds DECIMAL(12,2) DEFAULT 0.00,
          cash_paid_in DECIMAL(12,2) DEFAULT 0.00,
          cash_paid_out DECIMAL(12,2) DEFAULT 0.00,
          closing_difference DECIMAL(12,2) DEFAULT 0.00,
          status VARCHAR(30) DEFAULT 'Open',
          closing_notes TEXT NULL,
          closed_by_user_id VARCHAR(64) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_shifts_company (company_id),
          INDEX idx_shifts_cashier (cashier_id),
          INDEX idx_shifts_status (company_id, status),
          INDEX idx_shifts_opened (opened_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 3. Add shift_id to sales and cash_register
      if (!(await columnExists("sales", "shift_id"))) {
        await conn.query("ALTER TABLE sales ADD COLUMN shift_id VARCHAR(64) NULL AFTER company_id, ADD INDEX idx_sales_shift (shift_id);");
      }
      if (!(await columnExists("cash_register", "shift_id"))) {
        await conn.query("ALTER TABLE cash_register ADD COLUMN shift_id VARCHAR(64) NULL AFTER company_id, ADD INDEX idx_cash_reg_shift (shift_id);");
      }

      // 4. Expenses table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS expenses (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          branch_id VARCHAR(64) NULL,
          expense_date DATE NOT NULL,
          category VARCHAR(50) NOT NULL,
          description TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          payment_method VARCHAR(50) DEFAULT 'Cash',
          payment_reference VARCHAR(100) NULL,
          recorded_by_user_id VARCHAR(64) NOT NULL,
          approved_by_user_id VARCHAR(64) NULL,
          supplier_id VARCHAR(64) NULL,
          attachment_url TEXT NULL,
          status VARCHAR(20) DEFAULT 'Pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_expenses_company (company_id),
          INDEX idx_expenses_category (company_id, category),
          INDEX idx_expenses_date (expense_date),
          INDEX idx_expenses_status (company_id, status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 5. Extend and align audit_logs
      await conn.query(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NULL,
          branch_id VARCHAR(64) NULL,
          user_id VARCHAR(64) NULL,
          terminal_id VARCHAR(64) NULL,
          action VARCHAR(50) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(64) NULL,
          details JSON NULL,
          ip_address VARCHAR(45) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_audit_company (company_id),
          INDEX idx_audit_user (user_id),
          INDEX idx_audit_created (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      if (!(await columnExists("audit_logs", "branch_id"))) {
        await conn.query("ALTER TABLE audit_logs ADD COLUMN branch_id VARCHAR(64) NULL AFTER company_id");
      }
      if (!(await columnExists("audit_logs", "terminal_id"))) {
        await conn.query("ALTER TABLE audit_logs ADD COLUMN terminal_id VARCHAR(64) NULL AFTER user_id");
      }
      try {
        await conn.query("ALTER TABLE audit_logs CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
      } catch (err: any) {
        console.warn('audit_logs collation alignment notice:', err.message);
      }
    },
  },
  {
    version: 22,
    name: '022_create_staff_collection_and_salaries',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      // 1. Staff table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS staff (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          branch_id VARCHAR(64) NULL,
          user_id VARCHAR(64) NULL,
          name VARCHAR(255) NOT NULL,
          username VARCHAR(100) NULL,
          role VARCHAR(100) DEFAULT 'Cashier',
          phone VARCHAR(50) NULL,
          pay_type VARCHAR(50) DEFAULT 'Monthly',
          base_amount DECIMAL(12,2) DEFAULT 0.00,
          allowances JSON NULL,
          deductions JSON NULL,
          include_in_payroll TINYINT(1) DEFAULT 1,
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_staff_company (company_id),
          INDEX idx_staff_user (user_id),
          INDEX idx_staff_active (company_id, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);

      // 2. Enhance attendance table for staff_id and flexible clock_in
      if (!(await columnExists("attendance", "staff_id"))) {
        await conn.query("ALTER TABLE attendance ADD COLUMN staff_id VARCHAR(64) NULL AFTER user_id, ADD INDEX idx_attendance_staff (staff_id)");
      }
      if (!(await columnExists("attendance", "mark_code"))) {
        await conn.query("ALTER TABLE attendance ADD COLUMN mark_code VARCHAR(10) NULL AFTER status");
      }
      try {
        await conn.query("ALTER TABLE attendance MODIFY COLUMN user_id VARCHAR(64) NULL");
      } catch (err: any) {
        console.warn('attendance user_id nullability notice:', err.message);
      }
      try {
        await conn.query("ALTER TABLE attendance MODIFY COLUMN clock_in DATETIME NULL");
      } catch (err: any) {
        console.warn('attendance clock_in modification notice:', err.message);
      }
    },
  },
  {
    version: 23,
    name: '023_standardize_all_collations_utf8mb4_0900_ai_ci',
    up: async (conn) => {
      try {
        await conn.query('ALTER DATABASE local_billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
      } catch (err: any) {
        console.warn('Database collation alteration notice:', err.message);
      }
      const [tables]: any = await conn.query(
        "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_TYPE = 'BASE TABLE'"
      );
      for (const t of tables) {
        try {
          await conn.query(`ALTER TABLE \`${t.TABLE_NAME}\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
        } catch (err: any) {
          console.warn(`Collation conversion notice for ${t.TABLE_NAME}:`, err.message);
        }
      }
    },
  },
  {
    version: 24,
    name: '024_delivery_online_orders_and_tracking',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      async function indexExists(table: string, indexName: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, indexName]
        );
        return rows.length > 0;
      }

      // 1. Deliveries table extensions
      if (!(await columnExists('deliveries', 'order_source'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN order_source VARCHAR(50) DEFAULT 'Terminal' AFTER bill_id");
      }
      if (!(await columnExists('deliveries', 'online_order_id'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN online_order_id VARCHAR(100) NULL AFTER order_source");
      }
      if (!(await columnExists('deliveries', 'tracking_token'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN tracking_token VARCHAR(64) NULL AFTER online_order_id");
      }
      if (!(await columnExists('deliveries', 'status_history'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN status_history JSON NULL AFTER delivery_notes");
      }
      if (!(await columnExists('deliveries', 'latitude'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN latitude DECIMAL(10, 7) NULL AFTER status_history");
      }
      if (!(await columnExists('deliveries', 'longitude'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN longitude DECIMAL(10, 7) NULL AFTER latitude");
      }
      if (!(await columnExists('deliveries', 'location_updated_at'))) {
        await conn.query("ALTER TABLE deliveries ADD COLUMN location_updated_at TIMESTAMP NULL AFTER longitude");
      }

      if (!(await indexExists('deliveries', 'idx_deliveries_source'))) {
        await conn.query('ALTER TABLE deliveries ADD INDEX idx_deliveries_source (company_id, order_source)');
      }
      if (!(await indexExists('deliveries', 'idx_deliveries_online_id'))) {
        await conn.query('ALTER TABLE deliveries ADD INDEX idx_deliveries_online_id (company_id, online_order_id)');
      }
      if (!(await indexExists('deliveries', 'idx_deliveries_token'))) {
        await conn.query('ALTER TABLE deliveries ADD INDEX idx_deliveries_token (tracking_token)');
      }
      if (!(await indexExists('deliveries', 'uq_deliveries_company_bill'))) {
        try {
          await conn.query('ALTER TABLE deliveries ADD UNIQUE KEY uq_deliveries_company_bill (company_id, bill_id)');
        } catch {}
      }

      // 2. Sales table extensions
      if (!(await columnExists('sales', 'order_source'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN order_source VARCHAR(50) DEFAULT 'Terminal' AFTER order_type");
      }
      if (!(await columnExists('sales', 'online_order_id'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN online_order_id VARCHAR(100) NULL AFTER order_source");
      }
      if (!(await indexExists('sales', 'idx_sales_source'))) {
        await conn.query('ALTER TABLE sales ADD INDEX idx_sales_source (company_id, order_source)');
      }
      if (!(await indexExists('sales', 'idx_sales_online_order_id'))) {
        await conn.query('ALTER TABLE sales ADD INDEX idx_sales_online_order_id (company_id, online_order_id)');
      }

      // 3. Online order configs table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS online_order_configs (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          display_name VARCHAR(100) NOT NULL,
          is_enabled TINYINT(1) DEFAULT 0,
          api_key VARCHAR(255) NULL,
          api_secret VARCHAR(255) NULL,
          store_id VARCHAR(100) NULL,
          webhook_secret VARCHAR(255) NULL,
          auto_accept TINYINT(1) DEFAULT 1,
          connection_status VARCHAR(50) DEFAULT 'disconnected',
          last_sync_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_platform_company (company_id, platform),
          INDEX idx_ooc_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);
    },
  },
  {
    version: 20,
    name: "020_taxes_and_charges",
    up: async (conn) => {
      // 1. Taxes table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS taxes (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          rate DECIMAL(5,2) NOT NULL DEFAULT 2.50,
          applies_to VARCHAR(100) DEFAULT 'Every bill',
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_taxes_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 2. Charges table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS charges (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(100) NOT NULL,
          type VARCHAR(20) DEFAULT 'percentage',
          value DECIMAL(10,2) NOT NULL DEFAULT 5.00,
          applies_to VARCHAR(255) DEFAULT 'Dine In',
          is_active TINYINT(1) DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_charges_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // Seed default taxes and charges for all existing companies
      const [companies]: any = await conn.query("SELECT id FROM companies");
      for (const comp of companies) {
        // CGST 2.5%
        await conn.query(`
          INSERT IGNORE INTO taxes (id, company_id, name, rate, applies_to, is_active)
          VALUES (?, ?, 'CGST', 2.50, 'Every bill', 1)
        `, [`tax_cgst_${comp.id}`, comp.id]);

        // SGST 2.5%
        await conn.query(`
          INSERT IGNORE INTO taxes (id, company_id, name, rate, applies_to, is_active)
          VALUES (?, ?, 'SGST', 2.50, 'Every bill', 1)
        `, [`tax_sgst_${comp.id}`, comp.id]);

        // Service charge 5%
        await conn.query(`
          INSERT IGNORE INTO charges (id, company_id, name, type, value, applies_to, is_active)
          VALUES (?, ?, 'Service charge', 'percentage', 5.00, 'Dine In', 1)
        `, [`charge_service_${comp.id}`, comp.id]);

        // Packing ₹10.00
        await conn.query(`
          INSERT IGNORE INTO charges (id, company_id, name, type, value, applies_to, is_active)
          VALUES (?, ?, 'Packing', 'fixed', 10.00, 'Takeaway, Delivery', 1)
        `, [`charge_packing_${comp.id}`, comp.id]);
      }
    },
  },
  {
    version: 25,
    name: '025_add_waiter_role_and_dine_in_orders',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      async function indexExists(table: string, indexName: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [table, indexName]
        );
        return rows.length > 0;
      }

      // 1. Create dine_in_orders table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS dine_in_orders (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          order_number VARCHAR(100) NOT NULL,
          kot_id VARCHAR(64) NULL,
          table_id VARCHAR(64) NULL,
          table_name VARCHAR(100) NOT NULL,
          waiter_id VARCHAR(64) NULL,
          waiter_name VARCHAR(255) NULL,
          guest_count INT DEFAULT 1,
          items JSON NOT NULL,
          total_amount DECIMAL(12,2) DEFAULT 0.00,
          kitchen_status VARCHAR(50) DEFAULT 'PREPARING',
          serving_status VARCHAR(50) DEFAULT 'Pending',
          notes TEXT NULL,
          bill_id VARCHAR(100) NULL,
          created_by VARCHAR(100) DEFAULT 'Cashier',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_dine_in_company (company_id),
          INDEX idx_dine_in_waiter (company_id, waiter_id),
          INDEX idx_dine_in_table (company_id, table_id),
          INDEX idx_dine_in_kitchen_status (kitchen_status),
          INDEX idx_dine_in_serving_status (serving_status)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 2. Enhance sales table with waiter and table fields
      if (!(await columnExists('sales', 'table_id'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN table_id VARCHAR(64) NULL AFTER customer_phone");
      }
      if (!(await columnExists('sales', 'table_name'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN table_name VARCHAR(100) NULL AFTER table_id");
      }
      if (!(await columnExists('sales', 'waiter_id'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN waiter_id VARCHAR(64) NULL AFTER table_name");
      }
      if (!(await columnExists('sales', 'waiter_name'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN waiter_name VARCHAR(255) NULL AFTER waiter_id");
      }
      if (!(await columnExists('sales', 'serving_status'))) {
        await conn.query("ALTER TABLE sales ADD COLUMN serving_status VARCHAR(50) DEFAULT 'Served' AFTER waiter_name");
      }

      if (!(await indexExists('sales', 'idx_sales_waiter'))) {
        await conn.query('ALTER TABLE sales ADD INDEX idx_sales_waiter (company_id, waiter_id)');
      }
      if (!(await indexExists('sales', 'idx_sales_table'))) {
        await conn.query('ALTER TABLE sales ADD INDEX idx_sales_table (company_id, table_id)');
      }
    },
  },
  {
    version: 26,
    name: '026_add_company_shortcuts_and_terminal_design_config',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      if (!(await columnExists('company_settings', 'shortcuts_config'))) {
        await conn.query(`
          ALTER TABLE company_settings
          ADD COLUMN shortcuts_config JSON NULL AFTER theme_config;
        `);
      }

      if (!(await columnExists('company_settings', 'terminal_design'))) {
        await conn.query(`
          ALTER TABLE company_settings
          ADD COLUMN terminal_design JSON NULL AFTER shortcuts_config;
        `);
      }
    },
  },
  {
    version: 27,
    name: '027_create_addons_and_addon_groups',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }

      // 1. Addon items table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS addon_items (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          image VARCHAR(512) NULL,
          price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
          category VARCHAR(100) NULL,
          tax DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          track_stock TINYINT(1) NOT NULL DEFAULT 0,
          stock DECIMAL(10,3) NOT NULL DEFAULT 0.000,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_addon_items_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 2. Addon groups table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS addon_groups (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          name VARCHAR(255) NOT NULL,
          min_selection INT NOT NULL DEFAULT 0,
          max_selection INT NOT NULL DEFAULT 1,
          is_required TINYINT(1) NOT NULL DEFAULT 0,
          selection_type VARCHAR(20) NOT NULL DEFAULT 'multiple',
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_addon_groups_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 3. Addon group items junction table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS addon_group_items (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          group_id VARCHAR(64) NOT NULL,
          addon_id VARCHAR(64) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_group_addon (group_id, addon_id),
          INDEX idx_agi_group (group_id),
          INDEX idx_agi_addon (addon_id),
          INDEX idx_agi_company (company_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 4. Add addon_group_ids JSON to products
      if (!(await columnExists('products', 'addon_group_ids'))) {
        await conn.query(`
          ALTER TABLE products
          ADD COLUMN addon_group_ids JSON NULL AFTER raw_materials_json;
        `);
      }

      // 5. Seed default example items and groups if addon_items is empty
      const [existingItems]: any = await conn.query('SELECT COUNT(*) as count FROM addon_items');
      if (existingItems[0]?.count === 0) {
        const [companies]: any = await conn.query('SELECT id FROM companies');
        for (const comp of companies) {
          const cId = comp.id;
          const sampleAddons = [
            { id: 'add_' + cId + '_sambar', name: 'Sambar', price: 20.00, category: 'Accompaniment', tax: 5.0, track_stock: 0, stock: 0 },
            { id: 'add_' + cId + '_idli_podi', name: 'Idli Podi', price: 10.00, category: 'Accompaniment', tax: 5.0, track_stock: 0, stock: 0 },
            { id: 'add_' + cId + '_coconut_chutney', name: 'Coconut Chutney', price: 10.00, category: 'Chutneys', tax: 5.0, track_stock: 0, stock: 0 },
            { id: 'add_' + cId + '_tomato_chutney', name: 'Tomato Chutney', price: 10.00, category: 'Chutneys', tax: 5.0, track_stock: 0, stock: 0 },
            { id: 'add_' + cId + '_extra_cheese', name: 'Extra Cheese', price: 30.00, category: 'Extras', tax: 5.0, track_stock: 1, stock: 100 },
            { id: 'add_' + cId + '_extra_mayo', name: 'Extra Mayo', price: 15.00, category: 'Extras', tax: 5.0, track_stock: 1, stock: 100 },
          ];

          for (const a of sampleAddons) {
            await conn.query(
              `INSERT IGNORE INTO addon_items (id, company_id, name, price, category, tax, track_stock, stock, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
              [a.id, cId, a.name, a.price, a.category, a.tax, a.track_stock, a.stock]
            );
          }

          const sampleGroups = [
            {
              id: 'grp_' + cId + '_idli',
              name: 'Idli Extras',
              min_selection: 0,
              max_selection: 4,
              is_required: 0,
              selection_type: 'multiple',
              items: ['add_' + cId + '_sambar', 'add_' + cId + '_idli_podi', 'add_' + cId + '_coconut_chutney', 'add_' + cId + '_tomato_chutney']
            },
            {
              id: 'grp_' + cId + '_dosa',
              name: 'Dosa Extras',
              min_selection: 0,
              max_selection: 3,
              is_required: 0,
              selection_type: 'multiple',
              items: ['add_' + cId + '_sambar', 'add_' + cId + '_idli_podi', 'add_' + cId + '_coconut_chutney']
            },
            {
              id: 'grp_' + cId + '_burger',
              name: 'Burger Extras',
              min_selection: 0,
              max_selection: 2,
              is_required: 0,
              selection_type: 'multiple',
              items: ['add_' + cId + '_extra_cheese', 'add_' + cId + '_extra_mayo']
            }
          ];

          for (const g of sampleGroups) {
            await conn.query(
              `INSERT IGNORE INTO addon_groups (id, company_id, name, min_selection, max_selection, is_required, selection_type, is_active)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
              [g.id, cId, g.name, g.min_selection, g.max_selection, g.is_required, g.selection_type]
            );

            for (let i = 0; i < g.items.length; i++) {
              const aId = g.items[i];
              await conn.query(
                `INSERT IGNORE INTO addon_group_items (id, company_id, group_id, addon_id, sort_order)
                 VALUES (?, ?, ?, ?, ?)`,
                ['agi_' + g.id + '_' + aId, cId, g.id, aId, i]
              );
            }
          }
        }
      }
    },
  },
  {
    version: 28,
    name: '028_create_product_barcodes_and_sequences',
    up: async (conn) => {
      // 1. Create product_barcodes table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS product_barcodes (
          id VARCHAR(64) PRIMARY KEY,
          company_id VARCHAR(64) NOT NULL,
          product_id VARCHAR(64) NOT NULL,
          barcode VARCHAR(128) NOT NULL,
          barcode_type ENUM('internal', 'manufacturer') NOT NULL DEFAULT 'internal',
          barcode_format VARCHAR(32) NOT NULL DEFAULT 'CODE128',
          is_primary TINYINT(1) NOT NULL DEFAULT 1,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uq_company_barcode (company_id, barcode),
          INDEX idx_product_barcodes_company_product (company_id, product_id),
          INDEX idx_product_barcodes_barcode (barcode)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 2. Create barcode_sequences table
      await conn.query(`
        CREATE TABLE IF NOT EXISTS barcode_sequences (
          company_id VARCHAR(64) PRIMARY KEY,
          last_internal_number BIGINT NOT NULL DEFAULT 100000,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
      `);

      // 3. Backfill existing products into product_barcodes
      const [existingProducts]: any = await conn.query(`
        SELECT id, company_id, barcode FROM products 
        WHERE barcode IS NOT NULL AND barcode != ''
      `);

      for (const p of existingProducts) {
        try {
          const bCode = String(p.barcode).trim();
          const isNumeric = /^\d{6,}$/.test(bCode);
          const type = isNumeric ? 'internal' : 'manufacturer';
          const format = bCode.length === 13 && /^\d{13}$/.test(bCode)
            ? 'EAN13'
            : bCode.length === 12 && /^\d{12}$/.test(bCode)
            ? 'UPCA'
            : 'CODE128';

          await conn.query(`
            INSERT IGNORE INTO product_barcodes 
            (id, company_id, product_id, barcode, barcode_type, barcode_format, is_primary)
            VALUES (?, ?, ?, ?, ?, ?, 1)
          `, [
            'bc_' + p.id + '_' + Date.now().toString(36),
            p.company_id || 'COMP-0001',
            p.id,
            bCode,
            type,
            format
          ]);
        } catch {}
      }

      // 4. Initialize barcode sequence for each company to start at 100000 (so first generated is 100001)
      const [companies]: any = await conn.query(`SELECT id FROM companies`);
      for (const c of companies) {
        await conn.query(`
          INSERT INTO barcode_sequences (company_id, last_internal_number)
          VALUES (?, 100000)
          ON DUPLICATE KEY UPDATE last_internal_number = GREATEST(last_internal_number, 100000)
        `, [c.id]);
      }
    },
  },
  {
    version: 29,
    name: '029_add_performance_composite_indexes',
    up: async (conn) => {
      const ensureIndex = async (table: string, indexName: string, columnsSql: string) => {
        const [idxs]: any = await conn.query(`SHOW INDEX FROM ${table}`);
        const exists = idxs.some((i: any) => i.Key_name === indexName);
        if (!exists) {
          await conn.query(`ALTER TABLE ${table} ADD INDEX ${indexName} (${columnsSql})`);
        }
      };

      try {
        const [salesIdxs]: any = await conn.query('SHOW INDEX FROM sales');
        if (salesIdxs.some((i: any) => i.Key_name === 'idx_sales_company_status_created')) {
          await conn.query('ALTER TABLE sales DROP INDEX idx_sales_company_status_created');
        }
      } catch {}

      await ensureIndex('sales', 'idx_sales_company_created', 'company_id, created_at DESC');
      await ensureIndex('sales', 'idx_sales_company_user_created', 'company_id, created_by, created_at DESC');
      await ensureIndex('sales', 'idx_sales_company_status', 'company_id, payment_status');
      await ensureIndex('products', 'idx_products_company_stock', 'company_id, stock');
      await ensureIndex('products', 'idx_products_company_name', 'company_id, name');
      await ensureIndex('customers', 'idx_customers_company_phone', 'company_id, phone');
      await ensureIndex('customers', 'idx_customers_company_name', 'company_id, name');
    },
  },
  {
    version: 30,
    name: '030_add_shifts_column_to_staff',
    up: async (conn) => {
      async function columnExists(table: string, column: string): Promise<boolean> {
        const [rows]: any = await conn.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
           WHERE TABLE_SCHEMA = 'local_billing_db' AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
          [table, column]
        );
        return rows.length > 0;
      }
      if (!(await columnExists('staff', 'shifts'))) {
        await conn.query('ALTER TABLE staff ADD COLUMN shifts JSON NULL AFTER deductions');
      }
    },
  },
];

/**
 * Runs pending MySQL migrations safely against local_billing_db only.
 */
export async function runMySqlMigrations(): Promise<{ applied: number; versions: number[] }> {
  if (!isLocalMySqlMode()) {
    throw new Error("Refusing to run MySQL migrations: LOCAL_DB_MODE is not 'mysql' or NODE_ENV is production.");
  }

  const pool = getMysqlPool();
  const conn = await pool.getConnection();

  try {
    // Safety check 1: Verify database name strictly
    const [dbRows]: any = await conn.query("SELECT DATABASE() AS current_db");
    const currentDb = dbRows[0]?.current_db;
    if (currentDb !== "local_billing_db") {
      throw new Error(`CRITICAL SAFETY ERROR: Migrations can only be applied to 'local_billing_db' (found: '${currentDb}')`);
    }

    // Create _migrations table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        version INT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Get applied migrations
    const [appliedRows]: any = await conn.query("SELECT version FROM _migrations");
    const appliedVersions = new Set<number>(appliedRows.map((r: any) => r.version));

    let count = 0;
    const appliedList: number[] = [];

    for (const migration of migrations) {
      if (!appliedVersions.has(migration.version)) {
        console.log(`Applying migration ${migration.version}: ${migration.name}...`);
        await migration.up(conn);
        await conn.query("INSERT INTO _migrations (version, name) VALUES (?, ?)", [
          migration.version,
          migration.name,
        ]);
        count++;
        appliedList.push(migration.version);
        console.log(`Migration ${migration.version} applied successfully.`);
      }
    }

    return { applied: count, versions: appliedList };
  } finally {
    conn.release();
  }
}
