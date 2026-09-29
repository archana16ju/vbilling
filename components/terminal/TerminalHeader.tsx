'use client'
import Link from "next/link"
import { Wifi, UserCircle, LayoutDashboard } from "lucide-react"
import { useEffect, useState } from "react"
import { getUserRole, getUserShortcuts } from "@/app/login/actions"

import { useTerminalStore, DEFAULT_SHORTCUTS } from "@/store/useTerminalStore"
import { recordSale } from "@/lib/actions/db"

export default function TerminalHeader() {
  const [role, setRole] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const { offlineQueue, removeOfflineSale, updateOfflineSaleStatus, syncInterval, setActiveShortcuts, activeShortcuts, isBackendOnline, setIsBackendOnline } = useTerminalStore()

  useEffect(() => {
    getUserRole().then(r => setRole(r ?? null)).catch(() => setRole(null))
    getUserShortcuts().then(shortcuts => {
      if (shortcuts) {
        setActiveShortcuts({ ...DEFAULT_SHORTCUTS, ...shortcuts });
      }
    }).catch(console.error)

    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    // Ping backend to check true reachability and MongoDB status
    const pingBackend = async () => {
      try {
        const res = await fetch('/api/storage/stats', { method: 'GET', cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          // Backend is up, but is MongoDB up?
          setIsBackendOnline(data.isMongoConnected === true);
        } else {
          setIsBackendOnline(false);
        }
      } catch (e) {
        setIsBackendOnline(false);
      }
    };
    
    pingBackend();
    const pingInterval = setInterval(pingBackend, 5000);

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(pingInterval);
    }
  }, [])

  useEffect(() => {
    // Sync logic has been moved to OfflineSyncManager in root layout
    // We only keep track of isSyncing visually based on offlineQueue status changes
    // which is enough since the manager handles the actual uploading
  }, [offlineQueue, removeOfflineSale, syncInterval])

  return (
    <header className="flex h-16 items-center justify-between bg-zinc-900 px-6 text-white shadow-md">
      <div className="flex items-center gap-5">
        <h1 className="text-xl font-bold tracking-tight text-zinc-100">Billing POS</h1>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="flex items-center gap-2 rounded-lg bg-black px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-gray-600 hover:shadow active:scale-95"
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>Dashboard</span>
        </button>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-end mr-4">
          {isOnline && isBackendOnline ? (
            <div className="flex items-center gap-1.5 text-sm font-medium text-green-400">
              <div className="h-2 w-2 rounded-full bg-green-400"></div>
              <span>ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm font-medium text-red-500">
              <div className="h-2 w-2 rounded-full bg-red-500"></div>
              <span>OFFLINE</span>
            </div>
          )}
          
          {offlineQueue.length > 0 && (
            <div className="text-[10px] font-bold text-orange-400">
              {isSyncing ? `SYNCING ${offlineQueue.length} BILLS...` : `${offlineQueue.length} BILLS PENDING SYNC`}
            </div>
          )}
          {isOnline && offlineQueue.length === 0 && (
            <div className="text-[10px] font-bold text-zinc-500">
              All bills synced
            </div>
          )}
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