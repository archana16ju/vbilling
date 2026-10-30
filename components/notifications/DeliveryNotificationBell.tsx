'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Bell,
  Truck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  X,
  Volume2,
  VolumeX,
  ChevronRight,
  Clock,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { Delivery, DeliveryStatus } from '@/types/delivery';

export interface DeliveryNotification {
  id: string;
  deliveryId: string;
  billId: string;
  orderSource: string;
  onlineOrderId?: string | null;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  riderName?: string | null;
  status: DeliveryStatus;
  trackingToken?: string | null;
  totalAmount?: number;
  timestamp: number;
  title: string;
  message: string;
  type: 'new_order' | 'assigned' | 'status_change' | 'delivered' | 'cancelled';
  isRead: boolean;
}

// Browser Web Audio chime synthesizer (zero external dependencies)
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.45);
  } catch {
    // Audio Context might be blocked until user gesture, safely ignore
  }
}

export default function DeliveryNotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<DeliveryNotification[]>([]);
  const [activeToast, setActiveToast] = useState<DeliveryNotification | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'online' | 'transit' | 'delivered'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevDeliveriesRef = useRef<Map<string, DeliveryStatus>>(new Map());
  const initialLoadRef = useRef(true);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load read state from localStorage
  const getReadIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem('read_delivery_notifs');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  };

  const markIdsAsRead = (idsToMark: string[]) => {
    try {
      const readSet = getReadIds();
      idsToMark.forEach((id) => readSet.add(id));
      localStorage.setItem('read_delivery_notifs', JSON.stringify(Array.from(readSet)));
      setNotifications((prev) =>
        prev.map((n) => (idsToMark.includes(n.id) ? { ...n, isRead: true } : n))
      );
    } catch (e) {
      console.error('Error saving read notifications:', e);
    }
  };

  // Poll deliveries periodically
  const fetchDeliveries = async () => {
    try {
      const res = await fetch('/api/delivery');
      if (!res.ok) return;
      const deliveries: Delivery[] = await res.json();
      if (!Array.isArray(deliveries)) return;

      const readSet = getReadIds();
      const newNotifs: DeliveryNotification[] = [];
      let latestToastToTrigger: DeliveryNotification | null = null;

      deliveries.forEach((d) => {
        const prevStatus = prevDeliveriesRef.current.get(d.id);
        const sourceLabel = d.orderSource === 'Zomato' ? '🔴 Zomato' : d.orderSource === 'Swiggy' ? '🟠 Swiggy' : '🛵 Terminal';
        const orderRef = d.onlineOrderId ? `#${d.onlineOrderId}` : `#${d.billId}`;

        // 1. New Order Detected
        if (prevStatus === undefined && !initialLoadRef.current) {
          const notifId = `notif_new_${d.id}`;
          const n: DeliveryNotification = {
            id: notifId,
            deliveryId: d.id,
            billId: d.billId,
            orderSource: d.orderSource || 'Terminal',
            onlineOrderId: d.onlineOrderId,
            customerName: d.customerName || 'Customer',
            customerPhone: d.customerPhone,
            deliveryAddress: d.deliveryAddress,
            riderName: d.deliveryPersonName,
            status: d.deliveryStatus,
            trackingToken: d.trackingToken,
            totalAmount: d.totalAmount,
            timestamp: d.orderTime || Date.now(),
            title: `New ${sourceLabel} Order ${orderRef}`,
            message: `${d.customerName} • ${d.deliveryAddress.slice(0, 35)}...`,
            type: 'new_order',
            isRead: readSet.has(notifId),
          };
          newNotifs.push(n);
          latestToastToTrigger = n;
        }

        // 2. Status Changed
        if (prevStatus !== undefined && prevStatus !== d.deliveryStatus) {
          const notifId = `notif_status_${d.id}_${d.deliveryStatus}`;
          let title = `Order ${orderRef}: ${d.deliveryStatus.replace(/_/g, ' ')}`;
          let type: DeliveryNotification['type'] = 'status_change';

          if (d.deliveryStatus === 'delivered') {
            title = `✅ Order ${orderRef} Delivered!`;
            type = 'delivered';
          } else if (d.deliveryStatus === 'out_for_delivery') {
            title = `🛵 Order ${orderRef} is Out for Delivery`;
            type = 'status_change';
          } else if (d.deliveryStatus === 'cancelled') {
            title = `❌ Order ${orderRef} Cancelled`;
            type = 'cancelled';
          }

          const n: DeliveryNotification = {
            id: notifId,
            deliveryId: d.id,
            billId: d.billId,
            orderSource: d.orderSource || 'Terminal',
            onlineOrderId: d.onlineOrderId,
            customerName: d.customerName || 'Customer',
            customerPhone: d.customerPhone,
            deliveryAddress: d.deliveryAddress,
            riderName: d.deliveryPersonName,
            status: d.deliveryStatus,
            trackingToken: d.trackingToken,
            totalAmount: d.totalAmount,
            timestamp: Date.now(),
            title,
            message: d.deliveryPersonName ? `Rider: ${d.deliveryPersonName}` : 'Pending rider assignment',
            type,
            isRead: readSet.has(notifId),
          };
          newNotifs.push(n);
          latestToastToTrigger = n;
        }

        // Track seen status
        prevDeliveriesRef.current.set(d.id, d.deliveryStatus);
      });

      // On initial load, populate existing deliveries as historical notifications
      if (initialLoadRef.current) {
        deliveries.slice(0, 15).forEach((d) => {
          const notifId = `notif_init_${d.id}_${d.deliveryStatus}`;
          const sourceLabel = d.orderSource === 'Zomato' ? '🔴 Zomato' : d.orderSource === 'Swiggy' ? '🟠 Swiggy' : '🛵 Terminal';
          const orderRef = d.onlineOrderId ? `#${d.onlineOrderId}` : `#${d.billId}`;
          const isDelivered = d.deliveryStatus === 'delivered';
          const isCancelled = d.deliveryStatus === 'cancelled';

          newNotifs.push({
            id: notifId,
            deliveryId: d.id,
            billId: d.billId,
            orderSource: d.orderSource || 'Terminal',
            onlineOrderId: d.onlineOrderId,
            customerName: d.customerName || 'Customer',
            customerPhone: d.customerPhone,
            deliveryAddress: d.deliveryAddress,
            riderName: d.deliveryPersonName,
            status: d.deliveryStatus,
            trackingToken: d.trackingToken,
            totalAmount: d.totalAmount,
            timestamp: d.orderTime || Date.now(),
            title: isDelivered ? `✅ Order ${orderRef} Delivered` : `${sourceLabel} Order ${orderRef}`,
            message: `${d.customerName} • ${d.deliveryPersonName ? 'Rider: ' + d.deliveryPersonName : 'Status: ' + d.deliveryStatus.replace(/_/g, ' ')}`,
            type: isDelivered ? 'delivered' : isCancelled ? 'cancelled' : 'status_change',
            isRead: readSet.has(notifId),
          });
        });
        initialLoadRef.current = false;
      }

      if (newNotifs.length > 0) {
        setNotifications((prev) => {
          const combined = [...newNotifs, ...prev];
          const unique = new Map<string, DeliveryNotification>();
          combined.forEach((item) => unique.set(item.id, item));
          return Array.from(unique.values()).sort((a, b) => b.timestamp - a.timestamp);
        });
      }

      if (latestToastToTrigger && soundEnabled) {
        playNotificationChime();
        setActiveToast(latestToastToTrigger);
      }
    } catch (e) {
      console.error('Failed to poll delivery notifications:', e);
    }
  };

  useEffect(() => {
    fetchDeliveries();
    const interval = setInterval(fetchDeliveries, 10000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Auto dismiss toast after 6 seconds
  useEffect(() => {
    if (!activeToast) return;
    const t = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => clearTimeout(t);
  }, [activeToast]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (activeFilter === 'online') return n.orderSource === 'Zomato' || n.orderSource === 'Swiggy';
    if (activeFilter === 'transit') return ['picked_up', 'out_for_delivery'].includes(n.status);
    if (activeFilter === 'delivered') return n.status === 'delivered';
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* ------------------------------------------------------------------ */}
      {/* 1. Header Bell Trigger Button                                      */}
      {/* ------------------------------------------------------------------ */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && unreadCount > 0) {
            markIdsAsRead(notifications.map((n) => n.id));
          }
        }}
        className={`relative flex items-center justify-center h-9 w-9 rounded-xl border transition-all cursor-pointer ${
          unreadCount > 0
            ? 'border-indigo-500/50 bg-indigo-950/60 text-indigo-300 shadow-md shadow-indigo-500/20 hover:bg-indigo-900/60'
            : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-800'
        }`}
        title="Delivery Orders & Live Updates"
      >
        <Bell className={`h-4 w-4 ${unreadCount > 0 ? 'animate-bounce text-indigo-400' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-rose-600 text-[10px] font-black text-white shadow-lg animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Floating Live Notification Toast Banner                          */}
      {/* ------------------------------------------------------------------ */}
      {activeToast && (
        <div className="fixed top-20 right-6 z-50 max-w-sm w-full bg-zinc-950 border border-indigo-500/50 rounded-2xl shadow-2xl p-4 text-white animate-in slide-in-from-top-4 fade-in duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-indigo-950 border border-indigo-500/40 flex items-center justify-center shrink-0 text-indigo-400">
                <Truck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white truncate">{activeToast.title}</span>
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
                <p className="text-xs text-zinc-300 mt-0.5 line-clamp-1">{activeToast.message}</p>
                {activeToast.totalAmount && (
                  <p className="text-xs font-mono font-bold text-pink-300 mt-1">
                    ₹{activeToast.totalAmount.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-zinc-500 hover:text-white p-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-2">
            {activeToast.trackingToken ? (
              <a
                href={`/delivery/track/${activeToast.trackingToken}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-400 hover:text-cyan-300"
              >
                <ExternalLink className="h-3 w-3" />
                Track Order
              </a>
            ) : (
              <span className="text-[10px] text-zinc-500">Live Delivery</span>
            )}
            <Link
              href="/delivery"
              onClick={() => setActiveToast(null)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition shadow-sm"
            >
              <span>View In Deliveries</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 3. Notification Center Dropdown Popover                             */}
      {/* ------------------------------------------------------------------ */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-zinc-800 bg-zinc-950 p-4 shadow-2xl z-50 text-white animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                Delivery Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-pink-500/20 border border-pink-500/40 text-[10px] font-bold text-pink-300">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
                title={soundEnabled ? 'Mute sound alerts' : 'Enable sound alerts'}
              >
                {soundEnabled ? <Volume2 className="h-3.5 w-3.5 text-emerald-400" /> : <VolumeX className="h-3.5 w-3.5 text-zinc-500" />}
              </button>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markIdsAsRead(notifications.map((n) => n.id))}
                  className="text-[10px] font-bold text-pink-400 hover:text-pink-300 px-2 py-0.5 rounded hover:bg-zinc-900 transition cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Filter Chips */}
          <div className="flex items-center gap-1.5 py-2.5 overflow-x-auto no-scrollbar border-b border-zinc-800/60">
            {(
              [
                { key: 'all', label: 'All' },
                { key: 'online', label: 'Online (Z/S)' },
                { key: 'transit', label: 'In Transit' },
                { key: 'delivered', label: 'Delivered' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold whitespace-nowrap transition cursor-pointer ${
                  activeFilter === tab.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* List of Notification Items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-zinc-900 my-1 no-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="py-8 text-center text-zinc-500">
                <Clock className="h-6 w-6 mx-auto mb-2 text-zinc-600" />
                <p className="text-xs font-semibold">No delivery alerts found</p>
                <p className="text-[10px] text-zinc-600 mt-0.5">New orders and updates will appear here</p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const isZomato = n.orderSource === 'Zomato';
                const isSwiggy = n.orderSource === 'Swiggy';
                return (
                  <div
                    key={n.id}
                    className={`p-2.5 rounded-xl transition ${
                      !n.isRead ? 'bg-indigo-950/30 border border-indigo-500/20' : 'hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={`mt-0.5 inline-flex items-center justify-center h-6 w-6 rounded-lg text-xs font-bold shrink-0 ${
                            isZomato
                              ? 'bg-red-950 text-red-400 border border-red-500/40'
                              : isSwiggy
                              ? 'bg-orange-950 text-orange-400 border border-orange-500/40'
                              : n.status === 'delivered'
                              ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              : 'bg-indigo-950 text-indigo-400 border border-indigo-500/40'
                          }`}
                        >
                          {isZomato ? 'Z' : isSwiggy ? 'S' : <Truck className="h-3 w-3" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white leading-tight truncate">
                            {n.title}
                          </p>
                          <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-500">
                            <span className="capitalize font-mono px-1 py-0.2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                              {n.status.replace(/_/g, ' ')}
                            </span>
                            {n.totalAmount && (
                              <span className="font-mono font-bold text-pink-300">
                                ₹{n.totalAmount.toFixed(2)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {n.trackingToken && (
                        <a
                          href={`/delivery/track/${n.trackingToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-cyan-400 hover:text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition"
                          title="Open live customer tracking"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Footer Actions */}
          <div className="pt-2.5 mt-1 border-t border-zinc-800 flex items-center justify-between">
            <Link
              href="/delivery"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
            >
              <span>Delivery Collection</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>

            <Link
              href="/sales"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-zinc-400 hover:text-white flex items-center gap-1"
            >
              <span>Sales & Bills</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
