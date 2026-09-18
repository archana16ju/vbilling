export default function LowStock() {
  const items = [
    { name: "Flower Pot", sku: "FP001", current: 4, min: 10 },
    { name: "Ground Chakkar", sku: "GC001", current: 7, min: 15 },
    { name: "Red Sparkler", sku: "SP001", current: 12, min: 50 },
  ]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-bold text-zinc-800">Low Stock</h2>
        <button className="text-sm font-medium text-black hover:text-black">
          View Inventory
        </button>
      </div>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.sku} className="flex items-center justify-between border-b border-zinc-100 pb-4 last:border-0 last:pb-0">
            <div>
              <p className="font-medium text-zinc-900">{item.name}</p>
              <p className="text-xs text-zinc-500">SKU: {item.sku}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-red-600">{item.current} <span className="text-xs font-normal text-zinc-500">/ {item.min} min</span></p>
              <span className="mt-1 inline-block rounded bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                Low Stock
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
