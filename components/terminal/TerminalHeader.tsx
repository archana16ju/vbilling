'use client'
import Link from "next/link"
import { Wifi, UserCircle, LayoutDashboard } from "lucide-react"
import { useEffect, useState } from "react"
import { getUserRole } from "@/app/login/actions"

export default function TerminalHeader() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getUserRole().then(r => setRole(r ?? null)).catch(() => setRole(null))
  }, [])

  return (
    <header className="flex h-16 items-center justify-between bg-zinc-900 px-6 text-white shadow-md">
      <div className="flex items-center gap-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Billing POS</h1>
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 rounded-lg bg-black px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-600 hover:shadow active:scale-95"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm font-medium text-green-400 mr-4">
          <Wifi className="h-4 w-4" />
          <span>Online</span>
        </div>
        
        <div className="h-8 w-px bg-zinc-700"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold capitalize">{role ? (role === 'admin' ? 'Administrator' : 'Cashier') : 'User'}</span>
            <span className="text-xs text-zinc-400">Active User</span>
          </div>
          <UserCircle className="h-8 w-8 text-zinc-400" />
        </div>
      </div>
    </header>
  )
}