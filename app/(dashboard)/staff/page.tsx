'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Check,
  X,
  Plus,
  Trash2,
  DollarSign,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  FileText,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import {
  getStaffList,
  updateStaffSalary,
  createStaffMember,
  deleteStaffMember,
  getStaffAttendanceToday,
  markStaffAttendance,
  markAllStaffPresent,
  getMonthSheetData,
  fillMonthPresent,
  setMonthSundaysWeekOff,
  clearMonthAttendance,
  getStaffAttendanceReportData,
  getPayrollSheetData,
  recordPayrollExpense,
} from '@/lib/actions/staff';
import { clockInStaff, clockOutStaff } from '@/lib/actions/attendance';
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

type ActiveTab = 'today' | 'month' | 'report' | 'salaries' | 'payroll';

export default function StaffPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Today Tab State
  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [todayItems, setTodayItems] = useState<TodayAttendanceItem[]>([]);

  // Month Sheet State
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth() + 1);
  const [monthRows, setMonthRows] = useState<MonthSheetEmployeeRow[]>([]);
  const [daysInMonth, setDaysInMonth] = useState(31);

  // Report Tab State
  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportRows, setReportRows] = useState<AttendanceReportRow[]>([]);

  // Salaries Tab State
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [salaryPayType, setSalaryPayType] = useState<'Monthly' | 'Daily' | 'Hourly'>('Monthly');
  const [salaryBaseAmount, setSalaryBaseAmount] = useState<number>(0);
  const [salaryAllowances, setSalaryAllowances] = useState<StaffAllowance[]>([]);
  const [salaryDeductions, setSalaryDeductions] = useState<StaffDeduction[]>([]);
  const [salaryIncludeInPayroll, setSalaryIncludeInPayroll] = useState<boolean>(true);

  // Payroll Tab State
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);

  // Add Staff Modal State
  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('Cashier');
  const [newStaffUsername, setNewStaffUsername] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('waiter123');
  const [newStaffPhone, setNewStaffPhone] = useState('');
  const [newStaffPayType, setNewStaffPayType] = useState<'Monthly' | 'Daily' | 'Hourly'>('Monthly');
  const [newStaffBaseAmount, setNewStaffBaseAmount] = useState<number>(15000);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleCreateStaff = async () => {
    if (!newStaffName.trim()) {
      showFeedback('error', 'Staff member name is required.');
      return;
    }
    setLoading(true);
    const res = await createStaffMember({
      name: newStaffName,
      role: newStaffRole,
      username: newStaffUsername.trim() || undefined,
      password: newStaffPassword.trim() || undefined,
      phone: newStaffPhone,
      payType: newStaffPayType,
      baseAmount: newStaffBaseAmount,
    });
    if (res.success) {
      showFeedback('success', `Staff member ${newStaffName} created successfully.`);
      setIsAddStaffOpen(false);
      setNewStaffName('');
      setNewStaffUsername('');
      setNewStaffPassword('waiter123');
      setNewStaffPhone('');
      setNewStaffBaseAmount(15000);
      loadSalariesData();
      loadTodayData();
    } else {
      showFeedback('error', res.error || 'Failed to create staff member.');
    }
    setLoading(false);
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (!window.confirm(`Are you sure you want to delete ${staff.name}?`)) return;
    setLoading(true);
    const res = await deleteStaffMember(staff.id);
    if (res.success) {
      showFeedback('success', `Staff member ${staff.name} deleted.`);
      loadSalariesData();
      loadTodayData();
    } else {
      showFeedback('error', res.error || 'Failed to delete staff member.');
    }
    setLoading(false);
  };

  // Load Today attendance
  const loadTodayData = async (dateStr = todayDate) => {
    setLoading(true);
    const res = await getStaffAttendanceToday(dateStr);
    if (res.success) setTodayItems(res.items);
    else showFeedback('error', res.error || 'Failed to load today attendance');
    setLoading(false);
  };

  // Load Month Sheet
  const loadMonthData = async (year = selectedYear, month = selectedMonth) => {
    setLoading(true);
    const res = await getMonthSheetData({ year, month });
    if (res.success) {
      setMonthRows(res.rows);
      setDaysInMonth(res.daysInMonth);
    } else {
      showFeedback('error', res.error || 'Failed to load month sheet');
    }
    setLoading(false);
  };

  // Load Report Data
  const loadReportData = async (start = reportStartDate, end = reportEndDate) => {
    setLoading(true);
    const res = await getStaffAttendanceReportData({ startDate: start, endDate: end });
    if (res.success) setReportRows(res.rows);
    else showFeedback('error', res.error || 'Failed to load attendance report');
    setLoading(false);
  };

  // Load Staff for Salaries
  const loadSalariesData = async () => {
    setLoading(true);
    const res = await getStaffList();
    if (res.success) setStaffList(res.staff);
    else showFeedback('error', res.error || 'Failed to load staff list');
    setLoading(false);
  };

  // Load Payroll Data
  const loadPayrollData = async (year = selectedYear, month = selectedMonth) => {
    setLoading(true);
    const res = await getPayrollSheetData(year, month);
    if (res.success) setPayrollRows(res.rows);
    else showFeedback('error', res.error || 'Failed to load payroll');
    setLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'today') loadTodayData();
    else if (activeTab === 'month') loadMonthData();
    else if (activeTab === 'report') loadReportData();
    else if (activeTab === 'salaries') loadSalariesData();
    else if (activeTab === 'payroll') loadPayrollData();
  }, [activeTab]);

  // Mark attendance button handler
  const handleMark = async (staffId: string, markCode: MarkCode) => {
    const res = await markStaffAttendance({ staffId, dateStr: todayDate, markCode });
    if (res.success) {
      loadTodayData(todayDate);
    } else {
      showFeedback('error', res.error || 'Failed to mark attendance');
    }
  };

  const handleMarkAllPresent = async () => {
    setLoading(true);
    const res = await markAllStaffPresent(todayDate);
    if (res.success) {
      showFeedback('success', `Marked ${res.count} staff members Present.`);
      loadTodayData(todayDate);
    } else {
      showFeedback('error', res.error || 'Failed to mark all present.');
    }
    setLoading(false);
  };

  // Open Edit Salary Modal
  const openEditSalary = (staff: StaffMember) => {
    setEditingStaff(staff);
    setSalaryPayType(staff.payType || 'Monthly');
    setSalaryBaseAmount(staff.baseAmount || 0);
    setSalaryAllowances(staff.allowances ? [...staff.allowances] : []);
    setSalaryDeductions(staff.deductions ? [...staff.deductions] : []);
    setSalaryIncludeInPayroll(staff.includeInPayroll !== false);
  };

  const saveSalary = async () => {
    if (!editingStaff) return;
    setLoading(true);
    const res = await updateStaffSalary({
      staffId: editingStaff.id,
      payType: salaryPayType,
      baseAmount: salaryBaseAmount,
      allowances: salaryAllowances,
      deductions: salaryDeductions,
      includeInPayroll: salaryIncludeInPayroll,
    });
    if (res.success) {
      showFeedback('success', `Salary updated for ${editingStaff.name}`);
      setEditingStaff(null);
      loadSalariesData();
    } else {
      showFeedback('error', res.error || 'Failed to update salary');
    }
    setLoading(false);
  };

  // Record Payroll Expense
  const handlePaySalary = async (row: PayrollRow) => {
    if (row.netSalary <= 0) {
      showFeedback('error', 'Net salary amount must be greater than zero.');
      return;
    }
    setLoading(true);
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const desc = `Salary payout for ${row.name} (${monthNames[selectedMonth]} ${selectedYear}) - ${row.paidDays} paid days`;
    const res = await recordPayrollExpense({
      staffId: row.staffId,
      year: selectedYear,
      month: selectedMonth,
      netAmount: row.netSalary,
      description: desc,
    });
    if (res.success) {
      showFeedback('success', `Recorded ₹${row.netSalary.toFixed(2)} salary expense in Financial reports!`);
      loadPayrollData();
    } else {
      showFeedback('error', res.error || 'Failed to record payroll expense');
    }
    setLoading(false);
  };

  // Check if a day is Sunday
  const isSunday = (day: number) => {
    const d = new Date(selectedYear, selectedMonth - 1, day);
    return d.getDay() === 0;
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-medium transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-600 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Header with Title and Pills (Image 2 style) */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-black tracking-tight text-white">Staff</h1>
          <span className="text-sm font-medium text-zinc-400">Attendance and payroll</span>
        </div>

        {/* Tab Pills */}
        <div className="flex items-center gap-1.5 ml-auto bg-zinc-900/80 p-1 rounded-2xl border border-zinc-800">
          {(['today', 'month', 'report', 'salaries', 'payroll'] as ActiveTab[]).map((tab) => {
            const labels: Record<ActiveTab, string> = {
              today: 'Today',
              month: 'Month sheet',
              report: 'Report',
              salaries: 'Salaries',
              payroll: 'Payroll',
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-zinc-800 text-white shadow-sm font-bold border border-zinc-700'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setIsAddStaffOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Staff</span>
        </button>
      </div>

      {/* TAB 1: TODAY (Matching Image 2) */}
      {activeTab === 'today' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
            {/* Date input */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={todayDate}
                  onChange={(e) => {
                    setTodayDate(e.target.value);
                    loadTodayData(e.target.value);
                  }}
                  className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setLoading(true);
                  const res = await clockInStaff();
                  if (res.success) {
                    showFeedback('success', 'Clocked in successfully!');
                    loadTodayData(todayDate);
                  } else {
                    showFeedback('error', res.error || 'Failed to clock in');
                  }
                  setLoading(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
              >
                Clock In
              </button>
              <button
                onClick={async () => {
                  setLoading(true);
                  const res = await clockOutStaff();
                  if (res.success) {
                    showFeedback('success', 'Clocked out successfully!');
                    loadTodayData(todayDate);
                  } else {
                    showFeedback('error', res.error || 'Failed to clock out');
                  }
                  setLoading(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-all cursor-pointer"
              >
                Clock Out
              </button>
              <button
                onClick={handleMarkAllPresent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
              >
                Mark all present
              </button>
            </div>
          </div>

          {/* Today Table */}
          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Clock in/out</th>
                    <th className="py-3 px-5">Worked</th>
                    <th className="py-3 px-5 text-center">Mark</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {todayItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-400">
                        {loading ? 'Loading attendance records...' : 'No staff members registered for this company.'}
                      </td>
                    </tr>
                  ) : (
                    todayItems.map((item) => (
                      <tr key={item.staffId} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="py-3.5 px-5 font-semibold text-white">
                          {item.name}
                        </td>
                        <td className="py-3.5 px-5">
                          {item.status !== '-' ? (
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                item.status === 'Present'
                                  ? 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-400'
                                  : item.status === 'Absent'
                                  ? 'bg-rose-950/60 border border-rose-500/30 text-rose-400'
                                  : item.status === 'Half Day'
                                  ? 'bg-amber-950/60 border border-amber-500/30 text-amber-400'
                                  : 'bg-zinc-800 border border-zinc-700 text-zinc-300'
                              }`}
                            >
                              {item.status}
                            </span>
                          ) : (
                            <span className="text-zinc-500">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-zinc-400">
                          {item.clockIn ? `${item.clockIn} - ${item.clockOut || 'Active'}` : '— —'}
                        </td>
                        <td className="py-3.5 px-5 text-zinc-400 font-mono">
                          {item.workedHours ? `${item.workedHours}h` : '—'}
                        </td>
                        <td className="py-3.5 px-5">
                          {/* Mark code buttons: P, A, L, ½, H, W, X */}
                          <div className="flex items-center justify-center gap-1.5">
                            {(['P', 'A', 'L', '½', 'H', 'W', 'X'] as MarkCode[]).map((code) => {
                              const isSelected = item.markCode === code;
                              return (
                                <button
                                  key={code}
                                  onClick={() => handleMark(item.staffId, code)}
                                  className={`w-7 h-7 rounded-lg border text-xs font-bold transition-all flex items-center justify-center cursor-pointer ${
                                    isSelected
                                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                                      : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white hover:bg-zinc-800'
                                  }`}
                                >
                                  {code}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTH SHEET (Matching Image 4) */}
      {activeTab === 'month' && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
            {/* Month & Year selector */}
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const m = parseInt(e.target.value, 10);
                  setSelectedMonth(m);
                  loadMonthData(selectedYear, m);
                }}
                className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                  const monthName = new Date(2026, m - 1).toLocaleString('default', { month: 'long' });
                  return (
                    <option key={m} value={m}>
                      {monthName} {selectedYear}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  setLoading(true);
                  await fillMonthPresent(selectedYear, selectedMonth);
                  showFeedback('success', 'Filled working days with Present');
                  loadMonthData(selectedYear, selectedMonth);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer transition-colors"
              >
                Fill present
              </button>
              <button
                onClick={async () => {
                  setLoading(true);
                  await setMonthSundaysWeekOff(selectedYear, selectedMonth);
                  showFeedback('success', 'Marked all Sundays as Week Off (W)');
                  loadMonthData(selectedYear, selectedMonth);
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer transition-colors"
              >
                Sundays = week off
              </button>
              <button
                onClick={async () => {
                  if (confirm('Are you sure you want to clear all attendance marks for this month?')) {
                    setLoading(true);
                    await clearMonthAttendance(selectedYear, selectedMonth);
                    showFeedback('success', 'Cleared month attendance');
                    loadMonthData(selectedYear, selectedMonth);
                  }
                }}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-950/40 cursor-pointer transition-colors"
              >
                Clear month
              </button>
            </div>
          </div>

          {/* Month Sheet Grid Table */}
          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-bold text-zinc-400">
                    <th className="py-3 px-4 min-w-[160px] sticky left-0 bg-zinc-950 z-10 border-r border-zinc-800">Employee</th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                      const sunday = isSunday(day);
                      return (
                        <th
                          key={day}
                          className={`py-3 px-1 text-center font-mono ${
                            sunday ? 'text-emerald-400 bg-emerald-950/20' : 'text-zinc-400'
                          }`}
                        >
                          {day}
                        </th>
                      );
                    })}
                    <th className="py-3 px-4 text-center font-bold">Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {monthRows.map((row) => (
                    <tr key={row.staffId} className="hover:bg-zinc-800/30">
                      <td className="py-3 px-4 font-semibold text-white sticky left-0 bg-zinc-900 z-10 border-r border-zinc-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                        {row.name}
                      </td>
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                        const sunday = isSunday(day);
                        const mark = row.days[day];
                        const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        return (
                          <td
                            key={day}
                            onClick={async () => {
                              // Cycle: empty -> P -> ½ -> W -> A -> empty
                              const cycle: Record<string, MarkCode> = {
                                '': 'P',
                                P: '½',
                                '½': 'W',
                                W: 'A',
                                A: 'X',
                              };
                              const nextCode = cycle[mark || ''] || 'P';
                              await markStaffAttendance({ staffId: row.staffId, dateStr, markCode: nextCode });
                              loadMonthData(selectedYear, selectedMonth);
                            }}
                            className={`p-1 text-center cursor-pointer select-none transition-colors ${
                              sunday ? 'bg-emerald-950/10' : ''
                            }`}
                          >
                            <div
                              className={`w-6 h-6 mx-auto rounded flex items-center justify-center text-[10px] font-bold border ${
                                mark === 'P'
                                  ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                                  : mark === 'W'
                                  ? 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                  : mark === '½'
                                  ? 'bg-amber-950 border-amber-700 text-amber-300'
                                  : mark === 'A'
                                  ? 'bg-rose-950 border-rose-700 text-rose-300'
                                  : 'border-zinc-800 hover:border-zinc-600 bg-zinc-950/60 text-zinc-500'
                              }`}
                            >
                              {mark || ''}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-center font-bold text-white font-mono">
                        {row.paidDays}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: REPORT (Matching Image 5) */}
      {activeTab === 'report' && (
        <div className="space-y-4">
          {/* Date Range Controls */}
          <div className="flex flex-wrap items-center gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <input
                type="date"
                value={reportStartDate}
                onChange={(e) => {
                  setReportStartDate(e.target.value);
                  loadReportData(e.target.value, reportEndDate);
                }}
                className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
              />
              <span className="font-semibold text-zinc-400">to</span>
              <input
                type="date"
                value={reportEndDate}
                onChange={(e) => {
                  setReportEndDate(e.target.value);
                  loadReportData(reportStartDate, e.target.value);
                }}
                className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
              />
            </div>
          </div>

          {/* Report Table */}
          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5 text-center text-emerald-400">Present</th>
                    <th className="py-3 px-5 text-center text-amber-400">Half</th>
                    <th className="py-3 px-5 text-center text-indigo-400">Leave</th>
                    <th className="py-3 px-5 text-center text-rose-400">Absent</th>
                    <th className="py-3 px-5 text-right">Worked</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {reportRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-zinc-400">
                        No report records found for this period.
                      </td>
                    </tr>
                  ) : (
                    reportRows.map((r) => (
                      <tr key={r.staffId} className="hover:bg-zinc-800/30">
                        <td className="py-3.5 px-5 font-semibold text-white">
                          {r.name}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-emerald-400">
                          {r.present}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-amber-400">
                          {r.half}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-indigo-400">
                          {r.leave}
                        </td>
                        <td className="py-3.5 px-5 text-center font-mono font-bold text-rose-400">
                          {r.absent}
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono text-zinc-400">
                          {r.workedHours > 0 ? `${r.workedHours}h` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SALARIES (Matching Image 3) */}
      {activeTab === 'salaries' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
            <div>
              <h3 className="text-xs font-bold text-white">Staff Directory & Salaries</h3>
              <p className="text-[11px] text-zinc-400">Configure base compensation and pay types for your company staff</p>
            </div>
            <button
              onClick={() => setIsAddStaffOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Staff Member</span>
            </button>
          </div>

          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5">Role</th>
                    <th className="py-3 px-5">Pay type</th>
                    <th className="py-3 px-5">Base</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {staffList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-xs text-zinc-400">
                        No staff members registered for this company yet. Click &quot;Add Staff Member&quot; to register your team.
                      </td>
                    </tr>
                  ) : (
                    staffList.map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-800/30">
                        <td className="py-3.5 px-5 font-semibold text-white">
                          {s.name}
                        </td>
                        <td className="py-3.5 px-5 text-zinc-400">
                          {s.role}
                        </td>
                        <td className="py-3.5 px-5 text-zinc-400">
                          {s.baseAmount > 0 ? s.payType : 'Not Set'}
                        </td>
                        <td className="py-3.5 px-5 font-mono text-zinc-200">
                          {s.baseAmount > 0 ? `₹${s.baseAmount.toLocaleString('en-IN')}` : '—'}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditSalary(s)}
                              className="px-3 py-1 rounded-xl text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 cursor-pointer transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteStaff(s)}
                              className="p-1 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Delete Staff Member"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: PAYROLL (Calculated Payouts with Financial integration) */}
      {activeTab === 'payroll' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
            <div className="text-xs font-semibold text-zinc-300">
              Monthly Payroll Calculations for {new Date(selectedYear, selectedMonth - 1).toLocaleString('default', { month: 'long' })} {selectedYear}
            </div>
            <div className="text-xs text-zinc-400 font-mono">
              Total Payroll: ₹{payrollRows.reduce((acc, r) => acc + r.netSalary, 0).toLocaleString('en-IN')}
            </div>
          </div>

          <div className="bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                    <th className="py-3 px-5">Employee</th>
                    <th className="py-3 px-5 text-center">Paid Days</th>
                    <th className="py-3 px-5 text-right">Base Salary</th>
                    <th className="py-3 px-5 text-right">Earned Base</th>
                    <th className="py-3 px-5 text-right text-emerald-400">Allowances</th>
                    <th className="py-3 px-5 text-right text-rose-400">Deductions</th>
                    <th className="py-3 px-5 text-right font-bold">Net Payout</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {payrollRows.map((p) => (
                    <tr key={p.staffId} className="hover:bg-zinc-800/30">
                      <td className="py-3.5 px-5 font-semibold text-white">
                        {p.name}
                      </td>
                      <td className="py-3.5 px-5 text-center font-mono text-zinc-400">
                        {p.paidDays} / {p.daysInMonth}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-zinc-400">
                        ₹{p.baseAmount.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-zinc-300">
                        ₹{p.earnedBase.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-emerald-400">
                        +₹{p.allowancesTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono text-rose-400">
                        -₹{p.deductionsTotal.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-right font-mono font-bold text-white">
                        ₹{p.netSalary.toLocaleString('en-IN')}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <button
                          onClick={() => handlePaySalary(p)}
                          className="px-3 py-1 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm cursor-pointer transition-colors"
                        >
                          Record Expense
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* EDIT SALARY MODAL (Matching Image 3) */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-zinc-900 rounded-3xl p-6 shadow-2xl border border-zinc-800 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Title */}
            <h2 className="text-base font-bold text-white mb-4">
              {editingStaff.name} — Salary
            </h2>

            {/* Pay Type & Base Amount */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSalaryPayType('Monthly')}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    salaryPayType === 'Monthly'
                      ? 'bg-zinc-800 border-zinc-600 text-white'
                      : 'border-transparent text-zinc-500'
                  }`}
                >
                  Monthly
                </button>
                <div className="flex-1 relative">
                  <input
                    type="number"
                    placeholder="Base amount"
                    value={salaryBaseAmount || ''}
                    onChange={(e) => setSalaryBaseAmount(Number(e.target.value))}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-xs font-medium text-white outline-none focus:border-theme font-mono"
                  />
                </div>
              </div>

              <p className="text-[11px] text-zinc-400">
                Monthly salary, pro-rated by paid days.
              </p>

              {/* Allowances Section */}
              <div className="pt-2">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-2">
                  <span>Allowances</span>
                  <button
                    type="button"
                    onClick={() => setSalaryAllowances([...salaryAllowances, { name: 'Bonus', amount: 1000 }])}
                    className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                {salaryAllowances.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Allowance name"
                      value={a.name}
                      onChange={(e) => {
                        const copy = [...salaryAllowances];
                        copy[i].name = e.target.value;
                        setSalaryAllowances(copy);
                      }}
                      className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs text-white outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={a.amount || ''}
                      onChange={(e) => {
                        const copy = [...salaryAllowances];
                        copy[i].amount = Number(e.target.value);
                        setSalaryAllowances(copy);
                      }}
                      className="w-24 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs text-white outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setSalaryAllowances(salaryAllowances.filter((_, idx) => idx !== i))}
                      className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Deductions Section */}
              <div className="pt-1">
                <div className="flex items-center justify-between text-xs font-semibold text-zinc-300 mb-2">
                  <span>Deductions</span>
                  <button
                    type="button"
                    onClick={() => setSalaryDeductions([...salaryDeductions, { name: 'PF / Advance', amount: 500 }])}
                    className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                {salaryDeductions.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Deduction name"
                      value={d.name}
                      onChange={(e) => {
                        const copy = [...salaryDeductions];
                        copy[i].name = e.target.value;
                        setSalaryDeductions(copy);
                      }}
                      className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs text-white outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={d.amount || ''}
                      onChange={(e) => {
                        const copy = [...salaryDeductions];
                        copy[i].amount = Number(e.target.value);
                        setSalaryDeductions(copy);
                      }}
                      className="w-24 rounded-lg bg-zinc-950 border border-zinc-800 px-2.5 py-1 text-xs text-white outline-none font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setSalaryDeductions(salaryDeductions.filter((_, idx) => idx !== i))}
                      className="text-rose-400 hover:text-rose-300 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Active Checkbox */}
              <label className="flex items-center gap-2.5 pt-2 text-xs font-semibold text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={salaryIncludeInPayroll}
                  onChange={(e) => setSalaryIncludeInPayroll(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 bg-zinc-950 border-zinc-700"
                />
                <span>Active (include in payroll)</span>
              </label>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveSalary}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL */}
      {isAddStaffOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Add New Staff Member</h3>
              <button onClick={() => setIsAddStaffOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-zinc-400 font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                  className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white outline-none focus:border-theme"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Role</label>
                  <select
                    value={newStaffRole}
                    onChange={(e) => setNewStaffRole(e.target.value)}
                  >
                    <option value="Manager">Manager</option>
                    <option value="Cashier">Cashier</option>
                    <option value="Chef">Chef</option>
                    <option value="Waiter">Waiter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 9876543210"
                    value={newStaffPhone}
                    onChange={(e) => setNewStaffPhone(e.target.value)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white outline-none focus:border-theme"
                  />
                </div>
              </div>

              {newStaffRole === 'Waiter' && (
                <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                  <div className="text-[11px] font-bold text-indigo-300 flex items-center justify-between">
                    <span>Waiter Portal Login Credentials</span>
                    <span className="text-[10px] text-zinc-400 font-normal">Auto-created</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Username</label>
                      <input
                        type="text"
                        placeholder="e.g. waiter_ramesh"
                        value={newStaffUsername}
                        onChange={(e) => setNewStaffUsername(e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-xs text-white outline-none focus:border-theme font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 font-medium mb-0.5">Password</label>
                      <input
                        type="password"
                        placeholder="Default: waiter123"
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-2.5 py-1.5 text-xs text-white outline-none focus:border-theme font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Pay Type</label>
                  <select
                    value={newStaffPayType}
                    onChange={(e) => setNewStaffPayType(e.target.value as any)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white outline-none focus:border-theme cursor-pointer"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Daily">Daily</option>
                    <option value="Hourly">Hourly</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-400 font-medium mb-1">Base Amount (₹)</label>
                  <input
                    type="number"
                    value={newStaffBaseAmount}
                    onChange={(e) => setNewStaffBaseAmount(Number(e.target.value) || 0)}
                    className="w-full rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-2 text-white outline-none focus:border-theme font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                onClick={() => setIsAddStaffOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateStaff}
                disabled={loading}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Staff Member'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
