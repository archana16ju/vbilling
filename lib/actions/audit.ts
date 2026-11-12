'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyContext, resolveCompanyPoolAndContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { cookies, headers } from 'next/headers';

export interface AuditLogEntry {
  id?: string;
  companyId?: string | null;
  branchId?: string | null;
  userId?: string | null;
  terminalId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: any;
  ipAddress?: string | null;
}

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'passwordHash',
  'token',
  'secret',
  'creditCard',
  'cardNumber',
  'cvv',
]);

function sanitizeDetails(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitizeDetails);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      clean[k] = '[REDACTED]';
    } else if (v && typeof v === 'object') {
      clean[k] = sanitizeDetails(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Universal Server-Side Audit Logging Function
 * Operates safely across MySQL (local_billing_db) and MongoDB modes.
 */
export async function recordAuditLog(entry: AuditLogEntry): Promise<boolean> {
  try {
    const id = entry.id || `aud_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const sanitized = sanitizeDetails(entry.details);
    const detailsJson = sanitized ? JSON.stringify(sanitized) : null;

    // Resolve IP address safely
    let clientIp = entry.ipAddress || null;
    if (!clientIp) {
      try {
        const headerList = await headers();
        clientIp = headerList.get('x-forwarded-for')?.split(',')[0]?.trim() || headerList.get('x-real-ip') || '127.0.0.1';
      } catch {
        clientIp = '127.0.0.1';
      }
    }

    // Resolve user & company if not supplied
    let authUser = entry.userId || null;
    let authComp = entry.companyId || null;

    if (!authUser || !authComp) {
      try {
        const session = await getSession();
        const cookieStore = await cookies();
        if (!authUser) authUser = session?.username || session?.userId || cookieStore.get('auth_username')?.value || 'system';
        if (!authComp && isLocalMySqlMode()) {
          const comp = await getAuthorizedCompanyContext();
          authComp = comp.id;
        } else if (!authComp) {
          authComp = cookieStore.get('auth_company_id')?.value || null;
        }
      } catch {
        // Fallback to entry values
      }
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const { pool, company } = await resolveCompanyPoolAndContext(authComp || undefined);
      authComp = company.id;

      await pool.query(
        `INSERT INTO audit_logs (
          id, company_id, branch_id, user_id, terminal_id, action, entity_type, entity_id, details, ip_address, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          id,
          authComp,
          entry.branchId || null,
          authUser,
          entry.terminalId || null,
          entry.action,
          entry.entityType,
          entry.entityId || null,
          detailsJson,
          clientIp,
        ]
      );
      return true;
    }

    // Live MongoDB Mode
    try {
      const db = await getDb();
      await db.collection('audit_logs').insertOne({
        id,
        companyId: authComp,
        branchId: entry.branchId || null,
        userId: authUser,
        terminalId: entry.terminalId || null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId || null,
        details: sanitized,
        ipAddress: clientIp,
        createdAt: new Date(),
        timestamp: Date.now(),
      });
      return true;
    } catch (mongoErr: any) {
      console.warn('MongoDB audit logging notice:', mongoErr.message);
      return false;
    }
  } catch (err: any) {
    console.warn('Audit logging exception caught safely (action continued):', err.message);
    return false;
  }
}
