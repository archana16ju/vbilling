'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  Receipt,
  Banknote,
  QrCode,
  CreditCard,
  Clock,
  Package,
  Layers,
  AlertTriangle,
  RefreshCw,
  Users,
  Shield,
  UserCheck,
  Building2,
  Calendar,
  Filter,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Monitor,
  PackagePlus,
  FileBarChart,
  UserPlus,
  CircleDollarSign,
  XCircle,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import UserCollectionsTable, { UserStatsItem } from '@/components/dashboard/UserCollectionsTable';
import UpcomingShiftsCard from '@/components/dashboard/UpcomingShiftsCard';
import { RecentBillItem } from '@/components/dashboard/LiveCollectionsFeed';
import {
  KpiGridSkeleton,
  ChartSkeleton,
  DonutSkeleton,
  FeedSkeleton,
} from '@/components/dashboard/DashboardSkeletons';

// Dynamic lazy-loaded heavy chart & feed components with skeleton fallbacks
const CollectionsTimelineChart = dynamic(
  () => import('@/components/dashboard/CollectionsTimelineChart'),
  { ssr: false, loading: () => <ChartSkeleton height="h-80" /> }
);

const PaymentCollectionsDonut = dynamic(
  () => import('@/components/dashboard/PaymentCollectionsDonut'),
  { ssr: false, loading: () => <DonutSkeleton /> }
);

const HourlyRushChart = dynamic(
  () => import('@/components/dashboard/HourlyRushChart'),
  { ssr: false, loading: () => <ChartSkeleton height="h-56" /> }
);

const LiveCollectionsFeed = dynamic(
  () => import('@/components/dashboard/LiveCollectionsFeed'),
  { ssr: false, loading: () => <FeedSkeleton /> }
);

interface DashboardData {
  company: {
    id: string;
    name: string;
    code: string;
    currency: string;
  };
  filter: {
    preset: 'today' | 'yesterday' | 'week' | 'month' | 'all';
    userId: string;
    startDate: string;
    endDate: string;
  };
  currentUser: {
    userId: string;
    username: string;
    role: string;
  };
  usersList: UserStatsItem[];
  overview: {
    totalCollections: number;
    totalBills: number;
    avgBillValue: number;
    subtotal: number;
    totalTax: number;
    totalDiscount: number;
    collections: {
      cash: { amount: number; count: number; percent: number };
      upi: { amount: number; count: number; percent: number };
      card: { amount: number; count: number; percent: number };
      billOnly: { amount: number; count: number; percent: number };
      online: { amount: number; count: number; percent: number };
    };
    orderTypes: {
      dineIn: { amount: number; count: number };
      takeaway: { amount: number; count: number };
      delivery: { amount: number; count: number };
    };
    totalProducts: number;
    totalCategories: number;
    lowStockCount: number;
    activeUsersCount: number;
  };
  timelineGraph: {
    type: 'hourly' | 'daily';
    points: { label: string; rawDate?: string; amount: number; bills: number }[];
    peakLabel: string;
    peakAmount: number;
  };
  paymentDonut: {
    method: string;
    label: string;
    amount: number;
    count: number;
    percent: number;
    color: string;
  }[];
  hourlyRush: {
    hour: number;
    label: string;
    amount: number;
    bills: number;
    isPeak: boolean;
  }[];
  recentBills: RecentBillItem[];
}

export default function DashboardPage() {
  const [preset, setPreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const queryClient = useQueryClient();

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me && me.authenticated) {
          if (me.role === 'waiter') window.location.href = '/tables';
          else if (me.role === 'chef') window.location.href = '/kitchen';
          else if (me.role === 'delivery_staff') window.location.href = '/delivery';
        }
      })
      .catch(() => {});
  }, []);

  const {
    data,
    isLoading,
    isFetching,
    error: queryError,
    refetch,
    dataUpdatedAt,
  } = useQuery<DashboardData>({
    queryKey: ['dashboard-stats', preset, selectedUserId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/stats?preset=${preset}&userId=${selectedUserId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP error ${res.status}`);
      }
      return res.json();
    },
    staleTime: 30 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const error = queryError ? (queryError as Error).message : null;
  const lastRefreshed = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  const currencySymbol = '₹';
  const overview = data?.overview;
  const isIndividualUserView = selectedUserId !== 'all';
  const activeUserObj = isIndividualUserView && data?.usersList
    ? data.usersList.find(u => u.username.toLowerCase() === selectedUserId.toLowerCase())
    : null;

  return (
    <div className="space-y-6 text-white pb-12">
      {/* 1. Dynamic Theme Hero Banner */}
      <div className="rounded-2xl p-6 sm:p-8 bg-theme-bar border border-theme shadow-2xl relative overflow-hidden">
        <div 
          className="absolute right-0 top-0 -mt-8 -mr-8 h-56 w-56 rounded-full blur-3xl pointer-events-none opacity-30" 
          style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
        />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold tracking-wider uppercase text-white backdrop-blur-sm shadow-inner">
                <Building2 className="h-3 w-3" />
                {data?.company?.name || 'Company'} Admin Dashboard
              </span>

              {data?.company?.code && (
                <span className="rounded-full bg-black/40 border border-white/20 px-2.5 py-0.5 text-[10px] font-mono font-bold text-white">
                  {data.company.code}
                </span>
              )}

              {isIndividualUserView && activeUserObj && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/80 border border-emerald-400/80 px-3 py-0.5 text-[11px] font-black text-emerald-300">
                  <UserCheck className="h-3 w-3 text-emerald-400" />
                  User View: {activeUserObj.name}
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
              Welcome back{data?.currentUser?.username ? `, ${data.currentUser.username}` : ''}!
            </h1>

            <p className="text-xs sm:text-sm text-white/90 font-medium mt-1 max-w-xl">
              Real-time multi-cashier collections ledger, dynamic velocity telemetry & automated audit reporting.
            </p>
          </div>

          {/* Quick Header Telemetry Chips */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <div className="rounded-2xl bg-black/30 border border-white/20 p-3.5 backdrop-blur-md text-right min-w-[130px]">
              <span className="text-[10px] uppercase font-bold text-white/70 block">
                {isIndividualUserView ? "User's Revenue" : "Total Collections"}
              </span>
              <span className="text-xl font-black text-white font-mono">
                {currencySymbol}{overview ? overview.totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </span>
            </div>

            <div className="rounded-2xl bg-black/30 border border-white/20 p-3.5 backdrop-blur-md text-right min-w-[100px]">
              <span className="text-[10px] uppercase font-bold text-white/70 block">Total Bills</span>
              <span className="text-xl font-black text-white font-mono">
                {overview ? overview.totalBills : '0'}
              </span>
            </div>

            <Link
              href="/products"
              className="rounded-2xl bg-black/30 hover:bg-black/50 border border-white/20 p-3.5 backdrop-blur-md text-right min-w-[105px] transition-all cursor-pointer group"
              title="View all products"
            >
              <span className="text-[10px] uppercase font-bold text-white/70 block flex items-center justify-end gap-1 group-hover:text-pink-300">
                <Package className="h-3 w-3" />
                <span>Products</span>
              </span>
              <span className="text-xl font-black text-white font-mono">
                {overview ? overview.totalProducts : '0'}
              </span>
            </Link>

            <Link
              href="/categories"
              className="rounded-2xl bg-black/30 hover:bg-black/50 border border-white/20 p-3.5 backdrop-blur-md text-right min-w-[105px] transition-all cursor-pointer group"
              title="View all categories"
            >
              <span className="text-[10px] uppercase font-bold text-white/70 block flex items-center justify-end gap-1 group-hover:text-amber-300">
                <Layers className="h-3 w-3" />
                <span>Category</span>
              </span>
              <span className="text-xl font-black text-white font-mono">
                {overview ? overview.totalCategories : '0'}
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Interactive Filter & Control Toolbar */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Time Preset Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 lg:pb-0">
          <span className="text-xs font-bold text-zinc-400 mr-1 flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            <span>Period:</span>
          </span>
          {(['today', 'yesterday', 'week', 'month', 'all'] as const).map((p) => {
            const labels: Record<string, string> = {
              today: 'Today',
              yesterday: 'Yesterday',
              week: 'This Week',
              month: 'This Month',
              all: 'All Time',
            };
            const isActive = preset === p;
            return (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-theme-bar text-white shadow-md border border-theme font-black shadow-theme-glow'
                    : 'bg-zinc-950/70 text-zinc-400 hover:text-zinc-200 border border-zinc-800/80'
                }`}
              >
                {labels[p]}
              </button>
            );
          })}
        </div>

        {/* User / Cashier Switcher & Refresh */}
        <div className="flex items-center gap-3 flex-wrap justify-between lg:justify-end">
          {/* User selector dropdown / pills */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-zinc-400" />
              <span>User View:</span>
            </span>
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-1.5 text-xs font-bold text-zinc-200 outline-none focus:border-theme transition cursor-pointer"
              >
                <option value="all">👥 All Company Users & Cashiers</option>
                {data?.usersList?.map((u) => {
                  const roleLabel =
                    u.role === 'company_admin' ? '🛡️ Admin' :
                    u.role === 'manager' ? '📋 Manager' :
                    u.role === 'chef' ? '👨‍🍳 Chef' :
                    u.role === 'waiter' ? '🍽️ Waiter' :
                    u.role === 'cashier' ? '👤 Cashier' :
                    u.role === 'delivery_staff' ? '🚚 Delivery Staff' :
                    `👤 ${u.role}`;
                  return (
                    <option key={u.id} value={u.username}>
                      {roleLabel}: {u.name} (@{u.username})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 border border-zinc-700 transition cursor-pointer active:scale-95 disabled:opacity-50"
            title="Refresh live metrics"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin text-theme-accent' : 'text-zinc-400'}`} />
            <span className="hidden sm:inline">{isFetching ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* 3. Individual User Filter Highlight Banner (When a specific user is selected) */}
      {isIndividualUserView && activeUserObj && (
        <div className="rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-zinc-900 p-4 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-black">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Individual Dashboard Report
                </span>
                <span className="rounded bg-emerald-950 border border-emerald-800 text-[10px] font-mono px-1.5 py-0.5 text-emerald-300">
                  {activeUserObj.role === 'company_admin' ? 'Company Admin' :
                   activeUserObj.role === 'manager' ? 'Manager' :
                   activeUserObj.role === 'chef' ? 'Chef' :
                   activeUserObj.role === 'waiter' ? 'Waiter' :
                   activeUserObj.role === 'cashier' ? 'Cashier' :
                   activeUserObj.role === 'delivery_staff' ? 'Delivery Staff' : activeUserObj.role}
                </span>
              </div>
              <h2 className="text-base font-black text-white">
                {activeUserObj.name} (@{activeUserObj.username})
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-zinc-400 uppercase font-bold block">User Collections Share</span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {activeUserObj.percentShare}% of Company Total
              </span>
            </div>

            <button
              onClick={() => setSelectedUserId('all')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 border border-zinc-700 transition cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5 text-zinc-400" />
              <span>Reset to All Users</span>
            </button>
          </div>
        </div>
      )}

      {/* Error Notice if any */}
      {error && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/40 p-4 text-xs font-bold text-red-200 flex items-center justify-between">
          <span>Error loading dashboard metrics: {error}</span>
          <button onClick={() => refetch()} className="underline hover:text-white cursor-pointer">
            Retry
          </button>
        </div>
      )}

      {/* 4. Complete Collections & Catalog Report (Hero KPI Cards Grid) */}
      {isLoading && !data ? (
        <KpiGridSkeleton />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {/* Card 1: Total Gross Collections */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-theme relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                {isIndividualUserView ? "User Collections" : "Total Collections"}
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {currencySymbol}{overview ? overview.totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </h3>
            </div>
            <CircleDollarSign className="h-6 w-6 text-theme-accent shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span>{overview ? overview.totalBills : 0} bills invoiced</span>
            <span className="font-mono text-zinc-300">
              Avg: {currencySymbol}{overview ? overview.avgBillValue.toLocaleString('en-IN') : '0'}
            </span>
          </p>
        </div>

        {/* Card 2: Cash Drawer Collections */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-emerald-500/50 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Cash Collections
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {currencySymbol}{overview ? overview.collections.cash.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </h3>
            </div>
            <Banknote className="h-6 w-6 text-emerald-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span>{overview ? overview.collections.cash.count : 0} cash bills</span>
            <span className="font-mono text-emerald-400">
              {overview ? overview.collections.cash.percent : 0}% of total
            </span>
          </p>
        </div>

        {/* Card 3: UPI / QR Collections */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-purple-500/50 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-400">
                UPI / QR Digital
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {currencySymbol}{overview ? overview.collections.upi.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </h3>
            </div>
            <QrCode className="h-6 w-6 text-purple-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span>{overview ? overview.collections.upi.count : 0} UPI bills</span>
            <span className="font-mono text-purple-400">
              {overview ? overview.collections.upi.percent : 0}% of total
            </span>
          </p>
        </div>

        {/* Card 4: Card POS Collections */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-cyan-500/50 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                Card POS Swipes
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {currencySymbol}{overview ? overview.collections.card.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </h3>
            </div>
            <CreditCard className="h-6 w-6 text-cyan-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span>{overview ? overview.collections.card.count : 0} card bills</span>
            <span className="font-mono text-cyan-400">
              {overview ? overview.collections.card.percent : 0}% of total
            </span>
          </p>
        </div>

        {/* Card 5: Credit / Bill Only Collections */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-amber-500/50 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Credit / Bill Only
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {currencySymbol}{overview ? overview.collections.billOnly.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
              </h3>
            </div>
            <Clock className="h-6 w-6 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span>{overview ? overview.collections.billOnly.count : 0} unsettled</span>
            <span className="font-mono text-amber-400">Pay Later</span>
          </p>
        </div>

        {/* Card 6: Total Products */}
        <Link
          href="/products"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-pink-500/60 hover:bg-zinc-900/90 relative overflow-hidden group cursor-pointer block"
          title="Open Products & Menu Collection"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-pink-400 flex items-center gap-1">
                <span>Total Products</span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {overview ? overview.totalProducts : 0}
              </h3>
            </div>
            <Package className="h-6 w-6 text-pink-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span className="text-zinc-400">Catalog Menu</span>
            {overview && overview.lowStockCount > 0 ? (
              <span className="font-mono text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {overview.lowStockCount} low
              </span>
            ) : (
              <span className="font-mono text-emerald-400">Healthy Stock</span>
            )}
          </p>
        </Link>

        {/* Card 7: Total Category */}
        <Link
          href="/categories"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 shadow-xl transition-all hover:border-amber-500/60 hover:bg-zinc-900/90 relative overflow-hidden group cursor-pointer block"
          title="Open Categories Collection"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                <span>Total Category</span>
                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <h3 className="mt-2 text-2xl font-black text-white font-mono">
                {overview ? overview.totalCategories : 0}
              </h3>
            </div>
            <Layers className="h-6 w-6 text-amber-400 shrink-0 group-hover:scale-110 transition-transform" />
          </div>
          <p className="mt-3 text-[11px] font-medium text-zinc-400 flex items-center justify-between">
            <span className="text-zinc-400">Menu Groups</span>
            <span className="font-mono text-zinc-400 group-hover:text-zinc-200 transition">View All →</span>
          </p>
        </Link>
      </div>
      )}

      {/* 5. Dynamic Interactive Graphs Grid ("dyanmic graft design") */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Collections Timeline Chart (7 Columns) */}
        <div className="lg:col-span-7">
          <CollectionsTimelineChart
            points={data?.timelineGraph?.points || []}
            currencySymbol={currencySymbol}
            type={data?.timelineGraph?.type || 'hourly'}
            peakLabel={data?.timelineGraph?.peakLabel}
            peakAmount={data?.timelineGraph?.peakAmount}
          />
        </div>

        {/* Payment Methods Split Donut (5 Columns) */}
        <div className="lg:col-span-5">
          <PaymentCollectionsDonut
            slices={data?.paymentDonut || []}
            totalAmount={overview?.totalCollections || 0}
            currencySymbol={currencySymbol}
          />
        </div>
      </div>

      {/* 6. Hourly Rush Traffic Heatmap */}
      <div>
        <HourlyRushChart
          hourlyData={data?.hourlyRush || []}
          currencySymbol={currencySymbol}
        />
      </div>

      {/* Shift Management Live Roster & Upcoming Alerts */}
      <div>
        <UpcomingShiftsCard />
      </div>

      {/* 7. Dedicated Staff & User Collections Report */}
      <div>
        <UserCollectionsTable
          usersList={data?.usersList || []}
          selectedUserId={selectedUserId}
          onSelectUser={(uId) => setSelectedUserId(uId)}
          currencySymbol={currencySymbol}
          companyTotal={overview?.totalCollections || 0}
        />
      </div>

      {/* 8. Live Invoices Feed & Quick Action Buttons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Live Collections Feed (8 cols) */}
        <div className="lg:col-span-8">
          <LiveCollectionsFeed
            bills={data?.recentBills || []}
            currencySymbol={currencySymbol}
          />
        </div>

        {/* Right: Quick Actions Panel & Shortcuts (4 cols) */}
        <div className="lg:col-span-4 flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Sparkles className="h-4 w-4 text-theme-accent" />
              </span>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">Quick Actions</h3>
                <p className="text-xs text-zinc-400">Direct terminal & operational shortcuts</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <Link
                href="/terminal"
                className="flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer active:scale-95 bg-theme-bar hover:opacity-95 text-white shadow-lg shadow-theme-glow border border-theme"
              >
                <div className="mb-2.5 rounded-xl p-3 bg-white/20 text-white">
                  <Monitor className="h-6 w-6" />
                </div>
                <span className="text-xs font-black tracking-wide">New Sale / POS</span>
              </Link>

              <Link
                href="/products"
                className="flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer active:scale-95 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30"
              >
                <div className="mb-2.5 rounded-xl p-3 bg-white/20 text-white">
                  <PackagePlus className="h-6 w-6" />
                </div>
                <span className="text-xs font-black tracking-wide">Add Product</span>
              </Link>

              <Link
                href="/reports"
                className="flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer active:scale-95 bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-200"
              >
                <div className="mb-2.5 rounded-xl p-3 bg-zinc-900 text-cyan-400 border border-zinc-700/60">
                  <FileBarChart className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold tracking-wide">Advanced Reports</span>
              </Link>

              <Link
                href="/staff"
                className="flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer active:scale-95 bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-zinc-200"
              >
                <div className="mb-2.5 rounded-xl p-3 bg-zinc-900 text-emerald-400 border border-zinc-700/60">
                  <Users className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold tracking-wide">Staff & Shifts</span>
              </Link>
            </div>
          </div>

          {/* Quick Summary Pill Footer */}
          <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
            <span>Last refreshed: {lastRefreshed || 'Just now'}</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
