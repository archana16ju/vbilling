import { resolveCompanyPoolAndContext } from './mysql-company';
import { recordAuditLog } from './actions/audit';
import { RowDataPacket } from 'mysql2';
export * from './notification-types';
import { NotificationRule, AppNotification, SUPPORTED_EVENT_TYPES } from './notification-types';

function parseJsonSafe<T>(val: any, fallback: T): T {
  if (!val) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

/**
 * Ensures default notification rules are seeded for a company if none exist.
 */
export async function ensureNotificationTables(pool: any): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_rules (
        id varchar(64) NOT NULL,
        company_id varchar(64) NOT NULL,
        name varchar(255) NOT NULL,
        event_type varchar(64) NOT NULL,
        is_enabled tinyint(1) NOT NULL DEFAULT '1',
        roles json NOT NULL,
        user_ids json DEFAULT NULL,
        priority enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
        channels json NOT NULL,
        quiet_hours_enabled tinyint(1) NOT NULL DEFAULT '0',
        quiet_hours_start time DEFAULT NULL,
        quiet_hours_end time DEFAULT NULL,
        threshold_value decimal(12,2) DEFAULT NULL,
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_nr_company (company_id),
        KEY idx_nr_event (company_id, event_type, is_enabled)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS app_notifications (
        id varchar(64) NOT NULL,
        company_id varchar(64) NOT NULL,
        event_type varchar(64) NOT NULL,
        title varchar(255) NOT NULL,
        message text NOT NULL,
        priority enum('normal','important','urgent') NOT NULL DEFAULT 'normal',
        entity_type varchar(64) DEFAULT NULL,
        entity_id varchar(64) DEFAULT NULL,
        target_roles json DEFAULT NULL,
        target_user_id varchar(64) DEFAULT NULL,
        action_url varchar(255) DEFAULT NULL,
        dedup_key varchar(255) DEFAULT NULL,
        is_read tinyint(1) NOT NULL DEFAULT '0',
        created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_an_company (company_id),
        KEY idx_an_read (company_id, is_read),
        KEY idx_an_dedup (company_id, dedup_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
    `);
  } catch (err) {
    // If tables exist or are created concurrently, safely ignore
  }
}

/**
 * Ensures default notification rules are seeded for a company if none exist.
 */
export async function ensureDefaultNotificationRules(companyId: string): Promise<void> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  await ensureNotificationTables(pool);

  const [existing]: any = await pool.query(
    `SELECT COUNT(*) as count FROM notification_rules WHERE company_id = ?`,
    [company.id]
  );

  if (existing[0]?.count > 0) return;

  for (const ev of SUPPORTED_EVENT_TYPES) {
    const id = `nr_${ev.id}_${company.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
    await pool.query(
      `INSERT INTO notification_rules (
        id, company_id, name, event_type, is_enabled, roles, user_ids, priority,
        channels, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, threshold_value, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 1, ?, NULL, ?, ?, 0, '22:00:00', '07:00:00', ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE company_id = company_id`,
      [
        id,
        company.id,
        ev.name,
        ev.id,
        JSON.stringify(ev.defaultRoles),
        ev.defaultPriority,
        JSON.stringify(['in_app', 'sound']),
        ev.id === 'low_stock' ? 5 : null,
      ]
    );
  }
}

/**
 * Retrieves all notification rules for a company.
 */
export async function getCompanyNotificationRules(companyId: string): Promise<NotificationRule[]> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  await ensureDefaultNotificationRules(company.id);

  const [rows]: any = await pool.query(
    `SELECT * FROM notification_rules WHERE company_id = ? ORDER BY created_at ASC`,
    [company.id]
  );

  return rows.map((r: any) => ({
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    eventType: r.event_type,
    isEnabled: Boolean(r.is_enabled),
    roles: parseJsonSafe(r.roles, []),
    userIds: parseJsonSafe(r.user_ids, []),
    priority: r.priority,
    channels: parseJsonSafe(r.channels, ['in_app']),
    quietHoursEnabled: Boolean(r.quiet_hours_enabled),
    quietHoursStart: r.quiet_hours_start,
    quietHoursEnd: r.quiet_hours_end,
    thresholdValue: r.threshold_value !== null ? Number(r.threshold_value) : null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

/**
 * Saves or updates a notification rule, and records the change in the Audit Log.
 */
export async function saveNotificationRule(
  companyId: string,
  rule: {
    id?: string;
    name: string;
    eventType: string;
    isEnabled?: boolean;
    roles: string[];
    userIds?: string[];
    priority?: 'normal' | 'important' | 'urgent';
    channels: Array<'in_app' | 'sound' | 'email' | 'whatsapp'>;
    quietHoursEnabled?: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    thresholdValue?: number | null;
  },
  authorUsername: string
): Promise<string> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const id = rule.id || `nr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  await pool.query(
    `INSERT INTO notification_rules (
      id, company_id, name, event_type, is_enabled, roles, user_ids, priority,
      channels, quiet_hours_enabled, quiet_hours_start, quiet_hours_end, threshold_value, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON DUPLICATE KEY UPDATE 
      name = VALUES(name),
      event_type = VALUES(event_type),
      is_enabled = VALUES(is_enabled),
      roles = VALUES(roles),
      user_ids = VALUES(user_ids),
      priority = VALUES(priority),
      channels = VALUES(channels),
      quiet_hours_enabled = VALUES(quiet_hours_enabled),
      quiet_hours_start = VALUES(quiet_hours_start),
      quiet_hours_end = VALUES(quiet_hours_end),
      threshold_value = VALUES(threshold_value),
      updated_at = NOW()`,
    [
      id,
      company.id,
      rule.name.trim(),
      rule.eventType,
      rule.isEnabled !== undefined ? (rule.isEnabled ? 1 : 0) : 1,
      JSON.stringify(rule.roles || []),
      rule.userIds ? JSON.stringify(rule.userIds) : null,
      rule.priority || 'normal',
      JSON.stringify(rule.channels || ['in_app']),
      rule.quietHoursEnabled ? 1 : 0,
      rule.quietHoursStart || null,
      rule.quietHoursEnd || null,
      rule.thresholdValue !== undefined ? rule.thresholdValue : null,
    ]
  );

  // Universal Audit Log
  await recordAuditLog({
    companyId: company.id,
    userId: authorUsername,
    action: rule.id ? 'NOTIFICATION_RULE_UPDATED' : 'NOTIFICATION_RULE_CREATED',
    entityType: 'NOTIFICATION_RULE',
    entityId: id,
    details: {
      ruleId: id,
      name: rule.name,
      eventType: rule.eventType,
      isEnabled: rule.isEnabled,
      roles: rule.roles,
      channels: rule.channels,
      quietHoursEnabled: rule.quietHoursEnabled,
      thresholdValue: rule.thresholdValue,
      savedBy: authorUsername,
    },
  });

  return id;
}

/**
 * Deletes a notification rule and logs to audit.
 */
export async function deleteNotificationRule(
  companyId: string,
  ruleId: string,
  authorUsername: string
): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const [result]: any = await pool.query(
    `DELETE FROM notification_rules WHERE id = ? AND company_id = ?`,
    [ruleId, company.id]
  );

  await recordAuditLog({
    companyId: company.id,
    userId: authorUsername,
    action: 'NOTIFICATION_RULE_DELETED',
    entityType: 'NOTIFICATION_RULE',
    entityId: ruleId,
    details: {
      ruleId,
      deletedBy: authorUsername,
    },
  });

  return result.affectedRows > 0;
}

/**
 * Checks whether current local time falls within configured quiet hours.
 */
function isWithinQuietHours(startStr?: string | null, endStr?: string | null): boolean {
  if (!startStr || !endStr) return false;
  try {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    const [sh, sm] = startStr.split(':').map(Number);
    const [eh, em] = endStr.split(':').map(Number);

    const startMins = sh * 60 + (sm || 0);
    const endMins = eh * 60 + (em || 0);

    if (startMins <= endMins) {
      return currentMins >= startMins && currentMins <= endMins;
    } else {
      // Overnight span (e.g. 22:00 to 07:00)
      return currentMins >= startMins || currentMins <= endMins;
    }
  } catch {
    return false;
  }
}

/**
 * Triggers a smart notification based on configured company rules.
 * Handles quiet hours, dedup keys to prevent duplicate spam, and recipient targeting.
 */
export async function triggerSmartNotification(
  companyId: string,
  event: {
    eventType: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    currentValue?: number;
    actionUrl?: string;
    dedupKey?: string;
  }
): Promise<{ triggered: boolean; notificationId?: string; soundMuted?: boolean }> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  await ensureNotificationTables(pool);

  // Look up enabled rule for this event type
  const [rules]: any = await pool.query(
    `SELECT * FROM notification_rules WHERE company_id = ? AND event_type = ? AND is_enabled = 1 LIMIT 1`,
    [company.id, event.eventType]
  );

  if (!rules || rules.length === 0) {
    return { triggered: false };
  }

  const rule = rules[0];

  // Check threshold if configured (e.g. for low stock)
  if (rule.threshold_value !== null && event.currentValue !== undefined) {
    if (event.currentValue > Number(rule.threshold_value)) {
      return { triggered: false }; // Threshold not breached
    }
  }

  // Deduplication check: prevent repeated notification for same unread item
  const dedup = event.dedupKey || `${event.eventType}_${event.entityId || 'none'}`;
  const [existingUnread]: any = await pool.query(
    `SELECT id FROM app_notifications WHERE company_id = ? AND dedup_key = ? AND is_read = 0 LIMIT 1`,
    [company.id, dedup]
  );

  if (existingUnread && existingUnread.length > 0) {
    return { triggered: false, notificationId: existingUnread[0].id };
  }

  const channels: string[] = parseJsonSafe(rule.channels, ['in_app']);
  const inQuietHours = rule.quiet_hours_enabled ? isWithinQuietHours(rule.quiet_hours_start, rule.quiet_hours_end) : false;
  const soundEnabled = channels.includes('sound') && !inQuietHours;

  const rolesJson = typeof rule.roles === 'string' ? rule.roles : JSON.stringify(rule.roles || []);

  const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  await pool.query(
    `INSERT INTO app_notifications (
      id, company_id, event_type, title, message, priority, entity_type, entity_id,
      target_roles, action_url, dedup_key, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NOW())`,
    [
      id,
      company.id,
      event.eventType,
      event.title,
      event.message,
      rule.priority || 'normal',
      event.entityType || null,
      event.entityId || null,
      rolesJson, // Guaranteed JSON string to prevent mysql2 array placeholder expansion
      event.actionUrl || null,
      dedup,
    ]
  );

  return { triggered: true, notificationId: id, soundMuted: inQuietHours };
}

/**
 * Retrieves notifications for the currently logged-in user in their company.
 */
export async function getUserNotifications(
  companyId: string,
  userRole: string,
  userId?: string
): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const [rows]: any = await pool.query(
    `SELECT * FROM app_notifications WHERE company_id = ? ORDER BY created_at DESC LIMIT 50`,
    [company.id]
  );

  const normalizedRole = (userRole === 'admin' ? 'company_admin' : userRole).toLowerCase();
  const visible: AppNotification[] = [];

  for (const r of rows) {
    const roles: string[] = parseJsonSafe(r.target_roles, []);
    const targetUid = r.target_user_id;

    // Super Admin sees all company notifications
    const isSuperAdmin = normalizedRole === 'super_admin';
    const matchesRole = roles.length === 0 || roles.map((x) => x.toLowerCase()).includes(normalizedRole);
    const matchesUser = !targetUid || targetUid === userId;

    if (isSuperAdmin || (matchesRole && matchesUser)) {
      visible.push({
        id: r.id,
        companyId: r.company_id,
        eventType: r.event_type,
        title: r.title,
        message: r.message,
        priority: r.priority,
        entityType: r.entity_type,
        entityId: r.entity_id,
        targetRoles: roles,
        targetUserId: r.target_user_id,
        actionUrl: r.action_url,
        dedupKey: r.dedup_key,
        isRead: Boolean(r.is_read),
        createdAt: r.created_at,
      });
    }
  }

  const unreadCount = visible.filter((n) => !n.isRead).length;
  return { notifications: visible, unreadCount };
}

/**
 * Marks a notification as read.
 */
export async function markNotificationAsRead(companyId: string, notificationId: string): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  await pool.query(
    `UPDATE app_notifications SET is_read = 1 WHERE id = ? AND company_id = ?`,
    [notificationId, company.id]
  );
  return true;
}

/**
 * Marks all notifications as read for this company and user role.
 */
export async function markAllNotificationsAsRead(companyId: string, userRole: string): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const normalizedRole = userRole.toLowerCase();

  await pool.query(
    `UPDATE app_notifications 
     SET is_read = 1 
     WHERE company_id = ? AND (target_roles IS NULL OR JSON_CONTAINS(LOWER(target_roles), ?))`,
    [company.id, JSON.stringify(normalizedRole)]
  );
  return true;
}
