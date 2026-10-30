import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  getCompanyPermissions,
  updateCompanyPermissions,
  getDynamicDashboardModules
} from '@/lib/company-permissions';
import { requireSuperAdmin, getSession } from '@/lib/auth-session';

export async function GET(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let companyId = searchParams.get('companyId');

    if (!companyId) {
      if (session.companyId) {
        companyId = session.companyId;
      } else {
        const { getAuthorizedCompanyContext } = await import('@/lib/mysql-company');
        const activeComp = await getAuthorizedCompanyContext();
        companyId = activeComp?.id;
      }
    }

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
    }

    // Company Admin can view their own company permissions; Super Admin can view any
    if (session.role !== 'super_admin') {
      if (session.companyId && session.companyId !== companyId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const permissions = await getCompanyPermissions(companyId);
    const availableModules = await getDynamicDashboardModules();

    return NextResponse.json({
      ...permissions,
      _availableModules: availableModules,
      modules: availableModules,
    });
  } catch (err: any) {
    console.error('GET /api/companies/permissions error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    // Only Super Admin can modify module permissions!
    await requireSuperAdmin();

    const body = await request.json();
    const { companyId, _availableModules, modules, ...moduleToggles } = body;

    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
    }

    const success = await updateCompanyPermissions(companyId, moduleToggles);
    const fresh = await getCompanyPermissions(companyId);
    const freshModules = await getDynamicDashboardModules();

    return NextResponse.json({
      success,
      permissions: fresh,
      _availableModules: freshModules,
      modules: freshModules,
    });
  } catch (err: any) {
    console.error('PUT /api/companies/permissions error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 403 });
  }
}
