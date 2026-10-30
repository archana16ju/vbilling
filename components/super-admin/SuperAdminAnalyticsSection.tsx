'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Users,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  CreditCard,
  ShoppingBag,
  Package,
  UserCheck,
  UserPlus,
  RefreshCw,
  Maximize2,
  Calendar,
  Filter,
  BarChart3,
  PieChart,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Info,
  Clock,
  Truck,
  UtensilsCrossed,
  Coins,
  AlertTriangle,
  ChevronDown,
} from 'lucide-react';
import ChartExpandModal from './ChartExpandModal';

interface OverviewCard {
  id: string;
  title: string;
  value: number;
  isCurrency?: boolean;
  subtext: string;
  trend: 'up' | 'down' | 'neutral';
  changePct: number;
  icon: string;
  reportTarget: string;
  color: string;
}

interface TimelinePoint {
  label: string;
  date: string;
  amount: number;
  bills: number;
  aov: number;
}

interface CompanyComparison {
  id: string;
  name: string;
  code: string;
  sales: number;
  bills: number;
  customers: number;
  aov: number;
}

interface ProductItem {
  id: string;
  name: string;
  categoryId: string;
  quantity: number;
  revenue: number;
}

interface CategoryItem {
  id: string;
  name: string;
  quantity: number;
  revenue: number;
  percent: number;
}

interface AnalyticsData {
  scope: {
    companyId: string;
    isAllCompanies: boolean;
    preset: string;
    dateRange: {
      currentStart: string;
      currentEnd: string;
      previousStart: string;
      previousEnd: string;
    };
  };
  companiesList: { id: string; name: string; code: string; isActive: boolean; currency: string }[];
  overviewCards: OverviewCard[];
  salesAnalytics: {
    totalSales: number;
    totalBills: number;
    averageBillValue: number;
    growthPercentage: number;
    timelineType: 'hourly' | 'daily';
    timelinePoints: TimelinePoint[];
  };
  companyAnalytics: {
    totalCompanies: number;
    activeCompanies: number;
    inactiveCompanies: number;
    companyWiseComparison: CompanyComparison[];
  };
  productAnalytics: {
    totalProducts: number;
    topSellingProducts: ProductItem[];
    leastSellingProducts: ProductItem[];
    categorySales: CategoryItem[];
  };
  customerAnalytics: {
    totalCustomers: number;
    newCustomers: number;
    returningCustomers: number;
    activeCustomerList: { name: string; phone: string; visits: number; spent: number }[];
  };
  staffAnalytics: {
    totalStaff: number;
    userRoleCounts: Record<string, number>;
    staffRoleBreakdown: Record<string, number>;
  };
  ordersAnalytics: {
    totalOrders: number;
    byType: {
      dineIn: { amount: number; count: number };
      takeaway: { amount: number; count: number };
      delivery: { amount: number; count: number };
      online: { amount: number; count: number };
    };
    byStatus: { completed: number; pending: number; cancelled: number };
  };
  financialAnalytics: {
    grossSales: number;
    subtotal: number;
    totalTax: number;
    totalDiscount: number;
    operatingExpenses: number;
    netCashIntake: number;
    grossProfitStatus: string;
    grossProfitNote: string;
    netProfitStatus: string;
    netProfitNote: string;
    paymentDonutSlices: { method: string; label: string; amount: number; count: number; percent: number; color: string }[];
    expenseCategorySlices: { category: string; amount: number; percent: number }[];
  };
}

interface SuperAdminAnalyticsSectionProps {
  data: AnalyticsData;
  isLoading: boolean;
  selectedCompanyId: string;
  selectedPreset: string;
  customStartDate: string;
  customEndDate: string;
  currencySymbol?: string;
  onCompanyChange: (companyId: string) => void;
  onPresetChange: (preset: string) => void;
  onCustomDateChange: (start: string, end: string) => void;
  onRefresh: () => void;
  onSelectReport: (reportKey: string, companyId?: string) => void;
}

const PRESET_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

export default function SuperAdminAnalyticsSection({
  data,
  isLoading,
  selectedCompanyId,
  selectedPreset,
  customStartDate,
  customEndDate,
  currencySymbol = '₹',
  onCompanyChange,
  onPresetChange,
  onCustomDateChange,
  onRefresh,
  onSelectReport,
}: SuperAdminAnalyticsSectionProps) {
  // Sales timeline chart state
  const [salesMetric, setSalesMetric] = useState<'amount' | 'bills' | 'aov'>('amount');
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Custom date range local state
  const [localStart, setLocalStart] = useState(customStartDate || '');
  const [localEnd, setLocalEnd] = useState(customEndDate || '');
  const [isCustomOpen, setIsCustomOpen] = useState(selectedPreset === 'custom');

  // Chart expand modal state
  const [expandedChart, setExpandedChart] = useState<{ title: string; subtitle?: string; content: React.ReactNode } | null>(null);

  // Active hover point in timeline
  const timelinePoints = data?.salesAnalytics?.timelinePoints || [];
  const maxVal = useMemo(() => {
    if (timelinePoints.length === 0) return 100;
    const vals = timelinePoints.map((p) => (salesMetric === 'amount' ? p.amount : salesMetric === 'bills' ? p.bills : p.aov));
    const m = Math.max(...vals);
    return m > 0 ? m * 1.15 : 10;
  }, [timelinePoints, salesMetric]);

  // SVG Calculations for Sales Timeline Chart
  const svgWidth = 840;
  const svgHeight = 240;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 35;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingTop - paddingBottom;

  const coordinates = useMemo(() => {
    if (timelinePoints.length === 0) return [];
    const step = chartW / Math.max(1, timelinePoints.length - 1);
    return timelinePoints.map((p, idx) => {
      const val = salesMetric === 'amount' ? p.amount : salesMetric === 'bills' ? p.bills : p.aov;
      const x = paddingX + idx * step;
      const y = paddingTop + chartH - (val / maxVal) * chartH;
      return { x, y, point: p, val };
    });
  }, [timelinePoints, salesMetric, maxVal, chartW, chartH]);

  // Bézier curve calculation
  const { linePath, areaPath } = useMemo(() => {
    if (coordinates.length === 0) return { linePath: '', areaPath: '' };
    if (coordinates.length === 1) {
      const { x, y } = coordinates[0];
      return {
        linePath: `M ${x} ${y} L ${x + 60} ${y}`,
        areaPath: `M ${x} ${y} L ${x + 60} ${y} L ${x + 60} ${paddingTop + chartH} L ${x} ${paddingTop + chartH} Z`,
      };
    }

    let d = `M ${coordinates[0].x} ${coordinates[0].y}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p0 = coordinates[i];
      const p1 = coordinates[i + 1];
      const cpX = (p0.x + p1.x) / 2;
      d += ` C ${cpX} ${p0.y}, ${cpX} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const firstX = coordinates[0].x;
    const lastX = coordinates[coordinates.length - 1].x;
    const bottomY = paddingTop + chartH;
    const area = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { linePath: d, areaPath: area };
  }, [coordinates, chartH]);

  const activeHovered = hoveredPointIndex !== null && coordinates[hoveredPointIndex] ? coordinates[hoveredPointIndex] : null;

  const handleApplyCustomDate = (e: React.FormEvent) => {
    e.preventDefault();
    if (localStart && localEnd) {
      onCustomDateChange(localStart, localEnd);
    }
  };

  const getIconComponent = (name: string) => {
    switch (name) {
      case 'Building2': return Building2;
      case 'CheckCircle': return CheckCircle;
      case 'XCircle': return XCircle;
      case 'Users': return Users;
      case 'UserCheck': return UserCheck;
      case 'Package': return Package;
      case 'UserPlus': return UserPlus;
      case 'DollarSign': return DollarSign;
      case 'Receipt': return Receipt;
      case 'CreditCard': return CreditCard;
      case 'ShoppingBag': return ShoppingBag;
      default: return DollarSign;
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* ========================================================= */}
      {/* SECTION 1: GLOBAL FILTER BAR (Company + Date + Actions) */}
      {/* ========================================================= */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 sm:p-5 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Company Dropdown Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Company Scope
              </label>
              <select
                value={selectedCompanyId}
                onChange={(e) => onCompanyChange(e.target.value)}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-hidden focus:border-pink-500 cursor-pointer min-w-[180px]"
              >
                <option value="all">🏢 All Companies (Aggregated)</option>
                {data?.companiesList?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code}) {!c.isActive ? '• [Inactive]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="h-8 w-px bg-zinc-800 hidden sm:block" />

          {/* Date Preset Dropdown */}
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Calendar className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Date Range Filter
              </label>
              <select
                value={selectedPreset}
                onChange={(e) => {
                  const val = e.target.value;
                  onPresetChange(val);
                  setIsCustomOpen(val === 'custom');
                }}
                className="bg-zinc-950 border border-zinc-700 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-hidden focus:border-pink-500 cursor-pointer min-w-[160px]"
              >
                {PRESET_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    📅 {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Refresh & Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {data?.scope?.dateRange && (
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] font-mono text-zinc-400">
              <span>{data.scope.dateRange.currentStart.slice(0, 10)}</span>
              <span>to</span>
              <span>{data.scope.dateRange.currentEnd.slice(0, 10)}</span>
            </div>
          )}

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/90 hover:bg-zinc-700 hover:text-white px-3.5 py-2 text-xs font-bold text-zinc-200 transition cursor-pointer active:scale-95 shadow-sm disabled:opacity-50"
            title="Refresh Analytics with latest database records"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-pink-400' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Bar (Expandable) */}
      {isCustomOpen && (
        <form onSubmit={handleApplyCustomDate} className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4 shadow-lg flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold text-pink-400 flex items-center gap-1.5">
            <Filter className="h-4 w-4" />
            Custom Date Interval:
          </span>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-zinc-400">Start:</label>
            <input
              type="date"
              value={localStart}
              onChange={(e) => setLocalStart(e.target.value)}
              required
              className="rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-pink-500 font-mono"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-zinc-400">End:</label>
            <input
              type="date"
              value={localEnd}
              onChange={(e) => setLocalEnd(e.target.value)}
              required
              className="rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-1.5 text-xs text-white focus:outline-hidden focus:border-pink-500 font-mono"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl btn-theme-primary px-4 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer active:scale-95"
          >
            Apply Range
          </button>
        </form>
      )}

      {/* ========================================================= */}
      {/* SECTION 2: TOP OVERVIEW KPI STATISTIC CARDS */}
      {/* ========================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-pink-400" />
            Executive Telemetry & KPI Cards ({data?.overviewCards?.length || 0})
          </h2>
          <span className="text-[11px] text-zinc-500">
            Click any card to open the corresponding detailed report
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3.5">
          {data?.overviewCards?.map((card) => {
            const Icon = getIconComponent(card.icon);
            const isPos = card.trend === 'up';
            const isNeg = card.trend === 'down';

            return (
              <div
                key={card.id}
                onClick={() => onSelectReport(card.reportTarget, selectedCompanyId !== 'all' ? selectedCompanyId : undefined)}
                className="group relative rounded-2xl border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-800/80 p-4 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:border-zinc-700 flex flex-col justify-between overflow-hidden"
                title={`Click to open ${card.title} report`}
              >
                {/* Micro hover glow */}
                <div className="absolute right-0 top-0 -mt-4 -mr-4 h-16 w-16 rounded-full bg-pink-500/10 blur-xl opacity-0 group-hover:opacity-100 transition duration-300 pointer-events-none" />

                <div>
                  <div className="flex items-center justify-between text-zinc-400 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 truncate max-w-[120px]">
                      {card.title}
                    </span>
                    <span className="p-1.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-400 group-hover:text-pink-400 group-hover:border-pink-500/30 transition">
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                  </div>

                  <div className="text-2xl font-black text-white font-mono tracking-tight group-hover:scale-[1.02] transition-transform origin-left">
                    {card.isCurrency
                      ? `${currencySymbol}${card.value.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                      : card.value.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px]">
                  <span className="text-zinc-500 truncate max-w-[110px]" title={card.subtext}>
                    {card.subtext}
                  </span>
                  {card.changePct !== 0 && (
                    <span
                      className={`inline-flex items-center gap-0.5 font-bold font-mono px-1.5 py-0.5 rounded ${
                        isPos
                          ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-900/60'
                          : isNeg
                          ? 'text-red-400 bg-red-950/60 border border-red-900/60'
                          : 'text-zinc-400 bg-zinc-800'
                      }`}
                    >
                      {isPos ? <ArrowUpRight className="h-3 w-3" /> : isNeg ? <ArrowDownRight className="h-3 w-3" /> : null}
                      {card.changePct > 0 ? `+${card.changePct}%` : `${card.changePct}%`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 3: CHARTS GRID */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ------------------------------------------------------- */}
        {/* A. SALES VELOCITY & TIMELINE CHART (Spans 8 columns) */}
        {/* ------------------------------------------------------- */}
        <div className="lg:col-span-8 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 relative z-10">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
                  <TrendingUp className="h-4 w-4 text-theme-accent" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Sales Trajectory & Order Velocity
                  </h3>
                  <p className="text-xs text-zinc-400">
                    {data?.salesAnalytics?.timelineType === 'hourly'
                      ? 'Hourly distribution curve across 24-hour cycle'
                      : 'Daily revenue and invoice flow timeline'}
                  </p>
                </div>
              </div>
            </div>

            {/* Metric Toggle Buttons */}
            <div className="flex items-center gap-2">
              <div className="flex rounded-xl bg-zinc-950/80 p-1 border border-zinc-800 text-xs font-bold">
                <button
                  onClick={() => setSalesMetric('amount')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    salesMetric === 'amount'
                      ? 'bg-theme-bar text-white shadow-md border border-theme font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <DollarSign className="h-3.5 w-3.5" />
                  <span>Revenue ({currencySymbol})</span>
                </button>
                <button
                  onClick={() => setSalesMetric('bills')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    salesMetric === 'bills'
                      ? 'bg-theme-bar text-white shadow-md border border-theme font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Receipt className="h-3.5 w-3.5" />
                  <span>Bills</span>
                </button>
                <button
                  onClick={() => setSalesMetric('aov')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    salesMetric === 'aov'
                      ? 'bg-theme-bar text-white shadow-md border border-theme font-black'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Coins className="h-3.5 w-3.5" />
                  <span>Avg Ticket</span>
                </button>
              </div>

              <button
                onClick={() =>
                  setExpandedChart({
                    title: 'Sales Trajectory & Order Velocity',
                    subtitle: `Filtered for: ${selectedCompanyId === 'all' ? 'All Companies' : selectedCompanyId}`,
                    content: (
                      <div className="space-y-4">
                        <div className="h-96 w-full flex items-center justify-center">
                          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
                            {linePath && <path d={linePath} fill="none" stroke="#DB2777" strokeWidth="4" />}
                            {areaPath && <path d={areaPath} fill="rgba(219,39,119,0.15)" />}
                          </svg>
                        </div>
                      </div>
                    ),
                  })
                }
                className="p-2 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white transition cursor-pointer"
                title="Expand Chart"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* SVG Canvas */}
          <div className="relative w-full overflow-hidden select-none my-2">
            {timelinePoints.length === 0 ? (
              <div className="flex h-56 items-center justify-center text-sm text-zinc-500 font-medium">
                No transaction records found in this date window.
              </div>
            ) : (
              <div className="relative w-full">
                <svg
                  viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                  className="w-full h-56 sm:h-64 overflow-visible"
                  preserveAspectRatio="none"
                  onMouseLeave={() => setHoveredPointIndex(null)}
                >
                  <defs>
                    <linearGradient id="superAdminChartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--theme-accent, #DB2777)" stopOpacity="0.4" />
                      <stop offset="70%" stopColor="var(--theme-accent, #DB2777)" stopOpacity="0.05" />
                      <stop offset="100%" stopColor="var(--theme-accent, #DB2777)" stopOpacity="0.0" />
                    </linearGradient>

                    <linearGradient id="superAdminStrokeGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--theme-accent, #DB2777)" />
                      <stop offset="50%" stopColor="#8B5CF6" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                  </defs>

                  {/* Reference Grid lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                    const y = paddingTop + chartH * (1 - ratio);
                    return (
                      <line
                        key={ratio}
                        x1={paddingX}
                        y1={y}
                        x2={svgWidth - paddingX}
                        y2={y}
                        stroke="rgba(255,255,255,0.06)"
                        strokeDasharray="4 4"
                      />
                    );
                  })}

                  {/* Area fill */}
                  {areaPath && <path d={areaPath} fill="url(#superAdminChartGradient)" />}

                  {/* Curve stroke */}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="url(#superAdminStrokeGradient)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Hover vertical line */}
                  {activeHovered && (
                    <line
                      x1={activeHovered.x}
                      y1={paddingTop}
                      x2={activeHovered.x}
                      y2={paddingTop + chartH}
                      stroke="rgba(255,255,255,0.4)"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}

                  {/* Data Points */}
                  {coordinates.map((c, idx) => {
                    const isHovered = hoveredPointIndex === idx;
                    const hasVal = c.val > 0;
                    return (
                      <g key={idx}>
                        {(hasVal || isHovered) && (
                          <circle
                            cx={c.x}
                            cy={c.y}
                            r={isHovered ? 7 : 4}
                            fill="#09090b"
                            stroke={isHovered ? '#ffffff' : 'var(--theme-accent, #DB2777)'}
                            strokeWidth={isHovered ? 3 : 2}
                            className="transition-all duration-150"
                          />
                        )}

                        <rect
                          x={c.x - (chartW / coordinates.length) / 2}
                          y={paddingTop}
                          width={chartW / coordinates.length}
                          height={chartH + 10}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredPointIndex(idx)}
                        />
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {coordinates.map((c, idx) => {
                    const total = coordinates.length;
                    const show = total <= 8 || idx === 0 || idx === total - 1 || idx % Math.ceil(total / 6) === 0;
                    if (!show) return null;
                    return (
                      <text
                        key={idx}
                        x={c.x}
                        y={svgHeight - 8}
                        textAnchor="middle"
                        fill="rgba(161, 161, 170, 0.8)"
                        fontSize="10"
                        fontWeight="600"
                        fontFamily="monospace"
                      >
                        {c.point.label}
                      </text>
                    );
                  })}
                </svg>

                {/* Floating Interactive Tooltip */}
                {activeHovered && (
                  <div
                    className="absolute pointer-events-none z-30 transition-all duration-75"
                    style={{
                      left: `${(activeHovered.x / svgWidth) * 100}%`,
                      top: `${(activeHovered.y / svgHeight) * 100}%`,
                      transform: 'translate(-50%, -120%)',
                    }}
                  >
                    <div className="rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md whitespace-nowrap">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                        {activeHovered.point.label} ({activeHovered.point.date})
                      </div>
                      <div className="flex items-center gap-3">
                        <div>
                          <span className="text-[10px] text-zinc-400">Revenue: </span>
                          <span className="font-mono font-black text-pink-400">
                            {currencySymbol}{activeHovered.point.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400">Bills: </span>
                          <span className="font-mono font-black text-indigo-400">
                            {activeHovered.point.bills}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-zinc-400">AOV: </span>
                          <span className="font-mono font-black text-emerald-400">
                            {currencySymbol}{activeHovered.point.aov.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Metrics Row */}
          <div className="mt-4 pt-4 border-t border-zinc-800/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-zinc-950/50 rounded-xl p-2.5 border border-zinc-800/50">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">
                Total Revenue
              </span>
              <span className="text-sm font-black text-white font-mono">
                {currencySymbol}{(data?.salesAnalytics?.totalSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-2.5 border border-zinc-800/50">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">
                Total Bills
              </span>
              <span className="text-sm font-black text-indigo-300 font-mono">
                {(data?.salesAnalytics?.totalBills || 0).toLocaleString()} Orders
              </span>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-2.5 border border-zinc-800/50">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">
                Avg Bill Value (AOV)
              </span>
              <span className="text-sm font-black text-emerald-400 font-mono">
                {currencySymbol}{(data?.salesAnalytics?.averageBillValue || 0).toFixed(2)}
              </span>
            </div>
            <div className="bg-zinc-950/50 rounded-xl p-2.5 border border-zinc-800/50">
              <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">
                Sales Growth
              </span>
              <span className={`text-sm font-black font-mono flex items-center gap-1 ${
                (data?.salesAnalytics?.growthPercentage || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {(data?.salesAnalytics?.growthPercentage || 0) >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {data?.salesAnalytics?.growthPercentage || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------- */}
        {/* B. COMPANY-WISE SALES BREAKDOWN (Spans 4 columns) */}
        {/* ------------------------------------------------------- */}
        <div className="lg:col-span-4 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <BarChart3 className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Company Revenue Matrix
                  </h3>
                  <p className="text-xs text-zinc-400">Company-wise comparison</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              {data?.companyAnalytics?.companyWiseComparison?.map((c) => {
                const totalAll = data?.salesAnalytics?.totalSales || 1;
                const pct = Math.round((c.sales / totalAll) * 100);

                return (
                  <div
                    key={c.id}
                    onClick={() => onSelectReport('company_sales', c.id)}
                    className="p-3 rounded-2xl border border-zinc-800/70 bg-zinc-950/50 hover:bg-zinc-800/50 transition cursor-pointer"
                  >
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{c.name}</span>
                        <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono text-pink-300">
                          {c.code}
                        </span>
                      </div>
                      <span className="font-mono font-black text-emerald-400">
                        {currencySymbol}{c.sales.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1.5">
                      <span>{c.bills} bills • AOV: {currencySymbol}{c.aov.toFixed(1)}</span>
                      <span className="font-bold text-zinc-300">{pct}% share</span>
                    </div>

                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full"
                        style={{ width: `${Math.max(pct, c.sales > 0 ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 text-[11px] text-zinc-500 flex justify-between">
            <span>Isolation: Strict tenant boundary</span>
            <span className="font-bold text-pink-400 cursor-pointer" onClick={() => onSelectReport('company_sales')}>
              Full Matrix &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 4: PRODUCT & CATEGORY ANALYTICS */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Top 10 Selling Products */}
        <div className="lg:col-span-7 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Package className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Top-Selling Products Leaderboard
                  </h3>
                  <p className="text-xs text-zinc-400">Ranked by volume and revenue generated</p>
                </div>
              </div>
              <button
                onClick={() => onSelectReport('top_selling_products')}
                className="text-xs font-bold text-pink-400 hover:text-pink-300 transition cursor-pointer"
              >
                View All &rarr;
              </button>
            </div>

            <div className="space-y-2 mt-3">
              {data?.productAnalytics?.topSellingProducts?.slice(0, 6).map((p, idx) => {
                const maxRev = data?.productAnalytics?.topSellingProducts[0]?.revenue || 1;
                const barWidth = Math.round((p.revenue / maxRev) * 100);

                return (
                  <div key={p.id} className="p-2.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-mono font-bold text-zinc-400">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-white truncate max-w-[200px]">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-zinc-400 font-mono">{p.quantity} sold</span>
                        <span className="font-mono font-black text-emerald-400">
                          {currencySymbol}{p.revenue.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-800/60 rounded-full h-1 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Category Share Donut / Breakdown */}
        <div className="lg:col-span-5 rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
                  <Layers className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-base font-black text-white tracking-tight">
                    Category Turnover Share
                  </h3>
                  <p className="text-xs text-zinc-400">Sales volume by menu category</p>
                </div>
              </div>
            </div>

            <div className="space-y-2.5 mt-3">
              {data?.productAnalytics?.categorySales?.slice(0, 5).map((cat) => (
                <div key={cat.id} className="p-2.5 rounded-xl border border-zinc-800/60 bg-zinc-950/40 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">{cat.name}</span>
                    <span className="text-[10px] text-zinc-400 font-mono">{cat.quantity} units sold</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-black text-white block">
                      {currencySymbol}{cat.revenue.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                    </span>
                    <span className="text-[10px] font-bold text-teal-400">{cat.percent}% share</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between text-xs text-zinc-500">
            <span>Categories cataloged</span>
            <span className="font-bold text-pink-400 cursor-pointer" onClick={() => onSelectReport('category_sales')}>
              Category Report &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* SECTION 5: ORDERS, CUSTOMERS & FINANCIAL ANALYTICS */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Orders by Type */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 border border-orange-500/20">
                <ShoppingBag className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Orders Distribution
                </h3>
                <p className="text-xs text-zinc-400">Dine-in vs Delivery vs Takeaway</p>
              </div>
            </div>

            <div className="space-y-3 mt-4">
              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 font-bold text-zinc-300">
                  <UtensilsCrossed className="h-4 w-4 text-orange-400" /> Dine In
                </span>
                <span className="font-mono font-black text-white">
                  {data?.ordersAnalytics?.byType?.dineIn?.count || 0} orders ({currencySymbol}{(data?.ordersAnalytics?.byType?.dineIn?.amount || 0).toLocaleString('en-IN')})
                </span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 font-bold text-zinc-300">
                  <Truck className="h-4 w-4 text-blue-400" /> Delivery
                </span>
                <span className="font-mono font-black text-white">
                  {data?.ordersAnalytics?.byType?.delivery?.count || 0} orders ({currencySymbol}{(data?.ordersAnalytics?.byType?.delivery?.amount || 0).toLocaleString('en-IN')})
                </span>
              </div>

              <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/50 flex justify-between items-center text-xs">
                <span className="flex items-center gap-2 font-bold text-zinc-300">
                  <Package className="h-4 w-4 text-pink-400" /> Takeaway
                </span>
                <span className="font-mono font-black text-white">
                  {data?.ordersAnalytics?.byType?.takeaway?.count || 0} orders ({currencySymbol}{(data?.ordersAnalytics?.byType?.takeaway?.amount || 0).toLocaleString('en-IN')})
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between text-xs text-zinc-500">
            <span>Status: {data?.ordersAnalytics?.byStatus?.completed || 0} Completed</span>
            <span className="font-bold text-pink-400 cursor-pointer" onClick={() => onSelectReport('dine_in_orders')}>
              Orders Report &rarr;
            </span>
          </div>
        </div>

        {/* Customer Analytics */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Users className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Customer Loyalty & Repeat Visits
                </h3>
                <p className="text-xs text-zinc-400">New vs Returning analysis</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                  Returning Customers
                </span>
                <span className="text-2xl font-black text-cyan-300 font-mono">
                  {data?.customerAnalytics?.returningCustomers || 0}
                </span>
                <span className="text-[10px] text-cyan-400 block mt-1">Multi-visit regulars</span>
              </div>

              <div className="p-4 rounded-2xl border border-zinc-800 bg-zinc-950/60 text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500 block mb-1">
                  New Customers
                </span>
                <span className="text-2xl font-black text-emerald-300 font-mono">
                  {data?.customerAnalytics?.newCustomers || 0}
                </span>
                <span className="text-[10px] text-emerald-400 block mt-1">First-time visits</span>
              </div>
            </div>

            <div className="mt-4 p-3 rounded-xl border border-zinc-800/60 bg-zinc-950/40 text-xs">
              <span className="text-zinc-400 block font-bold mb-1">Top Visiting Regulars:</span>
              <div className="space-y-1">
                {data?.customerAnalytics?.activeCustomerList?.slice(0, 3).map((c, i) => (
                  <div key={i} className="flex justify-between text-[11px] text-zinc-300">
                    <span>{c.name}</span>
                    <span className="font-mono text-cyan-400">{c.visits} visits ({currencySymbol}{c.spent.toFixed(0)})</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between text-xs text-zinc-500">
            <span>Customer loyalty metrics</span>
            <span className="font-bold text-pink-400 cursor-pointer" onClick={() => onSelectReport('customer_growth')}>
              Full Directory &rarr;
            </span>
          </div>
        </div>

        {/* Financial & Profit Accounting Notice */}
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-base font-black text-white tracking-tight">
                  Financial & Margin Accounting
                </h3>
                <p className="text-xs text-zinc-400">Revenue, expenses & honest margin</p>
              </div>
            </div>

            <div className="space-y-2 mt-4 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50">
                <span className="text-zinc-400">Gross Sales:</span>
                <span className="font-mono font-bold text-white">
                  {currencySymbol}{(data?.financialAnalytics?.grossSales || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50">
                <span className="text-zinc-400">Operating Expenses:</span>
                <span className="font-mono font-bold text-red-400">
                  -{currencySymbol}{(data?.financialAnalytics?.operatingExpenses || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/50">
                <span className="text-zinc-400">Operating Cash Flow:</span>
                <span className="font-mono font-bold text-emerald-400">
                  {currencySymbol}{(data?.financialAnalytics?.netCashIntake || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Data Limitation Notice as per strict prompt requirement */}
              <div className="p-2.5 rounded-xl border border-amber-900/50 bg-amber-950/20 text-[10px] text-amber-300">
                <div className="flex items-center gap-1.5 font-bold mb-0.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <span>COGS Accounting Notice</span>
                </div>
                <p className="text-amber-300/80 leading-relaxed">
                  Gross profit is withheld because raw material purchase COGS is not recorded in product tables. Metric distinguished to preserve audit accuracy.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-between text-xs text-zinc-500">
            <span>Accounting Compliance</span>
            <span className="font-bold text-pink-400 cursor-pointer" onClick={() => onSelectReport('profit_loss_report')}>
              P&L Statement &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* Chart Expand Modal */}
      {expandedChart && (
        <ChartExpandModal
          title={expandedChart.title}
          subtitle={expandedChart.subtitle}
          isOpen={true}
          onClose={() => setExpandedChart(null)}
        >
          {expandedChart.content}
        </ChartExpandModal>
      )}
    </div>
  );
}
