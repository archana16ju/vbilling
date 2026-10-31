'use client';

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  User,
  UserX,
  Check,
  X,
  Search,
  Sparkles,
  Coffee,
  AlertCircle,
  Loader2,
  Clock,
} from 'lucide-react';

export interface WaiterItem {
  id: string;
  userId?: string | null;
  name: string;
  username?: string | null;
  phone?: string | null;
  activeOrdersCount: number;
}

interface WaiterAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectWaiter: (waiter: { id: string; name: string } | null) => void;
  currentWaiterId?: string | null;
  tableName?: string;
  tableGuestCount?: number;
  actionTitle?: string;
}

export default function WaiterAssignmentModal({
  isOpen,
  onClose,
  onSelectWaiter,
  currentWaiterId,
  tableName,
  tableGuestCount,
  actionTitle = 'Confirm & Send to Kitchen',
}: WaiterAssignmentModalProps) {
  const [waiters, setWaiters] = useState<WaiterItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedWaiter, setSelectedWaiter] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNobodySelected, setIsNobodySelected] = useState(false);
  const [isWaiterRole, setIsWaiterRole] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const cookieMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const cookieRole = cookieMatch ? cookieMatch[2] : null;
    if (cookieRole === 'waiter') {
      setIsWaiterRole(true);
    }

    setIsLoading(true);
    fetch('/api/waiters')
      .then((res) => res.json())
      .then((data) => {
        const waiterFlag = Boolean(data.isWaiterRole || cookieRole === 'waiter');
        setIsWaiterRole(waiterFlag);

        if (data.success && Array.isArray(data.waiters)) {
          setWaiters(data.waiters);

          if (waiterFlag && data.waiters.length > 0) {
            // When waiter is logged in, strictly auto-select only their own waiter profile
            setSelectedWaiter({ id: data.waiters[0].id, name: data.waiters[0].name });
            setIsNobodySelected(false);
          } else if (currentWaiterId) {
            const found = data.waiters.find(
              (w: WaiterItem) => w.id === currentWaiterId || w.userId === currentWaiterId
            );
            if (found) {
              setSelectedWaiter({ id: found.id, name: found.name });
              setIsNobodySelected(false);
            } else {
              setSelectedWaiter(null);
              setIsNobodySelected(true);
            }
          } else {
            setSelectedWaiter(null);
            setIsNobodySelected(false);
          }
        } else {
          setWaiters([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load waiters:', err);
        setWaiters([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, currentWaiterId]);

  if (!isOpen) return null;

  const filteredWaiters = waiters.filter((w) =>
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.phone && w.phone.includes(searchQuery))
  );

  const handleSelectWaiter = (w: WaiterItem) => {
    setSelectedWaiter({ id: w.id, name: w.name });
    setIsNobodySelected(false);
  };

  const handleSelectNobody = () => {
    setSelectedWaiter(null);
    setIsNobodySelected(true);
  };

  const handleConfirm = () => {
    if (isNobodySelected) {
      onSelectWaiter(null);
    } else {
      onSelectWaiter(selectedWaiter);
    }
    onClose();
  };

  const handleSkipOrNobody = () => {
    onSelectWaiter(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl text-white transition-all flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Dynamic Theme Banner Header */}
        <div className="relative p-5 border-b border-zinc-800 bg-theme-bar overflow-hidden">
          <div className="absolute top-0 right-0 -mr-12 -mt-12 w-40 h-40 rounded-full bg-white/10 blur-2xl pointer-events-none" />
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 text-white shadow-inner">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>Who is serving?</span>
                </h2>
                <p className="text-xs text-white/80 mt-0.5 font-medium">
                  {tableName ? (
                    <span>
                      Assign waiter for <strong>{tableName}</strong>
                      {tableGuestCount ? ` (${tableGuestCount} ${tableGuestCount === 1 ? 'guest' : 'guests'})` : ''}
                    </span>
                  ) : (
                    'Assign an available waiter for this dine-in order'
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-white/70 hover:text-white hover:bg-black/30 transition cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Search Bar & Fast Filter (hidden for single waiter view) */}
        {!isWaiterRole && (
          <div className="p-4 border-b border-zinc-800 bg-zinc-950/60">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Search available waiters..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-2xl bg-zinc-900 border border-zinc-700/80 pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 outline-none focus:border-theme transition-colors shadow-inner"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white p-1 cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Waiters Selection List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
          {/* Nobody Option Card (hidden for waiter role) */}
          {!isWaiterRole && (
            <div
              onClick={handleSelectNobody}
              className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                isNobodySelected
                  ? 'border-zinc-400 bg-zinc-800/80 shadow-md ring-2 ring-zinc-500/30'
                  : 'border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-800/40 hover:border-zinc-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                    isNobodySelected
                      ? 'border-zinc-400 bg-zinc-700 text-white'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-500 group-hover:text-zinc-300'
                  }`}
                >
                  <UserX className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Nobody</span>
                    <span className="rounded-md bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-400">
                      Unassigned
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-0.5">
                    Send to kitchen without assigning. Can assign a waiter later.
                  </p>
                </div>
              </div>

              <div
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                  isNobodySelected
                    ? 'border-zinc-300 bg-white text-zinc-950 font-black'
                    : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
                }`}
              >
                {isNobodySelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
              </div>
            </div>
          )}

          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-zinc-800/80" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-bold">
              <span className="bg-zinc-900 px-2 text-zinc-500">Available Waiters</span>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400">
              <Loader2 className="h-6 w-6 animate-spin text-theme-accent" />
              <span className="text-xs font-semibold">Loading available waiters...</span>
            </div>
          ) : filteredWaiters.length === 0 ? (
            <div className="py-10 text-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/30 p-6">
              <Coffee className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-300">
                {searchQuery ? `No waiter matching "${searchQuery}"` : 'No Waiters found in Staff collection'}
              </p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-xs mx-auto">
                Add staff with role &quot;Waiter&quot; in the Staff module, or proceed with &quot;Nobody&quot;.
              </p>
            </div>
          ) : (
            filteredWaiters.map((w) => {
              const isSelected = !isNobodySelected && selectedWaiter?.id === w.id;
              const initials = w.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase();

              return (
                <div
                  key={w.id}
                  onClick={() => handleSelectWaiter(w)}
                  className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-theme bg-theme-bar/10 shadow-lg shadow-theme-glow ring-2 ring-theme'
                      : 'border-zinc-800/80 bg-zinc-950/40 hover:bg-zinc-800/40 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-11 w-11 items-center justify-center rounded-2xl font-black text-xs transition-colors ${
                        isSelected
                          ? 'bg-theme-bar text-white shadow-md'
                          : 'bg-zinc-800 text-zinc-300 border border-zinc-700/80 group-hover:border-zinc-600'
                      }`}
                    >
                      {initials || <User className="h-5 w-5" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                          {w.name}
                        </span>
                        <span className="rounded-md bg-emerald-950/80 border border-emerald-500/40 px-1.5 py-0.5 text-[10px] font-bold text-emerald-300">
                          Waiter
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-zinc-400 mt-0.5">
                        {w.phone && <span>📞 {w.phone}</span>}
                        <span className="flex items-center gap-1 font-medium">
                          <span className={`h-1.5 w-1.5 rounded-full ${w.activeOrdersCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                          {w.activeOrdersCount > 0 ? `${w.activeOrdersCount} active ${w.activeOrdersCount === 1 ? 'order' : 'orders'}` : 'Free / Available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-all ${
                      isSelected
                        ? 'border-theme bg-theme-bar text-white font-black shadow-theme-glow'
                        : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-500'
                    }`}
                  >
                    {isSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-950 flex items-center justify-between gap-3">
          {isWaiterRole ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white px-4 py-2.5 text-xs font-bold text-zinc-400 transition cursor-pointer"
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSkipOrNobody}
              className="rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 hover:text-white px-4 py-2.5 text-xs font-bold text-zinc-400 transition cursor-pointer"
            >
              Skip / Nobody
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-xl bg-theme-bar hover:opacity-95 active:scale-98 py-2.5 px-4 text-xs font-black text-white transition-all shadow-theme-glow border border-theme flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{actionTitle}</span>
            {selectedWaiter && (
              <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px] truncate max-w-[120px]">
                {selectedWaiter.name}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
