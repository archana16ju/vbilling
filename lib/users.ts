import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'
import { isLocalMySqlMode, getMysqlPool } from './mysql'
import { ensureLocalMySqlInitialized } from './mysql-init'

export type UserRole =
  | 'super_admin'
  | 'company_admin'
  | 'manager'
  | 'cashier'
  | 'chef'
  | 'waiter';

export const ALL_USER_ROLES: UserRole[] = [
  'super_admin',
  'company_admin',
  'manager',
  'cashier',
  'chef',
  'waiter',
];

export const COMPANY_ADMIN_CREATABLE_ROLES: UserRole[] = [
  'manager',
  'cashier',
  'chef',
  'waiter',
];

export function formatRoleLabel(role: string): string {
  switch (role) {
    case 'super_admin':
      return 'Super Admin';
    case 'company_admin':
    case 'admin':
      return 'Company Admin';
    case 'manager':
      return 'Manager';
    case 'cashier':
      return 'Cashier';
    case 'chef':
      return 'Chef';
    case 'waiter':
      return 'Waiter';
    default:
      return (role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export interface User {
  id: string;
  username: string;
  password?: string;
  role: UserRole;
  createdAt: number;
  companyId?: string;
  companyName?: string;
  shortcuts?: Record<string, string>;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHashOrPlain?: string): boolean {
  if (!storedHashOrPlain) return false;
  if (storedHashOrPlain.startsWith('scrypt:')) {
    const parts = storedHashOrPlain.split(':');
    if (parts.length !== 3) return false;
    const [, salt, originalHash] = parts;
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    try {
      return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(originalHash, 'hex'));
    } catch {
      return false;
    }
  }
  return password === storedHashOrPlain;
}

function getDataFilePath() {
  // Use the user's home directory so the file is ALWAYS writable and persists across app updates
  try {
    const dataDir = path.join(os.homedir(), '.billing-software')
    return path.join(dataDir, 'users.json')
  } catch (err) {
    return path.join(os.tmpdir(), 'billing-software-users.json')
  }
}

const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'admin', role: 'super_admin', createdAt: Date.now() },
  { id: 'u2', username: 'cashier', password: 'cashier123', role: 'cashier', createdAt: Date.now() },
  { id: 'u3', username: 'waiter', password: 'waiter123', role: 'waiter', createdAt: Date.now() }
]

async function ensureDataFile(filePath: string) {
  try {
    await fs.access(filePath)
  } catch (e) {
    // If it doesn't exist, create it
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(DEFAULT_USERS, null, 2))
    } catch (writeErr) {
      console.error('Failed to write to primary path, using tmpdir:', writeErr)
      const fallbackPath = path.join(os.tmpdir(), 'billing-software-users.json')
      try {
        await fs.access(fallbackPath)
      } catch (fallbackAccessErr) {
        await fs.writeFile(fallbackPath, JSON.stringify(DEFAULT_USERS, null, 2))
      }
      return fallbackPath
    }
  }
  return filePath
}

export async function getUsers(): Promise<User[]> {
  if (isLocalMySqlMode()) {
    try {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const [rows]: any = await pool.query(
        `SELECT u.id, u.name, u.username, u.password, u.role, u.company_id, u.shortcuts, u.created_at,
                c.name AS company_name
         FROM users u
         LEFT JOIN companies c ON u.company_id = c.id
         WHERE u.is_active = 1`
      );

      if (!rows || rows.length === 0) {
        return DEFAULT_USERS;
      }

      return rows.map((r: any) => {
        const rawRole = (r.role || 'cashier') as string;
        const normalizedRole: UserRole = rawRole === 'admin' ? 'company_admin' : (rawRole as UserRole);
        return {
          id: r.id,
          username: r.username || r.name,
          password: r.password,
          role: normalizedRole,
          companyId: r.company_id || undefined,
          companyName: r.company_name || undefined,
          createdAt: r.created_at ? new Date(r.created_at).getTime() : Date.now(),
          shortcuts: r.shortcuts ? (typeof r.shortcuts === 'string' ? JSON.parse(r.shortcuts) : r.shortcuts) : undefined,
        };
      });
    } catch (err: any) {
      console.error('MySQL getUsers error:', err.message);
      throw new Error(`Failed to fetch users from Local MySQL: ${err.message}`);
    }
  }

  const targetPath = getDataFilePath()
  const filePath = await ensureDataFile(targetPath)
  
  try {
    const data = await fs.readFile(filePath, 'utf8')
    if (!data || data.trim() === '') {
      return DEFAULT_USERS
    }
    const parsed = JSON.parse(data);
    return parsed.map((u: any) => ({
      ...u,
      role: u.role === 'admin' ? 'company_admin' : u.role,
    }));
  } catch (err) {
    console.error('Failed to read or parse users.json, falling back to defaults:', err)
    return DEFAULT_USERS
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  if (isLocalMySqlMode()) {
    try {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      for (const u of users) {
        await pool.query(
          `INSERT INTO users (id, name, username, password, role, company_id, is_active, shortcuts)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?)
           ON DUPLICATE KEY UPDATE 
             name = VALUES(name),
             username = VALUES(username),
             password = VALUES(password),
             role = VALUES(role),
             company_id = VALUES(company_id),
             shortcuts = VALUES(shortcuts)`,
          [
            u.id,
            u.username,
            u.username,
            u.password || '',
            u.role,
            u.companyId || null,
            u.shortcuts ? JSON.stringify(u.shortcuts) : null,
          ]
        );
      }
      return;
    } catch (err: any) {
      console.error('MySQL saveUsers error:', err.message);
      throw new Error(`Failed to save users to Local MySQL: ${err.message}`);
    }
  }

  const targetPath = getDataFilePath()
  const filePath = await ensureDataFile(targetPath)
  await fs.writeFile(filePath, JSON.stringify(users, null, 2))
}
