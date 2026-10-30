import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import {
  getCompanyTheme,
  saveCompanyTheme,
  resetCompanyTheme,
  getSystemDefaultTheme,
} from '@/lib/mysql-company-theme';
import { PREDEFINED_THEMES, DEFAULT_BLACK_CHERRY_THEME, CompanyTheme } from '@/lib/theme-config';

export async function GET(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({
      success: true,
      theme: DEFAULT_BLACK_CHERRY_THEME,
      isCustom: false,
      presets: PREDEFINED_THEMES,
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

    const { theme, isCustom } = await getCompanyTheme(targetCompanyId);
    const systemDefault = await getSystemDefaultTheme();

    return NextResponse.json({
      success: true,
      companyId: targetCompanyId,
      companyName,
      theme,
      isCustom,
      systemDefault,
      presets: PREDEFINED_THEMES,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Failed to fetch company theme',
        theme: DEFAULT_BLACK_CHERRY_THEME,
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
    const { action, theme, companyId: targetCompanyParam } = body;

    let targetCompanyId: string;

    // Super Admin can specify companyId, Company Admin can strictly only modify their own company
    if (session.role === 'super_admin' && targetCompanyParam) {
      targetCompanyId = targetCompanyParam;
    } else {
      const company = await getAuthorizedCompanyContext();
      targetCompanyId = company.id;
    }

    if (action === 'reset') {
      await resetCompanyTheme(targetCompanyId);
      const systemDefault = await getSystemDefaultTheme();
      return NextResponse.json({
        success: true,
        message: 'Theme reset to system default successfully.',
        theme: systemDefault,
        isCustom: false,
      });
    }

    if (!theme || !theme.gradientStart || !theme.gradientEnd || !theme.accentColor) {
      return NextResponse.json(
        { error: 'Invalid theme payload. gradientStart, gradientEnd, and accentColor are required.' },
        { status: 400 }
      );
    }

    const validatedTheme: CompanyTheme = {
      id: theme.id || 'custom',
      name: theme.name || 'Custom Theme',
      mode: theme.mode === 'light' ? 'light' : 'dark',
      gradientStart: theme.gradientStart,
      gradientMid: theme.gradientMid || theme.gradientStart,
      gradientEnd: theme.gradientEnd,
      accentColor: theme.accentColor,
      accentHover: theme.accentHover || theme.accentColor,
      glowColor: theme.glowColor || 'rgba(219, 39, 119, 0.45)',
      activeBorderColor: theme.activeBorderColor || theme.accentColor,
      badgeBg: theme.badgeBg || 'rgba(219, 39, 119, 0.15)',
      badgeText: theme.badgeText || theme.accentColor,
    };

    await saveCompanyTheme(targetCompanyId, validatedTheme);

    return NextResponse.json({
      success: true,
      message: 'Company theme updated successfully.',
      companyId: targetCompanyId,
      theme: validatedTheme,
      isCustom: true,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to update company theme' },
      { status: 400 }
    );
  }
}
