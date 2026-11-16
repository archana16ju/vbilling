import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyPool } from '@/lib/mysql-company';
import { normalizePhoneNumber } from '@/lib/duplicate-detector';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || undefined;
    const rawPhone = searchParams.get('phone') || undefined;

    if (!customerId && !rawPhone) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    const { pool, company } = await getAuthorizedCompanyPool();
    const cleanPhone = normalizePhoneNumber(rawPhone);

    // 1. Resolve customer record and definitive phone
    let customerPhone = cleanPhone;
    if (customerId) {
      const [cRows]: any = await pool.query(
        `SELECT id, name, phone FROM customers WHERE company_id = ? AND id = ? LIMIT 1`,
        [company.id, customerId]
      );
      if (cRows && cRows.length > 0 && cRows[0].phone) {
        customerPhone = normalizePhoneNumber(cRows[0].phone) || customerPhone;
      }
    }

    if (!customerPhone && !customerId) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // 2. Query eligible sales for this customer within this company
    // Exclude cancelled and fully refunded sales
    let salesQuery = `
      SELECT id, bill_number, items, payment_status, created_at
      FROM sales
      WHERE company_id = ? 
        AND payment_status NOT IN ('cancelled', 'refunded')
        AND (
    `;
    const params: any[] = [company.id];

    if (customerPhone) {
      salesQuery += ` (customer_phone IS NOT NULL AND RIGHT(REPLACE(REPLACE(customer_phone, ' ', ''), '-', ''), 10) = ?)`;
      params.push(customerPhone);
      if (customerId) {
        salesQuery += ` OR JSON_UNQUOTE(JSON_EXTRACT(items, '$[0].customerId')) = ?`;
        params.push(customerId);
      }
    } else {
      salesQuery += ` JSON_UNQUOTE(JSON_EXTRACT(items, '$[0].customerId')) = ?`;
      params.push(customerId);
    }
    salesQuery += ` ) ORDER BY created_at DESC LIMIT 100`;

    const [sales]: any = await pool.query(salesQuery, params);

    if (!sales || sales.length === 0) {
      return NextResponse.json({ success: true, suggestions: [], count: 0 });
    }

    // 3. Check for partial refunds associated with these sales
    const saleIds = sales.map((s: any) => s.id);
    const saleIdPlaceholders = saleIds.map(() => '?').join(',');

    let partiallyRefundedItems = new Map<string, number>(); // saleId_prodId -> refundedQty
    if (saleIds.length > 0) {
      try {
        const [refTxs]: any = await pool.query(
          `SELECT sale_id, quantity, reason FROM batch_transactions 
           WHERE company_id = ? AND sale_id IN (${saleIdPlaceholders}) AND transaction_type = 'return_restock'`,
          [company.id, ...saleIds]
        );
        for (const r of refTxs) {
          partiallyRefundedItems.set(r.sale_id, (partiallyRefundedItems.get(r.sale_id) || 0) + Number(r.quantity || 0));
        }
      } catch {}
    }

    // 4. Aggregate products purchased by frequency, quantity, and recency
    const productStats = new Map<
      string,
      {
        totalQuantity: number;
        orderCount: number;
        lastPurchasedAt: number;
      }
    >();

    const now = Date.now();

    for (const sale of sales) {
      let itemsList: any[] = [];
      try {
        itemsList = typeof sale.items === 'string' ? JSON.parse(sale.items) : (sale.items || []);
      } catch {
        continue;
      }

      const saleTime = new Date(sale.created_at).getTime();
      const seenInThisSale = new Set<string>();

      for (const item of itemsList) {
        const prod = item.product || item;
        const prodId = prod?.id || item.productId;
        if (!prodId) continue;

        let qty = Number(item.quantity) || 1;
        // Adjust for any partial refund recorded for this sale
        if (partiallyRefundedItems.has(sale.id)) {
          const refundedAmount = partiallyRefundedItems.get(sale.id)!;
          qty = Math.max(0, qty - refundedAmount);
          if (qty <= 0) continue;
        }

        const stat = productStats.get(prodId) || {
          totalQuantity: 0,
          orderCount: 0,
          lastPurchasedAt: 0,
        };

        stat.totalQuantity += qty;
        if (!seenInThisSale.has(prodId)) {
          stat.orderCount += 1;
          seenInThisSale.add(prodId);
        }
        if (saleTime > stat.lastPurchasedAt) {
          stat.lastPurchasedAt = saleTime;
        }

        productStats.set(prodId, stat);
      }
    }

    const candidateIds = Array.from(productStats.keys());
    if (candidateIds.length === 0) {
      return NextResponse.json({ success: true, suggestions: [] });
    }

    // 5. Query CURRENT product details from MySQL (ensuring current selling price, availability, never old invoice price!)
    const placeholders = candidateIds.map(() => '?').join(',');
    const [currentProducts]: any = await pool.query(
      `SELECT id, name, sku, barcode, price, stock, unit, image, tax, discount, min_stock, 
              category_id as categoryId, addon_group_ids as addonGroupIds, quantity_step as quantityStep
       FROM products 
       WHERE company_id = ? AND id IN (${placeholders})`,
      [company.id, ...candidateIds]
    );

    const productMap = new Map<string, any>();
    for (const p of currentProducts) {
      productMap.set(p.id, {
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        price: Number(p.price),
        stock: Number(p.stock),
        unit: p.unit || 'plate',
        image: p.image || null,
        tax: Number(p.tax || 0),
        discount: Number(p.discount || 0),
        minStock: Number(p.min_stock || 0),
        categoryId: p.categoryId,
        addonGroupIds: typeof p.addonGroupIds === 'string' ? JSON.parse(p.addonGroupIds) : (p.addonGroupIds || []),
        quantityStep: Number(p.quantityStep || 1),
      });
    }

    // 6. Rank suggestions: score = (orderCount * 4) + (totalQuantity * 2) + recencyBonus
    const suggestions: any[] = [];

    for (const [prodId, stat] of productStats.entries()) {
      const currentProduct = productMap.get(prodId);
      if (!currentProduct) continue; // Product was removed or does not exist in current catalog

      const daysAgo = Math.floor((now - stat.lastPurchasedAt) / (1000 * 60 * 60 * 24));
      let recencyBonus = 0;
      if (daysAgo <= 7) recencyBonus = 12;
      else if (daysAgo <= 30) recencyBonus = 6;
      else if (daysAgo <= 60) recencyBonus = 3;

      const rankingScore = (stat.orderCount * 4) + (stat.totalQuantity * 2) + recencyBonus;

      suggestions.push({
        product: currentProduct,
        frequency: stat.orderCount,
        totalQuantity: stat.totalQuantity,
        lastPurchasedAt: stat.lastPurchasedAt,
        daysAgo,
        rankingScore,
      });
    }

    // Sort descending by ranking score
    suggestions.sort((a, b) => b.rankingScore - a.rankingScore);

    return NextResponse.json({
      success: true,
      suggestions: suggestions.slice(0, 10),
      count: suggestions.length,
    });
  } catch (err: any) {
    console.error('GET /api/customers/purchase-history error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
