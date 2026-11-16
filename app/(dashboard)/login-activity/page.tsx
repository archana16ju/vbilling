'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Monitor,
  Smartphone,
  Globe,
  AppWindow,
  Search,
  Filter,
  RefreshCw,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Building2,
  Calendar,
  Lock,
  ChevronDown,
  Info,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  sessionId: string;
  userId?: string;
  username: string;
  employeeName: string;
  companyId?: string;
  companyName: string;
  loginAt: string;
  logoutAt?: string | null;
  lastActivityAt?: string | null;
  sessionStatus: 'active' | 'logged_out' | 'terminated' | 'expired';
  displayStatus: 'online' | 'offline' | 'terminated' | 'logged_out' | 'expired';
  loginStatus: 'success' | 'failed';
  failureReason?: string | null;
  deviceType: string;
  browserInfo: string;
  ipAddress: string;
  terminatedBy?: string | null;
  terminatedAt?: string | null;
}

export default function LoginActivityPage() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loginStatusFilter, setLoginStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Terminate Modal State
  const [terminatingSession, setTerminatingSession] = useState<ActivityItem | null>(null);
  const [isTerminating, setIsTerminating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchActivities = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set('username', search);
      if (deviceFilter !== 'all') params.set('deviceType', deviceFilter);
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (loginStatusFilter !== 'all') params.set('loginStatus', loginStatusFilter);
      if (startDate) params.set('startDate', `${startDate} 00:00:00`);
      if (endDate) params.set('endDate', `${endDate} 23:59:59`);

      const res = await fetch(`/api/login-activity?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to load login activities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = roleMatch ? roleMatch[2] : null;
    setRole(r);

    const compMatch = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
    const c = compMatch ? compMatch[2] : null;
    setCompanyId(c);

    fetchActivities();
  }, [deviceFilter, statusFilter, loginStatusFilter, startDate, endDate]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchActivities();
  };

  const handleTerminateConfirm = async () => {
    if (!terminatingSession) return;
    try {
      setIsTerminating(true);
      const res = await fetch('/api/login-activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'terminate',
          sessionId: terminatingSession.sessionId,
          targetUsername: terminatingSession.username,
          targetCompanyId: terminatingSession.companyId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Session for "${terminatingSession.username}" terminated.` });
        setTerminatingSession(null);
        fetchActivities();
      } else {
        setActionMessage({ type: 'error', text: data.error || 'Failed to terminate session' });
      }
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message || 'Error executing termination' });
    } finally {
      setIsTerminating(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'Electron Desktop Application':
        return <AppWindow className="h-4 w-4 text-purple-400" />;
      case 'Windows Desktop':
        return <Monitor className="h-4 w-4 text-blue-400" />;
      case 'Android':
        return <Smartphone className="h-4 w-4 text-emerald-400" />;
      default:
        return <Globe className="h-4 w-4 text-cyan-400" />;
    }
  };

  // Metrics
  const totalSessions = activities.length;
  const onlineSessions = activities.filter((a) => a.displayStatus === 'online').length;
  const failedAttempts = activities.filter((a) => a.loginStatus === 'failed').length;
  const terminatedCount = activities.filter((a) => a.sessionStatus === 'terminated').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl border"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Login Activity Monitor</h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Track active employee sessions, device telemetry, and terminate suspicious logins
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={fetchActivities}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 transition cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Activity
        </button>
      </div>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-bold ${
            actionMessage.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-zinc-400 hover:text-white">✕</button>
        </div>
      )}

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-sm">
          <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block">Total Logins</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-white font-mono">{totalSessions}</span>
            <span className="text-xs text-zinc-500 font-mono">tracked</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-900/30 bg-emerald-950/20 backdrop-blur-sm">
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">Active Online</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-emerald-300 font-mono">{onlineSessions}</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span> Live
            </span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-rose-900/30 bg-rose-950/20 backdrop-blur-sm">
          <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">Failed Logins</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-rose-300 font-mono">{failedAttempts}</span>
            <span className="text-xs text-rose-400/80 font-bold">flagged</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-amber-900/30 bg-amber-950/20 backdrop-blur-sm">
          <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">Terminated</span>
          <div className="flex items-baseline justify-between mt-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{terminatedCount}</span>
            <span className="text-xs text-amber-400/80 font-bold">revoked</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by username or employee name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800/80 pl-10 pr-4 py-2 text-xs font-semibold text-white placeholder-zinc-400 focus:outline-none focus:border-zinc-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Device Filter */}
            <select
              value={deviceFilter}
              onChange={(e) => setDeviceFilter(e.target.value)}
              aria-label="Filter by Device"
              className="rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 py-2 text-xs font-bold text-zinc-200 focus:outline-none"
            >
              <option value="all">All Devices</option>
              <option value="Electron Desktop Application">Electron Desktop</option>
              <option value="Windows Desktop">Windows Desktop</option>
              <option value="Android">Android</option>
              <option value="Browser">Browser</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by Status"
              className="rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 py-2 text-xs font-bold text-zinc-200 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Sessions</option>
              <option value="logged_out">Logged Out</option>
              <option value="terminated">Terminated</option>
            </select>

            {/* Login Status Filter */}
            <select
              value={loginStatusFilter}
              onChange={(e) => setLoginStatusFilter(e.target.value)}
              aria-label="Filter by Login Result"
              className="rounded-xl border border-zinc-700 bg-zinc-800/90 px-3 py-2 text-xs font-bold text-zinc-200 focus:outline-none"
            >
              <option value="all">Success & Failed</option>
              <option value="success">Successful Only</option>
              <option value="failed">Failed Only</option>
            </select>

            {/* Date Filters */}
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              aria-label="Start Date"
              className="rounded-xl border border-zinc-700 bg-zinc-800/90 px-2.5 py-2 text-xs font-bold text-zinc-200 focus:outline-none"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              aria-label="End Date"
              className="rounded-xl border border-zinc-700 bg-zinc-800/90 px-2.5 py-2 text-xs font-bold text-zinc-200 focus:outline-none"
            />

            {(search || deviceFilter !== 'all' || statusFilter !== 'all' || loginStatusFilter !== 'all' || startDate || endDate) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setDeviceFilter('all');
                  setStatusFilter('all');
                  setLoginStatusFilter('all');
                  setStartDate('');
                  setEndDate('');
                }}
                className="px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
              >
                Reset
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Activity Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-800/60 text-zinc-400 uppercase tracking-wider text-[10px] font-black border-b border-zinc-800">
              <tr>
                <th className="py-3 px-4">Employee / User</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Device & App</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Login Time</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-zinc-400" />
                    Loading session activities...
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    No login activities found matching the criteria.
                  </td>
                </tr>
              ) : (
                activities.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-bold text-white block">{item.employeeName}</span>
                        <span className="text-[11px] text-zinc-400 font-mono">@{item.username}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <Building2 className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        <span className="truncate max-w-[140px]">{item.companyName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getDeviceIcon(item.deviceType)}
                        <div>
                          <span className="font-semibold text-zinc-200 block">{item.deviceType}</span>
                          <span className="text-[10px] text-zinc-400">{item.browserInfo}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-zinc-300">
                      {item.ipAddress}
                    </td>

                    <td className="py-3 px-4 text-zinc-300">
                      {new Date(item.loginAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </td>

                    <td className="py-3 px-4 text-zinc-400">
                      {item.lastActivityAt
                        ? new Date(item.lastActivityAt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—'}
                    </td>

                    <td className="py-3 px-4">
                      {item.loginStatus === 'failed' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/60 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                          <XCircle className="h-3 w-3" /> Failed
                        </span>
                      ) : item.sessionStatus === 'terminated' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-950/60 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                          <Lock className="h-3 w-3" /> Terminated
                        </span>
                      ) : item.sessionStatus === 'logged_out' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                          <LogOut className="h-3 w-3" /> Logged Out
                        </span>
                      ) : item.displayStatus === 'online' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Online
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                          Offline
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      {item.sessionStatus === 'active' && item.displayStatus === 'online' && (
                        <button
                          onClick={() => setTerminatingSession(item)}
                          className="px-2.5 py-1 rounded-lg border border-rose-500/30 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 hover:text-white text-[11px] font-bold transition cursor-pointer"
                        >
                          Terminate
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Session Termination Modal */}
      {terminatingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rose-500/40 bg-rose-950/50 text-rose-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Terminate Active Session?</h3>
                <p className="text-xs text-zinc-400">Revokes authentication immediately</p>
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-zinc-400">User:</span>
                <span className="font-bold text-white">{terminatingSession.employeeName} (@{terminatingSession.username})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Device:</span>
                <span className="text-zinc-200">{terminatingSession.deviceType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">IP:</span>
                <span className="font-mono text-zinc-200">{terminatingSession.ipAddress}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">Logged In:</span>
                <span className="text-zinc-200">{new Date(terminatingSession.loginAt).toLocaleString()}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400">
              When terminated, any subsequent request from this device will be blocked and redirected to the login screen. This event will be recorded in the security audit log.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setTerminatingSession(null)}
                disabled={isTerminating}
                className="px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300 hover:text-white transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTerminateConfirm}
                disabled={isTerminating}
                className="px-4 py-2 rounded-xl border border-rose-500/50 bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition flex items-center gap-2 cursor-pointer"
              >
                {isTerminating ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Terminating...
                  </>
                ) : (
                  'Confirm Terminate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
