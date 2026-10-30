import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getDb } from '@/lib/actions/db';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';

function resolveRange(preset: string) {
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
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'month') {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  } else if (preset === 'all') {
    start = new Date(2020, 0, 1);
    end.setHours(23, 59, 59, 999);
  } else {
    // default to today
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const formatSql = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

  return {
    start,
    end,
    startSql: formatSql(start),
    endSql: formatSql(end),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const preset = (searchParams.get('preset') || 'today').toLowerCase();
    const targetUserId = searchParams.get('userId') || 'all';
    const targetCompanyParam = searchParams.get('companyId');

    const range = resolveRange(preset);

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();

      // Resolve Company
      let companyId = '';
      let companyName = '';
      let companyCode = '';
      let currency = 'INR';

      if (session.role === 'company_admin') {
        const company = await getAuthorizedCompanyContext();
        companyId = company.id;
        companyName = company.name;
        companyCode = company.code;
        currency = company.currency || 'INR';
      } else if (session.role === 'super_admin') {
        const cookieStore = await cookies();
        const cid = targetCompanyParam || cookieStore.get('auth_company_id')?.value;
        if (cid && cid !== 'all') {
          const [compRows] = await pool.query<RowDataPacket[]>('SELECT id, name, code, currency FROM companies WHERE id = ?', [cid]);
          if (compRows.length > 0) {
            companyId = compRows[0].id;
            companyName = compRows[0].name;
            companyCode = compRows[0].code;
            currency = compRows[0].currency || 'INR';
          }
        }
        if (!companyId) {
          const [allComps] = await pool.query<RowDataPacket[]>('SELECT id, name, code, currency FROM companies WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1');
          if (allComps.length > 0) {
            companyId = allComps[0].id;
            companyName = allComps[0].name;
            companyCode = allComps[0].code;
            currency = allComps[0].currency || 'INR';
          }
        }
      } else {
        // Cashier role: only view within assigned company
        const company = await getAuthorizedCompanyContext();
        companyId = company.id;
        companyName = company.name;
        companyCode = company.code;
        currency = company.currency || 'INR';
      }

      if (!companyId) {
        return NextResponse.json({ error: 'No active company found.' }, { status: 404 });
      }

      // 1. Fetch Users under this Company
      const [userRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, name, username, role, is_active FROM users WHERE company_id = ? AND is_active = 1`,
        [companyId]
      );

      // 2. Query ALL sales in the resolved date range for this company
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.bill_number, s.subtotal, s.discount, s.tax, s.round_off, s.total, 
                s.payment_method, s.payment_status, s.order_type, s.order_source, s.customer_name, 
                s.created_by, s.created_at, s.items
         FROM sales s
         WHERE s.company_id = ? 
           AND s.payment_status != 'cancelled'
           AND s.created_at >= ? AND s.created_at <= ?
         ORDER BY s.created_at DESC`,
        [companyId, range.startSql, range.endSql]
      );

      // 3. Inventory Telemetry
      const [prodCountRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM products WHERE company_id = ?`,
        [companyId]
      );
      const [catCountRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM categories WHERE company_id = ?`,
        [companyId]
      );
      const [lowStockRows] = await pool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as cnt FROM products WHERE company_id = ? AND stock <= 5`,
        [companyId]
      );

      const totalProducts = prodCountRows[0]?.cnt || 0;
      const totalCategories = catCountRows[0]?.cnt || 0;
      const lowStockCount = lowStockRows[0]?.cnt || 0;

      // 4. Build User-Wise Collections & Performance Breakdown
      // Initialize map for known registered users
      const userMap = new Map<string, {
        id: string;
        username: string;
        name: string;
        role: 'company_admin' | 'cashier';
        totalBills: number;
        totalCollections: number;
        subtotal: number;
        discount: number;
        tax: number;
        cash: number;
        upi: number;
        card: number;
        billOnly: number;
        online: number;
        other: number;
        lastActive?: string;
      }>();

      for (const u of userRows) {
        const uname = (u.username || u.name || '').toLowerCase();
        userMap.set(uname, {
          id: u.id,
          username: u.username || u.name,
          name: u.name || u.username,
          role: u.role === 'company_admin' ? 'company_admin' : 'cashier',
          totalBills: 0,
          totalCollections: 0,
          subtotal: 0,
          discount: 0,
          tax: 0,
          cash: 0,
          upi: 0,
          card: 0,
          billOnly: 0,
          online: 0,
          other: 0,
        });
      }

      let companyTotalCollections = 0;

      // Group each sale into user metrics
      for (const s of salesRows) {
        const creatorRaw = s.created_by || 'cashier';
        const creatorKey = creatorRaw.toLowerCase();
        const total = Number(s.total) || 0;
        const subtotal = Number(s.subtotal) || 0;
        const discount = Number(s.discount) || 0;
        const tax = Number(s.tax) || 0;
        const method = (s.payment_method || 'Cash').toLowerCase();

        companyTotalCollections += total;

        if (!userMap.has(creatorKey)) {
          // Add ad-hoc user found in sales
          userMap.set(creatorKey, {
            id: `u_${creatorKey}`,
            username: creatorRaw,
            name: creatorRaw.charAt(0).toUpperCase() + creatorRaw.slice(1),
            role: creatorKey.includes('admin') ? 'company_admin' : 'cashier',
            totalBills: 0,
            totalCollections: 0,
            subtotal: 0,
            discount: 0,
            tax: 0,
            cash: 0,
            upi: 0,
            card: 0,
            billOnly: 0,
            online: 0,
            other: 0,
          });
        }

        const uStats = userMap.get(creatorKey)!;
        uStats.totalBills += 1;
        uStats.totalCollections += total;
        uStats.subtotal += subtotal;
        uStats.discount += discount;
        uStats.tax += tax;

        if (!uStats.lastActive || new Date(s.created_at) > new Date(uStats.lastActive)) {
          uStats.lastActive = s.created_at;
        }

        if (method === 'cash') {
          uStats.cash += total;
        } else if (method === 'upi') {
          uStats.upi += total;
        } else if (method === 'card') {
          uStats.card += total;
        } else if (method === 'bill only' || method === 'bill_only' || method === 'credit') {
          uStats.billOnly += total;
        } else if (method === 'online' || method === 'zomato' || method === 'swiggy') {
          uStats.online += total;
        } else {
          uStats.other += total;
        }
      }

      const usersList = Array.from(userMap.values()).map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        totalBills: u.totalBills,
        totalCollections: Math.round(u.totalCollections * 100) / 100,
        avgBill: u.totalBills > 0 ? Math.round((u.totalCollections / u.totalBills) * 100) / 100 : 0,
        paymentSplit: {
          cash: Math.round(u.cash * 100) / 100,
          upi: Math.round(u.upi * 100) / 100,
          card: Math.round(u.card * 100) / 100,
          billOnly: Math.round(u.billOnly * 100) / 100,
          online: Math.round(u.online * 100) / 100,
          other: Math.round(u.other * 100) / 100,
        },
        percentShare: companyTotalCollections > 0
          ? Math.round((u.totalCollections / companyTotalCollections) * 1000) / 10
          : 0,
        lastActive: u.lastActive,
      })).sort((a, b) => b.totalCollections - a.totalCollections);

      // 5. Filter sales if a specific user is selected
      const isFilteredByUser = targetUserId && targetUserId !== 'all';
      const activeSales = isFilteredByUser
        ? salesRows.filter(s => {
            const c = (s.created_by || '').toLowerCase();
            const target = targetUserId.toLowerCase();
            return c === target;
          })
        : salesRows;

      // 6. Compute Active Overview Metrics (either for All Users or the Selected User)
      let activeTotal = 0;
      let activeSubtotal = 0;
      let activeDiscount = 0;
      let activeTax = 0;

      const methodCounts: Record<string, { amount: number; count: number }> = {
        cash: { amount: 0, count: 0 },
        upi: { amount: 0, count: 0 },
        card: { amount: 0, count: 0 },
        billOnly: { amount: 0, count: 0 },
        online: { amount: 0, count: 0 },
      };

      const orderTypes = {
        dineIn: { amount: 0, count: 0 },
        takeaway: { amount: 0, count: 0 },
        delivery: { amount: 0, count: 0 },
      };

      const hourlyRushMap = new Array(24).fill(0).map((_, i) => ({
        hour: i,
        label: i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`,
        amount: 0,
        bills: 0,
        isPeak: false,
      }));

      for (const s of activeSales) {
        const t = Number(s.total) || 0;
        const sub = Number(s.subtotal) || 0;
        const disc = Number(s.discount) || 0;
        const tx = Number(s.tax) || 0;
        const m = (s.payment_method || 'Cash').toLowerCase();
        const oType = (s.order_type || 'Dine In').toLowerCase();

        activeTotal += t;
        activeSubtotal += sub;
        activeDiscount += disc;
        activeTax += tx;

        // Payment method
        if (m === 'cash') {
          methodCounts.cash.amount += t;
          methodCounts.cash.count += 1;
        } else if (m === 'upi') {
          methodCounts.upi.amount += t;
          methodCounts.upi.count += 1;
        } else if (m === 'card') {
          methodCounts.card.amount += t;
          methodCounts.card.count += 1;
        } else if (m.includes('bill') || m.includes('credit')) {
          methodCounts.billOnly.amount += t;
          methodCounts.billOnly.count += 1;
        } else {
          methodCounts.online.amount += t;
          methodCounts.online.count += 1;
        }

        // Order types
        if (oType.includes('dine')) {
          orderTypes.dineIn.amount += t;
          orderTypes.dineIn.count += 1;
        } else if (oType.includes('take') || oType.includes('pick')) {
          orderTypes.takeaway.amount += t;
          orderTypes.takeaway.count += 1;
        } else {
          orderTypes.delivery.amount += t;
          orderTypes.delivery.count += 1;
        }

        // Hourly Rush
        const dt = new Date(s.created_at);
        const h = dt.getHours();
        if (h >= 0 && h < 24) {
          hourlyRushMap[h].amount += t;
          hourlyRushMap[h].bills += 1;
        }
      }

      // Mark peak rush hour
      let maxHourlyAmount = 0;
      let peakHourIndex = -1;
      hourlyRushMap.forEach((hr, idx) => {
        if (hr.amount > maxHourlyAmount) {
          maxHourlyAmount = hr.amount;
          peakHourIndex = idx;
        }
      });
      if (peakHourIndex !== -1 && maxHourlyAmount > 0) {
        hourlyRushMap[peakHourIndex].isPeak = true;
      }

      // 7. Dynamic Graph Data Construction
      // A) Timeline Graph (Hourly for Today/Yesterday, Daily for Week/Month/All)
      const isHourlyTimeline = preset === 'today' || preset === 'yesterday';
      let timelinePoints: { label: string; rawDate?: string; amount: number; bills: number }[] = [];

      if (isHourlyTimeline) {
        // Business hours 8 AM to 11 PM or 24 hours
        // Let's create from 8 AM (8) to 11 PM (23) or all 24
        timelinePoints = hourlyRushMap.map(hr => ({
          label: hr.label,
          amount: Math.round(hr.amount * 100) / 100,
          bills: hr.bills,
        }));
      } else {
        // Daily timeline points
        const dailyMap = new Map<string, { label: string; rawDate: string; amount: number; bills: number }>();

        // Pre-populate intervals
        const cur = new Date(range.start);
        const padZ = (n: number) => String(n).padStart(2, '0');
        while (cur <= range.end) {
          const key = `${cur.getFullYear()}-${padZ(cur.getMonth() + 1)}-${padZ(cur.getDate())}`;
          const dayName = cur.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
          dailyMap.set(key, { label: dayName, rawDate: key, amount: 0, bills: 0 });
          cur.setDate(cur.getDate() + 1);
        }

        for (const s of activeSales) {
          const dt = new Date(s.created_at);
          const key = `${dt.getFullYear()}-${padZ(dt.getMonth() + 1)}-${padZ(dt.getDate())}`;
          if (dailyMap.has(key)) {
            const itm = dailyMap.get(key)!;
            itm.amount += Number(s.total) || 0;
            itm.bills += 1;
          }
        }

        timelinePoints = Array.from(dailyMap.values()).map(d => ({
          label: d.label,
          rawDate: d.rawDate,
          amount: Math.round(d.amount * 100) / 100,
          bills: d.bills,
        }));
      }

      let peakTimelineLabel = '';
      let peakTimelineAmount = 0;
      for (const p of timelinePoints) {
        if (p.amount > peakTimelineAmount) {
          peakTimelineAmount = p.amount;
          peakTimelineLabel = p.label;
        }
      }

      // B) Payment Methods Donut Data
      const totalCollectionsActive = activeTotal > 0 ? activeTotal : 1;
      const paymentDonut = [
        {
          method: 'cash',
          label: 'Cash',
          amount: Math.round(methodCounts.cash.amount * 100) / 100,
          count: methodCounts.cash.count,
          percent: Math.round((methodCounts.cash.amount / totalCollectionsActive) * 1000) / 10,
          color: '#10B981', // Emerald
        },
        {
          method: 'upi',
          label: 'UPI / QR',
          amount: Math.round(methodCounts.upi.amount * 100) / 100,
          count: methodCounts.upi.count,
          percent: Math.round((methodCounts.upi.amount / totalCollectionsActive) * 1000) / 10,
          color: '#8B5CF6', // Purple / Violet
        },
        {
          method: 'card',
          label: 'Card POS',
          amount: Math.round(methodCounts.card.amount * 100) / 100,
          count: methodCounts.card.count,
          percent: Math.round((methodCounts.card.amount / totalCollectionsActive) * 1000) / 10,
          color: '#06B6D4', // Cyan
        },
        {
          method: 'billOnly',
          label: 'Credit / Bill Only',
          amount: Math.round(methodCounts.billOnly.amount * 100) / 100,
          count: methodCounts.billOnly.count,
          percent: Math.round((methodCounts.billOnly.amount / totalCollectionsActive) * 1000) / 10,
          color: '#F59E0B', // Amber
        },
        {
          method: 'online',
          label: 'Online / Other',
          amount: Math.round(methodCounts.online.amount * 100) / 100,
          count: methodCounts.online.count,
          percent: Math.round((methodCounts.online.amount / totalCollectionsActive) * 1000) / 10,
          color: '#EC4899', // Pink
        },
      ].filter(d => activeTotal === 0 || d.amount > 0 || d.count > 0);

      // 8. Recent Bills Live Feed
      const recentBills = activeSales.slice(0, 15).map(s => {
        let itemsCount = 0;
        try {
          if (typeof s.items === 'string') {
            const parsed = JSON.parse(s.items);
            itemsCount = Array.isArray(parsed) ? parsed.length : 1;
          } else if (Array.isArray(s.items)) {
            itemsCount = s.items.length;
          }
        } catch {
          itemsCount = 1;
        }

        return {
          id: s.id,
          billNumber: s.bill_number,
          customerName: s.customer_name || 'Walk-in Customer',
          itemsCount,
          paymentMethod: s.payment_method || 'Cash',
          paymentStatus: s.payment_status || 'paid',
          total: Number(s.total) || 0,
          createdBy: s.created_by || 'Cashier',
          createdAt: s.created_at,
          orderType: s.order_type || 'Dine In',
        };
      });

      const totalBillsActive = activeSales.length;
      const avgBillActive = totalBillsActive > 0 ? activeTotal / totalBillsActive : 0;

      return NextResponse.json({
        success: true,
        company: {
          id: companyId,
          name: companyName,
          code: companyCode,
          currency,
        },
        filter: {
          preset,
          userId: targetUserId,
          startDate: range.startIso,
          endDate: range.endIso,
        },
        currentUser: {
          userId: session.userId,
          username: session.username,
          role: session.role,
        },
        usersList,
        overview: {
          totalCollections: Math.round(activeTotal * 100) / 100,
          totalBills: totalBillsActive,
          avgBillValue: Math.round(avgBillActive * 100) / 100,
          subtotal: Math.round(activeSubtotal * 100) / 100,
          totalTax: Math.round(activeTax * 100) / 100,
          totalDiscount: Math.round(activeDiscount * 100) / 100,
          collections: {
            cash: {
              amount: Math.round(methodCounts.cash.amount * 100) / 100,
              count: methodCounts.cash.count,
              percent: Math.round((methodCounts.cash.amount / totalCollectionsActive) * 1000) / 10,
            },
            upi: {
              amount: Math.round(methodCounts.upi.amount * 100) / 100,
              count: methodCounts.upi.count,
              percent: Math.round((methodCounts.upi.amount / totalCollectionsActive) * 1000) / 10,
            },
            card: {
              amount: Math.round(methodCounts.card.amount * 100) / 100,
              count: methodCounts.card.count,
              percent: Math.round((methodCounts.card.amount / totalCollectionsActive) * 1000) / 10,
            },
            billOnly: {
              amount: Math.round(methodCounts.billOnly.amount * 100) / 100,
              count: methodCounts.billOnly.count,
              percent: Math.round((methodCounts.billOnly.amount / totalCollectionsActive) * 1000) / 10,
            },
            online: {
              amount: Math.round(methodCounts.online.amount * 100) / 100,
              count: methodCounts.online.count,
              percent: Math.round((methodCounts.online.amount / totalCollectionsActive) * 1000) / 10,
            },
          },
          orderTypes: {
            dineIn: {
              amount: Math.round(orderTypes.dineIn.amount * 100) / 100,
              count: orderTypes.dineIn.count,
            },
            takeaway: {
              amount: Math.round(orderTypes.takeaway.amount * 100) / 100,
              count: orderTypes.takeaway.count,
            },
            delivery: {
              amount: Math.round(orderTypes.delivery.amount * 100) / 100,
              count: orderTypes.delivery.count,
            },
          },
          totalProducts,
          totalCategories,
          lowStockCount,
          activeUsersCount: usersList.filter(u => u.totalBills > 0).length,
        },
        timelineGraph: {
          type: isHourlyTimeline ? 'hourly' : 'daily',
          points: timelinePoints,
          peakLabel: peakTimelineLabel,
          peakAmount: Math.round(peakTimelineAmount * 100) / 100,
        },
        paymentDonut,
        hourlyRush: hourlyRushMap,
        recentBills,
      });
    }

    // Fallback: MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const authCompanyId = targetCompanyParam || cookieStore.get('auth_company_id')?.value || session.companyId || '';

    const salesFilter: any = {};
    if (authCompanyId) salesFilter.companyId = authCompanyId;
    if (targetUserId && targetUserId !== 'all') {
      salesFilter.$or = [{ createdBy: targetUserId }, { cashier: targetUserId }];
    }

    const sales = await db.collection('sales').find(salesFilter).sort({ timestamp: -1 }).limit(200).toArray();
    const productsCount = await db.collection('products').countDocuments();
    const categoriesCount = await db.collection('categories').countDocuments();

    let total = 0;
    const methodCounts: Record<string, { amount: number; count: number }> = {
      cash: { amount: 0, count: 0 },
      upi: { amount: 0, count: 0 },
      card: { amount: 0, count: 0 },
      billOnly: { amount: 0, count: 0 },
      online: { amount: 0, count: 0 },
    };

    for (const s of sales) {
      const t = Number(s.total) || 0;
      total += t;
      const m = (s.paymentMethod || 'Cash').toLowerCase();
      if (m === 'cash') {
        methodCounts.cash.amount += t;
        methodCounts.cash.count += 1;
      } else if (m === 'upi') {
        methodCounts.upi.amount += t;
        methodCounts.upi.count += 1;
      } else if (m === 'card') {
        methodCounts.card.amount += t;
        methodCounts.card.count += 1;
      } else if (m.includes('bill')) {
        methodCounts.billOnly.amount += t;
        methodCounts.billOnly.count += 1;
      } else {
        methodCounts.online.amount += t;
        methodCounts.online.count += 1;
      }
    }

    return NextResponse.json({
      success: true,
      company: {
        id: authCompanyId || 'default',
        name: 'Company Store',
        code: 'STORE',
        currency: 'INR',
      },
      filter: {
        preset,
        userId: targetUserId,
        startDate: range.startIso,
        endDate: range.endIso,
      },
      currentUser: {
        userId: session.userId,
        username: session.username,
        role: session.role,
      },
      usersList: [],
      overview: {
        totalCollections: Math.round(total * 100) / 100,
        totalBills: sales.length,
        avgBillValue: sales.length > 0 ? Math.round((total / sales.length) * 100) / 100 : 0,
        subtotal: total,
        totalTax: 0,
        totalDiscount: 0,
        collections: {
          cash: { amount: methodCounts.cash.amount, count: methodCounts.cash.count, percent: total > 0 ? Math.round((methodCounts.cash.amount / total) * 100) : 0 },
          upi: { amount: methodCounts.upi.amount, count: methodCounts.upi.count, percent: total > 0 ? Math.round((methodCounts.upi.amount / total) * 100) : 0 },
          card: { amount: methodCounts.card.amount, count: methodCounts.card.count, percent: total > 0 ? Math.round((methodCounts.card.amount / total) * 100) : 0 },
          billOnly: { amount: methodCounts.billOnly.amount, count: methodCounts.billOnly.count, percent: total > 0 ? Math.round((methodCounts.billOnly.amount / total) * 100) : 0 },
          online: { amount: methodCounts.online.amount, count: methodCounts.online.count, percent: total > 0 ? Math.round((methodCounts.online.amount / total) * 100) : 0 },
        },
        orderTypes: {
          dineIn: { amount: total, count: sales.length },
          takeaway: { amount: 0, count: 0 },
          delivery: { amount: 0, count: 0 },
        },
        totalProducts: productsCount,
        totalCategories: categoriesCount,
        lowStockCount: 0,
        activeUsersCount: 1,
      },
      timelineGraph: {
        type: 'daily',
        points: [],
        peakLabel: '',
        peakAmount: 0,
      },
      paymentDonut: [],
      hourlyRush: [],
      recentBills: sales.slice(0, 15).map(s => ({
        id: s.id || s._id,
        billNumber: s.billNumber || s.id,
        customerName: s.customerName || 'Customer',
        itemsCount: s.items?.length || 0,
        paymentMethod: s.paymentMethod || 'Cash',
        paymentStatus: s.paymentStatus || 'paid',
        total: Number(s.total) || 0,
        createdBy: s.createdBy || 'Staff',
        createdAt: s.createdAt || new Date().toISOString(),
        orderType: s.orderType || 'Dine In',
      })),
    });
  } catch (err: any) {
    console.error('GET /api/dashboard/stats error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch dashboard statistics' }, { status: 500 });
  }
}
