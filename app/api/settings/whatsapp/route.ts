import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  mysqlGetWhatsAppSettings,
  mysqlSaveWhatsAppSettings,
} from '@/lib/mysql-billing';
import { DEFAULT_WHATSAPP_SETTINGS, WhatsAppSettings } from '@/types/whatsapp';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const companyId = url.searchParams.get('companyId') || undefined;

    if (isLocalMySqlMode()) {
      const settings = await mysqlGetWhatsAppSettings(companyId);
      return NextResponse.json({ settings });
    }

    return NextResponse.json({
      settings: {
        ...DEFAULT_WHATSAPP_SETTINGS,
        companyId: companyId || 'COMP-0001',
      },
    });
  } catch (err: any) {
    console.error('GET /api/settings/whatsapp error:', err);
    return NextResponse.json({
      settings: DEFAULT_WHATSAPP_SETTINGS,
      error: err.message,
    });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session && !isLocalMySqlMode()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { settings, companyId } = body as {
      settings: Partial<WhatsAppSettings>;
      companyId?: string;
    };

    if (!settings) {
      return NextResponse.json({ error: 'Missing settings payload' }, { status: 400 });
    }

    if (!isLocalMySqlMode()) {
      // In non-MySQL mode, accept in-memory/echo
      return NextResponse.json({
        success: true,
        message: 'Saved (offline / non-MySQL mode)',
        settings: { ...DEFAULT_WHATSAPP_SETTINGS, ...settings },
      });
    }

    const saved = await mysqlSaveWhatsAppSettings(settings, companyId);
    return NextResponse.json({ success: true, settings: saved });
  } catch (err: any) {
    console.error('POST /api/settings/whatsapp error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save WhatsApp settings' },
      { status: 500 }
    );
  }
}
