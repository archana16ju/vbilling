'use client';

import React, { useState } from 'react';
import {
  PieChart,
  Banknote,
  QrCode,
  CreditCard,
  Clock,
  Globe,
  CircleDollarSign,
} from 'lucide-react';

interface PaymentSlice {
  method: string;
  label: string;
  amount: number;
  count: number;
  percent: number;
  color: string;
}

interface PaymentCollectionsDonutProps {
  slices: PaymentSlice[];
  totalAmount: number;
  currencySymbol?: string;
}

const METHOD_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  upi: QrCode,
  card: CreditCard,
  billonly: Clock,
  online: Globe,
};

export default function PaymentCollectionsDonut({
  slices = [],
  totalAmount = 0,
  currencySymbol = '₹',
}: PaymentCollectionsDonutProps) {
  const [hoveredSlice, setHoveredSlice] = useState<PaymentSlice | null>(null);

  // Filter out slices with 0 amount unless all are 0
  const validSlices = slices.filter(s => s.amount > 0 || slices.every(x => x.amount === 0));

  // Compute SVG Donut circumference & offsets
  const size = 220;
  const strokeWidth = 26;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const donutSegments = validSlices.map((slice) => {
    const strokeDasharray = `${(slice.percent / 100) * circumference} ${circumference}`;
    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
    accumulatedPercent += slice.percent;

    return {
      slice,
      strokeDasharray,
      strokeDashoffset,
    };
  });

  const activeDisplay = hoveredSlice || {
    label: 'Total Collected',
    amount: totalAmount,
    percent: 100,
    color: 'var(--theme-accent, #10B981)',
  };

  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col justify-between">
      {/* Background glow */}
      <div 
        className="absolute -left-12 -bottom-12 h-44 w-44 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: '#8B5CF6' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <PieChart className="h-4 w-4 text-theme-accent" />
          </span>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Collections by Payment Method
            </h3>
            <p className="text-xs text-zinc-400">Cash vs UPI vs Card vs Credit split</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] font-bold text-zinc-300">
          <CircleDollarSign className="h-3.5 w-3.5 text-emerald-400" />
          <span>{slices.filter(s => s.amount > 0).length} Methods Active</span>
        </div>
      </div>

      {/* Main Container: Donut on Left, Breakdown Cards on Right */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center my-2 relative z-10">
        {/* Donut SVG Graphic */}
        <div className="md:col-span-5 flex flex-col items-center justify-center relative">
          <div className="relative w-[200px] h-[200px] flex items-center justify-center">
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              className="rotate-[-90deg] overflow-visible"
            >
              {/* Background track circle */}
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="rgba(39, 39, 42, 0.6)"
                strokeWidth={strokeWidth}
              />

              {/* Segments */}
              {totalAmount > 0 ? (
                donutSegments.map(({ slice, strokeDasharray, strokeDashoffset }) => {
                  const isHovered = hoveredSlice?.method === slice.method;
                  return (
                    <circle
                      key={slice.method}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={slice.color}
                      strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredSlice(slice)}
                      onMouseLeave={() => setHoveredSlice(null)}
                    />
                  );
                })
              ) : (
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth={strokeWidth}
                  strokeDasharray="4 4"
                />
              )}
            </svg>

            {/* Center Content readout */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
              <span className="text-[10px] uppercase font-black tracking-wider text-zinc-400 max-w-[120px] truncate">
                {activeDisplay.label}
              </span>
              <span className="text-lg font-black text-white font-mono mt-0.5">
                {currencySymbol}{activeDisplay.amount.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span
                className="text-[11px] font-black mt-0.5 px-2 py-0.5 rounded-full"
                style={{
                  color: activeDisplay.color,
                  backgroundColor: `${activeDisplay.color}15`,
                  border: `1px solid ${activeDisplay.color}35`,
                }}
              >
                {activeDisplay.percent}%
              </span>
            </div>
          </div>
        </div>

        {/* Breakdown List */}
        <div className="md:col-span-7 space-y-2.5">
          {slices.map((slice) => {
            const Icon = METHOD_ICONS[slice.method.toLowerCase()] || CircleDollarSign;
            const isHovered = hoveredSlice?.method === slice.method;

            return (
              <div
                key={slice.method}
                onMouseEnter={() => setHoveredSlice(slice)}
                onMouseLeave={() => setHoveredSlice(null)}
                className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isHovered
                    ? 'border-zinc-600 bg-zinc-800/90 shadow-lg translate-x-1'
                    : 'border-zinc-800/70 bg-zinc-950/40 hover:bg-zinc-800/50'
                }`}
              >
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: slice.color }}
                    />
                    <Icon className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="font-bold text-zinc-200">{slice.label}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      ({slice.count} {slice.count === 1 ? 'bill' : 'bills'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-white">
                      {currencySymbol}{slice.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    <span
                      className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded"
                      style={{
                        color: slice.color,
                        backgroundColor: `${slice.color}15`,
                      }}
                    >
                      {slice.percent}%
                    </span>
                  </div>
                </div>

                {/* Micro Progress Bar */}
                <div className="w-full bg-zinc-800/70 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(slice.percent, slice.amount > 0 ? 3 : 0)}%`,
                      backgroundColor: slice.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
