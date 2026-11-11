'use client';

import React from 'react';

export function KpiCardSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-xl relative overflow-hidden animate-pulse">
      <div className="flex items-start justify-between gap-2">
        <div className="h-3 w-20 rounded bg-zinc-800" />
        <div className="h-6 w-6 rounded-lg bg-zinc-800 shrink-0" />
      </div>
      <div className="mt-2.5 h-7 w-28 rounded bg-zinc-700/60" />
      <div className="mt-3 flex items-center justify-between">
        <div className="h-3 w-16 rounded bg-zinc-800" />
        <div className="h-3 w-12 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export function KpiGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {Array.from({ length: 7 }).map((_, idx) => (
        <KpiCardSkeleton key={idx} />
      ))}
    </div>
  );
}

export function ChartSkeleton({ height = 'h-80' }: { height?: string }) {
  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl ${height} flex flex-col justify-between animate-pulse`}>
      <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
        <div className="space-y-1.5">
          <div className="h-4 w-36 rounded bg-zinc-800" />
          <div className="h-3 w-24 rounded bg-zinc-800/60" />
        </div>
        <div className="h-7 w-20 rounded-xl bg-zinc-800" />
      </div>
      <div className="flex items-end justify-between gap-2 h-44 pt-4 px-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t bg-zinc-800/60"
            style={{ height: `${30 + ((i * 27) % 65)}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function DonutSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl h-80 flex flex-col justify-between animate-pulse">
      <div className="space-y-1.5 pb-4 border-b border-zinc-800">
        <div className="h-4 w-40 rounded bg-zinc-800" />
        <div className="h-3 w-28 rounded bg-zinc-800/60" />
      </div>
      <div className="flex items-center justify-center py-4">
        <div className="h-36 w-36 rounded-full border-8 border-zinc-800 border-t-zinc-700/80" />
      </div>
      <div className="flex justify-center gap-4">
        <div className="h-3 w-16 rounded bg-zinc-800" />
        <div className="h-3 w-16 rounded bg-zinc-800" />
        <div className="h-3 w-16 rounded bg-zinc-800" />
      </div>
    </div>
  );
}

export function FeedSkeleton() {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl animate-pulse space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
        <div className="h-4 w-36 rounded bg-zinc-800" />
        <div className="h-4 w-20 rounded bg-zinc-800" />
      </div>
      {Array.from({ length: 5 }).map((_, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-zinc-800/40">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-zinc-800" />
            <div className="space-y-1">
              <div className="h-3 w-28 rounded bg-zinc-800" />
              <div className="h-2.5 w-16 rounded bg-zinc-800/60" />
            </div>
          </div>
          <div className="h-4 w-16 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}
