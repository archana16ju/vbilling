'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Calendar,
  X,
  RefreshCw,
  TrendingDown,
  ShieldAlert,
  ArrowUpDown,
  History,
} from 'lucide-react';
import BatchModal from './BatchModal';
import { ProductBatch, BatchStatus, BatchTransaction } from '@/types/batches';
import { Product, RawMaterial, Supplier } from '@/types/product';
import {
  getProductBatches,
  createProductBatch,
  updateProductBatch,
  deleteProductBatch,
  getBatchTransactions,
} from '@/lib/actions/batches';

interface BatchesTabProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  suppliers: Supplier[];
}

export default function BatchesTab({ products, rawMaterials, suppliers }: BatchesTabProps) {
  const [batches, setBatches] = useState<ProductBatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'near_expiry' | 'expired' | 'exhausted'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'raw_material'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null);

  // Ledger Modal State
  const [isLedgerOpen, setIsLedgerOpen] = useState(false);
  const [ledgerBatch, setLedgerBatch] = useState<ProductBatch | null>(null);
  const [ledgerTransactions, setLedgerTransactions] = useState<BatchTransaction[]>([]);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  const openLedgerModal = async (batch: ProductBatch) => {
    setLedgerBatch(batch);
    setIsLedgerOpen(true);
    setIsLedgerLoading(true);
    try {
      const txs = await getBatchTransactions(batch.id);
      setLedgerTransactions(txs);
    } catch (err) {
      console.error('Failed to load batch transactions:', err);
      setLedgerTransactions([]);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  const loadBatches = async () => {
    setIsLoading(true);
    try {
      const data = await getProductBatches();
      setBatches(data);
    } catch (err: any) {
      console.error('Failed to load batches:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const openCreateModal = () => {
    setEditingBatch(null);
    setIsModalOpen(true);
  };

  const openEditModal = (batch: ProductBatch) => {
    setEditingBatch(batch);
    setIsModalOpen(true);
  };

  const handleDelete = async (batchId: string) => {
    if (!window.confirm('Are you sure you want to delete this batch and its transaction history?')) return;
    try {
      await deleteProductBatch(batchId);
      await loadBatches();
    } catch (err: any) {
      alert(err.message || 'Failed to delete batch.');
    }
  };

  // Metrics
  const metrics = useMemo(() => {
    const total = batches.length;
    const active = batches.filter((b) => b.status === 'active').length;
    const nearExpiry = batches.filter((b) => b.status === 'near_expiry').length;
    const expired = batches.filter((b) => b.status === 'expired').length;
    return { total, active, nearExpiry, expired };
  }, [batches]);

  // Filtered List
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (typeFilter !== 'all' && b.itemType !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const num = b.batchNumber.toLowerCase();
        const name = (b.itemName || '').toLowerCase();
        const sku = (b.itemSku || '').toLowerCase();
        return num.includes(q) || name.includes(q) || sku.includes(q);
      }
      return true;
    });
  }, [batches, statusFilter, typeFilter, searchQuery]);

  const getDaysLeft = (expiryDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    const diff = Math.ceil((exp.getTime() - today.getTime()) / 86400000);
    return diff;
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Batches</span>
            <Boxes className="h-4 w-4 text-theme-accent" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Active</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics.active}</div>
        </div>

        <div className="rounded-2xl border border-amber-900/40 bg-amber-950/20 p-4">
          <div className="flex items-center justify-between text-amber-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Near Expiry (&lt;30d)</span>
            <Clock className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-amber-400">{metrics.nearExpiry}</div>
        </div>

        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-4">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Expired</span>
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-rose-400">{metrics.expired}</div>
        </div>
      </div>

      {/* Filter and Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search batch # or item name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 px-3 text-xs text-zinc-300 focus:border-theme focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="near_expiry">Near Expiry Only</option>
            <option value="expired">Expired Only</option>
            <option value="exhausted">Exhausted (Out of Stock)</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e: any) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 px-3 text-xs text-zinc-300 focus:border-theme focus:outline-none cursor-pointer"
          >
            <option value="all">All Item Types</option>
            <option value="product">Finished Products</option>
            <option value="raw_material">Raw Ingredients</option>
          </select>

          <button
            onClick={loadBatches}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-2 text-zinc-400 hover:text-white transition cursor-pointer"
            title="Refresh Batches"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-xl bg-theme-bar border border-theme shadow-theme-glow px-4 py-2 text-xs font-bold text-white hover:opacity-95 transition cursor-pointer active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>New Batch</span>
        </button>
      </div>

      {/* Batches Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/40">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-zinc-800 bg-zinc-900/80 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="py-3 px-4">Batch Number</th>
                <th className="py-3 px-4">Item & Type</th>
                <th className="py-3 px-4">Remaining / Initial</th>
                <th className="py-3 px-4">Mfg Date</th>
                <th className="py-3 px-4">Expiry Date</th>
                <th className="py-3 px-4">Cost / Sell</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-theme-accent" />
                    Loading batches...
                  </td>
                </tr>
              ) : filteredBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">
                    <Boxes className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    No batches found matching current filters.
                  </td>
                </tr>
              ) : (
                filteredBatches.map((batch) => {
                  const daysLeft = getDaysLeft(batch.expiryDate);
                  return (
                    <tr key={batch.id} className="hover:bg-zinc-800/30 transition">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-white bg-zinc-800/80 px-2 py-0.5 rounded text-[11px] border border-zinc-700">
                          {batch.batchNumber}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{batch.itemName || batch.itemId}</div>
                        <div className="text-[10px] text-zinc-500 capitalize">
                          {batch.itemType === 'product' ? 'Product' : 'Ingredient'}
                          {batch.itemSku ? ` · ${batch.itemSku}` : ''}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-white">
                          {batch.currentQuantity} <span className="text-zinc-500 text-[10px]">/ {batch.initialQuantity}</span>
                        </div>
                        {batch.minStockLevel != null && batch.minStockLevel > 0 ? (
                          <div className={`text-[10px] ${batch.currentQuantity <= batch.minStockLevel ? 'text-amber-400 font-bold' : 'text-zinc-500'}`}>
                            Min: {batch.minStockLevel} {batch.currentQuantity <= batch.minStockLevel && '(Low)'}
                          </div>
                        ) : null}
                        <div className="w-20 bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                          <div
                            className={`h-full rounded-full ${
                              batch.currentQuantity === 0
                                ? 'bg-zinc-600'
                                : batch.currentQuantity / batch.initialQuantity < 0.2
                                ? 'bg-amber-400'
                                : 'bg-emerald-400'
                            }`}
                            style={{
                              width: `${Math.min(100, Math.max(0, (batch.currentQuantity / (batch.initialQuantity || 1)) * 100))}%`,
                            }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-4 text-zinc-400">
                        {batch.manufacturingDate || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-white">{batch.expiryDate}</div>
                        <div
                          className={`text-[10px] font-semibold ${
                            daysLeft < 0
                              ? 'text-rose-400'
                              : daysLeft <= 30
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {daysLeft < 0
                            ? `Expired ${Math.abs(daysLeft)}d ago`
                            : daysLeft === 0
                            ? 'Expires today'
                            : `${daysLeft} days left`}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <div>Cost: ₹{batch.purchaseCost?.toFixed(2) || '0.00'}</div>
                        {batch.sellingPrice != null && (
                          <div className="text-emerald-400">Sell: ₹{batch.sellingPrice.toFixed(2)}</div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {batch.status === 'active' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                            Active
                          </span>
                        )}
                        {batch.status === 'near_expiry' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-950/60 border border-amber-800 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                            Near Expiry
                          </span>
                        )}
                        {batch.status === 'expired' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-950/60 border border-rose-800 px-2 py-0.5 text-[10px] font-bold text-rose-400">
                            Expired
                          </span>
                        )}
                        {batch.status === 'exhausted' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-400">
                            Exhausted
                          </span>
                        )}
                        {batch.status === 'quarantined' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-950/60 border border-purple-800 px-2 py-0.5 text-[10px] font-bold text-purple-400">
                            Quarantined
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openLedgerModal(batch)}
                            className="p-1 text-zinc-400 hover:text-cyan-400 rounded hover:bg-cyan-950/40 transition cursor-pointer"
                            title="View Batch History / Audit Ledger"
                          >
                            <History className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => openEditModal(batch)}
                            className="p-1 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition cursor-pointer"
                            title="Edit Batch"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(batch.id)}
                            className="p-1 text-zinc-400 hover:text-rose-400 rounded hover:bg-rose-950/40 transition cursor-pointer"
                            title="Delete Batch"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Batch Modal */}
      <BatchModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={loadBatches}
        products={products}
        rawMaterials={rawMaterials}
        suppliers={suppliers}
        initialBatch={editingBatch}
      />

      {/* Audit Ledger Modal */}
      {isLedgerOpen && ledgerBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <History className="h-5 w-5 text-cyan-400" />
                  <h3 className="text-base font-bold text-white">Batch Audit Ledger</h3>
                  <span className="font-mono text-xs bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-cyan-300 font-semibold">
                    {ledgerBatch.batchNumber}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Item: <span className="text-white font-medium">{ledgerBatch.itemName || ledgerBatch.itemId}</span> · Expiry: <span className="text-white font-medium">{ledgerBatch.expiryDate}</span> · Current Stock: <span className="text-white font-mono font-bold">{ledgerBatch.currentQuantity}</span>
                </p>
              </div>
              <button
                onClick={() => setIsLedgerOpen(false)}
                className="text-zinc-400 hover:text-white rounded-lg p-1 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {isLedgerLoading ? (
                <div className="py-12 text-center text-zinc-500">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-cyan-400" />
                  Loading audit transactions...
                </div>
              ) : ledgerTransactions.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40 text-zinc-600" />
                  No transactions recorded for this batch yet.
                </div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-zinc-800 bg-zinc-950/60 text-[10px] font-bold uppercase tracking-wider text-zinc-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Date / Time</th>
                      <th className="py-2.5 px-3">Action</th>
                      <th className="py-2.5 px-3 text-right">Qty Changed</th>
                      <th className="py-2.5 px-3 text-right">Balance</th>
                      <th className="py-2.5 px-3">Reason / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                    {ledgerTransactions.map((tx) => {
                      const isPositive = tx.quantity > 0;
                      return (
                        <tr key={tx.id} className="hover:bg-zinc-800/30 transition">
                          <td className="py-2.5 px-3 text-zinc-400 text-[10px]">
                            {new Date(tx.createdAt).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            {tx.transactionType === 'inward' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/60 border border-emerald-800 text-emerald-400">
                                Inward
                              </span>
                            )}
                            {tx.transactionType === 'sale_deduction' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-blue-950/60 border border-blue-800 text-blue-400">
                                Sale
                              </span>
                            )}
                            {tx.transactionType === 'return_restock' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-cyan-950/60 border border-cyan-800 text-cyan-400">
                                Restock Return
                              </span>
                            )}
                            {tx.transactionType === 'quarantine' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-purple-950/60 border border-purple-800 text-purple-400">
                                Quarantine
                              </span>
                            )}
                            {tx.transactionType === 'waste_expired' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-rose-950/60 border border-rose-800 text-rose-400">
                                Expired / Waste
                              </span>
                            )}
                            {tx.transactionType === 'manual_adjustment' && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-amber-950/60 border border-amber-800 text-amber-400">
                                Adjustment
                              </span>
                            )}
                          </td>
                          <td className={`py-2.5 px-3 text-right font-bold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isPositive ? `+${tx.quantity}` : tx.quantity}
                          </td>
                          <td className="py-2.5 px-3 text-right text-white">
                            {tx.quantityAfter}
                          </td>
                          <td className="py-2.5 px-3 font-sans text-zinc-300 text-[11px] truncate max-w-[180px]">
                            {tx.reason || (tx.saleId ? `Bill #${tx.saleId}` : '—')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsLedgerOpen(false)}
                className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
