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
  Utensils,
  ChevronDown,
  Home,
  ShoppingBag,
  BarChart3,
  Package,
  SlidersHorizontal,
  LayoutGrid,
  ClipboardList,
  List,
  Tags,
  Layers,
  BadgePercent,
  Box,
  CalendarCheck,
  Users,
  Megaphone,
  BellRing,
  ShieldAlert,
  Compass,
  MoreHorizontal,
} from "lucide-react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import SmartNotificationBell from "@/components/notifications/SmartNotificationBell"
import { useShortcutsStore } from "@/store/useShortcutsStore"
import CustomizeHeaderModal from "@/components/dashboard/CustomizeHeaderModal"
import {
  CompanyHeaderNavConfig,
  DEFAULT_HEADER_NAV_CONFIG,
  HeaderNavItemConfig,
  normalizeHeaderNavConfig,
} from "@/lib/header-nav-config"

// Icon mapping dictionary
const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  ShoppingBag,
  BarChart3,
  Package,
  Settings,
  LayoutGrid,
  ClipboardList,
  List,
  Utensils,
  Truck,
  Tags,
  Layers,
  BadgePercent,
  Box,
  User,
  CalendarCheck,
  Users,
  Building2,
  Megaphone,
  BellRing,
  ShieldAlert,
  ShieldCheck,
};

/* ─────────────────────────────────────────
   Tooltip wrapper
───────────────────────────────────────── */
function Tip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative group/tip flex items-center justify-center">
      {children}
      <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none opacity-0 group-hover/tip:opacity-100 transition-opacity duration-150 whitespace-nowrap rounded-lg bg-zinc-900 border border-zinc-700 px-2 py-1 text-[11px] font-bold text-zinc-200 shadow-xl">
        {label}
      </div>
    </div>
  );
}

export default function Header() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string; code: string } | null>(null);
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>('dark');
  
  // Header Nav Customization state
  const [navConfig, setNavConfig] = useState<CompanyHeaderNavConfig>(DEFAULT_HEADER_NAV_CONFIG);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const moreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Terminal-style theme dropdown state
  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const themeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Compact smart header hover & click menu state
  const [activeMenu, setActiveMenu] = useState<'company' | 'help' | 'role' | 'profile' | null>(null);
  const headerRef = useRef<HTMLElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMenuEnter = (menuId: 'company' | 'help' | 'role' | 'profile') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(menuId);
  };

  const handleMenuLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActiveMenu(null);
    }, 180);
  };

  const handleMenuClick = (menuId: 'company' | 'help' | 'role' | 'profile') => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setActiveMenu(prev => (prev === menuId ? null : menuId));
  };

  // Terminal-identical theme hover & click handlers
  const handleThemeMenuEnter = () => {
    if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current);
    setIsThemeOpen(true);
  };

  const handleThemeMenuLeave = () => {
    if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current);
    themeTimeoutRef.current = setTimeout(() => {
      setIsThemeOpen(false);
    }, 200);
  };

  const handleThemeMenuClick = () => {
    if (themeTimeoutRef.current) clearTimeout(themeTimeoutRef.current);
    setIsThemeOpen(prev => !prev);
  };

  // More dropdown hover & click handlers
  const handleMoreMenuEnter = () => {
    if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current);
    setIsMoreMenuOpen(true);
  };

  const handleMoreMenuLeave = () => {
    if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current);
    moreTimeoutRef.current = setTimeout(() => {
      setIsMoreMenuOpen(false);
    }, 200);
  };

  // Close menus on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setActiveMenu(null);
        setIsThemeOpen(false);
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch {}
    try {
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

  // Fetch Header Nav Config for current company
  const loadNavConfig = () => {
    try {
      const cached = localStorage.getItem('company_header_nav_config');
      if (cached) {
        setNavConfig(normalizeHeaderNavConfig(JSON.parse(cached)));
      }
    } catch {}

    fetch('/api/companies/header-nav-config')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && data.config) {
          const normalized = normalizeHeaderNavConfig(data.config);
          setNavConfig(normalized);
          try {
            localStorage.setItem('company_header_nav_config', JSON.stringify(normalized));
          } catch {}
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
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
    const determinedMode = (savedUserMode || savedGlobalMode || (isLightActive ? 'light' : 'dark')) as 'dark' | 'light' | 'system';
    setThemeMode(determinedMode);

    // Fetch verified session to guarantee role & username are immediately available
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me && me.authenticated && me.role) {
          const normalized = me.role === 'admin' ? (me.username?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : me.role;
          setRole(normalized);
          if (me.username) setUsername(me.username);
        }
      })
      .catch(() => {});

    // Fetch company permissions
    fetch('/api/companies/permissions')
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data && !data.error) setPermissions(data);
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
    loadNavConfig();

    const handleCompanySwitched = (e: any) => {
      if (e?.detail?.company) {
        setActiveCompany(e.detail.company);
      } else {
        refreshActiveCompany();
      }
      loadNavConfig();
    };

    const handleExternalThemeChange = (e: any) => {
      const mode = e?.detail?.mode;
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        setThemeMode(mode);
      }
    };

    const handleNavConfigChanged = (e: any) => {
      if (e?.detail) {
        setNavConfig(normalizeHeaderNavConfig(e.detail));
      } else {
        loadNavConfig();
      }
    };

    window.addEventListener('company-switched', handleCompanySwitched);
    window.addEventListener('dashboard-theme-mode-changed', handleExternalThemeChange);
    window.addEventListener('header-nav-config-changed', handleNavConfigChanged);

    return () => {
      window.removeEventListener('company-switched', handleCompanySwitched);
      window.removeEventListener('dashboard-theme-mode-changed', handleExternalThemeChange);
      window.removeEventListener('header-nav-config-changed', handleNavConfigChanged);
    };
  }, []);

  // System OS theme synchronization listener
  useEffect(() => {
    if (themeMode !== 'system' || typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleOsThemeChange = (e: MediaQueryListEvent) => {
      const effective = e.matches ? 'dark' : 'light';
      const root = document.documentElement;
      root.setAttribute('data-theme', effective);
      if (effective === 'light') {
        root.classList.add('light-mode');
        root.classList.remove('dark-mode', 'dark');
      } else {
        root.classList.add('dark-mode', 'dark');
        root.classList.remove('light-mode');
      }
    };

    mediaQuery.addEventListener('change', handleOsThemeChange);
    return () => mediaQuery.removeEventListener('change', handleOsThemeChange);
  }, [themeMode]);

  // Handler for independent dark/light/system mode toggle matching Terminal Header
  const applyTheme = (newMode: 'dark' | 'light' | 'system') => {
    setThemeMode(newMode);
    try {
      localStorage.setItem('dashboard_theme_mode', newMode);
      localStorage.setItem('terminal_theme_mode', newMode);
      if (username) {
        localStorage.setItem(`dashboard_theme_mode_${username}`, newMode);
      }
    } catch {}

    let effective = newMode;
    if (newMode === 'system') {
      const isOsDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      effective = isOsDark ? 'dark' : 'light';
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

    try {
      window.dispatchEvent(new CustomEvent('dashboard-theme-mode-changed', { detail: { mode: newMode, effective } }));
    } catch {}
  };

  const isSuperAdmin = role === 'super_admin';
  const isStockAdmin = isSuperAdmin || role === 'company_admin' || role === 'admin' || role === 'manager';
  const isChef = role === 'chef';
  const canViewStockNotifications = isStockAdmin || isChef;
  const canCustomizeHeader = isSuperAdmin || role === 'company_admin' || role === 'manager';

  // Role and permissions filtering for navigation items
  const isItemAllowed = (item: HeaderNavItemConfig): boolean => {
    if (role === 'waiter') {
      return item.href === '/tables' || item.href === '/assigned-orders' || item.href === '/announcements';
    }
    if (role === 'chef') {
      return item.href === '/kitchen' || item.href === '/announcements';
    }
    if (role === 'cashier') {
      return item.href === '/terminal' || item.href === '/announcements';
    }
    if (role === 'delivery_staff') {
      return item.href === '/delivery' || item.href === '/announcements';
    }
    if (role === 'manager') {
      if (item.href === '/super-admin' || item.href === '/companies' || item.href === '/users') {
        return false;
      }
      return true;
    }
    if (isSuperAdmin) return true;

    if (role === 'company_admin' && permissions && item.moduleKey) {
      if (item.moduleKey === 'sales_and_bills' || item.moduleKey === 'sales') {
        return permissions.sales_and_bills !== false && permissions.sales !== false && permissions.bills !== false;
      }
      if (item.moduleKey === 'stocks' || item.moduleKey === 'raw_materials' || item.moduleKey === 'inventory') {
        return permissions.stocks !== false && permissions.raw_materials !== false && permissions.inventory !== false;
      }
      if (permissions[item.moduleKey] === false) {
        return false;
      }
    }
    return true;
  };

  // Header visible items: filtered by enabled (visible === true), header placement (showInHeader === true), and role/permissions
  const allowedHeaderItems = navConfig.items.filter(
    (item) => item.visible && item.showInHeader && isItemAllowed(item)
  );

  const directHeaderItems = allowedHeaderItems.slice(0, navConfig.maxHeaderItems);
  const overflowHeaderItems = allowedHeaderItems.slice(navConfig.maxHeaderItems);

  // Check if an item in the More dropdown is active
  const isMoreItemActive = overflowHeaderItems.some(
    (item) => pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'))
  );

  return (
    <>
      <header
        ref={headerRef}
        className="sticky top-2 z-30 mx-2 sm:mx-4 mb-2 flex items-center justify-between rounded-2xl md:rounded-full bg-zinc-950/92 px-3 sm:px-5 py-2 shadow-2xl backdrop-blur-xl transition-all duration-200"
        style={{
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.7)',
        }}
      >
        {/* ── LEFT: Logo & Company Branding ── */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-pink-500/40 bg-pink-950/40 text-pink-500 shadow-sm group-hover:scale-105 transition-transform shrink-0">
              <Utensils className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm sm:text-base font-black tracking-tight text-white flex items-center">
                <span className="text-pink-500">V</span>Billing
              </span>
              <span className="text-[10px] text-zinc-400 font-medium truncate hidden md:block">
                Smart Restaurant Billing
              </span>
            </div>
          </Link>

          {/* Active Company Code & Switcher */}
          {activeCompany && (
            <div
              className="relative shrink-0"
              onMouseEnter={() => handleMenuEnter('company')}
              onMouseLeave={handleMenuLeave}
            >
              <button
                type="button"
                onClick={() => handleMenuClick('company')}
                className={`flex h-7 items-center gap-1.5 rounded-lg border px-2 text-[11px] font-bold transition-all shadow-xs cursor-pointer ${
                  activeMenu === 'company'
                    ? 'border-pink-500 bg-pink-950/50 text-pink-300 shadow-md shadow-pink-950/40'
                    : 'border-pink-500/30 bg-pink-950/40 text-pink-300 hover:border-pink-500/60 hover:bg-pink-950/60'
                }`}
                title="Active Company Details"
                aria-label="Company Details"
              >
                <Building2 className="h-3 w-3 text-pink-400 shrink-0" />
                <span className="font-mono font-bold tracking-wide">{activeCompany.code}</span>
              </button>

              {/* Company Details Dropdown */}
              {activeMenu === 'company' && (
                <div
                  onMouseEnter={() => handleMenuEnter('company')}
                  onMouseLeave={handleMenuLeave}
                  className="absolute left-0 top-full mt-2 w-64 sm:w-72 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-3 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
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

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-zinc-800/50">
                      <span className="text-zinc-400">Company Name</span>
                      <span className="font-bold text-white truncate max-w-[140px]">{activeCompany.name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-zinc-800/50">
                      <span className="text-zinc-400">Tenant Code</span>
                      <span className="font-mono font-bold text-pink-400">{activeCompany.code}</span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-zinc-400">Tenant ID</span>
                      <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[140px]">{activeCompany.id}</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-2 border-t border-zinc-800/80">
                    <Link
                      href="/companies"
                      onClick={() => setActiveMenu(null)}
                      className="flex items-center justify-center gap-1.5 w-full py-1.5 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 text-zinc-200 text-xs font-bold transition"
                    >
                      <Building2 className="h-3.5 w-3.5 text-pink-400" />
                      <span>Switch / Manage Companies</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── CENTER: Customizable Navigation Pills & More Dropdown ── */}
        <nav className="dashboard-header-nav hidden lg:flex items-center gap-1 xl:gap-2 px-2 py-0.5 rounded-full bg-zinc-900/60 border border-zinc-800/60">
          {directHeaderItems.map((item) => {
            const IconComp = ICON_MAP[item.icon] || Compass;
            const isStock = item.id === 'stocks' || item.href === '/stocks';
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/')) ||
              (isStock &&
                (pathname?.startsWith('/stocks') ||
                  pathname?.startsWith('/raw-materials'))) ||
              (item.id === 'inventory' &&
                (pathname?.startsWith('/products') ||
                  pathname?.startsWith('/categories') ||
                  pathname?.startsWith('/add-ons')));

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`dashboard-header-nav-item flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'active bg-gradient-to-r from-pink-600 via-pink-500 to-rose-600 text-white shadow-lg shadow-pink-950/60 scale-[1.02]'
                    : 'text-zinc-400 hover:text-white dark:hover:bg-zinc-800/70'
                }`}
              >
                <IconComp className={`h-3.5 w-3.5 ${isActive ? 'text-white' : 'text-zinc-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}

          {/* Overflow "More ⌄" Dropdown */}
          {overflowHeaderItems.length > 0 && (
            <div
              ref={moreMenuRef}
              className="relative"
              onMouseEnter={handleMoreMenuEnter}
              onMouseLeave={handleMoreMenuLeave}
            >
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                className={`dashboard-header-nav-item flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
                  isMoreItemActive
                    ? 'active bg-gradient-to-r from-pink-600 via-pink-500 to-rose-600 text-white shadow-lg shadow-pink-950/60'
                    : isMoreMenuOpen
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white dark:hover:bg-zinc-800/70'
                }`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
                <span>More</span>
                <ChevronDown className="h-3 w-3 opacity-70" />
              </button>

              {/* More Dropdown Menu */}
              {isMoreMenuOpen && (
                <div
                  onMouseEnter={handleMoreMenuEnter}
                  onMouseLeave={handleMoreMenuLeave}
                  className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-52 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
                >
                  <div className="border-b border-zinc-800/80 pb-1.5 mb-1.5 px-2">
                    <h4 className="text-xs font-bold text-zinc-200">Additional Menus</h4>
                    <span className="text-[10px] text-zinc-400">Configured header items</span>
                  </div>

                  <div className="space-y-1 max-h-64 overflow-y-auto no-scrollbar">
                    {overflowHeaderItems.map((item) => {
                      const IconComp = ICON_MAP[item.icon] || Compass;
                      const isActive =
                        pathname === item.href ||
                        (item.href !== '/dashboard' && pathname?.startsWith(item.href + '/'));

                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setIsMoreMenuOpen(false)}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                            isActive
                              ? 'bg-pink-600/20 text-pink-300 border border-pink-500/30'
                              : 'text-zinc-300 hover:text-white hover:bg-zinc-800/70'
                          }`}
                        >
                          <IconComp className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* ── RIGHT: Customizer, Shortcuts, Theme, Notifications & Profile ── */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          
          {/* Customize Header Button */}
          {canCustomizeHeader && (
            <Tip label="Customize Header">
              <button
                type="button"
                onClick={() => setIsCustomizeModalOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-pink-400 hover:border-pink-500/40 hover:bg-zinc-800 transition-all cursor-pointer shadow-xs active:scale-95"
                title="Customize Header Navigation"
                aria-label="Customize Header"
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            </Tip>
          )}

          {/* Keyboard Shortcuts Trigger Button */}
          <Tip label="Keyboard Shortcuts (?)">
            <button
              type="button"
              onClick={() => useShortcutsStore.getState().openHelpModal()}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900/90 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800 transition-all cursor-pointer shadow-xs active:scale-95"
              title="Keyboard Shortcuts Help"
              aria-label="Shortcuts"
            >
              <HelpCircle className="h-4 w-4" />
            </button>
          </Tip>

          {/* ── Single Compact Theme Selector Icon with Dropdown (Identical to Terminal Header) ── */}
          <div
            ref={themeMenuRef}
            className="relative"
            onMouseEnter={handleThemeMenuEnter}
            onMouseLeave={handleThemeMenuLeave}
          >
            <Tip
              label={`Theme: ${
                themeMode === 'light'
                  ? 'Light Mode'
                  : themeMode === 'system'
                  ? 'System Default'
                  : 'Dark Mode'
              }`}
            >
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
                {themeMode === 'light' ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : themeMode === 'system' ? (
                  <Laptop className="h-4 w-4 text-emerald-400" />
                ) : (
                  <Moon className="h-4 w-4 text-indigo-400" />
                )}
              </button>
            </Tip>

            {/* Terminal-Identical Compact Dropdown Menu */}
            {isThemeOpen && (
              <div
                onMouseEnter={handleThemeMenuEnter}
                onMouseLeave={handleThemeMenuLeave}
                className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
              >
                <div className="border-b border-zinc-800/80 pb-1.5 mb-1.5 px-1">
                  <h4 className="text-xs font-bold text-zinc-100">Theme Appearance</h4>
                  <p className="text-[10px] text-zinc-400">Select dashboard display mode</p>
                </div>

                <div className="space-y-1">
                  {/* Dark Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      applyTheme('dark');
                      setIsThemeOpen(false);
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
                    {themeMode === 'dark' && (
                      <Check className="h-4 w-4 text-indigo-400 shrink-0" />
                    )}
                  </button>

                  {/* Light Mode */}
                  <button
                    type="button"
                    onClick={() => {
                      applyTheme('light');
                      setIsThemeOpen(false);
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
                    {themeMode === 'light' && (
                      <Check className="h-4 w-4 text-amber-400 shrink-0" />
                    )}
                  </button>

                  {/* System Default */}
                  <button
                    type="button"
                    onClick={() => {
                      applyTheme('system');
                      setIsThemeOpen(false);
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
                        <p className="text-[10px] text-zinc-400">Sync with operating system</p>
                      </div>
                    </div>
                    {themeMode === 'system' && (
                      <Check className="h-4 w-4 text-emerald-400 shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unified Notification Bell */}
          <SmartNotificationBell />

          {/* Divider */}
          <div className="h-5 w-[1px] bg-zinc-800 mx-0.5" />

          {/* ── User Profile Dropdown ── */}
          <div
            className="relative"
            onMouseEnter={() => handleMenuEnter('profile')}
            onMouseLeave={handleMenuLeave}
          >
            <button
              type="button"
              onClick={() => handleMenuClick('profile')}
              className={`flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-all cursor-pointer ${
                activeMenu === 'profile'
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
                  {role ? role.replace('_', ' ') : 'Admin'}
                </span>
              </div>
              <ChevronDown className="h-3 w-3 text-zinc-400 shrink-0" />
            </button>

            {/* Profile Dropdown Menu */}
            {activeMenu === 'profile' && (
              <div
                onMouseEnter={() => handleMenuEnter('profile')}
                onMouseLeave={handleMenuLeave}
                className="absolute right-0 top-full mt-2 w-60 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2.5 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150"
              >
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-zinc-950/70 border border-zinc-800/70 mb-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-tr from-pink-600 to-rose-500 text-white font-bold text-sm shrink-0">
                    {username ? username.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-white text-xs truncate">{username || 'User'}</p>
                    <p className="text-[10px] text-pink-400 capitalize truncate font-semibold">
                      {role ? role.replace('_', ' ') : 'Admin'}
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
      </header>

      {/* Customize Header Navigation Modal Dialog */}
      <CustomizeHeaderModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        onSaved={(updated) => setNavConfig(updated)}
      />
    </>
  );
}
