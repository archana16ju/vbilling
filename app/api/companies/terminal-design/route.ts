import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import {
  getCompanyTerminalDesign,
  saveCompanyTerminalDesign,
  resetCompanyTerminalDesign,
  DEFAULT_PERSISTED_TERMINAL_DESIGN,
} from '@/lib/mysql-company-terminal-design';

export async function GET(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({
      success: true,
      design: DEFAULT_PERSISTED_TERMINAL_DESIGN,
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

    const { design, isCustom } = await getCompanyTerminalDesign(targetCompanyId);

    return NextResponse.json({
      success: true,
      companyId: targetCompanyId,
      companyName,
      design,
      isCustom,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch company terminal design',
        design: DEFAULT_PERSISTED_TERMINAL_DESIGN,
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
    const { action, design, companyId: targetCompanyParam } = body;

    let targetCompanyId: string;

    // Super Admin can specify companyId, Company Admin can strictly only modify their own company
    if (session.role === 'super_admin' && targetCompanyParam) {
      targetCompanyId = targetCompanyParam;
    } else {
      const company = await getAuthorizedCompanyContext();
      targetCompanyId = company.id;
    }

    if (action === 'reset') {
      await resetCompanyTerminalDesign(targetCompanyId);
      return NextResponse.json({
        success: true,
        message: 'Terminal design reset to system default successfully.',
        design: DEFAULT_PERSISTED_TERMINAL_DESIGN,
        isCustom: false,
      });
    }

    if (!design || typeof design !== 'object') {
      return NextResponse.json({ error: 'Valid design object is required.' }, { status: 400 });
    }

    await saveCompanyTerminalDesign(targetCompanyId, design);
    const updated = await getCompanyTerminalDesign(targetCompanyId);

    return NextResponse.json({
      success: true,
      message: 'Terminal design saved and applied successfully.',
      companyId: targetCompanyId,
      design: updated.design,
      isCustom: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to save terminal design' },
      { status: 400 }
    );
  }
}
