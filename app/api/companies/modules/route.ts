import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  getDynamicDashboardModules,
  registerCustomDashboardModule
} from '@/lib/company-permissions';
import { requireSuperAdmin, getSession } from '@/lib/auth-session';

export async function GET() {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const modules = await getDynamicDashboardModules();
    return NextResponse.json({ modules });
  } catch (err: any) {
    console.error('GET /api/companies/modules error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    await requireSuperAdmin();

    const body = await request.json();
    const { key, label, desc } = body;

    if (!label || !label.trim()) {
      return NextResponse.json({ error: 'Module label is required.' }, { status: 400 });
    }

    const cleanKey = (key || label).toLowerCase().trim().replace(/[^a-z0-9_]/g, '_');
    await registerCustomDashboardModule(cleanKey, label.trim(), desc?.trim());

    const freshModules = await getDynamicDashboardModules();
    return NextResponse.json({ success: true, modules: freshModules });
  } catch (err: any) {
    console.error('POST /api/companies/modules error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
