'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Clock,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Timer,
  CheckCircle2,
  Calendar,
  Sparkles,
} from 'lucide-react';
import { getCompanyStaffShifts } from '@/lib/actions/staff';
import type { StaffShift } from '@/types/staff';

export default function UpcomingShiftsCard() {
  const [shifts, setShifts] = useState<StaffShift[]>([]);
  const [loading, setLoading] = useState(true);

  const loadShifts = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await getCompanyStaffShifts({ date: todayStr });
      if (res.success && res.shifts) {
        setShifts(res.shifts);
      }
    } catch (err) {
      console.error('Error loading dashboard shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadShifts();
    const interval = setInterval(loadShifts, 30000);
    window.addEventListener('shift-updated', loadShifts);
    return () => {
      clearInterval(interval);
      window.removeEventListener('shift-updated', loadShifts);
    };
  }, []);

  const activeShifts = shifts.filter((s) => s.shiftStatus === 'Active');
  const upcomingShifts = shifts.filter((s) => s.shiftStatus === 'Upcoming');
  const lateShifts = shifts.filter((s) => s.attendanceStatus === 'Late' || (!s.checkInTime && s.shiftStatus === 'Active'));

  const getShiftIcon = (name: string) => {
    switch (name) {
      case 'Morning':
        return <Sun className="h-3.5 w-3.5 text-amber-400" />;
      case 'Evening':
        return <Sunset className="h-3.5 w-3.5 text-orange-400" />;
      case 'Night':
        return <Moon className="h-3.5 w-3.5 text-indigo-400" />;
      default:
        return <Timer className="h-3.5 w-3.5 text-pink-400" />;
    }
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-theme-badge border border-theme">
            <Clock className="h-4 w-4 text-theme-accent" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Staff Shifts Today</h3>
            <p className="text-[11px] text-zinc-400">Live roster, check-ins & upcoming reminders</p>
          </div>
        </div>

        <Link
          href="/staff?tab=shifts"
          className="flex items-center gap-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 transition-colors border border-zinc-700"
        >
          <span>Staff Roster</span>
          <ChevronRight className="h-3 w-3 text-theme-accent" />
        </Link>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-3 gap-2.5 my-4">
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2.5">
          <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping inline-block" />
            Active Now
          </div>
          <div className="text-lg font-black text-emerald-300 mt-1">{activeShifts.length}</div>
        </div>

        <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-2.5">
          <div className="text-[11px] font-semibold text-sky-400">Upcoming</div>
          <div className="text-lg font-black text-sky-300 mt-1">{upcomingShifts.length}</div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-2.5">
          <div className="text-[11px] font-semibold text-amber-400">Late / Alert</div>
          <div className="text-lg font-black text-amber-300 mt-1">{lateShifts.length}</div>
        </div>
      </div>

      {/* Shift List preview */}
      <div className="space-y-2 mt-2">
        {loading ? (
          <div className="py-6 text-center text-xs text-zinc-500">Loading today&apos;s shifts...</div>
        ) : shifts.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 text-center">
            <Calendar className="h-6 w-6 text-zinc-600 mx-auto mb-1.5" />
            <p className="text-xs font-bold text-zinc-300">No shifts scheduled for today</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Assign shifts inside the Staff collection.</p>
            <Link
              href="/staff?tab=shifts"
              className="inline-flex items-center gap-1 text-xs font-bold text-theme-accent hover:underline mt-2"
            >
              + Assign Shift Now
            </Link>
          </div>
        ) : (
          shifts.slice(0, 4).map((shift) => {
            const isLate = shift.attendanceStatus === 'Late';
            const isActive = shift.shiftStatus === 'Active';

            return (
              <div
                key={shift.id}
                className="flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-2.5 hover:border-zinc-700 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800">
                    {getShiftIcon(shift.shiftName)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{shift.staffName}</span>
                      <span className="rounded bg-zinc-800 px-1.5 py-0.2 text-[10px] font-semibold text-zinc-400">
                        {shift.staffRole}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
                      <span>{shift.shiftName}</span>
                      <span>•</span>
                      <span className="font-mono text-zinc-300">{shift.startTime} - {shift.endTime}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isActive ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-950 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Active
                    </span>
                  ) : isLate ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-950 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                      Late
                    </span>
                  ) : shift.shiftStatus === 'Completed' ? (
                    <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                      Done
                    </span>
                  ) : (
                    <span className="rounded-full bg-sky-950 border border-sky-500/40 px-2 py-0.5 text-[10px] font-bold text-sky-400">
                      Upcoming
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
