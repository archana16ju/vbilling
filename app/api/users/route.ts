import { NextResponse } from 'next/server';
import { getUsers, saveUsers, User, UserRole, hashPassword, ALL_USER_ROLES, COMPANY_ADMIN_CREATABLE_ROLES, formatRoleLabel } from '@/lib/users';
import { getSession } from '@/lib/auth-session';
import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const users = await getUsers();

    // 1. Super Admin: Can view all users across all companies
    if (session.role === 'super_admin') {
      return NextResponse.json(users.map(({ password, ...user }) => user));
    }

    // 2. Company Admin: Can view their own account and all users belonging to their own company
    if (session.role === 'company_admin') {
      const companyUsers = users.filter(
        (u) => u.id === session.userId || (session.companyId && u.companyId === session.companyId)
      );
      return NextResponse.json(companyUsers.map(({ password, ...user }) => user));
    }

    // Other roles are not permitted to query users collection
    return NextResponse.json({ error: 'Access denied: User management is restricted to Super Admin and Company Admin.' }, { status: 403 });
  } catch (e: any) {
    console.error('GET /api/users error:', e);
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Only Super Admin and Company Admin can create users
    if (session.role !== 'super_admin' && session.role !== 'company_admin') {
      return NextResponse.json(
        { error: 'Access Denied: Only Super Admin and Company Admin can create user accounts.' },
        { status: 403 }
      );
    }

    const data = await request.json();
    const rawRole = (data.role || '').toString().toLowerCase().trim();
    const role: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);

    if (!ALL_USER_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role '${data.role}'. Supported roles: Super Admin, Company Admin, Manager, Cashier, Chef, Waiter.` },
        { status: 400 }
      );
    }

    if (!data.username || !data.username.trim() || !data.password || !data.password.trim()) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 });
    }

    const cleanUsername = data.username.trim();
    const cleanPassword = data.password.trim();

    let targetCompanyId: string | undefined = undefined;
    let targetCompanyName: string | undefined = undefined;

    // Rules for Company Admin:
    // - Can only create: Manager, Cashier, Chef, Waiter
    // - Must not create Super Admin
    // - Must not create Company Admin
    // - Can only create users within their own company
    if (session.role === 'company_admin') {
      if (role === 'super_admin') {
        return NextResponse.json(
          { error: 'Access Denied: Company Admin accounts cannot create Super Admin accounts.' },
          { status: 403 }
        );
      }
      if (role === 'company_admin') {
        return NextResponse.json(
          { error: 'Access Denied: Company Admin accounts cannot create Company Admin accounts. Only Super Admin can manage Company Admins.' },
          { status: 403 }
        );
      }

      if (!COMPANY_ADMIN_CREATABLE_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `Access Denied: Company Admins can only create Manager, Cashier, Chef, and Waiter accounts.` },
          { status: 403 }
        );
      }

      if (!session.companyId) {
        return NextResponse.json(
          { error: 'Your Company Admin account is not associated with an active company.' },
          { status: 400 }
        );
      }

      if (data.companyId && data.companyId !== session.companyId) {
        return NextResponse.json(
          { error: 'Unauthorized: You cannot create user accounts belonging to another company.' },
          { status: 403 }
        );
      }

      targetCompanyId = session.companyId;
      targetCompanyName = session.companyName;
    }

    // Rules for Super Admin:
    // - Can create: Super Admin, Company Admin, Manager, Cashier, Chef, Waiter
    // - For company-specific roles (Company Admin, Manager, Cashier, Chef, Waiter), companyId is required!
    if (session.role === 'super_admin') {
      if (role !== 'super_admin') {
        if (!data.companyId) {
          return NextResponse.json(
            { error: `A target company must be selected when creating a ${formatRoleLabel(role)} account.` },
            { status: 400 }
          );
        }
        targetCompanyId = data.companyId;
      }
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();

      // Verify target company exists if provided
      if (targetCompanyId) {
        const [compRows] = await pool.query<RowDataPacket[]>(
          'SELECT id, name FROM companies WHERE id = ? AND is_active = 1',
          [targetCompanyId]
        );
        if (!compRows || compRows.length === 0) {
          return NextResponse.json({ error: 'The selected company does not exist or is inactive.' }, { status: 400 });
        }
        targetCompanyName = compRows[0].name;
      }

      // Check username uniqueness
      const [existingUsers] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?)',
        [cleanUsername]
      );
      if (existingUsers && existingUsers.length > 0) {
        return NextResponse.json({ error: `Username '${cleanUsername}' already exists. Please choose a different username.` }, { status: 400 });
      }

      const userId = `u_${role}_${Date.now()}`;
      const hashedPassword = hashPassword(cleanPassword);

      // Insert into users table
      await pool.query(
        `INSERT INTO users (id, name, username, email, password, password_hash, role, company_id, company_name, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          userId,
          cleanUsername,
          cleanUsername,
          `${cleanUsername}@local.test`,
          hashedPassword,
          hashedPassword,
          role,
          targetCompanyId || null,
          targetCompanyName || null,
        ]
      );

      // Insert into user_companies if company is assigned
      if (targetCompanyId) {
        const ucId = `uc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        await pool.query(
          `INSERT INTO user_companies (id, user_id, company_id, role)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE role = VALUES(role)`,
          [ucId, userId, targetCompanyId, role]
        );
      }

      // If role is Manager, Cashier, Chef, or Waiter, auto-sync to staff table
      if (COMPANY_ADMIN_CREATABLE_ROLES.includes(role) && targetCompanyId) {
        try {
          const staffId = `st_${userId}`;
          const staffRole = formatRoleLabel(role);
          await pool.query(
            `INSERT INTO staff (
              id, company_id, branch_id, user_id, name, username, role, phone,
              pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 'Monthly', 15000.00, '[]', '[]', 1, 1, NOW())
            ON DUPLICATE KEY UPDATE role = VALUES(role), name = VALUES(name)`,
            [staffId, targetCompanyId, userId, cleanUsername, cleanUsername, staffRole]
          );
        } catch (staffSyncErr) {
          console.error('Auto-sync staff error on user creation:', staffSyncErr);
        }
      }

      return NextResponse.json({
        success: true,
        user: {
          id: userId,
          username: cleanUsername,
          role,
          companyId: targetCompanyId,
          companyName: targetCompanyName,
        },
      });
    }

    // Fallback JSON mode
    const users = await getUsers();
    if (users.find((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
    }

    const userId = 'u' + Date.now();
    const newUser: User = {
      id: userId,
      username: cleanUsername,
      password: hashPassword(cleanPassword),
      role,
      companyId: targetCompanyId,
      companyName: targetCompanyName,
      createdAt: Date.now(),
    };

    users.push(newUser);
    await saveUsers(users);

    return NextResponse.json({
      success: true,
      user: { id: userId, username: newUser.username, role: newUser.role, companyId: targetCompanyId },
    });
  } catch (e: any) {
    console.error('POST /api/users error:', e);
    return NextResponse.json({ error: e.message || 'Failed to create user' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Only Super Admin and Company Admin can modify users
    if (session.role !== 'super_admin' && session.role !== 'company_admin') {
      return NextResponse.json({ error: 'Access Denied: Only Super Admin and Company Admin can modify users.' }, { status: 403 });
    }

    const data = await request.json();
    const targetId = data.id;
    if (!targetId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 });
    }

    const isLocal = isLocalMySqlMode();
    if (!isLocal) {
      return NextResponse.json({ error: 'Local MySQL mode required.' }, { status: 500 });
    }

    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();

    // Fetch existing target user
    const [existingRows] = await pool.query<RowDataPacket[]>(
      'SELECT id, username, role, company_id FROM users WHERE id = ?',
      [targetId]
    );

    if (!existingRows || existingRows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const targetUser = existingRows[0];

    // Company Admin restrictions
    if (session.role === 'company_admin') {
      const isSelf = targetId === session.userId;

      if (!isSelf) {
        // Must belong to their own company
        if (targetUser.company_id !== session.companyId) {
          return NextResponse.json(
            { error: 'Access Denied: You can only modify users within your own company.' },
            { status: 403 }
          );
        }

        // Cannot modify a super_admin or another company_admin
        if (targetUser.role === 'super_admin' || targetUser.role === 'company_admin') {
          return NextResponse.json(
            { error: 'Access Denied: Company Admins cannot modify administrator accounts.' },
            { status: 403 }
          );
        }
      }

      // If role change is requested, Company Admin can only assign Manager, Cashier, Chef, Waiter
      if (data.role) {
        const rawRole = (data.role || '').toString().toLowerCase().trim();
        const newRole: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);

        if (newRole === 'super_admin' || newRole === 'company_admin') {
          return NextResponse.json(
            { error: 'Access Denied: Company Admins cannot assign Super Admin or Company Admin roles.' },
            { status: 403 }
          );
        }

        if (!COMPANY_ADMIN_CREATABLE_ROLES.includes(newRole)) {
          return NextResponse.json(
            { error: 'Access Denied: Permitted roles are Manager, Cashier, Chef, and Waiter.' },
            { status: 403 }
          );
        }
      }

      // Company Admin cannot change company_id
      if (data.companyId && data.companyId !== session.companyId) {
        return NextResponse.json(
          { error: 'Unauthorized: You cannot reassign users to another company.' },
          { status: 403 }
        );
      }
    }

    // Super Admin role validation
    let newRole: UserRole | undefined = undefined;
    if (data.role) {
      const rawRole = (data.role || '').toString().toLowerCase().trim();
      newRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);
      if (!ALL_USER_ROLES.includes(newRole)) {
        return NextResponse.json(
          { error: `Invalid role '${data.role}'. Supported roles: Super Admin, Company Admin, Manager, Cashier, Chef, Waiter.` },
          { status: 400 }
        );
      }
    }

    // Username uniqueness validation if changed
    const cleanUsername = data.username ? data.username.trim() : undefined;
    if (cleanUsername && cleanUsername.toLowerCase() !== targetUser.username.toLowerCase()) {
      const [duplicate] = await pool.query<RowDataPacket[]>(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?',
        [cleanUsername, targetId]
      );
      if (duplicate && duplicate.length > 0) {
        return NextResponse.json({ error: `Username '${cleanUsername}' already exists.` }, { status: 400 });
      }
    }

    // Determine updated values
    const finalUsername = cleanUsername || targetUser.username;
    const finalRole = newRole || targetUser.role;

    let finalCompanyId = targetUser.company_id;
    let finalCompanyName: string | null = null;

    if (session.role === 'super_admin') {
      if (finalRole === 'super_admin') {
        finalCompanyId = null;
      } else if (data.companyId) {
        finalCompanyId = data.companyId;
      }
    }

    if (finalCompanyId) {
      const [cRows] = await pool.query<RowDataPacket[]>(
        'SELECT name FROM companies WHERE id = ?',
        [finalCompanyId]
      );
      if (cRows && cRows.length > 0) {
        finalCompanyName = cRows[0].name;
      }
    }

    // Password hashing if provided
    let newHashedPassword: string | undefined = undefined;
    if (data.password && data.password.trim() !== '') {
      newHashedPassword = hashPassword(data.password.trim());
    }

    // Update users table
    if (newHashedPassword) {
      await pool.query(
        `UPDATE users 
         SET username = ?, name = ?, role = ?, company_id = ?, company_name = ?, password = ?, password_hash = ?
         WHERE id = ?`,
        [finalUsername, finalUsername, finalRole, finalCompanyId, finalCompanyName, newHashedPassword, newHashedPassword, targetId]
      );
    } else {
      await pool.query(
        `UPDATE users 
         SET username = ?, name = ?, role = ?, company_id = ?, company_name = ?
         WHERE id = ?`,
        [finalUsername, finalUsername, finalRole, finalCompanyId, finalCompanyName, targetId]
      );
    }

    // Update user_companies
    if (finalCompanyId) {
      await pool.query('DELETE FROM user_companies WHERE user_id = ?', [targetId]);
      const ucId = `uc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await pool.query(
        `INSERT INTO user_companies (id, user_id, company_id, role)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE role = VALUES(role), company_id = VALUES(company_id)`,
        [ucId, targetId, finalCompanyId, finalRole]
      );
    } else {
      await pool.query('DELETE FROM user_companies WHERE user_id = ?', [targetId]);
    }

    // Update staff table if this user exists in staff
    if (COMPANY_ADMIN_CREATABLE_ROLES.includes(finalRole) && finalCompanyId) {
      try {
        const staffRole = formatRoleLabel(finalRole);
        await pool.query(
          `UPDATE staff 
           SET role = ?, name = ?, username = ?
           WHERE user_id = ? OR id = ?`,
          [staffRole, finalUsername, finalUsername, targetId, `st_${targetId}`]
        );
      } catch (staffErr) {
        console.error('Update staff sync error:', staffErr);
      }
    }

    return NextResponse.json({ success: true, message: 'User updated successfully.' });
  } catch (e: any) {
    console.error('PUT /api/users error:', e);
    return NextResponse.json({ error: e.message || 'Failed to update user' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    // Only Super Admin and Company Admin can delete users
    if (session.role !== 'super_admin' && session.role !== 'company_admin') {
      return NextResponse.json({ error: 'Access Denied: Only Super Admin and Company Admin can delete users.' }, { status: 403 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'User ID is required' }, { status: 400 });

    if (id === session.userId) {
      return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 });
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();

      // Check target user
      const [uRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, username, role, company_id FROM users WHERE id = ?',
        [id]
      );

      if (!uRows || uRows.length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      const targetUser = uRows[0];

      // Company Admin restrictions
      if (session.role === 'company_admin') {
        if (targetUser.company_id !== session.companyId) {
          return NextResponse.json(
            { error: 'Access Denied: You can only delete users within your own company.' },
            { status: 403 }
          );
        }

        if (targetUser.role === 'super_admin' || targetUser.role === 'company_admin') {
          return NextResponse.json(
            { error: 'Access Denied: Company Admins cannot delete Administrator accounts.' },
            { status: 403 }
          );
        }
      }

      await pool.query('DELETE FROM user_companies WHERE user_id = ?', [id]);
      const [res]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);
      if (res.affectedRows === 0) return NextResponse.json({ error: 'User not found' }, { status: 404 });

      // Clean up linked staff record if applicable
      try {
        await pool.query('DELETE FROM staff WHERE user_id = ? OR id = ?', [id, `st_${id}`]);
      } catch {}

      return NextResponse.json({ success: true, message: `User '${targetUser.username}' deleted successfully.` });
    }

    const users = await getUsers();
    const filtered = users.filter((u) => u.id !== id);
    if (filtered.length === users.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await saveUsers(filtered);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('DELETE /api/users error:', e);
    return NextResponse.json({ error: e.message || 'Failed to delete user' }, { status: 403 });
  }
}
