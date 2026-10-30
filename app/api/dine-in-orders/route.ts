import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import {
  getDineInOrders,
  createOrUpdateDineInOrder,
  updateDineInServingStatus,
  assignDineInWaiter,
  updateDineInKitchenStatus,
} from '@/lib/actions/dine-in';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const waiterId = searchParams.get('waiterId') || undefined;
    const tableId = searchParams.get('tableId') || undefined;
    const servingStatus = searchParams.get('servingStatus') || undefined;
    const kitchenStatus = searchParams.get('kitchenStatus') || undefined;
    const activeOnly = searchParams.get('activeOnly') === 'true';

    const result = await getDineInOrders({
      waiterId,
      tableId,
      servingStatus,
      kitchenStatus,
      activeOnly,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to fetch dine-in orders' }, { status: 500 });
    }

    return NextResponse.json({ success: true, orders: result.orders });
  } catch (err: any) {
    console.error('GET /api/dine-in-orders error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const result = await createOrUpdateDineInOrder(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to create dine-in order' }, { status: 400 });
    }

    return NextResponse.json({ success: true, orderId: result.orderId });
  } catch (err: any) {
    console.error('POST /api/dine-in-orders error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, orderId, servingStatus, waiterId, waiterName, kitchenStatus } = body;

    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }

    if (action === 'updateServingStatus' || servingStatus) {
      const res = await updateDineInServingStatus(orderId, servingStatus);
      return NextResponse.json(res);
    }

    if (action === 'assignWaiter') {
      const res = await assignDineInWaiter(orderId, waiterId || null, waiterName || null);
      return NextResponse.json(res);
    }

    if (action === 'updateKitchenStatus' && kitchenStatus) {
      const res = await updateDineInKitchenStatus(orderId, kitchenStatus);
      return NextResponse.json(res);
    }

    return NextResponse.json({ error: 'Invalid update action' }, { status: 400 });
  } catch (err: any) {
    console.error('PUT /api/dine-in-orders error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
