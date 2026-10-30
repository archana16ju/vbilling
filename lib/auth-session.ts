import { cookies } from 'next/headers';
import crypto from 'crypto';
import { UserRole } from './users';
import { isLocalMySqlMode, getMysqlPool } from './mysql';

export interface SessionData {
  userId: string;
  username: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  createdAt: number;
}

const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-billing-auth-secret-key-32chars-min!!';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Signs payload using HMAC-SHA256 to prevent client-side cookie tampering.
 */
function signPayload(payloadStr: string): string {
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  return `${Buffer.from(payloadStr).toString('base64url')}.${signature}`;
}

/**
 * Verifies and decodes HMAC-SHA256 signed payload.
 */
function verifyPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encodedPayload, signature] = parts;
    const payloadStr = Buffer.from(encodedPayload, 'base64url').toString('utf8');
    const expectedSignature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      return null;
    }
    return JSON.parse(payloadStr);
  } catch (err) {
    return null;
  }
}

/**
 * Creates a secure, signed, httpOnly session cookie.
 */
export async function createSession(data: {
  userId: string;
  username: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const sessionData: SessionData = {
    userId: data.userId,
    username: data.username,
    role: data.role,
    companyId: data.companyId,
    companyName: data.companyName,
    createdAt: Date.now(),
  };

  const token = signPayload(JSON.stringify(sessionData));

  const isSecure = isLocalMySqlMode() ? false : process.env.NODE_ENV === 'production';

  // Set secure, signed, httpOnly session cookie
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  // Also maintain client-readable role/company indicator strictly for UI rendering
  // (Server NEVER trusts these; server strictly verifies the signed auth_session token!)
  cookieStore.set('auth_role', data.role, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  cookieStore.set('auth_username', data.username, {
    httpOnly: false,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });

  if (data.companyId) {
    cookieStore.set('auth_company_id', data.companyId, {
      httpOnly: false,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
  } else {
    cookieStore.delete('auth_company_id');
  }
}

/**
 * Retrieves and cryptographically validates the current session from the server cookie.
 */
export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    // Strictly require signed session token. Never trust unsigned cookies.
    return null;
  }

  const payload = verifyPayload(token);
  if (!payload || !payload.userId || !payload.role) {
    return null;
  }

  // Normalize legacy 'admin' to 'company_admin'
  if ((payload.role as string) === 'admin') {
    payload.role = 'company_admin';
  }

  // In local MySQL mode, dynamically resolve live company_id and role from users table to prevent stale cookie mismatches
  if (isLocalMySqlMode() && payload.role !== 'super_admin' && payload.userId) {
    try {
      const pool = getMysqlPool();
      const [uRows]: any = await pool.query(
        'SELECT company_id, role, is_active FROM users WHERE id = ? LIMIT 1',
        [payload.userId]
      );
      if (uRows && uRows.length > 0) {
        if (uRows[0].is_active === 0) {
          return null; // Deactivated account
        }
        if (uRows[0].company_id) {
          payload.companyId = uRows[0].company_id;
        }
        if (uRows[0].role) {
          payload.role = uRows[0].role === 'admin' ? 'company_admin' : uRows[0].role;
        }
      }
    } catch {}
  }

  return payload as SessionData;
}

/**
 * Requires an authenticated user session.
 */
export async function requireAuth(): Promise<SessionData> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized: You must be logged in to perform this action.');
  }
  return session;
}

/**
 * Requires strictly the Super Admin role.
 */
export async function requireSuperAdmin(): Promise<SessionData> {
  const session = await requireAuth();
  if (session.role !== 'super_admin') {
    throw new Error('Access Denied: Only the Super Admin can perform this action.');
  }
  return session;
}

/**
 * Destroys session cookies upon logout.
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  cookieStore.delete('auth_role');
  cookieStore.delete('auth_id');
  cookieStore.delete('auth_company_id');
}
