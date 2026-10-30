'use client'
import Link from "next/link"
import { Wifi, UserCircle, LayoutDashboard, Building2, LogOut, ChefHat, UtensilsCrossed, ChevronDown, Truck, Zap, User } from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { getUserRole, getUserShortcuts } from "@/app/login/actions"
import { useTableStore } from "@/store/useTableStore"
import DeliveryDetailsModal from "@/components/terminal/DeliveryDetailsModal"
import WaiterAssignmentModal from "@/components/terminal/WaiterAssignmentModal"

import { useTerminalStore, DEFAULT_SHORTCUTS } from "@/store/useTerminalStore"
import { recordSale } from "@/lib/actions/db"

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
  const { offlineQueue, removeOfflineSale, updateOfflineSaleStatus, syncInterval, setActiveShortcuts, activeShortcuts, isBackendOnline, setIsBackendOnline } = useTerminalStore()
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch {}
    try {
      clearDeliveryInfo();
      useTerminalStore.getState().setSelectedCustomer(null);
      useTerminalStore.getState().clearCart();
      localStorage.removeItem('tables-storage');
      const termData = localStorage.getItem('terminal-storage');
      if (termData) {
        const parsed = JSON.parse(termData);
        if (parsed?.state) {
          parsed.state.cart = [];
          parsed.state.selectedCustomer = null;
          parsed.state.orderNote = '';
          parsed.state.activeCompanyId = '';
          localStorage.setItem('terminal-storage', JSON.stringify(parsed));
        }
      }
    } catch {}
    document.cookie = 'auth_role=; Max-Age=0; path=/;';
    document.cookie = 'auth_username=; Max-Age=0; path=/;';
    document.cookie = 'auth_id=; Max-Age=0; path=/;';
    document.cookie = 'auth_company_id=; Max-Age=0; path=/;';
    document.cookie = 'auth_session=; Max-Age=0; path=/;';
    window.location.href = '/login';
  };

  useEffect(() => {
    // 1. Immediately read from cookies for instant rendering
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    if (roleMatch) {
      const r = roleMatch[2];
      setRole(r === 'admin' ? 'company_admin' : r);
    }
    const userMatch = document.cookie.match(/(^| )auth_username=([^;]+)/);
    if (userMatch) {
      setUsername(userMatch[2]);
    }

    // 2. Fetch authenticated session role and username
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me && me.authenticated) {
          if (me.role) setRole(me.role === 'admin' ? 'company_admin' : me.role);
          if (me.username) setUsername(me.username);
        }
      })
      .catch(() => {});

    getUserShortcuts().then(shortcuts => {
      if (shortcuts) {
        setActiveShortcuts({ ...DEFAULT_SHORTCUTS, ...shortcuts });
      }
    }).catch(console.error)

    fetch('/api/companies/active')
      .then(res => res.json())
      .then(data => {
        if (data.activeCompany) {
          const prevCompanyId = useTerminalStore.getState().activeCompanyId;
          const currentDeliveryCompId = useTableStore.getState().deliveryInfo.companyId;
          if (
            (prevCompanyId && prevCompanyId !== data.activeCompany.id) ||
            (currentDeliveryCompId && currentDeliveryCompId !== data.activeCompany.id)
          ) {
            useTableStore.getState().clearDeliveryInfo();
            useTerminalStore.getState().setSelectedCustomer(null);
            useTerminalStore.getState().clearCart();
          }
          setActiveCompany(data.activeCompany);
          useTerminalStore.getState().setActiveCompanyId?.(data.activeCompany.id);
        }
      })
      .catch(() => { });


    setIsOnline(navigator.onLine)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Ping live API to check true reachability
    const pingBackend = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql';
        const apiUrl = isLocalMode
          ? ''
          : (process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com');

        // We ping the test-db endpoint on the live API which returns 200 if MongoDB is up
        const res = await fetch(`${apiUrl}/api/test-db`, {
          method: 'GET',
          cache: 'no-store',
          signal: controller.signal
        });

        clearTimeout(timeoutId);
        setIsBackendOnline(res.ok);
      } catch (e) {
        setIsBackendOnline(false);
      }
    };

    pingBackend();
    const pingInterval = setInterval(pingBackend, 10000);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileMenu]);

  return (
    <header className="relative flex h-16 items-center justify-between bg-zinc-950 px-6 text-white border-b border-zinc-800 shadow-xl">
      {/* Top Dynamic Theme Accent Bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-theme-bar opacity-85" />

      <div className="flex items-center gap-4">
        <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-2">
          <span 
            className="h-2 w-2 rounded-full shadow-sm"
            style={{ 
              backgroundColor: 'var(--theme-accent, #DB2777)',
              boxShadow: '0 0 8px var(--theme-accent, #DB2777)'
            }} 
          />
          <span>Vseyal POS</span>
        </h1>
        <button
          onClick={() => window.location.href = '/dashboard'}
          className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 text-xs font-bold text-zinc-300 shadow-sm transition-all hover:bg-zinc-800 hover:text-white cursor-pointer active:scale-95"
        >
          <LayoutDashboard className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
          <span>Dashboard</span>
        </button>

        {(role === 'company_admin' || role === 'admin' || role === 'super_admin') && (
          <>
            <button
              onClick={() => window.location.href = '/kitchen'}
              className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-sm transition-all hover:bg-amber-500/20 cursor-pointer active:scale-95"
              title="Open Kitchen Display (KOT)"
            >
              <ChefHat className="h-3.5 w-3.5 text-amber-400" />
              <span>Kitchen</span>
            </button>

            <button
              onClick={() => window.location.href = '/tables'}
              className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 text-xs font-bold text-emerald-300 shadow-sm transition-all hover:bg-emerald-500/20 cursor-pointer active:scale-95"
              title="Manage Tables"
            >
              <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-400" />
              <span>Tables</span>
            </button>
          </>
        )}

        {activeCompany && (
          <div
            onClick={() => { if (role === 'admin' || role === 'super_admin') window.location.href = '/companies'; }}
            className={`flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 ${role === 'admin' || role === 'super_admin' ? 'cursor-pointer hover:bg-zinc-800 hover:border-theme hover:text-white transition' : ''}`}
            title={role === 'admin' || role === 'super_admin' ? 'Click to manage companies' : 'Active Company'}
          >
            <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
            <span>{activeCompany.name}</span>
            <span 
              className="rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono"
              style={{ color: 'var(--theme-badge-text, #F472B6)' }}
            >
              {activeCompany.code}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* Order Type & Table Selection: Beside left of the ONLINE indicator */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl bg-zinc-900 p-1 border border-zinc-800">
            {(['Dine In', 'Takeaway', 'Delivery'] as const).map((type) => {
              const isActive = orderType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setOrderType(type);
                    if (type === 'Dine In') {
                      setIsTableModalOpen(true);
                    } else if (type === 'Delivery') {
                      setIsDeliveryModalOpen(true);
                    }
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-black transition-all cursor-pointer ${
                    isActive
                      ? 'bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow'
                      : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  }`}
                >
                  {type}
                </button>
              );
            })}
          </div>

          {orderType === 'Dine In' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsTableModalOpen(true)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border ${
                  selectedTable
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300 shadow-lg shadow-emerald-950/40 hover:bg-emerald-900/60'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                <UtensilsCrossed className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  {selectedTable
                    ? `Table ${selectedTable.name} · ${selectedGuestCount} ${selectedGuestCount === 1 ? 'guest' : 'guests'}`
                    : 'Choose a Table'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </button>

              <button
                type="button"
                onClick={() => setIsWaiterModalOpen(true)}
                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer border ${
                  assignedWaiter || selectedTable?.waiterName
                    ? 'border-indigo-500/50 bg-indigo-950/60 text-indigo-300 shadow-lg shadow-indigo-950/40 hover:bg-indigo-900/60'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
                title="Assign / Change Waiter"
              >
                <User className="h-3.5 w-3.5 text-indigo-400" />
                <span className="truncate max-w-[130px]">
                  {assignedWaiter?.name || selectedTable?.waiterName ? `Server: ${assignedWaiter?.name || selectedTable?.waiterName}` : 'Assign Waiter'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </button>
            </div>
          )}

          {orderType === 'Delivery' && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsDeliveryModalOpen(true)}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer border ${
                  deliveryInfo.platform === 'Zomato'
                    ? 'border-red-500/60 bg-red-950/60 text-red-300 shadow-lg shadow-red-950/40 hover:bg-red-900/60'
                    : deliveryInfo.platform === 'Swiggy'
                    ? 'border-orange-500/60 bg-orange-950/60 text-orange-300 shadow-lg shadow-orange-950/40 hover:bg-orange-900/60'
                    : deliveryInfo.deliveryAddress
                    ? 'border-indigo-500/50 bg-indigo-950/60 text-indigo-300 shadow-lg shadow-indigo-950/40 hover:bg-indigo-900/60'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white'
                }`}
              >
                {deliveryInfo.platform === 'Zomato' ? (
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="h-4 w-4 rounded bg-red-600 text-white font-black text-[10px] flex items-center justify-center">Z</span>
                    <span>Zomato</span>
                  </span>
                ) : deliveryInfo.platform === 'Swiggy' ? (
                  <span className="flex items-center gap-1 text-orange-400">
                    <span className="h-4 w-4 rounded bg-orange-600 text-white font-black text-[10px] flex items-center justify-center">S</span>
                    <span>Swiggy</span>
                  </span>
                ) : (
                  <Truck className="h-3.5 w-3.5 text-indigo-400" />
                )}
                <span className="truncate max-w-[170px]">
                  {deliveryInfo.onlineOrderId
                    ? `#${deliveryInfo.onlineOrderId}`
                    : (deliveryInfo.platform === 'Zomato' || deliveryInfo.platform === 'Swiggy')
                    ? `Enter ${deliveryInfo.platform} ID`
                    : deliveryInfo.deliveryAddress
                    ? `${deliveryInfo.customerName ? deliveryInfo.customerName + ' · ' : ''}${deliveryInfo.deliveryAddress}`
                    : 'Delivery Details'}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              </button>

              {deliveryInfo.deliveryPersonName && (
                <button
                  type="button"
                  onClick={() => setIsDeliveryModalOpen(true)}
                  className="flex items-center gap-1 rounded-xl bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-900/40 transition cursor-pointer"
                  title="Assigned Delivery Staff"
                >
                  <User className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="truncate max-w-[120px]">{deliveryInfo.deliveryPersonName}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setIsDeliveryModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all cursor-pointer border border-amber-500/40 bg-amber-950/40 text-amber-300 hover:bg-amber-900/40 active:scale-95"
                title="Connect Zomato / Swiggy Online Orders"
              >
                <Zap className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Connect Online Order</span>
              </button>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-zinc-800" />

        <div className="flex flex-col items-end mr-2">
          {isOnline && isBackendOnline ? (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
              <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></div>
              <span>ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-rose-500">
              <div className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_#f43f5e]"></div>
              <span>OFFLINE</span>
            </div>
          )}

          {offlineQueue.length > 0 && (
            <div className="text-[10px] font-black text-amber-400">
              {isSyncing ? `SYNCING ${offlineQueue.length} BILLS...` : `${offlineQueue.length} PENDING SYNC`}
            </div>
          )}
          {isOnline && offlineQueue.length === 0 && (
            <div className="text-[10px] font-semibold text-zinc-500">
              All bills synced
            </div>
          )}
        </div>



        <div className="h-6 w-px bg-zinc-800"></div>

        <div className="flex items-center gap-3 pl-1">
          <div className="flex flex-col text-right">
            <span className="text-xs font-black text-white">
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
            <span className="text-[10px] text-zinc-500 font-medium">
              {username ? `${username} • Active` : 'Active User'}
            </span>
          </div>

          <div className="relative flex items-center" ref={profileMenuRef}>
            <div 
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 ${isLocalMode ? 'cursor-pointer hover:bg-zinc-800 hover:border-theme transition' : ''}`}
              title={isLocalMode ? "Profile • Click to toggle logout menu" : undefined}
              onClick={() => { if (isLocalMode) setShowProfileMenu(prev => !prev); }}
            >
              <UserCircle className="h-5 w-5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
            </div>

            {/* Profile dropdown menu on profile icon click in Local Mode */}
            {isLocalMode && showProfileMenu && (
              <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
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

      <DeliveryDetailsModal
        isOpen={isDeliveryModalOpen}
        onClose={() => setIsDeliveryModalOpen(false)}
      />

      <WaiterAssignmentModal
        isOpen={isWaiterModalOpen}
        onClose={() => setIsWaiterModalOpen(false)}
        onSelectWaiter={(waiter) => {
          setAssignedWaiter(waiter);
          if (selectedTable) {
            setTableWaiter(selectedTable.id, waiter?.id || null, waiter?.name || null);
            if (selectedTable.activeOrderId) {
              fetch('/api/dine-in-orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'assignWaiter',
                  orderId: selectedTable.activeOrderId,
                  waiterId: waiter?.id || null,
                  waiterName: waiter?.name || null,
                }),
              }).catch(console.error);
            }
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