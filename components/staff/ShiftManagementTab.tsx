'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sun,
  Sunset,
  Moon,
  Timer,
  User,
  Users,
  Search,
  Filter,
  Check,
  X,
  LogIn,
  LogOut,
  Coffee,
  Briefcase,
  ChevronRight,
  LayoutList,
  LayoutGrid,
  Shield,
} from 'lucide-react';
import {
  getCompanyStaffShifts,
  createStaffShift,
  updateStaffShift,
  deleteStaffShift,
  recordShiftCheckIn,
  recordShiftCheckOut,
  getStaffList,
} from '@/lib/actions/staff';
import type {
  StaffMember,
  StaffShift,
  ShiftName,
  ShiftAttendanceStatus,
  ShiftStatus,
} from '@/types/staff';

interface Props {
  staffList: StaffMember[];
  showFeedback: (type: 'success' | 'error', message: string) => void;
  onRefreshStaff?: () => void;
}

export default function ShiftManagementTab({ staffList, showFeedback, onRefreshStaff }: Props) {
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [loading, setLoading] = useState(false);
  const [isStaffOnly, setIsStaffOnly] = useState(false);
  const [currentStaffId, setCurrentStaffId] = useState<string | undefined>();
  const [availableStaff, setAvailableStaff] = useState<StaffMember[]>(staffList || []);

  useEffect(() => {
    if (staffList && staffList.length > 0) {
      setAvailableStaff(staffList);
    } else {
      getStaffList().then((res) => {
        if (res.success && res.staff) {
          setAvailableStaff(res.staff);
        }
      });
    }
  }, [staffList]);

  // Filter State
  const [filterDate, setFilterDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [filterStaffId, setFilterStaffId] = useState<string>('all');
  const [filterShiftName, setFilterShiftName] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllDates, setShowAllDates] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<StaffShift | null>(null);
  const [modalStaffId, setModalStaffId] = useState('');
  const [modalShiftName, setModalShiftName] = useState<ShiftName>('Morning');
  const [modalCustomName, setModalCustomName] = useState('');
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [modalStartTime, setModalStartTime] = useState('09:00');
  const [modalEndTime, setModalEndTime] = useState('17:00');
  const [modalBreakDuration, setModalBreakDuration] = useState(30);
  const [modalAttendanceStatus, setModalAttendanceStatus] = useState<ShiftAttendanceStatus>('Present');
  const [modalNotes, setModalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Shifts
  const loadShifts = useCallback(async () => {
    setLoading(true);
    try {
      const filters = showAllDates ? {} : { date: filterDate };
      const res = await getCompanyStaffShifts(filters);
      if (res.success && res.shifts) {
        setShifts(res.shifts);
        setIsStaffOnly(Boolean(res.isStaffOnly));
        setCurrentStaffId(res.currentStaffId);
      } else {
        showFeedback('error', res.error || 'Failed to load shifts');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [filterDate, showAllDates, showFeedback]);

  useEffect(() => {
    loadShifts();
    const handleShiftUpdated = () => loadShifts();
    window.addEventListener('shift-updated', handleShiftUpdated);
    return () => window.removeEventListener('shift-updated', handleShiftUpdated);
  }, [loadShifts]);

  // Preset Shift Select Handler
  const handleSelectPreset = (preset: ShiftName) => {
    setModalShiftName(preset);
    if (preset === 'Morning') {
      setModalStartTime('09:00');
      setModalEndTime('17:00');
      setModalBreakDuration(30);
    } else if (preset === 'Evening') {
      setModalStartTime('16:00');
      setModalEndTime('00:00');
      setModalBreakDuration(45);
    } else if (preset === 'Night') {
      setModalStartTime('23:00');
      setModalEndTime('07:00');
      setModalBreakDuration(60);
    }
  };

  // Open Modal for New Shift
  const openNewShiftModal = () => {
    setEditingShift(null);
    setModalStaffId(availableStaff[0]?.id || '');
    setModalShiftName('Morning');
    setModalCustomName('');
    setModalDate(filterDate || new Date().toISOString().split('T')[0]);
    setModalStartTime('09:00');
    setModalEndTime('17:00');
    setModalBreakDuration(30);
    setModalAttendanceStatus('Present');
    setModalNotes('');
    setIsModalOpen(true);
  };

  // Open Modal for Edit Shift
  const openEditShiftModal = (shift: StaffShift) => {
    setEditingShift(shift);
    setModalStaffId(shift.staffId);
    setModalShiftName(shift.shiftName);
    setModalCustomName(shift.customShiftName || '');
    setModalDate(shift.shiftDate);
    setModalStartTime(shift.startTime);
    setModalEndTime(shift.endTime);
    setModalBreakDuration(shift.breakDuration || 0);
    setModalAttendanceStatus(shift.attendanceStatus);
    setModalNotes(shift.notes || '');
    setIsModalOpen(true);
  };

  // Save Shift (Create or Update)
  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalStaffId) {
      showFeedback('error', 'Please select a staff member.');
      return;
    }
    if (!modalDate) {
      showFeedback('error', 'Please choose a shift date.');
      return;
    }
    if (!modalStartTime || !modalEndTime) {
      showFeedback('error', 'Start and end times are required.');
      return;
    }
    if (modalStartTime === modalEndTime) {
      showFeedback('error', 'Shift start time and end time cannot be identical.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingShift) {
        // Update
        const res = await updateStaffShift({
          shiftId: editingShift.id,
          staffId: modalStaffId,
          shiftName: modalShiftName,
          customShiftName: modalCustomName,
          shiftDate: modalDate,
          startTime: modalStartTime,
          endTime: modalEndTime,
          breakDuration: modalBreakDuration,
          attendanceStatus: modalAttendanceStatus,
          notes: modalNotes,
        });

        if (res.success) {
          showFeedback('success', 'Shift updated successfully.');
          setIsModalOpen(false);
          loadShifts();
          window.dispatchEvent(new CustomEvent('shift-updated'));
        } else {
          showFeedback('error', res.error || 'Failed to update shift.');
        }
      } else {
        // Create
        const res = await createStaffShift({
          staffId: modalStaffId,
          shiftName: modalShiftName,
          customShiftName: modalCustomName,
          shiftDate: modalDate,
          startTime: modalStartTime,
          endTime: modalEndTime,
          breakDuration: modalBreakDuration,
          notes: modalNotes,
        });

        if (res.success) {
          showFeedback('success', 'Shift assigned successfully.');
          setIsModalOpen(false);
          loadShifts();
          window.dispatchEvent(new CustomEvent('shift-updated'));
        } else {
          showFeedback('error', res.error || 'Failed to create shift.');
        }
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Shift
  const handleDeleteShift = async (shift: StaffShift) => {
    if (!window.confirm(`Are you sure you want to remove the ${shift.shiftName} shift for ${shift.staffName}?`)) {
      return;
    }
    setLoading(true);
    try {
      const res = await deleteStaffShift(shift.id);
      if (res.success) {
        showFeedback('success', 'Shift deleted.');
        loadShifts();
        window.dispatchEvent(new CustomEvent('shift-updated'));
      } else {
        showFeedback('error', res.error || 'Failed to delete shift.');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to delete shift.');
    } finally {
      setLoading(false);
    }
  };

  // Check In Handler
  const handleCheckIn = async (shift: StaffShift) => {
    try {
      const res = await recordShiftCheckIn(shift.id);
      if (res.success) {
        showFeedback('success', `Clock-in recorded at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}! Status: ${res.attendanceStatus}`);
        loadShifts();
        window.dispatchEvent(new CustomEvent('shift-updated'));
      } else {
        showFeedback('error', res.error || 'Failed to record check-in.');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to record check-in.');
    }
  };

  // Check Out Handler
  const handleCheckOut = async (shift: StaffShift) => {
    try {
      const res = await recordShiftCheckOut(shift.id);
      if (res.success) {
        showFeedback('success', `Clock-out recorded! Total working time: ${res.totalWorkingHours} hours.`);
        loadShifts();
        window.dispatchEvent(new CustomEvent('shift-updated'));
      } else {
        showFeedback('error', res.error || 'Failed to record check-out.');
      }
    } catch (err: any) {
      showFeedback('error', err.message || 'Failed to record check-out.');
    }
  };

  // Filtered Shifts List
  const filteredShifts = shifts.filter((s) => {
    if (filterStaffId !== 'all' && s.staffId !== filterStaffId) return false;
    if (filterShiftName !== 'all' && s.shiftName !== filterShiftName) return false;
    if (filterStatus !== 'all') {
      if (filterStatus === 'Late' && s.attendanceStatus !== 'Late') return false;
      if (filterStatus === 'Absent' && s.attendanceStatus !== 'Absent') return false;
      if (filterStatus === 'On Leave' && s.attendanceStatus !== 'On Leave') return false;
      if (['Upcoming', 'Active', 'Completed'].includes(filterStatus) && s.shiftStatus !== filterStatus) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (s.staffName || '').toLowerCase().includes(q);
      const matchRole = (s.staffRole || '').toLowerCase().includes(q);
      const matchShift = (s.shiftName || '').toLowerCase().includes(q);
      if (!matchName && !matchRole && !matchShift) return false;
    }
    return true;
  });

  // Calculate Metrics for Current View
  const totalCount = filteredShifts.length;
  const activeCount = filteredShifts.filter((s) => s.shiftStatus === 'Active').length;
  const upcomingCount = filteredShifts.filter((s) => s.shiftStatus === 'Upcoming').length;
  const lateOrMissingCount = filteredShifts.filter((s) => s.attendanceStatus === 'Late' || (!s.checkInTime && s.shiftStatus === 'Active')).length;
  const completedCount = filteredShifts.filter((s) => s.shiftStatus === 'Completed').length;

  const getShiftIcon = (name: ShiftName) => {
    switch (name) {
      case 'Morning':
        return <Sun className="h-4 w-4 text-amber-400" />;
      case 'Evening':
        return <Sunset className="h-4 w-4 text-orange-400" />;
      case 'Night':
        return <Moon className="h-4 w-4 text-indigo-400" />;
      default:
        return <Timer className="h-4 w-4 text-pink-400" />;
    }
  };

  const formatTimeDisplay = (timeIsoOrStr: string | null | undefined) => {
    if (!timeIsoOrStr) return '—';
    try {
      if (timeIsoOrStr.includes('T') || timeIsoOrStr.includes('-')) {
        const d = new Date(timeIsoOrStr);
        if (!isNaN(d.getTime())) {
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
        }
      }
      return timeIsoOrStr;
    } catch {
      return timeIsoOrStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Summary KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="text-xs font-semibold text-zinc-400 flex items-center justify-between">
            <span>Total Shifts</span>
            <Calendar className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="text-2xl font-black text-white mt-1.5">{totalCount}</div>
          <p className="text-[11px] text-zinc-400 mt-1">{showAllDates ? 'All Scheduled' : `For ${filterDate}`}</p>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-sm">
          <div className="text-xs font-semibold text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              Active Now
            </span>
            <LogIn className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-emerald-300 mt-1.5">{activeCount}</div>
          <p className="text-[11px] text-emerald-400/80 mt-1">Currently on duty</p>
        </div>

        <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-4 shadow-sm">
          <div className="text-xs font-semibold text-sky-400 flex items-center justify-between">
            <span>Upcoming</span>
            <Clock className="h-4 w-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-sky-300 mt-1.5">{upcomingCount}</div>
          <p className="text-[11px] text-sky-400/80 mt-1">Scheduled next</p>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-sm">
          <div className="text-xs font-semibold text-amber-400 flex items-center justify-between">
            <span>Late / Overdue</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 mt-1.5">{lateOrMissingCount}</div>
          <p className="text-[11px] text-amber-400/80 mt-1">Action required</p>
        </div>

        <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4 shadow-sm col-span-2 md:col-span-1">
          <div className="text-xs font-semibold text-indigo-400 flex items-center justify-between">
            <span>Completed</span>
            <CheckCircle2 className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-indigo-300 mt-1.5">{completedCount}</div>
          <p className="text-[11px] text-indigo-400/80 mt-1">Logged shifts</p>
        </div>
      </div>

      {/* ── Controls & Filter Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/80 p-3.5 rounded-2xl border border-zinc-800 shadow-lg">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={filterDate}
              disabled={showAllDates}
              onChange={(e) => {
                setFilterDate(e.target.value);
                setShowAllDates(false);
              }}
              className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => {
                setFilterDate(new Date().toISOString().split('T')[0]);
                setShowAllDates(false);
              }}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                filterDate === new Date().toISOString().split('T')[0] && !showAllDates
                  ? 'bg-zinc-800 text-white border-zinc-600'
                  : 'text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setShowAllDates(!showAllDates)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer ${
                showAllDates
                  ? 'bg-theme-accent text-white border-theme shadow-sm'
                  : 'text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              All Dates
            </button>
          </div>

          {/* Filter by Staff (Admins only) */}
          {!isStaffOnly && (
            <select
              value={filterStaffId}
              onChange={(e) => setFilterStaffId(e.target.value)}
              className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
            >
              <option value="all">All Staff Members</option>
              {availableStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role})
                </option>
              ))}
            </select>
          )}

          {/* Shift Type Filter */}
          <select
            value={filterShiftName}
            onChange={(e) => setFilterShiftName(e.target.value)}
            className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
          >
            <option value="all">All Shift Types</option>
            <option value="Morning">Morning</option>
            <option value="Evening">Evening</option>
            <option value="Night">Night</option>
            <option value="Custom">Custom</option>
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs font-semibold text-white outline-none focus:border-theme"
          >
            <option value="all">All Statuses</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
            <option value="Late">Late</option>
            <option value="Absent">Absent</option>
            <option value="On Leave">On Leave</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search staff or shift..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-xl bg-zinc-950 border border-zinc-700 pl-8 pr-3 py-1.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-theme w-40 sm:w-48"
            />
          </div>
        </div>

        {/* Action Button: Assign Shift (Admin only) */}
        {!isStaffOnly && (
          <button
            type="button"
            onClick={openNewShiftModal}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-theme-accent hover:opacity-90 text-white shadow-md transition-all cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Assign Shift</span>
          </button>
        )}
      </div>

      {/* Staff isolation notification banner if viewing in staff mode */}
      {isStaffOnly && (
        <div className="rounded-xl border border-indigo-500/30 bg-indigo-950/20 px-4 py-2.5 flex items-center justify-between text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-indigo-400" />
            <span>Staff Portal Mode: Viewing your own assigned shifts and attendance schedule.</span>
          </div>
        </div>
      )}

      {/* ── Shifts List Cards / Table ── */}
      {loading ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center text-sm text-zinc-400">
          <Clock className="h-6 w-6 text-zinc-500 mx-auto mb-2 animate-spin" />
          Loading shifts...
        </div>
      ) : filteredShifts.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <Calendar className="h-10 w-10 text-zinc-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-white">No Shifts Found</h3>
          <p className="text-xs text-zinc-400 mt-1 max-w-md mx-auto">
            {showAllDates
              ? 'No shift records found matching your filters.'
              : `No shifts scheduled for ${filterDate}. Choose another date or assign a shift.`}
          </p>
          {!isStaffOnly && (
            <button
              type="button"
              onClick={openNewShiftModal}
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl text-xs font-bold bg-theme-accent text-white hover:opacity-90 transition-all cursor-pointer shadow-md"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Assign First Shift</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
          <div className="overflow-x-auto rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950/70 text-zinc-400 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Shift Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Scheduled Hours</th>
                  <th className="py-3 px-4">Clock In Time</th>
                  <th className="py-3 px-4">Clock Out Time</th>
                  <th className="py-3 px-4 text-center">Working Hours</th>
                  <th className="py-3 px-4 text-center">Attendance</th>
                  <th className="py-3 px-4 text-center">Shift Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {filteredShifts.map((shift) => {
                  const isLate = shift.attendanceStatus === 'Late';
                  const isAbsent = shift.attendanceStatus === 'Absent';
                  const isOnLeave = shift.attendanceStatus === 'On Leave';
                  const isActive = shift.shiftStatus === 'Active';
                  const isCompleted = shift.shiftStatus === 'Completed';

                  const clockInStr = shift.clockInTime || shift.checkInTime;
                  const clockOutStr = shift.clockOutTime || shift.checkOutTime;

                  const canCheckIn = !clockInStr;
                  const canCheckOut = clockInStr && !clockOutStr;

                  return (
                    <tr
                      key={shift.id}
                      className={`hover:bg-zinc-800/40 transition-colors ${
                        isActive ? 'bg-emerald-950/15' : ''
                      }`}
                    >
                      {/* Staff Member */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-white shrink-0">
                            {shift.staffName ? shift.staffName.charAt(0).toUpperCase() : 'S'}
                          </div>
                          <div>
                            <div className="font-bold text-white leading-tight">{shift.staffName || 'Staff'}</div>
                            <span className="inline-block mt-0.5 text-[10px] text-zinc-400 font-medium">
                              {shift.staffRole || 'Cashier'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Shift Type */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          {getShiftIcon(shift.shiftName)}
                          <span>{shift.shiftName}</span>
                          {shift.shiftName === 'Custom' && shift.customShiftName && (
                            <span className="text-[10px] text-zinc-400 font-normal">({shift.customShiftName})</span>
                          )}
                        </div>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 font-mono text-zinc-300 whitespace-nowrap">
                        {shift.shiftDate}
                      </td>

                      {/* Scheduled Hours */}
                      <td className="py-3 px-4">
                        <div className="font-mono text-zinc-200">
                          {shift.startTime} – {shift.endTime}
                        </div>
                        {shift.breakDuration > 0 && (
                          <div className="text-[10px] text-zinc-400 flex items-center gap-1 mt-0.5">
                            <Coffee className="h-3 w-3" />
                            <span>{shift.breakDuration}m break</span>
                          </div>
                        )}
                      </td>

                      {/* Clock In Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {clockInStr ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-mono font-bold text-[11px]">
                            <LogIn className="h-3 w-3 text-emerald-400" />
                            <span>{formatTimeDisplay(clockInStr)}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-500 text-[11px] italic">Not Clocked In</span>
                        )}
                      </td>

                      {/* Clock Out Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {clockOutStr ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-950/60 border border-indigo-500/40 text-indigo-300 font-mono font-bold text-[11px]">
                            <LogOut className="h-3 w-3 text-indigo-400" />
                            <span>{formatTimeDisplay(clockOutStr)}</span>
                          </div>
                        ) : clockInStr ? (
                          <span className="text-amber-400/90 text-[11px] font-semibold flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                            On Duty
                          </span>
                        ) : (
                          <span className="text-zinc-500 text-[11px] italic">—</span>
                        )}
                      </td>

                      {/* Working Hours */}
                      <td className="py-3 px-4 text-center font-mono font-bold text-white whitespace-nowrap">
                        {shift.totalWorkingHours > 0 ? (
                          <span className="text-theme-accent">{shift.totalWorkingHours} hrs</span>
                        ) : (
                          <span className="text-zinc-500">—</span>
                        )}
                      </td>

                      {/* Attendance */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isLate ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-950 border border-amber-500/50 text-amber-300">
                            Late
                          </span>
                        ) : isAbsent ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-950 border border-rose-500/50 text-rose-300">
                            Absent
                          </span>
                        ) : isOnLeave ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-950 border border-sky-500/50 text-sky-300">
                            On Leave
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                            Present
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                            Active
                          </span>
                        ) : isCompleted ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                            <Check className="h-3 w-3" />
                            Completed
                          </span>
                        ) : (
                          <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                            Upcoming
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {canCheckIn ? (
                            <button
                              type="button"
                              onClick={() => handleCheckIn(shift)}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white transition-all cursor-pointer shadow-sm"
                              title="Clock In"
                            >
                              <LogIn className="h-3 w-3" />
                              <span>Clock In</span>
                            </button>
                          ) : canCheckOut ? (
                            <button
                              type="button"
                              onClick={() => handleCheckOut(shift)}
                              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 text-[11px] font-bold text-white transition-all cursor-pointer shadow-sm"
                              title="Clock Out"
                            >
                              <LogOut className="h-3 w-3" />
                              <span>Clock Out</span>
                            </button>
                          ) : null}

                          {!isStaffOnly && (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditShiftModal(shift)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Edit Shift"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteShift(shift)}
                                className="p-1 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                                title="Delete Shift"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredShifts.map((shift) => {
            const isLate = shift.attendanceStatus === 'Late';
            const isAbsent = shift.attendanceStatus === 'Absent';
            const isOnLeave = shift.attendanceStatus === 'On Leave';
            const isActive = shift.shiftStatus === 'Active';
            const isCompleted = shift.shiftStatus === 'Completed';

            const canCheckIn = !shift.checkInTime;
            const canCheckOut = shift.checkInTime && !shift.checkOutTime;

            return (
              <div
                key={shift.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-4.5 transition-all shadow-md ${
                  isActive
                    ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-950/20 via-zinc-900/90 to-zinc-950'
                    : isLate
                    ? 'border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-zinc-900/90 to-zinc-950'
                    : isAbsent
                    ? 'border-rose-500/40 bg-zinc-900/70'
                    : 'border-zinc-800 bg-zinc-900/70 hover:border-zinc-700'
                }`}
              >
                <div>
                  {/* Top Bar: Shift Type badge + Status badges */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-zinc-800/80">
                    <div className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700">
                        {getShiftIcon(shift.shiftName)}
                      </span>
                      <div>
                        <span className="text-xs font-black text-white flex items-center gap-1">
                          {shift.shiftName}
                          {shift.shiftName === 'Custom' && shift.customShiftName && (
                            <span className="text-[10px] text-zinc-400">({shift.customShiftName})</span>
                          )}
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400">{shift.shiftDate}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Shift Status */}
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-500/50 px-2 py-0.5 text-[10px] font-black text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Active
                        </span>
                      ) : isCompleted ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-950 border border-indigo-500/40 px-2 py-0.5 text-[10px] font-bold text-indigo-300">
                          <Check className="h-3 w-3" />
                          Done
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                          Upcoming
                        </span>
                      )}

                      {/* Attendance Status */}
                      {isLate ? (
                        <span className="rounded-full bg-amber-950 border border-amber-500/50 px-2 py-0.5 text-[10px] font-black text-amber-300">
                          Late
                        </span>
                      ) : isAbsent ? (
                        <span className="rounded-full bg-rose-950 border border-rose-500/50 px-2 py-0.5 text-[10px] font-black text-rose-300">
                          Absent
                        </span>
                      ) : isOnLeave ? (
                        <span className="rounded-full bg-sky-950 border border-sky-500/50 px-2 py-0.5 text-[10px] font-black text-sky-300">
                          On Leave
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                          Present
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Staff Info */}
                  <div className="flex items-center gap-3 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 font-bold text-sm shrink-0">
                      {shift.staffName ? shift.staffName.charAt(0).toUpperCase() : 'S'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">{shift.staffName}</h4>
                        <span className="rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                          {shift.staffRole}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1">
                        <span className="font-mono text-zinc-300">
                          {shift.startTime} - {shift.endTime}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                          <Coffee className="h-3 w-3" />
                          {shift.breakDuration}m break
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps & Logged Hours */}
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-zinc-950/60 p-2.5 border border-zinc-800/80 mb-3 text-center">
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-400">Clock In</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">
                        {formatTimeDisplay(shift.clockInTime || shift.checkInTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-400">Clock Out</div>
                      <div className="text-xs font-mono font-bold text-white mt-0.5">
                        {formatTimeDisplay(shift.clockOutTime || shift.checkOutTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-zinc-400">Hours</div>
                      <div className="text-xs font-mono font-black text-theme-accent mt-0.5">
                        {shift.totalWorkingHours > 0 ? `${shift.totalWorkingHours}h` : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Notes if any */}
                  {shift.notes && (
                    <p className="text-[11px] text-zinc-400 italic bg-zinc-950/40 p-2 rounded-lg border border-zinc-800 mb-3">
                      &quot;{shift.notes}&quot;
                    </p>
                  )}
                </div>

                {/* Bottom Actions Bar */}
                <div className="flex items-center justify-between pt-3 border-t border-zinc-800/80 mt-1">
                  {/* Check-In / Check-Out Controls */}
                  <div className="flex items-center gap-1.5">
                    {canCheckIn ? (
                      <button
                        type="button"
                        onClick={() => handleCheckIn(shift)}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                        title="Record clock-in time"
                      >
                        <LogIn className="h-3.5 w-3.5" />
                        <span>Clock In</span>
                      </button>
                    ) : canCheckOut ? (
                      <button
                        type="button"
                        onClick={() => handleCheckOut(shift)}
                        className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
                        title="Record clock-out time"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Clock Out</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-bold text-zinc-500 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Shift Completed
                      </span>
                    )}
                  </div>

                  {/* Admin Edit/Delete */}
                  {!isStaffOnly && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditShiftModal(shift)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Edit Shift"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteShift(shift)}
                        className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 transition-colors cursor-pointer"
                        title="Delete Shift"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Assign / Edit Shift Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-theme-accent" />
                <h3 className="text-base font-bold text-white">
                  {editingShift ? 'Edit Shift Details' : 'Assign New Staff Shift'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShift} className="space-y-4 mt-4">
              {/* Select Staff Member */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Assigned Staff Member *
                </label>
                <select
                  value={modalStaffId}
                  onChange={(e) => setModalStaffId(e.target.value)}
                  disabled={Boolean(editingShift)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-bold text-white outline-none focus:border-theme disabled:opacity-50"
                  required
                >
                  <option value="">Select a staff member...</option>
                  {availableStaff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {s.role} ({s.username || 'staff'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Presets */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                  Shift Template Presets
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['Morning', 'Evening', 'Night', 'Custom'] as ShiftName[]).map((preset) => {
                    const isSelected = modalShiftName === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleSelectPreset(preset)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-theme bg-zinc-800 text-white shadow-sm'
                            : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
                        }`}
                      >
                        <span className="mb-1">{getShiftIcon(preset)}</span>
                        <span>{preset}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Shift Name if custom selected */}
              {modalShiftName === 'Custom' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Custom Shift Title
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Weekend Rush, Noon Cover"
                    value={modalCustomName}
                    onChange={(e) => setModalCustomName(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white outline-none focus:border-theme"
                  />
                </div>
              )}

              {/* Shift Date */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Shift Date *
                </label>
                <input
                  type="date"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-bold text-white outline-none focus:border-theme"
                  required
                />
              </div>

              {/* Times: Start, End, Break Duration */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    value={modalStartTime}
                    onChange={(e) => setModalStartTime(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-theme"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    value={modalEndTime}
                    onChange={(e) => setModalEndTime(e.target.value)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-theme"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Break (mins)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="180"
                    value={modalBreakDuration}
                    onChange={(e) => setModalBreakDuration(Number(e.target.value) || 0)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-theme"
                  />
                </div>
              </div>

              {/* Attendance Status (Edit only) */}
              {editingShift && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1">
                    Attendance Status
                  </label>
                  <select
                    value={modalAttendanceStatus}
                    onChange={(e) => setModalAttendanceStatus(e.target.value as ShiftAttendanceStatus)}
                    className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs font-bold text-white outline-none focus:border-theme"
                  >
                    <option value="Present">Present</option>
                    <option value="Late">Late</option>
                    <option value="Absent">Absent</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">
                  Shift Notes / Instructions
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional duties or instructions for this shift..."
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  className="w-full rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-white outline-none focus:border-theme resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-theme-accent hover:opacity-90 text-white shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingShift ? 'Update Shift' : 'Assign Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
