'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import {
  BarChart3,
  TrendingUp,
  Receipt,
  Tag,
  Clock,
  Percent,
  Coins,
  DollarSign,
  AlertOctagon,
  CreditCard,
  Users,
  ShieldAlert,
  ShieldCheck,
  Printer,
  RefreshCw,
  Search,
  Building2,
  Info,
  AlertTriangle,
  FileSpreadsheet,
  Layers,
  ArrowRight,
  Plus,
  X,
  CheckCircle2,
  UserCheck,
  Calendar,
  Truck
} from 'lucide-react';
import { getReportData, getReportCompanyOptions, ReportResult, ReportCompanyOption } from '@/lib/actions/reports';
import { clockInStaff, clockOutStaff } from '@/lib/actions/attendance';
import { openShift, closeShift } from '@/lib/actions/shifts';
import { createExpense } from '@/lib/actions/expenses';
import { EXPENSE_CATEGORIES } from '@/types/expenses';

interface ReportItem {
  id: string;
  name: string;
  shortDesc: string;
  icon: React.ElementType;
}

interface MenuCategory {
  id: 'sales' | 'financial' | 'operations' | 'audit';
  name: string;
  desc: string;
  icon: React.ElementType;
  reports: ReportItem[];
}

const MENU_CATEGORIES: MenuCategory[] = [
  {
    id: 'sales',
    name: 'Sales',
    desc: 'Volume, item sales & GST turnover',
    icon: BarChart3,
    reports: [
      { id: 'sales_report', name: 'Sales Report', shortDesc: 'Revenue, payment split & order channels', icon: BarChart3 },
      { id: 'delivery_report', name: 'Delivery & Online Orders Report', shortDesc: 'Delivery volume, platform sales (Zomato/Swiggy), dispatch & rider performance', icon: Truck },
      { id: 'items_report', name: 'Items Report', shortDesc: 'Item-level quantities & revenue velocity', icon: Tag },
      { id: 'categories_report', name: 'Categories Report', shortDesc: 'Category sales volume & revenue share', icon: Layers },
      { id: 'item_trends_report', name: 'Item Trends Report', shortDesc: 'Daily product trajectory over time', icon: TrendingUp },
      { id: 'busy_times_report', name: 'Busy Times Report', shortDesc: 'Hourly rush curves & peak ordering times', icon: Clock },
      { id: 'taxes_gst_report', name: 'Taxes (GST) Report', shortDesc: 'Taxable turnover, CGST, SGST & tax slabs', icon: Percent },
    ],
  },
  {
    id: 'financial',
    name: 'Financial',
    desc: 'Register reconciliation, expenses & profit',
    icon: Coins,
    reports: [
      { id: 'day_end_z_report', name: 'Day-end (Z) Report', shortDesc: 'Cash drawer closing, daily intake & tally', icon: Receipt },
      { id: 'expenses_profit_report', name: 'Expenses & Profit Report', shortDesc: 'Revenue vs COGS & operating expenses', icon: DollarSign },
      { id: 'salaries_report', name: 'Salaries Report', shortDesc: 'Staff payroll, compensation & salary structures', icon: DollarSign },
      { id: 'discounts_report', name: 'Discounts Report', shortDesc: 'Discounts granted by bill & cashier', icon: Percent },
      { id: 'refunds_report', name: 'Refunds Report', shortDesc: 'Customer refunds & return slips ledger', icon: AlertOctagon },
      { id: 'cancellations_report', name: 'Cancellations Report', shortDesc: 'Voided orders & lost invoice value', icon: AlertTriangle },
      { id: 'outstanding_report', name: 'Outstanding Report', shortDesc: 'Unsettled credit / Bill Only balances', icon: CreditCard },
    ],
  },
  {
    id: 'operations',
    name: 'Operations',
    desc: 'Staff sessions, attendance & shifts',
    icon: Users,
    reports: [
      { id: 'staff_report', name: 'Staff Report', shortDesc: 'Cashier performance, sales & ticket sizes', icon: Users },
      { id: 'attendance_report', name: 'Attendance Report', shortDesc: 'Clock-in/out records, working hours & status', icon: UserCheck },
      { id: 'shifts_report', name: 'Shifts Report', shortDesc: 'Cashier shifts, expected vs counted cash', icon: Clock },
      { id: 'guests_report', name: 'Guests Report', shortDesc: 'Customer visit frequency & lifetime spend', icon: Users },
    ],
  },
  {
    id: 'audit',
    name: 'Audit',
    desc: 'System event trails & security',
    icon: ShieldAlert,
    reports: [
      { id: 'audit_log_report', name: 'Audit Log', shortDesc: 'Security audit trail & terminal overrides', icon: ShieldAlert },
    ],
  },
];

export default function ReportsPage() {
  // Navigation State
  const [activeCategory, setActiveCategory] = useState<'sales' | 'financial' | 'operations' | 'audit'>('sales');
  const [selectedReportId, setSelectedReportId] = useState<string>('sales_report');

  // Filter State
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [companies, setCompanies] = useState<ReportCompanyOption[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Data & Async State
  const [reportData, setReportData] = useState<ReportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  // Modals for Actions
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Modal Inputs
  const [attNotes, setAttNotes] = useState('');
  const [attStaffUser, setAttStaffUser] = useState('');
  const [shiftAction, setShiftAction] = useState<'open' | 'close'>('open');
  const [shiftOpeningCash, setShiftOpeningCash] = useState('500');
  const [shiftCountedCash, setShiftCountedCash] = useState('500');
  const [shiftCloseId, setShiftCloseId] = useState('');
  const [shiftNotes, setShiftNotes] = useState('');
  const [expCategory, setExpCategory] = useState<any>('Rent');
  const [expAmount, setExpAmount] = useState('');
  const [expDesc, setExpDesc] = useState('');
  const [expMethod, setExpMethod] = useState('Cash');

  // Load Companies for Super Admin selector
  useEffect(() => {
    getReportCompanyOptions()
      .then((comps) => setCompanies(comps || []))
      .catch(() => {});

    const today = new Date().toISOString().split('T')[0];
    setCustomStart(today);
    setCustomEnd(today);
  }, []);

  // Fetch report data
  const fetchReport = () => {
    setErrorMsg(null);
    startTransition(async () => {
      try {
        const res = await getReportData({
          reportKey: selectedReportId,
          preset,
          customStart,
          customEnd,
          targetCompanyId: selectedCompanyId,
        });
        setReportData(res);
      } catch (err: any) {
        setErrorMsg(err.message || 'Failed to generate report data.');
        setReportData(null);
      }
    });
  };

  useEffect(() => {
    fetchReport();
  }, [selectedReportId, preset, selectedCompanyId]);

  const handleSelectCategory = (catId: 'sales' | 'financial' | 'operations' | 'audit') => {
    setActiveCategory(catId);
    const cat = MENU_CATEGORIES.find((c) => c.id === catId);
    if (cat && cat.reports.length > 0) {
      setSelectedReportId(cat.reports[0].id);
    }
  };

  const currentCategory = useMemo(() => MENU_CATEGORIES.find((c) => c.id === activeCategory)!, [activeCategory]);
  const currentReport = useMemo(() => {
    for (const cat of MENU_CATEGORIES) {
      const found = cat.reports.find((r) => r.id === selectedReportId);
      if (found) return found;
    }
    return MENU_CATEGORIES[0].reports[0];
  }, [selectedReportId]);

  const filteredTableData = useMemo(() => {
    if (!reportData || !reportData.tableData) return [];
    if (!searchQuery.trim()) return reportData.tableData;

    const q = searchQuery.toLowerCase();
    return reportData.tableData.filter((row) =>
      Object.values(row).some((val) => String(val).toLowerCase().includes(q))
    );
  }, [reportData, searchQuery]);

  const handleExportCsv = () => {
    if (!reportData || !reportData.tableData || reportData.tableData.length === 0) {
      alert('No data available to export.');
      return;
    }

    const headers = reportData.columns.map((col) => `"${col.label.replace(/"/g, '""')}"`).join(',');
    const rows = filteredTableData.map((row) =>
      reportData.columns
        .map((col) => {
          let val = row[col.key];
          if (val === undefined || val === null) val = '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',')
    );

    const csvContent = [headers, ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedReportId}_${preset}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  // Action: Clock In
  const handleClockIn = async () => {
    const res = await clockInStaff(attStaffUser || undefined, attNotes);
    if (!res.success) {
      setErrorMsg(res.error || 'Clock-in failed');
    } else {
      setActionSuccessMsg('Staff member successfully clocked in!');
      setIsAttendanceModalOpen(false);
      setAttNotes('');
      fetchReport();
    }
  };

  // Action: Clock Out
  const handleClockOut = async () => {
    const res = await clockOutStaff(attStaffUser || undefined, attNotes);
    if (!res.success) {
      setErrorMsg(res.error || 'Clock-out failed');
    } else {
      setActionSuccessMsg(`Staff member successfully clocked out! Hours logged: ${res.record?.workingHours || 0} hrs`);
      setIsAttendanceModalOpen(false);
      setAttNotes('');
      fetchReport();
    }
  };

  // Action: Open Shift
  const handleOpenShift = async () => {
    const res = await openShift({ openingCash: Number(shiftOpeningCash) || 0, notes: shiftNotes });
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to open shift');
    } else {
      setActionSuccessMsg(`Shift opened successfully! ID: ${res.shift?.id}`);
      setIsShiftModalOpen(false);
      setShiftNotes('');
      fetchReport();
    }
  };

  // Action: Close Shift
  const handleCloseShift = async () => {
    if (!shiftCloseId.trim()) {
      setErrorMsg('Please specify Shift ID to close (e.g. from the Shifts list).');
      return;
    }
    const res = await closeShift({ shiftId: shiftCloseId.trim(), countedCash: Number(shiftCountedCash) || 0, closingNotes: shiftNotes });
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to close shift');
    } else {
      setActionSuccessMsg(`Shift closed! Expected: ₹${res.shift?.expectedClosingCash} | Counted: ₹${res.shift?.countedClosingCash} | Variance: ₹${res.shift?.closingDifference}`);
      setIsShiftModalOpen(false);
      setShiftCloseId('');
      fetchReport();
    }
  };

  // Action: Add Expense
  const handleAddExpense = async () => {
    if (!expAmount || Number(expAmount) <= 0) {
      setErrorMsg('Please enter a valid expense amount.');
      return;
    }
    if (!expDesc.trim()) {
      setErrorMsg('Please enter a description for this expense.');
      return;
    }
    const res = await createExpense({
      expenseDate: new Date().toISOString().split('T')[0],
      category: expCategory,
      description: expDesc,
      amount: Number(expAmount),
      paymentMethod: expMethod,
    });
    if (!res.success) {
      setErrorMsg(res.error || 'Failed to record expense');
    } else {
      setActionSuccessMsg(`Expense recorded: ₹${expAmount} under ${expCategory}`);
      setIsExpenseModalOpen(false);
      setExpAmount('');
      setExpDesc('');
      fetchReport();
    }
  };

  return (
    <div className="space-y-6 text-white pb-12 print:text-black print:bg-white print:p-0">
      {/* ------------------------------------------------------------------ */}
      {/* 1. TOP HEADER & CATEGORY MENUS BAR                                 */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl relative overflow-hidden print:hidden">
        <div className="absolute right-0 top-0 -mt-12 -mr-12 h-64 w-64 rounded-full bg-pink-600/10 blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full theme-badge text-[11px] font-bold tracking-wider uppercase">
                <BarChart3 className="h-3 w-3" />
                Reports & Business Intelligence
              </span>
              <span className="text-xs text-zinc-500 font-medium">|</span>
              <span className="text-xs text-zinc-300 font-bold flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5 text-theme-accent" />
                {reportData?.companyName || 'Loading company...'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              <span>{currentReport.name}</span>
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400 font-medium mt-1">
              {currentReport.shortDesc}
            </p>
          </div>

          {/* Quick Operational Actions & Export Bar */}
          <div className="flex items-center gap-2 self-start lg:self-auto flex-wrap">
            {/* Contextual Action Buttons */}
            <button
              onClick={() => setIsAttendanceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 text-xs font-bold text-zinc-200 transition cursor-pointer hover:bg-zinc-800"
              title="Staff Clock In or Clock Out"
            >
              <UserCheck className="h-3.5 w-3.5 text-pink-400" />
              <span>Clock In / Out</span>
            </button>
            <button
              onClick={() => setIsShiftModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 text-xs font-bold text-zinc-200 transition cursor-pointer hover:bg-zinc-800"
              title="Open or Close Register Shift"
            >
              <Clock className="h-3.5 w-3.5 text-pink-400" />
              <span>Open / Close Shift</span>
            </button>
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 text-xs font-bold text-zinc-200 transition cursor-pointer hover:bg-zinc-800"
              title="Record Store Operating Expense"
            >
              <Plus className="h-3.5 w-3.5 text-pink-400" />
              <span>Add Expense</span>
            </button>
            <button
              onClick={fetchReport}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-bold text-zinc-200 transition cursor-pointer hover:bg-zinc-800 disabled:opacity-50"
              title="Refresh Report Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isPending ? 'animate-spin text-pink-400' : 'text-zinc-400'}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-pink-500/40 text-xs font-bold text-zinc-200 transition cursor-pointer hover:bg-zinc-800"
              title="Download CSV"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-pink-400" />
              <span>CSV</span>
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white transition shadow-lg shadow-pink-900/40 cursor-pointer"
              title="Print Report or Save as PDF"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* 4 CATEGORY HEADER MENUS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-4 border-t border-zinc-800/80">
          {MENU_CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => handleSelectCategory(cat.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-theme-bar border-theme text-white shadow-lg shadow-theme-glow'
                    : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200 hover:border-zinc-700'
                }`}
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    isActive
                      ? 'theme-icon-box text-theme-accent'
                      : 'bg-zinc-800/80 border-zinc-700 text-zinc-400'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider">{cat.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400 font-bold">
                      {cat.reports.length}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-500 truncate font-medium mt-0.5">{cat.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* SUB-MENU PILLS */}
        <div className="mt-4 pt-3 border-t border-zinc-800/40 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
            <span>{currentCategory.name} Reports:</span>
            <ArrowRight className="h-3 w-3 text-pink-400" />
          </span>
          {currentCategory.reports.map((rep) => {
            const isSelected = selectedReportId === rep.id;
            const RepIcon = rep.icon;
            return (
              <button
                key={rep.id}
                onClick={() => setSelectedReportId(rep.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                  isSelected
                    ? 'bg-pink-600 text-white border-pink-500 shadow-md shadow-pink-900/50'
                    : 'bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700'
                }`}
              >
                <RepIcon className={`h-3.5 w-3.5 ${isSelected ? 'text-white' : 'text-pink-400'}`} />
                <span>{rep.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 2. GLOBAL FILTERS TOOLBAR                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        {/* Date Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['today', 'yesterday', 'week', 'month', 'custom'] as const).map((p) => {
            const isSelected = preset === p;
            const labels = {
              today: 'Today',
              yesterday: 'Yesterday',
              week: 'This Week',
              month: 'This Month',
              custom: 'Custom Range',
            };
            return (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  isSelected
                    ? 'bg-zinc-100 text-zinc-950 border-white shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* Custom Range Picker */}
        {preset === 'custom' && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">From</span>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1">
              <span className="text-[10px] text-zinc-500 uppercase font-bold">To</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-transparent text-xs text-zinc-200 outline-none cursor-pointer"
              />
            </div>
            <button
              onClick={fetchReport}
              className="px-3 py-1 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition cursor-pointer"
            >
              Apply
            </button>
          </div>
        )}

        {/* Company Filter (Rendered ONLY if Super Admin with multiple companies) & Search */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {reportData?.isSuperAdmin && companies.length > 1 && (
            <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5">
              <Building2 className="h-3.5 w-3.5 text-zinc-500" />
              <select
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="bg-transparent text-xs font-bold text-zinc-300 outline-none cursor-pointer"
              >
                <option value="all" className="bg-zinc-900 text-white">All Authorized Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900 text-white">
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-pink-500/50"
            />
          </div>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccessMsg && (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 p-4 text-emerald-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span className="text-xs font-medium">{actionSuccessMsg}</span>
          </div>
          <button onClick={() => setActionSuccessMsg(null)} className="text-emerald-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 p-4 text-red-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertOctagon className="h-4 w-4 text-red-400 shrink-0" />
            <span className="text-xs font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {currentReport.id === 'staff_report' ? (
        <div className="space-y-5">
          {/* Top 3 KPI Cards matching Image 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <p className="text-xs font-semibold text-zinc-400">Staff</p>
              <h3 className="mt-2 text-3xl font-black text-white">
                {reportData?.kpis?.find((k) => k.label === 'Staff')?.value ?? 0}
              </h3>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <p className="text-xs font-semibold text-zinc-400">Orders</p>
              <h3 className="mt-2 text-3xl font-black text-white">
                {reportData?.kpis?.find((k) => k.label === 'Orders')?.value ?? 0}
              </h3>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
              <p className="text-xs font-semibold text-zinc-400">Sales</p>
              <h3 className="mt-2 text-3xl font-black text-white">
                {reportData?.kpis?.find((k) => k.label === 'Sales')?.value ?? '₹0.00'}
              </h3>
            </div>
          </div>

          {/* Sales by staff Card matching Image 1 */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-lg space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Sales by staff</h3>
              <span className="text-xs text-zinc-500 font-medium" suppressHydrationWarning>
                {reportData?.chartData?.dateLabel || new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>

            {/* Progress Bars for each staff */}
            <div className="space-y-4">
              {(reportData?.chartData?.staffBars || reportData?.tableData || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-zinc-500 font-medium">
                  No staff sales records found for this period.
                </div>
              ) : (
                (reportData?.chartData?.staffBars || reportData?.tableData || []).map((sb: any, idx: number) => {
                  const total = reportData?.chartData?.totalSales || 1;
                  const pct = sb.percent !== undefined ? sb.percent : total > 0 ? (sb.sales / total) * 100 : 100;
                  const isAdm = sb.isAdmin || ['company_admin', 'super_admin', 'admin'].includes((sb.role || '').toLowerCase());
                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 min-w-0 max-w-[220px] sm:w-56 shrink-0">
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                          {sb.name || sb.staff}
                        </span>
                        {isAdm ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 shadow-xs shrink-0">
                            <ShieldCheck className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                            Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80 shrink-0">
                            {sb.roleLabel || (sb.role ? (sb.role.charAt(0).toUpperCase() + sb.role.slice(1).toLowerCase()) : 'Cashier')}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 h-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1E5136] dark:bg-emerald-700 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                        />
                      </div>
                      <div className="text-xs font-mono font-medium text-zinc-800 dark:text-zinc-200 flex items-center justify-end gap-3 min-w-[120px]">
                        <span>{Number(sb.sales || 0).toFixed(2)}</span>
                        <span className="text-zinc-500 text-[11px] font-sans">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Table matching Image 1 columns */}
            <div className="pt-4 border-t border-zinc-200/80 dark:border-zinc-800">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-[11px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                      <th className="py-2.5 px-3">STAFF</th>
                      <th className="py-2.5 px-3 text-right">ORDERS</th>
                      <th className="py-2.5 px-3 text-right">GUESTS</th>
                      <th className="py-2.5 px-3 text-right">SALES</th>
                      <th className="py-2.5 px-3 text-right">AVERAGE BILL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {(reportData?.chartData?.staffBars || reportData?.tableData || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-400">
                          No staff performance records found for this period.
                        </td>
                      </tr>
                    ) : (
                      (reportData?.chartData?.staffBars || reportData?.tableData || []).map((row: any, rIdx: number) => {
                        const isAdm = row.isAdmin || ['company_admin', 'super_admin', 'admin'].includes((row.role || '').toLowerCase());
                        return (
                          <tr key={rIdx} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                            <td className="py-3 px-3 font-semibold text-zinc-900 dark:text-white">
                              <div className="inline-flex items-center gap-2">
                                <span>{row.name || row.staff}</span>
                                {isAdm ? (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200/80 dark:border-purple-800/60 shadow-xs">
                                    <ShieldCheck className="w-2.5 h-2.5 text-purple-600 dark:text-purple-400" />
                                    Admin
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-700/80">
                                    {row.roleLabel || (row.role ? (row.role.charAt(0).toUpperCase() + row.role.slice(1).toLowerCase()) : 'Cashier')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                              {row.orders}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                              {row.guests}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-zinc-900 dark:text-white">
                              ₹{Number(row.sales || 0).toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-zinc-700 dark:text-zinc-300">
                              ₹{Number(row.averageBill || 0).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* 3. SUMMARY KPI STAT CARDS */}
          {reportData && reportData.kpis && reportData.kpis.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportData.kpis.map((kpi, idx) => {
            const isPink = kpi.color === 'pink' || idx === 0;
            return (
              <div
                key={idx}
                className={`rounded-2xl border p-5 shadow-xl transition-all duration-200 ${
                  isPink
                    ? 'border-theme bg-theme-badge shadow-theme-glow'
                    : 'border-zinc-800 bg-zinc-900/70'
                }`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{kpi.label}</p>
                <h3 className="mt-2 text-2xl sm:text-3xl font-black text-white">{kpi.value}</h3>
                <p className="mt-2 text-[11px] font-medium text-zinc-400">{kpi.subtext}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 4. VISUAL BREAKDOWN CHARTS (WHERE APPLICABLE)                       */}
      {/* ------------------------------------------------------------------ */}
      {reportData?.chartData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 print:hidden">
          {reportData.chartData.orderTypes && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
                <span>Order Channel Share</span>
                <span className="text-[10px] text-pink-400 font-semibold">Dine In vs Takeaway vs Delivery</span>
              </h4>
              <div className="space-y-3">
                {Object.entries(reportData.chartData.orderTypes).map(([type, val]) => {
                  const numVal = Number(val) || 0;
                  const total = Object.values(reportData.chartData.orderTypes).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                  const pct = total > 0 ? ((numVal / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={type}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-zinc-300">{type}</span>
                        <span className="text-zinc-400">₹{numVal.toFixed(2)} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-theme-bar rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportData.chartData.paymentMethods && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
                <span>Payment Channels Split</span>
                <span className="text-[10px] text-pink-400 font-semibold">Cash vs UPI vs Card vs Due</span>
              </h4>
              <div className="space-y-3">
                {Object.entries(reportData.chartData.paymentMethods).map(([method, val]) => {
                  const numVal = Number(val) || 0;
                  const total = Object.values(reportData.chartData.paymentMethods).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                  const pct = total > 0 ? ((numVal / total) * 100).toFixed(1) : 0;
                  return (
                    <div key={method}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-zinc-300">{method}</span>
                        <span className="text-zinc-400">₹{numVal.toFixed(2)} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportData.chartData.channels && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
                <span>Order Source / Platform Volume</span>
                <span className="text-[10px] text-pink-400 font-semibold">Terminal vs Zomato vs Swiggy</span>
              </h4>
              <div className="space-y-3">
                {Object.entries(reportData.chartData.channels).map(([channel, val]) => {
                  const numVal = Number(val) || 0;
                  const total = Object.values(reportData.chartData.channels).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                  const pct = total > 0 ? ((numVal / total) * 100).toFixed(1) : 0;
                  const barColor = channel.includes('Zomato') 
                    ? 'bg-gradient-to-r from-red-600 to-rose-500' 
                    : channel.includes('Swiggy') 
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500' 
                    : 'bg-gradient-to-r from-indigo-500 to-cyan-500';
                  return (
                    <div key={channel}>
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-zinc-300">{channel}</span>
                        <span className="text-zinc-400">₹{numVal.toFixed(2)} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {reportData.chartData.deliveryStatuses && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center justify-between">
                <span>Delivery Fulfillment Lifecycle</span>
                <span className="text-[10px] text-pink-400 font-semibold">9 Unified Dispatch States</span>
              </h4>
              <div className="space-y-2.5">
                {Object.entries(reportData.chartData.deliveryStatuses)
                  .filter(([_, count]) => Number(count) > 0)
                  .map(([status, count]) => {
                    const numCount = Number(count) || 0;
                    const total = Object.values(reportData.chartData.deliveryStatuses).reduce((a: any, b: any) => Number(a) + Number(b), 0) as number;
                    const pct = total > 0 ? ((numCount / total) * 100).toFixed(1) : 0;
                    const statusColor = status === 'delivered'
                      ? 'bg-emerald-500'
                      : status === 'cancelled'
                      ? 'bg-red-500'
                      : status === 'out_for_delivery'
                      ? 'bg-purple-500'
                      : status === 'picked_up'
                      ? 'bg-cyan-500'
                      : 'bg-indigo-500';
                    return (
                      <div key={status}>
                        <div className="flex justify-between text-xs font-bold mb-1 capitalize">
                          <span className="text-zinc-300">{status.replace(/_/g, ' ')}</span>
                          <span className="text-zinc-400">{numCount} orders ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${statusColor} rounded-full`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. DYNAMIC DATA TABLE                                              */}
      {/* ------------------------------------------------------------------ */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-2xl overflow-hidden print:border-none print:shadow-none">
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between flex-wrap gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-pink-500" />
            <h3 className="text-sm font-black text-white tracking-wide">
              {currentReport.name} Records ({filteredTableData.length} entries)
            </h3>
          </div>
          <span className="text-xs text-zinc-500">
            {searchQuery ? `Filtered from ${reportData?.tableData?.length || 0} total` : `Authorized for ${reportData?.companyName || 'Store'}`}
          </span>
        </div>

        {isPending ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-pink-500" />
            <p className="text-xs font-bold uppercase tracking-wider">Compiling analytical metrics from database...</p>
          </div>
        ) : filteredTableData.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-3">
            <Info className="h-8 w-8 text-zinc-600" />
            <p className="text-sm font-bold text-zinc-400">No records found for {reportData?.companyName || 'this company'}</p>
            <p className="text-xs text-zinc-600 max-w-md">
              {reportData?.meta?.notes || 'No activity has been recorded for the selected date range. Try switching to This Month or record a new entry.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/60 text-zinc-400 font-bold uppercase tracking-wider text-[11px] print:bg-gray-100 print:text-black">
                  {reportData?.columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-5 py-3.5 ${
                        col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {filteredTableData.map((row, rIdx) => (
                  <tr
                    key={rIdx}
                    className="hover:bg-zinc-800/40 transition-colors duration-100 print:hover:bg-transparent"
                  >
                    {reportData?.columns.map((col) => {
                      const val = row[col.key];
                      const isAlignRight = col.align === 'right';
                      const isAlignCenter = col.align === 'center';

                      let formattedVal = val;
                      if (col.format === 'currency' && typeof val === 'number') {
                        formattedVal = `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      } else if (col.format === 'number' && typeof val === 'number') {
                        formattedVal = val.toLocaleString();
                      }

                      return (
                        <td
                          key={col.key}
                          className={`px-5 py-3 text-zinc-300 font-medium ${
                            isAlignRight ? 'text-right font-mono' : isAlignCenter ? 'text-center' : 'text-left'
                          }`}
                        >
                          {col.format === 'badge' ? (
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-pink-500/10 text-pink-300 border border-pink-500/20">
                              {String(val)}
                            </span>
                          ) : (
                            formattedVal ?? '—'
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 6. DATA PROVENANCE FOOTNOTE                                        */}
      {/* ------------------------------------------------------------------ */}
      {reportData?.meta && (
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-4 text-[11px] text-zinc-500 space-y-1 print:hidden">
          <div className="flex items-center gap-1.5 font-bold text-zinc-400">
            <Info className="h-3.5 w-3.5 text-pink-400" />
            <span>Calculation Rules & Data Provenance</span>
          </div>
          {reportData.meta.notes && <p>{reportData.meta.notes}</p>}
          {reportData.meta.limitations && <p className="text-amber-500/80">{reportData.meta.limitations}</p>}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 1: CLOCK IN / CLOCK OUT                                      */}
      {/* ------------------------------------------------------------------ */}
      {isAttendanceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-pink-400" />
                <span>Staff Attendance Terminal</span>
              </h3>
              <button onClick={() => setIsAttendanceModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Staff Username or User ID (Optional)
                </label>
                <input
                  type="text"
                  placeholder="Leave empty for current logged-in user"
                  value={attStaffUser}
                  onChange={(e) => setAttStaffUser(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-pink-500/50"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Session Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift, Kitchen Station"
                  value={attNotes}
                  onChange={(e) => setAttNotes(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-pink-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleClockIn}
                className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-950/40"
              >
                Clock In (Start Work)
              </button>
              <button
                onClick={handleClockOut}
                className="py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-amber-950/40"
              >
                Clock Out (End Work)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 2: OPEN / CLOSE SHIFT                                        */}
      {/* ------------------------------------------------------------------ */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-pink-400" />
                <span>Cashier Shift Management</span>
              </h3>
              <button onClick={() => setIsShiftModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex rounded-xl bg-zinc-900 p-1 border border-zinc-800">
              <button
                onClick={() => setShiftAction('open')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  shiftAction === 'open' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Open Shift
              </button>
              <button
                onClick={() => setShiftAction('close')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                  shiftAction === 'close' ? 'bg-pink-600 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                Close & Reconcile
              </button>
            </div>

            {shiftAction === 'open' ? (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Opening Cash in Drawer (₹)
                  </label>
                  <input
                    type="number"
                    value={shiftOpeningCash}
                    onChange={(e) => setShiftOpeningCash(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Shift Opening Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Counter 1 Lunch Shift"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                  />
                </div>
                <button
                  onClick={handleOpenShift}
                  className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white transition cursor-pointer mt-2"
                >
                  Confirm & Open Shift
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Shift ID to Close (from Shifts Report)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. sh_179310..."
                    value={shiftCloseId}
                    onChange={(e) => setShiftCloseId(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Physically Counted Closing Cash (₹)
                  </label>
                  <input
                    type="number"
                    value={shiftCountedCash}
                    onChange={(e) => setShiftCountedCash(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                    Closing Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Cash drawer balanced"
                    value={shiftNotes}
                    onChange={(e) => setShiftNotes(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                  />
                </div>
                <button
                  onClick={handleCloseShift}
                  className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white transition cursor-pointer mt-2"
                >
                  Close Shift & Calculate Difference
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL 3: RECORD OPERATING EXPENSE                                  */}
      {/* ------------------------------------------------------------------ */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-pink-400" />
                <span>Record Store Operating Expense</span>
              </h3>
              <button onClick={() => setIsExpenseModalOpen(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Expense Category
                </label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value as any)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50 cursor-pointer"
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c} className="bg-zinc-900 text-white">
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Expense Amount (₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Description / Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Monthly Electricity Bill or Delivery Packaging"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Payment Method
                </label>
                <select
                  value={expMethod}
                  onChange={(e) => setExpMethod(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white outline-none focus:border-pink-500/50 cursor-pointer"
                >
                  <option value="Cash" className="bg-zinc-900 text-white">Cash Drawer</option>
                  <option value="Bank Transfer" className="bg-zinc-900 text-white">Bank Transfer / NEFT</option>
                  <option value="UPI" className="bg-zinc-900 text-white">UPI / GPay / PhonePe</option>
                  <option value="Card" className="bg-zinc-900 text-white">Debit/Credit Card</option>
                </select>
              </div>

              <button
                onClick={handleAddExpense}
                className="w-full py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-xs font-bold text-white transition cursor-pointer mt-2"
              >
                Save & Post to Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
