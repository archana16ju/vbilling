'use server';

import { isLocalMySqlMode } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyPool } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { recordAuditLog } from '@/lib/actions/audit';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';

export interface AttendanceRecord {
  id: string;
  companyId: string;
  branchId?: string | null;
  userId: string;
  userName?: string;
  userRole?: string;
  date: string;
  clockIn: string;
  clockOut?: string | null;
  workingHours: number;
  status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Leave';
  notes?: string | null;
  correctedBy?: string | null;
  correctionReason?: string | null;
}

/**
 * Clock In a Staff Member
 * Prevents duplicate clock-ins and enforces company isolation.
 */
export async function clockInStaff(
  targetUserId?: string,
  notes?: string
): Promise<{ success: boolean; error?: string; record?: any }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const rawRole = session?.role || cookieStore.get('auth_role')?.value;
    const authRole = rawRole === 'admin' ? 'company_admin' : rawRole;
    const currentUserId = session?.userId || session?.username || cookieStore.get('auth_id')?.value || cookieStore.get('auth_username')?.value;

    const staffId = targetUserId || currentUserId;
    if (!staffId) {
      return { success: false, error: 'Staff member identifier is required for clock-in.' };
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const { pool, company } = await getAuthorizedCompanyPool();

      // Verify user belongs to this company
      const [userRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, username, name, role FROM users WHERE id = ? OR username = ?',
        [staffId, staffId]
      );
      if (userRows.length === 0) {
        return { success: false, error: 'Staff member not found in user directory.' };
      }
      const staffUser = userRows[0];

      // Check for an existing open clock-in session (clock_out IS NULL)
      const [openRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, clock_in FROM attendance WHERE company_id = ? AND user_id = ? AND clock_out IS NULL LIMIT 1',
        [company.id, staffUser.id]
      );

      if (openRows.length > 0) {
        return {
          success: false,
          error: `Staff member is already clocked in since ${new Date(openRows[0].clock_in).toLocaleTimeString()}. Please clock out first.`,
        };
      }

      const attendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const todayDate = now.toISOString().split('T')[0];

      // Default status is 'Present' (or 'Late' if past 10:00 AM)
      const status = now.getHours() >= 10 && now.getMinutes() > 15 ? 'Late' : 'Present';

      await pool.query(
        `INSERT INTO attendance (
          id, company_id, branch_id, user_id, date, clock_in, clock_out, working_hours, status, notes, created_at
        ) VALUES (?, ?, NULL, ?, ?, NOW(), NULL, 0.00, ?, ?, NOW())`,
        [attendanceId, company.id, staffUser.id, todayDate, status, notes || null]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId || staffUser.username,
        action: 'CLOCK_IN',
        entityType: 'ATTENDANCE',
        entityId: attendanceId,
        details: { staffId: staffUser.id, staffUsername: staffUser.username, status, clockIn: now.toISOString(), notes },
      });

      return {
        success: true,
        record: {
          id: attendanceId,
          companyId: company.id,
          userId: staffUser.id,
          userName: staffUser.name,
          date: todayDate,
          clockIn: now.toISOString(),
          status,
        },
      };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const authCompanyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const existingOpen = await db.collection('attendance').findOne({
      companyId: authCompanyId,
      userId: staffId,
      clockOut: null,
    });

    if (existingOpen) {
      return { success: false, error: 'Staff member is already clocked in.' };
    }

    const attendanceId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const todayDate = now.toISOString().split('T')[0];
    const status = now.getHours() >= 10 ? 'Late' : 'Present';

    await db.collection('attendance').insertOne({
      id: attendanceId,
      companyId: authCompanyId,
      userId: staffId,
      date: todayDate,
      clockIn: now,
      clockOut: null,
      workingHours: 0,
      status,
      notes: notes || null,
      createdAt: now,
    });

    return { success: true, record: { id: attendanceId, status, clockIn: now.toISOString() } };
  } catch (err: any) {
    console.error('clockInStaff error:', err);
    return { success: false, error: err.message || 'Failed to clock in.' };
  }
}

/**
 * Clock Out a Staff Member
 * Computes exact working hours and closes open session.
 */
export async function clockOutStaff(
  targetUserId?: string,
  notes?: string
): Promise<{ success: boolean; error?: string; record?: any }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const currentUserId = session?.userId || session?.username || cookieStore.get('auth_id')?.value || cookieStore.get('auth_username')?.value;

    const staffId = targetUserId || currentUserId;
    if (!staffId) {
      return { success: false, error: 'Staff member identifier is required for clock-out.' };
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const { pool, company } = await getAuthorizedCompanyPool();

      // Find staff user
      const [userRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, username, name FROM users WHERE id = ? OR username = ?',
        [staffId, staffId]
      );
      if (userRows.length === 0) {
        return { success: false, error: 'Staff member not found.' };
      }
      const staffUser = userRows[0];

      // Find active open session
      const [openRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, clock_in, date FROM attendance WHERE company_id = ? AND user_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
        [company.id, staffUser.id]
      );

      if (openRows.length === 0) {
        return { success: false, error: 'No active clock-in session found to clock out from.' };
      }

      const activeRecord = openRows[0];
      const clockInTime = new Date(activeRecord.clock_in).getTime();
      const clockOutTime = Date.now();
      const diffMs = Math.max(0, clockOutTime - clockInTime);
      const workingHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

      await pool.query(
        `UPDATE attendance 
         SET clock_out = NOW(), working_hours = ?, notes = COALESCE(CONCAT(COALESCE(notes, ''), ' | ', ?), notes)
         WHERE id = ?`,
        [workingHours, notes || 'Clocked out normally', activeRecord.id]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId || staffUser.username,
        action: 'CLOCK_OUT',
        entityType: 'ATTENDANCE',
        entityId: activeRecord.id,
        details: { staffId: staffUser.id, staffUsername: staffUser.username, workingHours, notes },
      });

      return {
        success: true,
        record: {
          id: activeRecord.id,
          workingHours,
          clockOut: new Date(clockOutTime).toISOString(),
        },
      };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const authCompanyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const activeRecord = await db.collection('attendance').findOne({
      companyId: authCompanyId,
      userId: staffId,
      clockOut: null,
    });

    if (!activeRecord) {
      return { success: false, error: 'No active clock-in session found.' };
    }

    const clockInTime = new Date(activeRecord.clockIn).getTime();
    const clockOutTime = Date.now();
    const workingHours = Number(((clockOutTime - clockInTime) / (1000 * 60 * 60)).toFixed(2));

    await db.collection('attendance').updateOne(
      { _id: activeRecord._id },
      { $set: { clockOut: new Date(clockOutTime), workingHours, updatedAt: new Date() } }
    );

    return { success: true, record: { id: activeRecord.id, workingHours } };
  } catch (err: any) {
    console.error('clockOutStaff error:', err);
    return { success: false, error: err.message || 'Failed to clock out.' };
  }
}

/**
 * Manual Attendance Correction by authorized Admin
 */
export async function manualAttendanceCorrection(
  attendanceId: string,
  params: {
    clockIn: string;
    clockOut?: string;
    status: 'Present' | 'Absent' | 'Late' | 'Half Day' | 'Leave';
    reason: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const rawRole = session?.role || cookieStore.get('auth_role')?.value;
    const authRole = rawRole === 'admin' ? 'company_admin' : rawRole;
    const adminUser = session?.username || cookieStore.get('auth_username')?.value || 'admin';

    if (authRole !== 'company_admin' && authRole !== 'super_admin') {
      return { success: false, error: 'Permission denied: Only Company Admin or Super Admin can correct attendance records.' };
    }

    if (!params.reason || params.reason.trim().length < 4) {
      return { success: false, error: 'A valid audit reason is required for manual attendance corrections.' };
    }

    const inTime = new Date(params.clockIn).getTime();
    let workingHours = 0;
    if (params.clockOut) {
      const outTime = new Date(params.clockOut).getTime();
      workingHours = Number((Math.max(0, outTime - inTime) / (1000 * 60 * 60)).toFixed(2));
    }

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const { pool, company } = await getAuthorizedCompanyPool();

      const [existing] = await pool.query<RowDataPacket[]>(
        'SELECT * FROM attendance WHERE id = ? AND company_id = ?',
        [attendanceId, company.id]
      );
      if (existing.length === 0) {
        return { success: false, error: 'Attendance record not found for this company.' };
      }

      await pool.query(
        `UPDATE attendance
         SET clock_in = ?, clock_out = ?, working_hours = ?, status = ?, corrected_by = ?, correction_reason = ?
         WHERE id = ? AND company_id = ?`,
        [
          params.clockIn,
          params.clockOut || null,
          workingHours,
          params.status,
          adminUser,
          params.reason,
          attendanceId,
          company.id,
        ]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: adminUser,
        action: 'ATTENDANCE_CORRECTION',
        entityType: 'ATTENDANCE',
        entityId: attendanceId,
        details: { before: existing[0], after: params, reason: params.reason },
      });

      return { success: true };
    }

    // MongoDB Mode
    const db = await getDb();
    await db.collection('attendance').updateOne(
      { id: attendanceId },
      {
        $set: {
          clockIn: new Date(params.clockIn),
          clockOut: params.clockOut ? new Date(params.clockOut) : null,
          workingHours,
          status: params.status,
          correctedBy: adminUser,
          correctionReason: params.reason,
          updatedAt: new Date(),
        },
      }
    );

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Manual correction failed.' };
  }
}
