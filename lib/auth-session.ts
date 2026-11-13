import { cookies } from 'next/headers';
import crypto from 'crypto';
import { UserRole } from './users';
import { isLocalMySqlMode, getMysqlPool, getMasterPool, getCompanyPool } from './mysql';
import { ensureMasterDbInitialized, isSessionTerminated, updateSessionHeartbeat } from './mysql-master';

export interface SessionData {
  sessionId?: string;
  userId: string;
  username: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  databaseName?: string;
  createdAt: number;
}

const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'local-billing-auth-secret-key-32chars-min!!';
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds

/**
 * Signs payload using HMAC-SHA256 to prevent client-side cookie tampering.
 */
export function signSessionPayload(payloadStr: string): string {
  const signature = crypto.createHmac('sha256', SESSION_SECRET).update(payloadStr).digest('base64url');
  return `${Buffer.from(payloadStr).toString('base64url')}.${signature}`;
}

/**
 * Backward compatibility alias for payload signing.
 */
function signPayload(payloadStr: string): string {
  return signSessionPayload(payloadStr);
}

/**
 * Verifies and decodes HMAC-SHA256 signed payload.
 */
export function verifySessionPayload(token: string): any | null {
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
 * Backward compatibility alias for payload verification.
 */
function verifyPayload(token: string): any | null {
  return verifySessionPayload(token);
}

/**
 * Creates a secure, signed, httpOnly session cookie.
 */
export async function createSession(data: {
  sessionId?: string;
  userId: string;
  username: string;
  role: UserRole;
  companyId?: string;
  companyName?: string;
  databaseName?: string;
}): Promise<string> {
  const sessionData: SessionData = {
    sessionId: data.sessionId || crypto.randomUUID(),
    userId: data.userId,
    username: data.username,
    role: data.role,
    companyId: data.companyId,
    companyName: data.companyName,
    databaseName: data.databaseName,
    createdAt: Date.now(),
  };

  const token = signSessionPayload(JSON.stringify(sessionData));
  const isSecure = isLocalMySqlMode() ? false : process.env.NODE_ENV === 'production';

  try {
    const cookieStore = await cookies();

    // Set secure, signed, httpOnly session cookie
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isSecure,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    // Client-readable UI indicators strictly for layout rendering
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
  } catch {
    // Outside Next.js request context (e.g. standalone test scripts or background tasks)
  }

  return token;
}

/**
 * Updates the active company within the cryptographically signed session.
 */
export async function updateSessionCompany(
  companyId: string,
  companyName?: string,
  databaseName?: string
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  await createSession({
    userId: session.userId,
    username: session.username,
    role: session.role,
    companyId,
    companyName: companyName || session.companyName,
    databaseName: databaseName || session.databaseName,
  });
}

/**
 * Resolves and validates a session payload against the Master Database and Company Database.
 * Ensures server-side database name resolution, prevents trusting client database names,
 * and rejects inactive companies or deactivated users.
 */
export async function resolveSessionContext(
  rawPayload: any,
  activeCompanyCookie?: string
): Promise<SessionData | null> {
  if (!rawPayload || !rawPayload.userId || !rawPayload.role) {
    return null;
  }

  const payload: SessionData = {
    sessionId: rawPayload.sessionId,
    userId: rawPayload.userId,
    username: rawPayload.username,
    role: rawPayload.role,
    companyId: rawPayload.companyId,
    companyName: rawPayload.companyName,
    databaseName: undefined, // Always resolve server-side! Never trust payload.databaseName directly.
    createdAt: rawPayload.createdAt || Date.now(),
  };

  // Check if session has been terminated by administrator
  if (isLocalMySqlMode() && payload.sessionId) {
    const terminated = await isSessionTerminated(payload.sessionId);
    if (terminated) {
      return null;
    }
    // Update last activity asynchronously
    updateSessionHeartbeat(payload.sessionId).catch(() => {});
  }

  // Normalize legacy 'admin' to 'company_admin' or 'super_admin'
  if ((payload.role as string) === 'admin') {
    payload.role = payload.username?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin';
  }

  if (!isLocalMySqlMode()) {
    return payload;
  }

  await ensureMasterDbInitialized();
  const masterPool = getMasterPool();

  // 1. SUPER_ADMIN ROLE
  if (payload.role === 'super_admin') {
    // Check if Super Admin is active in master_users if record exists
    try {
      const [muRows]: any = await masterPool.query(
        'SELECT id, is_active FROM master_users WHERE id = ? OR username = ? LIMIT 1',
        [payload.userId, payload.username]
      );
      if (muRows && muRows.length > 0 && muRows[0].is_active === 0) {
        return null; // Deactivated Super Admin
      }
    } catch {}

    // Super Admin can switch companies: check activeCompanyCookie or payload.companyId
    const targetCompId = activeCompanyCookie || payload.companyId;
    if (targetCompId) {
      try {
        const [compRows]: any = await masterPool.query(
          'SELECT id, name, database_name, is_active, status FROM master_companies WHERE id = ? LIMIT 1',
          [targetCompId]
        );
        if (compRows && compRows.length > 0 && compRows[0].is_active === 1 && compRows[0].status === 'active') {
          payload.companyId = compRows[0].id;
          payload.companyName = compRows[0].name;
          payload.databaseName = compRows[0].database_name;
        }
      } catch {}
    }

    // Default to first active master company if none selected
    if (!payload.databaseName) {
      try {
        const [firstRows]: any = await masterPool.query(
          'SELECT id, name, database_name FROM master_companies WHERE is_active = 1 AND status = "active" ORDER BY created_at ASC LIMIT 1'
        );
        if (firstRows && firstRows.length > 0) {
          payload.companyId = firstRows[0].id;
          payload.companyName = firstRows[0].name;
          payload.databaseName = firstRows[0].database_name;
        }
      } catch {}
    }

    return payload;
  }

  // 2. TENANT ROLES (company_admin, cashier, manager, chef, waiter, delivery_staff)
  // Tenant users MUST be bound to their company.
  if (!payload.companyId) {
    try {
      const [rRows]: any = await masterPool.query(
        'SELECT company_id, database_name, role, is_active FROM user_company_routing WHERE (user_id = ? OR username = ?) AND is_active = 1 LIMIT 1',
        [payload.userId, payload.username]
      );
      if (rRows && rRows.length > 0) {
        payload.companyId = rRows[0].company_id;
        payload.databaseName = rRows[0].database_name;
        if (rRows[0].role) {
          payload.role = rRows[0].role === 'admin' ? 'company_admin' : rRows[0].role;
        }
      }
    } catch {}
  }

  if (!payload.companyId) {
    return null; // Cannot route tenant user without company
  }

  // Resolve company in master_companies
  let isMasterCompany = false;
  try {
    const [cRows]: any = await masterPool.query(
      'SELECT id, name, database_name, is_active, status FROM master_companies WHERE id = ? LIMIT 1',
      [payload.companyId]
    );

    if (cRows && cRows.length > 0) {
      isMasterCompany = true;
      const comp = cRows[0];
      // Inactive company check
      if (comp.is_active === 0 || comp.status === 'inactive') {
        return null; // Inactive company rejected
      }

      payload.companyName = comp.name;
      payload.databaseName = comp.database_name; // Server-side resolved database name

      // Verify active user status in tenant database
      try {
        const companyPool = getCompanyPool(comp.database_name);
        const [uRows]: any = await companyPool.query(
          'SELECT role, is_active FROM users WHERE id = ? LIMIT 1',
          [payload.userId]
        );
        if (uRows && uRows.length > 0) {
          if (uRows[0].is_active === 0) {
            return null; // Deactivated user rejected
          }
          if (uRows[0].role) {
            payload.role = uRows[0].role === 'admin' ? 'company_admin' : uRows[0].role;
          }
        }
      } catch {}
    }
  } catch {}

  // Fallback to legacy local_billing_db for unmigrated companies
  if (!isMasterCompany) {
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

  return payload;
}

/**
 * Retrieves and cryptographically validates the current session from the server cookie.
 */
/**
 * Allows automated test runners or internal jobs to set an explicit session context.
 */
export function setTestSessionOverride(session: SessionData | null) {
  (globalThis as any).__testSessionOverride = session;
}

export async function getSession(): Promise<SessionData | null> {
  if ((globalThis as any).__testSessionOverride) {
    return (globalThis as any).__testSessionOverride;
  }
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) {
      // Strictly require signed session token. Never trust unsigned cookies.
      return null;
    }

    const payload = verifySessionPayload(token);
    if (!payload || !payload.userId || !payload.role) {
      return null;
    }

    const activeComp = cookieStore.get('auth_company_id')?.value;
    return await resolveSessionContext(payload, activeComp);
  } catch {
    // Outside Next.js request context (e.g. background tasks or unit tests)
    return null;
  }
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
  cookieStore.delete('auth_username');
  cookieStore.delete('auth_id');
  cookieStore.delete('auth_company_id');
}
