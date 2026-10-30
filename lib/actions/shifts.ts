'use server';

import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { recordAuditLog } from '@/lib/actions/audit';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';

export interface ShiftRecord {
  id: string;
  companyId: string;
  branchId?: string | null;
  terminalId?: string | null;
  cashierId: string;
  cashierName?: string;
  openedAt: string;
  closedAt?: string | null;
  openingCash: number;
  expectedClosingCash: number;
  countedClosingCash: number;
  cashSales: number;
  cashRefunds: number;
  cashPaidIn: number;
  cashPaidOut: number;
  closingDifference: number;
  status: 'Open' | 'Closed' | 'Reconciliation Required';
  closingNotes?: string | null;
  closedByUserId?: string | null;
}

/**
 * Open a New Cashier Shift
 * Idempotent check ensures no duplicate open shifts for the same cashier/terminal.
 */
export async function openShift(params: {
  openingCash: number;
  terminalId?: string;
  notes?: string;
}): Promise<{ success: boolean; error?: string; shift?: ShiftRecord }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const currentUserId = session?.userId || session?.username || cookieStore.get('auth_id')?.value || cookieStore.get('auth_username')?.value || 'cashier';

    const openingCash = Number(params.openingCash) || 0;
    const terminalId = params.terminalId || 'TERM-01';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      // Check for already open shift
      const [openRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, opened_at FROM shifts WHERE company_id = ? AND cashier_id = ? AND status = "Open" LIMIT 1',
        [company.id, currentUserId]
      );

      if (openRows.length > 0) {
        return {
          success: false,
          error: `An active open shift (ID: ${openRows[0].id}) is already running since ${new Date(openRows[0].opened_at).toLocaleTimeString()}. Please close it first.`,
        };
      }

      const shiftId = `sh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      await pool.query(
        `INSERT INTO shifts (
          id, company_id, branch_id, terminal_id, cashier_id, opened_at, closed_at,
          opening_cash, expected_closing_cash, counted_closing_cash,
          cash_sales, cash_refunds, cash_paid_in, cash_paid_out, closing_difference,
          status, closing_notes, created_at
        ) VALUES (?, ?, NULL, ?, ?, NOW(), NULL, ?, ?, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 'Open', ?, NOW())`,
        [shiftId, company.id, terminalId, currentUserId, openingCash, openingCash, params.notes || null]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId,
        terminalId,
        action: 'SHIFT_OPEN',
        entityType: 'SHIFT',
        entityId: shiftId,
        details: { openingCash, terminalId, notes: params.notes },
      });

      return {
        success: true,
        shift: {
          id: shiftId,
          companyId: company.id,
          terminalId,
          cashierId: currentUserId,
          openedAt: new Date().toISOString(),
          openingCash,
          expectedClosingCash: openingCash,
          countedClosingCash: 0,
          cashSales: 0,
          cashRefunds: 0,
          cashPaidIn: 0,
          cashPaidOut: 0,
          closingDifference: 0,
          status: 'Open',
        },
      };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const authCompanyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const existingOpen = await db.collection('shifts').findOne({
      companyId: authCompanyId,
      cashierId: currentUserId,
      status: 'Open',
    });

    if (existingOpen) {
      return { success: false, error: 'An open shift is already active for this cashier.' };
    }

    const shiftId = `sh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const newShift = {
      id: shiftId,
      companyId: authCompanyId,
      terminalId,
      cashierId: currentUserId,
      openedAt: now,
      closedAt: null,
      openingCash,
      expectedClosingCash: openingCash,
      countedClosingCash: 0,
      cashSales: 0,
      cashRefunds: 0,
      cashPaidIn: 0,
      cashPaidOut: 0,
      closingDifference: 0,
      status: 'Open',
      closingNotes: params.notes || null,
      createdAt: now,
    };

    await db.collection('shifts').insertOne(newShift);
    return { success: true, shift: { ...newShift, openedAt: now.toISOString() } as any };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to open shift.' };
  }
}

/**
 * Get Shift Reconciliation Summary
 * Calculates actual sales and cash movements linked to the shift window.
 */
export async function getShiftSummary(shiftId: string): Promise<any> {
  if (isLocalMySqlMode()) {
    await ensureLocalMySqlInitialized();
    const pool = getMysqlPool();
    const company = await getAuthorizedCompanyContext();

    const [shiftRows] = await pool.query<RowDataPacket[]>(
      'SELECT * FROM shifts WHERE id = ? AND company_id = ?',
      [shiftId, company.id]
    );

    if (shiftRows.length === 0) return null;
    const shift = shiftRows[0];

    // Query sales made by this cashier since opened_at (or linked by shift_id)
    const [salesRows] = await pool.query<RowDataPacket[]>(
      `SELECT payment_method, payment_status, total
       FROM sales
       WHERE company_id = ? AND (shift_id = ? OR (created_by = ? AND created_at >= ? AND (created_at <= ? OR ? IS NULL)))`,
      [company.id, shiftId, shift.cashier_id, shift.opened_at, shift.closed_at, shift.closed_at]
    );

    let cashSales = 0;
    let digitalSales = 0;
    let billsCount = 0;

    for (const s of salesRows) {
      if (s.payment_status === 'cancelled') continue;
      billsCount++;
      const tot = Number(s.total) || 0;
      if (s.payment_method === 'Cash') cashSales += tot;
      else digitalSales += tot;
    }

    // Cash register entries during shift
    const [crRows] = await pool.query<RowDataPacket[]>(
      `SELECT type, amount, change_given FROM cash_register
       WHERE company_id = ? AND created_at >= ? AND (created_at <= ? OR ? IS NULL)`,
      [company.id, shift.opened_at, shift.closed_at, shift.closed_at]
    );

    let changeGiven = 0;
    for (const cr of crRows) {
      changeGiven += Number(cr.change_given) || 0;
    }

    const openingCash = Number(shift.opening_cash) || 0;
    const expectedClosing = openingCash + cashSales;

    return {
      shift,
      billsCount,
      openingCash,
      cashSales,
      digitalSales,
      changeGiven,
      expectedClosing,
    };
  }

  return null;
}

/**
 * Close Shift with Physical Cash Count and Reconciliation
 */
export async function closeShift(params: {
  shiftId: string;
  countedCash: number;
  closingNotes?: string;
}): Promise<{ success: boolean; error?: string; shift?: any }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const closingUserId = session?.username || cookieStore.get('auth_username')?.value || 'cashier';

    const countedCash = Number(params.countedCash) || 0;

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      // Retrieve open shift
      const [shiftRows] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM shifts WHERE id = ? AND company_id = ?',
        [params.shiftId, company.id]
      );

      if (shiftRows.length === 0) {
        return { success: false, error: 'Shift not found for this company.' };
      }
      const shift = shiftRows[0];

      if (shift.status !== 'Open') {
        return { success: false, error: `Shift is already closed (Status: ${shift.status}).` };
      }

      // Calculate actual cash sales during this shift window
      const [salesRows] = await pool.query<RowDataPacket[]>(
        `SELECT SUM(total) as cash_total
         FROM sales
         WHERE company_id = ? AND payment_method = 'Cash' AND payment_status != 'cancelled'
           AND (shift_id = ? OR (created_by = ? AND created_at >= ?))`,
        [company.id, shift.id, shift.cashier_id, shift.opened_at]
      );

      const cashSales = Number(salesRows[0]?.cash_total) || 0;
      const openingCash = Number(shift.opening_cash) || 0;
      const expectedClosingCash = openingCash + cashSales;
      const closingDifference = Number((countedCash - expectedClosingCash).toFixed(2));

      // If difference is non-zero, mark as 'Reconciliation Required', otherwise 'Closed'
      const status = Math.abs(closingDifference) > 0.01 ? 'Reconciliation Required' : 'Closed';

      await pool.query(
        `UPDATE shifts
         SET closed_at = NOW(),
             expected_closing_cash = ?,
             counted_closing_cash = ?,
             cash_sales = ?,
             closing_difference = ?,
             status = ?,
             closing_notes = ?,
             closed_by_user_id = ?
         WHERE id = ? AND company_id = ?`,
        [
          expectedClosingCash,
          countedCash,
          cashSales,
          closingDifference,
          status,
          params.closingNotes || null,
          closingUserId,
          shift.id,
          company.id,
        ]
      );

      // Link any unassigned sales made during this shift by this cashier to this shift_id
      await pool.query(
        `UPDATE sales
         SET shift_id = ?
         WHERE company_id = ? AND created_by = ? AND created_at >= ? AND (shift_id IS NULL OR shift_id = '')`,
        [shift.id, company.id, shift.cashier_id, shift.opened_at]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: closingUserId,
        terminalId: shift.terminal_id,
        action: 'SHIFT_CLOSE',
        entityType: 'SHIFT',
        entityId: shift.id,
        details: {
          openingCash,
          cashSales,
          expectedClosingCash,
          countedCash,
          closingDifference,
          status,
          notes: params.closingNotes,
        },
      });

      return {
        success: true,
        shift: {
          id: shift.id,
          status,
          expectedClosingCash,
          countedClosingCash: countedCash,
          closingDifference,
          cashSales,
        },
      };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const authCompanyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const shift = await db.collection('shifts').findOne({ id: params.shiftId, companyId: authCompanyId });
    if (!shift) return { success: false, error: 'Shift not found.' };

    const expectedClosingCash = Number(shift.openingCash) || 0;
    const closingDifference = countedCash - expectedClosingCash;
    const status = Math.abs(closingDifference) > 0.01 ? 'Reconciliation Required' : 'Closed';

    await db.collection('shifts').updateOne(
      { id: params.shiftId },
      {
        $set: {
          closedAt: new Date(),
          countedClosingCash: countedCash,
          closingDifference,
          status,
          closingNotes: params.closingNotes || null,
          closedByUserId: closingUserId,
          updatedAt: new Date(),
        },
      }
    );

    return { success: true, shift: { id: params.shiftId, status, closingDifference } };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to close shift.' };
  }
}
