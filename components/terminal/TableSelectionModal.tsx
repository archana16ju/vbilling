'use client';
import { useState } from 'react';
import { X, Users, Check } from 'lucide-react';
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
  const { tables, floors } = useTableStore();
  const [activeFloor, setActiveFloor] = useState<string>(floors[0] || 'Ground floor');
  const [guestCount, setGuestCount] = useState<number>(1);
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter tables by active floor
  const floorTables = tables.filter((t) => t.floor === activeFloor);

  const handleTableClick = (table: TableItem) => {
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
          <div className="flex items-center gap-5">
            <h2 className="text-xl font-black tracking-tight text-white">Which table?</h2>

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
              <span className="w-4 text-center font-black" style={{ color: 'var(--theme-accent, #DB2777)' }}>{guestCount}</span>
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

                return (
                  <div
                    key={table.id}
                    onClick={() => handleTableClick(table)}
                    onMouseEnter={() => setHoveredTableId(table.id)}
                    onMouseLeave={() => setHoveredTableId(null)}
                    className={`relative flex flex-col justify-between rounded-2xl p-4 min-h-[110px] cursor-pointer transition-all select-none ${
                      isSelected
                        ? 'border-2 border-emerald-500 bg-emerald-950/40 shadow-lg ring-2 ring-emerald-500/20'
                        : isRunning
                        ? 'border border-emerald-500/30 bg-emerald-950/20 shadow-sm hover:border-emerald-500/60'
                        : isBillPrinted
                        ? 'border border-blue-500/30 bg-blue-950/20 shadow-sm hover:border-blue-500/60'
                        : isNeedsAttention
                        ? 'border border-rose-500/30 bg-rose-950/20 shadow-sm hover:border-rose-500/60'
                        : 'border border-zinc-800 bg-zinc-950/70 hover:border-theme hover:bg-zinc-900/90 shadow-sm'
                    }`}
                  >
                    {/* Top Row: Name and optional badge */}
                    <div className="flex items-start justify-between gap-1">
                      <span className={`text-base font-black tracking-tight ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                        {table.name}
                      </span>

                      {isRunning && (
                        <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          Running
                        </span>
                      )}

                      {isBillPrinted && (
                        <span className="rounded-full bg-blue-500/20 border border-blue-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-400">
                          Bill
                        </span>
                      )}

                      {isNeedsAttention && (
                        <span className="rounded-full bg-rose-500/20 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                          Alert
                        </span>
                      )}
                    </div>

                    {/* Middle details if any */}
                    <div className="my-1 text-[11px] text-zinc-400">
                      {table.type && table.type !== 'Standard' && (
                        <span className="rounded bg-zinc-800 text-zinc-300 border border-zinc-700/60 px-1.5 py-0.5 text-[10px] font-semibold">
                          {table.type}
                        </span>
                      )}
                    </div>

                    {/* Bottom Row: Capacity & Status */}
                    <div className="flex items-center justify-between text-xs text-zinc-400">
                      <span className="font-semibold text-zinc-400">{table.capacity} seats</span>
                      {!isRunning && !isBillPrinted && !isNeedsAttention && (
                        <span className="text-[11px] text-zinc-500 font-semibold">Free</span>
                      )}
                      {isSelected && (
                        <Check className="h-4 w-4 text-emerald-400 font-bold" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Status Legend at bottom */}
        <div className="pt-3 border-t border-zinc-800 flex flex-wrap items-center justify-between text-xs text-zinc-400 gap-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]" />
              Running
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_6px_#3b82f6]" />
              Bill printed, awaiting payment
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_6px_#f43f5e]" />
              Needs attention
            </span>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className="h-2.5 w-2.5 rounded-full border border-zinc-600 bg-zinc-800" />
              Free
            </span>
          </div>

          <span className="text-[11px] text-zinc-500">Click any table to select</span>
        </div>
      </div>
    </div>
  );
}
