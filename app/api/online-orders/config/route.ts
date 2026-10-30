import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import { mysqlGetOnlineOrderConfigs, mysqlSaveOnlineOrderConfig } from '@/lib/mysql-billing';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (isLocalMySqlMode()) {
      const configs = await mysqlGetOnlineOrderConfigs();
      return NextResponse.json(configs);
    }

    return NextResponse.json([]);
  } catch (err: any) {
    console.error('GET /api/online-orders/config error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch online order configs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    if (!data.platform) {
      return NextResponse.json({ error: 'Platform identifier is required' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      const saved = await mysqlSaveOnlineOrderConfig({
        platform: data.platform,
        displayName: data.displayName,
        isEnabled: Boolean(data.isEnabled),
        apiKey: data.apiKey,
        apiSecret: data.apiSecret,
        storeId: data.storeId,
        webhookSecret: data.webhookSecret,
        autoAccept: data.autoAccept !== false,
        connectionStatus: data.connectionStatus,
      });

      return NextResponse.json({ success: true, config: saved });
    }

    return NextResponse.json({ success: false, error: 'Available only in local MySQL mode' });
  } catch (err: any) {
    console.error('POST /api/online-orders/config error:', err);
    return NextResponse.json({ error: err.message || 'Failed to save online order config' }, { status: 500 });
  }
}
