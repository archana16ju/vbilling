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
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-zinc-900">{value}</h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-black">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <p className="mt-4 text-sm text-zinc-500">{comparison}</p>
    </div>
  )
}
