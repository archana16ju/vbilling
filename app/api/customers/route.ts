import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
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
