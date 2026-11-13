'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Bell,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Boxes,
  CheckCheck,
  Volume2,
  VolumeX,
  ExternalLink,
  ArrowUpRight,
  Check,
  X,
  Send,
  MessageSquare,
  Clock,
  ChefHat,
  PackageX,
  UtensilsCrossed,
} from 'lucide-react';
import Link from 'next/link';
import {
  getReplenishmentNotifications,
  approvePurchaseOrder,
  rejectPurchaseOrder,
} from '@/lib/actions/inventory';

// Pleasant two-tone synthesizer chime for replenishment notification
function playReplenishChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
    osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
    osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // Audio autoplay blocked by browser policy safe ignore
  }
}

function formatDate(dateInput: any): string {
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return String(dateInput);
  }
}

export interface ReplenishmentNotificationBellProps {
  role?: string | null;
  isChef?: boolean;
}

export default function ReplenishmentNotificationBell({
  role: propRole,
  isChef: propIsChef,
}: ReplenishmentNotificationBellProps = {}) {
  const [clientRole, setClientRole] = useState<string | null>(propRole || null);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [replenishments, setReplenishments] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState<'pending' | 'low_stock' | 'replenished'>('pending');
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [approvedOrderDetails, setApprovedOrderDetails] = useState<{
    orderId: string;
    supplierName: string;
    phone?: string;
    email?: string;
    messageText?: string;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevAlertCountRef = useRef<number>(0);
  const isFirstLoadRef = useRef<boolean>(true);

  // Sync role if provided via prop or fallback from cookies / auth session
  useEffect(() => {
    if (propRole) {
      setClientRole(propRole);
      return;
    }
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    if (r) {
      setClientRole(r);
    } else {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((me) => {
          if (me && me.role) setClientRole(me.role);
        })
        .catch(() => {});
    }
  }, [propRole]);

  const effectiveRole = (propRole || clientRole || '').toLowerCase();
  const isSuperAdmin = effectiveRole === 'super_admin';
  const isStockAdmin = isSuperAdmin || effectiveRole === 'company_admin' || effectiveRole === 'admin' || effectiveRole === 'manager';
  const isChefUser = propIsChef ?? (effectiveRole === 'chef');

  // Load read status & sound preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem('read_replenishment_alerts');
      if (stored) {
        setReadIds(new Set(JSON.parse(stored)));
      }
      const soundPref = localStorage.getItem('replenish_alert_sound');
      if (soundPref !== null) {
        setSoundEnabled(soundPref === 'true');
      }
    } catch {}
  }, []);

  // Compute Out of Stock items (stock <= 0) for Chef
  const outOfStockItems = useMemo(() => {
    const map = new Map<string, any>();

    (lowStockItems || []).forEach((item) => {
      if (Number(item.stock) <= 0 || item.status === 'Out of Stock') {
        const key = item.id || item.name;
        map.set(key, {
          id: item.id,
          name: item.name,
          stock: Number(item.stock) || 0,
          unit: item.unit || 'units',
          minStock: Number(item.lowStockLimit) || 0,
        });
      }
    });

    (pendingApprovals || []).forEach((po) => {
      if (Number(po.currentStock) <= 0) {
        const key = po.rawMaterialId || po.rawMaterialName;
        if (!map.has(key)) {
          map.set(key, {
            id: po.rawMaterialId,
            name: po.rawMaterialName,
            stock: Number(po.currentStock) || 0,
            unit: po.unit || 'units',
            minStock: Number(po.minimumStock) || 0,
          });
        }
      }
    });

    return Array.from(map.values());
  }, [lowStockItems, pendingApprovals]);

  // Fetch notifications
  const fetchData = useCallback(async () => {
    try {
      const res = await getReplenishmentNotifications();
      setIsLoaded(true);
      if (res && res.success) {
        const pending = res.pendingApprovals || [];
        setPendingApprovals(pending);
        setReplenishments(res.replenishments || []);
        setLowStockItems(res.lowStockItems || []);

        if (!isChefUser) {
          if (pending.length > 0 && isFirstLoadRef.current) {
            setActiveTab('pending');
          } else if (pending.length === 0 && (res.lowStockItems || []).length > 0 && isFirstLoadRef.current) {
            setActiveTab('low_stock');
          }
        }

        // Chime handling
        if (isChefUser) {
          const currentOosCount = (res.lowStockItems || []).filter(
            (i: any) => Number(i.stock) <= 0 || i.status === 'Out of Stock'
          ).length;
          if (!isFirstLoadRef.current && currentOosCount > prevAlertCountRef.current && soundEnabled) {
            playReplenishChime();
          }
          prevAlertCountRef.current = currentOosCount;
        } else {
          const currentPendingCount = pending.length;
          if (!isFirstLoadRef.current && currentPendingCount > prevAlertCountRef.current && soundEnabled) {
            playReplenishChime();
          }
          prevAlertCountRef.current = currentPendingCount;
        }
        isFirstLoadRef.current = false;
      }
    } catch (err) {
      console.error('Error fetching replenishment notifications:', err);
    }
  }, [soundEnabled, isChefUser]);

  // Periodic polling & event listeners
  useEffect(() => {
    fetchData();

    const interval = setInterval(fetchData, 12000);
    const handleFocus = () => fetchData();
    const handleSaleEvent = () => fetchData();

    window.addEventListener('focus', handleFocus);
    window.addEventListener('sale-completed', handleSaleEvent);
    window.addEventListener('stock-updated', handleSaleEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('sale-completed', handleSaleEvent);
      window.removeEventListener('stock-updated', handleSaleEvent);
    };
  }, [fetchData]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Role visibility guard: strictly only Manager, Company Admin, Super Admin, and Chef can view
  if (!isStockAdmin && !isChefUser) {
    return null;
  }

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    try {
      localStorage.setItem('replenish_alert_sound', String(next));
    } catch {}
  };

  const markAllAsRead = () => {
    if (isChefUser) {
      const chefIds = new Set([
        ...Array.from(readIds),
        ...outOfStockItems.map((item) => `oos_${item.id || item.name}`),
      ]);
      setReadIds(chefIds);
      try {
        localStorage.setItem('read_replenishment_alerts', JSON.stringify(Array.from(chefIds)));
      } catch {}
      return;
    }

    const allIds = new Set([
      ...Array.from(readIds),
      ...pendingApprovals.map((p) => p.id),
      ...replenishments.map((r) => r.id),
      ...lowStockItems.map((l) => `low_${l.id}`),
    ]);
    setReadIds(allIds);
    try {
      localStorage.setItem('read_replenishment_alerts', JSON.stringify(Array.from(allIds)));
    } catch {}
  };

  const handleApprove = async (orderId: string) => {
    setActionPendingId(orderId);
    setActionSuccessMsg(null);
    setApprovedOrderDetails(null);
    try {
      const res = await approvePurchaseOrder(orderId);
      if (res && res.success) {
        setActionSuccessMsg(`Purchase Order ${orderId} Approved!`);
        if (res.supplierContact?.phone || res.supplierContact?.email) {
          setApprovedOrderDetails({
            orderId,
            supplierName: res.supplierContact.name,
            phone: res.supplierContact.phone,
            email: res.supplierContact.email,
            messageText: res.messageText,
          });
        }
        await fetchData();
        playReplenishChime();
      } else {
        alert(res?.error || 'Failed to approve purchase order');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving order');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleReject = async (orderId: string) => {
    setActionPendingId(orderId);
    setActionSuccessMsg(null);
    setApprovedOrderDetails(null);
    try {
      const res = await rejectPurchaseOrder(orderId, 'Rejected from notification bell');
      if (res && res.success) {
        setActionSuccessMsg(`Purchase Order ${orderId} Rejected.`);
        await fetchData();
        setTimeout(() => setActionSuccessMsg(null), 4000);
      } else {
        alert(res?.error || 'Failed to reject purchase order');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting order');
    } finally {
      setActionPendingId(null);
    }
  };

  // Chef metrics vs Admin metrics
  const outOfStockCount = outOfStockItems.length;
  const unreadOosCount = outOfStockItems.filter((i) => !readIds.has(`oos_${i.id || i.name}`)).length;

  const pendingCount = pendingApprovals.length;
  const unreadPending = pendingApprovals.filter((p) => !readIds.has(p.id));
  const unreadReplenishments = replenishments.filter((r) => !readIds.has(r.id));
  const unreadLowStock = lowStockItems.filter((l) => !readIds.has(`low_${l.id}`));
  const totalAlerts = isChefUser ? outOfStockCount : (pendingCount + lowStockItems.length);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
        }}
        className={`relative flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border transition-all cursor-pointer ${
          isOpen
            ? 'border-pink-500 bg-pink-950/40 text-pink-300 shadow-md shadow-pink-950/30'
            : isChefUser
              ? outOfStockCount > 0
                ? 'border-rose-500/70 bg-rose-950/40 text-rose-300 hover:border-rose-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
              : pendingCount > 0
                ? 'border-amber-500/70 bg-amber-950/40 text-amber-300 hover:border-amber-400'
                : unreadLowStock.length > 0
                  ? 'border-amber-500/50 bg-amber-950/30 text-amber-300 hover:border-amber-400'
                  : unreadReplenishments.length > 0
                    ? 'border-emerald-500/60 bg-emerald-950/30 text-emerald-400 hover:border-emerald-400'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
        }`}
        title={isChefUser ? 'Kitchen Out of Stock Alerts' : 'Stock Replenishment & Order Approvals'}
        aria-label={isChefUser ? 'Kitchen Out of Stock Alerts' : 'Stock Replenishment Alerts'}
      >
        <Bell className="h-4 w-4" />

        {/* Small live badge counter */}
        {totalAlerts > 0 && (
          <span
            className={`absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[9px] font-black text-white shadow ${
              isChefUser
                ? 'bg-rose-500'
                : pendingCount > 0
                  ? 'bg-amber-400 text-black'
                  : 'bg-emerald-400 text-black'
            }`}
          >
            {totalAlerts > 99 ? '99+' : totalAlerts}
          </span>
        )}

        {/* Subtle ping animation */}
        {isChefUser
          ? unreadOosCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 animate-ping rounded-full bg-rose-500 opacity-60 pointer-events-none" />
            )
          : pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 animate-ping rounded-full bg-amber-400 opacity-60 pointer-events-none" />
            )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-84 sm:w-[410px] rounded-2xl border border-zinc-800 bg-zinc-950/98 p-0 text-white shadow-2xl backdrop-blur-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800/80 bg-zinc-900/80 px-4 py-3">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-lg border ${
                  isChefUser
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                    : 'bg-pink-500/20 text-pink-400 border-pink-500/30'
                }`}
              >
                {isChefUser ? <ChefHat className="h-4 w-4" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                  {isChefUser ? 'Kitchen Out of Stock Alerts' : 'Supplier Reordering & Stock'}
                  {isChefUser
                    ? outOfStockCount > 0 && (
                        <span className="text-[10px] font-mono bg-rose-950/80 border border-rose-800 text-rose-300 px-1.5 py-0.2 rounded-full">
                          {outOfStockCount} Out of Stock
                        </span>
                      )
                    : pendingCount > 0 && (
                        <span className="text-[10px] font-mono bg-amber-950/80 border border-amber-800 text-amber-300 px-1.5 py-0.2 rounded-full">
                          {pendingCount} Pending
                        </span>
                      )}
                </h4>
                <p className="text-[10px] text-zinc-400">
                  {isChefUser
                    ? 'Raw materials and menu items currently depleted'
                    : 'Low-stock alerts & purchase order approval'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                title={soundEnabled ? 'Alert chime enabled (click to mute)' : 'Alert chime muted'}
              >
                {soundEnabled ? (
                  <Volume2 className={`h-3.5 w-3.5 ${isChefUser ? 'text-rose-400' : 'text-pink-400'}`} />
                ) : (
                  <VolumeX className="h-3.5 w-3.5 text-zinc-500" />
                )}
              </button>
              <button
                type="button"
                onClick={markAllAsRead}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-pink-400 transition cursor-pointer"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* ==================== CHEF VIEW (ONLY OUT OF STOCK ITEMS) ==================== */}
          {isChefUser ? (
            <>
              <div className="max-h-[380px] overflow-y-auto p-2 space-y-2 no-scrollbar">
                {outOfStockItems.length === 0 ? (
                  <div className="py-8 text-center text-zinc-500">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                    <p className="text-xs font-medium text-emerald-400">All Kitchen Ingredients In Stock</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">
                      No raw materials or menu items are currently depleted.
                    </p>
                  </div>
                ) : (
                  outOfStockItems.map((item) => (
                    <div
                      key={item.id || item.name}
                      className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-3 transition text-left space-y-2 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                            <PackageX className="h-4 w-4" />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-white">{item.name}</h5>
                            <p className="text-[10px] text-rose-300/80 font-medium">Currently depleted</p>
                          </div>
                        </div>

                        <span className="text-[10px] font-black font-mono text-rose-300 bg-rose-950/90 border border-rose-800 px-2 py-0.5 rounded-full shrink-0">
                          0 {item.unit}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-lg bg-zinc-950/80 border border-zinc-800/80 px-2.5 py-1.5 text-[10px]">
                        <span className="text-zinc-400">
                          Min Required: <strong className="text-zinc-200 font-mono">{item.minStock} {item.unit}</strong>
                        </span>
                        <span className="text-rose-400 font-bold flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-400 animate-pulse"></span>
                          Out of Stock
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Chef Footer: Kitchen Display & Raw Materials (No purchase orders / stocks) */}
              <div className="border-t border-zinc-800 bg-zinc-900/90 p-2.5 flex items-center justify-between gap-2">
                <Link
                  href="/kitchen"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 text-[11px] font-bold text-rose-400 hover:text-rose-300 transition"
                >
                  <UtensilsCrossed className="h-3 w-3" />
                  <span>Kitchen Display</span>
                </Link>

                <Link
                  href="/raw-materials"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white transition"
                >
                  <span>Raw Materials</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </>
          ) : (
            /* ==================== ADMIN & MANAGER VIEW (ORDERS & FULL REPLENISHMENT) ==================== */
            <>
              {/* Action Success / Supplier Communication Banner */}
              {actionSuccessMsg && (
                <div className="bg-emerald-950/90 border-b border-emerald-800/80 px-3 py-2 text-[11px] text-emerald-300 font-medium flex flex-col gap-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <strong>{actionSuccessMsg}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setActionSuccessMsg(null);
                        setApprovedOrderDetails(null);
                      }}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>

                  {approvedOrderDetails && (
                    <div className="mt-1 pt-1.5 border-t border-emerald-800/60 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-emerald-200">
                        Send order to <strong>{approvedOrderDetails.supplierName}</strong>:
                      </span>
                      <div className="flex items-center gap-1.5">
                        {approvedOrderDetails.phone && (
                          <a
                            href={`https://wa.me/${approvedOrderDetails.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(approvedOrderDetails.messageText || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-0.5 text-[10px] font-bold transition shadow-sm"
                          >
                            <MessageSquare className="h-3 w-3" />
                            WhatsApp
                          </a>
                        )}
                        {approvedOrderDetails.email && (
                          <a
                            href={`mailto:${approvedOrderDetails.email}?subject=${encodeURIComponent(`Purchase Order ${approvedOrderDetails.orderId}`)}&body=${encodeURIComponent(approvedOrderDetails.messageText || '')}`}
                            className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2 py-0.5 text-[10px] font-bold transition border border-zinc-700"
                          >
                            <Send className="h-3 w-3" />
                            Email
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab Selector */}
              <div className="flex border-b border-zinc-800/60 bg-zinc-950 px-2 pt-2 gap-1">
                <button
                  type="button"
                  onClick={() => setActiveTab('pending')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                    activeTab === 'pending'
                      ? 'border-amber-500 text-amber-400 bg-amber-950/20'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Pending ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('low_stock')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                    activeTab === 'low_stock'
                      ? 'border-rose-500 text-rose-400 bg-rose-950/20'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Low Stock ({lowStockItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('replenished')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-bold rounded-t-lg transition border-b-2 cursor-pointer ${
                    activeTab === 'replenished'
                      ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <CheckCircle2 className="h-3 w-3" />
                  History ({replenishments.length})
                </button>
              </div>

              {/* List Content */}
              <div className="max-h-[380px] overflow-y-auto p-2 space-y-2 no-scrollbar">
                {/* 1. Pending Approvals Tab */}
                {activeTab === 'pending' && (
                  <>
                    {pendingApprovals.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                        <p className="text-xs font-medium text-emerald-400">All Reorders Cleared</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          No purchase orders currently require approval.
                        </p>
                      </div>
                    ) : (
                      pendingApprovals.map((po) => {
                        const isProcessing = actionPendingId === po.id;
                        return (
                          <div
                            key={po.id}
                            className="rounded-xl border border-amber-500/40 bg-zinc-900/90 p-3 transition text-left space-y-2 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] font-black bg-amber-950/90 border border-amber-700/80 text-amber-300 px-1.5 py-0.5 rounded">
                                    {po.id}
                                  </span>
                                  <h5 className="text-xs font-bold text-white">{po.rawMaterialName}</h5>
                                  {Number(po.currentStock) <= 0 && (
                                    <span className="text-[9px] bg-rose-950/90 border border-rose-800 text-rose-300 px-1.5 py-0.5 rounded font-black">
                                      Out of Stock
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-1">
                                  <span>Supplier:</span>
                                  <strong className="text-zinc-200">{po.supplierName}</strong>
                                  {po.supplierPhone && (
                                    <span className="font-mono text-zinc-400">({po.supplierPhone})</span>
                                  )}
                                </p>
                              </div>

                              <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-800/80 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                                {po.state === 'Pending Approval' || po.state === 'Pending' ? 'Pending' : po.state}
                              </span>
                            </div>

                            {/* Metric Grid */}
                            <div className="grid grid-cols-3 gap-2 rounded-lg bg-zinc-950/80 border border-zinc-800/80 p-2 text-[10px]">
                              <div>
                                <span className="text-zinc-500 block">Current Stock</span>
                                <span className={`font-mono font-bold ${Number(po.currentStock) <= 0 ? 'text-rose-400 font-black' : 'text-rose-300'}`}>
                                  {Number(po.currentStock) <= 0 ? `0 ${po.unit} (Out of Stock)` : `${po.currentStock} ${po.unit}`}
                                </span>
                                <span className="text-zinc-500 text-[9px] block">
                                  Min: {po.minimumStock} {po.unit}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500 block">Required Qty</span>
                                <span className="font-mono font-bold text-amber-300">
                                  +{po.requiredQuantity} {po.unit}
                                </span>
                                <span className="text-zinc-500 text-[9px] block">
                                  Target: {po.targetStock} {po.unit}
                                </span>
                              </div>

                              <div>
                                <span className="text-zinc-500 block">Est. Cost</span>
                                <span className="font-mono font-bold text-emerald-300">
                                  ₹{Number(po.estimatedPurchaseCost).toFixed(2)}
                                </span>
                                <span className="text-zinc-500 text-[9px] block">
                                  @ ₹{Number(po.rate).toFixed(2)}/{po.unit}
                                </span>
                              </div>
                            </div>

                            {/* Action Buttons: Approve & Reject */}
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/70">
                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleReject(po.id)}
                                className="flex items-center gap-1 rounded-lg border border-rose-800/60 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 px-2.5 py-1 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                              >
                                <X className="h-3 w-3" />
                                Reject Order
                              </button>

                              <button
                                type="button"
                                disabled={isProcessing}
                                onClick={() => handleApprove(po.id)}
                                className="flex items-center gap-1 rounded-lg border border-emerald-600 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 text-[11px] font-black transition cursor-pointer shadow-md disabled:opacity-50"
                              >
                                {isProcessing ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3 stroke-[3]" />
                                )}
                                Approve Order
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </>
                )}

                {/* 2. Low Stock Alert Tab */}
                {activeTab === 'low_stock' && (
                  <>
                    {lowStockItems.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500/40" />
                        <p className="text-xs font-medium text-emerald-400">All Raw Materials Well-Stocked</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          No raw materials are currently below their minimum threshold.
                        </p>
                      </div>
                    ) : (
                      lowStockItems.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-rose-500/40 bg-rose-950/20 p-2.5 transition text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
                              <h5 className="text-xs font-bold text-zinc-100">{item.name}</h5>
                            </div>
                            <span className="font-mono text-[10px] font-bold text-rose-300 bg-rose-950/80 border border-rose-800 px-1.5 py-0.5 rounded">
                              {Number(item.stock) <= 0 ? 'Out of Stock' : `${item.stock} ${item.unit}`} · Min: {item.lowStockLimit} {item.unit}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center justify-between text-[10px] text-zinc-400">
                            <span>Supplier: <strong className="text-zinc-300">{item.supplierName || 'Unassigned'}</strong></span>
                            <span>Target: <strong className="text-zinc-200 font-mono">{item.targetStock || 999} {item.unit}</strong></span>
                          </div>
                        </div>
                      ))
                    )}
                  </>
                )}

                {/* 3. History Tab */}
                {activeTab === 'replenished' && (
                  <>
                    {replenishments.length === 0 ? (
                      <div className="py-8 text-center text-zinc-500">
                        <Boxes className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs font-medium">No replenishment history yet</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          Completed stock receipts and additions will appear here.
                        </p>
                      </div>
                    ) : (
                      replenishments.map((rep) => {
                        return (
                          <div
                            key={rep.id}
                            className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 p-2.5 transition text-left hover:border-zinc-700"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-400 shrink-0" />
                                <h5 className="text-xs font-bold text-zinc-100">{rep.rawMaterialName}</h5>
                              </div>
                              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/80 px-1.5 py-0.5 rounded">
                                <ArrowUpRight className="h-3 w-3" />
                                +{rep.quantityRestored} {rep.unit}
                              </span>
                            </div>

                            <div className="mt-1.5 flex items-center justify-between text-[11px] text-zinc-400">
                              <span>
                                Stock: <strong className="text-zinc-300 font-mono">{rep.quantityBefore}</strong> →{' '}
                                <strong className="text-emerald-400 font-mono">{rep.targetStock} {rep.unit}</strong>
                              </span>
                              <span className="text-[10px] text-zinc-500 font-mono">
                                {formatDate(rep.createdAt || rep.date)}
                              </span>
                            </div>

                            {rep.referenceId && (
                              <div className="mt-1 text-[10px] text-zinc-500 flex items-center justify-between border-t border-zinc-800/60 pt-1">
                                <span className="truncate">Ref: <strong className="text-zinc-400 font-mono">{rep.referenceId}</strong></span>
                                <span className="text-emerald-500/80 font-medium">Stock Recorded</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </>
                )}
              </div>

              {/* Admin Footer Actions */}
              <div className="border-t border-zinc-800 bg-zinc-900/90 p-2.5 flex items-center justify-between gap-2">
                <Link
                  href="/stocks"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 text-[11px] font-bold text-pink-400 hover:text-pink-300 transition"
                >
                  <span>Manage Orders & Stocks</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>

                <Link
                  href="/raw-materials"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-1 text-[11px] font-bold text-zinc-400 hover:text-white transition"
                >
                  <span>Raw Materials</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
