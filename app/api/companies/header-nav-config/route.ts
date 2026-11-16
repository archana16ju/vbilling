import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  getCompanyHeaderNavConfig,
  saveCompanyHeaderNavConfig,
  resetCompanyHeaderNavConfig,
} from '@/lib/mysql-company-header-nav';
import { DEFAULT_HEADER_NAV_CONFIG } from '@/lib/header-nav-config';

/**
 * GET /api/companies/header-nav-config
 * Resolves current company's header navigation configuration.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    const companyId = session.companyId || req.nextUrl.searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ config: DEFAULT_HEADER_NAV_CONFIG, isCustom: false });
    }

    const result = await getCompanyHeaderNavConfig(companyId);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[API Header Nav Config GET] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to fetch header nav configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/companies/header-nav-config
 * Saves customized header navigation configuration for the authenticated company.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Session missing' }, { status: 401 });
    }

    // Role check: super_admin, company_admin, and manager are authorized to configure header
    const allowedRoles = ['super_admin', 'company_admin', 'manager'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json(
        { error: 'Forbidden: Insufficient privileges to customize header navigation' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const companyId = session.companyId || body.companyId;

    if (!companyId) {
      return NextResponse.json(
        { error: 'Bad Request: Active company ID is required' },
        { status: 400 }
      );
    }

    if (body.action === 'reset') {
      const resetConfig = await resetCompanyHeaderNavConfig(companyId);
      return NextResponse.json({
        success: true,
        message: 'Header navigation configuration reset to factory defaults',
        config: resetConfig,
      });
    }

    if (!body.config || typeof body.config !== 'object') {
      return NextResponse.json(
        { error: 'Bad Request: Missing or invalid "config" payload' },
        { status: 400 }
      );
    }

    const savedConfig = await saveCompanyHeaderNavConfig(companyId, body.config);

    return NextResponse.json({
      success: true,
      message: 'Header navigation configuration saved successfully',
      config: savedConfig,
    });
  } catch (err: any) {
    console.error('[API Header Nav Config POST] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to save header nav configuration' },
      { status: 500 }
    );
  }
}
