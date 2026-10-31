'use client';
import { useState, useEffect } from 'react';
import { X, Users, Check, AlertTriangle, Sparkles, RefreshCw } from 'lucide-react';
import { useTableStore, TableItem } from '@/store/useTableStore';

interface TableSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTable: (table: TableItem, guestCount: number) => void;
  selectedTableId?: string | null;
}

export default function TableSelectionModal({
  isOpen,
  onClose,
  onSelectTable,
  selectedTableId,
}: TableSelectionModalProps) {
  const { tables, floors, selectedGuestCount, syncTablesFromOrders } = useTableStore();
  const [activeFloor, setActiveFloor] = useState<string>(floors[0] || 'Ground floor');
  const [guestCount, setGuestCount] = useState<number>(selectedGuestCount || 1);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Sync live orders on modal open
  useEffect(() => {
    if (!isOpen) {
      setWarningMessage(null);
      return;
    }

    if (selectedGuestCount) {
      setGuestCount(selectedGuestCount);
    }

    const fetchActiveOrders = async () => {
      setIsSyncing(true);
      try {
        const res = await fetch('/api/dine-in-orders?allTables=true&activeOnly=true', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.orders)) {
            syncTablesFromOrders(data.orders);
          }
        }
      } catch (err) {
        console.error('TableSelectionModal sync error:', err);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchActiveOrders();
  }, [isOpen, selectedGuestCount, syncTablesFromOrders]);

  if (!isOpen) return null;

  // Filter tables by active floor
  const floorTables = tables.filter((t) => t.floor === activeFloor);

  const handleTableClick = (table: TableItem) => {
    if (guestCount > table.capacity) {
      setWarningMessage(`Table ${table.name} has ${table.capacity} seats, but ${guestCount} guests are selected.`);
    }
    onSelectTable(table, guestCount);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div 
        className="w-full max-w-3xl rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white transition-all flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header matching Reference Dark Theme */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-4 flex-wrap">
            <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-pink-400" />
              <span>Which table?</span>
            </h2>

            {/* Floor tabs pill bar */}
            <div className="flex items-center gap-1 rounded-full bg-zinc-950 p-1 border border-zinc-800">
              {floors.map((floor) => {
                const isActive = activeFloor === floor;
                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => setActiveFloor(floor)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isActive
                        ? 'bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                    }`}
                  >
                    {floor}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Guests quick picker */}
            <div className="flex items-center gap-1.5 rounded-full bg-zinc-950 border border-zinc-800 px-3 py-1 text-xs font-semibold text-zinc-300">
              <Users className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
              <span>Guests:</span>
              <button
                type="button"
                onClick={() => setGuestCount((g) => Math.max(1, g - 1))}
                className="h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 font-bold text-white shadow-sm hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition active:scale-95"
              >
                -
              </button>
              <span className="w-5 text-center font-black" style={{ color: 'var(--theme-accent, #DB2777)' }}>{guestCount}</span>
              <button
                type="button"
                onClick={() => setGuestCount((g) => g + 1)}
                className="h-5 w-5 rounded-full bg-zinc-800 border border-zinc-700 font-bold text-white shadow-sm hover:bg-zinc-700 flex items-center justify-center cursor-pointer transition active:scale-95"
              >
                +
              </button>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Warning Toast if capacity exceeded banner */}
        {warningMessage && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-amber-950/60 border border-amber-500/50 p-2.5 text-xs font-bold text-amber-200 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>{warningMessage}</span>
            </div>
            <button onClick={() => setWarningMessage(null)} className="text-amber-400 hover:text-white">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Tables Grid */}
        <div className="flex-1 overflow-y-auto py-5 pr-1 no-scrollbar">
          {floorTables.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <p className="text-sm font-semibold">No tables configured for {activeFloor}.</p>
              <p className="text-xs text-zinc-600 mt-1">Add tables in the Table Collections section.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {floorTables.map((table) => {
                const isSelected = selectedTableId === table.id;
                const isRunning = table.status === 'RUNNING' || isSelected;
                const isBillPrinted = table.status === 'BILL_PRINTED';
                const isNeedsAttention = table.status === 'NEEDS_ATTENTION';
                const isFree = !isRunning && !isBillPrinted && !isNeedsAttention;

                // Seat capacity & alert calculations
                const currentSeated = isRunning ? (table.guestCount || 1) : 0;
                const availableSeats = Math.max(0, table.capacity - currentSeated);
                const exceedsCapacity = guestCount > table.capacity;
                const seatDeficit = guestCount - table.capacity;

                return (
                  <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    onMouseEnter={() => setHoveredTableId(table.id)}
                    onMouseLeave={() => setHoveredTableId(null)}
                    className={`relative flex flex-col justify-between rounded-2xl p-4 min-h-[120px] cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'border-2 border-emerald-500 bg-emerald-950/40 shadow-lg ring-2 ring-emerald-500/20'
                        : exceedsCapacity
                        ? 'border-2 border-amber-500/80 bg-amber-950/20 shadow-md shadow-amber-950/30 hover:border-amber-400'
                        : isRunning
                        ? 'border border-emerald-500/40 bg-emerald-950/20 shadow-sm hover:border-emerald-500/70'
                        : isBillPrinted
                        ? 'border border-blue-500/30 bg-blue-950/20 shadow-sm hover:border-blue-500/60'
                        : isNeedsAttention
                        ? 'border border-rose-500/30 bg-rose-950/20 shadow-sm hover:border-rose-500/60'
                        : 'border border-zinc-800 bg-zinc-950/70 hover:border-theme hover:bg-zinc-900/90 shadow-sm'
                    }`}
                  >
                    {/* Top Row: Name and Status Badge */}
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-base font-black tracking-tight ${
                        isSelected
                          ? 'text-emerald-300'
                          : exceedsCapacity
                          ? 'text-amber-200'
                          : 'text-white'
                      }`}>
                        {table.name}
                      </span>

                      {exceedsCapacity ? (
                        <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 flex items-center gap-1 animate-pulse">
                          <AlertTriangle className="h-2.5 w-2.5 text-amber-400" />
                          <span>Over Cap</span>
                        </span>
                      ) : isRunning ? (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          Running
                        </span>
                      ) : isBillPrinted ? (
                        <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                          Bill
                        </span>
                      ) : isNeedsAttention ? (
                        <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                          Alert
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800/80 border border-zinc-700/60 px-2 py-0.5 text-[10px] font-semibold text-zinc-400">
                          Free
                        </span>
                      )}
                    </div>

                    {/* Middle details: Seating Capacity & Available Seats */}
                    <div className="my-1.5 space-y-0.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-medium">Capacity:</span>
                        <span className="font-bold text-white">{table.capacity} seats</span>
                      </div>

                      {/* Guest Seats Alert & Availability */}
                      {exceedsCapacity ? (
                        <div className="rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 flex items-center justify-between">
                          <span>Over by {seatDeficit}</span>
                          <span>Max {table.capacity}</span>
                        </div>
                      ) : isRunning ? (
                        <div className="text-[10px] font-bold text-emerald-400 flex items-center justify-between">
                          <span>{currentSeated} seated</span>
                          <span>{availableSeats === 0 ? 'Full' : `${availableSeats} free`}</span>
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold text-emerald-400/90 flex items-center justify-between">
                          <span>{table.capacity} available</span>
                          <span className="text-zinc-500 text-[9px] font-medium">Fits {guestCount}</span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Row: Table Type & Selection Checkmark */}
                    <div className="flex items-center justify-between pt-1 text-xs border-t border-zinc-800/60">
                      <span className="rounded bg-zinc-800/90 text-zinc-300 border border-zinc-700/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase">
                        {table.type || 'Standard'}
                      </span>

                      {isSelected ? (
                        <Check className="h-4 w-4 text-emerald-400 font-bold" />
                      ) : isRunning && table.waiterName ? (
                        <span className="text-[10px] text-zinc-400 truncate max-w-[70px]">
                          {table.waiterName}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Legend at bottom */}
        <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
              Running
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-amber-400">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]" />
              Over Capacity Alert
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-blue-400">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
              Bill printed
            </span>
            <span className="flex items-center gap-1.5 font-semibold text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full border border-zinc-600 bg-zinc-800" />
              Free
            </span>
          </div>

          <span className="text-[11px] text-zinc-500">
            {isSyncing ? 'Syncing active tables...' : 'Click table to select'}
          </span>
        </div>
      </div>
    </div>
  );
}
