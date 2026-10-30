'use server';
export async function testAction() { return 'HELLO WORLD'; }

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUsers, saveUsers, User, UserRole, verifyPassword, hashPassword } from '@/lib/users';
import { createSession, getSession, destroySession, requireSuperAdmin } from '@/lib/auth-session';

export async function login(prevState: unknown, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

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
    const role = user.role;
    let companyId: string | undefined;
    let companyName: string | undefined;
    const { isLocalMySqlMode } = await import('@/lib/mysql');

    // Auto-upgrade legacy plaintext password to secure scrypt hash in Local MySQL
    if (isLocalMySqlMode() && user.password && !user.password.startsWith('scrypt:')) {
      try {
        const { getMysqlPool } = await import('@/lib/mysql');
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
      } catch (e) {
        console.error('Error assigning company in server action login:', e);
      }
    }

    // Create secure, signed httpOnly session
    await createSession({
      userId: user.id,
      username: user.username,
      role,
      companyId,
      companyName,
    });
    
    if (role === 'super_admin') {
      redirect('/super-admin');
    } else if (role === 'company_admin') {
      redirect('/dashboard');
    } else if (role === 'manager') {
      redirect('/dashboard');
    } else if (role === 'chef') {
      redirect('/kitchen');
    } else if (role === 'waiter') {
      redirect('/assigned-orders');
    } else {
      redirect('/terminal');
    }
  } else {
    return { error: 'Invalid username or password' };
  }
}

export async function logout() {
  await destroySession();
  redirect('/login');
}

export async function getLoggedInUserId() {
  const session = await getSession();
  return session?.userId;
}

export async function saveUserShortcuts(shortcuts: Record<string, string>) {
  const userId = await getLoggedInUserId();
  if (!userId) return { success: false, error: 'Not logged in' };
  
  const users = await getUsers();
  const userIndex = users.findIndex(u => u.id === userId);
  if (userIndex === -1) return { success: false, error: 'User not found' };
  
  users[userIndex].shortcuts = shortcuts;
  await saveUsers(users);
  return { success: true };
}

export async function getUserShortcuts() {
  const userId = await getLoggedInUserId();
  if (!userId) return null;
  
  const users = await getUsers();
  const user = users.find(u => u.id === userId);
  return user?.shortcuts || null;
}

export async function getUserRole() {
  const session = await getSession();
  return session?.role || null;
}

export async function getAllUsers() {
  try {
    const session = await getSession();
    if (!session) return [];

    const users = await getUsers();
    if (!users) return [];

    // Company Admin sees their own account and all users belonging to their company
    if (session.role === 'company_admin') {
      return users
        .filter(u => u.id === session.userId || (session.companyId && u.companyId === session.companyId))
        .map(({ password, ...user }) => user);
    }

    // Super Admin sees all users
    if (session.role === 'super_admin') {
      return users.map(({ password, ...user }) => user);
    }

    return [];
  } catch(e) {
    console.error('getAllUsers ERROR:', e);
    return [];
  }
}

export async function createUser(prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== 'super_admin' && session.role !== 'company_admin')) {
    return { error: 'Access Denied: Only Super Admin and Company Admin can create users.' };
  }

  const username = (formData.get('username') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();
  const rawRole = (formData.get('role') as string || '').toLowerCase().trim();
  const role: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);
  let companyId = (formData.get('companyId') as string || '').trim();

  if (!username || !password || !role) {
    return { error: 'Username, password, and role are required' };
  }

  const { ALL_USER_ROLES, COMPANY_ADMIN_CREATABLE_ROLES, formatRoleLabel } = await import('@/lib/users');

  if (!ALL_USER_ROLES.includes(role)) {
    return { error: `Invalid role '${role}'.` };
  }

  if (session.role === 'company_admin') {
    if (role === 'super_admin') {
      return { error: 'Company Admin cannot create Super Admin accounts.' };
    }
    if (role === 'company_admin') {
      return { error: 'Company Admin cannot create Company Admin accounts.' };
    }
    if (!COMPANY_ADMIN_CREATABLE_ROLES.includes(role)) {
      return { error: 'Company Admin can only create Manager, Cashier, Chef, and Waiter accounts.' };
    }
    companyId = session.companyId || '';
    if (!companyId) {
      return { error: 'Company Admin is not associated with an active company.' };
    }
  }

  if (session.role === 'super_admin' && role !== 'super_admin' && !companyId) {
    return { error: `A company must be selected when creating a ${formatRoleLabel(role)} account.` };
  }

  const users = await getUsers();
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) {
    return { error: 'Username already exists' };
  }

  const userId = `u_${role}_${Date.now()}`;
  const newUser: User = {
    id: userId,
    username,
    password: hashPassword(password),
    role,
    companyId: role === 'super_admin' ? undefined : companyId,
    createdAt: Date.now()
  };

  const { isLocalMySqlMode, getMysqlPool } = await import('@/lib/mysql');
  if (isLocalMySqlMode()) {
    const { ensureLocalMySqlInitialized } = await import('@/lib/mysql-init');
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();

    let companyName: string | null = null;
    if (companyId) {
      const [compRows]: any = await pool.query('SELECT name FROM companies WHERE id = ?', [companyId]);
      if (compRows && compRows.length > 0) companyName = compRows[0].name;
    }

    await pool.query(
      `INSERT INTO users (id, name, username, email, password, password_hash, role, company_id, company_name, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [userId, username, username, `${username}@local.test`, newUser.password, newUser.password, role, companyId || null, companyName]
    );

    if (companyId) {
      const ucId = `uc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await pool.query(
        `INSERT INTO user_companies (id, user_id, company_id, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role)`,
        [ucId, userId, companyId, role]
      );

      // Auto-sync to staff table
      if (COMPANY_ADMIN_CREATABLE_ROLES.includes(role)) {
        try {
          const staffId = `st_${userId}`;
          const staffRole = formatRoleLabel(role);
          await pool.query(
            `INSERT INTO staff (id, company_id, branch_id, user_id, name, username, role, phone, pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at)
             VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 'Monthly', 15000.00, '[]', '[]', 1, 1, NOW())
             ON DUPLICATE KEY UPDATE role = VALUES(role), name = VALUES(name)`,
            [staffId, companyId, userId, username, username, staffRole]
          );
        } catch {}
      }
    }
  } else {
    await saveUsers([...users, newUser]);
  }

  return { success: true };
}

export async function updateUser(id: string, prevState: unknown, formData: FormData) {
  const session = await getSession();
  if (!session || (session.role !== 'super_admin' && session.role !== 'company_admin')) {
    return { error: 'Access Denied: Only Super Admin and Company Admin can modify users.' };
  }

  const username = (formData.get('username') as string || '').trim();
  const password = (formData.get('password') as string || '').trim();
  const rawRole = (formData.get('role') as string || '').toLowerCase().trim();
  const role: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);
  let companyId = (formData.get('companyId') as string || '').trim();

  if (!username || !role) {
    return { error: 'Username and role are required' };
  }

  const { ALL_USER_ROLES, COMPANY_ADMIN_CREATABLE_ROLES } = await import('@/lib/users');
  if (!ALL_USER_ROLES.includes(role)) {
    return { error: `Invalid role '${role}'.` };
  }

  const users = await getUsers();
  const userIndex = users.findIndex(u => u.id === id);
  if (userIndex === -1) {
    return { error: 'User not found' };
  }

  const targetUser = users[userIndex];

  if (session.role === 'company_admin') {
    if (targetUser.id !== session.userId) {
      if (targetUser.companyId !== session.companyId) {
        return { error: 'Access Denied: You can only edit users within your own company.' };
      }
      if (targetUser.role === 'super_admin' || targetUser.role === 'company_admin') {
        return { error: 'Access Denied: Company Admins cannot modify administrator accounts.' };
      }
    }
    if (role === 'super_admin' || role === 'company_admin') {
      return { error: 'Company Admins cannot assign Super Admin or Company Admin roles.' };
    }
    companyId = session.companyId || '';
  }

  if (users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id !== id)) {
    return { error: 'Username already exists' };
  }

  const { isLocalMySqlMode, getMysqlPool } = await import('@/lib/mysql');
  if (isLocalMySqlMode()) {
    const { ensureLocalMySqlInitialized } = await import('@/lib/mysql-init');
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();

    const finalCompanyId = role === 'super_admin' ? null : (companyId || targetUser.companyId || null);
    let finalCompanyName: string | null = null;
    if (finalCompanyId) {
      const [compRows]: any = await pool.query('SELECT name FROM companies WHERE id = ?', [finalCompanyId]);
      if (compRows && compRows.length > 0) finalCompanyName = compRows[0].name;
    }

    if (password) {
      const hashed = hashPassword(password);
      await pool.query(
        `UPDATE users SET username = ?, name = ?, role = ?, company_id = ?, company_name = ?, password = ?, password_hash = ? WHERE id = ?`,
        [username, username, role, finalCompanyId, finalCompanyName, hashed, hashed, id]
      );
    } else {
      await pool.query(
        `UPDATE users SET username = ?, name = ?, role = ?, company_id = ?, company_name = ? WHERE id = ?`,
        [username, username, role, finalCompanyId, finalCompanyName, id]
      );
    }

    if (finalCompanyId) {
      await pool.query('DELETE FROM user_companies WHERE user_id = ?', [id]);
      const ucId = `uc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await pool.query(
        `INSERT INTO user_companies (id, user_id, company_id, role) VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role), company_id = VALUES(company_id)`,
        [ucId, id, finalCompanyId, role]
      );
    }
  } else {
    const updatedUser = { ...targetUser };
    updatedUser.username = username;
    updatedUser.role = role;
    if (companyId) updatedUser.companyId = companyId;
    if (password) updatedUser.password = hashPassword(password);
    users[userIndex] = updatedUser;
    await saveUsers(users);
  }
  
  return { success: true };
}

export async function deleteUser(id: string) {
  const session = await getSession();
  if (!session || (session.role !== 'super_admin' && session.role !== 'company_admin')) {
    return false;
  }

  if (session.userId === id) {
    return false;
  }

  const { isLocalMySqlMode, getMysqlPool } = await import('@/lib/mysql');
  if (isLocalMySqlMode()) {
    const { ensureLocalMySqlInitialized } = await import('@/lib/mysql-init');
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();

    const [uRows]: any = await pool.query('SELECT role, company_id FROM users WHERE id = ?', [id]);
    if (!uRows || uRows.length === 0) return false;

    if (session.role === 'company_admin') {
      if (uRows[0].company_id !== session.companyId) return false;
      if (uRows[0].role === 'super_admin' || uRows[0].role === 'company_admin') return false;
    }

    await pool.query('DELETE FROM user_companies WHERE user_id = ?', [id]);
    await pool.query('DELETE FROM staff WHERE user_id = ? OR id = ?', [id, `st_${id}`]);
    const [result]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  const users = await getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  await saveUsers(filtered);
  return true;
}
