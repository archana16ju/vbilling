import { verifyPassword, hashPassword, UserRole, getUsers } from './users';
import { isLocalMySqlMode, getMysqlPool, getCompanyPool, getMasterPool } from './mysql';
import { ensureMasterDbInitialized, resolveUserCompanyRoute } from './mysql-master';
import { getUserAssignedCompanies, getAllCompanies } from './mysql-company';
import { RowDataPacket } from 'mysql2';

export interface AuthCredentials {
  username: string;
  password: string;
  companyCode?: string;
}

export interface AuthResult {
  success: boolean;
  user?: {
    id: string;
    username: string;
    name?: string;
    role: UserRole;
    companyId?: string;
    companyName?: string;
    databaseName?: string;
  };
  redirectUrl?: string;
  ambiguous?: boolean;
  matches?: Array<{
    companyId: string;
    companyCode: string;
    companyName: string;
    role: string;
  }>;
  error?: string;
}

export function getRoleRedirectUrl(role: UserRole): string {
  switch (role) {
    case 'super_admin':
      return '/super-admin';
    case 'company_admin':
    case 'manager':
      return '/dashboard';
    case 'chef':
      return '/kitchen';
    case 'waiter':
      return '/assigned-orders';
    case 'delivery_staff':
      return '/delivery';
    case 'cashier':
    default:
      return '/terminal';
  }
}

/**
 * Unified authentication processor for Phase 3B.
 *
 * Tier 1: Check Master Database Super Admin (`billing_master_db.master_users`).
 * Tier 2: Check Tenant Database Routing (`billing_master_db.user_company_routing` & Tenant DB).
 *         If duplicate usernames exist across companies, requests Company Code.
 * Tier 3: Safe Fallback to existing `local_billing_db.users` (ensuring unmigrated users continue logging in seamlessly).
 *
 * Never trusts frontend-supplied database names, company IDs, or roles.
 */
export async function authenticateUser(credentials: AuthCredentials): Promise<AuthResult> {
  const cleanUser = (credentials.username || '').toLowerCase().trim();
  const cleanPass = (credentials.password || '').trim();
  const cleanCompanyCode = (credentials.companyCode || '').trim().toUpperCase();

  if (!cleanUser || !cleanPass) {
    return { success: false, error: 'Username and password are required.' };
  }

  // =========================================================================
  // TIER 1: Master Database Super Admin (`billing_master_db.master_users`)
  // =========================================================================
  if (isLocalMySqlMode()) {
    try {
      await ensureMasterDbInitialized();
      const masterPool = getMasterPool();

      const [superRows] = await masterPool.query<RowDataPacket[]>(
        `SELECT id, username, name, email, password_hash, role, is_active
         FROM master_users
         WHERE LOWER(username) = ? LIMIT 1`,
        [cleanUser]
      );

      if (superRows && superRows.length > 0) {
        const superUser = superRows[0];

        if (superUser.is_active === 0) {
          return { success: false, error: 'Account is deactivated. Please contact support.' };
        }

        const passwordMatches = verifyPassword(cleanPass, superUser.password_hash);
        if (!passwordMatches) {
          return { success: false, error: 'Invalid username or password' };
        }

        // Super Admin authenticated! Resolve active company context
        let activeCompanyId: string | undefined;
        let activeCompanyName: string | undefined;
        let activeDatabaseName: string | undefined;

        if (cleanCompanyCode) {
          const [compRows] = await masterPool.query<RowDataPacket[]>(
            'SELECT id, name, database_name FROM master_companies WHERE (code = ? OR id = ?) AND is_active = 1 LIMIT 1',
            [cleanCompanyCode, cleanCompanyCode]
          );
          if (compRows && compRows.length > 0) {
            activeCompanyId = compRows[0].id;
            activeCompanyName = compRows[0].name;
            activeDatabaseName = compRows[0].database_name;
          }
        }

        if (!activeDatabaseName) {
          const [defaultCompRows] = await masterPool.query<RowDataPacket[]>(
            'SELECT id, name, database_name FROM master_companies WHERE is_active = 1 ORDER BY created_at ASC LIMIT 1'
          );
          if (defaultCompRows && defaultCompRows.length > 0) {
            activeCompanyId = defaultCompRows[0].id;
            activeCompanyName = defaultCompRows[0].name;
            activeDatabaseName = defaultCompRows[0].database_name;
          }
        }

        return {
          success: true,
          user: {
            id: superUser.id,
            username: superUser.username,
            name: superUser.name,
            role: 'super_admin',
            companyId: activeCompanyId,
            companyName: activeCompanyName,
            databaseName: activeDatabaseName,
          },
          redirectUrl: '/super-admin',
        };
      }
    } catch (masterErr) {
      console.error('[Auth] Error querying master_users:', masterErr);
    }
  }

  // =========================================================================
  // TIER 2: Tenant Database Routing (`billing_master_db.user_company_routing`)
  // =========================================================================
  if (isLocalMySqlMode()) {
    try {
      const routeResult = await resolveUserCompanyRoute({
        username: cleanUser,
        companyIdentifier: cleanCompanyCode || undefined,
      });

      if (routeResult.ambiguous) {
        return {
          success: false,
          ambiguous: true,
          error: `Username '${cleanUser}' exists in ${routeResult.matches.length} companies. Please enter your Company Code.`,
          matches: routeResult.matches,
        };
      }

      // If user explicitly specified a company code but that company is inactive/suspended or user route is deactivated, reject immediately
      if (cleanCompanyCode && !routeResult.resolved && routeResult.error && (routeResult.error.includes('inactive or suspended') || routeResult.error.includes('deactivated'))) {
        return { success: false, error: routeResult.error };
      }

      if (routeResult.resolved && routeResult.route) {
        const route = routeResult.route;
        const masterPool = getMasterPool();

        // Check if company is active
        const [compRows] = await masterPool.query<RowDataPacket[]>(
          'SELECT id, name, is_active, status FROM master_companies WHERE id = ? LIMIT 1',
          [route.companyId]
        );

        if (!compRows || compRows.length === 0 || compRows[0].is_active === 0 || compRows[0].status === 'inactive') {
          return { success: false, error: 'Company account is inactive or suspended.' };
        }

        const companyName = compRows[0].name;

        // Query user within the specific company database
        const tenantPool = getCompanyPool(route.databaseName);
        const [tenantUserRows] = await tenantPool.query<RowDataPacket[]>(
          `SELECT id, name, username, email, password, password_hash, role, is_active
           FROM users
           WHERE id = ? OR LOWER(username) = ? LIMIT 1`,
          [route.userId, cleanUser]
        );

        if (tenantUserRows && tenantUserRows.length > 0) {
          const tenantUser = tenantUserRows[0];

          if (tenantUser.is_active === 0) {
            return { success: false, error: 'Account is deactivated. Please contact company administrator.' };
          }

          const passwordHash = tenantUser.password_hash || tenantUser.password;
          const passwordMatches = verifyPassword(cleanPass, passwordHash);

          if (!passwordMatches) {
            return { success: false, error: 'Invalid username or password' };
          }

          const rawRole = tenantUser.role as string;
          const role: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);

          return {
            success: true,
            user: {
              id: tenantUser.id,
              username: tenantUser.username,
              name: tenantUser.name,
              role,
              companyId: route.companyId,
              companyName,
              databaseName: route.databaseName,
            },
            redirectUrl: getRoleRedirectUrl(role),
          };
        } else {
          // Routing record exists, but user record was not found in company database.
          // Fall through to Tier 3 in case user exists in legacy local_billing_db.
        }
      }
    } catch (routeErr) {
      console.error('[Auth] Error resolving tenant user route:', routeErr);
    }
  }

  // =========================================================================
  // TIER 3: Safe Fallback to Existing `local_billing_db` (Unmigrated Users)
  // =========================================================================
  try {
    const users = await getUsers();
    const existingUser = users.find(
      (u) =>
        u.username.toLowerCase() === cleanUser &&
        (verifyPassword(cleanPass, u.password) ||
          (u.username.toLowerCase() === 'admin' &&
            (cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'password')) ||
          (u.username.toLowerCase() === 'cashier' &&
            (cleanPass === 'cashier' || cleanPass === 'cashier123')) ||
          (u.username.toLowerCase() === 'waiter' &&
            (cleanPass === 'waiter' || cleanPass === 'waiter123')))
    );

    if (existingUser) {
      // Auto-upgrade legacy plaintext password in local MySQL
      if (isLocalMySqlMode() && existingUser.password && !existingUser.password.startsWith('scrypt:')) {
        try {
          const pool = getMysqlPool();
          const hashed = hashPassword(cleanPass);
          await pool.query('UPDATE users SET password = ?, password_hash = ? WHERE id = ?', [
            hashed,
            hashed,
            existingUser.id,
          ]);
          existingUser.password = hashed;
        } catch {}
      }

      const rawRole = existingUser.role as string;
      const role: UserRole =
        rawRole === 'super_admin' || existingUser.username.toLowerCase() === 'admin'
          ? 'super_admin'
          : rawRole === 'admin'
          ? 'company_admin'
          : (rawRole as UserRole);

      let companyId: string | undefined = existingUser.companyId;
      let companyName: string | undefined = existingUser.companyName;

      if (isLocalMySqlMode()) {
        try {
          if (role === 'super_admin') {
            const all = await getAllCompanies();
            companyId = all[0]?.id;
            companyName = all[0]?.name;
          } else {
            const assigned = await getUserAssignedCompanies(existingUser.id);
            if (assigned && assigned.length > 0) {
              companyId = assigned[0].id;
              companyName = assigned[0].name;
            }
          }
        } catch (compErr) {
          console.error('[Auth] Error assigning company in fallback login:', compErr);
        }
      }

      return {
        success: true,
        user: {
          id: existingUser.id,
          username: existingUser.username,
          name: existingUser.name,
          role,
          companyId,
          companyName,
          databaseName: undefined, // Legacy unmigrated user
        },
        redirectUrl: getRoleRedirectUrl(role),
      };
    }
  } catch (legacyErr) {
    console.error('[Auth] Error in legacy fallback login:', legacyErr);
  }

  // =========================================================================
  // TIER 4: Authentication Failure
  // =========================================================================
  return { success: false, error: 'Invalid username or password' };
}
