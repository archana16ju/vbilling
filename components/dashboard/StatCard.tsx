export default function StatCard({
  title,
  value,
  comparison,
  icon: Icon,
}: {
  title: string
  value: string | number
  comparison: string
  icon: React.ElementType
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl transition-all duration-200 hover:border-theme">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</p>
          <h3 className="mt-2 text-3xl font-black text-white">{value}</h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl theme-icon-box">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-4 text-xs font-medium text-zinc-400">{comparison}</p>
    </div>
  )
}
