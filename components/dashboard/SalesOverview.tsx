export default function SalesOverview() {
  const data = [
    { day: "Mon", value: 12000, height: "40%" },
    { day: "Tue", value: 18500, height: "60%" },
    { day: "Wed", value: 15200, height: "50%" },
    { day: "Thu", value: 22100, height: "75%" },
    { day: "Fri", value: 19800, height: "65%" },
    { day: "Sat", value: 28400, height: "95%" },
    { day: "Sun", value: 25300, height: "85%" },
  ]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-800">Sales Overview</h2>
        <select className="rounded-md border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 outline-none">
          <option>This Week</option>
          <option>This Month</option>
          <option>Today</option>
        </select>
      </div>

      <div className="flex h-64 items-end justify-between gap-2">
        {data.map((item) => (
          <div key={item.day} className="group relative flex w-full flex-col items-center justify-end">
            <div className="absolute -top-10 hidden rounded bg-zinc-800 px-2 py-1 text-xs text-white group-hover:block">
              ₹{item.value.toLocaleString()}
            </div>
            <div
              className="w-full rounded-t-md bg-gray-600 transition-all hover:bg-gray-800"
              style={{ height: item.height }}
            ></div>
            <span className="mt-3 text-xs font-medium text-zinc-500">{item.day}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
