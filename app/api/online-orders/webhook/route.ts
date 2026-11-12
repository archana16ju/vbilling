import { NextResponse } from 'next/server';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { resolveCompanyPoolAndContext } from '@/lib/mysql-company';
import { getMasterCompanies } from '@/lib/mysql-master';
import { mysqlImportOnlineOrder } from '@/lib/mysql-billing';
import { RowDataPacket } from 'mysql2';

export async function POST(request: Request) {
  try {
    if (!isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Available only in local MySQL mode' }, { status: 400 });
    }

    const url = new URL(request.url);
    const platformParam = url.searchParams.get('platform') || request.headers.get('x-platform') || 'Zomato';
    const targetCompParam = url.searchParams.get('companyId') || request.headers.get('x-company-id');

    const body = await request.json();

    // 1. Identify platform
    const platform = (body.platform || platformParam || 'Zomato').toLowerCase();
    const platformFormatted = platform.includes('swiggy') ? 'Swiggy' : platform.includes('zomato') ? 'Zomato' : 'Online Platform';

    // 2. Identify company and resolve appropriate database pool
    let companyId = targetCompParam || body.companyId;
    let pool = getMysqlPool();

    if (companyId) {
      const resolved = await resolveCompanyPoolAndContext(companyId);
      pool = resolved.pool;
      companyId = resolved.company.id;
    } else {
      try {
        const masterComps = await getMasterCompanies();
        const activeComps = masterComps.filter(c => c.isActive);
        if (activeComps.length > 0) {
          companyId = activeComps[0].id;
          const resolved = await resolveCompanyPoolAndContext(companyId);
          pool = resolved.pool;
        }
      } catch (err) {
        // Fallback to legacy
      }

      if (!companyId) {
        const [comps] = await pool.query<RowDataPacket[]>('SELECT id FROM companies WHERE is_active = 1 ORDER BY id ASC LIMIT 1');
        if (comps && comps.length > 0) {
          companyId = comps[0].id;
        } else {
          return NextResponse.json({ error: 'No active company found for order import' }, { status: 400 });
        }
      }
    }

    // Check platform status
    const [platformRow] = await pool.query<RowDataPacket[]>(
      'SELECT is_enabled, connection_status FROM online_order_configs WHERE company_id = ? AND platform = ? LIMIT 1',
      [companyId, platform]
    );

    // If configured and disabled, reject with clear status
    if (platformRow && platformRow.length > 0 && !platformRow[0].is_enabled) {
      return NextResponse.json(
        {
          error: `${platformFormatted} integration is currently disabled for this store. Enable it in Delivery Management to accept orders.`,
          integrationStatus: 'disabled',
        },
        { status: 403 }
      );
    }

    // 3. Normalize order fields across Zomato / Swiggy / Standard formats
    // Strictly extract the platform's actual Order ID. Fake/synthetic IDs MUST NOT be generated!
    const rawOrderId =
      body.onlineOrderId ||
      body.order_id ||
      body.orderId ||
      body.order?.order_id ||
      body.order?.id ||
      body.order_info?.order_id ||
      body.order_details?.order_id ||
      body.details?.order_id ||
      body.cart?.order_id ||
      body.id ||
      body.order_number ||
      body.order_id_display;

    if (!rawOrderId || !String(rawOrderId).trim()) {
      return NextResponse.json(
        {
          success: false,
          error: `Missing platform Order ID in webhook payload. Automatic creation requires the actual Order ID provided by ${platformFormatted}. Fake order IDs are forbidden.`,
        },
        { status: 400 }
      );
    }

    const onlineOrderId = String(rawOrderId).trim();

    const rawCustomerName = (
      body.customerName ||
      body.customer?.name ||
      body.delivery_details?.name ||
      ''
    ).trim();
    const customerName = rawCustomerName === 'Online Customer' || rawCustomerName === 'Customer' ? '' : rawCustomerName;

    const customerPhone = (
      body.customerPhone ||
      body.customer?.phone ||
      body.customer?.mobile ||
      body.delivery_details?.phone ||
      ''
    ).trim();

    const rawAddress = (
      body.deliveryAddress ||
      body.customer?.address ||
      body.delivery_details?.address ||
      body.delivery_address ||
      ''
    ).trim();
    const deliveryAddress = rawAddress === 'Online Order Delivery Address' || rawAddress === 'No address specified' ? '' : rawAddress;

    const deliveryNotes = body.deliveryNotes || body.instructions || body.order_note || null;

    // Normalize items
    const rawItems = body.items || body.order_items || body.cart?.items || [];
    const items = rawItems.length > 0
      ? rawItems.map((item: any, idx: number) => ({
          productId: item.productId || item.item_id || item.id,
          name: item.name || item.item_name || item.product?.name || `Item ${idx + 1}`,
          quantity: Number(item.quantity || item.qty || 1),
          price: Number(item.price || item.rate || item.item_price || 0),
          tax: Number(item.tax || 0),
          discount: Number(item.discount || 0),
        }))
      : [
          {
            name: `${platformFormatted} Special Combo`,
            quantity: 1,
            price: Number(body.total || body.order_total || body.bill_total || 250),
          },
        ];

    const subtotal = Number(body.subtotal || body.items_total || body.food_total) ||
      items.reduce((sum: number, it: any) => sum + it.price * it.quantity, 0);

    const tax = Number(body.tax || body.total_tax || 0);
    const discount = Number(body.discount || body.total_discount || 0);
    const total = Number(body.total || body.order_total || body.bill_total || (subtotal + tax - discount));

    const paymentMethod = body.paymentMethod || body.payment?.type || 'Online';
    const paymentStatus = body.paymentStatus || body.payment?.status || 'paid';

    // 4. Import order atomically
    const result = await mysqlImportOnlineOrder({
      companyId,
      platform: platformFormatted,
      onlineOrderId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNotes,
      items,
      subtotal,
      tax,
      discount,
      total,
      paymentMethod,
      paymentStatus,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    console.error('POST /api/online-orders/webhook error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to process online order webhook' },
      { status: 500 }
    );
  }
}
