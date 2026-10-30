import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import {
  getCompanyShortcuts,
  saveCompanyShortcuts,
  resetCompanyShortcuts,
  getSystemDefaultShortcuts,
} from '@/lib/mysql-company-shortcuts';
import { StoredShortcutConfig, ALL_SHORTCUT_DEFINITIONS } from '@/lib/shortcuts-config';

export async function GET(request: Request) {
  if (!isLocalMySqlMode()) {
    const fallback = await getSystemDefaultShortcuts();
    return NextResponse.json({
      success: true,
      config: fallback,
      isCustom: false,
      definitions: ALL_SHORTCUT_DEFINITIONS,
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

    // Super Admin can inspect an arbitrary companyId
    if (session.role === 'super_admin' && requestedCompanyId) {
      targetCompanyId = requestedCompanyId;
      companyName = requestedCompanyId;
    } else {
      const company = await getAuthorizedCompanyContext();
      targetCompanyId = company.id;
      companyName = company.name;
    }

    const { config, isCustom } = await getCompanyShortcuts(targetCompanyId);
    const systemDefault = await getSystemDefaultShortcuts();

    return NextResponse.json({
      success: true,
      companyId: targetCompanyId,
      companyName,
      config,
      isCustom,
      systemDefault,
      definitions: ALL_SHORTCUT_DEFINITIONS,
    });
  } catch (err: any) {
    const fallback = await getSystemDefaultShortcuts();
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch company shortcuts',
        config: fallback,
        definitions: ALL_SHORTCUT_DEFINITIONS,
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

    // Super Admin can specify companyId, Company Admin can strictly only modify their own company
    if (session.role === 'super_admin' && targetCompanyParam) {
      targetCompanyId = targetCompanyParam;
    } else {
      const company = await getAuthorizedCompanyContext();
      targetCompanyId = company.id;
    }

    if (action === 'reset' || body.reset === true) {
      await resetCompanyShortcuts(targetCompanyId);
      const systemDefault = await getSystemDefaultShortcuts();
      return NextResponse.json({
        success: true,
        message: 'Shortcuts reset to system default successfully.',
        config: systemDefault,
        isCustom: false,
      });
    }

    if (!config || !config.actions) {
      return NextResponse.json(
        { error: 'Invalid shortcut payload. actions mapping is required.' },
        { status: 400 }
      );
    }

    const validatedConfig: StoredShortcutConfig = {
      showKeysOnButtons: config.showKeysOnButtons ?? true,
      actions: config.actions,
    };

    await saveCompanyShortcuts(targetCompanyId, validatedConfig);

    return NextResponse.json({
      success: true,
      message: 'Company shortcuts updated successfully.',
      companyId: targetCompanyId,
      config: validatedConfig,
      isCustom: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update company shortcuts' },
      { status: 400 }
    );
  }
}
