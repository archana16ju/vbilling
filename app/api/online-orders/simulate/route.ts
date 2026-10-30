import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { mysqlImportOnlineOrder, mysqlGetProducts } from '@/lib/mysql-billing';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session && !isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Available only in local MySQL mode' }, { status: 400 });
    }

    let company: any;
    try {
      company = await getAuthorizedCompanyContext();
    } catch {
      const { getMysqlPool } = await import('@/lib/mysql');
      const pool = getMysqlPool();
      const [comps]: any = await pool.query('SELECT * FROM companies WHERE is_active = 1 ORDER BY id ASC LIMIT 1');
      if (comps && comps.length > 0) {
        company = comps[0];
      } else {
        throw new Error('No active company found');
      }
    }
    const data = await request.json().catch(() => ({}));

    const platform = data.platform === 'Swiggy' ? 'Swiggy' : 'Zomato';
    const rawId = data.onlineOrderId || data.order_id || data.orderId;
    if (!rawId || !String(rawId).trim()) {
      return NextResponse.json(
        {
          success: false,
          error: `Please provide the actual ${platform} Order ID from the platform. Generating fake/synthetic Order IDs is strictly forbidden.`,
        },
        { status: 400 }
      );
    }
    const onlineOrderId = String(rawId).trim();

    // Get available products from local MySQL to build a realistic test order
    let products: any[] = [];
    try {
      products = await mysqlGetProducts();
    } catch {
      const { getMysqlPool } = await import('@/lib/mysql');
      const pool = getMysqlPool();
      const [pRows]: any = await pool.query('SELECT id, name, price, tax FROM products WHERE company_id = ? LIMIT 2', [company.id]);
      products = pRows || [];
    }
    const selectedProducts = products.slice(0, 2);

    let items: any[] = [];
    let subtotal = 0;

    if (selectedProducts.length > 0) {
      items = selectedProducts.map((p, idx) => {
        const qty = idx === 0 ? 2 : 1;
        const price = Number(p.price) || 120;
        subtotal += price * qty;
        return {
          productId: p.id,
          name: p.name,
          quantity: qty,
          price: price,
          tax: p.tax || 5,
          discount: 0,
        };
      });
    } else {
      items = [
        { name: 'Special Chicken Biryani', quantity: 1, price: 260, tax: 5, discount: 0 },
        { name: 'Cold Beverage 500ml', quantity: 1, price: 40, tax: 5, discount: 0 },
      ];
      subtotal = 300;
    }

    const tax = Math.round(subtotal * 0.05 * 100) / 100;
    const total = subtotal + tax;

    const result = await mysqlImportOnlineOrder({
      companyId: company.id,
      platform,
      onlineOrderId,
      customerName: (data.customerName || '').trim(),
      customerPhone: (data.customerPhone || '').trim(),
      deliveryAddress: (data.deliveryAddress || '').trim(),
      deliveryNotes: (data.deliveryNotes || '').trim() || undefined,
      items,
      subtotal,
      tax,
      discount: 0,
      total,
      paymentMethod: 'Online',
      paymentStatus: 'paid',
    });

    return NextResponse.json({
      simulated: true,
      ...result,
    });
  } catch (err: any) {
    console.error('POST /api/online-orders/simulate error:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to simulate online order' },
      { status: 500 }
    );
  }
}
