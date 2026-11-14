'use client'
import {
  Wifi,
  WifiOff,
  UserCircle,
  LayoutDashboard,
  Building2,
  ChefHat,
  UtensilsCrossed,
  Truck,
  Zap,
  User,
  UserCheck,
  AlertTriangle,
  ShoppingBag,
  LayoutGrid,
  Users,
  Sun,
  Moon,
  Laptop,
  Check,
  HelpCircle,
  ChevronDown,
  Settings,
  LogOut,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { getUserShortcuts } from '@/app/login/actions'
import { useTableStore } from '@/store/useTableStore'
import DeliveryDetailsModal from '@/components/terminal/DeliveryDetailsModal'
import WaiterAssignmentModal from '@/components/terminal/WaiterAssignmentModal'
import SmartNotificationBell from '@/components/notifications/SmartNotificationBell'
import { useTerminalStore, DEFAULT_SHORTCUTS } from '@/store/useTerminalStore'
import { useShortcutsStore } from '@/store/useShortcutsStore'

/* ─────────────────────────────────────────
   Tooltip wrapper – shows label above child on hover
───────────────────────────────────────── */
function Tip({
  label,
  children,
  side = 'bottom',
}: {
  label: string
  children: React.ReactNode
  side?: 'bottom' | 'top'
}) {
  return (
    <div className="relative group/tip flex items-center justify-center">
      {children}
      {/* Tooltip bubble */}
      <div
        className={`
          pointer-events-none absolute z-[100] whitespace-nowrap
          rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur-sm
          px-2.5 py-1 text-[11px] font-bold text-white shadow-xl
          opacity-0 scale-95
          group-hover/tip:opacity-100 group-hover/tip:scale-100
          transition-all duration-150
          ${side === 'bottom' ? 'top-full mt-2' : 'bottom-full mb-2'}
          left-1/2 -translate-x-1/2
        `}
      >
        {label}
        {/* Arrow */}
        <span
          className={`
            absolute left-1/2 -translate-x-1/2 border-4 border-transparent
            ${side === 'bottom'
              ? 'bottom-full border-b-zinc-700'
              : 'top-full border-t-zinc-700'}
          `}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   Icon-only nav button (square compact pill)
───────────────────────────────────────── */
function IconBtn({
  onClick,
  className,
  children,
}: {
  onClick?: () => void
  className: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer active:scale-95 ${className}`}
    >
      {children}
    </button>
  )
}

export default function TerminalHeader() {
  const [role, setRole] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string; code: string } | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [isWaiterModalOpen, setIsWaiterModalOpen] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const profileTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql'

  const {
    offlineQueue,
    removeOfflineSale,
    updateOfflineSaleStatus,
    syncInterval,
    setActiveShortcuts,
    activeShortcuts,
    isBackendOnline,
    setIsBackendOnline,
    terminalModeOverride,
    setTerminalModeOverride,
    terminalThemeMode,
    setTerminalThemeMode,
  } = useTerminalStore()

  const {
    orderType,
    setOrderType,
    tables,
    selectedTableId,
    selectedGuestCount,
    assignedWaiter,
    setAssignedWaiter,
    setTableWaiter,
    setIsTableModalOpen,
    isDeliveryModalOpen,
    setIsDeliveryModalOpen,
    deliveryInfo,
    clearDeliveryInfo,
  } = useTableStore()

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null

  // ── Unified Theme Dropdown State & Handlers ──
  const [isThemeOpen, setIsThemeOpen] = useState(false)
  const themeMenuRef = useRef<HTMLDivElement>(null)
  const themeTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleThemeMenuEnter = () => {
    if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current)
    setIsThemeOpen(true)
  }

  const handleThemeMenuLeave = () => {
    if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current)
    themeTimeoutRef.current = setTimeout(() => {
      setIsThemeOpen(false)
    }, 200)
  }

  const handleThemeMenuClick = () => {
    if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current)
    setIsThemeOpen((prev) => !prev)
  }

  const handleProfileMenuEnter = () => {
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current)
    setShowProfileMenu(true)
  }

  const handleProfileMenuLeave = () => {
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current)
    profileTimeoutRef.current = setTimeout(() => {
      setShowProfileMenu(false)
    }, 200)
  }

  const handleProfileMenuClick = () => {
    if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current)
    setShowProfileMenu((prev) => !prev)
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setIsThemeOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current)
      if (profileTimeoutRef.current) clearTimeout(profileTimeoutRef.current)
    }
  }, [])

  const applyTerminalTheme = (newMode: 'dark' | 'light' | 'system') => {
    try {
      localStorage.setItem('terminal_theme_mode', newMode)
      localStorage.setItem('dashboard_theme_mode', newMode)
    } catch {}
    if (setTerminalThemeMode) setTerminalThemeMode(newMode)
    if (setTerminalModeOverride) setTerminalModeOverride(newMode)

    let effectiveMode = newMode
    if (newMode === 'system') {
      const isOsDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      effectiveMode = isOsDark ? 'dark' : 'light'
    }

    const root = document.documentElement
    root.setAttribute('data-theme', effectiveMode)
    root.setAttribute('data-theme-setting', newMode)
    if (effectiveMode === 'light') {
      root.classList.add('light-mode')
      root.classList.remove('dark-mode', 'dark')
      root.style.setProperty('--theme-mode', 'light')
      if (document.body) {
        document.body.setAttribute('data-theme', 'light')
        document.body.classList.add('light-mode')
        document.body.classList.remove('dark-mode', 'dark')
      }
    } else {
      root.classList.add('dark-mode', 'dark')
      root.classList.remove('light-mode')
      root.style.setProperty('--theme-mode', 'dark')
      if (document.body) {
        document.body.setAttribute('data-theme', 'dark')
        document.body.classList.add('dark-mode', 'dark')
        document.body.classList.remove('light-mode')
      }
    }

    try {
      window.dispatchEvent(new CustomEvent('dashboard-theme-mode-changed', { detail: { mode: newMode } }))
    } catch {}
  }

  /* ── Logout ── */
  const handleLogout = async () => {
    try { await fetch('/api/auth/login', { method: 'DELETE' }) } catch {}
    try {
      clearDeliveryInfo()
      useTerminalStore.getState().setSelectedCustomer(null)
      useTerminalStore.getState().clearCart()
      localStorage.removeItem('tables-storage')
      const termData = localStorage.getItem('terminal-storage')
      if (termData) {
        const parsed = JSON.parse(termData)
        if (parsed?.state) {
          parsed.state.cart = []
          parsed.state.selectedCustomer = null
          parsed.state.orderNote = ''
          parsed.state.activeCompanyId = ''
          localStorage.setItem('terminal-storage', JSON.stringify(parsed))
        }
      }
    } catch {}
    document.cookie = 'auth_role=; Max-Age=0; path=/;'
    document.cookie = 'auth_username=; Max-Age=0; path=/;'
    document.cookie = 'auth_id=; Max-Age=0; path=/;'
    document.cookie = 'auth_company_id=; Max-Age=0; path=/;'
    document.cookie = 'auth_session=; Max-Age=0; path=/;'
    window.location.href = '/login'
  }

  /* ── Bootstrap ── */
  useEffect(() => {
    // Sync theme setting from localStorage
    try {
      const stored = (localStorage.getItem('terminal_theme_mode') || localStorage.getItem('dashboard_theme_mode')) as 'dark' | 'light' | 'system' | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        if (setTerminalThemeMode) setTerminalThemeMode(stored);
        if (setTerminalModeOverride) setTerminalModeOverride(stored);
      }
    } catch {}

    const userMatch = document.cookie.match(/(^| )auth_username=([^;]+)/)
    if (userMatch) setUsername(userMatch[2])
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/)
    if (roleMatch) {
      const r = roleMatch[2]
      setRole(r === 'admin' ? (userMatch?.[2]?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : r)
    }

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me?.authenticated) {
          if (me.role) setRole(me.role === 'admin' ? (me.username?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : me.role)
          if (me.username) setUsername(me.username)
        }
      })
      .catch(() => {})

    getUserShortcuts()
      .then(shortcuts => { if (shortcuts) setActiveShortcuts({ ...DEFAULT_SHORTCUTS, ...shortcuts }) })
      .catch(console.error)

    fetch('/api/companies/active')
      .then(res => res.json())
      .then(data => {
        if (data.activeCompany) {
          const prevCompanyId = useTerminalStore.getState().activeCompanyId
          const currentDeliveryCompId = useTableStore.getState().deliveryInfo.companyId
          if (
            (prevCompanyId && prevCompanyId !== data.activeCompany.id) ||
            (currentDeliveryCompId && currentDeliveryCompId !== data.activeCompany.id)
          ) {
            useTableStore.getState().clearDeliveryInfo()
            useTerminalStore.getState().setSelectedCustomer(null)
            useTerminalStore.getState().clearCart()
          }
          setActiveCompany(data.activeCompany)
          useTerminalStore.getState().setActiveCompanyId?.(data.activeCompany.id)
        }
      })
      .catch(() => {})

    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const pingBackend = async () => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql'
        const apiUrl = isLocalMode ? '' : (process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com')
        const res = await fetch(`${apiUrl}/api/test-db`, { method: 'GET', cache: 'no-store', signal: controller.signal })
        clearTimeout(timeoutId)
        setIsBackendOnline(res.ok)
      } catch {
        setIsBackendOnline(false)
      }
    }
    pingBackend()
    const pingInterval = setInterval(pingBackend, 10000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(pingInterval)
    }
  }, [])

  useEffect(() => {
    // Sync tracking only – actual sync handled by OfflineSyncManager
  }, [offlineQueue, removeOfflineSale, syncInterval])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node))
        setShowProfileMenu(false)
    }
    if (showProfileMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileMenu])

  /* ── Derived values for Dine In ── */
  const isOverCapacity = selectedTable ? selectedGuestCount > selectedTable.capacity : false
  const availableSeats = selectedTable ? Math.max(0, selectedTable.capacity - selectedGuestCount) : 0
  const waiterLabel = assignedWaiter?.name || selectedTable?.waiterName || null

  /* ── Order-type icon map ── */
  const orderTypeConfig = {
    'Dine In':   { Icon: UtensilsCrossed, activeColor: 'text-pink-300',   tooltip: 'Dine In' },
    'Takeaway':  { Icon: ShoppingBag,     activeColor: 'text-cyan-300',   tooltip: 'Takeaway' },
    'Delivery':  { Icon: Truck,           activeColor: 'text-indigo-300', tooltip: 'Delivery' },
  } as const

  return (
    <header className="relative flex h-14 items-center justify-between bg-zinc-950 px-4 text-white border-b border-zinc-800 shadow-xl">
      {/* Theme accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-theme-bar opacity-85" />

      {/* ───── LEFT: Logo + Nav icons ───── */}
      <div className="flex items-center gap-2">
        {/* Logo */}
        <h1 className="text-base font-black tracking-tight text-white flex items-center gap-2 mr-1">
          <span
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: 'var(--theme-accent, #DB2777)',
              boxShadow: '0 0 8px var(--theme-accent, #DB2777)',
            }}
          />
          <span className="hidden sm:inline">Vseyal POS</span>
        </h1>

        {/* Dashboard */}
        <Tip label="Dashboard">
          <IconBtn
            onClick={() => (window.location.href = '/dashboard')}
            className="border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white"
          >
            <LayoutDashboard className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
          </IconBtn>
        </Tip>

        {/* Kitchen (admin only) */}
        {(role === 'company_admin' || role === 'admin' || role === 'super_admin') && (
          <>
            <Tip label="Kitchen">
              <IconBtn
                onClick={() => (window.location.href = '/kitchen')}
                className="border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
              >
                <ChefHat className="h-4 w-4" />
              </IconBtn>
            </Tip>

            <Tip label="Tables">
              <IconBtn
                onClick={() => (window.location.href = '/tables')}
                className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
              >
                <LayoutGrid className="h-4 w-4" />
              </IconBtn>
            </Tip>
          </>
        )}

        {/* Company */}
        {activeCompany && (
          <Tip label={activeCompany.name}>
            <button
              type="button"
              onClick={() => {
                if (role === 'admin' || role === 'super_admin') window.location.href = '/companies'
              }}
              className={`
                flex h-8 items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900
                px-2 py-1 text-[11px] font-bold text-zinc-300 transition-all
                ${role === 'admin' || role === 'super_admin'
                  ? 'cursor-pointer hover:bg-zinc-800 hover:border-theme hover:text-white'
                  : 'cursor-default'}
              `}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--theme-accent, #DB2777)' }} />
              <span
                className="rounded px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-[10px] font-mono"
                style={{ color: 'var(--theme-badge-text, #F472B6)' }}
              >
                {activeCompany.code}
              </span>
            </button>
          </Tip>
        )}
      </div>

      <div className="flex-1" />

      {/* ───── RIGHT: Order type + table/delivery + status + profile ───── */}
      <div className="flex items-center gap-2">

        {/* Order Type pill – icons only */}
        <div className="flex items-center gap-0.5 rounded-xl bg-zinc-900 border border-zinc-800 p-1">
          {(['Dine In', 'Takeaway', 'Delivery'] as const).map((type) => {
            const { Icon, activeColor, tooltip } = orderTypeConfig[type]
            const isActive = orderType === type
            return (
              <Tip key={type} label={tooltip}>
                <button
                  type="button"
                  onClick={() => {
                    setOrderType(type)
                    if (type === 'Dine In') setIsTableModalOpen(true)
                    else if (type === 'Delivery') setIsDeliveryModalOpen(true)
                  }}
                  className={`
                    flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer
                    ${isActive
                      ? 'bg-theme-bar border border-theme shadow-lg shadow-theme-glow'
                      : 'text-zinc-500 hover:text-white hover:bg-zinc-800'}
                  `}
                >
                  <Icon
                    className={`h-3.5 w-3.5 ${isActive ? activeColor : ''}`}
                  />
                </button>
              </Tip>
            )
          })}
        </div>

        {/* ── Dine In extras: Choose Table + Assign Waiter ── */}
        {orderType === 'Dine In' && (
          <div className="flex items-center gap-1.5">

            {/* Choose a Table */}
            <Tip
              label={
                selectedTable
                  ? isOverCapacity
                    ? `⚠ Table ${selectedTable.name} · ${selectedGuestCount}/${selectedTable.capacity} (Over Capacity)`
                    : `Table ${selectedTable.name} · ${selectedGuestCount} guest${selectedGuestCount !== 1 ? 's' : ''} · ${availableSeats === 0 ? 'Full' : `${availableSeats} free`}`
                  : 'Choose a Table'
              }
            >
              <button
                type="button"
                onClick={() => setIsTableModalOpen(true)}
                className={`
                  relative flex h-8 items-center gap-1.5 rounded-xl border px-2 transition-all cursor-pointer
                  ${!selectedTable
                    ? 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    : isOverCapacity
                    ? 'border-amber-500/80 bg-amber-950/70 text-amber-200 hover:bg-amber-900/60 shadow-lg shadow-amber-950/40'
                    : 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300 hover:bg-emerald-900/60 shadow-lg shadow-emerald-950/40'}
                `}
              >
                {isOverCapacity ? (
                  <AlertTriangle className="h-4 w-4 text-amber-400 animate-pulse" />
                ) : (
                  <UtensilsCrossed className={`h-4 w-4 ${selectedTable ? 'text-emerald-400' : 'text-zinc-500'}`} />
                )}

                {/* Compact table badge when selected */}
                {selectedTable && (
                  <span className={`text-[11px] font-black ${isOverCapacity ? 'text-amber-300' : 'text-emerald-300'}`}>
                    T{selectedTable.name}
                    {isOverCapacity && (
                      <span className="ml-1 text-[9px] text-amber-400">⚠</span>
                    )}
                  </span>
                )}
              </button>
            </Tip>

            {/* Assign Waiter */}
            <Tip label={waiterLabel ? `Server: ${waiterLabel}` : 'Assign Waiter'}>
              <button
                type="button"
                onClick={() => setIsWaiterModalOpen(true)}
                className={`
                  flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer
                  ${waiterLabel
                    ? 'border-indigo-500/50 bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 shadow-lg shadow-indigo-950/40'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                `}
              >
                {waiterLabel ? (
                  <UserCheck className="h-4 w-4 text-indigo-400" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </button>
            </Tip>
          </div>
        )}

        {/* ── Delivery extras ── */}
        {orderType === 'Delivery' && (
          <div className="flex items-center gap-1.5">

            {/* Delivery details button */}
            <Tip
              label={
                deliveryInfo.onlineOrderId
                  ? `#${deliveryInfo.onlineOrderId}`
                  : deliveryInfo.platform === 'Zomato'
                  ? 'Zomato Delivery'
                  : deliveryInfo.platform === 'Swiggy'
                  ? 'Swiggy Delivery'
                  : deliveryInfo.deliveryAddress
                  ? `${deliveryInfo.customerName ? deliveryInfo.customerName + ' · ' : ''}${deliveryInfo.deliveryAddress}`
                  : 'Delivery Details'
              }
            >
              <button
                type="button"
                onClick={() => setIsDeliveryModalOpen(true)}
                className={`
                  flex h-8 items-center gap-1.5 rounded-xl border px-2 transition-all cursor-pointer
                  ${deliveryInfo.platform === 'Zomato'
                    ? 'border-red-500/60 bg-red-950/60 text-red-300 hover:bg-red-900/60 shadow-lg shadow-red-950/40'
                    : deliveryInfo.platform === 'Swiggy'
                    ? 'border-orange-500/60 bg-orange-950/60 text-orange-300 hover:bg-orange-900/60 shadow-lg shadow-orange-950/40'
                    : deliveryInfo.deliveryAddress
                    ? 'border-indigo-500/50 bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/60 shadow-lg shadow-indigo-950/40'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'}
                `}
              >
                {deliveryInfo.platform === 'Zomato' ? (
                  <span className="h-4 w-4 rounded bg-red-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">Z</span>
                ) : deliveryInfo.platform === 'Swiggy' ? (
                  <span className="h-4 w-4 rounded bg-orange-600 text-white font-black text-[10px] flex items-center justify-center shrink-0">S</span>
                ) : (
                  <Truck className={`h-4 w-4 shrink-0 ${deliveryInfo.deliveryAddress ? 'text-indigo-400' : 'text-zinc-500'}`} />
                )}
                {deliveryInfo.onlineOrderId && (
                  <span className="text-[11px] font-black">#{deliveryInfo.onlineOrderId}</span>
                )}
              </button>
            </Tip>

            {/* Assigned delivery person */}
            {deliveryInfo.deliveryPersonName && (
              <Tip label={`Rider: ${deliveryInfo.deliveryPersonName}`}>
                <button
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(true)}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/40 transition cursor-pointer"
                >
                  <UserCheck className="h-4 w-4" />
                </button>
              </Tip>
            )}

            {/* Connect online order (Zap) */}
            <Tip label="Connect Online Order">
              <button
                type="button"
                onClick={() => setIsDeliveryModalOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-950/40 text-amber-400 hover:bg-amber-900/40 transition cursor-pointer active:scale-95"
              >
                <Zap className="h-4 w-4" />
              </button>
            </Tip>
          </div>
        )}

        {/* Separator */}
        <div className="h-6 w-px bg-zinc-800" />

        {/* ── Single Compact Theme Selector Icon with Dropdown ── */}
        <div
          ref={themeMenuRef}
          className="relative"
          onMouseEnter={handleThemeMenuEnter}
          onMouseLeave={handleThemeMenuLeave}
        >
          <Tip label={`Theme: ${(terminalThemeMode || terminalModeOverride) === 'light' ? 'Light Mode' : (terminalThemeMode || terminalModeOverride) === 'system' ? 'System Default' : 'Dark Mode'}`}>
            <button
              type="button"
              onClick={handleThemeMenuClick}
              className={`flex h-8 w-8 items-center justify-center rounded-xl border transition-all cursor-pointer shadow-sm active:scale-95 ${
                isThemeOpen
                  ? 'border-indigo-500/50 bg-zinc-800 text-white shadow-md'
                  : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700'
              }`}
              title="Select Theme Mode (Dark / Light)"
              aria-label="Theme Mode Selection"
            >
              {(terminalThemeMode || terminalModeOverride) === 'light' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (terminalThemeMode || terminalModeOverride) === 'system' ? (
                <Laptop className="h-4 w-4 text-emerald-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-400" />
              )}
            </button>
          </Tip>

          {/* Compact Dropdown Menu */}
          {isThemeOpen && (
            <div
              onMouseEnter={handleThemeMenuEnter}
              onMouseLeave={handleThemeMenuLeave}
              className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
            >
              <div className="border-b border-zinc-800/80 pb-1.5 mb-1.5 px-1">
                <h4 className="text-xs font-bold text-zinc-100">Theme Appearance</h4>
                <p className="text-[10px] text-zinc-400">Select terminal display mode</p>
              </div>

              <div className="space-y-1">
                {/* Dark Mode */}
                <button
                  type="button"
                  onClick={() => {
                    applyTerminalTheme('dark')
                    setIsThemeOpen(false)
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                    (terminalThemeMode === 'dark' || (!terminalThemeMode && terminalModeOverride !== 'light'))
                      ? 'bg-indigo-500/15 border border-indigo-500/40 text-indigo-300'
                      : 'hover:bg-zinc-800/70 border border-transparent text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-indigo-400">
                      <Moon className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Dark Mode</p>
                      <p className="text-[10px] text-zinc-400">Deep midnight zinc</p>
                    </div>
                  </div>
                  {(terminalThemeMode === 'dark' || (!terminalThemeMode && terminalModeOverride !== 'light')) && (
                    <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                  )}
                </button>

                {/* Light Mode */}
                <button
                  type="button"
                  onClick={() => {
                    applyTerminalTheme('light')
                    setIsThemeOpen(false)
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                    (terminalThemeMode === 'light' || terminalModeOverride === 'light')
                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                      : 'hover:bg-zinc-800/70 border border-transparent text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-amber-400">
                      <Sun className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">Light Mode</p>
                      <p className="text-[10px] text-zinc-400">Crisp daytime white</p>
                    </div>
                  </div>
                  {(terminalThemeMode === 'light' || terminalModeOverride === 'light') && (
                    <Check className="h-4 w-4 text-amber-400 shrink-0" />
                  )}
                </button>

                {/* System Default */}
                <button
                  type="button"
                  onClick={() => {
                    applyTerminalTheme('system')
                    setIsThemeOpen(false)
                  }}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                    terminalThemeMode === 'system' || terminalModeOverride === 'system'
                      ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                      : 'hover:bg-zinc-800/70 border border-transparent text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-emerald-400">
                      <Laptop className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold">System Default</p>
                      <p className="text-[10px] text-zinc-400">Syncs with OS theme</p>
                    </div>
                  </div>
                  {(terminalThemeMode === 'system' || terminalModeOverride === 'system') && (
                    <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Smart Notifications Bell */}
        <SmartNotificationBell />

        {/* ── Common Help (?) Icon for Keyboard Shortcuts ── */}
        <Tip label="Keyboard Shortcuts (?)">
          <button
            type="button"
            onClick={() => useShortcutsStore.getState().openHelpModal()}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-theme transition cursor-pointer shadow-sm active:scale-95"
            title="Keyboard Shortcuts (?)"
            aria-label="Help & Keyboard Shortcuts"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </Tip>

        {/* Separator */}
        <div className="h-6 w-px bg-zinc-800" />

        {/* ── Online / Offline Wi-Fi icon ── */}
<Tip
  label={
    isOnline && isBackendOnline
      ? 'Online'
      : 'Offline'
  }
>
  {isOnline && isBackendOnline ? (
    <Wifi
      className="h-6 w-6 text-emerald-500 dark:text-emerald-400 drop-shadow-[0_0_7px_rgba(52,211,153,0.85)] transition-all duration-300"
      strokeWidth={2.8}
    />
  ) : (
    <WifiOff
      className="h-6 w-6 text-rose-600 dark:text-rose-400 drop-shadow-[0_0_7px_rgba(244,63,94,0.65)] transition-all duration-300"
      strokeWidth={2.8}
    />
  )}
</Tip>

        {/* Separator */}
        <div className="h-6 w-px bg-zinc-800" />

        {/* ── User Profile Dropdown (Same as Dashboard Header) ── */}
        <div
          ref={profileMenuRef}
          className="relative"
          onMouseEnter={handleProfileMenuEnter}
          onMouseLeave={handleProfileMenuLeave}
        >
          <button
            type="button"
            onClick={handleProfileMenuClick}
            className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-all cursor-pointer ${
              showProfileMenu
                ? 'bg-zinc-800/90 text-white'
                : 'hover:bg-zinc-900 text-zinc-300'
            }`}
            title="User Profile & Settings"
            aria-label="User Profile"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-black text-xs shadow-sm shrink-0">
              {username ? username.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="flex flex-col text-left leading-tight hidden sm:flex">
              <span className="text-xs font-bold text-white truncate max-w-[90px]">
                {username || 'Admin'}
              </span>
              <span className="text-[9px] font-black uppercase tracking-wider text-pink-400">
                {role ? role.replace('_', ' ') : 'Cashier'}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
          </button>

          {/* Profile Dropdown Menu */}
          {showProfileMenu && (
            <div
              onMouseEnter={handleProfileMenuEnter}
              onMouseLeave={handleProfileMenuLeave}
              className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2.5 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
            >
              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70 mb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-bold text-sm shrink-0">
                  {username ? username.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-white text-xs truncate">{username || 'User'}</p>
                  <p className="text-[10px] text-pink-400 capitalize truncate font-semibold">
                    {role ? role.replace('_', ' ') : 'Cashier'}
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                {/* Account Settings */}
                <Link
                  href="/settings"
                  onClick={() => setShowProfileMenu(false)}
                  className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition"
                >
                  <Settings className="h-3.5 w-3.5 text-zinc-400" />
                  <span>Account Settings</span>
                </Link>

                {/* Sign Out Button */}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-rose-400 hover:text-white hover:bg-rose-950/40 border border-transparent hover:border-rose-800/60 transition cursor-pointer mt-1 pt-1.5 border-t border-zinc-800/80"
                >
                  <LogOut className="h-3.5 w-3.5 shrink-0" />
                  <span>Sign out of session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals (no change) ── */}
      <DeliveryDetailsModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
      />

      <WaiterAssignmentModal
        isOpen={isWaiterModalOpen}
        onClose={() => setIsWaiterModalOpen(false)}
        onSelectWaiter={(waiter) => {
          setAssignedWaiter(waiter)
          if (selectedTable) {
            setTableWaiter(selectedTable.id, waiter?.id || null, waiter?.name || null)
            fetch('/api/dine-in-orders', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'assignWaiter',
                orderId: selectedTable.activeOrderId || null,
                tableId: selectedTable.id,
                tableName: `Table ${selectedTable.name}`,
                waiterId: waiter?.id || null,
                waiterName: waiter?.name || null,
              }),
            }).catch(console.error)
          }
        }}
        currentWaiterId={assignedWaiter?.id || selectedTable?.waiterId}
        tableName={selectedTable ? `Table ${selectedTable.name}` : undefined}
        tableGuestCount={selectedGuestCount}
        actionTitle="Confirm Waiter Assignment"
      />
    </header>
  )
}