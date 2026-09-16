'use client';
import { UserCircle, Shield, Terminal } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { getUserRole, getAllUsers } from "@/app/login/actions"

export default function Header() {
  const [role, setRole] = useState<string | null>(null)
  const [allUsers, setAllUsers] = useState<{username: string, role: string}[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentDate = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  useEffect(() => {
    getUserRole().then(r => setRole(r ?? null))
    getAllUsers().then(users => setAllUsers(users))
  }, [])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-white px-8 shadow-sm">
      <div className="flex flex-col">
        <h2 className="text-xl font-semibold text-slate-800">Dashboard</h2>
        <span className="text-xs text-slate-500">{currentDate}</span>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative" ref={dropdownRef}>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 focus:outline-none"
          >
            <div className="text-right hidden sm:block">
              <div className="text-sm font-medium text-slate-700 capitalize">{role || 'Loading...'}</div>
              <div className="text-xs text-slate-400">Current Session</div>
            </div>
            <UserCircle className="h-8 w-8 text-blue-600" />
          </button>
          
          {isOpen && (
            <div className="absolute right-0 mt-2 w-64 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 divide-y divide-gray-100 focus:outline-none">
              <div className="px-4 py-3">
                <p className="text-sm">Signed in as</p>
                <p className="text-sm font-medium text-slate-900 truncate capitalize">{role} User</p>
              </div>
              <div className="py-2">
                <div className="px-4 py-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  All System Users
                </div>
                {allUsers.map((user, idx) => (
                  <div key={idx} className="flex items-center justify-between px-4 py-2 text-sm text-slate-700">
                    <span className="font-medium">{user.username}</span>
                    <span className="flex items-center text-xs text-slate-500 capitalize bg-slate-100 px-2 py-1 rounded-md">
                      {user.role === 'admin' ? <Shield className="w-3 h-3 mr-1 text-blue-500" /> : <Terminal className="w-3 h-3 mr-1 text-green-500" />}
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
