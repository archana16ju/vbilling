'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  CheckCheck,
  Volume2,
  VolumeX,
  ExternalLink,
  Flame,
  AlertTriangle,
  Info,
  CheckCircle2,
  Megaphone,
  Copy,
  Clock,
  RefreshCw,
  X,
  ArrowRight,
  Boxes,
  Check,
  PackageX,
  Send,
} from 'lucide-react';
import Link from 'next/link';
import {
  getReplenishmentNotifications,
  approvePurchaseOrder,
  rejectPurchaseOrder,
} from '@/lib/actions/inventory';

interface NotificationItem {
  id: string;
  eventType: string;
  title: string;
  message: string;
  priority: 'normal' | 'important' | 'urgent';
  entityType?: string | null;
  entityId?: string | null;
  actionUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}

interface DuplicateWarningItem {
  id: string;
  entityType: 'product' | 'customer' | 'invoice';
  fieldName: string;
  duplicateValue: string;
  existingRecordId: string;
  reason: string;
  status: 'unresolved' | 'dismissed' | 'resolved';
  createdAt: string;
}

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5

    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

export default function SmartNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateWarningItem[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [outOfStockItems, setOutOfStockItems] = useState<any[]>([]);
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'all' | 'stock' | 'duplicates' | 'announcements'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef<number>(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (!isOpen) {
      setIsHovered(true);
      fetchData();
    }
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 180);
  };

  const canSeeDuplicates = ['super_admin', 'company_admin', 'manager'].includes(role || '');
  const canSeeStock = ['super_admin', 'company_admin', 'manager', 'chef'].includes(role || '');

  const fetchData = async () => {
    try {
      // 1. Fetch smart notifications
      const notifRes = await fetch('/api/notifications');
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        const notifs: NotificationItem[] = notifData.notifications || [];
        setNotifications(notifs);
        const count = notifData.unreadCount || 0;
        setUnreadNotifCount(count);

        // Sound alert on new unread notifications
        if (soundEnabled && prevCountRef.current !== null && count > prevCountRef.current) {
          playNotificationChime();
        }
        prevCountRef.current = count;
      }

      // 2. Fetch duplicate warnings if admin
      if (canSeeDuplicates) {
        const dupRes = await fetch('/api/duplicates?status=unresolved');
        if (dupRes.ok) {
          const dupData = await dupRes.json();
          setDuplicates(dupData.warnings || []);
        }
      }

      // 3. Fetch replenishment, out of stock & pending order approvals
      if (canSeeStock) {
        try {
          const repRes = await getReplenishmentNotifications();
          if (repRes && repRes.success) {
            const pending = repRes.pendingApprovals || [];
            setPendingApprovals(pending);
            const low = repRes.lowStockItems || [];
            setLowStockItems(low);
            const oos = low.filter((i: any) => Number(i.stock) <= 0 || i.status === 'Out of Stock');
            setOutOfStockItems(oos);
          }
        } catch {}
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const handleApprovePO = async (orderId: string) => {
    setActionPendingId(orderId);
    setActionSuccessMsg(null);
    try {
      const res = await approvePurchaseOrder(orderId);
      if (res && res.success) {
        setActionSuccessMsg(`PO ${orderId} approved!`);
        await fetchData();
        setTimeout(() => setActionSuccessMsg(null), 3000);
      } else {
        alert(res?.error || 'Failed to approve purchase order');
      }
    } catch (err: any) {
      alert(err.message || 'Error approving order');
    } finally {
      setActionPendingId(null);
    }
  };

  const handleRejectPO = async (orderId: string) => {
    setActionPendingId(orderId);
    setActionSuccessMsg(null);
    try {
      const res = await rejectPurchaseOrder(orderId, 'Rejected from notification bell');
      if (res && res.success) {
        setActionSuccessMsg(`PO ${orderId} rejected.`);
        await fetchData();
        setTimeout(() => setActionSuccessMsg(null), 3000);
      } else {
        alert(res?.error || 'Failed to reject purchase order');
      }
    } catch (err: any) {
      alert(err.message || 'Error rejecting order');
    } finally {
      setActionPendingId(null);
    }
  };

  useEffect(() => {
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    setRole(match ? match[2] : null);

    const savedSound = localStorage.getItem('smart_notif_sound');
    if (savedSound !== null) setSoundEnabled(savedSound === 'true');

    fetchData();

    // Poll every 12 seconds for real-time notifications
    const interval = setInterval(fetchData, 12000);
    return () => clearInterval(interval);
  }, [canSeeDuplicates]);

  // Click outside to close
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('smart_notif_sound', String(next));
  };

  const handleMarkAsRead = async (id: string) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadNotifCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
    } catch {}
  };

  const handleResolveDuplicate = async (warningId: string, action: string) => {
    try {
      await fetch('/api/duplicates', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warningId, status: 'dismissed', action }),
      });
      setDuplicates((prev) => prev.filter((d) => d.id !== warningId));
    } catch {}
  };

  const totalBadgeCount =
    unreadNotifCount +
    (canSeeDuplicates ? duplicates.length : 0) +
    (canSeeStock ? pendingApprovals.length + outOfStockItems.length : 0);

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'announcements') return n.eventType === 'new_announcement';
    return true;
  });

  return (
    <div
      className="relative"
      ref={dropdownRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setIsHovered(false);
          if (!isOpen) fetchData();
        }}
        className={`relative flex h-8 w-8 items-center justify-center rounded-lg border transition cursor-pointer active:scale-95 ${
          isOpen || isHovered
            ? 'border-pink-500 bg-pink-950/40 text-pink-300 shadow-md shadow-pink-950/30'
            : totalBadgeCount > 0
              ? 'border-pink-500/50 bg-pink-950/30 text-pink-300'
              : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:text-white hover:bg-zinc-800'
        }`}
        title="Smart Notifications"
        aria-label="Smart Notifications"
      >
        <Bell className="h-4 w-4" />
        {totalBadgeCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white shadow-lg animate-pulse">
            {totalBadgeCount > 99 ? '99+' : totalBadgeCount}
          </span>
        )}
      </button>

      {/* Hover Preview Card (Shows Categories & Recent Notifications) */}
      {isHovered && !isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-68 sm:w-76 rounded-2xl border border-zinc-800 bg-zinc-900/98 p-3 shadow-2xl backdrop-blur-xl z-50 text-white animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2 mb-2">
            <div className="flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5 text-pink-400" />
              <h4 className="text-xs font-bold text-zinc-100">Notifications</h4>
            </div>
            {totalBadgeCount > 0 ? (
              <span className="rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.2 text-[10px] font-black">
                {totalBadgeCount} new
              </span>
            ) : (
              <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.2 text-[9px] font-bold">
                All clear
              </span>
            )}
          </div>

          {/* Categories Grid */}
          <div className="grid grid-cols-2 gap-1.5 mb-2.5">
            <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/60 p-2">
              <span className="text-[10px] text-zinc-400 block">System Alerts</span>
              <span className="text-xs font-bold text-white font-mono">
                {unreadNotifCount} unread
              </span>
            </div>

            {canSeeStock ? (
              <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/60 p-2">
                <span className="text-[10px] text-zinc-400 block">Stock & Orders</span>
                <span className={`text-xs font-bold font-mono ${pendingApprovals.length + outOfStockItems.length > 0 ? 'text-amber-400' : 'text-zinc-300'}`}>
                  {pendingApprovals.length + outOfStockItems.length} alerts
                </span>
              </div>
            ) : (
              <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/60 p-2">
                <span className="text-[10px] text-zinc-400 block">Announcements</span>
                <span className="text-xs font-bold text-white font-mono">
                  {notifications.filter((n) => n.eventType === 'new_announcement').length} active
                </span>
              </div>
            )}
          </div>

          {/* Recent Notification Preview */}
          <div className="border-t border-zinc-800/60 pt-2 mb-2">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">
              Recent Notification
            </span>
            {notifications.length > 0 ? (
              <div className="rounded-lg bg-zinc-950/50 p-2 border border-zinc-800/40">
                <p className="text-[11px] font-bold text-zinc-200 line-clamp-1">{notifications[0].title}</p>
                <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{notifications[0].message}</p>
              </div>
            ) : pendingApprovals.length > 0 ? (
              <div className="rounded-lg bg-zinc-950/50 p-2 border border-zinc-800/40">
                <p className="text-[11px] font-bold text-amber-300 line-clamp-1">Purchase Order Pending</p>
                <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{pendingApprovals[0].rawMaterialName} needs reorder approval</p>
              </div>
            ) : outOfStockItems.length > 0 ? (
              <div className="rounded-lg bg-zinc-950/50 p-2 border border-zinc-800/40">
                <p className="text-[11px] font-bold text-rose-400 line-clamp-1">Out of Stock</p>
                <p className="text-[10px] text-zinc-400 line-clamp-1 mt-0.5">{outOfStockItems[0].name} is depleted</p>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-500 italic py-1">No pending alerts</p>
            )}
          </div>

          {/* Click hint */}
          <div className="text-center pt-1 border-t border-zinc-800/60">
            <span className="text-[10px] font-bold text-pink-400 hover:text-pink-300">
              Click bell to open Notification Center →
            </span>
          </div>
        </div>
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-3xl border border-zinc-800 bg-zinc-900 shadow-2xl z-50 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-zinc-800 bg-zinc-900/90">
            <div className="flex items-center gap-2">
              <span className="font-black text-sm text-white">Notifications</span>
              {totalBadgeCount > 0 && (
                <span className="rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30 px-2 py-0.5 text-[10px] font-bold">
                  {totalBadgeCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleToggleSound}
                className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                title={soundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
              >
                {soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-emerald-400" />
                ) : (
                  <VolumeX className="h-4 w-4 text-zinc-500" />
                )}
              </button>

              {unreadNotifCount > 0 && (
                <button
                  type="button"
                  onClick={handleMarkAllRead}
                  className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                  title="Mark all as read"
                >
                  <CheckCheck className="h-4 w-4 text-cyan-400" />
                </button>
              )}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="flex border-b border-zinc-800 bg-zinc-950/60 p-1 text-xs font-bold gap-1">
            <button
              onClick={() => setActiveTab('all')}
              className={`flex-1 py-1 rounded-lg transition ${
                activeTab === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              Alerts ({unreadNotifCount})
            </button>

            {canSeeStock && (
              <button
                onClick={() => setActiveTab('stock')}
                className={`flex-1 py-1 rounded-lg transition flex items-center justify-center gap-1 ${
                  activeTab === 'stock' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Stock</span>
                {pendingApprovals.length + outOfStockItems.length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
            )}

            {canSeeDuplicates && (
              <button
                onClick={() => setActiveTab('duplicates')}
                className={`flex-1 py-1 rounded-lg transition flex items-center justify-center gap-1 ${
                  activeTab === 'duplicates' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span>Duplicates</span>
                {duplicates.length > 0 && (
                  <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab('announcements')}
              className={`flex-1 py-1 rounded-lg transition ${
                activeTab === 'announcements' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'
              }`}
            >
              News
            </button>
          </div>

          {/* Action Success Toast */}
          {actionSuccessMsg && (
            <div className="bg-emerald-950/90 border-b border-emerald-800 p-2 text-center text-xs font-bold text-emerald-300">
              {actionSuccessMsg}
            </div>
          )}

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-800/60 text-xs">
            {activeTab === 'stock' ? (
              <div className="p-2 space-y-3">
                {/* Pending PO Approvals */}
                {pendingApprovals.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between pb-1.5 px-1 border-b border-zinc-800/80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Pending Order Approvals ({pendingApprovals.length})
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1.5">
                      {pendingApprovals.map((po) => (
                        <div key={po.id} className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs">{po.rawMaterialName}</span>
                            <span className="font-mono text-[10px] text-amber-400 font-bold">
                              Qty: {po.quantity} {po.unit}
                            </span>
                          </div>

                          <div className="text-[11px] text-zinc-400">
                            Supplier: <strong className="text-zinc-300">{po.supplierName || 'Primary Supplier'}</strong>
                            {po.currentStock !== undefined && (
                              <span className="ml-2 font-mono text-[10px] text-rose-400">
                                (Stock: {po.currentStock})
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-800/60">
                            <button
                              type="button"
                              disabled={actionPendingId === po.id}
                              onClick={() => handleRejectPO(po.id)}
                              className="px-2.5 py-1 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-rose-400 hover:border-rose-800 text-[10px] font-bold transition disabled:opacity-50 cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              type="button"
                              disabled={actionPendingId === po.id}
                              onClick={() => handleApprovePO(po.id)}
                              className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                              {actionPendingId === po.id ? 'Approving...' : 'Approve'}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Out of Stock Items */}
                {outOfStockItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between pb-1.5 px-1 border-b border-zinc-800/80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1">
                        <PackageX className="h-3 w-3" />
                        Out of Stock ({outOfStockItems.length})
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1">
                      {outOfStockItems.map((item) => (
                        <div key={`oos-${item.id}`} className="flex items-center justify-between p-2 rounded-lg bg-rose-950/20 border border-rose-900/30">
                          <div>
                            <p className="font-bold text-white text-xs">{item.name}</p>
                            <p className="text-[10px] text-rose-300 font-mono">0 {item.unit || 'units'} remaining</p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                            Depleted
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Low Stock Items */}
                {lowStockItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between pb-1.5 px-1 border-b border-zinc-800/80">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
                        <Boxes className="h-3 w-3" />
                        Low Stock ({lowStockItems.length})
                      </span>
                    </div>

                    <div className="mt-1.5 space-y-1">
                      {lowStockItems.slice(0, 5).map((item) => (
                        <div key={`low-${item.id}`} className="flex items-center justify-between p-2 rounded-lg bg-amber-950/20 border border-amber-900/30">
                          <div>
                            <p className="font-bold text-white text-xs">{item.name}</p>
                            <p className="text-[10px] text-amber-300 font-mono">
                              {item.stock} / min {item.lowStockLimit} {item.unit || 'units'}
                            </p>
                          </div>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Low
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pendingApprovals.length === 0 && outOfStockItems.length === 0 && lowStockItems.length === 0 && (
                  <div className="py-8 text-center text-zinc-500">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                    <p className="font-semibold text-zinc-300">Inventory Healthy</p>
                    <p className="text-[10px] text-zinc-500">No depleted items or pending approvals</p>
                  </div>
                )}

                <div className="pt-2 text-center">
                  <Link
                    href="/stocks"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-pink-400 hover:text-pink-300"
                  >
                    <span>Manage Stock & Supplies</span>
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ) : activeTab === 'duplicates' ? (
              duplicates.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1" />
                  <p className="font-semibold text-zinc-400">No duplicate warnings</p>
                  <p className="text-[10px] text-zinc-600">All barcodes, SKUs & phones unique</p>
                </div>
              ) : (
                duplicates.map((dup) => (
                  <div key={dup.id} className="p-3 bg-rose-950/20 hover:bg-rose-950/30 transition space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        <AlertTriangle className="h-2.5 w-2.5 text-rose-400" />
                        Duplicate {dup.entityType} ({dup.fieldName})
                      </span>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(dup.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-200 font-medium">{dup.reason}</p>

                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      {dup.entityType === 'product' && (
                        <Link
                          href={`/products?search=${encodeURIComponent(dup.duplicateValue)}`}
                          onClick={() => setIsOpen(false)}
                          className="px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-bold"
                        >
                          View Existing
                        </Link>
                      )}
                      {dup.entityType === 'customer' && (
                        <Link
                          href={`/customers?search=${encodeURIComponent(dup.duplicateValue)}`}
                          onClick={() => setIsOpen(false)}
                          className="px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-bold"
                        >
                          View Existing
                        </Link>
                      )}
                      <button
                        onClick={() => handleResolveDuplicate(dup.id, 'dismissed')}
                        className="px-2 py-0.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-[10px] font-bold"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-zinc-500">
                <CheckCircle2 className="h-6 w-6 text-zinc-600 mx-auto mb-1" />
                <p className="font-semibold text-zinc-400">No new notifications</p>
                <p className="text-[10px] text-zinc-600">Everything is running smoothly</p>
              </div>
            ) : (
              filteredNotifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 transition hover:bg-zinc-800/40 space-y-1 ${
                    !n.isRead ? 'bg-pink-950/10' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.2 rounded-full text-[9px] font-black uppercase tracking-wider border ${
                          n.priority === 'urgent'
                            ? 'border-rose-500/40 bg-rose-950/60 text-rose-300'
                            : n.priority === 'important'
                            ? 'border-amber-500/40 bg-amber-950/60 text-amber-300'
                            : 'border-blue-500/40 bg-blue-950/60 text-blue-300'
                        }`}
                      >
                        {n.priority}
                      </span>
                      <span className="font-bold text-white text-[11px] truncate max-w-[180px]">
                        {n.title}
                      </span>
                    </div>

                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-300 leading-snug">{n.message}</p>

                  <div className="flex items-center justify-between pt-1">
                    {n.actionUrl ? (
                      <Link
                        href={n.actionUrl}
                        onClick={() => {
                          handleMarkAsRead(n.id);
                          setIsOpen(false);
                        }}
                        className="text-[10px] font-bold text-pink-400 hover:text-pink-300 flex items-center gap-1"
                      >
                        <span>Open details</span>
                        <ArrowRight className="h-2.5 w-2.5" />
                      </Link>
                    ) : <span />}

                    {!n.isRead && (
                      <button
                        onClick={() => handleMarkAsRead(n.id)}
                        className="text-[10px] font-bold text-zinc-400 hover:text-white"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2 border-t border-zinc-800 bg-zinc-950/80 text-center">
            <Link
              href="/notification-rules"
              onClick={() => setIsOpen(false)}
              className="text-[10px] font-bold text-zinc-400 hover:text-white"
            >
              Configure Notification Rules →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
