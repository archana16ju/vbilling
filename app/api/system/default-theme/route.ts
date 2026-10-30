import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { requireSuperAdmin } from '@/lib/auth-session';
import { getSystemDefaultTheme, setSystemDefaultTheme } from '@/lib/mysql-company-theme';
import { DEFAULT_BLACK_CHERRY_THEME, CompanyTheme, PREDEFINED_THEMES } from '@/lib/theme-config';

export async function GET() {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({
      theme: DEFAULT_BLACK_CHERRY_THEME,
      presets: PREDEFINED_THEMES,
    });
  }

  try {
    const theme = await getSystemDefaultTheme();
    return NextResponse.json({
      theme,
      presets: PREDEFINED_THEMES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Failed to fetch default theme' },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    // Strictly require Super Admin authentication
    await requireSuperAdmin();

    const body = await request.json();
    const { theme } = body;

    if (!theme || !theme.gradientStart || !theme.gradientEnd || !theme.accentColor) {
      return NextResponse.json(
        { error: 'Invalid theme payload. gradientStart, gradientEnd, and accentColor are required.' },
        { status: 400 }
      );
    }

    const validatedTheme: CompanyTheme = {
      id: theme.id || 'custom',
      name: theme.name || 'System Default',
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

    await setSystemDefaultTheme(validatedTheme);

    return NextResponse.json({
      success: true,
      message: 'System default theme updated successfully.',
      theme: validatedTheme,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Access Denied: Only Super Admin can change default theme.' },
      { status: 403 }
    );
  }
}
