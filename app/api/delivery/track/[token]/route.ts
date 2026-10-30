import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { mysqlGetDeliveryByTrackingToken } from '@/lib/mysql-billing';

export async function GET(
  request: Request,
  props: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await props.params;
    if (!token) {
      return NextResponse.json({ error: 'Tracking token is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      const delivery = await mysqlGetDeliveryByTrackingToken(token);
      if (!delivery) {
        return NextResponse.json({ error: 'Delivery order not found or invalid link' }, { status: 404 });
      }
      return NextResponse.json(delivery);
    }

    return NextResponse.json({ error: 'Available only in local MySQL mode' }, { status: 400 });
  } catch (err: any) {
    console.error('GET /api/delivery/track/[token] error:', err);
    return NextResponse.json({ error: err.message || 'Failed to retrieve tracking details' }, { status: 500 });
  }
}
