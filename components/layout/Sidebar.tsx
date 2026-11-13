'use client';
import { fetchWithClientCache } from '@/lib/client-cache';
import Link from "next/link"
import { usePathname } from "next/navigation"
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
  ShieldAlert
} from "lucide-react"
import { useState, useEffect } from "react"

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)

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
          .then((res) => res.ok ? res.json() : null)
          .then((data) => {
            if (data && !data.error) setPermissions(data);
          })
          .catch(() => { });
      }
    };

    if (initialRole) loadRoleAndPermissions(initialRole);

    // Fetch verified session to guarantee role is immediately available
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me && me.authenticated && me.role) {
          const normalized = me.role === 'admin' ? (me.username?.toLowerCase() === 'admin' ? 'super_admin' : 'company_admin') : me.role;
          setRole(normalized);
          loadRoleAndPermissions(normalized);
        }
      })
      .catch(() => { });
  }, [])

  const isSuperAdmin = role === 'super_admin';

  // Navigation items matching user's requested vertical design UI structure
  const navItems = [
    ...(isSuperAdmin
      ? [{ name: "SuperAdmin", href: "/super-admin", icon: ShieldCheck, moduleKey: null }]
      : []),
    { name: "Overview", href: "/dashboard", icon: Home, moduleKey: null },
    { name: "Terminal", href: "/terminal", icon: Briefcase, moduleKey: "terminal" },
    { name: "Tables", href: "/tables", icon: LayoutGrid, moduleKey: "tables" },
    { name: "Orders", href: "/assigned-orders", icon: ClipboardList, moduleKey: "tables" },
    { name: "Sales", href: "/sales", icon: List, moduleKey: "sales_and_bills" },
    { name: "Kitchen", href: "/kitchen", icon: ShoppingBasket, moduleKey: "kitchen" },
    { name: "Delivery", href: "/delivery", icon: Truck, moduleKey: "delivery" },
    { name: "Products", href: "/products", icon: FileText, moduleKey: "products" },
    { name: "Categories", href: "/categories", icon: Tags, moduleKey: "categories" },
    { name: "Add-ons", href: "/add-ons", icon: Layers, moduleKey: "products" },
    { name: "Promotions", href: "/promotions", icon: BadgePercent, moduleKey: "promotions" },

    {
      name: "Stock",
      href: process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql' ? "/stocks" : "/stocks",
      icon: Box,
      moduleKey: "stocks"
    },
    { name: "Customers", href: "/customers", icon: User, moduleKey: "customers" },
    { name: "Reports", href: "/reports", icon: BarChart3, moduleKey: "reports" },
    { name: "Staff", href: "/staff", icon: CalendarCheck, moduleKey: "staff" },
    { name: "Users", href: "/users", icon: Users, moduleKey: "users" },
    ...(role !== 'cashier'
      ? [{ name: "Companies", href: "/companies", icon: Building2, moduleKey: "companies" }]
      : []),
    { name: "Announcements", href: "/announcements", icon: Megaphone, moduleKey: null },
    ...(role === 'super_admin' || role === 'company_admin' || role === 'manager'
      ? [
          { name: "Notification Rules", href: "/notification-rules", icon: BellRing, moduleKey: "settings" },
          { name: "Login Activity", href: "/login-activity", icon: ShieldAlert, moduleKey: null },
        ]
      : []),
    { name: "Settings", href: "/settings", icon: SettingsIcon, moduleKey: "settings" },

  ]

  const filteredNavItems = navItems.filter((item) => {
    // Waiter is strictly restricted to Tables and Announcements
    if (role === 'waiter') {
      return item.href === '/tables' || item.href === '/assigned-orders' || item.href === '/announcements';
    }

    // Chef is strictly restricted to Kitchen and Announcements
    if (role === 'chef') {
      return item.href === '/kitchen' || item.href === '/announcements';
    }

    // Cashier is restricted to Terminal and Announcements
    if (role === 'cashier') {
      return item.href === '/terminal' || item.href === '/announcements';
    }

    // Delivery Staff is strictly restricted to Delivery and Announcements
    if (role === 'delivery_staff') {
      return item.href === '/delivery' || item.href === '/announcements';
    }

    // Manager manages store operations (cannot access super-admin, companies, or users)
    if (role === 'manager') {
      if (item.href === '/super-admin' || item.href === '/companies' || item.href === '/users') {
        return false;
      }
      return true;
    }

    // Super Admin sees all navigation modules
    if (isSuperAdmin) return true;

    // Filter out disabled modules for Company Admin
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
          )
        })}
      </nav>
    </aside>
  )
}

