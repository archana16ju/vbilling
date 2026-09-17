import Link from "next/link"
import { Monitor, PackagePlus } from "lucide-react"

export default function QuickActions() {
  const actions = [
    { name: "New Sale", href: "/terminal", icon: Monitor, color: "bg-blue-100 text-blue-600", hover: "hover:bg-blue-50" },
    { name: "Add Product", href: "/products", icon: PackagePlus, color: "bg-emerald-100 text-emerald-600", hover: "hover:bg-emerald-50" },
  ]

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-6 text-lg font-bold text-slate-800">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className={`flex flex-col items-center justify-center rounded-lg border border-slate-200 p-4 text-center transition-colors ${action.hover}`}
          >
            <div className={`mb-3 rounded-full p-3 ${action.color}`}>
              <action.icon className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-slate-700">{action.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
