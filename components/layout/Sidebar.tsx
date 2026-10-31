'use client'
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
  LogOut
} from "lucide-react"
import { useState, useEffect } from "react"

export default function Sidebar() {
  const pathname = usePathname()
  const [role, setRole] = useState<string | null>(null)
  const [permissions, setPermissions] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    const initialRole = r === 'admin' ? 'company_admin' : r;
    if (initialRole) setRole(initialRole);

    const loadRoleAndPermissions = (currentRole: string | null) => {
      if (currentRole === 'company_admin') {
        fetch('/api/companies/permissions')
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
          const normalized = me.role === 'admin' ? 'company_admin' : me.role;
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
    { name: "Settings", href: "/settings", icon: SettingsIcon, moduleKey: "settings" },

  ]

  const filteredNavItems = navItems.filter((item) => {
    // Waiter is strictly restricted to Tables
    if (role === 'waiter') {
      return item.href === '/tables' || item.href === '/assigned-orders';
    }

    // Chef is strictly restricted to Kitchen
    if (role === 'chef') {
      return item.href === '/kitchen';
    }

    // Cashier is restricted to Terminal
    if (role === 'cashier') {
      return item.href === '/terminal';
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

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch { }
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
    document.cookie = 'auth_id=; Max-Age=0; path=/;';
    document.cookie = 'auth_company_id=; Max-Age=0; path=/;';
    document.cookie = 'auth_session=; Max-Age=0; path=/;';
    window.location.href = '/login';
  };

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

      {/* Bottom Footer with Role and Logout */}
      <div className="shrink-0 border-t border-zinc-800/80 p-2 flex flex-col items-center gap-1.5">
        <div
          className="w-full text-center py-1 px-1 rounded-lg bg-zinc-900/90 border border-zinc-800/90 text-[9px] font-bold tracking-wider uppercase text-zinc-400 truncate cursor-default"
          title={`Role: ${role === 'super_admin'
            ? 'Super Admin'
            : role === 'company_admin'
              ? 'Company Admin'
              : role || 'Loading...'
            }`}
        >
          {role === 'super_admin' ? 'Super' : role === 'company_admin' ? 'Admin' : role || 'User'}
        </div>
        <button
          onClick={handleLogout}
          title="Logout"
          className="group flex flex-col items-center justify-center w-full py-2 px-1 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 hover:border-rose-900/50 border border-transparent transition-all duration-200 cursor-pointer"
        >
          <LogOut className="h-5 w-5 mb-1 transition-transform duration-200 group-hover:scale-110 group-hover:text-rose-400" />
          <span className="text-[11px] font-medium tracking-tight text-center leading-tight group-hover:text-rose-300">
            Logout
          </span>
        </button>
      </div>
    </aside>
  )
}

