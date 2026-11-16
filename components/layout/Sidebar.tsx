'use client';

import { fetchWithClientCache } from '@/lib/client-cache';
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Briefcase,
  LayoutGrid,
  List,
  ShoppingBasket,
  Truck,
  FileText,
  Box,
  User,
  BarChart3,
  CalendarCheck,
  Tags,
  Users,
  Building2,
  Settings as SettingsIcon,
  ShieldCheck,
  ClipboardList,
  Layers,
  BadgePercent,
  Megaphone,
  BellRing,
  ShieldAlert,
} from "lucide-react";
import { useState, useEffect } from "react";
import {
  CompanyHeaderNavConfig,
  DEFAULT_HEADER_NAV_CONFIG,
  normalizeHeaderNavConfig,
} from "@/lib/header-nav-config";

export default function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null);
  const [navConfig, setNavConfig] = useState<CompanyHeaderNavConfig>(DEFAULT_HEADER_NAV_CONFIG);

  const loadNavConfig = () => {
    try {
      const cached = localStorage.getItem('company_header_nav_config');
      if (cached) {
        setNavConfig(normalizeHeaderNavConfig(JSON.parse(cached)));
      }
    } catch {}

    fetch('/api/companies/header-nav-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
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
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    const initialRole = r === 'admin' ? (u?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : r;
    if (initialRole) setRole(initialRole);

    const loadRoleAndPermissions = (currentRole: string | null) => {
      if (currentRole === 'company_admin') {
        fetchWithClientCache('/api/companies/permissions')
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data && !data.error) setPermissions(data);
          })
          .catch(() => {});
      }
    };

    if (initialRole) loadRoleAndPermissions(initialRole);

    // Fetch verified session to guarantee role is immediately available
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me && me.authenticated && me.role) {
          const normalized = me.role === 'admin' ? (me.username?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : me.role;
          setRole(normalized);
          loadRoleAndPermissions(normalized);
        }
      })
      .catch(() => {});

    loadNavConfig();

    const handleNavConfigChanged = (e: any) => {
      if (e?.detail) {
        setNavConfig(normalizeHeaderNavConfig(e.detail));
      } else {
        loadNavConfig();
      }
    };

    const handleCompanySwitched = () => {
      loadNavConfig();
    };

    window.addEventListener('header-nav-config-changed', handleNavConfigChanged);
    window.addEventListener('company-switched', handleCompanySwitched);

    return () => {
      window.removeEventListener('header-nav-config-changed', handleNavConfigChanged);
      window.removeEventListener('company-switched', handleCompanySwitched);
    };
  }, []);

  const isSuperAdmin = role === 'super_admin';

  // Navigation items matching user's requested vertical design UI structure
  const rawNavItems = [
    ...(isSuperAdmin
      ? [{ id: 'super_admin', name: "SuperAdmin", href: "/super-admin", icon: ShieldCheck, moduleKey: null }]
      : []),
    { id: 'dashboard', name: "Overview", href: "/dashboard", icon: Home, moduleKey: null },
    { id: 'terminal', name: "Terminal", href: "/terminal", icon: Briefcase, moduleKey: "terminal" },
    { id: 'tables', name: "Tables", href: "/tables", icon: LayoutGrid, moduleKey: "tables" },
    { id: 'orders', name: "Orders", href: "/assigned-orders", icon: ClipboardList, moduleKey: "tables" },
    { id: 'sales', name: "Sales", href: "/sales", icon: List, moduleKey: "sales_and_bills" },
    { id: 'kitchen', name: "Kitchen", href: "/kitchen", icon: ShoppingBasket, moduleKey: "kitchen" },
    { id: 'delivery', name: "Delivery", href: "/delivery", icon: Truck, moduleKey: "delivery" },
    { id: 'inventory', name: "Products", href: "/products", icon: FileText, moduleKey: "products" },
    { id: 'categories', name: "Categories", href: "/categories", icon: Tags, moduleKey: "categories" },
    { id: 'addons', name: "Add-ons", href: "/add-ons", icon: Layers, moduleKey: "products" },
    { id: 'promotions', name: "Promotions", href: "/promotions", icon: BadgePercent, moduleKey: "promotions" },
    { id: 'stocks', name: "Stock", href: "/stocks", icon: Box, moduleKey: "stocks" },
    { id: 'customers', name: "Customers", href: "/customers", icon: User, moduleKey: "customers" },
    { id: 'reports', name: "Reports", href: "/reports", icon: BarChart3, moduleKey: "reports" },
    { id: 'staff', name: "Staff", href: "/staff", icon: CalendarCheck, moduleKey: "staff" },
    { id: 'users', name: "Users", href: "/users", icon: Users, moduleKey: "users" },
    ...(role !== 'cashier'
      ? [{ id: 'companies', name: "Companies", href: "/companies", icon: Building2, moduleKey: "companies" }]
      : []),
    { id: 'announcements', name: "Announcements", href: "/announcements", icon: Megaphone, moduleKey: null },
    ...(role === 'super_admin' || role === 'company_admin' || role === 'manager'
      ? [
          { id: 'notification_rules', name: "Notification Rules", href: "/notification-rules", icon: BellRing, moduleKey: "settings" },
          { id: 'login_activity', name: "Login Activity", href: "/login-activity", icon: ShieldAlert, moduleKey: null },
        ]
      : []),
    { id: 'settings', name: "Settings", href: "/settings", icon: SettingsIcon, moduleKey: "settings" },
  ];

  // Filter items:
  // 1. Must respect existing role and permission checks
  // 2. If customized to show in Header (or More dropdown), filter OUT of Sidebar to avoid duplicate entries
  // 3. If hidden completely (visible === false), do NOT show in Sidebar
  const filteredNavItems = rawNavItems.filter((item) => {
    // Role-based hard boundaries
    if (role === 'waiter') {
      if (item.href !== '/tables' && item.href !== '/assigned-orders' && item.href !== '/announcements') {
        return false;
      }
    } else if (role === 'chef') {
      if (item.href !== '/kitchen' && item.href !== '/announcements') {
        return false;
      }
    } else if (role === 'cashier') {
      if (item.href !== '/terminal' && item.href !== '/announcements') {
        return false;
      }
    } else if (role === 'delivery_staff') {
      if (item.href !== '/delivery' && item.href !== '/announcements') {
        return false;
      }
    } else if (role === 'manager') {
      if (item.href === '/super-admin' || item.href === '/companies' || item.href === '/users') {
        return false;
      }
    } else if (!isSuperAdmin && role === 'company_admin' && permissions && item.moduleKey) {
      if (item.moduleKey === 'sales_and_bills' || item.moduleKey === 'sales') {
        if (permissions.sales_and_bills === false || permissions.sales === false || permissions.bills === false) {
          return false;
        }
      } else if (item.moduleKey === 'stocks' || item.moduleKey === 'raw_materials' || item.moduleKey === 'inventory') {
        if (permissions.stocks === false || permissions.raw_materials === false || permissions.inventory === false) {
          return false;
        }
      } else if (permissions[item.moduleKey] === false) {
        return false;
      }
    }

    // Header Customization Deduplication:
    // Find matching item in company's header nav configuration
    const configItem = navConfig.items.find(
      (c) => c.id === item.id || c.href === item.href
    );

    if (configItem) {
      // If admin hid this menu item completely, don't show in sidebar
      if (!configItem.visible) {
        return false;
      }
      // If admin placed this item in the Header (or More dropdown), remove from sidebar to avoid duplicates
      if (configItem.showInHeader) {
        return false;
      }
    }

    return true;
  });

  return (
    <aside className="fixed left-0 top-0 z-30 flex h-full w-20 flex-col bg-zinc-950 text-white border-r border-zinc-800/80 shadow-2xl">
      {/* Top Brand Mark */}
      <div className="flex h-16 shrink-0 flex-col items-center justify-center border-b border-zinc-800/60 px-2">
        <Link
          href="/dashboard"
          className="group flex h-10 w-10 items-center justify-center rounded-xl bg-theme-bar border border-theme shadow-theme-glow font-black text-white text-base tracking-tight hover:scale-105 transition-all"
          title="Vseyal Billing POS"
        >
          V
        </Link>
      </div>

      {/* Main Vertical Navigation */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto px-2 py-3 no-scrollbar">
        {filteredNavItems.map((item) => {
          const isStockItem = item.moduleKey === 'stocks';
          const isActive = isStockItem
            ? pathname === '/stocks' || pathname === '/raw-materials'
            : pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href + '/'));

          return (
            <Link
              key={item.name}
              href={item.href}
              prefetch={true}
              title={item.name}
              className={`sidebar-nav-item group ${isActive ? 'active' : ''}`}
            >
              <item.icon className="sidebar-nav-icon h-5 w-5 mb-1 transition-all duration-200" />
              <span className="sidebar-nav-label text-[11px] font-medium tracking-tight text-center leading-tight truncate max-w-full">
                {item.name}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
