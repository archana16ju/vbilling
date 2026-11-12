import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { createSession } from '@/lib/auth-session';
import { authenticateUser } from '@/lib/auth-login';

export async function POST(request: Request) {
  try {
    const { username, password, companyCode } = await request.json();

    const authResult = await authenticateUser({
      username,
      password,
      companyCode: companyCode || undefined,
    });

    if (!authResult.success || !authResult.user) {
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

    // Establish secure, signed httpOnly session with server-resolved database context
    const token = await createSession({
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

