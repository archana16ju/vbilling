import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { createSession, getSession } from '@/lib/auth-session';
import { authenticateUser } from '@/lib/auth-login';
import { recordLoginActivity, updateLoginSessionStatus } from '@/lib/mysql-master';
import crypto from 'crypto';

function parseDeviceInfo(userAgent: string | null) {
  const ua = userAgent || '';
  let deviceType = 'Browser';
  if (/Electron/i.test(ua) || /vseyal/i.test(ua)) {
    deviceType = 'Electron Desktop Application';
  } else if (/Android/i.test(ua)) {
    deviceType = 'Android';
  } else if (/Windows/i.test(ua)) {
    deviceType = 'Windows Desktop';
  }

  let browserInfo = 'Standard Browser';
  if (/Edg\//i.test(ua)) browserInfo = 'Microsoft Edge';
  else if (/Chrome\//i.test(ua)) browserInfo = 'Google Chrome';
  else if (/Firefox\//i.test(ua)) browserInfo = 'Mozilla Firefox';
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browserInfo = 'Apple Safari';
  else if (/Electron/i.test(ua)) browserInfo = 'Electron Client';

  return { deviceType, browserInfo };
}

export async function POST(request: Request) {
  try {
    const { username, password, companyCode } = await request.json();
    const userAgent = request.headers.get('user-agent');
    const { deviceType, browserInfo } = parseDeviceInfo(userAgent);
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || '127.0.0.1';

    const authResult = await authenticateUser({
      username,
      password,
      companyCode: companyCode || undefined,
    });

    if (!authResult.success || !authResult.user) {
      // Record failed login attempt
      try {
        await recordLoginActivity({
          sessionId: crypto.randomUUID(),
          username: (username || '').trim() || 'unknown',
          companyId: null,
          loginStatus: 'failed',
          sessionStatus: 'expired',
          failureReason: authResult.error || 'Invalid credentials',
          deviceType,
          browserInfo,
          ipAddress,
        });
      } catch (logErr) {
        console.warn('Failed to log login failure:', logErr);
      }

      const status = authResult.ambiguous ? 409 : 401;
      return NextResponse.json(
        {
          success: false,
          error: authResult.error || 'Invalid username or password',
          ambiguous: authResult.ambiguous,
          matches: authResult.matches,
        },
        { status }
      );
    }

    const { user, redirectUrl } = authResult;
    const sessionId = crypto.randomUUID();

    // Record successful login in master activity log
    try {
      await recordLoginActivity({
        sessionId,
        userId: user.id,
        username: user.username,
        employeeName: user.name || user.username,
        companyId: user.companyId || null,
        companyName: user.companyName || null,
        loginStatus: 'success',
        sessionStatus: 'active',
        deviceType,
        browserInfo,
        ipAddress,
      });
    } catch (logErr) {
      console.warn('Failed to log login success:', logErr);
    }

    // Establish secure, signed httpOnly session with server-resolved database context
    const token = await createSession({
      sessionId,
      userId: user.id,
      username: user.username,
      role: user.role,
      companyId: user.companyId,
      companyName: user.companyName,
      databaseName: user.databaseName,
    });

    const response = NextResponse.json({
      success: true,
      role: user.role,
      username: user.username,
      companyId: user.companyId,
      companyName: user.companyName,
      redirectUrl: redirectUrl || '/terminal',
    });

    const isSecure = isLocalMySqlMode() ? false : process.env.NODE_ENV === 'production';
    response.cookies.set('auth_session', token, { httpOnly: true, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
    response.cookies.set('auth_role', user.role, { httpOnly: false, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
    response.cookies.set('auth_username', user.username, { httpOnly: false, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
    if (user.companyId) {
      response.cookies.set('auth_company_id', user.companyId, { httpOnly: false, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
    }

    return response;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'System error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const session = await getSession();
    if (session?.sessionId) {
      try {
        await updateLoginSessionStatus(session.sessionId, 'logged_out');
      } catch (logErr) {
        console.warn('Failed to update logout status:', logErr);
      }
    }

    const { destroySession } = await import('@/lib/auth-session');
    await destroySession();
    const res = NextResponse.json({ success: true, message: 'Logged out successfully' });
    res.cookies.delete('auth_role');
    res.cookies.delete('auth_username');
    res.cookies.delete('auth_id');
    res.cookies.delete('auth_company_id');
    res.cookies.delete('auth_session');
    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message || 'Logout failed' }, { status: 500 });
  }
}

