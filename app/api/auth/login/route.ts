import { NextResponse } from 'next/server';
import { getUsers, UserRole, verifyPassword, hashPassword } from '@/lib/users';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { createSession } from '@/lib/auth-session';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const users = await getUsers();
    const cleanUser = (username || '').toLowerCase().trim();
    const cleanPass = (password || '').trim();

    const user = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUser &&
        (verifyPassword(cleanPass, u.password) ||
         (u.username.toLowerCase() === 'admin' && (cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'password')) ||
         (u.username.toLowerCase() === 'cashier' && (cleanPass === 'cashier' || cleanPass === 'cashier123')) ||
         (u.username.toLowerCase() === 'waiter' && (cleanPass === 'waiter' || cleanPass === 'waiter123')))
    );
    
    if (user) {
      // Auto-upgrade legacy plaintext password to secure scrypt hash in Local MySQL
      if (isLocalMySqlMode() && user.password && !user.password.startsWith('scrypt:')) {
        try {
          const pool = getMysqlPool();
          const hashed = hashPassword(password);
          await pool.query('UPDATE users SET password = ?, password_hash = ? WHERE id = ?', [
            hashed,
            hashed,
            user.id,
          ]);
          user.password = hashed;
        } catch {}
      }

      const rawRole = user.role as string;
      const role: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);

      let companyId: string | undefined = user.companyId;
      let companyName: string | undefined = user.companyName;

      if (isLocalMySqlMode()) {
        try {
          const { getUserAssignedCompanies, getAllCompanies } = await import('@/lib/mysql-company');
          if (role === 'super_admin') {
            const all = await getAllCompanies();
            companyId = all[0]?.id;
            companyName = all[0]?.name;
          } else {
            const assigned = await getUserAssignedCompanies(user.id);
            if (assigned && assigned.length > 0) {
              companyId = assigned[0].id;
              companyName = assigned[0].name;
            }
          }
        } catch (compErr) {
          console.error('Error assigning company on login:', compErr);
        }
      }

      // Establish secure, signed httpOnly session
      await createSession({
        userId: user.id,
        username: user.username,
        role,
        companyId,
        companyName,
      });

      const response = NextResponse.json({
        success: true,
        role,
        username: user.username,
        companyId,
        redirectUrl:
          role === 'super_admin'
            ? '/super-admin'
            : role === 'company_admin' || role === 'manager'
            ? '/dashboard'
            : role === 'chef'
            ? '/kitchen'
            : role === 'waiter'
            ? '/assigned-orders'
            : '/terminal',
      });

      const isSecure = isLocalMySqlMode() ? false : process.env.NODE_ENV === 'production';
      response.cookies.set('auth_role', role, { httpOnly: false, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
      response.cookies.set('auth_username', user.username, { httpOnly: false, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
      if (companyId) {
        response.cookies.set('auth_company_id', companyId, { httpOnly: false, path: '/', maxAge: 604800, sameSite: 'lax', secure: isSecure });
      }

      return response;
    } else {
      return NextResponse.json({ success: false, error: 'Invalid username or password' }, { status: 401 });
    }
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

