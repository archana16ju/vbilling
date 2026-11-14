import { resolveCompanyPoolAndContext } from './mysql-company';
import { recordAuditLog } from './actions/audit';
import { RowDataPacket, ResultSetHeader } from 'mysql2';

export interface AnnouncementItem {
  id: string;
  companyId: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  priority: 'normal' | 'important' | 'urgent';
  targetAudienceType: 'everyone' | 'roles' | 'individuals';
  targetRoles?: string[];
  targetUserIds?: string[];
  publishAt: string;
  expiresAt?: string | null;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
  readAt?: string | null;
  readsCount?: number;
  readers?: Array<{
    userId: string;
    userName: string;
    role: string;
    readAt: string;
  }>;
}

/**
 * Normalizes JSON column values that may be string or object.
 */
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
 * Retrieves visible announcements for an employee in the current company context.
 * Filters by publication date, expiry date, active status, and target audience.
 */
export async function getEmployeeAnnouncements(
  companyId: string,
  userId: string,
  userRole: string
): Promise<{ announcements: AnnouncementItem[]; unreadCount: number }> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const [rows]: any = await pool.query(
    `SELECT a.*, r.read_at as user_read_at
     FROM announcements a
     LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = ?
     WHERE a.company_id = ? 
       AND a.is_active = 1 
       AND a.publish_at <= NOW()
       AND (a.expires_at IS NULL OR a.expires_at >= NOW())
     ORDER BY 
       CASE a.priority 
         WHEN 'urgent' THEN 1 
         WHEN 'important' THEN 2 
         ELSE 3 
       END ASC,
       a.publish_at DESC`,
    [userId, company.id]
  );

  const normalizedRole = userRole.toLowerCase().trim();
  const visible: AnnouncementItem[] = [];

  for (const r of rows) {
    const audType = r.target_audience_type;
    const targetRoles: string[] = parseJsonSafe(r.target_roles, []);
    const targetUserIds: string[] = parseJsonSafe(r.target_user_ids, []);

    let isTargeted = false;
    if (audType === 'everyone') {
      isTargeted = true;
    } else if (audType === 'roles') {
      isTargeted = targetRoles.map((ro) => ro.toLowerCase()).includes(normalizedRole);
    } else if (audType === 'individuals') {
      isTargeted = targetUserIds.includes(userId);
    }

    if (isTargeted) {
      visible.push({
        id: r.id,
        companyId: r.company_id,
        title: r.title,
        description: r.description,
        imageUrl: r.image_url,
        priority: r.priority,
        targetAudienceType: r.target_audience_type,
        targetRoles,
        targetUserIds,
        publishAt: r.publish_at,
        expiresAt: r.expires_at,
        isActive: Boolean(r.is_active),
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        isRead: Boolean(r.user_read_at),
        readAt: r.user_read_at,
      });
    }
  }

  const unreadCount = visible.filter((a) => !a.isRead).length;
  return { announcements: visible, unreadCount };
}

/**
 * Retrieves all announcements for administrators, including full read metrics and employee logs.
 */
export async function getAdminAnnouncements(companyId: string): Promise<AnnouncementItem[]> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const [annRows]: any = await pool.query(
    `SELECT * FROM announcements WHERE company_id = ? ORDER BY created_at DESC`,
    [company.id]
  );

  const [readsRows]: any = await pool.query(
    `SELECT ar.announcement_id, ar.user_id, ar.read_at, u.name as user_name, u.role as user_role, u.username
     FROM announcement_reads ar
     LEFT JOIN users u ON u.id = ar.user_id AND u.company_id = ar.company_id
     WHERE ar.company_id = ?
     ORDER BY ar.read_at DESC`,
    [company.id]
  );

  const readsByAnnId = new Map<string, any[]>();
  for (const r of readsRows) {
    const list = readsByAnnId.get(r.announcement_id) || [];
    list.push({
      userId: r.user_id,
      userName: r.user_name || r.username || r.user_id,
      role: r.user_role || 'Staff',
      readAt: r.read_at,
    });
    readsByAnnId.set(r.announcement_id, list);
  }

  return annRows.map((r: any) => {
    const readers = readsByAnnId.get(r.id) || [];
    return {
      id: r.id,
      companyId: r.company_id,
      title: r.title,
      description: r.description,
      imageUrl: r.image_url,
      priority: r.priority,
      targetAudienceType: r.target_audience_type,
      targetRoles: parseJsonSafe(r.target_roles, []),
      targetUserIds: parseJsonSafe(r.target_user_ids, []),
      publishAt: r.publish_at,
      expiresAt: r.expires_at,
      isActive: Boolean(r.is_active),
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      readsCount: readers.length,
      readers,
    };
  });
}

/**
 * Creates an announcement and logs the administrative action in the Audit Log.
 */
export async function createAnnouncement(
  companyId: string,
  data: {
    title: string;
    description: string;
    imageUrl?: string | null;
    priority?: 'normal' | 'important' | 'urgent';
    targetAudienceType?: 'everyone' | 'roles' | 'individuals';
    targetRoles?: string[];
    targetUserIds?: string[];
    publishAt?: string;
    expiresAt?: string | null;
    isActive?: boolean;
  },
  authorUsername: string
): Promise<string> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);
  const id = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const publishDate = data.publishAt ? new Date(data.publishAt) : new Date();
  const expiresDate = data.expiresAt ? new Date(data.expiresAt) : null;

  await pool.query(
    `INSERT INTO announcements (
      id, company_id, title, description, image_url, priority,
      target_audience_type, target_roles, target_user_ids,
      publish_at, expires_at, is_active, created_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [
      id,
      company.id,
      data.title.trim(),
      data.description.trim(),
      data.imageUrl || null,
      data.priority || 'normal',
      data.targetAudienceType || 'everyone',
      data.targetRoles ? JSON.stringify(data.targetRoles) : null,
      data.targetUserIds ? JSON.stringify(data.targetUserIds) : null,
      publishDate,
      expiresDate,
      data.isActive !== undefined ? (data.isActive ? 1 : 0) : 1,
      authorUsername,
    ]
  );

  // Universal Audit Log
  await recordAuditLog({
    companyId: company.id,
    userId: authorUsername,
    action: 'ANNOUNCEMENT_CREATED',
    entityType: 'ANNOUNCEMENT',
    entityId: id,
    details: {
      id,
      title: data.title,
      priority: data.priority || 'normal',
      targetAudienceType: data.targetAudienceType || 'everyone',
      publishAt: publishDate.toISOString(),
      expiresAt: expiresDate?.toISOString() || null,
      createdBy: authorUsername,
    },
  });

  return id;
}

/**
 * Updates an existing announcement and audits changes.
 */
export async function updateAnnouncement(
  companyId: string,
  id: string,
  data: Partial<AnnouncementItem>,
  authorUsername: string
): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const [existing]: any = await pool.query(
    `SELECT * FROM announcements WHERE id = ? AND company_id = ? LIMIT 1`,
    [id, company.id]
  );

  if (!existing || existing.length === 0) return false;
  const prev = existing[0];

  const clauses: string[] = ['updated_at = NOW()'];
  const params: any[] = [];

  if (data.title !== undefined) {
    clauses.push('title = ?');
    params.push(data.title.trim());
  }
  if (data.description !== undefined) {
    clauses.push('description = ?');
    params.push(data.description.trim());
  }
  if (data.imageUrl !== undefined) {
    clauses.push('image_url = ?');
    params.push(data.imageUrl || null);
  }
  if (data.priority !== undefined) {
    clauses.push('priority = ?');
    params.push(data.priority);
  }
  if (data.targetAudienceType !== undefined) {
    clauses.push('target_audience_type = ?');
    params.push(data.targetAudienceType);
  }
  if (data.targetRoles !== undefined) {
    clauses.push('target_roles = ?');
    params.push(JSON.stringify(data.targetRoles));
  }
  if (data.targetUserIds !== undefined) {
    clauses.push('target_user_ids = ?');
    params.push(JSON.stringify(data.targetUserIds));
  }
  if (data.publishAt !== undefined) {
    clauses.push('publish_at = ?');
    params.push(new Date(data.publishAt));
  }
  if (data.expiresAt !== undefined) {
    clauses.push('expires_at = ?');
    params.push(data.expiresAt ? new Date(data.expiresAt) : null);
  }
  if (data.isActive !== undefined) {
    clauses.push('is_active = ?');
    params.push(data.isActive ? 1 : 0);
  }

  params.push(id, company.id);
  await pool.query(
    `UPDATE announcements SET ${clauses.join(', ')} WHERE id = ? AND company_id = ?`,
    params
  );

  // Universal Audit Log
  await recordAuditLog({
    companyId: company.id,
    userId: authorUsername,
    action: 'ANNOUNCEMENT_UPDATED',
    entityType: 'ANNOUNCEMENT',
    entityId: id,
    details: {
      id,
      previous: {
        title: prev.title,
        priority: prev.priority,
        isActive: Boolean(prev.is_active),
      },
      updatedFields: Object.keys(data),
      updatedBy: authorUsername,
    },
  });

  return true;
}

/**
 * Deletes an announcement and its read logs, recording the action in Audit Log.
 */
export async function deleteAnnouncement(
  companyId: string,
  id: string,
  authorUsername: string
): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const [existing]: any = await pool.query(
    `SELECT title, priority FROM announcements WHERE id = ? AND company_id = ? LIMIT 1`,
    [id, company.id]
  );

  if (!existing || existing.length === 0) return false;
  const prevTitle = existing[0].title;

  await pool.query(`DELETE FROM announcement_reads WHERE announcement_id = ? AND company_id = ?`, [id, company.id]);
  await pool.query(`DELETE FROM announcements WHERE id = ? AND company_id = ?`, [id, company.id]);

  // Universal Audit Log
  await recordAuditLog({
    companyId: company.id,
    userId: authorUsername,
    action: 'ANNOUNCEMENT_DELETED',
    entityType: 'ANNOUNCEMENT',
    entityId: id,
    details: {
      id,
      title: prevTitle,
      deletedBy: authorUsername,
      timestamp: new Date().toISOString(),
    },
  });

  return true;
}

/**
 * Marks an announcement as read by an employee.
 */
export async function markAnnouncementAsRead(
  companyId: string,
  announcementId: string,
  userId: string
): Promise<boolean> {
  const { pool, company } = await resolveCompanyPoolAndContext(companyId);

  const id = `ar_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  await pool.query(
    `INSERT INTO announcement_reads (id, company_id, announcement_id, user_id, read_at)
     VALUES (?, ?, ?, ?, NOW())
     ON DUPLICATE KEY UPDATE read_at = NOW()`,
    [id, company.id, announcementId, userId]
  );

  return true;
}
