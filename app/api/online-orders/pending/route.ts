import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { resolveCompanyPoolAndContext } from '@/lib/mysql-company';
import { RowDataPacket } from 'mysql2';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session && !isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!isLocalMySqlMode()) {
      return NextResponse.json({
        orders: [
          {
            onlineOrderId: 'ZOM-8831',
            platform: 'Zomato',
            customerName: 'Aakash Verma',
            customerPhone: '9876501234',
            deliveryAddress: 'Flat 402, Royal Palms, MG Road',
            deliveryNotes: 'Leave at security gate',
            total: 320,
            items: [
              { name: 'Special Chicken Biryani', quantity: 1, price: 260 },
              { name: 'Thumbs Up 500ml', quantity: 1, price: 60 }
            ],
            billId: null,
            createdAt: Date.now() - 300000,
          },
          {
            onlineOrderId: 'SWIG-4492',
            platform: 'Swiggy',
            customerName: 'Divya Nair',
            customerPhone: '9845012345',
            deliveryAddress: 'No 24, 3rd Cross, Indiranagar',
            deliveryNotes: 'Contactless delivery, ring bell',
            total: 280,
            items: [
              { name: 'Mutton Biryani', quantity: 1, price: 280 }
            ],
            billId: null,
            createdAt: Date.now() - 600000,
          }
        ]
      });
    }

    const { pool, company } = await resolveCompanyPoolAndContext();

    // Query recent online orders from deliveries and sales
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 
         d.id as delivery_id,
         d.bill_id,
         d.order_source as platform,
         d.online_order_id,
         d.customer_name,
         d.customer_phone,
         d.delivery_address,
         d.delivery_notes,
         d.delivery_status,
         d.created_at,
         s.items as sale_items,
         s.total as total_amount
       FROM deliveries d
       LEFT JOIN sales s ON s.company_id = d.company_id AND s.bill_number = d.bill_id
       WHERE d.company_id = ? 
         AND d.order_source IN ('Zomato', 'Swiggy')
         AND d.delivery_status NOT IN ('delivered', 'cancelled')
       ORDER BY d.created_at DESC
       LIMIT 20`,
      [company.id]
    );

    const orders = rows.map((r) => {
      let items: any[] = [];
      try {
        let rawItems: any = r.sale_items;
        if (typeof rawItems === 'string') {
          rawItems = JSON.parse(rawItems);
        }
        if (Array.isArray(rawItems)) {
          items = rawItems.map((it: any) => ({
            name: it.product?.name || it.productName || it.name || it.item_name || 'Item',
            quantity: Number(it.quantity) || 1,
            price: Number(it.product?.price || it.price) || 0,
          }));
        }
      } catch {}

      const isDummyName = (n: string | null) => !n || n === 'Online Customer' || n === 'Customer';
      const isDummyAddress = (a: string | null) => !a || a === 'Online Order Delivery Address' || a === 'No address specified';

      return {
        deliveryId: r.delivery_id,
        billId: r.bill_id,
        platform: r.platform || 'Zomato',
        onlineOrderId: r.online_order_id || '',
        customerName: isDummyName(r.customer_name) ? '' : r.customer_name,
        customerPhone: r.customer_phone || '',
        deliveryAddress: isDummyAddress(r.delivery_address) ? '' : r.delivery_address,
        deliveryNotes: r.delivery_notes || '',
        deliveryStatus: r.delivery_status,
        total: Number(r.total_amount) || 0,
        items,
        createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
      };
    });

    return NextResponse.json({ orders });
  } catch (err: any) {
    console.error('GET /api/online-orders/pending error:', err);
    return NextResponse.json({ orders: [] });
  }
}
