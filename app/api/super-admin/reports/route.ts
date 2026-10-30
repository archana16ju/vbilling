import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getSession } from '@/lib/auth-session';
import { RowDataPacket } from 'mysql2';
import { resolveAnalyticsDateRanges } from '@/lib/super-admin-analytics';

interface ColumnDef {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'number' | 'date' | 'badge' | 'text';
  sortable?: boolean;
}

export async function GET(request: Request) {
  try {
    if (!isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Super Admin Reports requires local MySQL mode.' }, { status: 400 });
    }

    // Role check: Strictly super_admin
    const session = await getSession();
    const cookieStore = await cookies();
    const role = session?.role || cookieStore.get('auth_role')?.value;

    if (role !== 'super_admin') {
      return NextResponse.json({ error: 'Access Denied: Super Admin authentication required.' }, { status: 403 });
    }

    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();

    const { searchParams } = new URL(request.url);
    const reportKey = searchParams.get('reportKey') || 'overall_sales';
    const companyIdParam = searchParams.get('companyId') || 'all';
    const presetParam = searchParams.get('preset') || '30days';
    const customStartParam = searchParams.get('startDate');
    const customEndParam = searchParams.get('endDate');

    const dateRange = resolveAnalyticsDateRanges(presetParam, customStartParam, customEndParam);
    const isAllCompanies = companyIdParam === 'all' || !companyIdParam;

    // Fetch Companies map for resolving names
    const [allCompanies] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, code, is_active, currency, created_at FROM companies'
    );
    const companyMap = new Map<string, { id: string; name: string; code: string; currency: string }>();
    allCompanies.forEach((c) => companyMap.set(c.id, { id: c.id, name: c.name, code: c.code, currency: c.currency || 'INR' }));

    const targetCompanyName = isAllCompanies
      ? 'All Companies'
      : companyMap.get(companyIdParam)?.name || companyIdParam;

    // Common Sales Filters
    const salesFilter = isAllCompanies
      ? 's.created_at >= ? AND s.created_at <= ?'
      : 's.company_id = ? AND s.created_at >= ? AND s.created_at <= ?';

    const salesParams = isAllCompanies
      ? [dateRange.currentStartSql, dateRange.currentEndSql]
      : [companyIdParam, dateRange.currentStartSql, dateRange.currentEndSql];

    let reportTitle = 'Super Admin Report';
    let category = 'Sales';
    let columns: ColumnDef[] = [];
    let rows: any[] = [];
    let summary: Record<string, any> = {};
    let notes: string | undefined;

    switch (reportKey) {
      // ===========================================================
      // 1. SALES REPORTS
      // ===========================================================
      case 'overall_sales':
      case 'bills_report': {
        reportTitle = reportKey === 'bills_report' ? 'Detailed Bills Audit Report' : 'Overall Sales Report';
        category = 'Sales';
        columns = [
          { key: 'bill_number', label: 'Bill Number', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'created_at', label: 'Date & Time', format: 'date', sortable: true },
          { key: 'customer_name', label: 'Customer', sortable: true },
          { key: 'order_type', label: 'Order Type', format: 'badge', sortable: true },
          { key: 'items_count', label: 'Items', align: 'center', format: 'number', sortable: true },
          { key: 'subtotal', label: 'Subtotal', align: 'right', format: 'currency', sortable: true },
          { key: 'discount', label: 'Discount', align: 'right', format: 'currency', sortable: true },
          { key: 'tax', label: 'Tax / GST', align: 'right', format: 'currency', sortable: true },
          { key: 'total', label: 'Grand Total', align: 'right', format: 'currency', sortable: true },
          { key: 'payment_method', label: 'Payment Method', format: 'badge', sortable: true },
          { key: 'created_by', label: 'Cashier / Admin', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.id, s.bill_number, s.company_id, s.subtotal, s.discount, s.tax, s.round_off, s.total,
                  s.payment_method, s.payment_status, s.order_type, s.customer_name, s.customer_phone,
                  s.created_by, s.created_at, s.items
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'
           ORDER BY s.created_at DESC`,
          salesParams
        );

        let totSub = 0, totDisc = 0, totTax = 0, totAmt = 0;
        rows = dbRows.map((r) => {
          const comp = companyMap.get(r.company_id) || { name: 'Unknown Company', code: 'N/A' };
          let itms: any[] = [];
          try {
            itms = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []);
          } catch {
            itms = [];
          }
          const sTotal = Number(r.total) || 0;
          const sSub = Number(r.subtotal) || 0;
          const sDisc = Number(r.discount) || 0;
          const sTax = Number(r.tax) || 0;

          totAmt += sTotal;
          totSub += sSub;
          totDisc += sDisc;
          totTax += sTax;

          return {
            id: r.id,
            bill_number: r.bill_number || r.id,
            company_id: r.company_id,
            company_name: comp.name,
            company_code: comp.code,
            created_at: r.created_at,
            customer_name: r.customer_name || 'Walk-in Customer',
            customer_phone: r.customer_phone || '-',
            order_type: r.order_type || 'Dine In',
            items_count: itms.length,
            items: itms,
            subtotal: sSub,
            discount: sDisc,
            tax: sTax,
            total: sTotal,
            payment_method: r.payment_method || 'Cash',
            payment_status: r.payment_status || 'paid',
            created_by: r.created_by || 'Cashier',
          };
        });

        summary = {
          totalBills: rows.length,
          subtotal: Math.round(totSub * 100) / 100,
          discount: Math.round(totDisc * 100) / 100,
          tax: Math.round(totTax * 100) / 100,
          grandTotal: Math.round(totAmt * 100) / 100,
          avgBill: rows.length > 0 ? Math.round((totAmt / rows.length) * 100) / 100 : 0,
        };
        break;
      }

      case 'company_sales': {
        reportTitle = 'Company-wise Sales Report';
        category = 'Sales';
        columns = [
          { key: 'company_name', label: 'Company Name', sortable: true },
          { key: 'company_code', label: 'Code', align: 'center', format: 'badge', sortable: true },
          { key: 'total_bills', label: 'Total Bills', align: 'center', format: 'number', sortable: true },
          { key: 'total_sales', label: 'Total Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'avg_bill', label: 'Average Bill Value', align: 'right', format: 'currency', sortable: true },
          { key: 'cash_sales', label: 'Cash Collections', align: 'right', format: 'currency', sortable: true },
          { key: 'upi_card_sales', label: 'Digital / Card / UPI', align: 'right', format: 'currency', sortable: true },
          { key: 'percent_share', label: 'Revenue Share %', align: 'right', format: 'badge', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.company_id, s.total, s.payment_method
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'`,
          salesParams
        );

        const compAgg = new Map<string, { bills: number; sales: number; cash: number; digital: number }>();
        allCompanies.forEach((c) => {
          if (isAllCompanies || c.id === companyIdParam) {
            compAgg.set(c.id, { bills: 0, sales: 0, cash: 0, digital: 0 });
          }
        });

        let totalRevenueAll = 0;
        dbRows.forEach((s) => {
          const cid = s.company_id || 'COMP-0001';
          if (!compAgg.has(cid)) compAgg.set(cid, { bills: 0, sales: 0, cash: 0, digital: 0 });
          const entry = compAgg.get(cid)!;
          const t = Number(s.total) || 0;
          totalRevenueAll += t;
          entry.bills += 1;
          entry.sales += t;
          const pm = (s.payment_method || '').toLowerCase();
          if (pm.includes('cash')) entry.cash += t;
          else entry.digital += t;
        });

        rows = Array.from(compAgg.entries()).map(([cid, data]) => {
          const c = companyMap.get(cid) || { name: 'Unknown', code: cid };
          return {
            company_id: cid,
            company_name: c.name,
            company_code: c.code,
            total_bills: data.bills,
            total_sales: Math.round(data.sales * 100) / 100,
            avg_bill: data.bills > 0 ? Math.round((data.sales / data.bills) * 100) / 100 : 0,
            cash_sales: Math.round(data.cash * 100) / 100,
            upi_card_sales: Math.round(data.digital * 100) / 100,
            percent_share: totalRevenueAll > 0 ? `${(Math.round((data.sales / totalRevenueAll) * 1000) / 10).toFixed(1)}%` : '0%',
          };
        }).sort((a, b) => b.total_sales - a.total_sales);

        summary = {
          totalCompanies: rows.length,
          totalBills: rows.reduce((acc, r) => acc + r.total_bills, 0),
          totalSales: Math.round(totalRevenueAll * 100) / 100,
        };
        break;
      }

      case 'daily_sales': {
        reportTitle = 'Daily Sales Aggregation Report';
        category = 'Sales';
        columns = [
          { key: 'date', label: 'Date', format: 'date', sortable: true },
          { key: 'total_bills', label: 'Total Bills', align: 'center', format: 'number', sortable: true },
          { key: 'subtotal', label: 'Subtotal', align: 'right', format: 'currency', sortable: true },
          { key: 'discount', label: 'Discount', align: 'right', format: 'currency', sortable: true },
          { key: 'tax', label: 'Tax', align: 'right', format: 'currency', sortable: true },
          { key: 'total_sales', label: 'Total Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'avg_bill', label: 'Avg Ticket Size', align: 'right', format: 'currency', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT DATE(s.created_at) as sale_date, COUNT(*) as bills,
                  COALESCE(SUM(s.subtotal), 0) as subtotal,
                  COALESCE(SUM(s.discount), 0) as discount,
                  COALESCE(SUM(s.tax), 0) as tax,
                  COALESCE(SUM(s.total), 0) as total
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'
           GROUP BY DATE(s.created_at)
           ORDER BY sale_date DESC`,
          salesParams
        );

        rows = dbRows.map((r) => {
          const sTot = Number(r.total) || 0;
          const bills = Number(r.bills) || 0;
          return {
            date: r.sale_date,
            total_bills: bills,
            subtotal: Math.round(Number(r.subtotal) * 100) / 100,
            discount: Math.round(Number(r.discount) * 100) / 100,
            tax: Math.round(Number(r.tax) * 100) / 100,
            total_sales: Math.round(sTot * 100) / 100,
            avg_bill: bills > 0 ? Math.round((sTot / bills) * 100) / 100 : 0,
          };
        });

        summary = {
          totalDays: rows.length,
          totalBills: rows.reduce((acc, r) => acc + r.total_bills, 0),
          totalSales: Math.round(rows.reduce((acc, r) => acc + r.total_sales, 0) * 100) / 100,
        };
        break;
      }

      case 'monthly_sales': {
        reportTitle = 'Monthly Sales Aggregation Report';
        category = 'Sales';
        columns = [
          { key: 'month_year', label: 'Month / Year', sortable: true },
          { key: 'total_bills', label: 'Bills Count', align: 'center', format: 'number', sortable: true },
          { key: 'subtotal', label: 'Subtotal', align: 'right', format: 'currency', sortable: true },
          { key: 'tax', label: 'Tax (GST)', align: 'right', format: 'currency', sortable: true },
          { key: 'total_sales', label: 'Total Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'avg_bill', label: 'Avg Ticket Value', align: 'right', format: 'currency', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT DATE_FORMAT(s.created_at, '%Y-%m') as ym, COUNT(*) as bills,
                  COALESCE(SUM(s.subtotal), 0) as subtotal,
                  COALESCE(SUM(s.tax), 0) as tax,
                  COALESCE(SUM(s.total), 0) as total
           FROM sales s
           WHERE ${isAllCompanies ? '1=1' : 's.company_id = ?'} AND s.payment_status != 'cancelled'
           GROUP BY DATE_FORMAT(s.created_at, '%Y-%m')
           ORDER BY ym DESC`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = dbRows.map((r) => {
          const tot = Number(r.total) || 0;
          const bills = Number(r.bills) || 0;
          return {
            month_year: r.ym,
            total_bills: bills,
            subtotal: Math.round(Number(r.subtotal) * 100) / 100,
            tax: Math.round(Number(r.tax) * 100) / 100,
            total_sales: Math.round(tot * 100) / 100,
            avg_bill: bills > 0 ? Math.round((tot / bills) * 100) / 100 : 0,
          };
        });

        summary = {
          totalMonths: rows.length,
          totalBills: rows.reduce((acc, r) => acc + r.total_bills, 0),
          totalSales: Math.round(rows.reduce((acc, r) => acc + r.total_sales, 0) * 100) / 100,
        };
        break;
      }

      case 'yearly_sales': {
        reportTitle = 'Yearly Sales Aggregation Report';
        category = 'Sales';
        columns = [
          { key: 'year', label: 'Calendar Year', align: 'center', sortable: true },
          { key: 'total_bills', label: 'Total Bills', align: 'center', format: 'number', sortable: true },
          { key: 'total_sales', label: 'Annual Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'avg_bill', label: 'Annual AOV', align: 'right', format: 'currency', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT YEAR(s.created_at) as yr, COUNT(*) as bills,
                  COALESCE(SUM(s.total), 0) as total
           FROM sales s
           WHERE ${isAllCompanies ? '1=1' : 's.company_id = ?'} AND s.payment_status != 'cancelled'
           GROUP BY YEAR(s.created_at)
           ORDER BY yr DESC`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = dbRows.map((r) => {
          const tot = Number(r.total) || 0;
          const bills = Number(r.bills) || 0;
          return {
            year: String(r.yr),
            total_bills: bills,
            total_sales: Math.round(tot * 100) / 100,
            avg_bill: bills > 0 ? Math.round((tot / bills) * 100) / 100 : 0,
          };
        });

        summary = {
          totalYears: rows.length,
          totalSales: Math.round(rows.reduce((acc, r) => acc + r.total_sales, 0) * 100) / 100,
        };
        break;
      }

      case 'payment_method_report': {
        reportTitle = 'Payment Method Collections Report';
        category = 'Sales';
        columns = [
          { key: 'payment_method', label: 'Payment Method', format: 'badge', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'transaction_count', label: 'Transactions', align: 'center', format: 'number', sortable: true },
          { key: 'total_collected', label: 'Amount Collected', align: 'right', format: 'currency', sortable: true },
          { key: 'percent_share', label: 'Share %', align: 'right', format: 'badge', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.company_id, s.payment_method, COUNT(*) as cnt, COALESCE(SUM(s.total), 0) as amt
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'
           GROUP BY s.company_id, s.payment_method
           ORDER BY amt DESC`,
          salesParams
        );

        const grandTotal = dbRows.reduce((acc, r) => acc + (Number(r.amt) || 0), 0);

        rows = dbRows.map((r) => {
          const comp = companyMap.get(r.company_id) || { name: 'All Companies', code: '' };
          const amt = Number(r.amt) || 0;
          return {
            payment_method: r.payment_method || 'Cash',
            company_id: r.company_id,
            company_name: comp.name,
            transaction_count: Number(r.cnt) || 0,
            total_collected: Math.round(amt * 100) / 100,
            percent_share: grandTotal > 0 ? `${(Math.round((amt / grandTotal) * 1000) / 10).toFixed(1)}%` : '0%',
          };
        });

        summary = {
          totalTransactions: rows.reduce((acc, r) => acc + r.transaction_count, 0),
          totalCollected: Math.round(grandTotal * 100) / 100,
        };
        break;
      }

      case 'tax_gst_report': {
        reportTitle = 'Tax / GST Compliance Report';
        category = 'Sales';
        columns = [
          { key: 'bill_number', label: 'Bill Number', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'created_at', label: 'Invoice Date', format: 'date', sortable: true },
          { key: 'taxable_amount', label: 'Taxable Amount', align: 'right', format: 'currency', sortable: true },
          { key: 'cgst', label: 'CGST (2.5%)', align: 'right', format: 'currency', sortable: true },
          { key: 'sgst', label: 'SGST (2.5%)', align: 'right', format: 'currency', sortable: true },
          { key: 'total_tax', label: 'Total GST', align: 'right', format: 'currency', sortable: true },
          { key: 'invoice_total', label: 'Invoice Total', align: 'right', format: 'currency', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.id, s.bill_number, s.company_id, s.subtotal, s.tax, s.total, s.created_at, s.items
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'
           ORDER BY s.created_at DESC`,
          salesParams
        );

        let totTaxable = 0, totTax = 0, totGross = 0;
        rows = dbRows.map((r) => {
          const comp = companyMap.get(r.company_id) || { name: 'Unknown' };
          const sub = Number(r.subtotal) || 0;
          const tax = Number(r.tax) || 0;
          const tot = Number(r.total) || 0;
          totTaxable += sub;
          totTax += tax;
          totGross += tot;

          return {
            id: r.id,
            bill_number: r.bill_number || r.id,
            company_id: r.company_id,
            company_name: comp.name,
            created_at: r.created_at,
            taxable_amount: Math.round(sub * 100) / 100,
            cgst: Math.round((tax / 2) * 100) / 100,
            sgst: Math.round((tax / 2) * 100) / 100,
            total_tax: Math.round(tax * 100) / 100,
            invoice_total: Math.round(tot * 100) / 100,
          };
        });

        summary = {
          totalInvoices: rows.length,
          totalTaxable: Math.round(totTaxable * 100) / 100,
          totalTax: Math.round(totTax * 100) / 100,
          totalGross: Math.round(totGross * 100) / 100,
        };
        break;
      }

      case 'refund_report': {
        reportTitle = 'Refunds & Returns Report';
        category = 'Sales';
        columns = [
          { key: 'id', label: 'Reference ID', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'amount', label: 'Refund Amount', align: 'right', format: 'currency', sortable: true },
          { key: 'payment_method', label: 'Method', format: 'badge', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
          { key: 'created_at', label: 'Date', format: 'date', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT p.id, p.company_id, p.amount, p.payment_method, p.status, p.created_at
           FROM payments p
           WHERE ${isAllCompanies ? '1=1' : 'p.company_id = ?'} AND (p.status = 'refund' OR p.status = 'refunded')
           ORDER BY p.created_at DESC`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = dbRows.map((r) => {
          const comp = companyMap.get(r.company_id) || { name: 'Unknown' };
          return {
            id: r.id,
            company_id: r.company_id,
            company_name: comp.name,
            amount: Number(r.amount) || 0,
            payment_method: r.payment_method || 'Cash',
            status: r.status,
            created_at: r.created_at,
          };
        });

        summary = {
          refundCount: rows.length,
          totalRefunded: rows.reduce((acc, r) => acc + r.amount, 0),
        };
        break;
      }

      case 'cancellation_report': {
        reportTitle = 'Order Cancellations & Voided Slips Report';
        category = 'Sales';
        columns = [
          { key: 'bill_number', label: 'Bill / Order ID', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'order_type', label: 'Type', format: 'badge', sortable: true },
          { key: 'total', label: 'Voided Value', align: 'right', format: 'currency', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
          { key: 'created_at', label: 'Date', format: 'date', sortable: true },
        ];

        const [dbRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.id, s.bill_number, s.company_id, s.order_type, s.total, s.payment_status, s.created_at
           FROM sales s
           WHERE ${isAllCompanies ? '1=1' : 's.company_id = ?'} AND s.payment_status = 'cancelled'
           ORDER BY s.created_at DESC`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = dbRows.map((r) => {
          const comp = companyMap.get(r.company_id) || { name: 'Unknown' };
          return {
            bill_number: r.bill_number || r.id,
            company_id: r.company_id,
            company_name: comp.name,
            order_type: r.order_type || 'Order',
            total: Number(r.total) || 0,
            status: r.payment_status,
            created_at: r.created_at,
          };
        });

        summary = {
          cancelledCount: rows.length,
          lostRevenue: rows.reduce((acc, r) => acc + r.total, 0),
        };
        break;
      }

      // ===========================================================
      // 2. COMPANY REPORTS
      // ===========================================================
      case 'company_registration':
      case 'active_inactive_companies':
      case 'company_performance':
      case 'company_collection_summary':
      case 'company_growth': {
        reportTitle = reportKey === 'company_registration'
          ? 'Company Registration & Tenant Registry'
          : reportKey === 'active_inactive_companies'
          ? 'Active / Inactive Companies Status Report'
          : reportKey === 'company_performance'
          ? 'Company Operational Performance Matrix'
          : reportKey === 'company_growth'
          ? 'Company Growth & Velocity Report'
          : 'Company-wise Collection Summary';
        category = 'Companies';

        columns = [
          { key: 'name', label: 'Company Name', sortable: true },
          { key: 'code', label: 'Code', align: 'center', format: 'badge', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
          { key: 'user_count', label: 'Users', align: 'center', format: 'number', sortable: true },
          { key: 'product_count', label: 'Products', align: 'center', format: 'number', sortable: true },
          { key: 'total_bills', label: 'Lifetime Bills', align: 'center', format: 'number', sortable: true },
          { key: 'total_sales', label: 'Lifetime Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'currency', label: 'Currency', align: 'center', sortable: true },
          { key: 'created_at', label: 'Registered Date', format: 'date', sortable: true },
        ];

        // Gather metrics per company
        const [salesStats] = await pool.query<RowDataPacket[]>(
          `SELECT company_id, COUNT(*) as bills, COALESCE(SUM(total), 0) as total FROM sales WHERE payment_status != 'cancelled' GROUP BY company_id`
        );
        const [userStats] = await pool.query<RowDataPacket[]>(
          `SELECT company_id, COUNT(*) as cnt FROM users GROUP BY company_id`
        );
        const [prodStats] = await pool.query<RowDataPacket[]>(
          `SELECT company_id, COUNT(*) as cnt FROM products GROUP BY company_id`
        );

        const salesMap = new Map<string, { bills: number; total: number }>();
        salesStats.forEach((s) => salesMap.set(s.company_id, { bills: Number(s.bills) || 0, total: Number(s.total) || 0 }));

        const userCountMap = new Map<string, number>();
        userStats.forEach((u) => userCountMap.set(u.company_id, Number(u.cnt) || 0));

        const prodCountMap = new Map<string, number>();
        prodStats.forEach((p) => prodCountMap.set(p.company_id, Number(p.cnt) || 0));

        rows = allCompanies
          .filter((c) => isAllCompanies || c.id === companyIdParam)
          .map((c) => {
            const sData = salesMap.get(c.id) || { bills: 0, total: 0 };
            return {
              id: c.id,
              name: c.name,
              code: c.code,
              status: c.is_active ? 'Active' : 'Inactive',
              user_count: userCountMap.get(c.id) || 0,
              product_count: prodCountMap.get(c.id) || 0,
              total_bills: sData.bills,
              total_sales: Math.round(sData.total * 100) / 100,
              currency: c.currency || 'INR',
              created_at: c.created_at,
            };
          });

        summary = {
          totalCompanies: rows.length,
          activeCount: rows.filter((r) => r.status === 'Active').length,
          inactiveCount: rows.filter((r) => r.status === 'Inactive').length,
          totalRevenue: Math.round(rows.reduce((acc, r) => acc + r.total_sales, 0) * 100) / 100,
        };
        break;
      }

      // ===========================================================
      // 3. PRODUCTS & INVENTORY REPORTS
      // ===========================================================
      case 'product_performance':
      case 'top_selling_products':
      case 'stock_summary':
      case 'low_stock':
      case 'company_products': {
        reportTitle = reportKey === 'top_selling_products'
          ? 'Top-Selling Products Leaderboard'
          : reportKey === 'low_stock'
          ? 'Low Stock Alerts Report'
          : reportKey === 'stock_summary'
          ? 'Inventory Stock Summary'
          : reportKey === 'company_products'
          ? 'Company Product Catalog Report'
          : 'Product Performance & Sales Velocity';
        category = 'Products';

        columns = [
          { key: 'product_name', label: 'Product Name', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'category_name', label: 'Category', sortable: true },
          { key: 'price', label: 'Selling Price', align: 'right', format: 'currency', sortable: true },
          { key: 'current_stock', label: 'Current Stock', align: 'center', format: 'number', sortable: true },
          { key: 'units_sold', label: 'Units Sold', align: 'center', format: 'number', sortable: true },
          { key: 'revenue_generated', label: 'Revenue Generated', align: 'right', format: 'currency', sortable: true },
        ];

        // Fetch products
        const [prodList] = await pool.query<RowDataPacket[]>(
          `SELECT p.id, p.name, p.company_id, p.category_id, p.price, p.stock
           FROM products p
           ${isAllCompanies ? '' : 'WHERE p.company_id = ?'}`,
          isAllCompanies ? [] : [companyIdParam]
        );

        // Fetch categories
        const [catList] = await pool.query<RowDataPacket[]>('SELECT id, name FROM categories');
        const catMap = new Map<string, string>();
        catList.forEach((c) => catMap.set(c.id, c.name));

        // Aggregate units sold from sales.items
        const [salesItemsRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.items FROM sales s WHERE ${salesFilter} AND s.payment_status != 'cancelled'`,
          salesParams
        );

        const prodVelocityMap = new Map<string, { qty: number; rev: number }>();
        salesItemsRows.forEach((s) => {
          let itms: any[] = [];
          try {
            itms = typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []);
          } catch {
            itms = [];
          }
          if (Array.isArray(itms)) {
            itms.forEach((it) => {
              const prod = it.product || it;
              const pid = prod.id || it.productId || it.product_id || it.name;
              const qty = Number(it.quantity ?? it.qty ?? 1);
              const pr = Number(prod.price ?? it.price ?? 0);
              const rev = Number(it.total ?? (qty * pr));
              if (pid) {
                const cur = prodVelocityMap.get(pid) || { qty: 0, rev: 0 };
                cur.qty += qty;
                cur.rev += rev;
                prodVelocityMap.set(pid, cur);
              }
            });
          }
        });

        rows = prodList.map((p) => {
          const comp = companyMap.get(p.company_id) || { name: 'Unknown' };
          const vel = prodVelocityMap.get(p.id) || { qty: 0, rev: 0 };
          return {
            id: p.id,
            product_name: p.name,
            company_id: p.company_id,
            company_name: comp.name,
            category_name: catMap.get(p.category_id) || 'General',
            price: Number(p.price) || 0,
            current_stock: Number(p.stock) || 0,
            units_sold: Math.round(vel.qty * 10) / 10,
            revenue_generated: Math.round(vel.rev * 100) / 100,
          };
        });

        if (reportKey === 'top_selling_products') {
          rows = rows.filter((r) => r.units_sold > 0).sort((a, b) => b.revenue_generated - a.revenue_generated);
        } else if (reportKey === 'low_stock') {
          rows = rows.filter((r) => r.current_stock <= 5).sort((a, b) => a.current_stock - b.current_stock);
        } else {
          rows.sort((a, b) => b.revenue_generated - a.revenue_generated);
        }

        summary = {
          totalProducts: rows.length,
          totalUnitsSold: rows.reduce((acc, r) => acc + r.units_sold, 0),
          totalRevenue: Math.round(rows.reduce((acc, r) => acc + r.revenue_generated, 0) * 100) / 100,
        };
        break;
      }

      case 'category_sales': {
        reportTitle = 'Category-wise Sales Volume & Revenue Share';
        category = 'Products';
        columns = [
          { key: 'category_name', label: 'Category', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'product_count', label: 'Products', align: 'center', format: 'number', sortable: true },
          { key: 'units_sold', label: 'Units Sold', align: 'center', format: 'number', sortable: true },
          { key: 'revenue', label: 'Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'share_percent', label: 'Share %', align: 'right', format: 'badge', sortable: true },
        ];

        const [catList] = await pool.query<RowDataPacket[]>(
          `SELECT c.id, c.name, c.company_id FROM categories c ${isAllCompanies ? '' : 'WHERE c.company_id = ?'}`,
          isAllCompanies ? [] : [companyIdParam]
        );

        const [prodList] = await pool.query<RowDataPacket[]>('SELECT id, category_id FROM products');
        const catProdCount = new Map<string, number>();
        prodList.forEach((p) => {
          catProdCount.set(p.category_id, (catProdCount.get(p.category_id) || 0) + 1);
        });

        // Compute sales by category
        const [salesRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.items FROM sales s WHERE ${salesFilter} AND s.payment_status != 'cancelled'`,
          salesParams
        );

        const catSalesMap = new Map<string, { qty: number; rev: number }>();
        let overallCatRev = 0;

        salesRows.forEach((s) => {
          let itms: any[] = [];
          try {
            itms = typeof s.items === 'string' ? JSON.parse(s.items) : (s.items || []);
          } catch {
            itms = [];
          }
          if (Array.isArray(itms)) {
            itms.forEach((it) => {
              const prod = it.product || it;
              const catId = prod.categoryId || it.categoryId || it.category_id || 'uncategorized';
              const qty = Number(it.quantity ?? it.qty ?? 1);
              const pr = Number(prod.price ?? it.price ?? 0);
              const rev = Number(it.total ?? (qty * pr));
              overallCatRev += rev;
              const cur = catSalesMap.get(catId) || { qty: 0, rev: 0 };
              cur.qty += qty;
              cur.rev += rev;
              catSalesMap.set(catId, cur);
            });
          }
        });

        rows = catList.map((c) => {
          const comp = companyMap.get(c.company_id) || { name: 'All' };
          const s = catSalesMap.get(c.id) || { qty: 0, rev: 0 };
          return {
            category_name: c.name,
            company_id: c.company_id,
            company_name: comp.name,
            product_count: catProdCount.get(c.id) || 0,
            units_sold: Math.round(s.qty * 10) / 10,
            revenue: Math.round(s.rev * 100) / 100,
            share_percent: overallCatRev > 0 ? `${(Math.round((s.rev / overallCatRev) * 1000) / 10).toFixed(1)}%` : '0%',
          };
        }).sort((a, b) => b.revenue - a.revenue);

        summary = {
          totalCategories: rows.length,
          totalRevenue: Math.round(overallCatRev * 100) / 100,
        };
        break;
      }

      // ===========================================================
      // 4. CUSTOMERS REPORTS
      // ===========================================================
      case 'customer_growth':
      case 'company_customers':
      case 'new_vs_returning': {
        reportTitle = reportKey === 'new_vs_returning'
          ? 'New vs Returning Customers Matrix'
          : reportKey === 'company_customers'
          ? 'Company-wise Customers Distribution'
          : 'Customer Visit & Spend Growth Report';
        category = 'Customers';

        columns = [
          { key: 'name', label: 'Customer Name', sortable: true },
          { key: 'phone', label: 'Phone Number', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'type', label: 'Type', format: 'badge', sortable: true },
          { key: 'visits_count', label: 'Visits / Orders', align: 'center', format: 'number', sortable: true },
          { key: 'total_spent', label: 'Lifetime Spent', align: 'right', format: 'currency', sortable: true },
          { key: 'last_visit', label: 'Last Visit Date', format: 'date', sortable: true },
        ];

        // Gather customers from sales
        const [salesCust] = await pool.query<RowDataPacket[]>(
          `SELECT s.company_id, s.customer_name, s.customer_phone, s.total, s.created_at
           FROM sales s
           WHERE ${salesFilter} AND (s.customer_name IS NOT NULL OR s.customer_phone IS NOT NULL)`,
          salesParams
        );

        const cMap = new Map<string, { name: string; phone: string; companyId: string; visits: number; spent: number; lastDate: string }>();

        salesCust.forEach((s) => {
          const key = (s.customer_phone || s.customer_name || '').trim().toLowerCase();
          if (!key) return;
          const tot = Number(s.total) || 0;
          const dt = new Date(s.created_at).toISOString();
          if (cMap.has(key)) {
            const entry = cMap.get(key)!;
            entry.visits += 1;
            entry.spent += tot;
            if (dt > entry.lastDate) entry.lastDate = dt;
          } else {
            cMap.set(key, {
              name: s.customer_name || 'Customer',
              phone: s.customer_phone || '-',
              companyId: s.company_id || 'COMP-0001',
              visits: 1,
              spent: tot,
              lastDate: dt,
            });
          }
        });

        rows = Array.from(cMap.values()).map((c) => {
          const comp = companyMap.get(c.companyId) || { name: 'Unknown' };
          return {
            name: c.name,
            phone: c.phone,
            company_id: c.companyId,
            company_name: comp.name,
            type: c.visits > 1 ? 'Returning' : 'New',
            visits_count: c.visits,
            total_spent: Math.round(c.spent * 100) / 100,
            last_visit: c.lastDate,
          };
        }).sort((a, b) => b.total_spent - a.total_spent);

        summary = {
          totalCustomers: rows.length,
          newCount: rows.filter((r) => r.type === 'New').length,
          returningCount: rows.filter((r) => r.type === 'Returning').length,
          totalSpent: Math.round(rows.reduce((acc, r) => acc + r.total_spent, 0) * 100) / 100,
        };
        break;
      }

      // ===========================================================
      // 5. STAFF & USERS REPORTS
      // ===========================================================
      case 'user_activity':
      case 'staff_summary':
      case 'company_admin':
      case 'role_wise_users': {
        reportTitle = reportKey === 'company_admin'
          ? 'Company Admin Directory Report'
          : reportKey === 'role_wise_users'
          ? 'Role-wise User Directory'
          : reportKey === 'staff_summary'
          ? 'Staff & Employee Directory Report'
          : 'User Activity & Role Audit Report';
        category = 'Staff & Users';

        columns = [
          { key: 'name', label: 'Full Name', sortable: true },
          { key: 'username', label: 'Username', sortable: true },
          { key: 'role', label: 'Role', format: 'badge', sortable: true },
          { key: 'company_name', label: 'Assigned Company', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
          { key: 'bills_handled', label: 'Bills Created', align: 'center', format: 'number', sortable: true },
          { key: 'sales_generated', label: 'Revenue Generated', align: 'right', format: 'currency', sortable: true },
        ];

        // Fetch users
        const [uList] = await pool.query<RowDataPacket[]>(
          `SELECT u.id, u.name, u.username, u.role, u.company_id, u.is_active
           FROM users u
           ${isAllCompanies ? '' : 'WHERE u.company_id = ?'}`,
          isAllCompanies ? [] : [companyIdParam]
        );

        // Fetch performance per user
        const [userSales] = await pool.query<RowDataPacket[]>(
          `SELECT s.created_by, COUNT(*) as bills, COALESCE(SUM(s.total), 0) as total
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'
           GROUP BY s.created_by`,
          salesParams
        );

        const uSalesMap = new Map<string, { bills: number; total: number }>();
        userSales.forEach((us) => {
          const k = (us.created_by || '').toLowerCase();
          uSalesMap.set(k, { bills: Number(us.bills) || 0, total: Number(us.total) || 0 });
        });

        rows = uList.map((u) => {
          const comp = companyMap.get(u.company_id) || { name: 'Super Admin System' };
          const uname = (u.username || '').toLowerCase();
          const s = uSalesMap.get(uname) || { bills: 0, total: 0 };
          return {
            id: u.id,
            name: u.name || u.username,
            username: u.username,
            role: u.role || 'cashier',
            company_id: u.company_id,
            company_name: comp.name,
            status: u.is_active ? 'Active' : 'Inactive',
            bills_handled: s.bills,
            sales_generated: Math.round(s.total * 100) / 100,
          };
        });

        if (reportKey === 'company_admin') {
          rows = rows.filter((r) => r.role === 'company_admin');
        }

        summary = {
          totalUsers: rows.length,
          activeUsers: rows.filter((r) => r.status === 'Active').length,
          totalRevenueHandled: Math.round(rows.reduce((acc, r) => acc + r.sales_generated, 0) * 100) / 100,
        };
        break;
      }

      case 'attendance_report': {
        reportTitle = 'Staff Attendance & Working Hours Report';
        category = 'Staff & Users';
        columns = [
          { key: 'staff_name', label: 'Staff Member', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'date', label: 'Date', format: 'date', sortable: true },
          { key: 'clock_in', label: 'Clock In', sortable: true },
          { key: 'clock_out', label: 'Clock Out', sortable: true },
          { key: 'working_hours', label: 'Working Hours', align: 'center', format: 'number', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
        ];

        const [attRows] = await pool.query<RowDataPacket[]>(
          `SELECT a.id, a.company_id, a.date, a.clock_in, a.clock_out, a.working_hours, a.status, s.name as staff_name
           FROM attendance a
           LEFT JOIN staff s ON a.staff_id = s.id
           ${isAllCompanies ? '' : 'WHERE a.company_id = ?'}
           ORDER BY a.date DESC LIMIT 200`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = attRows.map((a) => {
          const comp = companyMap.get(a.company_id) || { name: 'Unknown' };
          return {
            id: a.id,
            staff_name: a.staff_name || 'Staff',
            company_id: a.company_id,
            company_name: comp.name,
            date: a.date,
            clock_in: a.clock_in ? new Date(a.clock_in).toLocaleTimeString() : '-',
            clock_out: a.clock_out ? new Date(a.clock_out).toLocaleTimeString() : '-',
            working_hours: Number(a.working_hours) || 0,
            status: a.status || 'Present',
          };
        });

        summary = {
          totalRecords: rows.length,
          totalHours: Math.round(rows.reduce((acc, r) => acc + r.working_hours, 0) * 10) / 10,
        };
        break;
      }

      case 'shifts_report': {
        reportTitle = 'Cashier Shifts & Reconciliation Report';
        category = 'Staff & Users';
        columns = [
          { key: 'id', label: 'Shift ID', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'cashier_name', label: 'Cashier', sortable: true },
          { key: 'opened_at', label: 'Opened At', format: 'date', sortable: true },
          { key: 'closed_at', label: 'Closed At', format: 'date', sortable: true },
          { key: 'opening_cash', label: 'Opening Cash', align: 'right', format: 'currency', sortable: true },
          { key: 'cash_sales', label: 'Cash Sales', align: 'right', format: 'currency', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
        ];

        const [shiftRows] = await pool.query<RowDataPacket[]>(
          `SELECT sh.id, sh.company_id, sh.cashier_id, sh.opened_at, sh.closed_at, sh.opening_cash, sh.cash_sales, sh.status, u.username as cashier_name
           FROM shifts sh
           LEFT JOIN users u ON sh.cashier_id = u.id
           ${isAllCompanies ? '' : 'WHERE sh.company_id = ?'}
           ORDER BY sh.opened_at DESC`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = shiftRows.map((s) => {
          const comp = companyMap.get(s.company_id) || { name: 'Unknown' };
          return {
            id: s.id,
            company_id: s.company_id,
            company_name: comp.name,
            cashier_name: s.cashier_name || 'Cashier',
            opened_at: s.opened_at,
            closed_at: s.closed_at || 'In Progress',
            opening_cash: Number(s.opening_cash) || 0,
            cash_sales: Number(s.cash_sales) || 0,
            status: s.status || 'Closed',
          };
        });

        summary = {
          totalShifts: rows.length,
        };
        break;
      }

      // ===========================================================
      // 6. ORDERS & DELIVERY REPORTS
      // ===========================================================
      case 'dine_in_orders':
      case 'takeaway_orders':
      case 'delivery_orders':
      case 'online_orders':
      case 'delivery_performance': {
        reportTitle = reportKey === 'dine_in_orders'
          ? 'Dine-In Orders & Table Turnover Report'
          : reportKey === 'takeaway_orders'
          ? 'Takeaway & Pickup Orders Report'
          : reportKey === 'delivery_orders'
          ? 'Delivery Orders Log & Dispatch Status'
          : reportKey === 'online_orders'
          ? 'Online Platform Orders (Zomato / Swiggy / Direct)'
          : 'Delivery Rider Performance & Times';
        category = 'Orders & Delivery';

        columns = [
          { key: 'bill_number', label: 'Order / Bill', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'order_type', label: 'Channel', format: 'badge', sortable: true },
          { key: 'customer_name', label: 'Customer', sortable: true },
          { key: 'total', label: 'Order Value', align: 'right', format: 'currency', sortable: true },
          { key: 'payment_status', label: 'Status', format: 'badge', sortable: true },
          { key: 'created_at', label: 'Order Time', format: 'date', sortable: true },
        ];

        let typeCondition = "1=1";
        if (reportKey === 'dine_in_orders') typeCondition = "s.order_type LIKE '%Dine%'";
        else if (reportKey === 'takeaway_orders') typeCondition = "s.order_type LIKE '%Take%' OR s.order_type LIKE '%Pick%'";
        else if (reportKey === 'delivery_orders') typeCondition = "s.order_type LIKE '%Delivery%'";
        else if (reportKey === 'online_orders') typeCondition = "s.order_source LIKE '%online%' OR s.payment_method LIKE '%online%' OR s.payment_method LIKE '%zomato%' OR s.payment_method LIKE '%swiggy%'";

        const [orderRows] = await pool.query<RowDataPacket[]>(
          `SELECT s.id, s.bill_number, s.company_id, s.order_type, s.customer_name, s.customer_phone,
                  s.total, s.payment_status, s.created_at, s.items
           FROM sales s
           WHERE ${salesFilter} AND ${typeCondition}
           ORDER BY s.created_at DESC`,
          salesParams
        );

        rows = orderRows.map((o) => {
          const comp = companyMap.get(o.company_id) || { name: 'Unknown' };
          let itms: any[] = [];
          try {
            itms = typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []);
          } catch {
            itms = [];
          }
          return {
            id: o.id,
            bill_number: o.bill_number || o.id,
            company_id: o.company_id,
            company_name: comp.name,
            order_type: o.order_type || 'Order',
            customer_name: o.customer_name || 'Walk-in',
            customer_phone: o.customer_phone || '-',
            total: Number(o.total) || 0,
            payment_status: o.payment_status || 'paid',
            created_at: o.created_at,
            items: itms,
          };
        });

        summary = {
          totalOrders: rows.length,
          totalRevenue: Math.round(rows.reduce((acc, r) => acc + r.total, 0) * 100) / 100,
        };
        break;
      }

      // ===========================================================
      // 7. FINANCIAL REPORTS
      // ===========================================================
      case 'total_sales_summary': {
        reportTitle = 'Executive Sales & Revenue Summary';
        category = 'Financial';
        columns = [
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'total_bills', label: 'Bills Issued', align: 'center', format: 'number', sortable: true },
          { key: 'gross_sales', label: 'Gross Revenue', align: 'right', format: 'currency', sortable: true },
          { key: 'total_tax', label: 'Taxes Collected', align: 'right', format: 'currency', sortable: true },
          { key: 'total_discount', label: 'Discounts Granted', align: 'right', format: 'currency', sortable: true },
          { key: 'net_intake', label: 'Net Intake', align: 'right', format: 'currency', sortable: true },
        ];

        const [salesSum] = await pool.query<RowDataPacket[]>(
          `SELECT s.company_id, COUNT(*) as bills,
                  COALESCE(SUM(s.subtotal), 0) as subtotal,
                  COALESCE(SUM(s.tax), 0) as tax,
                  COALESCE(SUM(s.discount), 0) as discount,
                  COALESCE(SUM(s.total), 0) as total
           FROM sales s
           WHERE ${salesFilter} AND s.payment_status != 'cancelled'
           GROUP BY s.company_id`,
          salesParams
        );

        rows = salesSum.map((s) => {
          const comp = companyMap.get(s.company_id) || { name: 'Unknown' };
          const tot = Number(s.total) || 0;
          return {
            company_id: s.company_id,
            company_name: comp.name,
            total_bills: Number(s.bills) || 0,
            gross_sales: Math.round(Number(s.subtotal) * 100) / 100,
            total_tax: Math.round(Number(s.tax) * 100) / 100,
            total_discount: Math.round(Number(s.discount) * 100) / 100,
            net_intake: Math.round(tot * 100) / 100,
          };
        });

        summary = {
          totalBills: rows.reduce((acc, r) => acc + r.total_bills, 0),
          netIntake: Math.round(rows.reduce((acc, r) => acc + r.net_intake, 0) * 100) / 100,
        };
        break;
      }

      case 'expenses_report': {
        reportTitle = 'Operating Expenses & Outflows Report';
        category = 'Financial';
        columns = [
          { key: 'expense_date', label: 'Expense Date', format: 'date', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'category', label: 'Category', format: 'badge', sortable: true },
          { key: 'description', label: 'Description', sortable: true },
          { key: 'amount', label: 'Amount', align: 'right', format: 'currency', sortable: true },
          { key: 'payment_method', label: 'Payment Method', format: 'badge', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
        ];

        const [expRows] = await pool.query<RowDataPacket[]>(
          `SELECT e.id, e.company_id, e.expense_date, e.category, e.description, e.amount, e.payment_method, e.status
           FROM expenses e
           WHERE ${isAllCompanies ? '1=1' : 'e.company_id = ?'}
           ORDER BY e.expense_date DESC`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = expRows.map((e) => {
          const comp = companyMap.get(e.company_id) || { name: 'Unknown' };
          return {
            id: e.id,
            expense_date: e.expense_date,
            company_id: e.company_id,
            company_name: comp.name,
            category: e.category || 'General',
            description: e.description || '-',
            amount: Number(e.amount) || 0,
            payment_method: e.payment_method || 'Cash',
            status: e.status || 'Approved',
          };
        });

        summary = {
          expenseCount: rows.length,
          totalExpenses: Math.round(rows.reduce((acc, r) => acc + r.amount, 0) * 100) / 100,
        };
        break;
      }

      case 'profit_loss_report': {
        reportTitle = 'Profit & Loss Statement (Operating Summary)';
        category = 'Financial';
        notes = 'Notice: Product COGS (Cost of Goods Sold) is not recorded in the database inventory tables. Gross profit is withheld to prevent misleading reports. Operating Cash Flow reflects Sales minus Operating Expenses.';

        columns = [
          { key: 'line_item', label: 'Accounting Line Item', sortable: true },
          { key: 'category', label: 'Type', format: 'badge', sortable: true },
          { key: 'amount', label: 'Amount', align: 'right', format: 'currency', sortable: true },
          { key: 'notes', label: 'Accounting Notes', sortable: true },
        ];

        const [sRow] = await pool.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(s.total), 0) as tot_sales, COALESCE(SUM(s.tax), 0) as tot_tax, COALESCE(SUM(s.discount), 0) as tot_disc
           FROM sales s WHERE ${salesFilter} AND s.payment_status != 'cancelled'`,
          salesParams
        );

        const [eRow] = await pool.query<RowDataPacket[]>(
          `SELECT COALESCE(SUM(amount), 0) as tot_exp FROM expenses WHERE ${isAllCompanies ? '1=1' : 'company_id = ?'}`,
          isAllCompanies ? [] : [companyIdParam]
        );

        const grossSales = Number(sRow[0]?.tot_sales) || 0;
        const totalTax = Number(sRow[0]?.tot_tax) || 0;
        const totalDisc = Number(sRow[0]?.tot_disc) || 0;
        const totalExp = Number(eRow[0]?.tot_exp) || 0;
        const netCashIntake = grossSales - totalExp;

        rows = [
          { line_item: 'Total Sales Revenue (Gross)', category: 'Income', amount: grossSales, notes: 'Actual receipts from terminal and delivery bills' },
          { line_item: 'Customer Discounts Granted', category: 'Deduction', amount: totalDisc, notes: 'Promotional and cashier discounts' },
          { line_item: 'Taxes & GST Collected', category: 'Liability', amount: totalTax, notes: 'Payable to government tax authorities' },
          { line_item: 'Cost of Goods Sold (COGS)', category: 'Cost', amount: 0, notes: 'DATA UNAVAILABLE - Raw material purchase costs not tracked' },
          { line_item: 'Operating Expenses (Salaries, Utilities, Rent)', category: 'Expense', amount: totalExp, notes: 'Approved expenses recorded in system' },
          { line_item: 'Operating Cash Flow (Sales - Expenses)', category: 'Summary', amount: netCashIntake, notes: 'Surplus cash flow before inventory COGS deduction' },
        ];

        summary = {
          totalIncome: grossSales,
          totalExpenses: totalExp,
          netCashFlow: netCashIntake,
        };
        break;
      }

      case 'tax_summary':
      case 'payment_collection':
      default: {
        reportTitle = 'Payment Collections Ledger Report';
        category = 'Financial';
        columns = [
          { key: 'id', label: 'Receipt / Payment ID', sortable: true },
          { key: 'company_name', label: 'Company', sortable: true },
          { key: 'sale_id', label: 'Sale ID', sortable: true },
          { key: 'amount', label: 'Amount', align: 'right', format: 'currency', sortable: true },
          { key: 'payment_method', label: 'Method', format: 'badge', sortable: true },
          { key: 'status', label: 'Status', format: 'badge', sortable: true },
          { key: 'created_at', label: 'Timestamp', format: 'date', sortable: true },
        ];

        const [pRows] = await pool.query<RowDataPacket[]>(
          `SELECT p.id, p.company_id, p.sale_id, p.amount, p.payment_method, p.status, p.created_at
           FROM payments p
           WHERE ${isAllCompanies ? '1=1' : 'p.company_id = ?'}
           ORDER BY p.created_at DESC LIMIT 300`,
          isAllCompanies ? [] : [companyIdParam]
        );

        rows = pRows.map((p) => {
          const comp = companyMap.get(p.company_id) || { name: 'Unknown' };
          return {
            id: p.id,
            company_id: p.company_id,
            company_name: comp.name,
            sale_id: p.sale_id || '-',
            amount: Number(p.amount) || 0,
            payment_method: p.payment_method || 'Cash',
            status: p.status || 'paid',
            created_at: p.created_at,
          };
        });

        summary = {
          totalPayments: rows.length,
          totalAmount: Math.round(rows.reduce((acc, r) => acc + r.amount, 0) * 100) / 100,
        };
        break;
      }
    }

    return NextResponse.json({
      success: true,
      reportKey,
      reportTitle,
      category,
      scope: {
        companyId: companyIdParam,
        companyName: targetCompanyName,
        isAllCompanies,
        preset: dateRange.preset,
        dateRange: {
          start: dateRange.currentStartSql,
          end: dateRange.currentEndSql,
        },
      },
      columns,
      rows,
      summary,
      totalRecords: rows.length,
      notes,
    });
  } catch (err: any) {
    console.error('GET /api/super-admin/reports error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
