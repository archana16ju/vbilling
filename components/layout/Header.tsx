'use client';
import { UserCircle, Building2, Shield, Truck, Sun, Moon, LogOut, HelpCircle } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import ShiftAlertsBell from "@/components/notifications/ShiftAlertsBell"
import ReplenishmentNotificationBell from "@/components/notifications/ReplenishmentNotificationBell"
import { useShortcutsStore } from "@/store/useShortcutsStore"

/* ─────────────────────────────────────────
   Tooltip wrapper – matches Terminal Header style
───────────────────────────────────────── */
function Tip({
  label,
  children,
  side = 'bottom',
}: {
  label: string;
  children: React.ReactNode;
  side?: 'bottom' | 'top';
}) {
  return (
    <div className="relative group/tip flex items-center justify-center">
      {children}
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
  );
}

export default function Header() {
  const [role, setRole] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string; code: string } | null>(null)
  const [currentDate, setCurrentDate] = useState('')
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark')
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const profileMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setShowProfileMenu(false)
      }
    }
    if (showProfileMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showProfileMenu])

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' })
    } catch {}
    try {
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

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }))

    const userMatch = document.cookie.match(/(^| )auth_username=([^;]+)/);
    const u = userMatch ? userMatch[2] : null;
    if (u) setUsername(u);

    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    if (r) setRole(r === 'admin' ? (u?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : r);

    // Initial theme mode detection
    const savedUserMode = u ? localStorage.getItem(`dashboard_theme_mode_${u}`) : null;
    const savedGlobalMode = localStorage.getItem('dashboard_theme_mode');
    const isLightActive = typeof document !== 'undefined' && document.documentElement.classList.contains('light-mode');
    const determinedMode = (savedUserMode || savedGlobalMode || (isLightActive ? 'light' : 'dark')) as 'dark' | 'light';
    setThemeMode(determinedMode);

    // Fetch verified session to guarantee role & username are immediately available
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me && me.authenticated && me.role) {
          const normalized = me.role === 'admin' ? (me.username?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : me.role;
          setRole(normalized);
          if (me.username) {
            setUsername(me.username);
            const userSpecificMode = localStorage.getItem(`dashboard_theme_mode_${me.username}`);
            if (userSpecificMode === 'light' || userSpecificMode === 'dark') {
              setThemeMode(userSpecificMode);
            }
          }
          try {
            document.cookie = `auth_role=${normalized}; path=/; max-age=604800; SameSite=Lax`;
            if (me.username) document.cookie = `auth_username=${me.username}; path=/; max-age=604800; SameSite=Lax`;
            const currentCompMatch = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
            const hasCompanyCookie = currentCompMatch && currentCompMatch[2];
            if (me.companyId && (!hasCompanyCookie || normalized !== 'super_admin')) {
              document.cookie = `auth_company_id=${me.companyId}; path=/; max-age=604800; SameSite=Lax`;
            }
          } catch {}
          if (me.companyName && me.companyId && !activeCompany) {
            setActiveCompany({ id: me.companyId, name: me.companyName, code: me.companyId.replace('COMP-', '') });
          }
        }
      })
      .catch(() => {});

    // Fetch active company
    const refreshActiveCompany = () => {
      fetch('/api/companies/active')
        .then(res => res.json())
        .then(data => {
          if (data.activeCompany) {
            setActiveCompany(data.activeCompany);
          }
        })
        .catch(() => {});
    };

    refreshActiveCompany();

    const handleCompanySwitched = (e: any) => {
      if (e?.detail?.company) {
        setActiveCompany(e.detail.company);
      } else {
        refreshActiveCompany();
      }
    };

    const handleExternalThemeChange = (e: any) => {
      const mode = e?.detail?.mode;
      if (mode === 'light' || mode === 'dark') {
        setThemeMode(mode);
      }
    };

    window.addEventListener('company-switched', handleCompanySwitched);
    window.addEventListener('dashboard-theme-mode-changed', handleExternalThemeChange);

    return () => {
      window.removeEventListener('company-switched', handleCompanySwitched);
      window.removeEventListener('dashboard-theme-mode-changed', handleExternalThemeChange);
    };
  }, []);

  // Handler for independent dark/light mode toggle
  const handleThemeToggle = (newMode: 'dark' | 'light') => {
    setThemeMode(newMode);
    try {
      localStorage.setItem('dashboard_theme_mode', newMode);
      if (username) {
        localStorage.setItem(`dashboard_theme_mode_${username}`, newMode);
      }
    } catch {}

    const root = document.documentElement;
    root.setAttribute('data-theme', newMode);
    if (newMode === 'light') {
      root.classList.add('light-mode');
      root.classList.remove('dark-mode', 'dark');
      root.style.setProperty('--theme-mode', 'light');
      if (document.body) {
        document.body.setAttribute('data-theme', 'light');
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode', 'dark');
      }
    } else {
      root.classList.add('dark-mode', 'dark');
      root.classList.remove('light-mode');
      root.style.setProperty('--theme-mode', 'dark');
      if (document.body) {
        document.body.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode');
        document.body.classList.add('dark');
        document.body.classList.remove('light-mode');
      }
    }

    window.dispatchEvent(new CustomEvent('dashboard-theme-mode-changed', { detail: { mode: newMode } }));
  };

  const isSuperAdmin = role === 'super_admin';

  return (
    <header className="sticky top-0 z-20 flex h-16 flex-col justify-between bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800 px-6 sm:px-8">
      <div className="flex h-full items-center justify-between">
        <div className="flex flex-col">
          <h2 className="text-lg sm:text-xl font-black tracking-tight text-white flex items-center gap-2">
            <span>{isSuperAdmin ? 'Super Admin System' : role === 'waiter' ? 'Waiter Service Portal' : role === 'delivery_staff' ? 'Delivery Staff Portal' : 'Company Dashboard'}</span>
          </h2>
          <span className="text-xs font-medium text-zinc-400">{currentDate}</span>
        </div>

        <div className="flex items-center gap-3 sm:gap-4">
          {/* ── Company Name – Terminal Icon-Based Design ── */}
          {activeCompany && (
            <Tip label={activeCompany.name}>
              {isSuperAdmin ? (
                <Link
                  href="/super-admin"
                  className="flex h-8 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-300 transition-all hover:bg-zinc-800 hover:border-theme hover:text-white shadow-sm cursor-pointer"
                  title="Super Admin: Click to manage companies"
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                  <span className="font-bold text-zinc-200">{activeCompany.name}</span>
                  <span
                    className="rounded px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-[10px] font-mono"
                    style={{ color: 'var(--theme-badge-text, #F472B6)' }}
                  >
                    {activeCompany.code}
                  </span>
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (role === 'company_admin' || role === 'admin') window.location.href = '/companies';
                  }}
                  className={`flex h-8 items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs font-bold text-zinc-300 transition-all shadow-sm ${
                    role === 'company_admin' || role === 'admin'
                      ? 'cursor-pointer hover:bg-zinc-800 hover:border-theme hover:text-white'
                      : 'cursor-default'
                  }`}
                  title={role === 'company_admin' || role === 'admin' ? "Click to view company details" : activeCompany.name}
                >
                  <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                  <span className="font-bold text-zinc-200">{activeCompany.name}</span>
                  <span
                    className="rounded px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-[10px] font-mono"
                    style={{ color: 'var(--theme-badge-text, #F472B6)' }}
                  >
                    {activeCompany.code}
                  </span>
                </button>
              )}
            </Tip>
          )}

          {/* ── Dashboard Independent Theme Mode (Dark & Light Mode Icons - Terminal Style) ── */}
          <div className="flex items-center gap-1 rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 shadow-sm">
            <Tip label="Light Mode">
              <button
                type="button"
                onClick={() => handleThemeToggle('light')}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'
                }`}
                title="Switch to Light Mode"
                aria-label="Dashboard Light Mode"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
            </Tip>

            <Tip label="Dark Mode">
              <button
                type="button"
                onClick={() => handleThemeToggle('dark')}
                className={`flex h-7 w-7 items-center justify-center rounded-lg transition-all cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-sm'
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 border border-transparent'
                }`}
                title="Switch to Dark Mode"
                aria-label="Dashboard Dark Mode"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
            </Tip>
          </div>
 
          {/* Stock Replenishment Notification Bell */}
          <ReplenishmentNotificationBell />

          {/* Shift Alerts Notification Bell - Strictly for assigned staff, not Super Admin or Company Admin */}
          {!isSuperAdmin && role !== 'company_admin' && role !== 'admin' && (
            <ShiftAlertsBell />
          )}

          {/* Common Help (?) Icon for Keyboard Shortcuts */}
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

          {/* User Session & Avatar with Profile Menu */}
          <div className="relative flex items-center gap-3 text-zinc-400" ref={profileMenuRef}>
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold flex items-center justify-end gap-1.5">
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-950/60 border border-amber-800/80 px-2.5 py-0.5 text-xs font-black text-amber-300">
                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                    Super Admin
                  </span>
                ) : role === 'company_admin' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full theme-badge px-2.5 py-0.5 text-xs font-black">
                    Company Admin
                  </span>
                ) : role === 'waiter' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 px-2.5 py-0.5 text-xs font-black shadow-sm">
                    Waiter
                  </span>
                ) : role === 'delivery_staff' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-950/60 border border-pink-500/40 text-pink-300 px-2.5 py-0.5 text-xs font-black shadow-sm">
                    <Truck className="h-3.5 w-3.5 text-pink-400" />
                    Delivery Staff
                  </span>
                ) : (
                  <span className="capitalize font-bold text-zinc-200">{role || 'Loading...'}</span>
                )}
              </div>
              <div className="text-[11px] text-zinc-500 font-medium">Current Session</div>
            </div>

            <Tip label={`${username || 'User'} · Logout`}>
              <div
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300 transition cursor-pointer hover:bg-zinc-800 hover:border-theme shadow-sm"
                onClick={() => setShowProfileMenu(prev => !prev)}
              >
                <UserCircle className="h-6 w-6 text-theme-accent" />
              </div>
            </Tip>

            {/* Profile dropdown */}
            {showProfileMenu && (
              <div className="absolute right-0 top-12 z-50 w-48 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 shadow-2xl">
                <div className="px-3 py-2 border-b border-zinc-800 text-xs">
                  <p className="font-bold text-white">{username || 'User'}</p>
                  <p className="text-zinc-400 capitalize">{role ? role.replace('_', ' ') : 'User'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-theme-accent hover:bg-theme-badge border border-transparent hover:border-theme transition cursor-pointer"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Top Dynamic Theme Accent Bar */}
      <div className="h-[2px] w-full bg-theme-bar opacity-80" />
    </header>
  );
}
