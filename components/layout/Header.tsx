'use client';

import {
  UserCircle,
  Building2,
  Shield,
  Truck,
  Sun,
  Moon,
  Laptop,
  LogOut,
  HelpCircle,
  Keyboard,
  BookOpen,
  LifeBuoy,
  ExternalLink,
  Check,
  Settings,
  ShieldCheck,
  User,
  ChefHat,
  Sparkles,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import SmartNotificationBell from "@/components/notifications/SmartNotificationBell"
import { useShortcutsStore } from "@/store/useShortcutsStore"

export default function Header() {
  const [role, setRole] = useState<string | null>(null)
  const [username, setUsername] = useState<string | null>(null)
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string; code: string } | null>(null)
  const [currentDate, setCurrentDate] = useState('')
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark')
  
  // Compact smart header hover & click menu state
  const [activeMenu, setActiveMenu] = useState<'company' | 'theme' | 'help' | 'role' | 'profile' | null>(null)
  const headerRef = useRef<HTMLElement>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMenuEnter = (menuId: 'company' | 'theme' | 'help' | 'role' | 'profile') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveMenu(menuId)
  }

  const handleMenuLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      setActiveMenu(null)
    }, 180)
  }

  const handleMenuClick = (menuId: 'company' | 'theme' | 'help' | 'role' | 'profile') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setActiveMenu(prev => (prev === menuId ? null : menuId))
  }

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      weekday: 'short',
      year: 'numeric',
      month: 'short',
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
            if (userSpecificMode === 'light' || userSpecificMode === 'dark' || userSpecificMode === 'system') {
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
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
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

  // Handler for independent dark/light/system mode toggle
  const handleThemeToggle = (newMode: 'dark' | 'light' | 'system') => {
    setThemeMode(newMode);
    try {
      localStorage.setItem('dashboard_theme_mode', newMode);
      if (username) {
        localStorage.setItem(`dashboard_theme_mode_${username}`, newMode);
      }
    } catch {}

    let effective = newMode;
    if (newMode === 'system') {
      effective = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    }

    const root = document.documentElement;
    root.setAttribute('data-theme', effective);
    root.setAttribute('data-theme-setting', newMode);
    if (effective === 'light') {
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
        document.body.classList.add('dark-mode', 'dark');
        document.body.classList.remove('light-mode');
      }
    }

    window.dispatchEvent(new CustomEvent('dashboard-theme-mode-changed', { detail: { mode: newMode, effective } }));
  };

  const isSuperAdmin = role === 'super_admin';

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-20 flex h-12 flex-col justify-between bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800/80 px-4 sm:px-6 transition-all duration-200"
    >
      <div className="flex h-full items-center justify-between">
        {/* ── Left: Compact Title & Date ── */}
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5 truncate">
            <span className="truncate">
              {isSuperAdmin
                ? 'Super Admin'
                : role === 'waiter'
                  ? 'Waiter Portal'
                  : role === 'delivery_staff'
                    ? 'Delivery Staff'
                    : role === 'chef'
                      ? 'Kitchen Display'
                      : 'Dashboard'}
            </span>
          </h2>
          <span className="hidden md:inline-flex items-center text-[11px] font-medium text-zinc-400 pl-2.5 border-l border-zinc-800 shrink-0">
            {currentDate}
          </span>
        </div>

        {/* ── Right: Compact Smart Header Items with Hover Details ── */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* 1. COMPANY SELECTOR */}
          {activeCompany && (
            <div
              className="relative"
              onMouseEnter={() => handleMenuEnter('company')}
              onMouseLeave={handleMenuLeave}
            >
              <button
                type="button"
                onClick={() => handleMenuClick('company')}
                className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  activeMenu === 'company'
                    ? 'border-pink-500 bg-pink-950/40 text-pink-300 shadow-md shadow-pink-950/30'
                    : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-pink-500/60 hover:bg-zinc-800 hover:text-white'
                }`}
                aria-label="Company Details"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                <span className="font-mono text-[11px] font-black tracking-wide text-pink-400">
                  {activeCompany.code}
                </span>
              </button>

              {/* Hover / Click Dropdown for Company Details */}
              {activeMenu === 'company' && (
                <div
                  onMouseEnter={() => handleMenuEnter('company')}
                  onMouseLeave={handleMenuLeave}
                  className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-3 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/20 text-pink-400 border border-pink-500/30">
                        <Building2 className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-zinc-100">Company Overview</h4>
                        <span className="text-[10px] text-zinc-400">Multi-tenant scope</span>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-black text-emerald-400 uppercase tracking-wider">
                      Active
                    </span>
                  </div>

                  <div className="space-y-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70 p-2.5 text-xs">
                    <div>
                      <span className="text-[10px] font-medium text-zinc-400 block">Full Company Name</span>
                      <p className="font-bold text-white text-sm truncate">{activeCompany.name}</p>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 text-[11px]">
                      <span className="text-zinc-400">Company Code</span>
                      <span className="font-mono font-bold text-pink-400 bg-pink-950/40 border border-pink-500/30 px-1.5 py-0.5 rounded">
                        {activeCompany.code}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">Company ID</span>
                      <span className="font-mono text-zinc-300">{activeCompany.id}</span>
                    </div>
                  </div>

                  {/* Contextual navigation */}
                  {isSuperAdmin ? (
                    <Link
                      href="/super-admin"
                      onClick={() => setActiveMenu(null)}
                      className="mt-2.5 flex items-center justify-between rounded-xl bg-pink-950/30 hover:bg-pink-950/50 border border-pink-500/40 px-2.5 py-1.5 text-xs font-bold text-pink-300 hover:text-white transition shadow-xs"
                    >
                      <span>Manage All Companies</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : role === 'company_admin' || role === 'admin' ? (
                    <Link
                      href="/companies"
                      onClick={() => setActiveMenu(null)}
                      className="mt-2.5 flex items-center justify-between rounded-xl bg-zinc-800/80 hover:bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs font-bold text-zinc-200 hover:text-white transition"
                    >
                      <span>Company Profile & Settings</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* 2. THEME MODE */}
          <div
            className="relative"
            onMouseEnter={() => handleMenuEnter('theme')}
            onMouseLeave={handleMenuLeave}
          >
            <button
              type="button"
              onClick={() => handleMenuClick('theme')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all shadow-xs cursor-pointer ${
                activeMenu === 'theme'
                  ? 'border-pink-500 bg-pink-950/40 text-pink-300 shadow-md shadow-pink-950/30'
                  : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white'
              }`}
              title={`Theme: ${themeMode}`}
              aria-label="Theme Mode Selection"
            >
              {themeMode === 'light' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : themeMode === 'system' ? (
                <Laptop className="h-4 w-4 text-emerald-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-400" />
              )}
            </button>

            {/* Hover / Click Dropdown for Theme Options */}
            {activeMenu === 'theme' && (
              <div
                onMouseEnter={() => handleMenuEnter('theme')}
                onMouseLeave={handleMenuLeave}
                className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2.5 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
              >
                <div className="border-b border-zinc-800/80 pb-2 mb-2 px-1">
                  <h4 className="text-xs font-bold text-zinc-100">Theme Appearance</h4>
                  <p className="text-[10px] text-zinc-400">Select dashboard interface mode</p>
                </div>

                <div className="space-y-1">
                  {/* Light */}
                  <button
                    type="button"
                    onClick={() => {
                      handleThemeToggle('light');
                      setActiveMenu(null);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                      themeMode === 'light'
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
                    {themeMode === 'light' && <Check className="h-4 w-4 text-amber-400 shrink-0" />}
                  </button>

                  {/* Dark */}
                  <button
                    type="button"
                    onClick={() => {
                      handleThemeToggle('dark');
                      setActiveMenu(null);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                      themeMode === 'dark'
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
                    {themeMode === 'dark' && <Check className="h-4 w-4 text-indigo-400 shrink-0" />}
                  </button>

                  {/* System */}
                  <button
                    type="button"
                    onClick={() => {
                      handleThemeToggle('system');
                      setActiveMenu(null);
                    }}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition cursor-pointer ${
                      themeMode === 'system'
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
                    {themeMode === 'system' && <Check className="h-4 w-4 text-emerald-400 shrink-0" />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. SMART NOTIFICATIONS (Compact Bell with Categories & Recent Hover Details) */}
          <SmartNotificationBell />

          {/* 4. HELP & SHORTCUTS */}
          <div
            className="relative"
            onMouseEnter={() => handleMenuEnter('help')}
            onMouseLeave={handleMenuLeave}
          >
            <button
              type="button"
              onClick={() => handleMenuClick('help')}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all shadow-xs cursor-pointer ${
                activeMenu === 'help'
                  ? 'border-pink-500 bg-pink-950/40 text-pink-300 shadow-md shadow-pink-950/30'
                  : 'border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:border-zinc-700 hover:bg-zinc-800 hover:text-white'
              }`}
              title="Help & Resources"
              aria-label="Help & Keyboard Shortcuts"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {/* Hover / Click Dropdown for Help */}
            {activeMenu === 'help' && (
              <div
                onMouseEnter={() => handleMenuEnter('help')}
                onMouseLeave={handleMenuLeave}
                className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2.5 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
              >
                <div className="border-b border-zinc-800/80 pb-2 mb-2 px-1">
                  <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5 text-pink-400" />
                    Help & Resources
                  </h4>
                  <p className="text-[10px] text-zinc-400">Shortcuts, guides & system support</p>
                </div>

                <div className="space-y-1">
                  {/* Keyboard Shortcuts */}
                  <button
                    type="button"
                    onClick={() => {
                      useShortcutsStore.getState().openHelpModal();
                      setActiveMenu(null);
                    }}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-pink-400">
                        <Keyboard className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-200">Keyboard Shortcuts</p>
                        <p className="text-[10px] text-zinc-400">Quick terminal shortcuts</p>
                      </div>
                    </div>
                    <kbd className="rounded px-1.5 py-0.5 bg-zinc-800 border border-zinc-700 text-[10px] font-mono font-bold text-zinc-300">
                      ?
                    </kbd>
                  </button>

                  {/* Documentation */}
                  <Link
                    href="/settings"
                    onClick={() => setActiveMenu(null)}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-left hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 transition"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-cyan-400">
                        <BookOpen className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-200">Documentation</p>
                        <p className="text-[10px] text-zinc-400">User guide & configuration</p>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-zinc-500" />
                  </Link>

                  {/* Help Center & Support */}
                  <div className="w-full flex items-center justify-between p-2 rounded-xl bg-zinc-950/60 border border-zinc-800/70">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 text-emerald-400">
                        <LifeBuoy className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-zinc-200">Help Center & Support</p>
                        <p className="text-[10px] text-zinc-400">Vseyal POS 2.0 · Local MySQL</p>
                      </div>
                    </div>
                    <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-mono text-emerald-400">
                      Online
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. ROLE INDICATOR */}
          <div
            className="relative"
            onMouseEnter={() => handleMenuEnter('role')}
            onMouseLeave={handleMenuLeave}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={() => handleMenuClick('role')}
              className={`flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                activeMenu === 'role'
                  ? 'border-pink-500 bg-pink-950/40 text-pink-300 shadow-md shadow-pink-950/30'
                  : isSuperAdmin
                    ? 'border-amber-800/80 bg-amber-950/50 text-amber-300 hover:border-amber-600'
                    : role === 'company_admin' || role === 'admin'
                      ? 'border-pink-800/80 bg-pink-950/50 text-pink-300 hover:border-pink-600'
                      : role === 'waiter'
                        ? 'border-emerald-800/80 bg-emerald-950/50 text-emerald-300 hover:border-emerald-600'
                        : role === 'chef'
                          ? 'border-amber-800/80 bg-amber-950/50 text-amber-300 hover:border-amber-600'
                          : role === 'delivery_staff'
                            ? 'border-pink-800/80 bg-pink-950/50 text-pink-300 hover:border-pink-600'
                            : 'border-zinc-800 bg-zinc-900/90 text-zinc-300 hover:border-zinc-700'
              }`}
              title="Role & Session Details"
              aria-label="Role & Session"
            >
              {isSuperAdmin ? (
                <>
                  <Shield className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-black text-amber-300 tracking-wider">SUPER</span>
                </>
              ) : role === 'company_admin' || role === 'admin' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500 animate-pulse shrink-0" />
                  <span className="text-[11px] font-black text-pink-300 tracking-wider">ADMIN</span>
                </>
              ) : role === 'manager' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                  <span className="text-[11px] font-black text-blue-300 tracking-wider">MGR</span>
                </>
              ) : role === 'chef' ? (
                <>
                  <ChefHat className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-[11px] font-black text-amber-300 tracking-wider">CHEF</span>
                </>
              ) : role === 'waiter' ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-[11px] font-black text-emerald-300 tracking-wider">WAITER</span>
                </>
              ) : role === 'delivery_staff' ? (
                <>
                  <Truck className="h-3 w-3 text-pink-400 shrink-0" />
                  <span className="text-[11px] font-black text-pink-300 tracking-wider">DELIVERY</span>
                </>
              ) : (
                <span className="text-[11px] font-bold text-zinc-300 uppercase">{role || 'STAFF'}</span>
              )}
            </div>

            {/* Hover / Click Dropdown for Role & Session */}
            {activeMenu === 'role' && (
              <div
                onMouseEnter={() => handleMenuEnter('role')}
                onMouseLeave={handleMenuLeave}
                className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-3 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
              >
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-950 border border-zinc-800 text-pink-400">
                      <ShieldCheck className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-zinc-100">Role & Session</h4>
                      <span className="text-[10px] text-zinc-400">Authorization scope</span>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Live
                  </span>
                </div>

                <div className="space-y-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70 p-2.5 text-xs">
                  <div>
                    <span className="text-[10px] font-medium text-zinc-400 block">Full Role Title</span>
                    <p className="font-bold text-white text-sm">
                      {isSuperAdmin
                        ? 'Super Administrator'
                        : role === 'company_admin' || role === 'admin'
                          ? 'Company Administrator'
                          : role === 'manager'
                            ? 'Restaurant / Store Manager'
                            : role === 'chef'
                              ? 'Executive Kitchen Chef'
                              : role === 'waiter'
                                ? 'Dining Room Waiter'
                                : role === 'delivery_staff'
                                  ? 'Express Delivery Staff'
                                  : role === 'cashier'
                                    ? 'POS Terminal Cashier'
                                    : role || 'Store Staff'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/60 text-[11px]">
                    <span className="text-zinc-400">Active User</span>
                    <span className="font-bold text-zinc-200">{username || 'Authenticated'}</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Session Status</span>
                    <span className="text-emerald-400 font-medium">Verified Active Session</span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-zinc-400">Store Scope</span>
                    <span className="font-medium text-zinc-300 truncate max-w-[130px]">
                      {activeCompany ? `${activeCompany.name}` : 'All System Databases'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 6. USER PROFILE & LOGOUT */}
          <div
            className="relative"
            onMouseEnter={() => handleMenuEnter('profile')}
            onMouseLeave={handleMenuLeave}
          >
            <button
              type="button"
              onClick={() => handleMenuClick('profile')}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-all shadow-xs cursor-pointer ${
                activeMenu === 'profile'
                  ? 'border-pink-500 bg-pink-950/40 shadow-md shadow-pink-950/30'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-pink-500/60 hover:bg-zinc-800'
              }`}
              title="Profile & Settings"
              aria-label="User Profile"
            >
              <UserCircle className="h-5 w-5 text-theme-accent" />
            </button>

            {/* Hover / Click Dropdown for Profile */}
            {activeMenu === 'profile' && (
              <div
                onMouseEnter={() => handleMenuEnter('profile')}
                onMouseLeave={handleMenuLeave}
                className="absolute right-0 top-full mt-1.5 w-60 sm:w-64 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2.5 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
              >
                {/* User Info Overview */}
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 text-pink-400 shrink-0">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">{username || 'User'}</p>
                    <p className="text-[10px] text-zinc-400 capitalize truncate">
                      {role ? role.replace('_', ' ') : 'User'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  {/* Account Settings */}
                  <Link
                    href="/settings"
                    onClick={() => setActiveMenu(null)}
                    className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition"
                  >
                    <Settings className="h-3.5 w-3.5 text-zinc-400" />
                    <span>Account Settings</span>
                  </Link>

                  {/* Sign Out Button */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-bold text-pink-400 hover:text-white hover:bg-pink-950/40 border border-transparent hover:border-pink-800/60 transition cursor-pointer mt-1 pt-1.5 border-t border-zinc-800/80"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    <span>Sign out of session</span>
                  </button>
                </div>
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
