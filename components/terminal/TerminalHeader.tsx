'use client'
import {
  Wifi,
  WifiOff,
  UserCircle,
  LayoutDashboard,
  Building2,
  LogOut,
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
} from 'lucide-react'
import { useEffect, useState, useRef } from 'react'
import { getUserShortcuts } from '@/app/login/actions'
import { useTableStore } from '@/store/useTableStore'
import DeliveryDetailsModal from '@/components/terminal/DeliveryDetailsModal'
import WaiterAssignmentModal from '@/components/terminal/WaiterAssignmentModal'
import { useTerminalStore, DEFAULT_SHORTCUTS } from '@/store/useTerminalStore'

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
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/)
    if (roleMatch) {
      const r = roleMatch[2]
      setRole(r === 'admin' ? 'company_admin' : r)
    }
    const userMatch = document.cookie.match(/(^| )auth_username=([^;]+)/)
    if (userMatch) setUsername(userMatch[2])

    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me?.authenticated) {
          if (me.role) setRole(me.role === 'admin' ? 'company_admin' : me.role)
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

        {/* ── Profile / user ── */}
        <div className="flex items-center gap-2 pl-1">
          {/* Role + username (hidden on tiny screens) */}
          <div className="hidden md:flex flex-col text-right">
            <span className="text-[11px] font-black text-white leading-tight">
              {role === 'super_admin'
                ? 'Super Admin'
                : role === 'company_admin' || role === 'admin'
                  ? 'Company Admin'
                  : role === 'manager'
                    ? 'Manager'
                    : role === 'chef'
                      ? 'Chef'
                      : role === 'waiter'
                        ? 'Waiter'
                        : role === 'cashier'
                          ? 'Cashier'
                          : 'User'}
            </span>
            <span className="text-[10px] text-zinc-500 font-medium leading-tight">
              {username ? `${username} · Active` : 'Active'}
            </span>
          </div>

          {/* Avatar / profile menu */}
          <div className="relative flex items-center" ref={profileMenuRef}>
            <Tip label={isLocalMode ? `${username || 'User'} · Logout` : (username || 'User')}>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 transition
                  ${isLocalMode ? 'cursor-pointer hover:bg-zinc-800 hover:border-theme' : ''}`}
                onClick={() => { if (isLocalMode) setShowProfileMenu(prev => !prev) }}
              >
                <UserCircle className="h-5 w-5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
              </div>
            </Tip>

            {/* Profile dropdown – Local Mode only */}
            {isLocalMode && showProfileMenu && (
              <div className="absolute right-0 top-11 z-50 w-48 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
                <div className="px-3 py-2 border-b border-zinc-800 text-xs">
                  <p className="font-bold text-white">{username || 'User'}</p>
                  <p className="text-zinc-400 capitalize">{role ? role.replace('_', ' ') : 'Cashier'}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
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