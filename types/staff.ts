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
