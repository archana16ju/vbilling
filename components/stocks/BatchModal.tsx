'use client';

import { useState, useEffect } from 'react';
import { X, Boxes, AlertTriangle } from 'lucide-react';
import { ProductBatch, BatchStatus } from '@/types/batches';
import { Product, RawMaterial, Supplier } from '@/types/product';
import { createProductBatch, updateProductBatch } from '@/lib/actions/batches';

export interface BatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (batch: ProductBatch) => void;
  products: Product[];
  rawMaterials: RawMaterial[];
  suppliers: Supplier[];
  initialBatch?: ProductBatch | null;
  defaultItemType?: 'product' | 'raw_material';
  defaultItemId?: string;
}

export default function BatchModal({
  isOpen,
  onClose,
  onSaved,
  products,
  rawMaterials,
  suppliers,
  initialBatch,
  defaultItemType = 'product',
  defaultItemId,
}: BatchModalProps) {
  const [formItemType, setFormItemType] = useState<'product' | 'raw_material'>('product');
  const [formItemId, setFormItemId] = useState('');
  const [formBatchNumber, setFormBatchNumber] = useState('');
  const [formMfgDate, setFormMfgDate] = useState('');
  const [formExpiryDate, setFormExpiryDate] = useState('');
  const [formQuantity, setFormQuantity] = useState('10');
  const [formCurrentStock, setFormCurrentStock] = useState('10');
  const [formMinStockLevel, setFormMinStockLevel] = useState('0');
  const [formPurchaseCost, setFormPurchaseCost] = useState('');
  const [formSellingPrice, setFormSellingPrice] = useState('');
  const [formSupplierId, setFormSupplierId] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    if (initialBatch) {
      setFormItemType(initialBatch.itemType);
      setFormItemId(initialBatch.itemId);
      setFormBatchNumber(initialBatch.batchNumber);
      setFormMfgDate(initialBatch.manufacturingDate || '');
      setFormExpiryDate(initialBatch.expiryDate);
      setFormQuantity(String(initialBatch.initialQuantity ?? initialBatch.currentQuantity));

      // Automatically sync current stock to the item's live stock if restored, updated, or low
      const targetItem = initialBatch.itemType === 'product'
        ? products.find(p => p.id === initialBatch.itemId)
        : rawMaterials.find(m => m.id === initialBatch.itemId);
      const liveStock = targetItem
        ? ('currentStock' in targetItem ? Number(targetItem.currentStock) : Number((targetItem as any).stock))
        : initialBatch.currentQuantity;

      setFormCurrentStock(String(liveStock != null ? liveStock : initialBatch.currentQuantity));
      setFormMinStockLevel(String(initialBatch.minStockLevel ?? 0));
      setFormPurchaseCost(initialBatch.purchaseCost ? String(initialBatch.purchaseCost) : '');
      setFormSellingPrice(initialBatch.sellingPrice ? String(initialBatch.sellingPrice) : '');
      setFormSupplierId(initialBatch.supplierId || '');
    } else {
      const itemType = defaultItemType;
      setFormItemType(itemType);

      const resolvedItemId =
        defaultItemId ||
        (itemType === 'product' ? products[0]?.id || '' : rawMaterials[0]?.id || '');
      setFormItemId(resolvedItemId);

      const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const rnd = Math.floor(100 + Math.random() * 900);
      setFormBatchNumber(`BAT-${dateStr}-${rnd}`);
      setFormMfgDate(new Date().toISOString().split('T')[0]);

      // Default expiry 180 days out
      const expDate = new Date(Date.now() + 180 * 86400000).toISOString().split('T')[0];
      setFormExpiryDate(expDate);

      const targetItem = itemType === 'product'
        ? products.find(p => p.id === resolvedItemId)
        : rawMaterials.find(m => m.id === resolvedItemId);
      let itemStock = 999;
      if (targetItem) {
        itemStock = 'currentStock' in targetItem ? Number(targetItem.currentStock) : Number(targetItem.stock);
      }
      const defaultQty = String(itemStock || 999);

      setFormQuantity(defaultQty);
      setFormCurrentStock(defaultQty);
      setFormMinStockLevel('0');
      setFormPurchaseCost('');
      setFormSellingPrice('');
      setFormSupplierId(suppliers[0]?.id || '');
    }
    setErrorMsg('');
  }, [isOpen, initialBatch, defaultItemType, defaultItemId, products, rawMaterials, suppliers]);

  // When switching item category in create mode, reset item selection and sync stock
  const handleItemTypeChange = (type: 'product' | 'raw_material') => {
    setFormItemType(type);
    const firstId = type === 'product' ? products[0]?.id || '' : rawMaterials[0]?.id || '';
    setFormItemId(firstId);
    const targetItem = type === 'product' ? products[0] : rawMaterials[0];
    if (targetItem) {
      const stockVal = 'currentStock' in targetItem ? Number(targetItem.currentStock) : Number((targetItem as any).stock);
      const stockStr = String(stockVal != null ? stockVal : 999);
      setFormQuantity(stockStr);
      setFormCurrentStock(stockStr);
    }
  };

  const handleItemChange = (itemId: string) => {
    setFormItemId(itemId);
    const targetItem = formItemType === 'product'
      ? products.find(p => p.id === itemId)
      : rawMaterials.find(m => m.id === itemId);
    if (targetItem) {
      const stockVal = 'currentStock' in targetItem ? Number(targetItem.currentStock) : Number((targetItem as any).stock);
      const stockStr = String(stockVal != null ? stockVal : 999);
      setFormQuantity(stockStr);
      setFormCurrentStock(stockStr);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formItemId) {
      setErrorMsg(`Please select a ${formItemType === 'raw_material' ? 'raw material' : 'product'}.`);
      return;
    }
    if (!formBatchNumber.trim()) {
      setErrorMsg('Batch number is required.');
      return;
    }
    if (!formExpiryDate) {
      setErrorMsg('Expiry date is required.');
      return;
    }

    const initQty = parseFloat(formQuantity);
    if (isNaN(initQty) || initQty < 0) {
      setErrorMsg('Quantity must be a valid non-negative number.');
      return;
    }

    const currStock = parseFloat(formCurrentStock);
    if (isNaN(currStock) || currStock < 0) {
      setErrorMsg('Stock (current quantity) must be a valid non-negative number.');
      return;
    }

    const minStock = parseFloat(formMinStockLevel);
    if (isNaN(minStock) || minStock < 0) {
      setErrorMsg('Minimum stock level must be a valid non-negative number.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      let savedBatch: ProductBatch;
      if (initialBatch) {
        await updateProductBatch(initialBatch.id, {
          batchNumber: formBatchNumber.trim(),
          manufacturingDate: formMfgDate || null,
          expiryDate: formExpiryDate,
          initialQuantity: initQty,
          currentQuantity: currStock,
          minStockLevel: minStock,
          purchaseCost: formPurchaseCost ? parseFloat(formPurchaseCost) : 0,
          sellingPrice: formItemType === 'product' && formSellingPrice ? parseFloat(formSellingPrice) : null,
          supplierId: formSupplierId || null,
        });
        savedBatch = {
          ...initialBatch,
          batchNumber: formBatchNumber.trim(),
          manufacturingDate: formMfgDate || null,
          expiryDate: formExpiryDate,
          initialQuantity: initQty,
          currentQuantity: currStock,
          minStockLevel: minStock,
          purchaseCost: formPurchaseCost ? parseFloat(formPurchaseCost) : 0,
          sellingPrice: formItemType === 'product' && formSellingPrice ? parseFloat(formSellingPrice) : null,
          supplierId: formSupplierId || null,
        };
      } else {
        const supplierObj = suppliers.find((s) => s.id === formSupplierId);
        savedBatch = await createProductBatch({
          itemType: formItemType,
          itemId: formItemId,
          batchNumber: formBatchNumber.trim(),
          manufacturingDate: formMfgDate || null,
          expiryDate: formExpiryDate,
          initialQuantity: initQty,
          currentQuantity: currStock,
          minStockLevel: minStock,
          purchaseCost: formPurchaseCost ? parseFloat(formPurchaseCost) : 0,
          sellingPrice: formItemType === 'product' && formSellingPrice ? parseFloat(formSellingPrice) : null,
          supplierId: formSupplierId || null,
          supplierName: supplierObj?.name || null,
        });
      }

      onSaved?.(savedBatch);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save batch.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-pink-400" />
            <h2 className="text-lg font-black tracking-tight text-white">
              {initialBatch ? 'Edit Batch' : 'Create New Batch'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Item Category
              </label>
              <select
                disabled={Boolean(initialBatch)}
                value={formItemType}
                onChange={(e) => handleItemTypeChange(e.target.value as any)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white focus:border-pink-500 focus:outline-none disabled:opacity-50"
              >
                <option value="product">Finished Product</option>
                <option value="raw_material">Raw Material / Ingredient</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Select Item</label>
              <select
                disabled={Boolean(initialBatch)}
                value={formItemId}
                onChange={(e) => handleItemChange(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white focus:border-pink-500 focus:outline-none disabled:opacity-50"
              >
                {formItemType === 'product' ? (
                  products.length === 0 ? (
                    <option value="" disabled>No products available</option>
                  ) : (
                    products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock})
                      </option>
                    ))
                  )
                ) : rawMaterials.length === 0 ? (
                  <option value="" disabled>No raw materials found</option>
                ) : (
                  rawMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.currentStock} {m.unit})
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Batch Number *
              </label>
              <input
                type="text"
                required
                value={formBatchNumber}
                onChange={(e) => setFormBatchNumber(e.target.value)}
                placeholder="e.g. BAT-20261111-001"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Quantity (Initial) *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formQuantity}
                onChange={(e) => {
                  setFormQuantity(e.target.value);
                  if (!initialBatch) {
                    setFormCurrentStock(e.target.value);
                  }
                }}
                placeholder="10"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Current Stock *
              </label>
              <input
                type="number"
                step="any"
                required
                value={formCurrentStock}
                onChange={(e) => setFormCurrentStock(e.target.value)}
                placeholder="10"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Minimum Stock Level
              </label>
              <input
                type="number"
                step="any"
                value={formMinStockLevel}
                onChange={(e) => setFormMinStockLevel(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Mfg Date</label>
              <input
                type="date"
                value={formMfgDate}
                onChange={(e) => setFormMfgDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Expiry Date *</label>
              <input
                type="date"
                required
                value={formExpiryDate}
                onChange={(e) => setFormExpiryDate(e.target.value)}
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>
          </div>

          <div className={formItemType === 'product' ? "grid grid-cols-2 gap-3" : "space-y-3"}>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Purchase Cost (₹)
              </label>
              <input
                type="number"
                step="0.01"
                value={formPurchaseCost}
                onChange={(e) => setFormPurchaseCost(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white focus:border-pink-500 focus:outline-none"
              />
            </div>

            {formItemType === 'product' && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Selling Price Override (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formSellingPrice}
                  onChange={(e) => setFormSellingPrice(e.target.value)}
                  placeholder="Optional override"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-white focus:border-pink-500 focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Supplier</label>
            <select
              value={formSupplierId}
              onChange={(e) => setFormSupplierId(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white focus:border-pink-500 focus:outline-none"
            >
              <option value="">No Supplier Selected</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-800 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : initialBatch ? 'Update Batch' : 'Save Batch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
