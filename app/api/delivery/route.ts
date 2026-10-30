import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetDeliveries,
  mysqlGetDeliveryByBillId,
  mysqlGetDeliveryByTrackingToken,
  mysqlUpdateDeliveryStatus,
  mysqlManualAssignDelivery,
  mysqlUpdateDeliveryLocation,
} from '@/lib/mysql-billing';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const trackingToken = url.searchParams.get('trackingToken');

    // Tracking token can be publicly read by customers
    if (trackingToken) {
      if (isLocalMySqlMode()) {
        const tracking = await mysqlGetDeliveryByTrackingToken(trackingToken);
        if (!tracking) {
          return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }
        return NextResponse.json(tracking);
      }
      return NextResponse.json({ error: 'Available only in local MySQL mode' }, { status: 400 });
    }

    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isLocalMySqlMode()) {
      const billId = url.searchParams.get('billId');
      if (billId) {
        const delivery = await mysqlGetDeliveryByBillId(billId);
        return NextResponse.json(delivery);
      }

      const status = url.searchParams.get('status') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const deliveries = await mysqlGetDeliveries({ status, search });
      return NextResponse.json(deliveries);
    }

    return NextResponse.json([]);
  } catch (err: any) {
    console.error('GET /api/delivery error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch deliveries' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const { action, deliveryId } = data;

    if (!deliveryId) {
      return NextResponse.json({ error: 'Delivery ID is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      if (action === 'updateStatus') {
        const { newStatus, deliveryNotes } = data;
        if (!newStatus) {
          return NextResponse.json({ error: 'New delivery status is required' }, { status: 400 });
        }
        const result = await mysqlUpdateDeliveryStatus(deliveryId, newStatus, deliveryNotes);
        return NextResponse.json(result);
      }

      if (action === 'assign') {
        const { deliveryPersonId } = data;
        const result = await mysqlManualAssignDelivery(deliveryId, deliveryPersonId || null);
        return NextResponse.json(result);
      }

      if (action === 'updateLocation') {
        const { latitude, longitude } = data;
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
          return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
        }
        const result = await mysqlUpdateDeliveryLocation(deliveryId, latitude, longitude);
        return NextResponse.json(result);
      }

      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: 'Available only in local MySQL mode.' });
  } catch (err: any) {
    console.error('PUT /api/delivery error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update delivery' }, { status: 500 });
  }
}
