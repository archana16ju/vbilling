'use client';

import React, { useState } from 'react';
import { Clock, Flame, Zap } from 'lucide-react';

interface HourlyData {
  hour: number;
  label: string;
  amount: number;
  bills: number;
  isPeak: boolean;
}

interface HourlyRushChartProps {
  hourlyData: HourlyData[];
  currencySymbol?: string;
}

export default function HourlyRushChart({
  hourlyData = [],
  currencySymbol = '₹',
}: HourlyRushChartProps) {
  const [hoveredHour, setHoveredHour] = useState<HourlyData | null>(null);

  // Filter to active operating hours (e.g. 7 AM to 11 PM) or use full 24h
  const activeHours = hourlyData.length > 0 ? hourlyData : [];
  const maxAmount = Math.max(...activeHours.map((h) => h.amount), 1);
  const peakItem = activeHours.find((h) => h.isPeak) || null;

  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Hourly Rush & Peak Velocity
            </h3>
            <p className="text-xs text-zinc-400">Order traffic heat distribution across the clock</p>
          </div>
        </div>

        {peakItem && peakItem.amount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-950/40 border border-amber-800/60 text-xs font-bold text-amber-300">
            <Flame className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
            <span>Peak Rush: </span>
            <span className="font-mono text-white">{peakItem.label}</span>
            <span className="text-amber-400 font-mono">
              ({currencySymbol}{peakItem.amount.toLocaleString('en-IN')})
            </span>
          </div>
        )}
      </div>

      {/* Bar Chart Container */}
      <div className="relative pt-6 pb-2">
        {/* Hover Tooltip Float */}
        {hoveredHour && (
          <div className="absolute top-0 right-4 z-20 flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950/95 px-3 py-1.5 text-xs shadow-xl backdrop-blur-md">
            <span className="font-bold text-zinc-300">{hoveredHour.label}:</span>
            <span className="font-mono font-black text-emerald-400">
              {currencySymbol}{hoveredHour.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
            <span className="font-mono text-zinc-400">
              ({hoveredHour.bills} {hoveredHour.bills === 1 ? 'bill' : 'bills'})
            </span>
            {hoveredHour.isPeak && (
              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black uppercase">
                Peak
              </span>
            )}
          </div>
        )}

        {/* 24-Bar Grid */}
        <div className="flex items-end justify-between gap-1 sm:gap-1.5 h-36 w-full select-none">
          {activeHours.map((item) => {
            const heightPercent = maxAmount > 0 && item.amount > 0
              ? Math.max(12, (item.amount / maxAmount) * 100)
              : 4;
            const isHovered = hoveredHour?.hour === item.hour;

            return (
              <div
                key={item.hour}
                onMouseEnter={() => setHoveredHour(item)}
                onMouseLeave={() => setHoveredHour(null)}
                className="group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer"
              >
                {/* Bar */}
                <div
                  className={`w-full rounded-t-md transition-all duration-200 ${
                    item.isPeak
                      ? 'bg-gradient-to-t from-amber-600 to-amber-400 shadow-md shadow-amber-500/40 ring-1 ring-amber-300/40'
                      : isHovered
                      ? 'bg-theme-bar shadow-md ring-1 ring-white/50'
                      : item.amount > 0
                      ? 'bg-emerald-600/80 hover:bg-emerald-500'
                      : 'bg-zinc-800/50 hover:bg-zinc-700/60'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />

                {/* X-axis Label (sample every 3 hours for mobile/tablet clarity) */}
                <span className="mt-2 text-[9px] font-bold font-mono text-zinc-500 group-hover:text-white transition">
                  {item.hour % 3 === 0 ? item.label.replace(' ', '') : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer Legend */}
      <div className="mt-3 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span>Peak Rush Hour</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span>Normal Sales</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-zinc-800" />
            <span>Quiet Hours</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-zinc-500 font-mono text-[10px]">
          <Zap className="h-3 w-3 text-amber-400" />
          <span>Rush Heatmap Active</span>
        </div>
      </div>
    </div>
  );
}
