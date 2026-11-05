'use client';
import { UserCircle, Building2, Shield, Truck } from "lucide-react"
import { useState, useEffect } from "react"
import Link from "next/link"
import ShiftAlertsBell from "@/components/notifications/ShiftAlertsBell"

export default function Header() {
  const [role, setRole] = useState<string | null>(null)
  const [activeCompany, setActiveCompany] = useState<{ id: string; name: string; code: string } | null>(null)
  const [currentDate, setCurrentDate] = useState('')

  useEffect(() => {
    setCurrentDate(new Date().toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }))
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    if (r) setRole(r === 'admin' ? 'company_admin' : r);

    // Fetch verified session to guarantee role is immediately available
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me && me.authenticated && me.role) {
          const normalized = me.role === 'admin' ? 'company_admin' : me.role;
          setRole(normalized);
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

    window.addEventListener('company-switched', handleCompanySwitched);
    return () => {
      window.removeEventListener('company-switched', handleCompanySwitched);
    };
  }, [])

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

        <div className="flex items-center gap-4 sm:gap-6">
          {activeCompany && (
            isSuperAdmin ? (
              <Link
                href="/super-admin"
                className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-theme px-3.5 py-1.5 text-xs font-bold text-zinc-200 transition cursor-pointer hover:bg-zinc-800/80"
                title="Super Admin: Click to manage companies"
              >
                <Building2 className="h-4 w-4 text-theme-accent" />
                <span>{activeCompany.name}</span>
                <span className="rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono text-theme-accent">
                  {activeCompany.code}
                </span>
              </Link>
            ) : (
              <div
                className="flex items-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 py-1.5 text-xs font-bold text-zinc-200"
                title="Assigned Company Context"
              >
                <Building2 className="h-4 w-4 text-theme-accent" />
                <span>{activeCompany.name}</span>
                <span className="rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-mono text-theme-badge">
                  {activeCompany.code}
                </span>
              </div>
            )
          )}

          {/* Shift Alerts Notification Bell - Strictly for assigned staff, not Super Admin or Company Admin */}
          {!isSuperAdmin && role !== 'company_admin' && role !== 'admin' && (
            <ShiftAlertsBell />
          )}

          <div className="flex items-center gap-3 text-zinc-400">
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-900 border border-zinc-700 text-zinc-300">
              <UserCircle className="h-6 w-6 text-theme-accent" />
            </div>
          </div>
        </div>
      </div>
      {/* Top Dynamic Theme Accent Bar */}
      <div className="h-[2px] w-full bg-theme-bar opacity-80" />
    </header>
  )
}
