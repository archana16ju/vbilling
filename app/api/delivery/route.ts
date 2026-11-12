import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyPool } from '@/lib/mysql-company';
import { DeliveryStatus } from '@/types/delivery';
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

      let deliveryPersonId: string | undefined = undefined;
      let deliveryPersonName: string | undefined = undefined;

      if (session.role === 'delivery_staff') {
        deliveryPersonName = session.username;
        const { pool, company } = await getAuthorizedCompanyPool();
        const [dpRows]: any = await pool.query(
          `SELECT id, name FROM delivery_persons WHERE company_id = ? AND (LOWER(name) = LOWER(?) OR LOWER(employee_id) = LOWER(?))`,
          [company.id, session.username, session.username]
        );
        if (dpRows && dpRows.length > 0) {
          deliveryPersonId = dpRows[0].id;
          deliveryPersonName = dpRows[0].name;
        }
      }

      const deliveries = await mysqlGetDeliveries({
        status,
        search,
        deliveryPersonId,
        deliveryPersonName,
      });
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
      if (session.role === 'delivery_staff') {
        if (action !== 'updateStatus') {
          return NextResponse.json({ error: 'Access Denied: Delivery staff can only update delivery status.' }, { status: 403 });
        }
        const allowed = ['assigned', 'picked_up', 'out_for_delivery', 'delivered'];
        if (!allowed.includes(data.newStatus)) {
          return NextResponse.json({ error: 'Access Denied: Allowed statuses are Assigned, Picked Up, Out for Delivery, and Delivered.' }, { status: 403 });
        }
      }

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
