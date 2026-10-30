'use client';

import React from 'react';
import { X, Maximize2, BarChart3, TrendingUp, PieChart, Sparkles } from 'lucide-react';

interface ChartExpandModalProps {
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function ChartExpandModal({
  title,
  subtitle,
  isOpen,
  onClose,
  children,
}: ChartExpandModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 sm:p-6 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl rounded-3xl bg-zinc-950 border border-zinc-800 text-white shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <BarChart3 className="h-5 w-5 text-theme-accent" />
            </span>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">{title}</h3>
              {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-bold text-zinc-400">
              <Sparkles className="h-3 w-3 text-amber-400" />
              Expanded View
            </span>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1">
          {children}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/40 flex justify-between items-center shrink-0">
          <span className="text-xs text-zinc-500">
            Rendered from live MySQL database records. Responsive SVG scaling active.
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          >
            Close Expanded View
          </button>
        </div>
      </div>
    </div>
  );
}
