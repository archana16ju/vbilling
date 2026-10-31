export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Top Banner Skeleton */}
      <div className="rounded-2xl p-6 sm:p-8 bg-zinc-900/60 border border-zinc-800/80 relative overflow-hidden">
        <div className="h-6 w-48 bg-zinc-800/80 rounded-lg mb-3"></div>
        <div className="h-4 w-72 bg-zinc-800/50 rounded-lg"></div>
      </div>

      {/* Grid Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-2xl p-5 bg-zinc-900/40 border border-zinc-800/60 space-y-3">
            <div className="h-3 w-24 bg-zinc-800/70 rounded"></div>
            <div className="h-7 w-32 bg-zinc-800/90 rounded-lg"></div>
          </div>
        ))}
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-6 space-y-4">
        <div className="h-4 w-40 bg-zinc-800/80 rounded"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 w-full bg-zinc-900/70 border border-zinc-800/40 rounded-xl"></div>
          ))}
        </div>
      </div>
    </div>
  );
}
