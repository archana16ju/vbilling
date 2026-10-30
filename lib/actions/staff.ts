'use server';

import { isLocalMySqlMode, getMysqlPool } from '@/lib/mysql';
import { ensureLocalMySqlInitialized } from '@/lib/mysql-init';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getSession } from '@/lib/auth-session';
import { getDb } from '@/lib/actions/db';
import { recordAuditLog } from '@/lib/actions/audit';
import { cookies } from 'next/headers';
import { RowDataPacket } from 'mysql2';
import type {
  StaffMember,
  StaffAllowance,
  StaffDeduction,
  TodayAttendanceItem,
  MonthSheetEmployeeRow,
  AttendanceReportRow,
  PayrollRow,
  MarkCode,
} from '@/types/staff';

export type {
  StaffMember,
  StaffAllowance,
  StaffDeduction,
  TodayAttendanceItem,
  MonthSheetEmployeeRow,
  AttendanceReportRow,
  PayrollRow,
  MarkCode,
};

/**
 * Fetch all staff members for the authenticated company.
 */
export async function getStaffList(targetCompanyId?: string): Promise<{ success: boolean; staff: StaffMember[]; error?: string }> {
  try {
    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();
      const companyId = targetCompanyId || company.id;

      // Auto-sync real company staff users (Manager, Cashier, Chef, Waiter) into the staff table
      try {
        // Migrate any legacy 'Staff' role rows to 'Cashier'
        await pool.query("UPDATE staff SET role = 'Cashier' WHERE LOWER(TRIM(role)) = 'staff'");

        const [staffUsers] = await pool.query<RowDataPacket[]>(
          `SELECT id, username, name, role, company_id FROM users WHERE company_id = ? AND role IN ('manager', 'cashier', 'chef', 'waiter')`,
          [companyId]
        );
        for (const u of staffUsers) {
          const [existing] = await pool.query<RowDataPacket[]>(
            `SELECT id FROM staff WHERE company_id = ? AND (user_id = ? OR username = ?)`,
            [companyId, u.id, u.username]
          );
          if (existing.length === 0) {
            const staffId = `st_${u.id}`;
            const displayName = u.name && u.name.trim() ? u.name : u.username;
            const roleCap = u.role.charAt(0).toUpperCase() + u.role.slice(1).toLowerCase();
            await pool.query(
              `INSERT INTO staff (id, company_id, branch_id, user_id, name, username, role, phone, pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at)
               VALUES (?, ?, NULL, ?, ?, ?, ?, NULL, 'Monthly', 15000.00, '[]', '[]', 1, 1, NOW())`,
              [staffId, companyId, u.id, displayName, u.username, roleCap]
            );
          }
        }
      } catch (syncErr) {
        console.error('Auto-sync staff users error:', syncErr);
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT id, company_id, branch_id, user_id, name, username, role, phone,
                pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at
         FROM staff
         WHERE company_id = ?
         ORDER BY name ASC`,
        [companyId]
      );

      const staff: StaffMember[] = rows.map((r) => {
        let allowances: StaffAllowance[] = [];
        let deductions: StaffDeduction[] = [];
        try {
          if (typeof r.allowances === 'string') allowances = JSON.parse(r.allowances);
          else if (Array.isArray(r.allowances)) allowances = r.allowances;
        } catch { }
        try {
          if (typeof r.deductions === 'string') deductions = JSON.parse(r.deductions);
          else if (Array.isArray(r.deductions)) deductions = r.deductions;
        } catch { }

        return {
          id: r.id,
          companyId: r.company_id,
          branchId: r.branch_id,
          userId: r.user_id,
          name: r.name,
          username: r.username,
          role: r.role || 'Cashier',
          phone: r.phone,
          payType: (r.pay_type || 'Monthly') as 'Monthly' | 'Daily' | 'Hourly',
          baseAmount: Number(r.base_amount || 0),
          allowances,
          deductions,
          includeInPayroll: Boolean(r.include_in_payroll),
          isActive: Boolean(r.is_active),
          createdAt: r.created_at ? new Date(r.created_at).toISOString() : undefined,
        };
      });

      return { success: true, staff };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = targetCompanyId || cookieStore.get('auth_company_id')?.value || 'comp_default';

    // Auto-sync real cashiers in users collection to staff collection
    try {
      const cashiers = await db.collection('users').find({ companyId, role: 'cashier' }).toArray();
      for (const c of cashiers) {
        const uid = c.id || c._id?.toString();
        const exists = await db.collection('staff').findOne({
          companyId,
          $or: [{ userId: uid }, { username: c.username }]
        });
        if (!exists) {
          const staffId = `st_${uid}`;
          const displayName = c.name && c.name.trim() ? c.name : c.username;
          await db.collection('staff').insertOne({
            id: staffId,
            companyId,
            userId: uid,
            name: displayName,
            username: c.username,
            role: 'Cashier',
            payType: 'Monthly',
            baseAmount: 15000,
            allowances: [],
            deductions: [],
            includeInPayroll: true,
            isActive: true,
            createdAt: new Date(),
          });
        }
      }
    } catch (syncErr) {
      console.error('Auto-sync cashier to staff Mongo error:', syncErr);
    }

    const records = await db.collection('staff').find({ companyId }).sort({ name: 1 }).toArray();
    const staff: StaffMember[] = records.map((r: any) => ({
      id: r.id || r._id.toString(),
      companyId: r.companyId,
      branchId: r.branchId,
      userId: r.userId,
      name: r.name,
      username: r.username,
      role: r.role || 'Staff',
      phone: r.phone,
      payType: r.payType || 'Monthly',
      baseAmount: Number(r.baseAmount || 0),
      allowances: Array.isArray(r.allowances) ? r.allowances : [],
      deductions: Array.isArray(r.deductions) ? r.deductions : [],
      includeInPayroll: r.includeInPayroll !== false,
      isActive: r.isActive !== false,
      createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
    }));

    return { success: true, staff };
  } catch (err: any) {
    console.error('getStaffList error:', err);
    return { success: false, staff: [], error: err.message || 'Failed to fetch staff members.' };
  }
}

/**
 * Register a new staff member for the company.
 */
export async function createStaffMember(params: {
  name: string;
  role: string;
  phone?: string;
  payType: 'Monthly' | 'Daily' | 'Hourly';
  baseAmount: number;
  userId?: string;
  username?: string;
  password?: string;
  targetCompanyId?: string;
}): Promise<{ success: boolean; staffId?: string; error?: string }> {
  try {
    if (!params.name || !params.name.trim()) {
      return { success: false, error: 'Staff name is required.' };
    }

    const rawRole = (params.role || '').trim().toLowerCase();
    const VALID_STAFF_ROLES: Record<string, string> = {
      manager: 'Manager',
      cashier: 'Cashier',
      chef: 'Chef',
      waiter: 'Waiter',
    };

    if (!VALID_STAFF_ROLES[rawRole]) {
      return {
        success: false,
        error: 'Invalid staff role. Allowed Staff Collection roles are: Manager, Cashier, Chef, and Waiter. (Super Admin, Company Admin, and Staff are not allowed).',
      };
    }
    const staffRole = VALID_STAFF_ROLES[rawRole];

    const staffId = `st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const session = await getSession();
    const cookieStore = await cookies();
    const currentUserId = session?.userId || cookieStore.get('auth_user_id')?.value || 'system';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();
      const companyId = params.targetCompanyId || company.id;

      let createdUserId = params.userId || null;
      const cleanUsername = params.username && params.username.trim()
        ? params.username.trim().toLowerCase().replace(/\s+/g, '_')
        : params.name.trim().toLowerCase().replace(/\s+/g, '_');

      // Auto-create corresponding login user account if one doesn't exist
      if (!createdUserId) {
        const uId = `u_${rawRole}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const pass = params.password && params.password.trim() ? params.password.trim() : `${rawRole}123`;
        const { hashPassword } = await import('@/lib/users');
        const hashed = hashPassword(pass);
        const [comp] = await pool.query<RowDataPacket[]>('SELECT name FROM companies WHERE id = ?', [companyId]);
        const compName = comp[0]?.name || company.name || 'Company';

        await pool.query(
          `INSERT INTO users (id, name, username, email, password, password_hash, role, company_id, company_name, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
           ON DUPLICATE KEY UPDATE role = VALUES(role)`,
          [uId, params.name.trim(), cleanUsername, `${cleanUsername}@local.test`, hashed, hashed, rawRole, companyId, compName]
        );
        await pool.query(
          `INSERT IGNORE INTO user_companies (id, user_id, company_id, role)
           VALUES (?, ?, ?, ?)`,
          [`uc_${uId}`, uId, companyId, rawRole]
        );
        createdUserId = uId;
      }

      await pool.query(
        `INSERT INTO staff (
          id, company_id, branch_id, user_id, name, username, role, phone,
          pay_type, base_amount, allowances, deductions, include_in_payroll, is_active, created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, '[]', '[]', 1, 1, NOW())`,
        [
          staffId,
          companyId,
          createdUserId,
          params.name.trim(),
          cleanUsername,
          staffRole,
          params.phone?.trim() || null,
          params.payType || 'Monthly',
          Number(params.baseAmount) || 0,
        ]
      );

      await recordAuditLog({
        companyId,
        userId: currentUserId,
        action: 'CREATE_STAFF_MEMBER',
        entityType: 'STAFF',
        entityId: staffId,
        details: { name: params.name, role: staffRole, baseAmount: params.baseAmount },
      });

      return { success: true, staffId };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const companyId = params.targetCompanyId || cookieStore.get('auth_company_id')?.value || 'comp_default';

    await db.collection('staff').insertOne({
      id: staffId,
      companyId,
      userId: params.userId || null,
      name: params.name.trim(),
      username: params.name.trim().toLowerCase().replace(/\s+/g, '_'),
      role: params.role.trim() || 'Staff',
      phone: params.phone?.trim() || null,
      payType: params.payType || 'Monthly',
      baseAmount: Number(params.baseAmount) || 0,
      allowances: [],
      deductions: [],
      includeInPayroll: true,
      isActive: true,
      createdAt: new Date(),
    });

    return { success: true, staffId };
  } catch (err: any) {
    console.error('createStaffMember error:', err);
    return { success: false, error: err.message || 'Failed to create staff member.' };
  }
}

/**
 * Delete a staff member.
 */
export async function deleteStaffMember(staffId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const currentUserId = session?.userId || cookieStore.get('auth_user_id')?.value || 'system';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      await pool.query('DELETE FROM staff WHERE id = ? AND company_id = ?', [staffId, company.id]);

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId,
        action: 'DELETE_STAFF_MEMBER',
        entityType: 'STAFF',
        entityId: staffId,
      });

      return { success: true };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';
    await db.collection('staff').deleteOne({ id: staffId, companyId });

    return { success: true };
  } catch (err: any) {
    console.error('deleteStaffMember error:', err);
    return { success: false, error: err.message || 'Failed to delete staff member.' };
  }
}

/**
 * Save or update staff salary and payroll details.
 */
export async function updateStaffSalary(params: {
  staffId: string;
  payType: 'Monthly' | 'Daily' | 'Hourly';
  baseAmount: number;
  allowances: StaffAllowance[];
  deductions: StaffDeduction[];
  includeInPayroll: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    const currentUserId = session?.userId || session?.username || 'admin';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      await pool.query(
        `UPDATE staff
         SET pay_type = ?, base_amount = ?, allowances = ?, deductions = ?, include_in_payroll = ?, updated_at = NOW()
         WHERE id = ? AND company_id = ?`,
        [
          params.payType,
          Number(params.baseAmount) || 0,
          JSON.stringify(params.allowances || []),
          JSON.stringify(params.deductions || []),
          params.includeInPayroll ? 1 : 0,
          params.staffId,
          company.id,
        ]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId,
        action: 'UPDATE_STAFF_SALARY',
        entityType: 'STAFF',
        entityId: params.staffId,
        details: {
          payType: params.payType,
          baseAmount: params.baseAmount,
          includeInPayroll: params.includeInPayroll,
        },
      });

      return { success: true };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    await db.collection('staff').updateOne(
      { id: params.staffId, companyId },
      {
        $set: {
          payType: params.payType,
          baseAmount: Number(params.baseAmount) || 0,
          allowances: params.allowances || [],
          deductions: params.deductions || [],
          includeInPayroll: params.includeInPayroll,
          updatedAt: new Date(),
        },
      }
    );

    return { success: true };
  } catch (err: any) {
    console.error('updateStaffSalary error:', err);
    return { success: false, error: err.message || 'Failed to update staff salary.' };
  }
}

/**
 * Fetch Today tab attendance for all staff on a specific date.
 */
export async function getStaffAttendanceToday(dateStr: string): Promise<{ success: boolean; items: TodayAttendanceItem[]; error?: string }> {
  try {
    const dateFormatted = dateStr || new Date().toISOString().split('T')[0];

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      // Get all staff
      const [staffRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, role, user_id FROM staff WHERE company_id = ? AND is_active = 1 ORDER BY name ASC',
        [company.id]
      );

      // Get attendance records for this date
      const [attRows] = await pool.query<RowDataPacket[]>(
        `SELECT id, staff_id, user_id, clock_in, clock_out, working_hours, status, mark_code, notes
         FROM attendance
         WHERE company_id = ? AND date = ?`,
        [company.id, dateFormatted]
      );

      const attMap: Record<string, RowDataPacket> = {};
      for (const a of attRows) {
        if (a.staff_id) attMap[a.staff_id] = a;
        if (a.user_id) attMap[a.user_id] = a;
      }

      const items: TodayAttendanceItem[] = staffRows.map((s) => {
        const att = attMap[s.id] || (s.user_id ? attMap[s.user_id] : null);
        let clockInFormatted: string | null = null;
        let clockOutFormatted: string | null = null;

        if (att?.clock_in) {
          clockInFormatted = new Date(att.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        if (att?.clock_out) {
          clockOutFormatted = new Date(att.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        return {
          staffId: s.id,
          name: s.name,
          role: s.role || 'Staff',
          status: att?.status || '-',
          markCode: att?.mark_code || null,
          clockIn: clockInFormatted,
          clockOut: clockOutFormatted,
          workedHours: att?.working_hours ? Number(att.working_hours) : null,
          notes: att?.notes || null,
        };
      });

      return { success: true, items };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const staffList = await db.collection('staff').find({ companyId, isActive: { $ne: false } }).sort({ name: 1 }).toArray();
    const attList = await db.collection('attendance').find({ companyId, date: dateFormatted }).toArray();

    const attMap: Record<string, any> = {};
    for (const a of attList) {
      if (a.staffId) attMap[a.staffId] = a;
      if (a.userId) attMap[a.userId] = a;
    }

    const items: TodayAttendanceItem[] = staffList.map((s: any) => {
      const att = attMap[s.id || s._id.toString()];
      return {
        staffId: s.id || s._id.toString(),
        name: s.name,
        role: s.role || 'Staff',
        status: att?.status || '-',
        markCode: att?.markCode || null,
        clockIn: att?.clockIn ? new Date(att.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        clockOut: att?.clockOut ? new Date(att.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
        workedHours: att?.workingHours ? Number(att.workingHours) : null,
        notes: att?.notes || null,
      };
    });

    return { success: true, items };
  } catch (err: any) {
    console.error('getStaffAttendanceToday error:', err);
    return { success: false, items: [], error: err.message || 'Failed to fetch attendance.' };
  }
}

/**
 * Mark attendance for a single staff member on a date with status codes:
 * P (Present), A (Absent), L (Leave), ½ (Half Day), H (Holiday), W (Week Off), X (Clear).
 */
export async function markStaffAttendance(params: {
  staffId: string;
  dateStr: string;
  markCode: MarkCode;
  notes?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { staffId, dateStr, markCode, notes } = params;
    const session = await getSession();
    const currentUserId = session?.userId || session?.username || 'admin';

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      // Find staff details
      const [staffRows] = await pool.query<RowDataPacket[]>(
        'SELECT id, name, user_id FROM staff WHERE id = ? AND company_id = ?',
        [staffId, company.id]
      );
      if (staffRows.length === 0) return { success: false, error: 'Staff member not found.' };
      const staffMember = staffRows[0];

      // If X, delete/clear attendance for this day
      if (markCode === 'X') {
        await pool.query(
          'DELETE FROM attendance WHERE company_id = ? AND (staff_id = ? OR user_id = ?) AND date = ?',
          [company.id, staffId, staffMember.user_id || staffId, dateStr]
        );
        return { success: true };
      }

      let status = 'Present';
      let workingHours = 8.0;
      if (markCode === 'A') { status = 'Absent'; workingHours = 0; }
      else if (markCode === 'L') { status = 'Leave'; workingHours = 0; }
      else if (markCode === '½' || markCode === 'HD') { status = 'Half Day'; workingHours = 4.0; }
      else if (markCode === 'H') { status = 'Holiday'; workingHours = 0; }
      else if (markCode === 'W') { status = 'Week Off'; workingHours = 0; }

      const attId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      // Upsert attendance record
      await pool.query(
        `INSERT INTO attendance (
          id, company_id, branch_id, user_id, staff_id, date, status, mark_code, working_hours, notes, created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE status = VALUES(status), mark_code = VALUES(mark_code), working_hours = VALUES(working_hours), notes = VALUES(notes)`,
        [
          attId,
          company.id,
          staffMember.user_id || null,
          staffId,
          dateStr,
          status,
          markCode,
          workingHours,
          notes || null,
        ]
      );

      return { success: true };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    if (markCode === 'X') {
      await db.collection('attendance').deleteOne({ companyId, staffId, date: dateStr });
      return { success: true };
    }

    let status = 'Present';
    let workingHours = 8.0;
    if (markCode === 'A') { status = 'Absent'; workingHours = 0; }
    else if (markCode === 'L') { status = 'Leave'; workingHours = 0; }
    else if (markCode === '½' || markCode === 'HD') { status = 'Half Day'; workingHours = 4.0; }
    else if (markCode === 'H') { status = 'Holiday'; workingHours = 0; }
    else if (markCode === 'W') { status = 'Week Off'; workingHours = 0; }

    await db.collection('attendance').updateOne(
      { companyId, staffId, date: dateStr },
      {
        $set: {
          companyId,
          staffId,
          date: dateStr,
          status,
          markCode,
          workingHours,
          notes: notes || null,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          createdAt: new Date(),
        },
      },
      { upsert: true }
    );

    return { success: true };
  } catch (err: any) {
    console.error('markStaffAttendance error:', err);
    return { success: false, error: err.message || 'Failed to record attendance.' };
  }
}

/**
 * Mark all active staff present for a given date.
 */
export async function markAllStaffPresent(dateStr: string): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const staffRes = await getStaffList();
    if (!staffRes.success || staffRes.staff.length === 0) {
      return { success: false, count: 0, error: staffRes.error || 'No active staff found.' };
    }

    for (const s of staffRes.staff) {
      if (s.isActive) {
        await markStaffAttendance({
          staffId: s.id,
          dateStr,
          markCode: 'P',
        });
      }
    }

    return { success: true, count: staffRes.staff.filter((s) => s.isActive).length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

/**
 * Fetch monthly attendance sheet (grid of 1..31 days + Paid count).
 */
export async function getMonthSheetData(params: {
  year: number;
  month: number;
}): Promise<{ success: boolean; rows: MonthSheetEmployeeRow[]; daysInMonth: number; error?: string }> {
  try {
    const { year, month } = params;
    const daysInMonth = new Date(year, month, 0).getDate();

    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month)}-01`;
    const endStr = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    const staffRes = await getStaffList();
    if (!staffRes.success) return { success: false, rows: [], daysInMonth, error: staffRes.error };

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      const [attRows] = await pool.query<RowDataPacket[]>(
        `SELECT staff_id, user_id, date, status, mark_code
         FROM attendance
         WHERE company_id = ? AND date BETWEEN ? AND ?`,
        [company.id, startStr, endStr]
      );

      const staffMap: Record<string, Record<number, string>> = {};
      for (const s of staffRes.staff) {
        staffMap[s.id] = {};
      }

      for (const a of attRows) {
        const d = new Date(a.date).getDate();
        const code = a.mark_code || (a.status === 'Present' ? 'P' : a.status === 'Absent' ? 'A' : a.status === 'Leave' ? 'L' : a.status === 'Half Day' ? '½' : 'P');
        if (a.staff_id && staffMap[a.staff_id]) {
          staffMap[a.staff_id][d] = code;
        }
      }

      const rows: MonthSheetEmployeeRow[] = staffRes.staff.map((s) => {
        const days = staffMap[s.id] || {};
        let paid = 0;
        for (let day = 1; day <= daysInMonth; day++) {
          const c = days[day];
          if (c === 'P' || c === 'W' || c === 'H') paid += 1;
          else if (c === '½' || c === 'HD') paid += 0.5;
        }

        return {
          staffId: s.id,
          name: s.name,
          days,
          paidDays: paid,
        };
      });

      return { success: true, rows, daysInMonth };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const attList = await db.collection('attendance').find({
      companyId,
      date: { $gte: startStr, $lte: endStr },
    }).toArray();

    const staffMap: Record<string, Record<number, string>> = {};
    for (const s of staffRes.staff) {
      staffMap[s.id] = {};
    }

    for (const a of attList) {
      const d = parseInt(a.date.split('-')[2], 10);
      const code = a.markCode || (a.status === 'Present' ? 'P' : 'P');
      if (a.staffId && staffMap[a.staffId]) {
        staffMap[a.staffId][d] = code;
      }
    }

    const rows: MonthSheetEmployeeRow[] = staffRes.staff.map((s) => {
      const days = staffMap[s.id] || {};
      let paid = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const c = days[day];
        if (c === 'P' || c === 'W' || c === 'H') paid += 1;
        else if (c === '½' || c === 'HD') paid += 0.5;
      }
      return {
        staffId: s.id,
        name: s.name,
        days,
        paidDays: paid,
      };
    });

    return { success: true, rows, daysInMonth };
  } catch (err: any) {
    console.error('getMonthSheetData error:', err);
    return { success: false, rows: [], daysInMonth: 31, error: err.message };
  }
}

/**
 * Fill present for all working days in a month (excluding Sundays).
 */
export async function fillMonthPresent(year: number, month: number): Promise<{ success: boolean; error?: string }> {
  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const staffRes = await getStaffList();
    if (!staffRes.success) return { success: false, error: staffRes.error };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      if (dateObj.getDay() === 0) continue; // Skip Sundays

      const dateStr = `${year}-${pad(month)}-${pad(day)}`;
      for (const s of staffRes.staff) {
        if (s.isActive) {
          await markStaffAttendance({
            staffId: s.id,
            dateStr,
            markCode: 'P',
          });
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Mark all Sundays as Week Off ('W') in a month.
 */
export async function setMonthSundaysWeekOff(year: number, month: number): Promise<{ success: boolean; error?: string }> {
  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const staffRes = await getStaffList();
    if (!staffRes.success) return { success: false, error: staffRes.error };

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month - 1, day);
      if (dateObj.getDay() === 0) { // Sunday
        const dateStr = `${year}-${pad(month)}-${pad(day)}`;
        for (const s of staffRes.staff) {
          if (s.isActive) {
            await markStaffAttendance({
              staffId: s.id,
              dateStr,
              markCode: 'W',
              notes: 'Weekly off',
            });
          }
        }
      }
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Clear all attendance records for a specific month.
 */
export async function clearMonthAttendance(year: number, month: number): Promise<{ success: boolean; error?: string }> {
  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const pad = (n: number) => String(n).padStart(2, '0');
    const startStr = `${year}-${pad(month)}-01`;
    const endStr = `${year}-${pad(month)}-${pad(daysInMonth)}`;

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      await pool.query(
        'DELETE FROM attendance WHERE company_id = ? AND date BETWEEN ? AND ?',
        [company.id, startStr, endStr]
      );
      return { success: true };
    }

    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    await db.collection('attendance').deleteMany({
      companyId,
      date: { $gte: startStr, $lte: endStr },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Fetch Staff Attendance Report aggregated over a date range.
 */
export async function getStaffAttendanceReportData(params: {
  startDate: string;
  endDate: string;
}): Promise<{ success: boolean; rows: AttendanceReportRow[]; error?: string }> {
  try {
    const { startDate, endDate } = params;
    const staffRes = await getStaffList();
    if (!staffRes.success) return { success: false, rows: [], error: staffRes.error };

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      const [attRows] = await pool.query<RowDataPacket[]>(
        `SELECT staff_id, user_id, status, mark_code, working_hours
         FROM attendance
         WHERE company_id = ? AND date BETWEEN ? AND ?`,
        [company.id, startDate, endDate]
      );

      const countMap: Record<string, { present: number; half: number; leave: number; absent: number; hours: number }> = {};
      for (const s of staffRes.staff) {
        countMap[s.id] = { present: 0, half: 0, leave: 0, absent: 0, hours: 0 };
      }

      for (const a of attRows) {
        const sid = a.staff_id;
        if (!sid || !countMap[sid]) continue;

        const code = a.mark_code || a.status;
        if (code === 'P' || code === 'Present') countMap[sid].present++;
        else if (code === '½' || code === 'HD' || code === 'Half Day') countMap[sid].half++;
        else if (code === 'L' || code === 'Leave') countMap[sid].leave++;
        else if (code === 'A' || code === 'Absent') countMap[sid].absent++;

        countMap[sid].hours += Number(a.working_hours || 0);
      }

      const rows: AttendanceReportRow[] = staffRes.staff.map((s) => {
        const c = countMap[s.id] || { present: 0, half: 0, leave: 0, absent: 0, hours: 0 };
        return {
          staffId: s.id,
          name: s.name,
          present: c.present,
          half: c.half,
          leave: c.leave,
          absent: c.absent,
          workedHours: Number(c.hours.toFixed(1)),
        };
      });

      return { success: true, rows };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    const attList = await db.collection('attendance').find({
      companyId,
      date: { $gte: startDate, $lte: endDate },
    }).toArray();

    const countMap: Record<string, { present: number; half: number; leave: number; absent: number; hours: number }> = {};
    for (const s of staffRes.staff) {
      countMap[s.id] = { present: 0, half: 0, leave: 0, absent: 0, hours: 0 };
    }

    for (const a of attList) {
      const sid = a.staffId;
      if (!sid || !countMap[sid]) continue;
      const code = a.markCode || a.status;
      if (code === 'P' || code === 'Present') countMap[sid].present++;
      else if (code === '½' || code === 'HD' || code === 'Half Day') countMap[sid].half++;
      else if (code === 'L' || code === 'Leave') countMap[sid].leave++;
      else if (code === 'A' || code === 'Absent') countMap[sid].absent++;
      countMap[sid].hours += Number(a.workingHours || 0);
    }

    const rows: AttendanceReportRow[] = staffRes.staff.map((s) => {
      const c = countMap[s.id] || { present: 0, half: 0, leave: 0, absent: 0, hours: 0 };
      return {
        staffId: s.id,
        name: s.name,
        present: c.present,
        half: c.half,
        leave: c.leave,
        absent: c.absent,
        workedHours: Number(c.hours.toFixed(1)),
      };
    });

    return { success: true, rows };
  } catch (err: any) {
    console.error('getStaffAttendanceReportData error:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/**
 * Fetch monthly Payroll summary for all employees.
 */
export async function getPayrollSheetData(year: number, month: number): Promise<{ success: boolean; rows: PayrollRow[]; error?: string }> {
  try {
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthSheet = await getMonthSheetData({ year, month });
    if (!monthSheet.success) return { success: false, rows: [], error: monthSheet.error };

    const staffRes = await getStaffList();
    if (!staffRes.success) return { success: false, rows: [], error: staffRes.error };

    const paidDaysMap: Record<string, number> = {};
    for (const r of monthSheet.rows) {
      paidDaysMap[r.staffId] = r.paidDays;
    }

    const rows: PayrollRow[] = staffRes.staff.map((s) => {
      const paidDays = paidDaysMap[s.id] || 0;
      const base = Number(s.baseAmount) || 0;

      // Pro-rated monthly salary calculation
      let earnedBase = 0;
      if (s.payType === 'Monthly') {
        earnedBase = daysInMonth > 0 ? (base / daysInMonth) * paidDays : 0;
      } else if (s.payType === 'Daily') {
        earnedBase = base * paidDays;
      } else {
        earnedBase = base;
      }

      const allowancesTotal = (s.allowances || []).reduce((acc, a) => acc + (Number(a.amount) || 0), 0);
      const deductionsTotal = (s.deductions || []).reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
      const netSalary = Math.max(0, earnedBase + allowancesTotal - deductionsTotal);

      return {
        staffId: s.id,
        name: s.name,
        payType: s.payType,
        baseAmount: base,
        paidDays,
        daysInMonth,
        earnedBase: Number(earnedBase.toFixed(2)),
        allowancesTotal: Number(allowancesTotal.toFixed(2)),
        deductionsTotal: Number(deductionsTotal.toFixed(2)),
        netSalary: Number(netSalary.toFixed(2)),
        isPaid: false,
      };
    });

    return { success: true, rows };
  } catch (err: any) {
    console.error('getPayrollSheetData error:', err);
    return { success: false, rows: [], error: err.message };
  }
}

/**
 * Commit payroll payout as an operating expense in the expenses collection.
 * This directly links staff salary payout to the Financial reports!
 */
export async function recordPayrollExpense(params: {
  staffId: string;
  year: number;
  month: number;
  netAmount: number;
  description: string;
}): Promise<{ success: boolean; expenseId?: string; error?: string }> {
  try {
    const session = await getSession();
    const cookieStore = await cookies();
    const currentUserId = session?.userId || session?.username || cookieStore.get('auth_username')?.value || 'admin';

    const expenseId = `exp_sal_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const pad = (n: number) => String(n).padStart(2, '0');
    const today = new Date().toISOString().split('T')[0];

    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      const company = await getAuthorizedCompanyContext();

      await pool.query(
        `INSERT INTO expenses (
          id, company_id, branch_id, expense_date, category, description, amount,
          payment_method, recorded_by_user_id, approved_by_user_id, status, created_at
        ) VALUES (?, ?, NULL, ?, 'Salary', ?, ?, 'Bank Transfer', ?, ?, 'Approved', NOW())`,
        [
          expenseId,
          company.id,
          today,
          params.description || `Salary Payout for ${params.month}/${params.year}`,
          Number(params.netAmount) || 0,
          currentUserId,
          currentUserId,
        ]
      );

      await recordAuditLog({
        companyId: company.id,
        userId: currentUserId,
        action: 'PAYROLL_SALARY_RECORDED',
        entityType: 'EXPENSE',
        entityId: expenseId,
        details: { staffId: params.staffId, month: params.month, year: params.year, amount: params.netAmount },
      });

      return { success: true, expenseId };
    }

    // Live MongoDB Mode
    const db = await getDb();
    const companyId = cookieStore.get('auth_company_id')?.value || 'comp_default';

    await db.collection('expenses').insertOne({
      id: expenseId,
      companyId,
      expenseDate: today,
      category: 'Salary',
      description: params.description || `Salary Payout for ${params.month}/${params.year}`,
      amount: Number(params.netAmount) || 0,
      paymentMethod: 'Bank Transfer',
      recordedByUserId: currentUserId,
      approvedByUserId: currentUserId,
      status: 'Approved',
      createdAt: new Date(),
    });

    return { success: true, expenseId };
  } catch (err: any) {
    console.error('recordPayrollExpense error:', err);
    return { success: false, error: err.message || 'Failed to record payroll expense.' };
  }
}

/**
 * Fetch available Waiters for the company strictly filtered by role = 'Waiter'
 * Excludes Cashiers, Managers, Owners, Super Admins, and Company Admins.
 */
export async function getCompanyWaiters(targetCompanyId?: string): Promise<{
  success: boolean;
  waiters: Array<{
    id: string;
    userId?: string | null;
    name: string;
    username?: string | null;
    phone?: string | null;
    activeOrdersCount: number;
  }>;
  error?: string;
}> {
  try {
    if (isLocalMySqlMode()) {
      await ensureLocalMySqlInitialized();
      const pool = getMysqlPool();
      let companyId = targetCompanyId;
      if (!companyId) {
        try {
          const company = await getAuthorizedCompanyContext();
          companyId = company.id;
        } catch {
          const cookieStore = await cookies();
          companyId = cookieStore.get('auth_company_id')?.value;
        }
      }

      if (!companyId) {
        return { success: true, waiters: [] };
      }

      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT s.id, s.name, s.username, s.phone, s.user_id,
                (SELECT COUNT(*) FROM dine_in_orders d 
                 WHERE d.company_id = s.company_id 
                   AND d.waiter_id = s.id 
                   AND d.serving_status NOT IN ('Served', 'Completed', 'Cancelled')) as active_orders_count
         FROM staff s
         WHERE s.company_id = ? 
           AND LOWER(TRIM(s.role)) = 'waiter' 
           AND s.is_active = 1
         ORDER BY s.name ASC`,
        [companyId]
      );

      return {
        success: true,
        waiters: rows.map((r: any) => ({
          id: r.id,
          userId: r.user_id || null,
          name: r.name,
          username: r.username || null,
          phone: r.phone || null,
          activeOrdersCount: Number(r.active_orders_count) || 0,
        })),
      };
    }

    // Live MongoDB Mode fallback
    const db = await getDb();
    const cookieStore = await cookies();
    const companyId = targetCompanyId || cookieStore.get('auth_company_id')?.value;
    if (!companyId) return { success: true, waiters: [] };

    const records = await db.collection('staff').find({
      companyId,
      role: { $regex: /^waiter$/i },
      isActive: { $ne: false },
    }).sort({ name: 1 }).toArray();

    return {
      success: true,
      waiters: records.map((r: any) => ({
        id: r.id || r._id.toString(),
        userId: r.userId || null,
        name: r.name,
        username: r.username || null,
        phone: r.phone || null,
        activeOrdersCount: 0,
      })),
    };
  } catch (err: any) {
    console.error('getCompanyWaiters error:', err);
    return { success: false, waiters: [], error: err.message || 'Failed to fetch waiters' };
  }
}
