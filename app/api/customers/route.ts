import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyPool } from '@/lib/mysql-company';
import { detectCustomerDuplicate, normalizePhoneNumber } from '@/lib/duplicate-detector';
import { RowDataPacket } from 'mysql2';
import {
  mysqlGetCustomers,
  mysqlGetCustomersWithStats,
  mysqlGetCustomerRecentOrders,
  mysqlCreateCustomer,
  mysqlUpdateCustomer,
  mysqlDeleteCustomer,
} from '@/lib/mysql-billing';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isLocalMySqlMode()) {
      const url = new URL(request.url);
      const ordersOnly = url.searchParams.get('orders') === 'true';
      if (ordersOnly) {
        const name = url.searchParams.get('name') || undefined;
        const phone = url.searchParams.get('phone') || undefined;
        const orders = await mysqlGetCustomerRecentOrders(name, phone);
        return NextResponse.json(orders);
      }

      const q = (url.searchParams.get('q') || url.searchParams.get('phone') || '').trim();
      if (q) {
        const { pool, company } = await getAuthorizedCompanyPool();
        const cleanDigits = q.replace(/\D/g, '');
        const searchPattern = `%${q}%`;
        const digitsPattern = cleanDigits ? `%${cleanDigits}%` : searchPattern;

        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT id, company_id, name, phone, email, address, gstin, created_at,
                  loyalty_points_balance, loyalty_tier, total_points_earned, total_points_redeemed
           FROM customers 
           WHERE company_id = ? 
             AND (name LIKE ? OR phone LIKE ? OR phone LIKE ? OR email LIKE ?)
           ORDER BY name ASC LIMIT 25`,
          [company.id, searchPattern, searchPattern, digitsPattern, searchPattern]
        );

        const mapped = rows.map((r: any) => ({
          id: r.id,
          companyId: r.company_id,
          name: r.name,
          phone: r.phone || undefined,
          email: r.email || undefined,
          address: r.address || undefined,
          gstin: r.gstin || undefined,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          loyaltyPointsBalance: Number(r.loyalty_points_balance) || 0,
          loyaltyTier: r.loyalty_tier || 'Silver',
          totalPointsEarned: Number(r.total_points_earned) || 0,
          totalPointsRedeemed: Number(r.total_points_redeemed) || 0,
        }));

        return NextResponse.json(mapped);
      }

      const withStats = url.searchParams.get('stats') !== 'false';
      const customers = withStats
        ? await mysqlGetCustomersWithStats()
        : await mysqlGetCustomers();
      return NextResponse.json(customers);
    }

    return NextResponse.json([]);
  } catch (err: any) {
    console.error('GET /api/customers error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch customers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.name || data.name.trim() === '') {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    const companyId = session.companyId || 'comp_default';

    // Duplicate detection by phone within current company
    if (data.phone) {
      const dup = await detectCustomerDuplicate(companyId, {
        phone: data.phone,
        name: data.name,
      });

      if (dup.hasDuplicate && !data.allowDuplicate) {
        return NextResponse.json(
          {
            error: `A customer with phone "${data.phone}" already exists (${dup.existingRecord?.name || 'Existing Customer'}).`,
            duplicate: dup,
          },
          { status: 409 }
        );
      }
    }

    if (isLocalMySqlMode()) {
      const customer = await mysqlCreateCustomer({
        name: data.name.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim(),
        address: data.address?.trim(),
        gstin: data.gstin?.trim(),
      });
      return NextResponse.json({ success: true, customer });
    }

    return NextResponse.json({ success: false, error: 'Customer management is available in local MySQL mode.' });
  } catch (err: any) {
    console.error('POST /api/customers error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create customer' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    const companyId = session.companyId || 'comp_default';

    // Duplicate detection by phone on update
    if (data.phone) {
      const dup = await detectCustomerDuplicate(companyId, {
        id: data.id,
        phone: data.phone,
        name: data.name,
      });

      if (dup.hasDuplicate && !data.allowDuplicate) {
        return NextResponse.json(
          {
            error: `Another customer with phone "${data.phone}" already exists (${dup.existingRecord?.name || 'Existing Customer'}).`,
            duplicate: dup,
          },
          { status: 409 }
        );
      }
    }

    if (isLocalMySqlMode()) {
      const success = await mysqlUpdateCustomer(data.id, {
        name: data.name?.trim(),
        phone: data.phone?.trim(),
        email: data.email?.trim(),
        address: data.address?.trim(),
        gstin: data.gstin?.trim(),
      });
      return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false });
  } catch (err: any) {
    console.error('PUT /api/customers error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update customer' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      const success = await mysqlDeleteCustomer(id);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false });
  } catch (err: any) {
    console.error('DELETE /api/customers error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete customer' }, { status: 500 });
  }
}
