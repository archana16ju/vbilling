'use client'
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Monitor, Package, Tags, LogOut, UserCircle, Users, IndianRupee, Settings as SettingsIcon } from "lucide-react"

import { useState, useEffect } from "react"
import { getUserRole, logout } from "@/app/login/actions"

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getUserRole().then(r => setRole(r ?? null))
  }, [])

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Terminal", href: "/terminal", icon: Monitor },
    { name: "Sales & Bills", href: "/sales", icon: IndianRupee },
    { name: "Products", href: "/products", icon: Package },
    { name: "Categories", href: "/categories", icon: Tags },
    { name: "Users", href: "/users", icon: Users },
    { name: "Settings", href: "/settings", icon: SettingsIcon },
  ]

  const filteredNavItems = navItems.filter(item => {
    if (role === 'cashier' && item.href !== '/terminal') return false;
    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-20 flex h-full w-64 flex-col bg-slate-900 text-white shadow-xl">
      <div className="flex h-16 shrink-0 items-center px-6">
        <h1 className="text-xl font-bold tracking-tight">QuickBill</h1>
      </div>
      <div className="px-6 pb-6 text-xs font-semibold uppercase tracking-wider text-slate-400">
        POS / Billing Software
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 pb-4">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <UserCircle className="h-10 w-10 text-slate-400" />
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-medium capitalize">{role || 'Loading...'}</span>
            <span className="text-xs text-slate-400">User Role</span>
          </div>
          <form action={logout}>
            <button 
              type="submit"
              className="text-slate-400 hover:text-white" 
              title="Logout"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
