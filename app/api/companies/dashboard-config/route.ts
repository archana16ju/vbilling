import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import {
  getCompanyDashboardConfig,
  saveCompanyDashboardConfig,
  resetCompanyDashboardConfig,
} from '@/lib/mysql-company-dashboard';
import { DEFAULT_COMPANY_DASHBOARD_CONFIG } from '@/lib/dashboard-config';

export async function GET(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({
      success: true,
      config: DEFAULT_COMPANY_DASHBOARD_CONFIG,
      isCustom: false,
    });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get('companyId');

    let targetCompanyId: string;
    let companyName: string = '';

    // Only super_admin can query an arbitrary companyId
    if (session.role === 'super_admin' && requestedCompanyId) {
      targetCompanyId = requestedCompanyId;
      companyName = requestedCompanyId;
    } else {
      const company = await getAuthorizedCompanyContext();
      targetCompanyId = company.id;
      companyName = company.name;
    }

    const { config, isCustom } = await getCompanyDashboardConfig(targetCompanyId);

    return NextResponse.json({
      success: true,
      companyId: targetCompanyId,
      companyName,
      config,
      isCustom,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch company dashboard configuration',
        config: DEFAULT_COMPANY_DASHBOARD_CONFIG,
      },
      { status: 400 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: You must be logged in.' }, { status: 401 });
    }

    const body = await request.json();
    const { action, config, companyId: targetCompanyParam } = body;

    let targetCompanyId: string;

    if (session.role === 'super_admin') {
      if (targetCompanyParam) {
        targetCompanyId = targetCompanyParam;
      } else {
        const company = await getAuthorizedCompanyContext();
        targetCompanyId = company.id;
      }
    } else if (session.role === 'company_admin' || session.role === 'manager') {
      const company = await getAuthorizedCompanyContext();
      targetCompanyId = company.id;
    } else {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to modify company dashboard settings.' },
        { status: 403 }
      );
    }

    if (action === 'reset') {
      await resetCompanyDashboardConfig(targetCompanyId);
      return NextResponse.json({
        success: true,
        message: 'Dashboard configuration reset to default successfully.',
        config: DEFAULT_COMPANY_DASHBOARD_CONFIG,
        isCustom: false,
      });
    }

    if (!config || !Array.isArray(config.widgets)) {
      return NextResponse.json({ error: 'Invalid dashboard configuration payload.' }, { status: 400 });
    }

    await saveCompanyDashboardConfig(targetCompanyId, config);

    const updated = await getCompanyDashboardConfig(targetCompanyId);

    return NextResponse.json({
      success: true,
      message: 'Company dashboard configuration saved successfully.',
      companyId: targetCompanyId,
      config: updated.config,
      isCustom: updated.isCustom,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save dashboard configuration.' },
      { status: 400 }
    );
  }
}
