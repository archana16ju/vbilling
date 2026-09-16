'use client'
import { Wifi, UserCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { getUserRole } from "@/app/login/actions"

export default function TerminalHeader() {
  const [role, setRole] = useState<string | null>(null)

  useEffect(() => {
    getUserRole().then(r => setRole(r ?? null))
  }, [])

  return (
    <header className="flex h-16 items-center justify-between bg-slate-900 px-6 text-white shadow-md">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold tracking-tight text-blue-400">Billing POS</h1>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm font-medium text-green-400 mr-4">
          <Wifi className="h-4 w-4" />
          <span>Online</span>
        </div>
        
        <div className="h-8 w-px bg-slate-700"></div>

        <div className="flex items-center gap-3 pl-2">
          <div className="flex flex-col text-right">
            <span className="text-sm font-bold capitalize">{role === 'admin' ? 'Administrator' : 'Cashier'}</span>
            <span className="text-xs text-slate-400">Active User</span>
          </div>
          <UserCircle className="h-8 w-8 text-slate-400" />
        </div>
      </div>
    </header>
  )
}