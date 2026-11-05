export interface StaffAllowance {
  id?: string;
  name: string;
  amount: number;
}

export interface StaffDeduction {
  id?: string;
  name: string;
  amount: number;
}

export type ShiftName = 'Morning' | 'Evening' | 'Night' | 'Custom';
export type ShiftAttendanceStatus = 'Present' | 'Late' | 'Absent' | 'On Leave';
export type ShiftStatus = 'Upcoming' | 'Active' | 'Completed';

export interface StaffShift {
  id: string;
  staffId: string;
  staffName?: string;
  staffRole?: string;
  shiftName: ShiftName;
  customShiftName?: string;
  shiftDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm (24hr e.g. "09:00")
  endTime: string;   // HH:mm (24hr e.g. "17:00")
  breakDuration: number; // in minutes (e.g. 30, 45, 60)
  checkInTime: string | null;  // ISO string or null
  checkOutTime: string | null; // ISO string or null
  clockInTime?: string | null;  // Clock-in ISO string or null
  clockOutTime?: string | null; // Clock-out ISO string or null
  attendanceStatus: ShiftAttendanceStatus;
  shiftStatus: ShiftStatus;
  totalWorkingHours: number; // working hours e.g. 7.5
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftAlert {
  id: string;
  shiftId: string;
  staffId: string;
  staffName: string;
  staffRole: string;
  shiftName: string;
  shiftDate: string;
  startTime: string;
  endTime: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  clockInTime?: string | null;
  clockOutTime?: string | null;
  totalWorkingHours?: number;
  shiftStatus?: ShiftStatus;
  type: 'UPCOMING_SOON' | 'ABOUT_TO_START' | 'LATE_CHECKIN' | 'COMPLETED' | 'ADMIN_NOT_CHECKED_IN' | 'ADMIN_MISSED_SHIFT';
  severity: 'info' | 'warning' | 'danger' | 'success';
  title: string;
  message: string;
  timestamp: string;
  isRead?: boolean;
}

export interface StaffMember {
  id: string;
  companyId: string;
  branchId?: string | null;
  userId?: string | null;
  name: string;
  username?: string | null;
  role: string;
  phone?: string | null;
  payType: 'Monthly' | 'Daily' | 'Hourly';
  baseAmount: number;
  allowances: StaffAllowance[];
  deductions: StaffDeduction[];
  shifts?: StaffShift[];
  includeInPayroll: boolean;
  isActive: boolean;
  createdAt?: string;
}

export type MarkCode = 'P' | 'A' | 'L' | '½' | 'HD' | 'H' | 'W' | 'X';

export interface TodayAttendanceItem {
  staffId: string;
  name: string;
  role: string;
  status: string;
  markCode: string | null;
  clockIn: string | null;
  clockOut: string | null;
  workedHours: number | null;
  notes?: string | null;
}

export interface MonthSheetEmployeeRow {
  staffId: string;
  name: string;
  days: Record<number, string>; // day 1..31 -> markCode e.g. 'P', 'W'
  paidDays: number;
}

export interface AttendanceReportRow {
  staffId: string;
  name: string;
  present: number;
  half: number;
  leave: number;
  absent: number;
  workedHours: number;
}

export interface PayrollRow {
  staffId: string;
  name: string;
  payType: string;
  baseAmount: number;
  paidDays: number;
  daysInMonth: number;
  earnedBase: number;
  allowancesTotal: number;
  deductionsTotal: number;
  netSalary: number;
  isPaid: boolean;
}
