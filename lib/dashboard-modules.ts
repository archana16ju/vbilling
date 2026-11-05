/**
 * Shared definitions for Dashboard Collection Modules and Company Permissions.
 * Safe to import in both Client and Server Components (no Node or Next server APIs).
 */

export interface DashboardModuleDefinition {
  key: string;
  label: string;
  desc: string;
  aliases?: string[];
  isCustom?: boolean;
}

export const BASE_DASHBOARD_COLLECTION_MODULES: DashboardModuleDefinition[] = [
  {
    key: 'terminal',
    label: 'Terminal',
    desc: 'POS Billing Terminal, cashier checkout, and order billing',
  },
  {
    key: 'kitchen',
    label: 'Kitchen',
    desc: 'Kitchen Display System (KDS) and live ticket queue',
  },
  {
    key: 'tables',
    label: 'Tables',
    desc: 'Dine-in floor plan, table reservations and seating layout',
  },
  {
    key: 'sales_and_bills',
    label: 'Sales & Bills',
    desc: 'Sales overview, transaction history, and bill generation',
    aliases: ['sales', 'bills', 'sale_and_bills'],
  },
  {
    key: 'delivery',
    label: 'Delivery Management',
    desc: 'Delivery tracking, fleet management, and automatic rider assignment',
    aliases: ['deliveries', 'delivery_persons'],
  },
  {
    key: 'companies',
    label: 'Companies',
    desc: 'Company profile, branch details, and store configuration',
  },
  {
    key: 'products',
    label: 'Products',
    desc: 'Product catalog, pricing, recipes, and food items',
  },
  {
    key: 'stocks',
    label: 'Stocks',
    desc: 'Inventory balance, stock transactions, and material tracking',
    aliases: ['raw_materials', 'rawMaterials', 'inventory'],
  },
  {
    key: 'categories',
    label: 'Categories',
    desc: 'Menu categorization and item groups',
  },
  {
    key: 'add_ons',
    label: 'Add-ons',
    desc: 'Add-on items, modifier groups, and product add-on configuration',
    aliases: ['addons', 'addon_groups'],
  },
  {
    key: 'customers',
    label: 'Customers',
    desc: 'Guest directory, customer profiles, and order history',
    aliases: ['customer'],
  },
  {
    key: 'users',
    label: 'Users',
    desc: 'Cashier, waiter, and staff user management',
    aliases: ['user'],
  },
  {
    key: 'settings',
    label: 'Settings',
    desc: 'Receipt design, printer, and terminal settings',
  },
  {
    key: 'reports',
    label: 'Reports',
    desc: 'Business analytics, sales summaries, and financial reports',
    aliases: ['report'],
  },
];

export const DASHBOARD_COLLECTION_MODULES: DashboardModuleDefinition[] = BASE_DASHBOARD_COLLECTION_MODULES;

export interface CompanyPermissions {
  id?: string;
  companyId: string;
  terminal?: boolean;
  kitchen?: boolean;
  tables?: boolean;
  sales_and_bills: boolean;
  companies?: boolean;
  products: boolean;
  stocks?: boolean;
  categories: boolean;
  customers?: boolean;
  users: boolean;
  settings: boolean;
  reports?: boolean;
  raw_materials?: boolean;
  inventory?: boolean;
  sales?: boolean;
  bills?: boolean;
  custom_modules?: Record<string, boolean>;
  updatedAt?: number;
  [key: string]: any;
}

export const DEFAULT_DASHBOARD_PERMISSIONS: {
  terminal: boolean;
  kitchen: boolean;
  tables: boolean;
  sales_and_bills: boolean;
  companies: boolean;
  products: boolean;
  stocks: boolean;
  categories: boolean;
  customers: boolean;
  users: boolean;
  settings: boolean;
  reports?: boolean;
  raw_materials?: boolean;
  inventory?: boolean;
  sales?: boolean;
  bills?: boolean;
  [key: string]: any;
} = {
  terminal: true,
  kitchen: true,
  tables: true,
  sales_and_bills: true,
  companies: true,
  products: true,
  stocks: true,
  categories: true,
  customers: true,
  users: true,
  settings: true,
  reports: true,
  raw_materials: true,
  inventory: true,
  sales: true,
  bills: true,
  delivery: true,
  add_ons: true,
};
