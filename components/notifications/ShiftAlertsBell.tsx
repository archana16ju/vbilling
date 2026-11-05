'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Calendar,
  X,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { getShiftAlerts, recordShiftCheckIn, recordShiftCheckOut } from '@/lib/actions/staff';
import type { ShiftAlert } from '@/types/staff';

// Format time for clock in / clock out display
function formatClockTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return isoString;
  }
}

// Web Audio chime synthesizer
function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Safely ignore audio blocked by browser policy
  }
}

export default function ShiftAlertsBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<ShiftAlert[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<string | null>(null);
  const [isStaffWithShifts, setIsStaffWithShifts] = useState(false);
  const [hasAssignedShifts, setHasAssignedShifts] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevAlertCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);

  // Load read IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('read_shift_alerts');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
    } catch {}
  }, []);

  // Fetch alerts from server
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await getShiftAlerts();
      setIsLoaded(true);
      if (res.success) {
        setIsStaffWithShifts(Boolean(res.isStaffWithShifts));
        setHasAssignedShifts(Boolean(res.hasAssignedShifts));
        setAlerts(res.alerts || []);

        // Sound chime if new urgent alerts arrived
        if (!isFirstLoadRef.current && res.urgentCount > prevAlertCountRef.current && soundEnabled) {
          playAlertChime();
        }
        prevAlertCountRef.current = res.urgentCount;
        isFirstLoadRef.current = false;
      } else {
        setIsStaffWithShifts(false);
        setHasAssignedShifts(false);
        setAlerts([]);
      }
    } catch (err) {
      console.error('Error fetching shift alerts:', err);
      setIsStaffWithShifts(false);
      setHasAssignedShifts(false);
    }
  }, [soundEnabled]);

  // Initial load and periodic polling (every 20s) so alerts stay active over long sessions
  useEffect(() => {
    fetchAlerts();

    const interval = setInterval(fetchAlerts, 20000);

    const handleFocus = () => fetchAlerts();
    window.addEventListener('focus', handleFocus);
    window.addEventListener('shift-updated', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('shift-updated', handleFocus);
    };
  }, [fetchAlerts]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const markAllAsRead = () => {
    const allIds = new Set(alerts.map((a) => a.id));
    setReadIds(allIds);
    try {
      localStorage.setItem('read_shift_alerts', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const handleQuickClockIn = async (alert: ShiftAlert, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckingInId(alert.shiftId);
    try {
      const res = await recordShiftCheckIn(alert.shiftId);
      if (res.success) {
        fetchAlerts();
        window.dispatchEvent(new CustomEvent('shift-updated'));
      }
    } catch (err) {
      console.error('Clock-in error:', err);
    } finally {
      setCheckingInId(null);
    }
  };

  const handleQuickClockOut = async (alert: ShiftAlert, e: React.MouseEvent) => {
    e.stopPropagation();
    setCheckingOutId(alert.shiftId);
    try {
      const res = await recordShiftCheckOut(alert.shiftId);
      if (res.success) {
        fetchAlerts();
        window.dispatchEvent(new CustomEvent('shift-updated'));
      }
    } catch (err) {
      console.error('Clock-out error:', err);
    } finally {
      setCheckingOutId(null);
    }
  };

  // REQUIREMENT 1 & 2: Show bell icons and shift notifications ONLY to staff members who have assigned shifts.
  // Do NOT display to Super Admin, Company Admin, or accounts without assigned shifts.
  if (!isLoaded || !isStaffWithShifts || !hasAssignedShifts) {
    return null;
  }

  const unreadAlerts = alerts.filter((a) => !readIds.has(a.id));
  const unreadCount = unreadAlerts.length;
  const hasUrgent = unreadAlerts.some((a) => a.severity === 'danger');

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex h-9 w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'border-theme bg-zinc-800 text-white shadow-md'
            : hasUrgent
            ? 'border-rose-500/50 bg-rose-950/40 text-rose-300 hover:bg-rose-900/40 animate-pulse'
            : unreadCount > 0
            ? 'border-amber-500/40 bg-amber-950/30 text-amber-300 hover:bg-amber-900/30'
            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`}
        title={unreadCount > 0 ? `${unreadCount} Shift Notification${unreadCount > 1 ? 's' : ''}` : 'My Shift Notifications'}
        aria-label="Shift Notifications"
      >
        <Bell className="h-4 w-4" />

        {/* Counter Badge */}
        {unreadCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-black leading-none text-white shadow-sm ${
              hasUrgent ? 'bg-rose-600 animate-bounce' : 'bg-amber-600'
            }`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-950 p-0 shadow-2xl backdrop-blur-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-theme-accent" />
              <h3 className="text-sm font-bold text-white">My Shift Alerts</h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-black text-amber-400 border border-zinc-700">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                title={soundEnabled ? 'Mute alert chime' : 'Enable alert chime'}
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-[11px] font-semibold text-zinc-400 hover:text-theme-accent transition-colors"
                >
                  Mark read
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Alert List */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-2 no-scrollbar">
            {alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-zinc-500">
                <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mb-2" />
                <p className="text-xs font-semibold text-zinc-300">Shifts on schedule!</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">No urgent notifications or pending clock-ins.</p>
              </div>
            ) : (
              alerts.map((alert) => {
                const isRead = readIds.has(alert.id);
                const isUrgent = alert.severity === 'danger';
                const isWarning = alert.severity === 'warning';
                const isSuccess = alert.severity === 'success';

                const canClockIn = !alert.clockInTime && !alert.checkInTime && alert.type !== 'COMPLETED';
                const canClockOut = (alert.clockInTime || alert.checkInTime) && !alert.clockOutTime && !alert.checkOutTime;

                return (
                  <div
                    key={alert.id}
                    className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 transition-all ${
                      isRead
                        ? 'border-zinc-800/60 bg-zinc-900/40 opacity-70 hover:opacity-100'
                        : isUrgent
                        ? 'border-rose-500/50 bg-rose-950/25 shadow-md shadow-rose-950/40'
                        : isWarning
                        ? 'border-amber-500/40 bg-amber-950/20 shadow-md shadow-amber-950/30'
                        : isSuccess
                        ? 'border-emerald-500/40 bg-emerald-950/20'
                        : 'border-zinc-800 bg-zinc-900/80'
                    }`}
                  >
                    {/* Top Row: Icon, Title, Time */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isUrgent ? (
                          <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                        ) : isWarning ? (
                          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        ) : isSuccess ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Clock className="h-4 w-4 text-sky-400 shrink-0" />
                        )}
                        <span className="text-xs font-bold text-white leading-tight">
                          {alert.title}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono font-bold text-zinc-400 shrink-0 bg-zinc-950/70 px-1.5 py-0.5 rounded border border-zinc-800">
                        {alert.startTime}{alert.endTime ? ` - ${alert.endTime}` : ''}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 leading-relaxed pl-6">
                      {alert.message}
                    </p>

                    {/* Explicit Clock In & Clock Out Times Display */}
                    <div className="ml-6 my-1.5 grid grid-cols-2 gap-2 rounded-xl bg-zinc-950/80 p-2.5 border border-zinc-800/80 shadow-inner">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 shrink-0">
                          <LogIn className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Clock In</div>
                          <div className={`text-xs font-mono font-bold truncate ${
                            alert.clockInTime || alert.checkInTime ? 'text-emerald-400' : 'text-zinc-500'
                          }`}>
                            {alert.clockInTime || alert.checkInTime
                              ? formatClockTime(alert.clockInTime || alert.checkInTime)
                              : 'Pending'}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-indigo-400 shrink-0">
                          <LogOut className="h-3 w-3" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider">Clock Out</div>
                          <div className={`text-xs font-mono font-bold truncate ${
                            alert.clockOutTime || alert.checkOutTime ? 'text-indigo-400' : 'text-zinc-500'
                          }`}>
                            {alert.clockOutTime || alert.checkOutTime
                              ? formatClockTime(alert.clockOutTime || alert.checkOutTime)
                              : alert.clockInTime || alert.checkInTime
                              ? 'Active (Working)'
                              : '—'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata & Quick Clock-In / Clock-Out Action */}
                    <div className="flex items-center justify-between pl-6 pt-1">
                      <span className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-zinc-400" />
                        {alert.shiftDate}
                      </span>

                      {/* Quick Clock-in button if staff member needs to clock in */}
                      {canClockIn ? (
                        <button
                          type="button"
                          disabled={checkingInId === alert.shiftId}
                          onClick={(e) => handleQuickClockIn(alert, e)}
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <LogIn className="h-3 w-3" />
                          <span>{checkingInId === alert.shiftId ? 'Clocking In...' : 'Clock In'}</span>
                        </button>
                      ) : canClockOut ? (
                        <button
                          type="button"
                          disabled={checkingOutId === alert.shiftId}
                          onClick={(e) => handleQuickClockOut(alert, e)}
                          className="flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm transition-all cursor-pointer disabled:opacity-50"
                        >
                          <LogOut className="h-3 w-3" />
                          <span>{checkingOutId === alert.shiftId ? 'Clocking Out...' : 'Clock Out'}</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>


        </div>
      )}
    </div>
  );
}
