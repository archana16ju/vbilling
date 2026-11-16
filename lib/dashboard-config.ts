export interface DashboardWidgetConfig {
  id: string;
  label: string;
  category: 'kpi' | 'chart' | 'analytics' | 'feed';
  description: string;
  visible: boolean;
  order: number;
}

export interface CompanyDashboardConfig {
  layoutMode: 'compact' | 'comfortable';
  widgets: DashboardWidgetConfig[];
  updatedAt?: string;
}

export const DEFAULT_DASHBOARD_WIDGETS: DashboardWidgetConfig[] = [
  {
    id: 'hero_telemetry',
    label: 'Welcome & Quick Telemetry',
    category: 'analytics',
    description: 'Header greeting, real-time total collections, total bills, and product counts',
    visible: true,
    order: 0,
  },
  {
    id: 'kpi_total_sales',
    label: 'Total Sales',
    category: 'kpi',
    description: 'Overall gross revenue collected across all completed bills',
    visible: true,
    order: 1,
  },
  {
    id: 'kpi_today_sales',
    label: "Today's Sales / Active Period",
    category: 'kpi',
    description: "Revenue collected within the selected time window (today, week, month)",
    visible: true,
    order: 2,
  },
  {
    id: 'kpi_total_orders',
    label: 'Total Orders / Bills',
    category: 'kpi',
    description: 'Count of completed sales receipts and paid orders',
    visible: true,
    order: 3,
  },
  {
    id: 'kpi_pending_orders',
    label: 'Pending Orders / Live Velocity',
    category: 'kpi',
    description: 'Average ticket size and real-time order turnaround velocity',
    visible: true,
    order: 4,
  },
  {
    id: 'kpi_total_products',
    label: 'Total Products',
    category: 'kpi',
    description: 'Catalog size and active menu items count',
    visible: true,
    order: 5,
  },
  {
    id: 'kpi_low_stock',
    label: 'Low Stock Alerts',
    category: 'kpi',
    description: 'Warning indicator for products and raw materials at or below minimum threshold',
    visible: true,
    order: 6,
  },
  {
    id: 'kpi_total_customers',
    label: 'Total Customers / Active Staff',
    category: 'kpi',
    description: 'Customer loyalty members and active cashier staff on shift',
    visible: true,
    order: 7,
  },
  {
    id: 'chart_revenue',
    label: 'Revenue Chart',
    category: 'chart',
    description: 'Hourly rush and daily collections timeline trend graph',
    visible: true,
    order: 8,
  },
  {
    id: 'chart_payment_summary',
    label: 'Payment Summary',
    category: 'chart',
    description: 'Payment distribution donut (Cash, UPI, Credit/Debit Card, Online)',
    visible: true,
    order: 9,
  },
  {
    id: 'chart_sales_overview',
    label: 'Sales Overview & Hourly Rush',
    category: 'analytics',
    description: 'Peak dining hours, order volume concentration, and hourly rush chart',
    visible: true,
    order: 10,
  },
  {
    id: 'table_staff_performance',
    label: 'Top Selling Products & Staff Collections',
    category: 'analytics',
    description: 'Cashier-wise revenue distribution, bill count, and cash reconciliation',
    visible: true,
    order: 11,
  },
  {
    id: 'feed_recent_transactions',
    label: 'Recent Transactions',
    category: 'feed',
    description: 'Live real-time feed of recent billing receipts and payment statuses',
    visible: true,
    order: 12,
  },
  {
    id: 'overview_expenses_tax',
    label: 'Expense & Tax Summary',
    category: 'analytics',
    description: 'Subtotal, total GST/tax, discount deductions, and net revenue breakdown',
    visible: true,
    order: 13,
  },
  {
    id: 'quick_actions_stock',
    label: 'Stock Overview & Quick Actions',
    category: 'analytics',
    description: 'Fast shortcuts for Terminal POS, Add Product, Reports, and Inventory',
    visible: true,
    order: 14,
  },
];

export const DEFAULT_COMPANY_DASHBOARD_CONFIG: CompanyDashboardConfig = {
  layoutMode: 'comfortable',
  widgets: DEFAULT_DASHBOARD_WIDGETS,
};
