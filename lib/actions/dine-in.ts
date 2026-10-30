'use server';

import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';

export interface DineInOrder {
  id: string;
  companyId: string;
  orderNumber: string;
  kotId?: string | null;
  tableId?: string | null;
  tableName: string;
  waiterId?: string | null;
  waiterName?: string | null;
  guestCount: number;
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
    notes?: string;
  }>;
  totalAmount: number;
  kitchenStatus: 'PREPARING' | 'READY' | 'CANCELLED';
  servingStatus: 'Pending' | 'Ready' | 'Picked Up' | 'Served' | 'Completed';
  notes?: string | null;
  billId?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export async function createOrUpdateDineInOrder(params: {
  id?: string;
  orderNumber: string;
  kotId?: string;
  tableId?: string | null;
  tableName: string;
  waiterId?: string | null;
  waiterName?: string | null;
  guestCount?: number;
  items: Array<{ name: string; quantity: number; price?: number; notes?: string }>;
  totalAmount?: number;
  kitchenStatus?: 'PREPARING' | 'READY' | 'CANCELLED';
  servingStatus?: 'Pending' | 'Ready' | 'Picked Up' | 'Served' | 'Completed';
  notes?: string | null;
  billId?: string | null;
  createdBy?: string;
  targetCompanyId?: string;
}): Promise<{ success: boolean; orderId?: string; error?: string }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const currentUserName = session?.username || cookieStore.get('auth_username')?.value || 'Cashier';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      let companyId = params.targetCompanyId;
      if (!companyId) {
        try {
          const company = await getAuthorizedCompanyContext();
          companyId = company.id;
        } catch {
          companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';
        }
      }

      const orderId = params.id || `dio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const kitchenStatus = params.kitchenStatus || 'PREPARING';
      const servingStatus = params.servingStatus || (kitchenStatus === 'READY' ? 'Ready' : 'Pending');

      await pool.query(
        `INSERT INTO dine_in_orders (
          id, company_id, order_number, kot_id, table_id, table_name, waiter_id, waiter_name,
          guest_count, items, total_amount, kitchen_status, serving_status, notes, bill_id, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          order_number = VALUES(order_number),
          kot_id = COALESCE(VALUES(kot_id), kot_id),
          table_id = VALUES(table_id),
          table_name = VALUES(table_name),
          waiter_id = VALUES(waiter_id),
          waiter_name = VALUES(waiter_name),
          guest_count = VALUES(guest_count),
          items = VALUES(items),
          total_amount = VALUES(total_amount),
          kitchen_status = VALUES(kitchen_status),
          serving_status = VALUES(serving_status),
          notes = VALUES(notes),
          bill_id = COALESCE(VALUES(bill_id), bill_id)`,
        [
          orderId,
          companyId,
          params.orderNumber,
          params.kotId || null,
          params.tableId || null,
          params.tableName,
          params.waiterId || null,
          params.waiterName || null,
          params.guestCount || 1,
          JSON.stringify(params.items || []),
          Number(params.totalAmount) || 0.00,
          kitchenStatus,
          servingStatus,
          params.notes || null,
          params.billId || null,
          params.createdBy || currentUserName,
        ]
      );

      return { success: true, orderId };
    }

    // Mongo Fallback
    const db = await getDb();
    const companyId = params.targetCompanyId || cookieStore.get('auth_company_id')?.value || 'comp_default';
    const orderId = params.id || `dio_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    await db.collection('dine_in_orders').updateOne(
      { id: orderId, companyId },
      {
        $set: {
          id: orderId,
          companyId,
          orderNumber: params.orderNumber,
          kotId: params.kotId || null,
          tableId: params.tableId || null,
          tableName: params.tableName,
          waiterId: params.waiterId || null,
          waiterName: params.waiterName || null,
          guestCount: params.guestCount || 1,
          items: params.items || [],
          totalAmount: Number(params.totalAmount) || 0.00,
          kitchenStatus: params.kitchenStatus || 'PREPARING',
          servingStatus: params.servingStatus || 'Pending',
          notes: params.notes || null,
          billId: params.billId || null,
          createdBy: params.createdBy || currentUserName,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );

    return { success: true, orderId };
  } catch (err: any) {
    console.error('createOrUpdateDineInOrder error:', err);
    return { success: false, error: err.message || 'Failed to save dine-in order' };
  }
}

export async function getDineInOrders(filters?: {
  waiterId?: string;
  tableId?: string;
  servingStatus?: string;
  kitchenStatus?: string;
  activeOnly?: boolean;
}): Promise<{ success: boolean; orders: DineInOrder[]; error?: string }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();

      let companyId: string | undefined;
      try {
        const company = await getAuthorizedCompanyContext();
        companyId = company.id;
      } catch {
        companyId = cookieStore.get('auth_company_id')?.value;
      }

      if (!companyId) {
        return { success: true, orders: [] };
      }

      let query = `
        SELECT id, company_id, order_number, kot_id, table_id, table_name, waiter_id, waiter_name,
               guest_count, items, total_amount, kitchen_status, serving_status, notes, bill_id, created_by,
               created_at, updated_at
        FROM dine_in_orders
        WHERE company_id = ?
      `;
      const params: any[] = [companyId];

      // If logged in as Waiter, enforce strict isolation to only their assigned orders!
      if (session?.role === 'waiter') {
        const waiterUserId = session.userId;
        // Check staff id and name associated with this user
        const [staffRows]: any = await pool.query(
          'SELECT id, name, username FROM staff WHERE company_id = ? AND (user_id = ? OR username = ?)',
          [companyId, waiterUserId, session.username]
        );
        const staffIds = staffRows.map((r: any) => r.id);
        const staffNames = staffRows.map((r: any) => r.name);
        const matchIds = Array.from(new Set([waiterUserId, ...staffIds].filter(Boolean)));
        const matchNames = Array.from(new Set([session.username, ...staffNames].filter(Boolean)));

        const idPlaceholders = matchIds.length > 0 ? matchIds.map(() => '?').join(',') : "''";
        const namePlaceholders = matchNames.length > 0 ? matchNames.map(() => '?').join(',') : "''";

        query += ` AND (waiter_id IN (${idPlaceholders}) OR waiter_name IN (${namePlaceholders}))`;
        params.push(...matchIds, ...matchNames);
      } else if (filters?.waiterId) {
        query += ` AND (waiter_id = ? OR waiter_name = ?)`;
        params.push(filters.waiterId, filters.waiterId);
      }

      if (filters?.tableId) {
        query += ` AND table_id = ?`;
        params.push(filters.tableId);
      }

      if (filters?.kitchenStatus) {
        query += ` AND kitchen_status = ?`;
        params.push(filters.kitchenStatus);
      }

      if (filters?.servingStatus) {
        query += ` AND serving_status = ?`;
        params.push(filters.servingStatus);
      }

      if (filters?.activeOnly) {
        query += ` AND serving_status NOT IN ('Served', 'Completed', 'Cancelled')`;
      }

      query += ` ORDER BY created_at DESC LIMIT 100`;

      const [rows]: any = await pool.query(query, params);

      const orders: DineInOrder[] = rows.map((r: any) => {
        let items = [];
        try {
          items = typeof r.items === 'string' ? JSON.parse(r.items) : (r.items || []);
        } catch {
          items = [];
        }

        return {
          id: r.id,
          companyId: r.company_id,
          orderNumber: r.order_number,
          kotId: r.kot_id,
          tableId: r.table_id,
          tableName: r.table_name,
          waiterId: r.waiter_id,
          waiterName: r.waiter_name,
          guestCount: Number(r.guest_count) || 1,
          items,
          totalAmount: Number(r.total_amount) || 0.00,
          kitchenStatus: r.kitchen_status,
          servingStatus: r.serving_status,
          notes: r.notes,
          billId: r.bill_id,
          createdBy: r.created_by,
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
          updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
        };
      });

      return { success: true, orders };
    }

    // Mongo Fallback
    const db = await getDb();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';
    const query: any = { companyId };

    if (session?.role === 'waiter') {
      query.$or = [{ waiterId: session.userId }, { waiterName: session.username }];
    } else if (filters?.waiterId) {
      query.$or = [{ waiterId: filters.waiterId }, { waiterName: filters.waiterId }];
    }

    if (filters?.servingStatus) {
      query.servingStatus = filters.servingStatus;
    }

    const records = await db.collection('dine_in_orders').find(query).sort({ createdAt: -1 }).limit(100).toArray();

    return {
      success: true,
      orders: records.map((r: any) => ({
        id: r.id || r._id.toString(),
        companyId: r.companyId,
        orderNumber: r.orderNumber,
        kotId: r.kotId,
        tableId: r.tableId,
        tableName: r.tableName,
        waiterId: r.waiterId,
        waiterName: r.waiterName,
        guestCount: r.guestCount || 1,
        items: Array.isArray(r.items) ? r.items : [],
        totalAmount: Number(r.totalAmount) || 0,
        kitchenStatus: r.kitchenStatus || 'PREPARING',
        servingStatus: r.servingStatus || 'Pending',
        notes: r.notes,
        billId: r.billId,
        createdBy: r.createdBy || 'Cashier',
        createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : new Date().toISOString(),
        updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : new Date().toISOString(),
      })),
    };
  } catch (err: any) {
    console.error('getDineInOrders error:', err);
    return { success: false, orders: [], error: err.message || 'Failed to fetch dine-in orders' };
  }
}

export async function updateDineInServingStatus(
  orderId: string,
  servingStatus: 'Pending' | 'Ready' | 'Picked Up' | 'Served' | 'Completed'
): Promise<{ success: boolean; error?: string }> {
  try {
    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const cookieStore = await cookies();
      let companyId: string | undefined;
      try {
        const company = await getAuthorizedCompanyContext();
        companyId = company.id;
      } catch {
        companyId = cookieStore.get('auth_company_id')?.value;
      }

      await pool.query(
        `UPDATE dine_in_orders 
         SET serving_status = ?, updated_at = NOW() 
         WHERE (id = ? OR kot_id = ? OR order_number = ?)
           ${companyId ? 'AND company_id = ?' : ''}`,
        companyId ? [servingStatus, orderId, orderId, orderId, companyId] : [servingStatus, orderId, orderId, orderId]
      );

      // If there's an associated sale in sales table, update its serving_status too
      if (companyId) {
        await pool.query(
          `UPDATE sales SET serving_status = ? 
           WHERE company_id = ? AND (bill_number = ? OR id = ?)`,
          [servingStatus, companyId, orderId, orderId]
        );
      }

      return { success: true };
    }

    const db = await getDb();
    await db.collection('dine_in_orders').updateOne(
      { $or: [{ id: orderId }, { kotId: orderId }, { orderNumber: orderId }] },
      { $set: { servingStatus, updatedAt: new Date() } }
    );
    return { success: true };
  } catch (err: any) {
    console.error('updateDineInServingStatus error:', err);
    return { success: false, error: err.message || 'Failed to update serving status' };
  }
}

export async function assignDineInWaiter(
  orderId: string,
  waiterId: string | null,
  waiterName: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const cookieStore = await cookies();
      let companyId: string | undefined;
      try {
        const company = await getAuthorizedCompanyContext();
        companyId = company.id;
      } catch {
        companyId = cookieStore.get('auth_company_id')?.value;
      }

      await pool.query(
        `UPDATE dine_in_orders 
         SET waiter_id = ?, waiter_name = ?, updated_at = NOW() 
         WHERE (id = ? OR kot_id = ? OR order_number = ?)
           ${companyId ? 'AND company_id = ?' : ''}`,
        companyId ? [waiterId, waiterName, orderId, orderId, orderId, companyId] : [waiterId, waiterName, orderId, orderId, orderId]
      );

      // Also update sales table if order was already billed
      if (companyId) {
        await pool.query(
          `UPDATE sales SET waiter_id = ?, waiter_name = ? 
           WHERE company_id = ? AND (bill_number = ? OR id = ?)`,
          [waiterId, waiterName, companyId, orderId, orderId]
        );
      }

      return { success: true };
    }

    const db = await getDb();
    await db.collection('dine_in_orders').updateOne(
      { $or: [{ id: orderId }, { kotId: orderId }, { orderNumber: orderId }] },
      { $set: { waiterId, waiterName, updatedAt: new Date() } }
    );
    return { success: true };
  } catch (err: any) {
    console.error('assignDineInWaiter error:', err);
    return { success: false, error: err.message || 'Failed to assign waiter' };
  }
}

export async function updateDineInKitchenStatus(
  kotIdOrOrderId: string,
  kitchenStatus: 'PREPARING' | 'READY' | 'CANCELLED'
): Promise<{ success: boolean; error?: string }> {
  try {
    const servingStatusUpdate = kitchenStatus === 'READY' ? ', serving_status = "Ready"' : '';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const cookieStore = await cookies();
      let companyId: string | undefined;
      try {
        const company = await getAuthorizedCompanyContext();
        companyId = company.id;
      } catch {
        companyId = cookieStore.get('auth_company_id')?.value;
      }

      await pool.query(
        `UPDATE dine_in_orders 
         SET kitchen_status = ? ${servingStatusUpdate}, updated_at = NOW() 
         WHERE (kot_id = ? OR order_number = ? OR id = ?)
           ${companyId ? 'AND company_id = ?' : ''}`,
        companyId ? [kitchenStatus, kotIdOrOrderId, kotIdOrOrderId, kotIdOrOrderId, companyId] : [kitchenStatus, kotIdOrOrderId, kotIdOrOrderId, kotIdOrOrderId]
      );

      return { success: true };
    }

    const db = await getDb();
    const updateObj: any = { kitchenStatus, updatedAt: new Date() };
    if (kitchenStatus === 'READY') {
      updateObj.servingStatus = 'Ready';
    }
    await db.collection('dine_in_orders').updateOne(
      { $or: [{ kotId: kotIdOrOrderId }, { orderNumber: kotIdOrOrderId }, { id: kotIdOrOrderId }] },
      { $set: updateObj }
    );
    return { success: true };
  } catch (err: any) {
    console.error('updateDineInKitchenStatus error:', err);
    return { success: false, error: err.message || 'Failed to update kitchen status' };
  }
}
