import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getSession } from '@/lib/auth-session';
import { RowDataPacket } from 'mysql2';

import { resolveAnalyticsDateRanges } from '@/lib/super-admin-analytics';

const pad = (n: number) => String(n).padStart(2, '0');



function calculateChange(current: number, previous: number): { percent: number; trend: 'up' | 'down' | 'neutral' } {
  if (previous === 0) {
    if (current > 0) return { percent: 100, trend: 'up' };
    if (current < 0) return { percent: -100, trend: 'down' };
    return { percent: 0, trend: 'neutral' };
  }
  const pct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  return {
    percent: pct,
    trend: pct > 0 ? 'up' : pct < 0 ? 'down' : 'neutral',
  };
}

export async function GET(request: Request) {
  try {
    if (!isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Super Admin Analytics requires local MySQL mode.' }, { status: 400 });
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
    const companyIdParam = searchParams.get('companyId') || 'all';
    const presetParam = searchParams.get('preset') || '30days';
    const customStartParam = searchParams.get('startDate');
    const customEndParam = searchParams.get('endDate');

    const dateRange = resolveAnalyticsDateRanges(presetParam, customStartParam, customEndParam);

    const isAllCompanies = companyIdParam === 'all' || !companyIdParam;

    // Base filters
    const companySalesCurrentFilter = isAllCompanies
      ? 's.created_at >= ? AND s.created_at <= ?'
      : 's.company_id = ? AND s.created_at >= ? AND s.created_at <= ?';

    const companySalesCurrentParams = isAllCompanies
      ? [dateRange.currentStartSql, dateRange.currentEndSql]
      : [companyIdParam, dateRange.currentStartSql, dateRange.currentEndSql];

    const companySalesPreviousParams = isAllCompanies
      ? [dateRange.previousStartSql, dateRange.previousEndSql]
      : [companyIdParam, dateRange.previousStartSql, dateRange.previousEndSql];

    // 1. Fetch Registered Companies List
    const [allCompanies] = await pool.query<RowDataPacket[]>(
      'SELECT id, name, code, is_active, currency, created_at FROM companies ORDER BY name ASC'
    );

    const totalCompaniesCount = allCompanies.length;
    const activeCompaniesCount = allCompanies.filter((c) => c.is_active === 1).length;
    const inactiveCompaniesCount = allCompanies.filter((c) => c.is_active === 0).length;

    // 2. Fetch Users Breakdown
    const userCompanyClause = isAllCompanies ? '' : 'WHERE u.company_id = ? OR uc.company_id = ?';
    const userCompanyParams = isAllCompanies ? [] : [companyIdParam, companyIdParam];

    const [userRows] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT u.id, u.username, u.role, u.company_id, u.is_active
       FROM users u
       LEFT JOIN user_companies uc ON u.id = uc.user_id
       ${userCompanyClause}`,
      userCompanyParams
    );

    const totalUsersCount = userRows.length;
    const roleCounts: Record<string, number> = {
      super_admin: 0,
      company_admin: 0,
      cashier: 0,
      manager: 0,
      waiter: 0,
      chef: 0,
      staff: 0,
    };

    userRows.forEach((u) => {
      const r = (u.role || 'cashier').toLowerCase();
      if (roleCounts[r] !== undefined) {
        roleCounts[r] += 1;
      } else {
        roleCounts.staff += 1;
      }
    });

    // 3. Fetch Staff Table Breakdown
    const staffCompanyClause = isAllCompanies ? '' : 'WHERE company_id = ?';
    const staffCompanyParams = isAllCompanies ? [] : [companyIdParam];

    const [staffRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, company_id, name, role, is_active FROM staff ${staffCompanyClause}`,
      staffCompanyParams
    );

    const totalStaffCount = staffRows.length;
    const staffRoleBreakdown: Record<string, number> = {
      cashier: 0,
      manager: 0,
      waiter: 0,
      chef: 0,
      other: 0,
    };

    staffRows.forEach((st) => {
      const r = (st.role || '').toLowerCase();
      if (r.includes('cashier')) staffRoleBreakdown.cashier += 1;
      else if (r.includes('waiter')) staffRoleBreakdown.waiter += 1;
      else if (r.includes('manager')) staffRoleBreakdown.manager += 1;
      else if (r.includes('chef') || r.includes('cook')) staffRoleBreakdown.chef += 1;
      else staffRoleBreakdown.other += 1;
    });

    // 4. Products Overview
    const productCompanyClause = isAllCompanies ? '' : 'WHERE company_id = ?';
    const productCompanyParams = isAllCompanies ? [] : [companyIdParam];

    const [prodRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, company_id, category_id, price, stock FROM products ${productCompanyClause}`,
      productCompanyParams
    );

    const totalProductsCount = prodRows.length;
    const lowStockCount = prodRows.filter((p) => Number(p.stock) <= 5).length;

    // 5. Customers Overview
    const [custRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, phone, company_id, created_at FROM customers ${staffCompanyClause}`,
      staffCompanyParams
    );
    const registeredCustomersCount = custRows.length;

    // 6. Current Period Sales
    const [currentSales] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.bill_number, s.company_id, s.subtotal, s.discount, s.tax, s.total,
              s.payment_method, s.payment_status, s.order_type, s.customer_name, s.customer_phone,
              s.created_by, s.created_at, s.items
       FROM sales s
       WHERE ${companySalesCurrentFilter} AND s.payment_status != 'cancelled'
       ORDER BY s.created_at ASC`,
      companySalesCurrentParams
    );

    // Previous Period Sales for Trend Comparison
    const companySalesPreviousFilter = isAllCompanies
      ? 's.created_at >= ? AND s.created_at <= ?'
      : 's.company_id = ? AND s.created_at >= ? AND s.created_at <= ?';

    const [prevSales] = await pool.query<RowDataPacket[]>(
      `SELECT s.id, s.total, s.created_at
       FROM sales s
       WHERE ${companySalesPreviousFilter} AND s.payment_status != 'cancelled'`,
      companySalesPreviousParams
    );

    let currentSalesTotal = 0;
    let currentBillsCount = currentSales.length;
    let currentSubtotal = 0;
    let currentDiscount = 0;
    let currentTax = 0;

    currentSales.forEach((s) => {
      currentSalesTotal += Number(s.total) || 0;
      currentSubtotal += Number(s.subtotal) || 0;
      currentDiscount += Number(s.discount) || 0;
      currentTax += Number(s.tax) || 0;
    });

    let prevSalesTotal = 0;
    let prevBillsCount = prevSales.length;
    prevSales.forEach((s) => {
      prevSalesTotal += Number(s.total) || 0;
    });

    const salesChange = calculateChange(currentSalesTotal, prevSalesTotal);
    const billsChange = calculateChange(currentBillsCount, prevBillsCount);
    const avgBillCurrent = currentBillsCount > 0 ? currentSalesTotal / currentBillsCount : 0;
    const avgBillPrev = prevBillsCount > 0 ? prevSalesTotal / prevBillsCount : 0;
    const aovChange = calculateChange(avgBillCurrent, avgBillPrev);

    // 7. Expenses
    const expenseCompanyClauseCurrent = isAllCompanies
      ? 'expense_date >= DATE(?) AND expense_date <= DATE(?)'
      : 'company_id = ? AND expense_date >= DATE(?) AND expense_date <= DATE(?)';

    const expenseParamsCurrent = isAllCompanies
      ? [dateRange.currentStartSql, dateRange.currentEndSql]
      : [companyIdParam, dateRange.currentStartSql, dateRange.currentEndSql];

    const expenseParamsPrevious = isAllCompanies
      ? [dateRange.previousStartSql, dateRange.previousEndSql]
      : [companyIdParam, dateRange.previousStartSql, dateRange.previousEndSql];

    const [currentExpensesRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, company_id, amount, category, expense_date FROM expenses WHERE ${expenseCompanyClauseCurrent}`,
      expenseParamsCurrent
    );

    const [prevExpensesRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, amount FROM expenses WHERE ${expenseCompanyClauseCurrent}`,
      expenseParamsPrevious
    );

    const currentExpensesTotal = currentExpensesRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const prevExpensesTotal = prevExpensesRows.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
    const expensesChange = calculateChange(currentExpensesTotal, prevExpensesTotal);

    // 8. Orders Count (Sales + Dine In Orders + Deliveries)
    const [dineInOrdersRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, company_id, total_amount, kitchen_status, serving_status, created_at 
       FROM dine_in_orders 
       WHERE ${isAllCompanies ? 'created_at >= ? AND created_at <= ?' : 'company_id = ? AND created_at >= ? AND created_at <= ?'}`,
      companySalesCurrentParams
    );

    const [deliveryRows] = await pool.query<RowDataPacket[]>(
      `SELECT id, company_id, delivery_status, assignment_status, created_at 
       FROM deliveries 
       WHERE ${isAllCompanies ? 'created_at >= ? AND created_at <= ?' : 'company_id = ? AND created_at >= ? AND created_at <= ?'}`,
      companySalesCurrentParams
    );

    const totalOrdersCount = currentBillsCount + (dineInOrdersRows.length > 0 ? dineInOrdersRows.length : 0);
    const ordersChange = billsChange;

    // 9. All Distinct Customers (from sales phone/name + registered table)
    const customerMap = new Map<string, { name: string; phone: string; visits: number; spent: number; firstDate: string; lastDate: string }>();
    currentSales.forEach((s) => {
      const key = (s.customer_phone || s.customer_name || '').trim().toLowerCase();
      if (!key) return;
      const existing = customerMap.get(key);
      const total = Number(s.total) || 0;
      const dt = new Date(s.created_at).toISOString();
      if (existing) {
        existing.visits += 1;
        existing.spent += total;
        if (dt > existing.lastDate) existing.lastDate = dt;
      } else {
        customerMap.set(key, {
          name: s.customer_name || 'Customer',
          phone: s.customer_phone || '',
          visits: 1,
          spent: total,
          firstDate: dt,
          lastDate: dt,
        });
      }
    });

    const activeCustomersList = Array.from(customerMap.values());
    const totalCustomersInPeriod = activeCustomersList.length;
    const newCustomersCount = activeCustomersList.filter((c) => c.visits === 1).length;
    const returningCustomersCount = activeCustomersList.filter((c) => c.visits > 1).length;

    // -------------------------------------------------------------
    // CHART 1: SALES TIMELINE (Daily / Hourly points)
    // -------------------------------------------------------------
    const isHourlyTimeline = dateRange.preset === 'today' || dateRange.preset === 'yesterday';
    let timelinePoints: { label: string; date: string; amount: number; bills: number; aov: number }[] = [];

    if (isHourlyTimeline) {
      const hourlyMap = new Array(24).fill(0).map((_, i) => ({
        hour: i,
        label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
        date: `${i}:00`,
        amount: 0,
        bills: 0,
      }));

      currentSales.forEach((s) => {
        const dt = new Date(s.created_at);
        const h = dt.getHours();
        if (h >= 0 && h < 24) {
          hourlyMap[h].amount += Number(s.total) || 0;
          hourlyMap[h].bills += 1;
        }
      });

      timelinePoints = hourlyMap.map((h) => ({
        label: h.label,
        date: h.date,
        amount: Math.round(h.amount * 100) / 100,
        bills: h.bills,
        aov: h.bills > 0 ? Math.round((h.amount / h.bills) * 100) / 100 : 0,
      }));
    } else {
      const dayMap = new Map<string, { label: string; date: string; amount: number; bills: number }>();
      const cur = new Date(dateRange.currentStart);
      const endLimit = new Date(dateRange.currentEnd);

      while (cur <= endLimit) {
        const key = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
        const dayLabel = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        dayMap.set(key, { label: dayLabel, date: key, amount: 0, bills: 0 });
        cur.setDate(cur.getDate() + 1);
      }

      currentSales.forEach((s) => {
        const dt = new Date(s.created_at);
        const key = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
        if (dayMap.has(key)) {
          const entry = dayMap.get(key)!;
          entry.amount += Number(s.total) || 0;
          entry.bills += 1;
        }
      });

      timelinePoints = Array.from(dayMap.values()).map((d) => ({
        label: d.label,
        date: d.date,
        amount: Math.round(d.amount * 100) / 100,
        bills: d.bills,
        aov: d.bills > 0 ? Math.round((d.amount / d.bills) * 100) / 100 : 0,
      }));
    }

    // -------------------------------------------------------------
    // CHART 2: COMPANY-WISE SALES & BILLS COMPARISON
    // -------------------------------------------------------------
    const companySalesMap = new Map<string, { id: string; name: string; code: string; sales: number; bills: number; customers: number }>();
    allCompanies.forEach((c) => {
      companySalesMap.set(c.id, {
        id: c.id,
        name: c.name,
        code: c.code,
        sales: 0,
        bills: 0,
        customers: 0,
      });
    });

    currentSales.forEach((s) => {
      const cid = s.company_id || 'COMP-0001';
      const cEntry = companySalesMap.get(cid);
      if (cEntry) {
        cEntry.sales += Number(s.total) || 0;
        cEntry.bills += 1;
      }
    });

    // Count customers per company
    custRows.forEach((c) => {
      const entry = companySalesMap.get(c.company_id);
      if (entry) entry.customers += 1;
    });

    const companyAnalyticsData = Array.from(companySalesMap.values()).map((c) => ({
      ...c,
      sales: Math.round(c.sales * 100) / 100,
      aov: c.bills > 0 ? Math.round((c.sales / c.bills) * 100) / 100 : 0,
    })).sort((a, b) => b.sales - a.sales);

    // -------------------------------------------------------------
    // CHART 3: PRODUCT & CATEGORY ANALYTICS (Top selling / Least selling)
    // -------------------------------------------------------------
    const productSalesMap = new Map<string, { id: string; name: string; categoryId: string; quantity: number; revenue: number }>();
    const categorySalesMap = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();

    // Fetch categories to resolve names
    const [catRows] = await pool.query<RowDataPacket[]>('SELECT id, name FROM categories');
    const catNameMap = new Map<string, string>();
    catRows.forEach((c) => catNameMap.set(c.id, c.name));

    currentSales.forEach((s) => {
      let itemsList: any[] = [];
      try {
        if (typeof s.items === 'string') {
          itemsList = JSON.parse(s.items);
        } else if (Array.isArray(s.items)) {
          itemsList = s.items;
        }
      } catch {
        itemsList = [];
      }

      if (Array.isArray(itemsList)) {
        itemsList.forEach((it) => {
          const prod = it.product || it;
          const pid = prod.id || it.productId || it.product_id || it.name || 'unknown';
          const name = prod.name || it.product_name || it.name || 'Unnamed Product';
          const catId = prod.categoryId || it.categoryId || it.category_id || 'uncategorized';
          const qty = Number(it.quantity ?? it.qty ?? 1);
          const price = Number(prod.price ?? it.price ?? it.unit_price ?? 0);
          const revenue = Number(it.total ?? (qty * price));

          // Product aggregation
          const pEntry = productSalesMap.get(pid);
          if (pEntry) {
            pEntry.quantity += qty;
            pEntry.revenue += revenue;
          } else {
            productSalesMap.set(pid, {
              id: pid,
              name,
              categoryId: catId,
              quantity: qty,
              revenue,
            });
          }

          // Category aggregation
          const catName = catNameMap.get(catId) || 'General Menu';
          const cEntry = categorySalesMap.get(catId);
          if (cEntry) {
            cEntry.quantity += qty;
            cEntry.revenue += revenue;
          } else {
            categorySalesMap.set(catId, {
              id: catId,
              name: catName,
              quantity: qty,
              revenue,
            });
          }
        });
      }
    });

    const sortedProducts = Array.from(productSalesMap.values()).map((p) => ({
      ...p,
      quantity: Math.round(p.quantity * 10) / 10,
      revenue: Math.round(p.revenue * 100) / 100,
    })).sort((a, b) => b.revenue - a.revenue);

    const topSellingProducts = sortedProducts.slice(0, 10);
    const leastSellingProducts = sortedProducts.slice(-5).reverse();

    const categoryAnalyticsData = Array.from(categorySalesMap.values()).map((c) => ({
      ...c,
      quantity: Math.round(c.quantity * 10) / 10,
      revenue: Math.round(c.revenue * 100) / 100,
      percent: currentSalesTotal > 0 ? Math.round((c.revenue / currentSalesTotal) * 1000) / 10 : 0,
    })).sort((a, b) => b.revenue - a.revenue);

    // -------------------------------------------------------------
    // CHART 4: PAYMENT METHODS & ORDER TYPES BREAKDOWN
    // -------------------------------------------------------------
    const paymentMethodsMap: Record<string, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      upi: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      online: { amount: 0, count: 0 },
      credit: { amount: 0, count: 0 },
    };

    const orderTypesMap: Record<string, { amount: number; count: number }> = {
      dine_in: { amount: 0, count: 0 },
      takeaway: { amount: 0, count: 0 },
      delivery: { amount: 0, count: 0 },
      online: { amount: 0, count: 0 },
    };

    currentSales.forEach((s) => {
      const tot = Number(s.total) || 0;
      const pm = (s.payment_method || 'Cash').toLowerCase();
      const ot = (s.order_type || 'Dine In').toLowerCase();

      if (pm.includes('cash')) {
        paymentMethodsMap.cash.amount += tot;
        paymentMethodsMap.cash.count += 1;
      } else if (pm.includes('upi') || pm.includes('qr')) {
        paymentMethodsMap.upi.amount += tot;
        paymentMethodsMap.upi.count += 1;
      } else if (pm.includes('card')) {
        paymentMethodsMap.card.amount += tot;
        paymentMethodsMap.card.count += 1;
      } else if (pm.includes('online') || pm.includes('swiggy') || pm.includes('zomato')) {
        paymentMethodsMap.online.amount += tot;
        paymentMethodsMap.online.count += 1;
      } else {
        paymentMethodsMap.credit.amount += tot;
        paymentMethodsMap.credit.count += 1;
      }

      if (ot.includes('dine')) {
        orderTypesMap.dine_in.amount += tot;
        orderTypesMap.dine_in.count += 1;
      } else if (ot.includes('take') || ot.includes('pick')) {
        orderTypesMap.takeaway.amount += tot;
        orderTypesMap.takeaway.count += 1;
      } else if (ot.includes('delivery')) {
        orderTypesMap.delivery.amount += tot;
        orderTypesMap.delivery.count += 1;
      } else {
        orderTypesMap.online.amount += tot;
        orderTypesMap.online.count += 1;
      }
    });

    const paymentDonutSlices = [
      {
        method: 'cash',
        label: 'Cash',
        amount: Math.round(paymentMethodsMap.cash.amount * 100) / 100,
        count: paymentMethodsMap.cash.count,
        percent: currentSalesTotal > 0 ? Math.round((paymentMethodsMap.cash.amount / currentSalesTotal) * 1000) / 10 : 0,
        color: '#10B981',
      },
      {
        method: 'upi',
        label: 'UPI / QR',
        amount: Math.round(paymentMethodsMap.upi.amount * 100) / 100,
        count: paymentMethodsMap.upi.count,
        percent: currentSalesTotal > 0 ? Math.round((paymentMethodsMap.upi.amount / currentSalesTotal) * 1000) / 10 : 0,
        color: '#8B5CF6',
      },
      {
        method: 'card',
        label: 'Card POS',
        amount: Math.round(paymentMethodsMap.card.amount * 100) / 100,
        count: paymentMethodsMap.card.count,
        percent: currentSalesTotal > 0 ? Math.round((paymentMethodsMap.card.amount / currentSalesTotal) * 1000) / 10 : 0,
        color: '#06B6D4',
      },
      {
        method: 'online',
        label: 'Online Aggregators',
        amount: Math.round(paymentMethodsMap.online.amount * 100) / 100,
        count: paymentMethodsMap.online.count,
        percent: currentSalesTotal > 0 ? Math.round((paymentMethodsMap.online.amount / currentSalesTotal) * 1000) / 10 : 0,
        color: '#EC4899',
      },
      {
        method: 'credit',
        label: 'Bill Only / Credit',
        amount: Math.round(paymentMethodsMap.credit.amount * 100) / 100,
        count: paymentMethodsMap.credit.count,
        percent: currentSalesTotal > 0 ? Math.round((paymentMethodsMap.credit.amount / currentSalesTotal) * 1000) / 10 : 0,
        color: '#F59E0B',
      },
    ].filter((s) => s.amount > 0 || currentSalesTotal === 0);

    // -------------------------------------------------------------
    // CHART 5: ORDER STATUS BREAKDOWN (Completed, Pending, Cancelled)
    // -------------------------------------------------------------
    const orderStatusBreakdown = {
      completed: currentBillsCount,
      pending: deliveryRows.filter((d) => d.delivery_status === 'pending').length,
      cancelled: deliveryRows.filter((d) => d.delivery_status === 'cancelled').length,
    };

    // -------------------------------------------------------------
    // CHART 6: EXPENSES & PROFIT / FINANCIAL OVERVIEW
    // -------------------------------------------------------------
    const expenseCategoriesMap: Record<string, number> = {};
    currentExpensesRows.forEach((e) => {
      const cat = e.category || 'General';
      expenseCategoriesMap[cat] = (expenseCategoriesMap[cat] || 0) + (Number(e.amount) || 0);
    });

    const expenseCategorySlices = Object.entries(expenseCategoriesMap).map(([category, amount]) => ({
      category,
      amount: Math.round(amount * 100) / 100,
      percent: currentExpensesTotal > 0 ? Math.round((amount / currentExpensesTotal) * 1000) / 10 : 0,
    })).sort((a, b) => b.amount - a.amount);

    // Explicit documentation regarding profit limitations:
    // As instructed: "Do not calculate profit as sales minus expenses alone if product costs, taxes, refunds, or other required values are missing. Clearly distinguish unavailable metrics."
    const financialMetrics = {
      grossSales: Math.round(currentSalesTotal * 100) / 100,
      subtotal: Math.round(currentSubtotal * 100) / 100,
      totalTax: Math.round(currentTax * 100) / 100,
      totalDiscount: Math.round(currentDiscount * 100) / 100,
      operatingExpenses: Math.round(currentExpensesTotal * 100) / 100,
      netCashIntake: Math.round((currentSalesTotal - currentExpensesTotal) * 100) / 100,
      grossProfitStatus: 'unavailable',
      grossProfitNote: 'COGS (Cost of Goods Sold) is not recorded in product inventory tables. Gross profit metric is withheld to preserve reporting accuracy.',
      netProfitStatus: 'partial',
      netProfitNote: 'Operating Cash Intake reflects Sales minus Recorded Operating Expenses. Inventory purchase cost data is not yet linked.',
    };

    // Return Complete Dynamic Analytics Payload
    return NextResponse.json({
      success: true,
      scope: {
        companyId: companyIdParam,
        isAllCompanies,
        selectedCompany: isAllCompanies ? null : allCompanies.find((c) => c.id === companyIdParam),
        preset: dateRange.preset,
        dateRange: {
          currentStart: dateRange.currentStartSql,
          currentEnd: dateRange.currentEndSql,
          previousStart: dateRange.previousStartSql,
          previousEnd: dateRange.previousEndSql,
        },
      },
      companiesList: allCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        isActive: Boolean(c.is_active),
        currency: c.currency || 'INR',
      })),
      overviewCards: [
        {
          id: 'total_companies',
          title: 'Total Companies',
          value: totalCompaniesCount,
          subtext: `${activeCompaniesCount} active, ${inactiveCompaniesCount} inactive`,
          trend: 'neutral',
          changePct: 0,
          icon: 'Building2',
          reportTarget: 'company_registration',
          color: 'indigo',
        },
        {
          id: 'active_companies',
          title: 'Active Companies',
          value: activeCompaniesCount,
          subtext: `${Math.round((activeCompaniesCount / Math.max(1, totalCompaniesCount)) * 100)}% operational status`,
          trend: 'neutral',
          changePct: 0,
          icon: 'CheckCircle',
          reportTarget: 'active_inactive_companies',
          color: 'emerald',
        },
        {
          id: 'inactive_companies',
          title: 'Inactive Companies',
          value: inactiveCompaniesCount,
          subtext: inactiveCompaniesCount === 0 ? 'All entities online' : 'Tenant deactivations',
          trend: 'neutral',
          changePct: 0,
          icon: 'XCircle',
          reportTarget: 'active_inactive_companies',
          color: 'amber',
        },
        {
          id: 'total_users',
          title: 'Total Users',
          value: totalUsersCount,
          subtext: `${roleCounts.company_admin} admins, ${roleCounts.cashier} cashiers`,
          trend: 'neutral',
          changePct: 0,
          icon: 'Users',
          reportTarget: 'user_activity',
          color: 'blue',
        },
        {
          id: 'total_staff',
          title: 'Total Staff',
          value: totalStaffCount,
          subtext: `${staffRoleBreakdown.waiter} waiters, ${staffRoleBreakdown.cashier} cashiers`,
          trend: 'neutral',
          changePct: 0,
          icon: 'UserCheck',
          reportTarget: 'staff_summary',
          color: 'cyan',
        },
        {
          id: 'total_products',
          title: 'Total Products',
          value: totalProductsCount,
          subtext: `${lowStockCount} items low in stock (<=5)`,
          trend: 'neutral',
          changePct: 0,
          icon: 'Package',
          reportTarget: 'product_performance',
          color: 'purple',
        },
        {
          id: 'total_customers',
          title: 'Total Customers',
          value: registeredCustomersCount > 0 ? registeredCustomersCount : totalCustomersInPeriod,
          subtext: `${returningCustomersCount} repeat visits, ${newCustomersCount} new`,
          trend: 'up',
          changePct: 0,
          icon: 'UserPlus',
          reportTarget: 'customer_growth',
          color: 'teal',
        },
        {
          id: 'total_sales',
          title: 'Total Sales',
          value: Math.round(currentSalesTotal * 100) / 100,
          isCurrency: true,
          subtext: `${salesChange.percent >= 0 ? '+' : ''}${salesChange.percent}% vs prev period`,
          trend: salesChange.trend,
          changePct: salesChange.percent,
          icon: 'DollarSign',
          reportTarget: 'overall_sales',
          color: 'emerald',
        },
        {
          id: 'total_bills',
          title: 'Total Bills',
          value: currentBillsCount,
          subtext: `${billsChange.percent >= 0 ? '+' : ''}${billsChange.percent}% vs prev period`,
          trend: billsChange.trend,
          changePct: billsChange.percent,
          icon: 'Receipt',
          reportTarget: 'bills_report',
          color: 'pink',
        },
        {
          id: 'total_expenses',
          title: 'Total Expenses',
          value: Math.round(currentExpensesTotal * 100) / 100,
          isCurrency: true,
          subtext: `${expensesChange.percent >= 0 ? '+' : ''}${expensesChange.percent}% vs prev period`,
          trend: expensesChange.trend,
          changePct: expensesChange.percent,
          icon: 'CreditCard',
          reportTarget: 'expenses_report',
          color: 'red',
        },
        {
          id: 'total_orders',
          title: 'Total Orders',
          value: totalOrdersCount,
          subtext: `${orderTypesMap.dine_in.count} Dine-in, ${orderTypesMap.delivery.count} Delivery`,
          trend: ordersChange.trend,
          changePct: ordersChange.percent,
          icon: 'ShoppingBag',
          reportTarget: 'dine_in_orders',
          color: 'orange',
        },
      ],
      salesAnalytics: {
        totalSales: Math.round(currentSalesTotal * 100) / 100,
        totalBills: currentBillsCount,
        averageBillValue: Math.round(avgBillCurrent * 100) / 100,
        growthPercentage: salesChange.percent,
        timelineType: isHourlyTimeline ? 'hourly' : 'daily',
        timelinePoints,
      },
      companyAnalytics: {
        totalCompanies: totalCompaniesCount,
        activeCompanies: activeCompaniesCount,
        inactiveCompanies: inactiveCompaniesCount,
        companyWiseComparison: companyAnalyticsData,
      },
      productAnalytics: {
        totalProducts: totalProductsCount,
        topSellingProducts,
        leastSellingProducts,
        categorySales: categoryAnalyticsData,
      },
      customerAnalytics: {
        totalCustomers: registeredCustomersCount > 0 ? registeredCustomersCount : totalCustomersInPeriod,
        newCustomers: newCustomersCount,
        returningCustomers: returningCustomersCount,
        activeCustomerList: activeCustomersList.slice(0, 10),
      },
      staffAnalytics: {
        totalStaff: totalStaffCount,
        userRoleCounts: roleCounts,
        staffRoleBreakdown,
      },
      ordersAnalytics: {
        totalOrders: totalOrdersCount,
        byType: {
          dineIn: orderTypesMap.dine_in,
          takeaway: orderTypesMap.takeaway,
          delivery: orderTypesMap.delivery,
          online: orderTypesMap.online,
        },
        byStatus: orderStatusBreakdown,
      },
      financialAnalytics: {
        ...financialMetrics,
        paymentDonutSlices,
        expenseCategorySlices,
      },
    });
  } catch (err: any) {
    console.error('GET /api/super-admin/analytics error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
