'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle2,
  ChefHat,
  RefreshCw,
  Search,
  Bell,
  User,
  Coffee,
  Check,
  PackageCheck,
  Users,
} from 'lucide-react';
import { DineInOrder } from '@/lib/actions/dine-in';

interface AssignedOrdersClientProps {
  initialOrders: DineInOrder[];
  initialSession: {
    username?: string;
    role?: string;
    companyName?: string;
  } | null;
}

export default function AssignedOrdersClient({
  initialOrders,
  initialSession,
}: AssignedOrdersClientProps) {
  const [orders, setOrders] = useState<DineInOrder[]>(initialOrders || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'ALL' | 'READY_TO_SERVE' | 'PREPARING' | 'PICKED_UP' | 'SERVED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string>(initialSession?.username || '');
  const [currentRole, setCurrentRole] = useState<string>(initialSession?.role || '');
  const [companyName, setCompanyName] = useState<string>(initialSession?.companyName || '');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [now, setNow] = useState<number>(Date.now());

  // Elapsed time timer
  useEffect(() => {
    setLastUpdated(new Date());
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch orders from API
  const fetchOrders = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsRefreshing(true);
    try {
      const res = await fetch('/api/dine-in-orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          setOrders(data.orders);
          setLastUpdated(new Date());
        }
      }
    } catch (err) {
      console.error('Failed to fetch assigned orders:', err);
    } finally {
      if (!isBackground) setIsRefreshing(false);
      setIsLoading(false);
    }
  }, []);

  // Background auto-refresh and session fallback
  useEffect(() => {
    if (!initialSession?.username) {
      fetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((me) => {
          if (me && me.authenticated) {
            setCurrentUsername(me.username || '');
            setCurrentRole(me.role || '');
            setCompanyName(me.companyName || '');
          }
        })
        .catch(() => {});
    }

    // Auto-refresh interval (polling every 4 seconds for real-time kitchen updates)
    const pollInterval = setInterval(() => {
      fetchOrders(true);
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [fetchOrders, initialSession]);

  // Update order serving status
  const handleUpdateServingStatus = async (
    order: DineInOrder,
    nextStatus: 'Ready' | 'Picked Up' | 'Served'
  ) => {
    setUpdatingOrderId(order.id);
    try {
      const res = await fetch('/api/dine-in-orders', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateServingStatus',
          orderId: order.id,
          servingStatus: nextStatus,
        }),
      });

      if (res.ok) {
        // Optimistic UI update
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, servingStatus: nextStatus } : o))
        );
      } else {
        const err = await res.json();
        alert('Failed to update status: ' + (err.error || 'Server error'));
      }
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Format elapsed time string
  const formatElapsed = (createdAtStr: string) => {
    const createdMs = new Date(createdAtStr).getTime();
    if (isNaN(createdMs)) return '00:00';
    const elapsedSeconds = Math.max(0, Math.floor((now - createdMs) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Tab counts
  const readyToServeOrders = orders.filter(
    (o) => o.kitchenStatus === 'READY' && o.servingStatus !== 'Served' && o.servingStatus !== 'Completed'
  );
  const preparingOrders = orders.filter((o) => o.kitchenStatus === 'PREPARING');
  const pickedUpOrders = orders.filter((o) => o.servingStatus === 'Picked Up');
  const servedOrders = orders.filter((o) => o.servingStatus === 'Served' || o.servingStatus === 'Completed');

  // Filter orders by active tab and search query
  const filteredOrders = orders.filter((order) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTable = order.tableName?.toLowerCase().includes(q);
      const matchNumber = order.orderNumber?.toLowerCase().includes(q);
      const matchWaiter = order.waiterName?.toLowerCase().includes(q);
      const matchItem = order.items?.some((i) => i.name.toLowerCase().includes(q));
      if (!matchTable && !matchNumber && !matchWaiter && !matchItem) return false;
    }

    if (activeTab === 'READY_TO_SERVE') {
      return order.kitchenStatus === 'READY' && order.servingStatus !== 'Served' && order.servingStatus !== 'Completed';
    }
    if (activeTab === 'PREPARING') {
      return order.kitchenStatus === 'PREPARING' && order.servingStatus !== 'Served';
    }
    if (activeTab === 'PICKED_UP') {
      return order.servingStatus === 'Picked Up';
    }
    if (activeTab === 'SERVED') {
      return order.servingStatus === 'Served' || order.servingStatus === 'Completed';
    }
    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner Header with Dynamic Company Theme */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 text-white shadow-inner">
                <UtensilsCrossed className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    {currentRole === 'waiter' ? 'My Assigned Orders' : 'Dine-In Assigned Orders'}
                  </h1>
                  {readyToServeOrders.length > 0 && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400 bg-emerald-500/30 px-3 py-0.5 text-xs font-black text-white tracking-wider animate-pulse shadow-lg shadow-emerald-500/20">
                      <Bell className="h-3.5 w-3.5 fill-current" />
                      {readyToServeOrders.length} READY TO SERVE
                    </span>
                  )}
                </div>
                <p className="text-white/80 text-xs mt-1 font-medium flex items-center gap-2 flex-wrap">
                  <span>
                    {currentRole === 'waiter'
                      ? `Welcome back, ${currentUsername || 'Waiter'} · Service Station`
                      : `Monitoring assigned dine-in orders for ${companyName || 'all staff'}`}
                  </span>
                  <span>•</span>
                  <span className="text-white/60 text-[11px]" suppressHydrationWarning>
                    Auto-updates live · Last synced {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Syncing...'}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats & Refresh Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchOrders(false)}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/30 hover:bg-black/50 px-3.5 py-2 text-xs font-bold text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Refresh now"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'ALL', label: 'All Orders', count: orders.length },
            { id: 'READY_TO_SERVE', label: 'Ready to Serve', count: readyToServeOrders.length, highlight: readyToServeOrders.length > 0 },
            { id: 'PREPARING', label: 'In Kitchen', count: preparingOrders.length },
            { id: 'PICKED_UP', label: 'Picked Up', count: pickedUpOrders.length },
            { id: 'SERVED', label: 'Served', count: servedOrders.length },
          ].map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'border-theme bg-theme-bar text-white shadow-lg shadow-theme-glow font-black'
                    : tab.highlight
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/40'
                    : 'border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-white'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : tab.highlight
                      ? 'bg-emerald-500 text-zinc-950'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Search table, item, KOT #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900 border border-zinc-800 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-theme transition"
          />
        </div>
      </div>

      {/* Orders Grid */}
      {isLoading && orders.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="rounded-2xl bg-zinc-900/60 border border-zinc-800/80 p-5 space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-6 w-24 bg-zinc-800 rounded-lg" />
                <div className="h-5 w-16 bg-zinc-800 rounded-lg" />
              </div>
              <div className="space-y-2 py-4">
                <div className="h-4 w-3/4 bg-zinc-800/80 rounded" />
                <div className="h-4 w-1/2 bg-zinc-800/60 rounded" />
              </div>
              <div className="h-10 bg-zinc-800/70 rounded-xl" />
            </div>
          ))}
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/40 py-16 text-center shadow-lg p-6">
          <Coffee className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <h3 className="text-base font-bold text-zinc-300">No Orders Found</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'READY_TO_SERVE'
              ? 'No orders are currently ready for serving. When the kitchen chef finishes an order, it will appear here instantly!'
              : 'There are no dine-in orders matching this filter.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map((order) => {
            const elapsed = formatElapsed(order.createdAt);
            const isReady = order.kitchenStatus === 'READY';
            const isPickedUp = order.servingStatus === 'Picked Up';
            const isServed = order.servingStatus === 'Served' || order.servingStatus === 'Completed';
            const isUpdating = updatingOrderId === order.id;

            return (
              <div
                key={order.id}
                className={`rounded-2xl bg-zinc-900/90 border-2 shadow-xl flex flex-col justify-between overflow-hidden transition-all ${
                  isReady && !isServed
                    ? 'border-emerald-500/60 shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                    : isPickedUp
                    ? 'border-amber-500/50 shadow-amber-500/10'
                    : isServed
                    ? 'border-zinc-800 opacity-80'
                    : 'border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* 1. Order Card Header */}
                <div
                  className={`p-4 border-b transition-colors ${
                    isReady && !isServed
                      ? 'bg-emerald-950/40 border-emerald-500/30'
                      : isPickedUp
                      ? 'bg-amber-950/30 border-amber-500/30'
                      : 'bg-zinc-950/70 border-zinc-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Table Name Badge */}
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-zinc-900 border border-zinc-700 font-black text-sm text-white shadow-xs">
                        <UtensilsCrossed className="h-3.5 w-3.5 text-theme-accent" />
                        <span>{order.tableName}</span>
                      </div>
                      <span className="font-mono text-xs font-bold text-zinc-400">
                        #{order.orderNumber}
                      </span>
                    </div>

                    {/* Timer Badge */}
                    <div
                      className="flex items-center gap-1 font-mono text-xs font-bold px-2 py-1 rounded-lg bg-zinc-900/90 border border-zinc-800 text-zinc-300"
                      title="Elapsed time since order was placed"
                      suppressHydrationWarning
                    >
                      <Clock className="h-3 w-3 text-zinc-400" />
                      <span suppressHydrationWarning>{elapsed}</span>
                    </div>
                  </div>

                  {/* Waiter & Guest Count Details */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-zinc-400 font-medium">
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-zinc-500" />
                      <span className="text-zinc-300 font-bold">
                        {order.waiterName ? `Server: ${order.waiterName}` : 'Unassigned'}
                      </span>
                    </div>
                    {order.guestCount ? (
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Users className="h-3 w-3" />
                        <span>{order.guestCount} {order.guestCount === 1 ? 'guest' : 'guests'}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 2. Status Progress Badges */}
                <div className="px-4 py-2 bg-zinc-950/40 border-b border-zinc-800/80 flex items-center justify-between text-xs">
                  {/* Kitchen Prep Status */}
                  <div className="flex items-center gap-1.5">
                    <ChefHat className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="text-[11px] text-zinc-400">Kitchen:</span>
                    <span
                      className={`font-black text-[11px] uppercase px-2 py-0.5 rounded-md border ${
                        order.kitchenStatus === 'READY'
                          ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                          : order.kitchenStatus === 'CANCELLED'
                          ? 'border-rose-500/40 bg-rose-950/60 text-rose-300'
                          : 'border-amber-500/40 bg-amber-950/60 text-amber-300'
                      }`}
                    >
                      {order.kitchenStatus}
                    </span>
                  </div>

                  {/* Waiter Serving Status */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400">Serving:</span>
                    <span
                      className={`font-black text-[11px] uppercase px-2 py-0.5 rounded-md border ${
                        order.servingStatus === 'Served' || order.servingStatus === 'Completed'
                          ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-300'
                          : order.servingStatus === 'Picked Up'
                          ? 'border-amber-500/40 bg-amber-950/60 text-amber-300'
                          : order.servingStatus === 'Ready'
                          ? 'border-cyan-500/40 bg-cyan-950/60 text-cyan-300 animate-pulse'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {order.servingStatus || 'Pending'}
                    </span>
                  </div>
                </div>

                {/* 3. Items List */}
                <div className="p-4 flex-1 space-y-2 max-h-52 overflow-y-auto no-scrollbar">
                  {order.items?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-start justify-between gap-2 text-xs py-1 border-b border-zinc-800/50 last:border-0"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-zinc-800 border border-zinc-700 font-mono text-[11px] font-bold text-white">
                          {item.quantity}
                        </span>
                        <div>
                          <p className="font-semibold text-zinc-200 truncate">{item.name}</p>
                          {item.notes && (
                            <span className="inline-block text-[10px] text-amber-300 bg-amber-950/60 border border-amber-500/30 px-1.5 py-0.2 rounded mt-0.5">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.price ? (
                        <span className="font-mono text-[11px] text-zinc-400">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>

                {/* Special Order Notes */}
                {order.notes && (
                  <div className="px-4 py-2 bg-amber-950/20 border-t border-amber-500/20 text-[11px] text-amber-300">
                    <span className="font-bold uppercase text-[9px] mr-1">Note:</span>
                    {order.notes}
                  </div>
                )}

                {/* 4. Action Buttons Footer */}
                <div className="p-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 block">Total</span>
                    <span className="font-mono font-bold text-sm text-theme-accent">
                      ₹{Number(order.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* Action Workflow Button according to state */}
                  {isServed ? (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 font-bold text-xs">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Served to Table</span>
                    </div>
                  ) : isPickedUp ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateServingStatus(order, 'Served')}
                      className="flex-1 max-w-[200px] rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white py-2 px-3 text-xs font-black transition shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <PackageCheck className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Mark Served to Table</span>
                    </button>
                  ) : isReady ? (
                    <button
                      type="button"
                      disabled={isUpdating}
                      onClick={() => handleUpdateServingStatus(order, 'Picked Up')}
                      className="flex-1 max-w-[220px] rounded-xl bg-theme-bar hover:opacity-95 active:scale-95 text-white py-2 px-3 text-xs font-black transition shadow-theme-glow border border-theme flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 animate-bounce"
                    >
                      <Check className="h-3.5 w-3.5 stroke-[3]" />
                      <span>Pick Up from Kitchen</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 text-xs font-semibold">
                      <Clock className="h-3.5 w-3.5 text-amber-400 animate-spin" />
                      <span>Preparing in Kitchen</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
