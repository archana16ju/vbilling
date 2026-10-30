'use client';

import React, { useState, useMemo } from 'react';
import { TrendingUp, DollarSign, Receipt, Sparkles } from 'lucide-react';

interface TimelinePoint {
  label: string;
  rawDate?: string;
  amount: number;
  bills: number;
}

interface CollectionsTimelineChartProps {
  points: TimelinePoint[];
  currencySymbol?: string;
  type?: 'hourly' | 'daily';
  peakLabel?: string;
  peakAmount?: number;
}

export default function CollectionsTimelineChart({
  points = [],
  currencySymbol = '₹',
  type = 'hourly',
  peakLabel = '',
  peakAmount = 0,
}: CollectionsTimelineChartProps) {
  const [metric, setMetric] = useState<'amount' | 'bills'>('amount');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Filter or clean points
  const activePoints = useMemo(() => {
    if (!points || points.length === 0) return [];
    return points;
  }, [points]);

  const maxVal = useMemo(() => {
    if (activePoints.length === 0) return 100;
    const vals = activePoints.map(p => (metric === 'amount' ? p.amount : p.bills));
    const max = Math.max(...vals);
    return max > 0 ? max * 1.15 : 10;
  }, [activePoints, metric]);

  const totalVal = useMemo(() => {
    return activePoints.reduce((acc, p) => acc + (metric === 'amount' ? p.amount : p.bills), 0);
  }, [activePoints, metric]);

  const avgVal = useMemo(() => {
    if (activePoints.length === 0) return 0;
    return totalVal / activePoints.length;
  }, [activePoints, totalVal]);

  // Chart coordinates SVG calculation
  const width = 800;
  const height = 240;
  const paddingX = 40;
  const paddingTop = 25;
  const paddingBottom = 35;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingTop - paddingBottom;

  const coordinates = useMemo(() => {
    if (activePoints.length === 0) return [];
    const step = chartWidth / Math.max(1, activePoints.length - 1);
    return activePoints.map((p, idx) => {
      const val = metric === 'amount' ? p.amount : p.bills;
      const x = paddingX + idx * step;
      const y = paddingTop + chartHeight - (val / maxVal) * chartHeight;
      return { x, y, point: p, val };
    });
  }, [activePoints, metric, maxVal, chartWidth, chartHeight]);

  // Generate smooth SVG Bézier path
  const { linePath, areaPath } = useMemo(() => {
    if (coordinates.length === 0) return { linePath: '', areaPath: '' };
    if (coordinates.length === 1) {
      const { x, y } = coordinates[0];
      return {
        linePath: `M ${x} ${y} L ${x + 50} ${y}`,
        areaPath: `M ${x} ${y} L ${x + 50} ${y} L ${x + 50} ${paddingTop + chartHeight} L ${x} ${paddingTop + chartHeight} Z`,
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
    const bottomY = paddingTop + chartHeight;

    const area = `${d} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

    return { linePath: d, areaPath: area };
  }, [coordinates, chartHeight]);

  const activeHovered = hoveredIndex !== null && coordinates[hoveredIndex] ? coordinates[hoveredIndex] : null;

  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col justify-between">
      {/* Background glow effect */}
      <div 
        className="absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: 'var(--theme-accent, #10B981)' }}
      />

      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 relative z-10">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="h-4 w-4 text-theme-accent" />
            </span>
            <h3 className="text-base font-black text-white tracking-tight">
              Collections Velocity & Timeline
            </h3>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Dynamic {type === 'hourly' ? 'hourly timeline' : 'daily trajectory'} of collections and order flow
          </p>
        </div>

        {/* Metric Toggles & Peak Tag */}
        <div className="flex items-center gap-2 flex-wrap">
          {peakLabel && peakAmount > 0 && (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-800/80 border border-zinc-700/60 text-[11px] font-semibold text-zinc-300">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Peak:</span>
              <span className="font-bold text-white">{peakLabel}</span>
              <span className="text-emerald-400 font-mono">({currencySymbol}{peakAmount.toLocaleString('en-IN')})</span>
            </div>
          )}

          <div className="flex rounded-xl bg-zinc-950/80 p-1 border border-zinc-800 text-xs font-bold">
            <button
              onClick={() => setMetric('amount')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                metric === 'amount'
                  ? 'bg-theme-bar text-white shadow-md border border-theme font-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <DollarSign className="h-3.5 w-3.5" />
              <span>Revenue ({currencySymbol})</span>
            </button>
            <button
              onClick={() => setMetric('bills')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                metric === 'bills'
                  ? 'bg-theme-bar text-white shadow-md border border-theme font-black'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Receipt className="h-3.5 w-3.5" />
              <span>Orders (Count)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full overflow-hidden select-none">
        {activePoints.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-zinc-500 font-medium">
            No collection data recorded in this period
          </div>
        ) : (
          <div className="relative w-full">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-48 sm:h-56 overflow-visible"
              preserveAspectRatio="none"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--theme-accent, #10B981)" stopOpacity="0.45" />
                  <stop offset="60%" stopColor="var(--theme-accent, #10B981)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--theme-accent, #10B981)" stopOpacity="0.0" />
                </linearGradient>

                <linearGradient id="strokeGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="var(--theme-accent, #10B981)" />
                  <stop offset="50%" stopColor="#06B6D4" />
                  <stop offset="100%" stopColor="#8B5CF6" />
                </linearGradient>
              </defs>

              {/* Horizontal Reference Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = paddingTop + chartHeight * (1 - ratio);
                return (
                  <g key={ratio}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={width - paddingX}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                  </g>
                );
              })}

              {/* Area fill */}
              {areaPath && (
                <path d={areaPath} fill="url(#chartGradient)" />
              )}

              {/* Curve line */}
              {linePath && (
                <path
                  d={linePath}
                  fill="none"
                  stroke="url(#strokeGradient)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Vertical Scrubber Line on Hover */}
              {activeHovered && (
                <line
                  x1={activeHovered.x}
                  y1={paddingTop}
                  x2={activeHovered.x}
                  y2={paddingTop + chartHeight}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />
              )}

              {/* Data points & hit areas */}
              {coordinates.map((c, idx) => {
                const isHovered = hoveredIndex === idx;
                const hasValue = c.val > 0;

                return (
                  <g key={idx}>
                    {/* Glowing outer circle for points with values or hovered */}
                    {(hasValue || isHovered) && (
                      <circle
                        cx={c.x}
                        cy={c.y}
                        r={isHovered ? 7 : 4}
                        fill="#09090b"
                        stroke={isHovered ? '#ffffff' : 'var(--theme-accent, #10B981)'}
                        strokeWidth={isHovered ? 3 : 2}
                        className="transition-all duration-150"
                      />
                    )}

                    {/* Interactive invisible hit bar */}
                    <rect
                      x={c.x - (chartWidth / coordinates.length) / 2}
                      y={paddingTop}
                      width={chartWidth / coordinates.length}
                      height={chartHeight + 10}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(idx)}
                    />
                  </g>
                );
              })}

              {/* X-axis labels (sampled for readability) */}
              {coordinates.map((c, idx) => {
                const total = coordinates.length;
                // Show labels with proper cadence
                const show =
                  total <= 8 ||
                  idx === 0 ||
                  idx === total - 1 ||
                  idx % Math.ceil(total / 6) === 0;

                if (!show) return null;

                return (
                  <text
                    key={idx}
                    x={c.x}
                    y={height - 8}
                    textAnchor="middle"
                    fill="rgba(161, 161, 170, 0.85)"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="monospace"
                  >
                    {c.point.label}
                  </text>
                );
              })}
            </svg>

            {/* Interactive Tooltip Card */}
            {activeHovered && (
              <div
                className="absolute pointer-events-none z-30 transition-all duration-75"
                style={{
                  left: `${(activeHovered.x / width) * 100}%`,
                  top: `${(activeHovered.y / height) * 100}%`,
                  transform: 'translate(-50%, -120%)',
                }}
              >
                <div className="rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-2 text-xs shadow-2xl backdrop-blur-md whitespace-nowrap">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    {activeHovered.point.label}
                  </div>
                  <div className="flex items-center gap-3">
                    <div>
                      <span className="text-[10px] text-zinc-400">Collections: </span>
                      <span className="font-mono font-black text-emerald-400">
                        {currencySymbol}{activeHovered.point.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-400">Bills: </span>
                      <span className="font-mono font-black text-indigo-400">
                        {activeHovered.point.bills}
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
        <div className="bg-zinc-950/40 rounded-xl p-2.5 border border-zinc-800/50">
          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Total Period</span>
          <span className="text-sm font-black text-white font-mono">
            {metric === 'amount' ? `${currencySymbol}${totalVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : `${totalVal} Orders`}
          </span>
        </div>
        <div className="bg-zinc-950/40 rounded-xl p-2.5 border border-zinc-800/50">
          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Interval Avg</span>
          <span className="text-sm font-black text-zinc-200 font-mono">
            {metric === 'amount' ? `${currencySymbol}${Math.round(avgVal).toLocaleString('en-IN')}` : `${Math.round(avgVal)} / interval`}
          </span>
        </div>
        <div className="bg-zinc-950/40 rounded-xl p-2.5 border border-zinc-800/50">
          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Peak Interval</span>
          <span className="text-sm font-black text-emerald-400 font-mono truncate block">
            {peakLabel || 'N/A'}
          </span>
        </div>
        <div className="bg-zinc-950/40 rounded-xl p-2.5 border border-zinc-800/50">
          <span className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider block">Velocity Health</span>
          <span className="text-sm font-black text-indigo-400 flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live Sync
          </span>
        </div>
      </div>
    </div>
  );
}
