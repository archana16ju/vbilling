'use client';
import { UserCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { getUserRole } from "@/app/login/actions"

export default function Header() {
  const [role, setRole] = useState<string | null>(null)

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  useEffect(() => {
    getUserRole().then(r => setRole(r ?? null))
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-white px-8 shadow-sm">
      <div className="flex flex-col">
        <h2 className="text-xl font-semibold text-zinc-800">Dashboard</h2>
        <span className="text-xs text-zinc-500">{currentDate}</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-zinc-500">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-medium text-zinc-700 capitalize">{role || 'Loading...'}</div>
            <div className="text-xs text-zinc-400">Current Session</div>
          </div>
          <UserCircle className="h-8 w-8 text-black" />
        </div>
      </div>
    </header>
  )
}
