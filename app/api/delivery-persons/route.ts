import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetDeliveryPersons,
  mysqlCreateDeliveryPerson,
  mysqlUpdateDeliveryPerson,
  mysqlDeleteDeliveryPerson,
} from '@/lib/mysql-billing';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isLocalMySqlMode()) {
      const staff = await mysqlGetDeliveryPersons();
      return NextResponse.json(staff);
    }

    return NextResponse.json([]);
  } catch (err: any) {
    console.error('GET /api/delivery-persons error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch delivery staff' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.name || !data.name.trim()) {
      return NextResponse.json({ error: 'Staff name is required' }, { status: 400 });
    }
    if (!data.employeeId || !data.employeeId.trim()) {
      return NextResponse.json({ error: 'Employee ID / Username is required' }, { status: 400 });
    }
    if (!data.phone || !data.phone.trim()) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      const created = await mysqlCreateDeliveryPerson({
        name: data.name.trim(),
        employeeId: data.employeeId.trim(),
        phone: data.phone.trim(),
        maxActiveDeliveries: data.maxActiveDeliveries ? Number(data.maxActiveDeliveries) : 3,
      });
      return NextResponse.json({ success: true, deliveryPerson: created });
    }

    return NextResponse.json({ success: false, error: 'Available only in local MySQL mode.' });
  } catch (err: any) {
    console.error('POST /api/delivery-persons error:', err);
    return NextResponse.json({ error: err.message || 'Failed to register delivery person' }, { status: 500 });
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
      return NextResponse.json({ error: 'Delivery person ID is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      const success = await mysqlUpdateDeliveryPerson(data.id, {
        name: data.name,
        employeeId: data.employeeId,
        phone: data.phone,
        isActive: data.isActive,
        availabilityStatus: data.availabilityStatus,
        maxActiveDeliveries: data.maxActiveDeliveries,
      });
      return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false });
  } catch (err: any) {
    console.error('PUT /api/delivery-persons error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update delivery person' }, { status: 500 });
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
      return NextResponse.json({ error: 'Delivery person ID is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      const success = await mysqlDeleteDeliveryPerson(id);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ success: false });
  } catch (err: any) {
    console.error('DELETE /api/delivery-persons error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete delivery person' }, { status: 500 });
  }
}
