'use server';

import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';

export interface ReportQueryParams {
  reportKey: string;
  preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  customStart?: string;
  customEnd?: string;
  targetCompanyId?: string;
}

export interface ReportCompanyOption {
  id: string;
  name: string;
  code: string;
}

export interface ReportResult {
  reportKey: string;
  preset: string;
  startDate: string;
  endDate: string;
  companyName: string;
  companyId: string;
  isSuperAdmin?: boolean;
  kpis: {
    label: string;
    value: string | number;
    subtext: string;
    trend?: 'up' | 'down' | 'neutral';
    color?: string;
  }[];
  chartData?: any;
  tableData: any[];
  columns: {
    key: string;
    label: string;
    align?: 'left' | 'right' | 'center';
    format?: 'currency' | 'number' | 'date' | 'badge' | 'text';
  }[];
  meta?: {
    totalRecords: number;
    notes?: string;
    limitations?: string;
    isDerived?: boolean;
    isConfigured?: boolean;
    currency?: string;
  };
}

/**
 * Helper to compute [startMs, endMs] and formatted date strings based on preset
 */
function resolveDateRange(
  preset: string,
  customStart?: string,
  customEnd?: string
): { startMs: number; endMs: number; startIso: string; endIso: string; startSql: string; endSql: string } {
  const now = new Date();

  let start = new Date(now);
  let end = new Date(now);

  if (preset === 'today') {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'yesterday') {
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'week') {
    // Current week: from Monday to now
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'custom' && customStart && customEnd) {
    const s = new Date(customStart);
    s.setHours(0, 0, 0, 0);
    const e = new Date(customEnd);
    e.setHours(23, 59, 59, 999);
    start = s;
    end = e;
  } else {
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  const formatSql = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return {
    startMs: start.getTime(),
    endMs: end.getTime(),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    startSql: formatSql(start),
    endSql: formatSql(end),
  };
}

/**
 * Fetches available companies strictly respecting the logged-in user's role.
 * Super Admin gets all active companies; Company Admin gets ONLY their assigned company.
 */
export async function getReportCompanyOptions(): Promise<ReportCompanyOption[]> {
  if (isLocalMySqlMode()) {
    try {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const session = await getSession();
      const cookieStore = await cookies();
      const rawRole = session?.role || cookieStore.get('auth_role')?.value;
      const authRole = rawRole === 'admin' ? 'company_admin' : rawRole;

      // If Company Admin, return ONLY their assigned company context
      if (authRole === 'company_admin') {
        const company = await getAuthorizedCompanyContext();
        return [{ id: company.id, name: company.name, code: company.code }];
      }

      // If Super Admin, return all active companies
      if (authRole === 'super_admin') {
        const [rows] = await pool.query<RowDataPacket[]>(
          'SELECT id, name, code FROM companies WHERE is_active = 1 ORDER BY name ASC'
        );
        return rows.map((r) => ({ id: r.id, name: r.name, code: r.code }));
      }

      return [];
    } catch {
      return [];
    }
  }

  try {
    const db = await getDb();
    const companies = await db.collection('companies').find({ isActive: true }).toArray();
    return companies.map((c) => ({
      id: c.id || c._id.toString(),
      name: c.name || 'Company',
      code: c.code || '',
    }));
  } catch {
    return [];
  }
}

/**
 * Main query engine for all reports across MySQL and MongoDB modes.
 * Enforces company-level isolation and role permission checks.
 */
export async function getReportData(params: ReportQueryParams): Promise<ReportResult> {
  const { reportKey, preset, customStart, customEnd, targetCompanyId } = params;
  const dateRange = resolveDateRange(preset, customStart, customEnd);
  const currencySymbol = '₹';

  // -------------------------------------------------------------
  // Mode 1: Local MySQL Mode (local_billing_db)
  // -------------------------------------------------------------
  if (isLocalMySqlMode()) {
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();
    const session = await getSession();
    const cookieStore = await cookies();
    const rawRole = session?.role || cookieStore.get('auth_role')?.value;
    const authRole = rawRole === 'admin' ? 'company_admin' : rawRole;

    if (authRole === 'cashier') {
      throw new Error('Permission Denied: Cashier accounts cannot view administrative reports.');
    }

    let companyId = '';
    let companyName = 'All Companies';
    const isSuperAdmin = authRole === 'super_admin';

    if (authRole === 'company_admin') {
      const company = await getAuthorizedCompanyContext();
      companyId = company.id;
      companyName = company.name;

      // Check company_permissions.module_reports
      const [permRows] = await pool.query<RowDataPacket[]>(
        'SELECT module_reports FROM company_permissions WHERE company_id = ?',
        [company.id]
      );
      if (permRows.length > 0 && permRows[0].module_reports === 0) {
        throw new Error('Permission Denied: Reports module is disabled for your company.');
      }
    } else if (isSuperAdmin) {
      if (targetCompanyId && targetCompanyId !== 'all') {
        const [compRows] = await pool.query<RowDataPacket[]>('SELECT id, name FROM companies WHERE id = ?', [targetCompanyId]);
        if (compRows.length > 0) {
          companyId = compRows[0].id;
          companyName = compRows[0].name;
        }
      }
    } else {
      const company = await getAuthorizedCompanyContext();
      companyId = company.id;
      companyName = company.name;
    }

    const result = await executeMySqlReport(reportKey, companyId, companyName, dateRange, currencySymbol, pool);
    result.isSuperAdmin = isSuperAdmin;
    return result;
  }

  // -------------------------------------------------------------
  // Mode 2: Live MongoDB Mode
  // -------------------------------------------------------------
  const db = await getDb();
  const cookieStore = await cookies();
  const authCompanyId = targetCompanyId || cookieStore.get('auth_company_id')?.value || '';
  const companyName = 'Store';

  return await executeMongoReport(reportKey, authCompanyId, companyName, dateRange, currencySymbol, db);
}

// =================================================================
// MySQL REPORT ENGINE IMPLEMENTATION
// =================================================================
async function executeMySqlReport(
  reportKey: string,
  companyId: string,
  companyName: string,
  range: ReturnType<typeof resolveDateRange>,
  currency: string,
  pool: ReturnType<typeof getMysqlPool>
): Promise<ReportResult> {
  const compFilter = companyId ? 's.company_id = ? AND' : '';
  const compParams = companyId ? [companyId] : [];

  switch (reportKey) {
    // -------------------------------------------------------------
    // MENU 1: SALES REPORTS
    // -------------------------------------------------------------
    case 'sales_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
                s.payment_method, s.payment_status, s.order_type, s.order_source, s.created_by, s.created_at,
                c.name as company_name
         FROM sales s
         LEFT JOIN companies c ON s.company_id = c.id
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let grossSales = 0;
      let totalDiscounts = 0;
      let totalTax = 0;
      let totalInvoiced = 0;

      const orderTypeMap: Record<string, number> = { 'Dine In': 0, 'Takeaway': 0, 'Delivery': 0 };
      const orderChannelsMap: Record<string, number> = { 'Terminal / POS': 0, 'Zomato': 0, 'Swiggy': 0 };
      const paymentMethodMap: Record<string, number> = { Cash: 0, Card: 0, UPI: 0, 'Bill Only': 0 };
      const dailyMap = new Map<string, { date: string; bills: number; gross: number; discounts: number; tax: number; invoiced: number }>();

      for (const row of salesRows) {
        const subtotal = Number(row.subtotal) || 0;
        const discount = Number(row.discount) || 0;
        const tax = Number(row.tax) || 0;
        const total = Number(row.total) || 0;
        const method = row.payment_method || 'Cash';
        const orderType = row.order_type || 'Dine In';
        const orderSource = row.order_source || 'Terminal';

        grossSales += subtotal;
        totalDiscounts += discount;
        totalTax += tax;
        totalInvoiced += total;

        paymentMethodMap[method] = (paymentMethodMap[method] || 0) + total;
        orderTypeMap[orderType] = (orderTypeMap[orderType] || 0) + total;

        if (orderSource === 'Zomato') {
          orderChannelsMap['Zomato'] = (orderChannelsMap['Zomato'] || 0) + total;
        } else if (orderSource === 'Swiggy') {
          orderChannelsMap['Swiggy'] = (orderChannelsMap['Swiggy'] || 0) + total;
        } else {
          orderChannelsMap['Terminal / POS'] = (orderChannelsMap['Terminal / POS'] || 0) + total;
        }

        const dateStr = new Date(row.created_at).toISOString().split('T')[0];
        const existing = dailyMap.get(dateStr) || { date: dateStr, bills: 0, gross: 0, discounts: 0, tax: 0, invoiced: 0 };
        existing.bills += 1;
        existing.gross += subtotal;
        existing.discounts += discount;
        existing.tax += tax;
        existing.invoiced += total;
        dailyMap.set(dateStr, existing);
      }

      const billCount = salesRows.length;
      const aov = billCount > 0 ? totalInvoiced / billCount : 0;
      const netTaxable = grossSales - totalDiscounts;

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Invoiced Sales', value: `${currency}${totalInvoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `${billCount} bills settled`, color: 'pink' },
          { label: 'Gross Sales (Before Disc)', value: `${currency}${grossSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Discounts: ${currency}${totalDiscounts.toFixed(2)}` },
          { label: 'Net Taxable Value', value: `${currency}${netTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Taxes collected: ${currency}${totalTax.toFixed(2)}` },
          { label: 'Average Order Value (AOV)', value: `${currency}${aov.toFixed(2)}`, subtext: `Across ${billCount} orders` },
        ],
        chartData: {
          orderTypes: orderTypeMap,
          paymentMethods: paymentMethodMap,
          channels: orderChannelsMap,
          dailyTrends: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)),
        },
        columns: [
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'bills', label: 'Bills Count', align: 'center', format: 'number' },
          { key: 'gross', label: 'Gross Sales', align: 'right', format: 'currency' },
          { key: 'discounts', label: 'Discounts', align: 'right', format: 'currency' },
          { key: 'tax', label: 'Taxes (GST)', align: 'right', format: 'currency' },
          { key: 'invoiced', label: 'Net Invoiced', align: 'right', format: 'currency' },
        ],
        tableData: Array.from(dailyMap.values()).sort((a, b) => b.date.localeCompare(a.date)),
        meta: {
          totalRecords: billCount,
          currency,
          notes: 'Sales report reflects actual finalized bills. Cancelled transactions are excluded from revenue.',
        },
      };
    }

    case 'items_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.items, s.created_at
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?`,
        [...compParams, range.startSql, range.endSql]
      );

      const itemsMap = new Map<string, { id: string; name: string; category: string; quantity: number; grossRevenue: number; discount: number; netRevenue: number; ordersCount: number }>();

      let totalQty = 0;
      let totalItemRev = 0;

      for (const row of salesRows) {
        let itemsArr: any[] = [];
        try {
          itemsArr = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
        } catch {
          itemsArr = [];
        }

        for (const item of itemsArr) {
          const p = item.product || {};
          const id = p.id || 'unknown';
          const name = p.name || 'Unnamed Item';
          const cat = p.categoryId || 'General';
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.rate || p.price) || 0;
          const itemGross = qty * rate;
          const discPercent = Number(p.discount) || 0;
          const itemDisc = itemGross * (discPercent / 100);
          const itemNet = itemGross - itemDisc;

          totalQty += qty;
          totalItemRev += itemNet;

          const existing = itemsMap.get(id) || {
            id,
            name,
            category: cat,
            quantity: 0,
            grossRevenue: 0,
            discount: 0,
            netRevenue: 0,
            ordersCount: 0,
          };

          existing.quantity += qty;
          existing.grossRevenue += itemGross;
          existing.discount += itemDisc;
          existing.netRevenue += itemNet;
          existing.ordersCount += 1;
          itemsMap.set(id, existing);
        }
      }

      const sortedItems = Array.from(itemsMap.values()).sort((a, b) => b.quantity - a.quantity);
      const topItem = sortedItems[0]?.name || 'N/A';

      const tableData = sortedItems.map((i, idx) => ({
        rank: idx + 1,
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        avgPrice: i.quantity > 0 ? (i.grossRevenue / i.quantity).toFixed(2) : '0.00',
        grossRevenue: i.grossRevenue,
        discount: i.discount,
        netRevenue: i.netRevenue,
        share: totalItemRev > 0 ? ((i.netRevenue / totalItemRev) * 100).toFixed(1) + '%' : '0%',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Units Sold', value: totalQty.toLocaleString(), subtext: `Across ${sortedItems.length} distinct menu items`, color: 'pink' },
          { label: 'Top Moving Item', value: topItem, subtext: sortedItems[0] ? `${sortedItems[0].quantity} units ordered` : 'No sales' },
          { label: 'Total Product Revenue', value: `${currency}${totalItemRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Net product sales' },
          { label: 'Active Menu Varieties', value: sortedItems.length, subtext: 'Distinct products sold' },
        ],
        columns: [
          { key: 'rank', label: '#', align: 'center', format: 'number' },
          { key: 'name', label: 'Item Name', format: 'text' },
          { key: 'category', label: 'Category', format: 'badge' },
          { key: 'quantity', label: 'Units Sold', align: 'center', format: 'number' },
          { key: 'avgPrice', label: 'Avg Rate', align: 'right', format: 'currency' },
          { key: 'grossRevenue', label: 'Gross Sales', align: 'right', format: 'currency' },
          { key: 'discount', label: 'Discount', align: 'right', format: 'currency' },
          { key: 'netRevenue', label: 'Net Revenue', align: 'right', format: 'currency' },
          { key: 'share', label: 'Sales Share', align: 'right', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: sortedItems.length, currency },
      };
    }

    case 'categories_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.items
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?`,
        [...compParams, range.startSql, range.endSql]
      );

      const [catRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name FROM categories ${companyId ? 'WHERE company_id = ?' : ''}`,
        companyId ? [companyId] : []
      );
      const catNameMap = new Map<string, string>();
      for (const c of catRows) catNameMap.set(c.id, c.name);

      const catStats = new Map<string, { categoryId: string; name: string; quantity: number; revenue: number; billSet: Set<string> }>();
      let totalRev = 0;

      for (const row of salesRows) {
        let items: any[] = [];
        try {
          items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
        } catch {
          items = [];
        }

        for (const item of items) {
          const p = item.product || {};
          const catId = p.categoryId || 'uncategorized';
          const catName = catNameMap.get(catId) || p.categoryName || 'General';
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.rate || p.price) || 0;
          const disc = Number(p.discount) || 0;
          const lineNet = qty * rate * (1 - disc / 100);

          totalRev += lineNet;

          const existing = catStats.get(catId) || {
            categoryId: catId,
            name: catName,
            quantity: 0,
            revenue: 0,
            billSet: new Set<string>(),
          };
          existing.quantity += qty;
          existing.revenue += lineNet;
          existing.billSet.add(row.id);
          catStats.set(catId, existing);
        }
      }

      const tableData = Array.from(catStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((c, idx) => ({
          rank: idx + 1,
          name: c.name,
          quantity: c.quantity,
          billsCount: c.billSet.size,
          revenue: c.revenue,
          share: totalRev > 0 ? ((c.revenue / totalRev) * 100).toFixed(1) + '%' : '0%',
        }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Active Categories', value: tableData.length, subtext: 'Categories with sales in period', color: 'pink' },
          { label: 'Top Grossing Category', value: tableData[0]?.name || 'N/A', subtext: tableData[0] ? `${currency}${Number(tableData[0].revenue).toFixed(2)}` : 'No sales' },
          { label: 'Category Sales Total', value: `${currency}${totalRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Total net menu sales' },
          { label: 'Avg Revenue / Category', value: `${currency}${(tableData.length > 0 ? totalRev / tableData.length : 0).toFixed(2)}`, subtext: 'Category spread' },
        ],
        columns: [
          { key: 'rank', label: '#', align: 'center', format: 'number' },
          { key: 'name', label: 'Category Name', format: 'text' },
          { key: 'billsCount', label: 'Bills Included', align: 'center', format: 'number' },
          { key: 'quantity', label: 'Units Sold', align: 'center', format: 'number' },
          { key: 'revenue', label: 'Total Revenue', align: 'right', format: 'currency' },
          { key: 'share', label: 'Revenue Share', align: 'right', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'item_trends_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.items, DATE(s.created_at) as sale_date
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at ASC`,
        [...compParams, range.startSql, range.endSql]
      );

      const dailyItemMap = new Map<string, { date: string; itemName: string; quantity: number; revenue: number }>();
      const itemTotals = new Map<string, number>();

      for (const row of salesRows) {
        const dateStr = String(row.sale_date).split('T')[0];
        let items: any[] = [];
        try {
          items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
        } catch {
          items = [];
        }

        for (const item of items) {
          const name = item.product?.name || 'Unnamed';
          const qty = Number(item.quantity) || 1;
          const rate = Number(item.rate || item.product?.price) || 0;
          const rev = qty * rate;

          itemTotals.set(name, (itemTotals.get(name) || 0) + qty);

          const key = `${dateStr}__${name}`;
          const existing = dailyItemMap.get(key) || { date: dateStr, itemName: name, quantity: 0, revenue: 0 };
          existing.quantity += qty;
          existing.revenue += rev;
          dailyItemMap.set(key, existing);
        }
      }

      const topItems = Array.from(itemTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map((e) => e[0]);

      const tableData = Array.from(dailyItemMap.values())
        .filter((d) => topItems.includes(d.itemName))
        .sort((a, b) => b.date.localeCompare(a.date) || b.quantity - a.quantity);

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Tracked Top Items', value: topItems.length, subtext: 'Fastest moving product lines', color: 'pink' },
          { label: 'Top Trend Leader', value: topItems[0] || 'N/A', subtext: `${itemTotals.get(topItems[0]) || 0} units across period` },
          { label: 'Daily Data Points', value: tableData.length, subtext: 'Date × item volume entries' },
          { label: 'Analysis Span', value: `${range.startSql.split(' ')[0]} to ${range.endSql.split(' ')[0]}`, subtext: 'Current date window' },
        ],
        columns: [
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'itemName', label: 'Item Name', format: 'text' },
          { key: 'quantity', label: 'Units Sold That Day', align: 'center', format: 'number' },
          { key: 'revenue', label: 'Daily Revenue', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'busy_times_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT HOUR(s.created_at) as order_hour, COUNT(*) as bill_count, SUM(s.total) as total_volume
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?
         GROUP BY HOUR(s.created_at)
         ORDER BY order_hour ASC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalBills = 0;
      let totalSales = 0;
      let peakHourRow: any = null;

      const hourMap = new Map<number, { hour: number; hourLabel: string; bills: number; volume: number }>();
      for (let h = 0; h < 24; h++) {
        const startH = h % 12 || 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const nextH = (h + 1) % 12 || 12;
        const nextAmpm = (h + 1) >= 12 && (h + 1) < 24 ? 'PM' : (h + 1) === 24 ? 'AM' : ampm;
        const hourLabel = `${String(startH).padStart(2, '0')}:00 ${ampm} - ${String(nextH).padStart(2, '0')}:00 ${nextAmpm}`;
        hourMap.set(h, { hour: h, hourLabel, bills: 0, volume: 0 });
      }

      for (const row of salesRows) {
        const h = Number(row.order_hour);
        const b = Number(row.bill_count);
        const v = Number(row.total_volume);

        totalBills += b;
        totalSales += v;

        if (hourMap.has(h)) {
          hourMap.set(h, { ...hourMap.get(h)!, bills: b, volume: v });
        }
        if (!peakHourRow || v > peakHourRow.volume) {
          peakHourRow = { hour: h, bills: b, volume: v, label: hourMap.get(h)?.hourLabel };
        }
      }

      const tableData = Array.from(hourMap.values()).map((h) => ({
        hourLabel: h.hourLabel,
        bills: h.bills,
        volume: h.volume,
        aov: h.bills > 0 ? (h.volume / h.bills).toFixed(2) : '0.00',
        share: totalSales > 0 ? ((h.volume / totalSales) * 100).toFixed(1) + '%' : '0%',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Peak Rush Slot', value: peakHourRow?.label || 'No rush', subtext: peakHourRow ? `${currency}${peakHourRow.volume.toFixed(2)} (${peakHourRow.bills} bills)` : 'No sales', color: 'pink' },
          { label: 'Total Orders Handled', value: totalBills, subtext: `Across 24 operational hours` },
          { label: 'Total Volume', value: `${currency}${totalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Gross rush period revenue' },
          { label: 'Average Sales / Hour', value: `${currency}${(totalSales / 24).toFixed(2)}`, subtext: 'Hourly velocity' },
        ],
        columns: [
          { key: 'hourLabel', label: 'Time Window', format: 'text' },
          { key: 'bills', label: 'Bills Placed', align: 'center', format: 'number' },
          { key: 'volume', label: 'Total Revenue', align: 'right', format: 'currency' },
          { key: 'aov', label: 'Avg Order Value', align: 'right', format: 'currency' },
          { key: 'share', label: 'Share of Daily Sales', align: 'right', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: 24, currency },
      };
    }

    case 'taxes_gst_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.subtotal, s.discount, s.tax, s.round_off, s.total, s.items, s.created_at, s.customer_name
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalTaxable = 0;
      let totalTax = 0;
      let totalCgst = 0;
      let totalSgst = 0;
      let totalInvoiced = 0;

      const slabMap = new Map<number, { rate: number; taxable: number; cgst: number; sgst: number; totalTax: number }>();

      const tableData = salesRows.map((row) => {
        const subtotal = Number(row.subtotal) || 0;
        const discount = Number(row.discount) || 0;
        const taxable = Math.max(0, subtotal - discount);
        const tax = Number(row.tax) || 0;
        const cgst = tax / 2;
        const sgst = tax / 2;
        const total = Number(row.total) || 0;

        totalTaxable += taxable;
        totalTax += tax;
        totalCgst += cgst;
        totalSgst += sgst;
        totalInvoiced += total;

        let items: any[] = [];
        try {
          items = typeof row.items === 'string' ? JSON.parse(row.items) : row.items || [];
        } catch {
          items = [];
        }

        for (const item of items) {
          const rate = Number(item.product?.tax) || 0;
          const lineTaxable = (Number(item.quantity) || 1) * (Number(item.rate || item.product?.price) || 0);
          const lineTax = lineTaxable * (rate / 100);

          const existing = slabMap.get(rate) || { rate, taxable: 0, cgst: 0, sgst: 0, totalTax: 0 };
          existing.taxable += lineTaxable;
          existing.cgst += lineTax / 2;
          existing.sgst += lineTax / 2;
          existing.totalTax += lineTax;
          slabMap.set(rate, existing);
        }

        return {
          billNumber: row.bill_number,
          date: new Date(row.created_at).toISOString().split('T')[0],
          customer: row.customer_name || 'Walk-in',
          taxable: taxable,
          cgst: cgst,
          sgst: sgst,
          totalTax: tax,
          roundOff: Number(row.round_off) || 0,
          total: total,
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total GST Collected', value: `${currency}${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `CGST: ${currency}${totalCgst.toFixed(2)} | SGST: ${currency}${totalSgst.toFixed(2)}`, color: 'pink' },
          { label: 'Total Taxable Turnover', value: `${currency}${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Net turnover subject to GST' },
          { label: 'Central GST (CGST)', value: `${currency}${totalCgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: '50% share' },
          { label: 'State GST (SGST)', value: `${currency}${totalSgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: '50% share' },
        ],
        chartData: {
          slabs: Array.from(slabMap.values()).sort((a, b) => a.rate - b.rate),
        },
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'taxable', label: 'Taxable Value', align: 'right', format: 'currency' },
          { key: 'cgst', label: 'CGST', align: 'right', format: 'currency' },
          { key: 'sgst', label: 'SGST', align: 'right', format: 'currency' },
          { key: 'totalTax', label: 'Total GST', align: 'right', format: 'currency' },
          { key: 'total', label: 'Invoice Total', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    // -------------------------------------------------------------
    // MENU 2: FINANCIAL REPORTS
    // -------------------------------------------------------------
    case 'day_end_z_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
                s.payment_method, s.payment_status, s.created_at, s.created_by
         FROM sales s
         WHERE ${compFilter} s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at ASC`,
        [...compParams, range.startSql, range.endSql]
      );

      const [crRows] = await pool.query<RowDataPacket[]>(
        `SELECT cr.id, cr.type, cr.amount, cr.amount_received, cr.change_given, cr.created_at
         FROM cash_register cr
         WHERE ${compFilter.replace('s.', 'cr.')} cr.created_at >= ? AND cr.created_at <= ?
         ORDER BY cr.created_at ASC`,
        [...compParams, range.startSql, range.endSql]
      );

      let grossSales = 0;
      let totalDiscounts = 0;
      let totalTax = 0;
      let totalCashSales = 0;
      let totalDigitalSales = 0;
      let totalUnsettled = 0;
      let totalCancelled = 0;
      let settledBillsCount = 0;

      for (const s of salesRows) {
        if (s.payment_status === 'cancelled') {
          totalCancelled += Number(s.total) || 0;
          continue;
        }
        settledBillsCount++;
        const sub = Number(s.subtotal) || 0;
        const disc = Number(s.discount) || 0;
        const tax = Number(s.tax) || 0;
        const tot = Number(s.total) || 0;

        grossSales += sub;
        totalDiscounts += disc;
        totalTax += tax;

        if (s.payment_method === 'Cash') totalCashSales += tot;
        else if (s.payment_method === 'Card' || s.payment_method === 'UPI') totalDigitalSales += tot;
        else if (s.payment_method === 'Bill Only' || s.payment_status === 'unpaid') totalUnsettled += tot;
      }

      let totalChangeDispensed = 0;
      for (const cr of crRows) {
        totalChangeDispensed += Number(cr.change_given) || 0;
      }

      const netCashInDrawer = totalCashSales;

      const tableData = [
        { item: 'Total Finalized Invoices', value: settledBillsCount, type: 'count' },
        { item: 'Gross Sales (Before Discounts)', value: grossSales, type: 'currency' },
        { item: 'Total Customer Discounts Given', value: totalDiscounts, type: 'currency' },
        { item: 'Net Sales Revenue', value: grossSales - totalDiscounts, type: 'currency' },
        { item: 'Total GST Tax Collected', value: totalTax, type: 'currency' },
        { item: 'Cash Received in Register', value: totalCashSales, type: 'currency' },
        { item: 'Digital Collections (UPI / Cards)', value: totalDigitalSales, type: 'currency' },
        { item: 'Unsettled / Credit Sales (Bill Only)', value: totalUnsettled, type: 'currency' },
        { item: 'Cancelled Orders (Lost Revenue)', value: totalCancelled, type: 'currency' },
        { item: 'Total Change Dispensed to Customers', value: totalChangeDispensed, type: 'currency' },
        { item: 'Net Expected Cash in Register', value: netCashInDrawer, type: 'currency' },
      ];

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Net Cash in Drawer', value: `${currency}${netCashInDrawer.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `From cash payments`, color: 'pink' },
          { label: 'Total Digital Intake', value: `${currency}${totalDigitalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'UPI / Card payments' },
          { label: 'Settled Invoices', value: settledBillsCount, subtext: `${salesRows.length - settledBillsCount} cancelled` },
          { label: 'Credit / Due Remaining', value: `${currency}${totalUnsettled.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Unsettled bills' },
        ],
        columns: [
          { key: 'item', label: 'Register Accounting Line', format: 'text' },
          { key: 'value', label: 'Calculated Value', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'expenses_profit_report': {
      // 1. Sales revenue
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.items, s.total
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?`,
        [...compParams, range.startSql, range.endSql]
      );

      // 2. Raw materials recipe costing (COGS)
      const [rawMatRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, cost_per_unit FROM raw_materials ${companyId ? 'WHERE company_id = ?' : ''}`,
        companyId ? [companyId] : []
      );
      const rawCostMap = new Map<string, number>();
      for (const r of rawMatRows) rawCostMap.set(r.id, Number(r.cost_per_unit) || 0);

      const [prodRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, raw_materials_json FROM products ${companyId ? 'WHERE company_id = ?' : ''}`,
        companyId ? [companyId] : []
      );
      const prodRecipeMap = new Map<string, any[]>();
      for (const p of prodRows) {
        let rmList: any[] = [];
        try {
          rmList = typeof p.raw_materials_json === 'string' ? JSON.parse(p.raw_materials_json) : p.raw_materials_json || [];
        } catch {
          rmList = [];
        }
        prodRecipeMap.set(p.id, rmList);
      }

      // 3. Actual Operating Expenses from expenses table
      const [expenseRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, expense_date, category, description, amount, payment_method, status
         FROM expenses
         WHERE ${compFilter.replace('s.', '')} expense_date >= ? AND expense_date <= ? AND status IN ('Approved', 'Paid')
         ORDER BY expense_date DESC`,
        [...compParams, range.startSql.split(' ')[0], range.endSql.split(' ')[0]]
      );

      let totalExpenses = 0;
      for (const exp of expenseRows) {
        totalExpenses += Number(exp.amount) || 0;
      }

      // 4. Supplier Purchase Orders (Kept separate from operating expenses)
      const [poRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, supplier_name, total_amount, paid_amount, owed_amount, order_date
         FROM purchase_orders
         WHERE ${compFilter.replace('s.', '')} order_date >= ? AND order_date <= ?`,
        [...compParams, range.startSql.split(' ')[0], range.endSql.split(' ')[0]]
      );
      let totalPOAmount = 0;
      for (const po of poRows) totalPOAmount += Number(po.total_amount) || 0;

      let totalSalesRevenue = 0;
      let totalRecipeCost = 0;
      const productProfits = new Map<string, { name: string; quantity: number; revenue: number; cogs: number; hasRecipe: boolean }>();

      for (const s of salesRows) {
        totalSalesRevenue += Number(s.total) || 0;
        let items: any[] = [];
        try {
          items = typeof s.items === 'string' ? JSON.parse(s.items) : s.items || [];
        } catch {
          items = [];
        }

        for (const item of items) {
          const pId = item.product?.id;
          const pName = item.product?.name || 'Unnamed';
          const qty = Number(item.quantity) || 1;
          const price = Number(item.rate || item.product?.price) || 0;
          const rev = qty * price;

          const recipe = prodRecipeMap.get(pId) || item.product?.rawMaterials || [];
          let unitRecipeCost = 0;

          if (recipe && recipe.length > 0) {
            for (const ing of recipe) {
              const ingCost = rawCostMap.get(ing.materialId || ing.id) || 0;
              const ingQty = Number(ing.quantity || ing.quantityToDeduct) || 0;
              unitRecipeCost += ingCost * ingQty;
            }
          }

          const lineCogs = unitRecipeCost * qty;
          totalRecipeCost += lineCogs;

          const existing = productProfits.get(pId || pName) || {
            name: pName,
            quantity: 0,
            revenue: 0,
            cogs: 0,
            hasRecipe: unitRecipeCost > 0,
          };
          existing.quantity += qty;
          existing.revenue += rev;
          existing.cogs += lineCogs;
          productProfits.set(pId || pName, existing);
        }
      }

      const grossProfit = totalSalesRevenue - totalRecipeCost;
      const netProfit = grossProfit - totalExpenses;
      const grossMargin = totalSalesRevenue > 0 ? (grossProfit / totalSalesRevenue) * 100 : 0;
      const netMargin = totalSalesRevenue > 0 ? (netProfit / totalSalesRevenue) * 100 : 0;

      // Table Data: Combined Product Costing + Category Expenses
      const tableData: any[] = [];

      // Add expense rows
      for (const exp of expenseRows) {
        tableData.push({
          type: 'Operating Expense',
          name: `${exp.category}: ${exp.description}`,
          category: exp.category,
          amount: Number(exp.amount) || 0,
          status: exp.status,
          date: new Date(exp.expense_date).toISOString().split('T')[0],
        });
      }

      // Add product gross margin rows
      for (const p of productProfits.values()) {
        const itemGrossProfit = p.revenue - p.cogs;
        tableData.push({
          type: 'Product Gross Margin',
          name: p.name,
          category: p.hasRecipe ? 'Recipe COGS' : 'No Ingredient Cost',
          amount: itemGrossProfit,
          status: p.revenue > 0 ? ((itemGrossProfit / p.revenue) * 100).toFixed(1) + '%' : '0%',
          date: 'Sales Period',
        });
      }

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Net Operating Profit', value: `${currency}${netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Net Margin: ${netMargin.toFixed(1)}%`, color: 'pink' },
          { label: 'Gross Profit (Rev - COGS)', value: `${currency}${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Gross Margin: ${grossMargin.toFixed(1)}%` },
          { label: 'Actual Operating Expenses', value: `${currency}${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `${expenseRows.length} recorded entries` },
          { label: 'Total Invoiced Revenue', value: `${currency}${totalSalesRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Recipe COGS: ${currency}${totalRecipeCost.toFixed(2)}` },
        ],
        columns: [
          { key: 'type', label: 'Accounting Type', format: 'badge' },
          { key: 'name', label: 'Description / Item', format: 'text' },
          { key: 'category', label: 'Category / Costing', format: 'badge' },
          { key: 'amount', label: 'Financial Impact', align: 'right', format: 'currency' },
          { key: 'status', label: 'Margin / Status', align: 'center', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
        ],
        tableData,
        meta: {
          totalRecords: tableData.length,
          currency,
          notes: 'Gross Profit is computed from sales revenue minus verified ingredient recipe COGS. Net Profit deducts approved operating expenses (rent, electricity, payroll, transport, etc.). Inventory supplier purchases are tracked separately.',
        },
      };
    }

    case 'discounts_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.subtotal, s.discount, s.total, s.created_by, s.customer_name, s.order_note, s.created_at
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.discount > 0 
           AND s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalDiscountAmount = 0;
      let totalDiscountedSubtotal = 0;

      const tableData = salesRows.map((r) => {
        const sub = Number(r.subtotal) || 0;
        const disc = Number(r.discount) || 0;
        const tot = Number(r.total) || 0;
        totalDiscountAmount += disc;
        totalDiscountedSubtotal += sub;

        const discPercent = sub > 0 ? ((disc / sub) * 100).toFixed(1) + '%' : '0%';

        return {
          billNumber: r.bill_number,
          date: new Date(r.created_at).toISOString().split('T')[0],
          customer: r.customer_name || 'Walk-in',
          cashier: r.created_by || 'Cashier',
          subtotal: sub,
          discount: disc,
          discountPercent: discPercent,
          total: tot,
          note: r.order_note || '—',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Discounts Granted', value: `${currency}${totalDiscountAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Across ${tableData.length} bills`, color: 'pink' },
          { label: 'Discounted Bills Count', value: tableData.length, subtext: 'Invoices with discounts' },
          { label: 'Avg Discount Per Bill', value: `${currency}${(tableData.length > 0 ? totalDiscountAmount / tableData.length : 0).toFixed(2)}`, subtext: 'Mean discount allowance' },
          { label: 'Overall Discount Ratio', value: totalDiscountedSubtotal > 0 ? ((totalDiscountAmount / totalDiscountedSubtotal) * 100).toFixed(1) + '%' : '0%', subtext: 'Of discounted bill subtotal' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'cashier', label: 'Cashier', format: 'text' },
          { key: 'subtotal', label: 'Gross Subtotal', align: 'right', format: 'currency' },
          { key: 'discount', label: 'Discount Given', align: 'right', format: 'currency' },
          { key: 'discountPercent', label: 'Disc %', align: 'center', format: 'badge' },
          { key: 'total', label: 'Final Total', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'refunds_report': {
      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Explicit Refunds Issued', value: `${currency}0.00`, subtext: '0 refund transactions', color: 'pink' },
          { label: 'Refund Slips Count', value: 0, subtext: 'No refund records' },
          { label: 'Refund Ledger Status', value: 'Not Configured', subtext: 'Separate refunds table not in schema' },
          { label: 'Reversed Orders', value: 'See Cancellations', subtext: 'Tracked in Cancellations Report' },
        ],
        columns: [
          { key: 'refundId', label: 'Refund Slip #', format: 'badge' },
          { key: 'billNumber', label: 'Original Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'amount', label: 'Refund Amount', align: 'right', format: 'currency' },
          { key: 'method', label: 'Refund Method', format: 'badge' },
          { key: 'status', label: 'Status', format: 'badge' },
        ],
        tableData: [],
        meta: {
          totalRecords: 0,
          currency,
          isConfigured: false,
          notes: 'An explicit customer cash refund ledger is not configured in this database schema. Voided and reversed bills are tracked separately in the Cancellations Report.',
        },
      };
    }

    case 'cancellations_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.subtotal, s.tax, s.total, s.items, s.created_by, s.customer_name, s.order_note, s.created_at
         FROM sales s
         WHERE ${compFilter} s.payment_status = 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalLost = 0;
      let totalCancelledItems = 0;

      const tableData = salesRows.map((r) => {
        const tot = Number(r.total) || 0;
        totalLost += tot;

        let items: any[] = [];
        try {
          items = typeof r.items === 'string' ? JSON.parse(r.items) : r.items || [];
        } catch {
          items = [];
        }
        totalCancelledItems += items.length;

        return {
          billNumber: r.bill_number,
          date: new Date(r.created_at).toISOString().split('T')[0],
          customer: r.customer_name || 'Walk-in',
          cashier: r.created_by || 'Cashier',
          itemCount: items.length,
          total: tot,
          reason: r.order_note || 'Order cancelled before settlement',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Lost Revenue (Cancelled)', value: `${currency}${totalLost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Across ${tableData.length} cancelled bills`, color: 'pink' },
          { label: 'Cancelled Bills Count', value: tableData.length, subtext: 'Invoices voided/cancelled' },
          { label: 'Cancelled Item Lines', value: totalCancelledItems, subtext: 'Dishes/products voided' },
          { label: 'Avg Cancelled Bill Value', value: `${currency}${(tableData.length > 0 ? totalLost / tableData.length : 0).toFixed(2)}`, subtext: 'Mean lost invoice size' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'cashier', label: 'Staff User', format: 'text' },
          { key: 'itemCount', label: 'Items Count', align: 'center', format: 'number' },
          { key: 'total', label: 'Cancelled Value', align: 'right', format: 'currency' },
          { key: 'reason', label: 'Cancellation Reason / Note', format: 'text' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'outstanding_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.total, s.payment_method, s.payment_status, s.customer_name, s.customer_phone, s.created_at,
                COALESCE(SUM(p.amount), 0) as paid_amount
         FROM sales s
         LEFT JOIN payments p ON (p.sale_id COLLATE utf8mb4_unicode_ci = s.id OR p.sale_id COLLATE utf8mb4_unicode_ci = s.bill_number) AND p.status = 'paid'
         WHERE ${compFilter} s.payment_status != 'cancelled'
           AND s.created_at >= ? AND s.created_at <= ?
         GROUP BY s.id
         HAVING s.payment_status = 'unpaid' OR s.payment_method = 'Bill Only' OR paid_amount < s.total
         ORDER BY s.created_at DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalOutstanding = 0;
      let totalBilledCredit = 0;
      let totalCollected = 0;

      const tableData: any[] = [];

      for (const r of salesRows) {
        const billed = Number(r.total) || 0;
        const paid = Number(r.paid_amount) || 0;
        const due = Math.max(0, billed - paid);

        if (due > 0.01) {
          totalOutstanding += due;
          totalBilledCredit += billed;
          totalCollected += paid;

          tableData.push({
            billNumber: r.bill_number,
            date: new Date(r.created_at).toISOString().split('T')[0],
            customerName: r.customer_name || 'Anonymous Customer',
            phone: r.customer_phone || '—',
            billedTotal: billed,
            paidAmount: paid,
            balanceDue: due,
            status: r.payment_status || 'unpaid',
          });
        }
      }

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Outstanding Balance', value: `${currency}${totalOutstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Across ${tableData.length} pending bills`, color: 'pink' },
          { label: 'Unpaid Invoices Count', value: tableData.length, subtext: 'Bills with balance > 0' },
          { label: 'Already Collected Against Dues', value: `${currency}${totalCollected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Partial settlements' },
          { label: 'Original Invoiced Credit', value: `${currency}${totalBilledCredit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Total initial credit extended' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customerName', label: 'Customer Name', format: 'text' },
          { key: 'phone', label: 'Phone', format: 'text' },
          { key: 'billedTotal', label: 'Total Billed', align: 'right', format: 'currency' },
          { key: 'paidAmount', label: 'Paid So Far', align: 'right', format: 'currency' },
          { key: 'balanceDue', label: 'Balance Outstanding', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    // -------------------------------------------------------------
    // MENU 3: OPERATIONS REPORTS
    // -------------------------------------------------------------
    case 'attendance_report': {
      const [attRows] = await pool.query<RowDataPacket[]>(
        `SELECT a.id, a.company_id, a.user_id, a.date, a.clock_in, a.clock_out,
                a.working_hours, a.status, a.notes, a.corrected_by, a.correction_reason,
                COALESCE(u.name, a.user_id) as staff_name,
                COALESCE(u.username, a.user_id) as username,
                COALESCE(u.role, 'staff') as staff_role
         FROM attendance a
         LEFT JOIN users u ON a.user_id = u.id
         WHERE ${compFilter.replace('s.', 'a.')} a.date >= ? AND a.date <= ?
         ORDER BY a.clock_in DESC`,
        [...compParams, range.startSql.split(' ')[0], range.endSql.split(' ')[0]]
      );

      let totalHours = 0;
      let onTimeCount = 0;
      let lateCount = 0;

      const tableData = attRows.map((r) => {
        const hrs = Number(r.working_hours) || 0;
        totalHours += hrs;

        if (r.status === 'Present') onTimeCount++;
        else if (r.status === 'Late') lateCount++;

        return {
          id: r.id,
          staffName: r.staff_name,
          username: r.username,
          role: r.staff_role,
          date: new Date(r.date).toISOString().split('T')[0],
          clockIn: new Date(r.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          clockOut: r.clock_out ? new Date(r.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active (Clocked In)',
          workingHours: `${hrs.toFixed(1)} hrs`,
          status: r.status,
          notes: r.notes || (r.corrected_by ? `Corrected by ${r.corrected_by}: ${r.correction_reason}` : '—'),
        };
      });

      const totalRecords = tableData.length;
      const onTimeRate = totalRecords > 0 ? ((onTimeCount / totalRecords) * 100).toFixed(1) + '%' : '100%';

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Logged Attendance Sessions', value: totalRecords, subtext: `${onTimeCount} present, ${lateCount} late`, color: 'pink' },
          { label: 'Total Working Hours', value: `${totalHours.toFixed(1)} hrs`, subtext: 'Cumulative staff time' },
          { label: 'Average Hours / Shift', value: `${totalRecords > 0 ? (totalHours / totalRecords).toFixed(1) : '0.0'} hrs`, subtext: 'Shift length average' },
          { label: 'On-Time Punctuality Rate', value: onTimeRate, subtext: `${lateCount} late check-ins recorded` },
        ],
        columns: [
          { key: 'staffName', label: 'Staff Member', format: 'text' },
          { key: 'role', label: 'Role', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'clockIn', label: 'Clock In', format: 'text' },
          { key: 'clockOut', label: 'Clock Out', format: 'text' },
          { key: 'workingHours', label: 'Logged Hours', align: 'center', format: 'badge' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
          { key: 'notes', label: 'Notes / Corrections', format: 'text' },
        ],
        tableData,
        meta: {
          totalRecords,
          currency,
          notes: 'Attendance data is verified from actual employee clock-in/clock-out events and authorized corrections in the attendance table.',
        },
      };
    }

    case 'shifts_report': {
      // Query actual cashier shifts table
      const [shiftRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.company_id, s.terminal_id, s.cashier_id, s.opened_at, s.closed_at,
                s.opening_cash, s.expected_closing_cash, s.counted_closing_cash,
                s.cash_sales, s.cash_refunds, s.cash_paid_in, s.cash_paid_out,
                s.closing_difference, s.status, s.closing_notes, s.closed_by_user_id,
                COALESCE(u.name, s.cashier_id) as cashier_name
         FROM shifts s
         LEFT JOIN users u ON (s.cashier_id = u.id OR s.cashier_id = u.username)
         WHERE ${compFilter} s.opened_at >= ? AND s.opened_at <= ?
         ORDER BY s.opened_at DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalOpening = 0;
      let totalCounted = 0;
      let totalExpected = 0;
      let totalDiff = 0;
      let openShifts = 0;
      let closedShifts = 0;

      const tableData = shiftRows.map((s) => {
        const opening = Number(s.opening_cash) || 0;
        const counted = Number(s.counted_closing_cash) || 0;
        const expected = Number(s.expected_closing_cash) || 0;
        const diff = Number(s.closing_difference) || 0;

        totalOpening += opening;
        totalCounted += counted;
        totalExpected += expected;
        totalDiff += diff;

        if (s.status === 'Open') openShifts++;
        else closedShifts++;

        return {
          id: s.id,
          terminal: s.terminal_id || 'TERM-01',
          cashier: s.cashier_name || s.cashier_id,
          openedAt: new Date(s.opened_at).toLocaleString(),
          closedAt: s.closed_at ? new Date(s.closed_at).toLocaleString() : 'Active (Open)',
          openingCash: opening,
          cashSales: Number(s.cash_sales) || 0,
          expectedClosing: expected,
          countedClosing: counted,
          difference: diff,
          status: s.status,
          notes: s.closing_notes || '—',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Recorded Shifts', value: tableData.length, subtext: `${openShifts} active, ${closedShifts} closed`, color: 'pink' },
          { label: 'Counted Cash Drawer', value: `${currency}${totalCounted.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Physical cash verified' },
          { label: 'Expected Cash Drawer', value: `${currency}${totalExpected.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'System expected total' },
          { label: 'Net Cash Variance', value: `${currency}${totalDiff.toFixed(2)}`, subtext: totalDiff === 0 ? 'Perfect reconciliation' : 'Variance recorded' },
        ],
        columns: [
          { key: 'id', label: 'Shift ID', format: 'badge' },
          { key: 'cashier', label: 'Cashier', format: 'text' },
          { key: 'terminal', label: 'Terminal', format: 'badge' },
          { key: 'openedAt', label: 'Opened At', format: 'text' },
          { key: 'closedAt', label: 'Closed At', format: 'text' },
          { key: 'openingCash', label: 'Opening Cash', align: 'right', format: 'currency' },
          { key: 'cashSales', label: 'Cash Sales', align: 'right', format: 'currency' },
          { key: 'expectedClosing', label: 'Expected Cash', align: 'right', format: 'currency' },
          { key: 'countedClosing', label: 'Counted Cash', align: 'right', format: 'currency' },
          { key: 'difference', label: 'Difference', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
        ],
        tableData,
        meta: {
          totalRecords: tableData.length,
          currency,
          notes: 'Shift reports reflect verified records from the shifts table with expected vs physical closing cash reconciliation.',
        },
      };
    }

    case 'staff_report': {
      // 1. Fetch staff definitions for company
      const [staffDirectory] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, user_id, username, role FROM staff ${companyId ? 'WHERE company_id = ?' : ''} ORDER BY name ASC`,
        companyId ? [companyId] : []
      );

      const staffMap = new Map<string, { id: string; name: string; role: string }>();
      for (const st of staffDirectory) {
        if (st.username) staffMap.set(st.username.toLowerCase(), { id: st.id, name: st.name, role: st.role });
        if (st.user_id) staffMap.set(st.user_id.toLowerCase(), { id: st.id, name: st.name, role: st.role });
        if (st.name) staffMap.set(st.name.toLowerCase(), { id: st.id, name: st.name, role: st.role });
      }

      // Also get users in case an admin or cashier user hasn't been mapped yet
      const [userRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, username, name, role FROM users ${companyId ? 'WHERE company_id = ?' : ''}`,
        companyId ? [companyId] : []
      );
      for (const u of userRows) {
        const ukey = (u.username || '').toLowerCase();
        const existing = staffMap.get(ukey);
        const isAdminRole = ['company_admin', 'super_admin', 'admin'].includes((u.role || '').toLowerCase());
        if (!existing) {
          staffMap.set(ukey, { id: u.id, name: u.name || u.username, role: u.role });
        } else if (isAdminRole) {
          staffMap.set(ukey, { id: existing.id, name: existing.name || u.name, role: u.role });
        }
      }

      // Helper to classify role badge
      const formatRoleInfo = (rawRole?: string) => {
        const r = (rawRole || '').toLowerCase().trim();
        if (r === 'company_admin' || r === 'admin') {
          return { role: 'company_admin', label: 'Admin', isAdmin: true };
        }
        if (r === 'super_admin' || r === 'superadmin') {
          return { role: 'super_admin', label: 'Super Admin', isAdmin: true };
        }
        if (r === 'manager') {
          return { role: 'manager', label: 'Manager', isAdmin: false };
        }
        if (r === 'cashier') {
          return { role: 'cashier', label: 'Cashier', isAdmin: false };
        }
        const title = rawRole ? (rawRole.charAt(0).toUpperCase() + rawRole.slice(1)) : 'Cashier';
        return { role: r || 'cashier', label: title, isAdmin: false };
      };

      // 2. Fetch sales by staff in range
      const [salesStaffRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.created_by,
                COUNT(*) as bills_count,
                COUNT(DISTINCT NULLIF(s.customer_name, '')) as distinct_guests,
                SUM(s.subtotal) as gross_sales,
                SUM(s.discount) as total_discounts,
                SUM(s.total) as total_invoiced
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND s.created_at >= ? AND s.created_at <= ?
         GROUP BY s.created_by
         ORDER BY total_invoiced DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      // Aggregate by resolved staff member name
      const aggregated: Record<string, { id: string; name: string; role: string; roleLabel: string; isAdmin: boolean; orders: number; guests: number; sales: number }> = {};

      let totalSalesAll = 0;
      let totalOrdersAll = 0;

      for (const r of salesStaffRows) {
        const creatorKey = (r.created_by || 'cashier').toLowerCase();
        const staffInfo = staffMap.get(creatorKey) || { id: creatorKey, name: r.created_by || 'Cashier', role: 'Cashier' };
        const staffName = staffInfo.name;
        const roleInfo = formatRoleInfo(staffInfo.role);

        if (!aggregated[staffName]) {
          aggregated[staffName] = {
            id: staffInfo.id,
            name: staffName,
            role: roleInfo.role,
            roleLabel: roleInfo.label,
            isAdmin: roleInfo.isAdmin,
            orders: 0,
            guests: 0,
            sales: 0,
          };
        }

        const inv = Number(r.total_invoiced) || 0;
        const cnt = Number(r.bills_count) || 0;
        const gst = Number(r.distinct_guests) || cnt;

        aggregated[staffName].orders += cnt;
        aggregated[staffName].guests += gst > 0 ? gst : cnt;
        aggregated[staffName].sales += inv;

        totalSalesAll += inv;
        totalOrdersAll += cnt;
      }

      const tableData = Object.values(aggregated).map((item) => {
        const percent = totalSalesAll > 0 ? (item.sales / totalSalesAll) * 100 : 0;
        const avg = item.orders > 0 ? item.sales / item.orders : 0;
        return {
          id: item.id,
          staff: item.name,
          name: item.name,
          role: item.role,
          roleLabel: item.roleLabel,
          isAdmin: item.isAdmin,
          orders: item.orders,
          guests: item.guests,
          sales: item.sales,
          averageBill: avg,
          percent: Number(percent.toFixed(1)),
        };
      });

      const staffCount = tableData.length;

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Staff', value: staffCount, subtext: 'Active cashiers & staff', color: 'pink' },
          { label: 'Orders', value: totalOrdersAll, subtext: 'Bills settled in period' },
          { label: 'Sales', value: `${currency}${totalSalesAll.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Total staff sales' },
        ],
        chartData: {
          staffBars: tableData,
          totalSales: totalSalesAll,
          dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        },
        columns: [
          { key: 'staff', label: 'STAFF', format: 'text' },
          { key: 'roleLabel', label: 'ROLE', format: 'badge' },
          { key: 'orders', label: 'ORDERS', align: 'center', format: 'number' },
          { key: 'guests', label: 'GUESTS', align: 'center', format: 'number' },
          { key: 'sales', label: 'SALES', align: 'right', format: 'currency' },
          { key: 'averageBill', label: 'AVERAGE BILL', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'salaries_report': {
      // Query staff salary compensation
      const [staffSalaryRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, role, pay_type, base_amount, allowances, deductions, include_in_payroll
         FROM staff
         ${companyId ? 'WHERE company_id = ?' : ''}
         ORDER BY name ASC`,
        companyId ? [companyId] : []
      );

      // Query actual paid salary expenses in this period
      const [paidExpenses] = await pool.query<RowDataPacket[]>(
        `SELECT SUM(amount) as total_paid
         FROM expenses
         WHERE ${compFilter} category = 'Salary' AND status != 'Rejected'
           AND expense_date >= ? AND expense_date <= ?`,
        [...compParams, range.startSql.split(' ')[0], range.endSql.split(' ')[0]]
      );
      const totalPaidPeriod = Number(paidExpenses[0]?.total_paid) || 0;

      let totalBaseMonthly = 0;
      const tableData = staffSalaryRows.map((s) => {
        const base = Number(s.base_amount) || 0;
        let allowances = 0;
        let deductions = 0;
        try {
          const aArr = typeof s.allowances === 'string' ? JSON.parse(s.allowances) : s.allowances;
          if (Array.isArray(aArr)) allowances = aArr.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);
        } catch { }
        try {
          const dArr = typeof s.deductions === 'string' ? JSON.parse(s.deductions) : s.deductions;
          if (Array.isArray(dArr)) deductions = dArr.reduce((acc: number, item: any) => acc + (Number(item.amount) || 0), 0);
        } catch { }

        const netBase = Math.max(0, base + allowances - deductions);
        totalBaseMonthly += netBase;

        return {
          id: s.id,
          employee: s.name,
          role: s.role || 'Staff',
          payType: s.pay_type || 'Monthly',
          baseSalary: base,
          allowances: allowances,
          deductions: deductions,
          netSalary: netBase,
          status: s.include_in_payroll ? 'Active in Payroll' : 'Excluded',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Enrolled Staff', value: staffSalaryRows.length, subtext: `${staffSalaryRows.length} employee contracts`, color: 'pink' },
          { label: 'Monthly Payroll Commitment', value: `${currency}${totalBaseMonthly.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Base salary commitment' },
          { label: 'Disbursed in Period', value: `${currency}${totalPaidPeriod.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Verified salary expenses' },
          { label: 'Average Staff Compensation', value: `${currency}${staffSalaryRows.length > 0 ? (totalBaseMonthly / staffSalaryRows.length).toFixed(2) : '0.00'}`, subtext: 'Per employee monthly' },
        ],
        columns: [
          { key: 'employee', label: 'Employee', format: 'text' },
          { key: 'role', label: 'Role', format: 'badge' },
          { key: 'payType', label: 'Pay Type', format: 'badge' },
          { key: 'baseSalary', label: 'Base Amount', align: 'right', format: 'currency' },
          { key: 'allowances', label: 'Allowances', align: 'right', format: 'currency' },
          { key: 'deductions', label: 'Deductions', align: 'right', format: 'currency' },
          { key: 'netSalary', label: 'Monthly Net', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'guests_report': {
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.customer_name, s.customer_phone,
                COUNT(*) as visits_count,
                SUM(s.total) as total_spent,
                MIN(s.created_at) as first_visit,
                MAX(s.created_at) as last_visit
         FROM sales s
         WHERE ${compFilter} s.payment_status != 'cancelled' 
           AND (s.customer_name IS NOT NULL OR s.customer_phone IS NOT NULL)
           AND s.created_at >= ? AND s.created_at <= ?
         GROUP BY s.customer_name, s.customer_phone
         ORDER BY total_spent DESC`,
        [...compParams, range.startSql, range.endSql]
      );

      let totalGuestSpent = 0;
      let repeatGuests = 0;

      const tableData = salesRows.map((r, idx) => {
        const spent = Number(r.total_spent) || 0;
        const visits = Number(r.visits_count) || 0;
        totalGuestSpent += spent;
        if (visits > 1) repeatGuests++;

        return {
          rank: idx + 1,
          name: r.customer_name || 'Walk-in Guest',
          phone: r.customer_phone || '—',
          visits: visits,
          totalSpent: spent,
          avgSpend: visits > 0 ? (spent / visits).toFixed(2) : '0.00',
          firstVisit: new Date(r.first_visit).toISOString().split('T')[0],
          lastVisit: new Date(r.last_visit).toISOString().split('T')[0],
        };
      });

      const totalGuests = tableData.length;
      const repeatRate = totalGuests > 0 ? ((repeatGuests / totalGuests) * 100).toFixed(1) + '%' : '0%';

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Identified Guests', value: totalGuests, subtext: 'With recorded name or phone', color: 'pink' },
          { label: 'Repeat Customer Rate', value: repeatRate, subtext: `${repeatGuests} returning customers` },
          { label: 'Total Guest Spend', value: `${currency}${totalGuestSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'From recognized guests' },
          { label: 'Average Spend / Guest', value: `${currency}${(totalGuests > 0 ? totalGuestSpent / totalGuests : 0).toFixed(2)}`, subtext: 'Customer lifetime value in period' },
        ],
        columns: [
          { key: 'rank', label: '#', align: 'center', format: 'number' },
          { key: 'name', label: 'Guest Name', format: 'text' },
          { key: 'phone', label: 'Contact Phone', format: 'text' },
          { key: 'visits', label: 'Visits Count', align: 'center', format: 'number' },
          { key: 'totalSpent', label: 'Total Spent', align: 'right', format: 'currency' },
          { key: 'avgSpend', label: 'Avg Spend / Visit', align: 'right', format: 'currency' },
          { key: 'lastVisit', label: 'Most Recent Visit', format: 'date' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    // -------------------------------------------------------------
    // MENU 4: AUDIT LOGS
    // -------------------------------------------------------------
    case 'audit_log_report': {
      let auditRows: RowDataPacket[] = [];
      try {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT a.id, a.company_id, a.branch_id, a.user_id, a.terminal_id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
                  c.name as company_name
           FROM audit_logs a
           LEFT JOIN companies c ON a.company_id = c.id
           WHERE ${companyId ? 'a.company_id = ? AND' : ''} a.created_at >= ? AND a.created_at <= ?
           ORDER BY a.created_at DESC LIMIT 500`,
          [...compParams, range.startSql, range.endSql]
        );
        auditRows = rows;
      } catch {
        auditRows = [];
      }

      const tableData = auditRows.map((r) => {
        let detailsStr = '—';
        if (r.details) {
          try {
            detailsStr = typeof r.details === 'string' ? r.details : JSON.stringify(r.details);
          } catch {}
        }
        return {
          id: r.id,
          date: new Date(r.created_at).toLocaleString(),
          user: r.user_id || 'System',
          action: r.action,
          entityType: r.entity_type,
          entityId: r.entity_id || '—',
          ip: r.ip_address || '127.0.0.1',
          details: detailsStr,
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Audit Security Events', value: tableData.length, subtext: `${tableData.length} actions captured`, color: 'pink' },
          { label: 'Security Health', value: 'Active', subtext: 'Server-side logging active' },
          { label: 'Monitored Entities', value: 'Shifts, Attendance, Sales', subtext: 'Comprehensive audit scope' },
          { label: 'Date Interval', value: range.startSql.split(' ')[0], subtext: 'Selected date window' },
        ],
        columns: [
          { key: 'date', label: 'Timestamp', format: 'text' },
          { key: 'user', label: 'User / Operator', format: 'text' },
          { key: 'action', label: 'Action Taken', format: 'badge' },
          { key: 'entityType', label: 'Entity Type', format: 'badge' },
          { key: 'entityId', label: 'Target ID', format: 'text' },
          { key: 'ip', label: 'IP Address', format: 'text' },
          { key: 'details', label: 'Event Details', format: 'text' },
        ],
        tableData,
        meta: {
          totalRecords: tableData.length,
          notes: tableData.length === 0 ? 'No audit events have been logged for this period.' : 'All system operations are recorded server-side with sensitive fields redacted.',
        },
      };
    }

    case 'delivery_report': {
      const deliveryCompFilter = companyId ? 'd.company_id = ? AND' : '';
      const deliveryCompParams = companyId ? [companyId] : [];

      const [deliveryRows] = await pool.query<RowDataPacket[]>(
        `SELECT 
           d.id, d.company_id, d.bill_id, d.order_source, d.online_order_id, d.tracking_token,
           d.customer_name, d.customer_phone, d.delivery_address, d.delivery_status, d.assignment_status,
           d.order_time, d.assigned_at, d.picked_up_at, d.delivered_at, d.created_at,
           s.total, s.subtotal, s.payment_method, s.payment_status,
           dp.name as delivery_person_name, dp.phone as delivery_person_phone, dp.employee_id as delivery_person_emp_id,
           c.name as company_name
         FROM deliveries d
         LEFT JOIN sales s ON d.company_id = s.company_id AND d.bill_id = s.bill_number
         LEFT JOIN delivery_persons dp ON d.delivery_person_id = dp.id
         LEFT JOIN companies c ON d.company_id = c.id
         WHERE ${deliveryCompFilter} d.created_at >= ? AND d.created_at <= ?
         ORDER BY d.created_at DESC`,
        [...deliveryCompParams, range.startSql, range.endSql]
      );

      let totalDeliveries = deliveryRows.length;
      let deliveredCount = 0;
      let cancelledCount = 0;
      let inTransitCount = 0;
      let totalDeliveryRevenue = 0;
      let terminalOrdersCount = 0;
      let zomatoOrdersCount = 0;
      let swiggyOrdersCount = 0;
      let totalDeliveryDurationMs = 0;
      let deliveredOrdersWithDuration = 0;

      const orderTypesMap: Record<string, number> = {
        'Terminal Delivery': 0,
        'Zomato': 0,
        'Swiggy': 0,
      };

      const paymentMethodsMap: Record<string, number> = {};

      const statusMap: Record<string, number> = {
        delivered: 0,
        out_for_delivery: 0,
        picked_up: 0,
        preparing: 0,
        ready_for_pickup: 0,
        assigned: 0,
        accepted: 0,
        pending: 0,
        cancelled: 0,
      };

      const riderSummaryMap = new Map<string, {
        rider: string;
        phone: string;
        empId: string;
        assigned: number;
        delivered: number;
        cancelled: number;
        totalRevenue: number;
      }>();

      const tableData = deliveryRows.map((row) => {
        const source = row.order_source || 'Terminal';
        const status = row.delivery_status || 'pending';
        const total = Number(row.total) || 0;
        const riderName = row.delivery_person_name || 'Unassigned';
        const riderPhone = row.delivery_person_phone || '';
        const riderEmpId = row.delivery_person_emp_id || '';
        const payMethod = row.payment_method || 'Prepaid / Online';

        if (status === 'delivered') deliveredCount++;
        else if (status === 'cancelled') cancelledCount++;
        else if (['picked_up', 'out_for_delivery'].includes(status)) inTransitCount++;

        statusMap[status] = (statusMap[status] || 0) + 1;

        if (status !== 'cancelled') {
          totalDeliveryRevenue += total;
        }

        if (source === 'Zomato') {
          zomatoOrdersCount++;
          orderTypesMap['Zomato'] += total;
        } else if (source === 'Swiggy') {
          swiggyOrdersCount++;
          orderTypesMap['Swiggy'] += total;
        } else {
          terminalOrdersCount++;
          orderTypesMap['Terminal Delivery'] += total;
        }

        paymentMethodsMap[payMethod] = (paymentMethodsMap[payMethod] || 0) + total;

        // Calculate delivery duration if delivered
        if (row.delivered_at && (row.order_time || row.created_at)) {
          const startTime = new Date(row.order_time || row.created_at).getTime();
          const deliveredTime = new Date(row.delivered_at).getTime();
          if (deliveredTime > startTime) {
            totalDeliveryDurationMs += (deliveredTime - startTime);
            deliveredOrdersWithDuration++;
          }
        }

        // Aggregate rider performance
        const riderKey = row.delivery_person_id || riderName;
        const existingRider = riderSummaryMap.get(riderKey) || {
          rider: riderName,
          phone: riderPhone,
          empId: riderEmpId,
          assigned: 0,
          delivered: 0,
          cancelled: 0,
          totalRevenue: 0,
        };
        existingRider.assigned++;
        if (status === 'delivered') existingRider.delivered++;
        if (status === 'cancelled') existingRider.cancelled++;
        if (status !== 'cancelled') existingRider.totalRevenue += total;
        riderSummaryMap.set(riderKey, existingRider);

        // Mask customer phone for customer privacy
        const rawPhone = row.customer_phone || '';
        const maskedPhone = rawPhone.length > 5 
          ? rawPhone.slice(0, 3) + '****' + rawPhone.slice(-2) 
          : rawPhone || 'N/A';

        return {
          id: row.bill_id || row.id,
          billNumber: row.bill_id ? `#${row.bill_id}` : `DEL-${row.id}`,
          orderSource: source,
          onlineOrderId: row.online_order_id ? `#${row.online_order_id}` : '-',
          customer: `${row.customer_name || 'Guest'} (${maskedPhone})`,
          address: row.delivery_address || '-',
          rider: riderName,
          status: status.replace(/_/g, ' '),
          rawStatus: status,
          amount: total,
          payment: payMethod,
          orderedAt: new Date(row.order_time || row.created_at).toLocaleString('en-IN', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          deliveredAt: row.delivered_at ? new Date(row.delivered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '-',
          trackingToken: row.tracking_token,
        };
      });

      const completionRate = totalDeliveries > 0 ? (deliveredCount / totalDeliveries) * 100 : 0;
      const avgMinutes = deliveredOrdersWithDuration > 0
        ? Math.round(totalDeliveryDurationMs / deliveredOrdersWithDuration / 60000)
        : 0;

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          {
            label: 'Total Deliveries',
            value: totalDeliveries,
            subtext: `${deliveredCount} delivered, ${inTransitCount} in transit, ${cancelledCount} void`,
            color: 'pink',
          },
          {
            label: 'Delivery Revenue',
            value: `${currency}${totalDeliveryRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            subtext: `Terminal: ${terminalOrdersCount} | Online: ${zomatoOrdersCount + swiggyOrdersCount}`,
          },
          {
            label: 'Completion Rate',
            value: `${completionRate.toFixed(1)}%`,
            subtext: totalDeliveries > 0 ? `${deliveredCount} of ${totalDeliveries} fulfilled` : 'No deliveries in range',
            trend: completionRate >= 80 ? 'up' : 'neutral',
          },
          {
            label: 'Avg Delivery Time',
            value: avgMinutes > 0 ? `${avgMinutes} mins` : 'N/A',
            subtext: deliveredOrdersWithDuration > 0 ? `Across ${deliveredOrdersWithDuration} completed runs` : 'Requires completed orders',
          },
        ],
        chartData: {
          orderTypes: orderTypesMap,
          paymentMethods: paymentMethodsMap,
          deliveryStatuses: statusMap,
          riderSummaries: Array.from(riderSummaryMap.values()),
        },
        columns: [
          { key: 'billNumber', label: 'Bill / ID', format: 'badge' },
          { key: 'orderSource', label: 'Source', format: 'badge' },
          { key: 'onlineOrderId', label: 'Online ID', format: 'text' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'address', label: 'Address', format: 'text' },
          { key: 'rider', label: 'Rider', format: 'text' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
          { key: 'amount', label: 'Amount', align: 'right', format: 'currency' },
          { key: 'payment', label: 'Payment', align: 'center', format: 'badge' },
          { key: 'orderedAt', label: 'Ordered At', format: 'text' },
        ],
        tableData,
        meta: {
          totalRecords: totalDeliveries,
          currency,
          notes: 'Deliveries report integrates Terminal Delivery dispatch, Swiggy/Zomato online orders, rider assignment, and fulfillment velocity.',
        },
      };
    }

    default:
      throw new Error(`Unsupported report key: ${reportKey}`);
  }
}

// =================================================================
// MONGODB REPORT ENGINE IMPLEMENTATION (LIVE BILLING MODE)
// =================================================================
async function executeMongoReport(
  reportKey: string,
  companyId: string,
  companyName: string,
  range: ReturnType<typeof resolveDateRange>,
  currency: string,
  db: any
): Promise<ReportResult> {
  const query: any = {
    $or: [
      { timestamp: { $gte: range.startMs, $lte: range.endMs } },
      { createdAt: { $gte: range.startIso, $lte: range.endIso } },
    ],
  };
  if (companyId && companyId !== 'all') {
    query.companyId = companyId;
  }

  const sales = await db.collection('sales').find(query).toArray();

  switch (reportKey) {
    case 'sales_report': {
      let gross = 0;
      let discounts = 0;
      let taxes = 0;
      let invoiced = 0;
      const orderTypeMap: Record<string, number> = {};
      const paymentMap: Record<string, number> = {};

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        const sub = Number(s.subtotal) || 0;
        const disc = Number(s.discount) || 0;
        const tax = Number(s.tax) || 0;
        const tot = Number(s.total) || 0;

        gross += sub;
        discounts += disc;
        taxes += tax;
        invoiced += tot;

        const m = s.paymentMethod || 'Cash';
        paymentMap[m] = (paymentMap[m] || 0) + tot;

        const ot = s.orderType || 'Dine In';
        orderTypeMap[ot] = (orderTypeMap[ot] || 0) + tot;
      }

      const billCount = sales.filter((s: any) => s.payment_status !== 'cancelled').length;

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Invoiced Sales', value: `${currency}${invoiced.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `${billCount} bills settled`, color: 'pink' },
          { label: 'Gross Sales', value: `${currency}${gross.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Total discounts: ${currency}${discounts.toFixed(2)}` },
          { label: 'Taxes Collected', value: `${currency}${taxes.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'GST Total' },
          { label: 'Average Order Value', value: `${currency}${(billCount > 0 ? invoiced / billCount : 0).toFixed(2)}`, subtext: 'Per bill average' },
        ],
        chartData: { orderTypes: orderTypeMap, paymentMethods: paymentMap },
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'method', label: 'Payment Method', format: 'badge' },
          { key: 'total', label: 'Total Amount', align: 'right', format: 'currency' },
        ],
        tableData: sales.map((s: any) => ({
          billNumber: s.id || s._id.toString(),
          date: new Date(s.timestamp || s.createdAt || Date.now()).toLocaleDateString(),
          customer: s.customerName || 'Walk-in',
          method: s.paymentMethod || 'Cash',
          total: Number(s.total) || 0,
        })),
        meta: { totalRecords: sales.length, currency },
      };
    }

    case 'items_report': {
      const itemsMap = new Map<string, { id: string; name: string; category: string; quantity: number; grossRevenue: number; discount: number; netRevenue: number; ordersCount: number }>();
      let totalQty = 0;
      let totalItemRev = 0;

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        const items = Array.isArray(s.items) ? s.items : [];
        for (const it of items) {
          const p = it.product || {};
          const id = p.id || it.productId || 'unknown';
          const name = p.name || it.name || 'Unnamed Item';
          const cat = p.categoryId || 'General';
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate || p.price) || 0;
          const gross = qty * rate;
          const disc = gross * ((Number(p.discount) || 0) / 100);
          const net = gross - disc;

          totalQty += qty;
          totalItemRev += net;

          const existing = itemsMap.get(id) || {
            id,
            name,
            category: cat,
            quantity: 0,
            grossRevenue: 0,
            discount: 0,
            netRevenue: 0,
            ordersCount: 0,
          };
          existing.quantity += qty;
          existing.grossRevenue += gross;
          existing.discount += disc;
          existing.netRevenue += net;
          existing.ordersCount += 1;
          itemsMap.set(id, existing);
        }
      }

      const sorted = Array.from(itemsMap.values()).sort((a, b) => b.quantity - a.quantity);
      const topItem = sorted[0]?.name || 'N/A';
      const tableData = sorted.map((i, idx) => ({
        rank: idx + 1,
        id: i.id,
        name: i.name,
        category: i.category,
        quantity: i.quantity,
        avgPrice: i.quantity > 0 ? (i.grossRevenue / i.quantity).toFixed(2) : '0.00',
        grossRevenue: i.grossRevenue,
        discount: i.discount,
        netRevenue: i.netRevenue,
        share: totalItemRev > 0 ? ((i.netRevenue / totalItemRev) * 100).toFixed(1) + '%' : '0%',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Units Sold', value: totalQty.toLocaleString(), subtext: `Across ${sorted.length} distinct items`, color: 'pink' },
          { label: 'Top Moving Item', value: topItem, subtext: sorted[0] ? `${sorted[0].quantity} units ordered` : 'No sales' },
          { label: 'Total Product Revenue', value: `${currency}${totalItemRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Net product sales' },
          { label: 'Active Menu Varieties', value: sorted.length, subtext: 'Distinct products sold' },
        ],
        columns: [
          { key: 'rank', label: '#', align: 'center', format: 'number' },
          { key: 'name', label: 'Item Name', format: 'text' },
          { key: 'category', label: 'Category', format: 'badge' },
          { key: 'quantity', label: 'Units Sold', align: 'center', format: 'number' },
          { key: 'avgPrice', label: 'Avg Rate', align: 'right', format: 'currency' },
          { key: 'grossRevenue', label: 'Gross Sales', align: 'right', format: 'currency' },
          { key: 'discount', label: 'Discount', align: 'right', format: 'currency' },
          { key: 'netRevenue', label: 'Net Revenue', align: 'right', format: 'currency' },
          { key: 'share', label: 'Sales Share', align: 'right', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: sorted.length, currency },
      };
    }

    case 'categories_report': {
      const catQuery: any = {};
      if (companyId && companyId !== 'all') catQuery.companyId = companyId;
      const categories = await db.collection('categories').find(catQuery).toArray();
      const catMap = new Map<string, string>();
      for (const c of categories) catMap.set(c.id || c._id.toString(), c.name);

      const catStats = new Map<string, { categoryId: string; name: string; quantity: number; revenue: number; billsCount: number }>();
      let totalRev = 0;

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        const items = Array.isArray(s.items) ? s.items : [];
        for (const it of items) {
          const p = it.product || {};
          const catId = p.categoryId || 'uncategorized';
          const catName = catMap.get(catId) || p.categoryName || 'General';
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate || p.price) || 0;
          const lineNet = qty * rate;

          totalRev += lineNet;
          const existing = catStats.get(catId) || {
            categoryId: catId,
            name: catName,
            quantity: 0,
            revenue: 0,
            billsCount: 0,
          };
          existing.quantity += qty;
          existing.revenue += lineNet;
          existing.billsCount += 1;
          catStats.set(catId, existing);
        }
      }

      const tableData = Array.from(catStats.values())
        .sort((a, b) => b.revenue - a.revenue)
        .map((c, idx) => ({
          rank: idx + 1,
          name: c.name,
          quantity: c.quantity,
          billsCount: c.billsCount,
          revenue: c.revenue,
          share: totalRev > 0 ? ((c.revenue / totalRev) * 100).toFixed(1) + '%' : '0%',
        }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Active Sales Categories', value: tableData.length, subtext: 'Categories generating revenue', color: 'pink' },
          { label: 'Top Grossing Category', value: tableData[0]?.name || 'N/A', subtext: `${currency}${(tableData[0]?.revenue || 0).toFixed(2)} invoiced` },
          { label: 'Total Category Sales', value: `${currency}${totalRev.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Invoiced across categories' },
          { label: 'Average Sales / Category', value: `${currency}${(tableData.length > 0 ? totalRev / tableData.length : 0).toFixed(2)}`, subtext: 'Category mean' },
        ],
        columns: [
          { key: 'rank', label: '#', align: 'center', format: 'number' },
          { key: 'name', label: 'Category Name', format: 'text' },
          { key: 'quantity', label: 'Units Sold', align: 'center', format: 'number' },
          { key: 'billsCount', label: 'Orders Included', align: 'center', format: 'number' },
          { key: 'revenue', label: 'Category Revenue', align: 'right', format: 'currency' },
          { key: 'share', label: 'Revenue Share', align: 'right', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'item_trends_report': {
      const dailyItemMap = new Map<string, { date: string; itemName: string; quantity: number; revenue: number }>();
      const itemTotals = new Map<string, number>();

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        const dateStr = new Date(s.timestamp || s.createdAt || Date.now()).toISOString().split('T')[0];
        const items = Array.isArray(s.items) ? s.items : [];
        for (const it of items) {
          const name = it.product?.name || it.name || 'Unnamed';
          const qty = Number(it.quantity) || 1;
          const rate = Number(it.rate || it.product?.price) || 0;
          const rev = qty * rate;

          itemTotals.set(name, (itemTotals.get(name) || 0) + qty);
          const key = `${dateStr}__${name}`;
          const existing = dailyItemMap.get(key) || { date: dateStr, itemName: name, quantity: 0, revenue: 0 };
          existing.quantity += qty;
          existing.revenue += rev;
          dailyItemMap.set(key, existing);
        }
      }

      const topItems = Array.from(itemTotals.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map((e) => e[0]);
      const tableData = Array.from(dailyItemMap.values())
        .filter((d) => topItems.includes(d.itemName))
        .sort((a, b) => b.date.localeCompare(a.date) || b.quantity - a.quantity);

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Tracked Top Items', value: topItems.length, subtext: 'Fastest moving product lines', color: 'pink' },
          { label: 'Top Trend Leader', value: topItems[0] || 'N/A', subtext: `${itemTotals.get(topItems[0]) || 0} units across period` },
          { label: 'Daily Data Points', value: tableData.length, subtext: 'Date × item volume entries' },
          { label: 'Analysis Span', value: `${range.startSql.split(' ')[0]} to ${range.endSql.split(' ')[0]}`, subtext: 'Current date window' },
        ],
        columns: [
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'itemName', label: 'Item Name', format: 'text' },
          { key: 'quantity', label: 'Units Sold That Day', align: 'center', format: 'number' },
          { key: 'revenue', label: 'Daily Revenue', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'busy_times_report': {
      let totalBills = 0;
      let totalSales = 0;
      let peakHour = 'None';
      let peakVol = 0;

      const hourMap = new Map<number, { hourLabel: string; bills: number; volume: number }>();
      for (let h = 0; h < 24; h++) {
        const startH = h % 12 || 12;
        const ampm = h >= 12 ? 'PM' : 'AM';
        const nextH = (h + 1) % 12 || 12;
        const nextAmpm = (h + 1) >= 12 && (h + 1) < 24 ? 'PM' : (h + 1) === 24 ? 'AM' : ampm;
        const hourLabel = `${String(startH).padStart(2, '0')}:00 ${ampm} - ${String(nextH).padStart(2, '0')}:00 ${nextAmpm}`;
        hourMap.set(h, { hourLabel, bills: 0, volume: 0 });
      }

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        const d = new Date(s.timestamp || s.createdAt || Date.now());
        const h = d.getHours();
        const tot = Number(s.total) || 0;
        totalBills += 1;
        totalSales += tot;

        const slot = hourMap.get(h);
        if (slot) {
          slot.bills += 1;
          slot.volume += tot;
          if (slot.volume > peakVol) {
            peakVol = slot.volume;
            peakHour = slot.hourLabel;
          }
        }
      }

      const tableData = Array.from(hourMap.values()).map((h) => ({
        hourLabel: h.hourLabel,
        bills: h.bills,
        volume: h.volume,
        aov: h.bills > 0 ? (h.volume / h.bills).toFixed(2) : '0.00',
        share: totalSales > 0 ? ((h.volume / totalSales) * 100).toFixed(1) + '%' : '0%',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Busiest Operating Window', value: peakHour, subtext: `${currency}${peakVol.toFixed(2)} generated`, color: 'pink' },
          { label: 'Active Trading Hours', value: tableData.filter((t) => t.bills > 0).length, subtext: 'Hours with customer checkouts' },
          { label: 'Total Bills Analyzed', value: totalBills, subtext: 'Time-stamped customer orders' },
          { label: 'Peak Volume Share', value: totalSales > 0 ? ((peakVol / totalSales) * 100).toFixed(1) + '%' : '0%', subtext: 'Of total sales revenue' },
        ],
        columns: [
          { key: 'hourLabel', label: 'Time Interval', format: 'text' },
          { key: 'bills', label: 'Invoices Settled', align: 'center', format: 'number' },
          { key: 'volume', label: 'Sales Volume', align: 'right', format: 'currency' },
          { key: 'aov', label: 'Average Bill Value', align: 'right', format: 'currency' },
          { key: 'share', label: 'Hourly Share', align: 'right', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'taxes_gst_report': {
      let totalTaxable = 0;
      let totalTax = 0;
      let totalInvoiced = 0;

      const tableData = sales.filter((s: any) => s.payment_status !== 'cancelled').map((s: any) => {
        const sub = Number(s.subtotal) || 0;
        const disc = Number(s.discount) || 0;
        const taxable = Math.max(0, sub - disc);
        const tax = Number(s.tax) || 0;
        const total = Number(s.total) || 0;

        totalTaxable += taxable;
        totalTax += tax;
        totalInvoiced += total;

        return {
          billNumber: s.id || s._id.toString(),
          date: new Date(s.timestamp || s.createdAt || Date.now()).toISOString().split('T')[0],
          customer: s.customerName || 'Walk-in',
          taxable,
          cgst: tax / 2,
          sgst: tax / 2,
          totalTax: tax,
          roundOff: Number(s.round_off || s.roundOff) || 0,
          total,
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total GST Collected', value: `${currency}${totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'CGST 50% + SGST 50%', color: 'pink' },
          { label: 'Central GST (CGST)', value: `${currency}${(totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: '50% share' },
          { label: 'State GST (SGST)', value: `${currency}${(totalTax / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: '50% share' },
          { label: 'Total Taxable Sales', value: `${currency}${totalTaxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Net taxable base' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'taxable', label: 'Taxable Amount', align: 'right', format: 'currency' },
          { key: 'cgst', label: 'CGST', align: 'right', format: 'currency' },
          { key: 'sgst', label: 'SGST', align: 'right', format: 'currency' },
          { key: 'totalTax', label: 'Total GST', align: 'right', format: 'currency' },
          { key: 'total', label: 'Invoice Total', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'day_end_z_report': {
      let gross = 0;
      let discounts = 0;
      let taxes = 0;
      let cashSales = 0;
      let digitalSales = 0;
      let unsettled = 0;
      let cancelled = 0;
      let settledCount = 0;

      for (const s of sales) {
        if (s.payment_status === 'cancelled') {
          cancelled += Number(s.total) || 0;
          continue;
        }
        settledCount++;
        const sub = Number(s.subtotal) || 0;
        const disc = Number(s.discount) || 0;
        const tax = Number(s.tax) || 0;
        const tot = Number(s.total) || 0;

        gross += sub;
        discounts += disc;
        taxes += tax;

        const m = s.paymentMethod || 'Cash';
        if (m === 'Cash') cashSales += tot;
        else if (m === 'Card' || m === 'UPI') digitalSales += tot;
        else if (m === 'Bill Only' || s.payment_status === 'unpaid') unsettled += tot;
      }

      const tableData = [
        { item: 'Total Finalized Invoices', value: settledCount, type: 'count' },
        { item: 'Gross Sales (Before Discounts)', value: gross, type: 'currency' },
        { item: 'Total Customer Discounts Given', value: discounts, type: 'currency' },
        { item: 'Net Sales Revenue', value: gross - discounts, type: 'currency' },
        { item: 'Total GST Tax Collected', value: taxes, type: 'currency' },
        { item: 'Cash Received in Register', value: cashSales, type: 'currency' },
        { item: 'Digital Collections (UPI / Cards)', value: digitalSales, type: 'currency' },
        { item: 'Unsettled / Credit Sales (Bill Only)', value: unsettled, type: 'currency' },
        { item: 'Cancelled Orders (Lost Revenue)', value: cancelled, type: 'currency' },
        { item: 'Net Expected Cash in Register', value: cashSales, type: 'currency' },
      ];

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Settled Invoices', value: settledCount, subtext: `${settledCount} orders finalized`, color: 'pink' },
          { label: 'Net Sales Revenue', value: `${currency}${(gross - discounts).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Excluding taxes' },
          { label: 'Cash Drawer Float', value: `${currency}${cashSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Physical cash received' },
          { label: 'Digital Settlements', value: `${currency}${digitalSales.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'UPI / Cards' },
        ],
        columns: [
          { key: 'item', label: 'Z-Report Audit Line Item', format: 'text' },
          { key: 'value', label: 'Audit Total', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'discounts_report': {
      const discSales = sales.filter((s: any) => s.payment_status !== 'cancelled' && Number(s.discount) > 0);
      let totalDisc = 0;
      let totalSub = 0;

      const tableData = discSales.map((r: any) => {
        const sub = Number(r.subtotal) || 0;
        const disc = Number(r.discount) || 0;
        const tot = Number(r.total) || 0;
        totalDisc += disc;
        totalSub += sub;
        const pct = sub > 0 ? ((disc / sub) * 100).toFixed(1) + '%' : '0%';

        return {
          billNumber: r.id || r._id.toString(),
          date: new Date(r.timestamp || r.createdAt || Date.now()).toISOString().split('T')[0],
          customer: r.customerName || 'Walk-in',
          cashier: r.createdBy || r.cashierId || 'Cashier',
          subtotal: sub,
          discount: disc,
          discountPercent: pct,
          total: tot,
          note: r.orderNote || '—',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Discounts Granted', value: `${currency}${totalDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Across ${tableData.length} bills`, color: 'pink' },
          { label: 'Discounted Bills Count', value: tableData.length, subtext: 'Invoices with discounts' },
          { label: 'Avg Discount Per Bill', value: `${currency}${(tableData.length > 0 ? totalDisc / tableData.length : 0).toFixed(2)}`, subtext: 'Mean discount allowance' },
          { label: 'Overall Discount Ratio', value: totalSub > 0 ? ((totalDisc / totalSub) * 100).toFixed(1) + '%' : '0%', subtext: 'Of discounted bill subtotal' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'cashier', label: 'Cashier', format: 'text' },
          { key: 'subtotal', label: 'Gross Subtotal', align: 'right', format: 'currency' },
          { key: 'discount', label: 'Discount Given', align: 'right', format: 'currency' },
          { key: 'discountPercent', label: 'Disc %', align: 'center', format: 'badge' },
          { key: 'total', label: 'Final Total', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'refunds_report': {
      const payQuery: any = { status: 'refunded' };
      if (companyId && companyId !== 'all') payQuery.companyId = companyId;
      const refunds = await db.collection('payments').find(payQuery).toArray();

      const tableData = refunds.map((r: any) => ({
        refundId: r.id || r._id.toString(),
        billNumber: r.saleId || '-',
        date: r.createdAt ? new Date(r.createdAt).toISOString().split('T')[0] : 'N/A',
        amount: Number(r.amount) || 0,
        method: r.method || 'Cash',
        status: 'Refunded',
      }));

      const totalRefunded = tableData.reduce((acc: number, r: any) => acc + r.amount, 0);

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Explicit Refunds Issued', value: `${currency}${totalRefunded.toFixed(2)}`, subtext: `${tableData.length} refund records`, color: 'pink' },
          { label: 'Refund Slips Count', value: tableData.length, subtext: 'Refund transactions' },
        ],
        columns: [
          { key: 'refundId', label: 'Refund Slip #', format: 'badge' },
          { key: 'billNumber', label: 'Original Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'amount', label: 'Refund Amount', align: 'right', format: 'currency' },
          { key: 'method', label: 'Refund Method', format: 'badge' },
          { key: 'status', label: 'Status', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'cancellations_report': {
      const cancelledSales = sales.filter((s: any) => s.payment_status === 'cancelled');
      let totalLost = 0;
      let totalItems = 0;

      const tableData = cancelledSales.map((r: any) => {
        const tot = Number(r.total) || 0;
        totalLost += tot;
        const items = Array.isArray(r.items) ? r.items : [];
        totalItems += items.length;

        return {
          billNumber: r.id || r._id.toString(),
          date: new Date(r.timestamp || r.createdAt || Date.now()).toISOString().split('T')[0],
          customer: r.customerName || 'Walk-in',
          cashier: r.createdBy || r.cashierId || 'Cashier',
          itemCount: items.length,
          total: tot,
          reason: r.orderNote || 'Order cancelled before settlement',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Lost Revenue (Cancelled)', value: `${currency}${totalLost.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Across ${tableData.length} cancelled bills`, color: 'pink' },
          { label: 'Cancelled Bills Count', value: tableData.length, subtext: 'Invoices voided/cancelled' },
          { label: 'Cancelled Item Lines', value: totalItems, subtext: 'Dishes/products voided' },
          { label: 'Avg Cancelled Bill Value', value: `${currency}${(tableData.length > 0 ? totalLost / tableData.length : 0).toFixed(2)}`, subtext: 'Mean lost invoice size' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customer', label: 'Customer', format: 'text' },
          { key: 'cashier', label: 'Staff User', format: 'text' },
          { key: 'itemCount', label: 'Items Count', align: 'center', format: 'number' },
          { key: 'total', label: 'Cancelled Value', align: 'right', format: 'currency' },
          { key: 'reason', label: 'Cancellation Reason', format: 'text' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'outstanding_report': {
      const unpaidSales = sales.filter((s: any) => s.payment_status === 'unpaid' || s.paymentMethod === 'Bill Only');
      let totalDue = 0;

      const tableData = unpaidSales.map((r: any) => {
        const tot = Number(r.total) || 0;
        totalDue += tot;
        return {
          billNumber: r.id || r._id.toString(),
          date: new Date(r.timestamp || r.createdAt || Date.now()).toISOString().split('T')[0],
          customerName: r.customerName || 'Anonymous Customer',
          phone: r.customerPhone || '—',
          billedTotal: tot,
          paidAmount: 0,
          balanceDue: tot,
          status: r.payment_status || 'unpaid',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Outstanding Balance', value: `${currency}${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `Across ${tableData.length} pending bills`, color: 'pink' },
          { label: 'Unpaid Invoices Count', value: tableData.length, subtext: 'Bills with balance > 0' },
          { label: 'Original Invoiced Credit', value: `${currency}${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Credit extended' },
        ],
        columns: [
          { key: 'billNumber', label: 'Bill #', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'customerName', label: 'Customer Name', format: 'text' },
          { key: 'phone', label: 'Phone', format: 'text' },
          { key: 'billedTotal', label: 'Total Billed', align: 'right', format: 'currency' },
          { key: 'balanceDue', label: 'Balance Outstanding', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'attendance_report': {
      const attQuery: any = {};
      if (companyId && companyId !== 'all') attQuery.companyId = companyId;
      const attRecords = await db.collection('attendance').find(attQuery).sort({ date: -1, clockIn: -1 }).toArray();

      let totalHours = 0;
      let lateCount = 0;
      for (const a of attRecords) {
        totalHours += Number(a.workingHours || 0);
        if (a.status === 'Late') lateCount++;
      }

      const tableData = attRecords.map((a: any) => ({
        id: a.id || a._id.toString(),
        staffName: a.userName || a.userId || 'Staff',
        role: a.userRole || 'Cashier',
        date: a.date || (a.clockIn ? new Date(a.clockIn).toISOString().split('T')[0] : 'N/A'),
        clockIn: a.clockIn ? new Date(a.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        clockOut: a.clockOut ? new Date(a.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active',
        workingHours: Number(a.workingHours || 0).toFixed(2),
        status: a.status || 'Present',
        notes: a.notes || '-',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Logged Sessions', value: attRecords.length, subtext: `${attRecords.length} records captured`, color: 'pink' },
          { label: 'Total Hours Worked', value: `${totalHours.toFixed(1)} hrs`, subtext: 'Across all staff' },
          { label: 'Average Hours / Shift', value: `${(attRecords.length > 0 ? totalHours / attRecords.length : 0).toFixed(1)} hrs`, subtext: 'Per session average' },
          { label: 'Late Clock-Ins', value: lateCount, subtext: 'Punctuality exceptions' },
        ],
        columns: [
          { key: 'staffName', label: 'Staff Member', format: 'text' },
          { key: 'role', label: 'Role', format: 'badge' },
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'clockIn', label: 'Clock In', format: 'text' },
          { key: 'clockOut', label: 'Clock Out', format: 'text' },
          { key: 'workingHours', label: 'Hours', align: 'right', format: 'text' },
          { key: 'status', label: 'Status', format: 'badge' },
          { key: 'notes', label: 'Notes / Reason', format: 'text' },
        ],
        tableData,
        meta: { totalRecords: attRecords.length, currency },
      };
    }

    case 'shifts_report': {
      const shiftQuery: any = {};
      if (companyId && companyId !== 'all') shiftQuery.companyId = companyId;
      const shifts = await db.collection('shifts').find(shiftQuery).sort({ openedAt: -1 }).toArray();

      let totalOpening = 0;
      let totalClosing = 0;
      let totalExpected = 0;
      let totalDiff = 0;
      let openCount = 0;

      for (const s of shifts) {
        totalOpening += Number(s.openingCash || 0);
        totalClosing += Number(s.countedClosingCash || 0);
        totalExpected += Number(s.expectedClosingCash || 0);
        totalDiff += Number(s.closingDifference || 0);
        if (s.status === 'Open') openCount++;
      }

      const tableData = shifts.map((s: any) => ({
        id: s.id || s._id.toString(),
        cashier: s.cashierName || s.cashierId || 'Cashier',
        openedAt: s.openedAt ? new Date(s.openedAt).toLocaleString() : 'N/A',
        closedAt: s.closedAt ? new Date(s.closedAt).toLocaleString() : 'Open Now',
        openingCash: Number(s.openingCash || 0),
        cashSales: Number(s.cashSales || 0),
        expectedCash: Number(s.expectedClosingCash || 0),
        countedCash: s.status === 'Open' ? '-' : Number(s.countedClosingCash || 0),
        difference: Number(s.closingDifference || 0),
        status: s.status,
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Shifts', value: shifts.length, subtext: `${shifts.length} shift logs`, color: 'pink' },
          { label: 'Total Opening Cash', value: `${currency}${totalOpening.toFixed(2)}`, subtext: 'Cash float' },
          { label: 'Net Discrepancy', value: `${currency}${totalDiff.toFixed(2)}`, subtext: totalDiff === 0 ? 'Exact match' : 'Shortage / Excess' },
          { label: 'Currently Open', value: openCount, subtext: 'Active registers' },
        ],
        columns: [
          { key: 'id', label: 'Shift ID', format: 'badge' },
          { key: 'cashier', label: 'Cashier', format: 'text' },
          { key: 'openedAt', label: 'Opened At', format: 'text' },
          { key: 'closedAt', label: 'Closed At', format: 'text' },
          { key: 'openingCash', label: 'Opening Cash', align: 'right', format: 'currency' },
          { key: 'cashSales', label: 'Cash Sales', align: 'right', format: 'currency' },
          { key: 'expectedCash', label: 'Expected Cash', align: 'right', format: 'currency' },
          { key: 'countedCash', label: 'Counted Cash', align: 'right', format: 'text' },
          { key: 'difference', label: 'Difference', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: shifts.length, currency },
      };
    }

    case 'expenses_profit_report': {
      const expQuery: any = {};
      if (companyId && companyId !== 'all') expQuery.companyId = companyId;
      const expenses = await db.collection('expenses').find(expQuery).sort({ expenseDate: -1 }).toArray();

      let totalExpenses = 0;
      for (const e of expenses) {
        if (e.status !== 'Rejected') {
          totalExpenses += Number(e.amount || 0);
        }
      }

      let revenue = 0;
      for (const s of sales) {
        if (s.payment_status !== 'cancelled') {
          revenue += Number(s.total || 0);
        }
      }

      const grossProfit = revenue;
      const netProfit = grossProfit - totalExpenses;

      const tableData = expenses.map((e: any) => ({
        id: e.id || e._id.toString(),
        date: e.expenseDate || (e.createdAt ? new Date(e.createdAt).toISOString().split('T')[0] : 'N/A'),
        category: e.category || 'Other',
        description: e.description || '-',
        amount: Number(e.amount || 0),
        paymentMethod: e.paymentMethod || 'Cash',
        status: e.status || 'Approved',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Invoiced Revenue', value: `${currency}${revenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'From verified bills', color: 'pink' },
          { label: 'Gross Operating Profit', value: `${currency}${grossProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Before operating expenses' },
          { label: 'Total Operating Expenses', value: `${currency}${totalExpenses.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: `${expenses.length} operating records` },
          { label: 'Net Profit', value: `${currency}${netProfit.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'Gross profit minus expenses' },
        ],
        columns: [
          { key: 'date', label: 'Date', format: 'date' },
          { key: 'category', label: 'Category', format: 'badge' },
          { key: 'description', label: 'Description', format: 'text' },
          { key: 'paymentMethod', label: 'Method', format: 'badge' },
          { key: 'amount', label: 'Amount', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: expenses.length, currency },
      };
    }

    case 'staff_report': {
      const staffQuery: any = {};
      if (companyId && companyId !== 'all') staffQuery.companyId = companyId;
      const staffMembers = await db.collection('staff').find(staffQuery).toArray();

      const userSalesMap: Record<string, { orders: number; guests: number; sales: number }> = {};
      let totalSales = 0;
      let totalOrders = 0;

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        const uid = (s.createdBy || s.cashierId || s.cashier || 'cashier').toLowerCase();
        if (!userSalesMap[uid]) userSalesMap[uid] = { orders: 0, guests: 0, sales: 0 };
        const tot = Number(s.total || 0);
        userSalesMap[uid].orders++;
        userSalesMap[uid].guests++;
        userSalesMap[uid].sales += tot;
        totalSales += tot;
        totalOrders++;
      }

      const formatRoleInfo = (rawRole?: string) => {
        const r = (rawRole || '').toLowerCase().trim();
        if (r === 'company_admin' || r === 'admin') return { role: 'company_admin', label: 'Admin', isAdmin: true };
        if (r === 'super_admin' || r === 'superadmin') return { role: 'super_admin', label: 'Super Admin', isAdmin: true };
        if (r === 'manager') return { role: 'manager', label: 'Manager', isAdmin: false };
        if (r === 'cashier') return { role: 'cashier', label: 'Cashier', isAdmin: false };
        return { role: r || 'cashier', label: rawRole ? (rawRole.charAt(0).toUpperCase() + rawRole.slice(1)) : 'Cashier', isAdmin: false };
      };

      let tableData: any[] = [];
      if (staffMembers.length > 0) {
        tableData = staffMembers.map((u: any) => {
          const uid = (u.username || u.id || u.name || '').toLowerCase();
          const stat = userSalesMap[uid] || userSalesMap['cashier'] || { orders: 0, guests: 0, sales: 0 };
          const percent = totalSales > 0 ? (stat.sales / totalSales) * 100 : 0;
          const avg = stat.orders > 0 ? stat.sales / stat.orders : 0;
          const roleInfo = formatRoleInfo(u.role);
          return {
            id: u.id || u._id.toString(),
            staff: u.name || 'Staff',
            name: u.name || 'Staff',
            role: roleInfo.role,
            roleLabel: roleInfo.label,
            isAdmin: roleInfo.isAdmin,
            orders: stat.orders,
            guests: stat.guests,
            sales: stat.sales,
            averageBill: avg,
            percent: Number(percent.toFixed(1)),
          };
        });
      } else if (Object.keys(userSalesMap).length > 0) {
        tableData = Object.entries(userSalesMap).map(([uid, stat]) => {
          const percent = totalSales > 0 ? (stat.sales / totalSales) * 100 : 0;
          const avg = stat.orders > 0 ? stat.sales / stat.orders : 0;
          const roleInfo = formatRoleInfo(uid === 'admin' || uid === 'superadmin' ? 'admin' : 'cashier');
          return {
            id: uid,
            staff: uid,
            name: uid,
            role: roleInfo.role,
            roleLabel: roleInfo.label,
            isAdmin: roleInfo.isAdmin,
            orders: stat.orders,
            guests: stat.guests,
            sales: stat.sales,
            averageBill: avg,
            percent: Number(percent.toFixed(1)),
          };
        });
      }

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Staff', value: tableData.length, subtext: 'Active cashiers & staff', color: 'pink' },
          { label: 'Orders', value: totalOrders, subtext: 'Bills placed' },
          { label: 'Sales', value: `${currency}${totalSales.toFixed(2)}`, subtext: 'Total staff sales' },
        ],
        chartData: {
          staffBars: tableData,
          totalSales,
          dateLabel: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        },
        columns: [
          { key: 'staff', label: 'STAFF', format: 'text' },
          { key: 'roleLabel', label: 'ROLE', format: 'badge' },
          { key: 'orders', label: 'ORDERS', align: 'center', format: 'number' },
          { key: 'guests', label: 'GUESTS', align: 'center', format: 'number' },
          { key: 'sales', label: 'SALES', align: 'right', format: 'currency' },
          { key: 'averageBill', label: 'AVERAGE BILL', align: 'right', format: 'currency' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'salaries_report': {
      const staffQuery: any = {};
      if (companyId && companyId !== 'all') staffQuery.companyId = companyId;
      const staffMembers = await db.collection('staff').find(staffQuery).toArray();

      const expQuery: any = { category: 'Salary', status: { $ne: 'Rejected' } };
      if (companyId && companyId !== 'all') expQuery.companyId = companyId;
      const paidSalaryExpenses = await db.collection('expenses').find(expQuery).toArray();

      const totalPaid = paidSalaryExpenses.reduce((acc: number, e: any) => acc + (Number(e.amount) || 0), 0);
      let totalCommitment = 0;

      const tableData = staffMembers.map((s: any) => {
        const base = Number(s.baseAmount) || 0;
        const allowances = (s.allowances || []).reduce((acc: number, a: any) => acc + (Number(a.amount) || 0), 0);
        const deductions = (s.deductions || []).reduce((acc: number, d: any) => acc + (Number(d.amount) || 0), 0);
        const netSalary = Math.max(0, base + allowances - deductions);
        totalCommitment += netSalary;

        return {
          id: s.id || s._id.toString(),
          employee: s.name || 'Employee',
          role: s.role || 'Staff',
          payType: s.payType || 'Monthly',
          baseSalary: base,
          allowances,
          deductions,
          netSalary,
          status: s.includeInPayroll !== false ? 'Active in Payroll' : 'Excluded',
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Total Enrolled Staff', value: staffMembers.length, subtext: `${staffMembers.length} employee contracts`, color: 'pink' },
          { label: 'Monthly Payroll Commitment', value: `${currency}${totalCommitment.toFixed(2)}`, subtext: 'Base salary commitment' },
          { label: 'Disbursed in Period', value: `${currency}${totalPaid.toFixed(2)}`, subtext: 'Verified salary expenses' },
        ],
        columns: [
          { key: 'employee', label: 'Employee', format: 'text' },
          { key: 'role', label: 'Role', format: 'badge' },
          { key: 'payType', label: 'Pay Type', format: 'badge' },
          { key: 'baseSalary', label: 'Base Amount', align: 'right', format: 'currency' },
          { key: 'allowances', label: 'Allowances', align: 'right', format: 'currency' },
          { key: 'deductions', label: 'Deductions', align: 'right', format: 'currency' },
          { key: 'netSalary', label: 'Monthly Net', align: 'right', format: 'currency' },
          { key: 'status', label: 'Status', align: 'center', format: 'badge' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'guests_report': {
      const guestMap = new Map<string, { name: string; phone: string; visits: number; totalSpent: number; firstVisit: string; lastVisit: string }>();
      let totalGuestSpent = 0;
      let repeatCount = 0;

      for (const s of sales) {
        if (s.payment_status === 'cancelled') continue;
        if (!s.customerName && !s.customerPhone) continue;
        const key = (s.customerPhone || s.customerName).toLowerCase();
        const tot = Number(s.total) || 0;
        const dStr = new Date(s.timestamp || s.createdAt || Date.now()).toISOString().split('T')[0];
        totalGuestSpent += tot;

        const existing = guestMap.get(key) || {
          name: s.customerName || 'Guest',
          phone: s.customerPhone || '—',
          visits: 0,
          totalSpent: 0,
          firstVisit: dStr,
          lastVisit: dStr,
        };
        existing.visits += 1;
        existing.totalSpent += tot;
        if (dStr < existing.firstVisit) existing.firstVisit = dStr;
        if (dStr > existing.lastVisit) existing.lastVisit = dStr;
        guestMap.set(key, existing);
      }

      const tableData = Array.from(guestMap.values()).sort((a, b) => b.totalSpent - a.totalSpent).map((g, idx) => {
        if (g.visits > 1) repeatCount++;
        return {
          rank: idx + 1,
          name: g.name,
          phone: g.phone,
          visits: g.visits,
          totalSpent: g.totalSpent,
          avgSpend: g.visits > 0 ? (g.totalSpent / g.visits).toFixed(2) : '0.00',
          firstVisit: g.firstVisit,
          lastVisit: g.lastVisit,
        };
      });

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Identified Guests', value: tableData.length, subtext: 'With recorded name or phone', color: 'pink' },
          { label: 'Repeat Customer Rate', value: tableData.length > 0 ? ((repeatCount / tableData.length) * 100).toFixed(1) + '%' : '0%', subtext: `${repeatCount} returning customers` },
          { label: 'Total Guest Spend', value: `${currency}${totalGuestSpent.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, subtext: 'From recognized guests' },
          { label: 'Average Spend / Guest', value: `${currency}${(tableData.length > 0 ? totalGuestSpent / tableData.length : 0).toFixed(2)}`, subtext: 'Customer lifetime value in period' },
        ],
        columns: [
          { key: 'rank', label: '#', align: 'center', format: 'number' },
          { key: 'name', label: 'Guest Name', format: 'text' },
          { key: 'phone', label: 'Contact Phone', format: 'text' },
          { key: 'visits', label: 'Visits Count', align: 'center', format: 'number' },
          { key: 'totalSpent', label: 'Total Spent', align: 'right', format: 'currency' },
          { key: 'avgSpend', label: 'Avg Spend / Visit', align: 'right', format: 'currency' },
          { key: 'lastVisit', label: 'Most Recent Visit', format: 'date' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    case 'audit_log_report': {
      const audQuery: any = {};
      if (companyId && companyId !== 'all') audQuery.companyId = companyId;
      const logs = await db.collection('audit_logs').find(audQuery).sort({ createdAt: -1 }).limit(100).toArray();

      const tableData = logs.map((l: any) => ({
        date: l.createdAt ? new Date(l.createdAt).toLocaleString() : 'N/A',
        user: l.userId || 'system',
        action: l.action || 'EVENT',
        entityType: l.entityType || 'SYSTEM',
        entityId: l.entityId || '-',
        ip: l.ipAddress || '127.0.0.1',
        details: typeof l.details === 'object' ? JSON.stringify(l.details) : l.details || '-',
      }));

      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'Audit Security Events', value: tableData.length, subtext: `${tableData.length} actions captured`, color: 'pink' },
          { label: 'Security Health', value: 'Active', subtext: 'MongoDB audit trail logging active' },
        ],
        columns: [
          { key: 'date', label: 'Timestamp', format: 'text' },
          { key: 'user', label: 'User / Operator', format: 'text' },
          { key: 'action', label: 'Action Taken', format: 'badge' },
          { key: 'entityType', label: 'Entity Type', format: 'badge' },
          { key: 'entityId', label: 'Target ID', format: 'text' },
          { key: 'ip', label: 'IP Address', format: 'text' },
          { key: 'details', label: 'Event Details', format: 'text' },
        ],
        tableData,
        meta: { totalRecords: tableData.length, currency },
      };
    }

    default: {
      return {
        reportKey,
        preset: range.startIso,
        startDate: range.startSql,
        endDate: range.endSql,
        companyName,
        companyId,
        kpis: [
          { label: 'MongoDB Mode Active', value: `${sales.length} records`, subtext: 'Live billing telemetry', color: 'pink' },
          { label: 'Data Status', value: 'Live', subtext: 'Real-time query' },
        ],
        columns: [
          { key: 'id', label: 'ID', format: 'badge' },
          { key: 'total', label: 'Total', align: 'right', format: 'currency' },
        ],
        tableData: sales.slice(0, 50).map((s: any) => ({ id: s.id || s._id.toString(), total: Number(s.total) || 0 })),
        meta: { totalRecords: sales.length, currency },
      };
    }
  }
}
