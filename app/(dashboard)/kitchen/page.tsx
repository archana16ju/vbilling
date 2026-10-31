'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useKitchenStore, KotTicket } from '@/store/useKitchenStore';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  UtensilsCrossed,
  X,
  Filter,
  RefreshCw,
} from 'lucide-react';

const CANCEL_REASONS = [
  'Guest changed mind',
  'Item not available',
  'Wrong item punched',
  'Too long a wait',
  'Quality issue',
];

export default function KitchenPage() {
  const [mounted, setMounted] = useState(false);
  const {
    tickets,
    toggleItemCompleted,
    markTicketReady,
    cancelTicket,
    clearCompletedTickets,
    syncFromApiOrders,
  } = useKitchenStore();
  const shortcutsStore = useShortcutsStore();
  const showShortcutBadges = shortcutsStore.config.showKeysOnButtons;

  const [activeTab, setActiveTab] = useState<'PREPARING' | 'READY' | 'CANCELLED' | 'ALL'>('PREPARING');
  const [ticketToCancel, setTicketToCancel] = useState<KotTicket | null>(null);
  const [selectedReason, setSelectedReason] = useState<string>('Guest changed mind');
  const [cancelNote, setCancelNote] = useState<string>('');
  const [now, setNow] = useState(Date.now());
  const [selectedTicketIndex, setSelectedTicketIndex] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sync real-time kitchen orders from company database API
  const fetchKitchenOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/dine-in-orders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          syncFromApiOrders(data.orders);
        }
      }
    } catch (err) {
      console.error('Failed to sync kitchen orders from database:', err);
    }
  }, [syncFromApiOrders]);

  useEffect(() => {
    setMounted(true);
    fetchKitchenOrders();

    // Live polling every 3 seconds for new KOTs from cashiers/waiters
    const pollInterval = setInterval(() => {
      fetchKitchenOrders();
    }, 3000);

    // Timer update every second for live ticket elapsed time
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(interval);
    };
  }, [fetchKitchenOrders]);

  const preparingTickets = tickets.filter((t) => t.status === 'PREPARING');
  const readyTickets = tickets.filter((t) => t.status === 'READY');
  const cancelledTickets = tickets.filter((t) => t.status === 'CANCELLED');

  const filteredTickets =
    activeTab === 'ALL'
      ? tickets
      : tickets.filter((t) => t.status === activeTab);

  // Keep selected ticket index within range
  useEffect(() => {
    if (selectedTicketIndex >= filteredTickets.length) {
      setSelectedTicketIndex(Math.max(0, filteredTickets.length - 1));
    }
  }, [filteredTickets.length, selectedTicketIndex]);

  // Keyboard shortcut listener: Space (toggle status), Arrow keys (navigate)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      if (isInput) return;

      // Space: Start preparation or mark order as ready
      if (shortcutsStore.isActionTriggered('kitchen_toggle_status', e) || e.code === 'Space') {
        e.preventDefault();
        const currentTicket = filteredTickets[selectedTicketIndex];
        if (currentTicket && currentTicket.status === 'PREPARING') {
          markTicketReady(currentTicket.id);
        }
        return;
      }

      // Next ticket: ArrowDown / ArrowRight
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (filteredTickets.length > 0) {
          setSelectedTicketIndex((prev) => (prev + 1) % filteredTickets.length);
        }
        return;
      }

      // Previous ticket: ArrowUp / ArrowLeft
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (filteredTickets.length > 0) {
          setSelectedTicketIndex((prev) => (prev - 1 + filteredTickets.length) % filteredTickets.length);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredTickets, selectedTicketIndex, markTicketReady, shortcutsStore]);

  const formatElapsed = (createdAt: number) => {
    const elapsedSeconds = Math.max(0, Math.floor((now - createdAt) / 1000));
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleConfirmCancel = () => {
    if (!ticketToCancel) return;
    cancelTicket(ticketToCancel.id, selectedReason, cancelNote.trim() || undefined);
    setTicketToCancel(null);
    setCancelNote('');
    setSelectedReason('Guest changed mind');
  };

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      {/* Top Header with Dynamic Theme Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/40 backdrop-blur-md border border-pink-400/30 text-pink-300 shadow-inner">
                <ChefHat className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-2xl font-black text-white tracking-tight">
                    Kitchen Orders (KOT)
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full border border-pink-400/40 bg-pink-950/60 px-2.5 py-0.5 text-xs font-bold text-pink-200 tracking-wider shadow-sm">
                    {preparingTickets.length} ACTIVE
                  </span>
                </div>
                <p className="text-pink-100/70 text-xs mt-1">
                  Real-time kitchen order tickets (KOT), item preparation checklists, and order status.
                </p>
              </div>
            </div>
          </div>

          {/* Tab Filters with Neon Button Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'PREPARING', label: 'Preparing', count: preparingTickets.length },
                { id: 'READY', label: 'Ready', count: readyTickets.length },
                { id: 'CANCELLED', label: 'Cancelled', count: cancelledTickets.length },
                { id: 'ALL', label: 'All', count: tickets.length },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${isSelected
                      ? 'border-pink-400 bg-white text-zinc-950 shadow-lg shadow-pink-500/20'
                      : 'border-pink-400/20 bg-black/40 text-pink-100/80 hover:bg-black/60 hover:text-white'
                    }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${isSelected ? 'bg-pink-600 text-white' : 'bg-black/50 text-pink-200'
                      }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}

            {readyTickets.length > 0 && (
              <button
                onClick={clearCompletedTickets}
                className="rounded-xl border border-pink-400/30 bg-black/50 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/80 hover:text-white transition shadow-sm cursor-pointer ml-1"
                title="Clear finished tickets"
              >
                Clear Ready
              </button>
            )}

            <button
              type="button"
              onClick={async () => {
                setIsRefreshing(true);
                await fetchKitchenOrders();
                setTimeout(() => setIsRefreshing(false), 500);
              }}
              disabled={isRefreshing}
              className="rounded-xl border border-pink-400/30 bg-black/50 px-3 py-2 text-xs font-bold text-pink-200 hover:bg-black/80 hover:text-white transition shadow-sm cursor-pointer ml-1 flex items-center gap-1.5"
              title="Refresh live kitchen tickets"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tickets Grid */}
      {filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 py-16 text-center shadow-lg">
          <UtensilsCrossed className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
          <h3 className="text-base font-bold text-zinc-300">No Kitchen Tickets</h3>
          <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
            {activeTab === 'PREPARING'
              ? 'There are no active orders in the kitchen. When a cashier clicks "Send to Kitchen", tickets will appear here.'
              : `No orders matching filter "${activeTab}".`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTickets.map((ticket, idx) => {
            const elapsed = formatElapsed(ticket.createdAt);
            const isDelayed =
              ticket.status === 'PREPARING' && (now - ticket.createdAt) / 1000 > 600; // > 10 mins
            const isSelected = selectedTicketIndex === idx;

            return (
              <div
                key={ticket.id}
                onClick={() => setSelectedTicketIndex(idx)}
                className={`rounded-2xl bg-zinc-900/90 border-2 shadow-lg flex flex-col justify-between overflow-hidden transition-all cursor-pointer ${
                  isSelected ? 'ring-2 ring-emerald-500 shadow-emerald-500/20 ' : ''
                }${
                  ticket.status === 'READY'
                    ? 'border-emerald-500/40 shadow-emerald-500/10'
                    : ticket.status === 'CANCELLED'
                    ? 'border-rose-900/50 opacity-60 bg-rose-950/10'
                    : isDelayed
                    ? 'border-amber-500 ring-2 ring-amber-500/40 shadow-amber-500/20'
                    : 'border-zinc-800 hover:border-pink-500/40'
                }`}
              >
                {/* 1. Ticket Card Header */}
                <div className="p-4 pb-3 border-b border-zinc-800 bg-zinc-950/70">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-base font-black text-white tracking-tight">
                        #{ticket.id}
                      </span>
                      <span className="rounded-lg border border-pink-500/30 bg-pink-950/40 px-2 py-0.5 text-[10px] font-extrabold uppercase text-pink-300">
                        KOT {ticket.kotNumber}
                      </span>
                    </div>

                    {/* Running Elapsed Timer */}
                    {ticket.status === 'PREPARING' && (
                      <div
                        className={`flex items-center gap-1 font-mono text-xs font-black px-2.5 py-1 rounded-lg border ${isDelayed
                            ? 'border-rose-500/60 bg-rose-950/60 text-rose-300 animate-pulse'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-200'
                          }`}
                        title="Elapsed preparation time"
                      >
                        <Clock className="h-3 w-3 text-pink-400" />
                        <span>{elapsed}</span>
                      </div>
                    )}

                    {ticket.status === 'READY' && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/40 bg-emerald-950/50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400 uppercase">
                        Ready
                      </span>
                    )}

                    {ticket.status === 'CANCELLED' && (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-950/50 px-2.5 py-0.5 text-[10px] font-bold text-rose-400 uppercase">
                        Cancelled
                      </span>
                    )}
                  </div>

                  {/* Subheader: Order Type · Time · Station / Staff */}
                  <div className="mt-2 text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-pink-300">{ticket.orderType}</span>
                    <span>·</span>
                    <span suppressHydrationWarning>
                      {new Date(ticket.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <span>·</span>
                    <span className="text-zinc-300 font-semibold">{ticket.tableOrStation || 'Kitchen'}</span>
                    {ticket.waiterName && (
                      <>
                        <span>·</span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-indigo-950/80 border border-indigo-500/40 px-1.5 py-0.5 text-[10px] font-bold text-indigo-300">
                          Waiter: {ticket.waiterName}
                        </span>
                      </>
                    )}
                    {ticket.servingStatus && (
                      <>
                        <span>·</span>
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold border ${
                          ticket.servingStatus === 'Served'
                            ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-300'
                            : ticket.servingStatus === 'Picked Up'
                            ? 'bg-amber-950/80 border-amber-500/40 text-amber-300'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
                        }`}>
                          Serving: {ticket.servingStatus}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* 2. Items Checklist */}
                <div className="p-4 flex-1 space-y-2 max-h-60 overflow-y-auto no-scrollbar">
                  {ticket.items.map((item, idx) => {
                    return (
                      <div
                        key={item.id || idx}
                        onClick={() => {
                          if (ticket.status === 'PREPARING') {
                            toggleItemCompleted(ticket.id, idx);
                          }
                        }}
                        className={`flex items-center justify-between gap-2.5 p-2 rounded-xl border border-transparent transition-all ${ticket.status === 'PREPARING'
                            ? 'cursor-pointer hover:bg-zinc-800/80 hover:border-zinc-700'
                            : ''
                          }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Square Quantity Badge */}
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-lg border text-xs font-bold shrink-0 ${item.completed
                                ? 'border-emerald-500/40 bg-emerald-950/60 text-emerald-400'
                                : 'border-zinc-700 bg-zinc-800 text-white font-mono'
                              }`}
                          >
                            {item.quantity}
                          </span>

                          <div className="flex flex-col min-w-0 flex-1">
                            <span
                              className={`text-sm font-semibold truncate ${item.completed
                                  ? 'line-through text-zinc-500'
                                  : 'text-zinc-100'
                                }`}
                            >
                              {item.name}
                            </span>
                            {item.notes && (
                              <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-amber-300 bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-md w-fit">
                                <span className="uppercase text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded font-black tracking-wider">
                                  NOTE
                                </span>
                                <span>{item.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Interactive Checkbox */}
                        <div
                          className={`flex h-5 w-5 items-center justify-center rounded-lg border transition-all ${item.completed
                              ? 'border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-500/30'
                              : 'border-zinc-700 bg-zinc-950 hover:border-pink-500'
                            }`}
                        >
                          {item.completed && <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Ticket Notes if any */}
                {ticket.notes && (
                  <div className="px-4 py-2 border-t border-amber-500/20 bg-amber-950/30 text-xs text-amber-200">
                    <span className="font-bold text-amber-400 uppercase text-[10px] mr-1">Instructions:</span>
                    {ticket.notes}
                  </div>
                )}

                {/* Cancellation Details if Cancelled */}
                {ticket.status === 'CANCELLED' && ticket.cancelReason && (
                  <div className="px-4 py-2 border-t border-rose-900/40 bg-rose-950/30 text-[11px] text-rose-300">
                    <span className="font-bold">Reason:</span> {ticket.cancelReason}
                    {ticket.cancelNote && <p className="italic text-rose-400 mt-0.5">"{ticket.cancelNote}"</p>}
                  </div>
                )}

                {/* 3. Action Buttons with Neon Style */}
                {ticket.status === 'PREPARING' && (
                  <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => markTicketReady(ticket.id)}
                      className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white py-2.5 px-4 text-xs font-bold transition-all shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Mark ready</span>
                      {showShortcutBadges && (
                        <span className="text-[10px] bg-black/30 px-1.5 py-0.2 rounded font-mono text-emerald-200">
                          {shortcutsStore.getActionDisplayKey('kitchen_toggle_status') || 'Space'}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setTicketToCancel(ticket)}
                      className="rounded-xl border border-zinc-700/80 bg-zinc-900 p-2.5 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-950/30 transition cursor-pointer"
                      title="Cancel ticket"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Cancel Ticket Confirmation Modal */}
      {ticketToCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setTicketToCancel(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-200 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-white">
                Cancel KOT {ticketToCancel.kotNumber}?
              </h2>
              <button
                onClick={() => setTicketToCancel(null)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-4">
              Every item on ticket #{ticketToCancel.id} will be marked cancelled. The order itself
              stays open.
            </p>

            {/* Reason selector chips */}
            <div className="space-y-2 mb-4">
              <label className="text-[11px] font-bold uppercase tracking-wider text-pink-400 block">
                Select Reason
              </label>
              <div className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((reason) => {
                  const isSelected = selectedReason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setSelectedReason(reason)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${isSelected
                          ? 'bg-theme-bar text-white shadow-md shadow-theme-glow border border-theme'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700'
                        }`}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note Input */}
            <div className="mb-5">
              <input
                type="text"
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder="Anything else the counter should know..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
              />
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setTicketToCancel(null)}
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Keep ticket
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white py-3 text-xs font-bold shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                Cancel ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
