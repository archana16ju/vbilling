import Link from "next/link"
import { Monitor, PackagePlus, ArrowRight } from "lucide-react"

export default function QuickActions() {
  const actions = [
    {
      name: "New Sale",
      href: "/terminal",
      icon: Monitor,
      buttonStyle: "bg-theme-bar hover:opacity-95 text-white shadow-lg shadow-theme-glow border border-theme",
      iconBg: "bg-white/20 text-white",
    },
    {
      name: "Add Product",
      href: "/products",
      icon: PackagePlus,
      buttonStyle: "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-600/30",
      iconBg: "bg-white/20 text-white",
    },
  ]

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-300">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Link
            key={action.name}
            href={action.href}
            className={`flex flex-col items-center justify-center rounded-2xl p-4 text-center transition-all duration-200 cursor-pointer active:scale-95 ${action.buttonStyle}`}
          >
            <div className={`mb-2.5 rounded-xl p-3 ${action.iconBg}`}>
              <action.icon className="h-6 w-6" />
            </div>
            <span className="text-xs font-black tracking-wide">{action.name}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
