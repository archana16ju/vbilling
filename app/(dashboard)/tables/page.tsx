'use client';

import React, { useState, useEffect } from 'react';
import {
  useTableStore,
  TableItem,
  TableStatus,
} from '@/store/useTableStore';
import {
  Plus,
  Edit2,
  Trash2,
  Users,
  Grid,
  Layers,
  Check,
  X,
  AlertCircle,
  RotateCcw,
  Sparkles,
  User,
} from 'lucide-react';
import WaiterAssignmentModal from '@/components/terminal/WaiterAssignmentModal';

const TABLE_TYPES = ['Standard', 'AC', 'Booth', 'Outdoor', 'VIP', 'High-Top'];

const STATUS_CONFIG: Record<TableStatus, { label: string; dotClass: string; badgeClass: string; borderClass: string; bgClass: string }> = {
  FREE: {
    label: 'Free',
    dotClass: 'bg-zinc-600 border border-zinc-500',
    badgeClass: 'bg-zinc-800 text-zinc-400',
    borderClass: 'border border-dashed border-zinc-700 hover:border-zinc-500',
    bgClass: 'bg-zinc-900/50',
  },
  RUNNING: {
    label: 'Running',
    dotClass: 'bg-emerald-400 shadow-sm shadow-emerald-400/50',
    badgeClass: 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 font-semibold',
    borderClass: 'border-2 border-emerald-500/60 shadow-lg shadow-emerald-500/10',
    bgClass: 'bg-emerald-950/20',
  },
  BILL_PRINTED: {
    label: 'Bill printed, awaiting payment',
    dotClass: 'bg-cyan-400 shadow-sm shadow-cyan-400/50',
    badgeClass: 'bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 font-semibold',
    borderClass: 'border-2 border-cyan-500/60 shadow-lg shadow-cyan-500/10',
    bgClass: 'bg-cyan-950/20',
  },
  NEEDS_ATTENTION: {
    label: 'Needs attention',
    dotClass: 'bg-rose-500 shadow-sm shadow-rose-500/50',
    badgeClass: 'bg-rose-950/60 text-rose-400 border border-rose-500/30 font-semibold',
    borderClass: 'border-2 border-rose-500/60 shadow-lg shadow-rose-500/10',
    bgClass: 'bg-rose-950/20',
  },
};

export default function TableCollectionsPage() {
  const [mounted, setMounted] = useState(false);
  const {
    tables,
    floors,
    selectedTableId,
    selectedGuestCount,
    selectTable,
    clearSelectedTable,
    addTable,
    updateTable,
    deleteTable,
    setTableStatus,
    setTableWaiter,
    addFloor,
    deleteFloor,
    resetToDefaults,
  } = useTableStore();

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;

  const [activeFloor, setActiveFloor] = useState<string>('Ground floor');

  // Modal states
  const [isAddTableOpen, setIsAddTableOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [tableToAssignWaiter, setTableToAssignWaiter] = useState<TableItem | null>(null);
  const [isAddFloorOpen, setIsAddFloorOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');

  // Table form state
  const [formName, setFormName] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formCapacity, setFormCapacity] = useState(4);
  const [formType, setFormType] = useState('Standard');
  const [formStatus, setFormStatus] = useState<TableStatus>('FREE');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    setMounted(true);
    if (floors.length > 0 && !floors.includes(activeFloor)) {
      setActiveFloor(floors[0]);
    }
  }, [floors]);

  if (!mounted) return null;

  const currentFloorTables = tables.filter((t) => t.floor === activeFloor);

  const openAddModal = () => {
    setFormName(`T${tables.length + 1}`);
    setFormFloor(activeFloor);
    setFormCapacity(4);
    setFormType('Standard');
    setFormStatus('FREE');
    setFormNotes('');
    setIsAddTableOpen(true);
  };

  const openEditModal = (table: TableItem) => {
    setEditingTable(table);
    setFormName(table.name);
    setFormFloor(table.floor);
    setFormCapacity(table.capacity);
    setFormType(table.type || 'Standard');
    setFormStatus(table.status);
    setFormNotes(table.notes || '');
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formFloor) return;

    if (editingTable) {
      updateTable(editingTable.id, {
        name: formName.trim(),
        floor: formFloor,
        capacity: Number(formCapacity) || 2,
        type: formType,
        status: formStatus,
        notes: formNotes.trim(),
      });
      setEditingTable(null);
    } else {
      addTable({
        name: formName.trim(),
        floor: formFloor,
        capacity: Number(formCapacity) || 2,
        type: formType,
        status: formStatus,
        notes: formNotes.trim(),
      });
      setIsAddTableOpen(false);
    }
  };

  const handleAddFloorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFloorName.trim();
    if (trimmed) {
      addFloor(trimmed);
      setActiveFloor(trimmed);
      setNewFloorName('');
      setIsAddFloorOpen(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col text-white pb-16 space-y-6">
      {/* Top Banner / Navigation Header with Dynamic Theme Gradient */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6 flex-wrap">
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-pink-300" />
              Tables
            </h1>

            {/* Floor Tabs with Neon Style */}
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 p-1 border border-pink-500/20 backdrop-blur-md">
              {floors.map((floor) => {
                const isActive = activeFloor === floor;
                const count = tables.filter((t) => t.floor === floor).length;
                return (
                  <button
                    key={floor}
                    type="button"
                    onClick={() => setActiveFloor(floor)}
                    style={isActive ? { color: '#0f172a' } : undefined}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                      isActive
                        ? 'bg-white text-zinc-950 shadow-md shadow-pink-500/20'
                        : 'text-pink-100/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span>{floor}</span>
                    <span className={`ml-1.5 text-[10px] font-semibold ${isActive ? 'text-pink-600' : 'text-pink-300/60'}`}>
                      ({count})
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsAddFloorOpen(true)}
                className="rounded-full px-3 py-1.5 text-xs font-bold text-pink-200 hover:text-white hover:bg-black/50 transition cursor-pointer flex items-center gap-1"
                title="Add a new floor"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Floor</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddModal}
              style={{ color: '#0f172a' }}
              className="flex items-center gap-2 rounded-xl bg-white text-zinc-950 px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-pink-100 active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Add Table</span>
            </button>

            <button
              onClick={() => {
                if (confirm('Reset all tables and floors to reference defaults?')) {
                  resetToDefaults();
                  setActiveFloor('Ground floor');
                }
              }}
              className="rounded-xl border border-pink-400/30 bg-black/40 p-2.5 text-pink-200 hover:bg-black/60 hover:text-white transition shadow-sm cursor-pointer"
              title="Reset tables to default reference layout"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 w-full mx-auto">
        {/* Active Selection Banner if table selected in Terminal */}
        {selectedTable && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 px-5 py-3 shadow-lg shadow-emerald-500/10 animate-in fade-in">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-md">
                🪑
              </span>
              <div>
                <p className="text-sm font-bold text-emerald-200 flex items-center gap-2">
                  <span>Table {selectedTable.name} is currently selected in Terminal</span>
                  <span className="rounded-full bg-emerald-900/60 border border-emerald-400/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                    Active Dine In
                  </span>
                </p>
                <p className="text-xs text-emerald-400/80 mt-0.5">
                  Floor: <strong>{selectedTable.floor}</strong> • Seating: <strong>{selectedTable.capacity} seats</strong> • Guests: <strong>{selectedGuestCount}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => (window.location.href = '/terminal')}
                className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 px-4 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition cursor-pointer"
              >
                Go to Terminal
              </button>
              <button
                type="button"
                onClick={clearSelectedTable}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Floor summary & count */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-white">{activeFloor}</h2>
            <span className="text-xs font-medium text-pink-300 bg-pink-950/40 px-2.5 py-1 rounded-full border border-pink-500/30">
              {currentFloorTables.length} {currentFloorTables.length === 1 ? 'Table' : 'Tables'}
            </span>
          </div>

          {floors.length > 1 && (
            <button
              onClick={() => {
                if (confirm(`Delete the floor "${activeFloor}" and its tables?`)) {
                  deleteFloor(activeFloor);
                  const remaining = floors.filter((f) => f !== activeFloor);
                  if (remaining.length > 0) setActiveFloor(remaining[0]);
                }
              }}
              className="text-xs text-rose-400 hover:text-rose-300 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete this floor</span>
            </button>
          )}
        </div>

        {/* Tables Grid */}
        {currentFloorTables.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-zinc-800 bg-zinc-900/40 py-16 text-center shadow-lg">
            <Grid className="h-12 w-12 text-zinc-600 mb-3" />
            <h3 className="text-base font-bold text-zinc-300">No tables in {activeFloor} yet</h3>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm">
              Add your first table to organize dining spaces, seat counts, and table types.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Table</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {currentFloorTables.map((table) => {
              const statusCfg = STATUS_CONFIG[table.status] || STATUS_CONFIG.FREE;
              const isSelected = selectedTableId === table.id;

              return (
                <div
                  key={table.id}
                  onClick={() => {
                    if (isSelected) {
                      clearSelectedTable();
                    } else {
                      selectTable(table, table.capacity || 2);
                    }
                  }}
                  className={`group relative flex flex-col justify-between rounded-3xl p-5 min-h-[145px] transition-all hover:shadow-xl cursor-pointer ${
                    isSelected
                      ? 'border-2 border-emerald-500 bg-emerald-950/40 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-500/30'
                      : `${statusCfg.borderClass} ${statusCfg.bgClass}`
                  }`}
                >
                  {/* Top: Name & Quick Actions */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={`text-xl font-black tracking-tight ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                        {table.name}
                      </span>
                      {table.type && (
                        <span className="ml-2 rounded-md bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[10px] font-semibold text-zinc-300 uppercase">
                          {table.type}
                        </span>
                      )}
                      {isSelected && (
                        <span className="ml-2 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-sm">
                          Selected
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => openEditModal(table)}
                        className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition"
                        title="Edit Table Details"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete table ${table.name}?`)) {
                            deleteTable(table.id);
                          }
                        }}
                        className="rounded-lg p-1.5 text-zinc-500 hover:bg-rose-950/50 hover:text-rose-400 transition"
                        title="Delete Table"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Middle: Capacity & Waiter */}
                  <div className="my-2 flex items-center justify-between text-xs font-medium text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-4 w-4 text-zinc-500" />
                      <span>{table.capacity} seats</span>
                      {table.guestCount ? (
                        <span className="text-zinc-500">({table.guestCount} guests)</span>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTableToAssignWaiter(table);
                      }}
                      className="flex items-center gap-1 text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                      title="Assign or change waiter for this table"
                    >
                      <User className="h-3 w-3" />
                      <span className="truncate max-w-[80px]">
                        {table.waiterName || 'Assign'}
                      </span>
                    </button>
                  </div>

                  {/* Bottom: Status */}
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80">
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                      table.status === 'RUNNING' || isSelected
                        ? 'text-emerald-400'
                        : table.status === 'BILL_PRINTED'
                        ? 'text-cyan-400'
                        : table.status === 'NEEDS_ATTENTION'
                        ? 'text-rose-400'
                        : 'text-zinc-400'
                    }`}>
                      <span className={`h-2.5 w-2.5 rounded-full ${isSelected || table.status === 'RUNNING' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : statusCfg.dotClass}`} />
                      {isSelected || table.status === 'RUNNING' ? 'Running' : statusCfg.label}
                    </span>

                    {table.waiterName && (
                      <span className="text-[10px] text-zinc-500 truncate max-w-[100px]">
                        By {table.waiterName}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Status Legend at bottom */}
        <div className="mt-12 rounded-2xl bg-zinc-900/90 border border-zinc-800 p-4 shadow-lg flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-6 text-zinc-300 font-medium">
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
              Running
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400/50" />
              Bill printed, awaiting payment
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-rose-500 shadow-sm shadow-rose-500/50" />
              Needs attention
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border border-zinc-500 bg-zinc-700" />
              Free
            </span>
          </div>

          <span className="text-[11px] text-zinc-500">
            Changes are saved locally and synced directly with the Terminal.
          </span>
        </div>
      </div>

      {/* Add / Edit Table Modal */}
      {(isAddTableOpen || editingTable) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
              <h2 className="text-lg font-bold text-white">
                {editingTable ? `Edit Table: ${editingTable.name}` : 'Add New Table'}
              </h2>
              <button
                onClick={() => {
                  setIsAddTableOpen(false);
                  setEditingTable(null);
                }}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTable} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Table Name / Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. T1, T2, Table 10"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Floor *</label>
                  <select
                    value={formFloor}
                    onChange={(e) => setFormFloor(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white focus:border-pink-500 focus:outline-none"
                  >
                    {floors.map((floor) => (
                      <option key={floor} value={floor} className="bg-zinc-900 text-white">
                        {floor}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">
                    Seating Capacity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    required
                    value={formCapacity}
                    onChange={(e) => setFormCapacity(Number(e.target.value))}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Table Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white focus:border-pink-500 focus:outline-none"
                  >
                    {TABLE_TYPES.map((type) => (
                      <option key={type} value={type} className="bg-zinc-900 text-white">
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value as TableStatus)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white focus:border-pink-500 focus:outline-none"
                  >
                    <option value="FREE" className="bg-zinc-900 text-white">Free</option>
                    <option value="RUNNING" className="bg-zinc-900 text-white">Running</option>
                    <option value="BILL_PRINTED" className="bg-zinc-900 text-white">Bill printed</option>
                    <option value="NEEDS_ATTENTION" className="bg-zinc-900 text-white">Needs attention</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">
                  Notes / Description (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Near window, Balcony view"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddTableOpen(false);
                    setEditingTable(null);
                  }}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white transition shadow-lg cursor-pointer"
                >
                  {editingTable ? 'Save Changes' : 'Create Table'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Floor Modal */}
      {isAddFloorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h2 className="text-base font-bold text-white">Add New Floor</h2>
              <button
                onClick={() => setIsAddFloorOpen(false)}
                className="rounded-full p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddFloorSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Floor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rooftop, Mezzanine, VIP Lounge"
                  value={newFloorName}
                  onChange={(e) => setNewFloorName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-semibold text-white placeholder-zinc-500 focus:border-theme theme-input-focus focus:outline-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddFloorOpen(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white transition shadow-lg cursor-pointer"
                >
                  Add Floor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Waiter Assignment Modal for Table Management */}
      <WaiterAssignmentModal
        isOpen={!!tableToAssignWaiter}
        onClose={() => setTableToAssignWaiter(null)}
        onSelectWaiter={(waiter) => {
          if (tableToAssignWaiter) {
            setTableWaiter(tableToAssignWaiter.id, waiter?.id || null, waiter?.name || null);
            if (tableToAssignWaiter.activeOrderId) {
              fetch('/api/dine-in-orders', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'assignWaiter',
                  orderId: tableToAssignWaiter.activeOrderId,
                  waiterId: waiter?.id || null,
                  waiterName: waiter?.name || null,
                }),
              }).catch(console.error);
            }
          }
          setTableToAssignWaiter(null);
        }}
        currentWaiterId={tableToAssignWaiter?.waiterId}
        tableName={tableToAssignWaiter ? `Table ${tableToAssignWaiter.name}` : undefined}
        tableGuestCount={tableToAssignWaiter?.guestCount}
        actionTitle="Assign to Table"
      />
    </div>
  );
}
