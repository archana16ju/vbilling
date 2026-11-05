'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Minus,
  Check,
  AlertCircle,
  UtensilsCrossed,
  Layers,
  Sparkles,
  ShoppingCart,
} from 'lucide-react';
import { Product } from '@/lib/mock-data';
import { AddonGroup, AddonItem, SelectedAddon } from '@/types/addons';
import { getAddonGroups } from '@/lib/actions/addons';

interface AddonSelectionModalProps {
  isOpen: boolean;
  product: Product | null;
  onClose: () => void;
  onConfirm: (
    product: Product,
    selectedAddons: SelectedAddon[],
    quantity: number
  ) => void;
}

export default function AddonSelectionModal({
  isOpen,
  product,
  onClose,
  onConfirm,
}: AddonSelectionModalProps) {
  const [productQuantity, setProductQuantity] = useState(1);
  const [assignedGroups, setAssignedGroups] = useState<AddonGroup[]>([]);
  const [loading, setLoading] = useState(false);

  // Selected add-on quantities map: key = `${groupId}:::${addonId}`
  const [selectedMap, setSelectedMap] = useState<
    Record<string, { addon: AddonItem; quantity: number; group: AddonGroup }>
  >({});

  // Fetch groups and items assigned to this product
  useEffect(() => {
    if (!isOpen || !product) {
      setSelectedMap({});
      setProductQuantity(1);
      return;
    }

    setProductQuantity(product.quantityStep || 1);
    setSelectedMap({});

    const loadGroups = async () => {
      setLoading(true);
      try {
        const allGroups = await getAddonGroups();
        const relevant = (allGroups || []).filter(
          (g) => g.isActive && (product.addonGroupIds || []).includes(g.id)
        );
        setAssignedGroups(relevant);

        // Pre-select required single-choice items if any
        const initialSelections: Record<
          string,
          { addon: AddonItem; quantity: number; group: AddonGroup }
        > = {};
        for (const g of relevant) {
          if (g.isRequired && g.selectionType === 'single') {
            const firstItem = g.items?.[0];
            if (firstItem && firstItem.isActive) {
              initialSelections[`${g.id}:::${firstItem.id}`] = {
                addon: firstItem,
                quantity: 1,
                group: g,
              };
            }
          }
        }
        setSelectedMap(initialSelections);
      } catch (err) {
        console.error('Failed to load add-on groups for product:', err);
      } finally {
        setLoading(false);
      }
    };

    loadGroups();
  }, [isOpen, product]);

  // Selection handlers
  const handleToggleSingle = (group: AddonGroup, addon: AddonItem) => {
    setSelectedMap((prev) => {
      const next = { ...prev };
      // Clear other selections in this group
      for (const k of Object.keys(next)) {
        if (k.startsWith(`${group.id}:::`)) {
          delete next[k];
        }
      }
      // Set new selection
      next[`${group.id}:::${addon.id}`] = {
        addon,
        quantity: 1,
        group,
      };
      return next;
    });
  };

  const handleUpdateMultipleQty = (
    group: AddonGroup,
    addon: AddonItem,
    delta: number
  ) => {
    const key = `${group.id}:::${addon.id}`;
    const current = selectedMap[key]?.quantity || 0;
    const nextQty = Math.max(0, current + delta);

    // Check max selection limit for the group
    if (delta > 0) {
      let currentGroupTotal = 0;
      for (const [k, v] of Object.entries(selectedMap)) {
        if (k.startsWith(`${group.id}:::`)) {
          currentGroupTotal += v.quantity;
        }
      }
      if (group.maxSelection && currentGroupTotal >= group.maxSelection) {
        return; // Max reached
      }
    }

    setSelectedMap((prev) => {
      const next = { ...prev };
      if (nextQty <= 0) {
        delete next[key];
      } else {
        next[key] = {
          addon,
          quantity: nextQty,
          group,
        };
      }
      return next;
    });
  };

  // Validation rules
  const validationErrors = useMemo(() => {
    const errors: string[] = [];
    for (const g of assignedGroups) {
      let count = 0;
      for (const [k, v] of Object.entries(selectedMap)) {
        if (k.startsWith(`${g.id}:::`)) {
          count += v.quantity;
        }
      }

      if (g.isRequired && count === 0) {
        errors.push(`"${g.name}" requires at least 1 selection.`);
      } else if (g.minSelection > 0 && count < g.minSelection) {
        errors.push(
          `"${g.name}" requires minimum ${g.minSelection} selection(s) (currently ${count}).`
        );
      } else if (g.maxSelection > 0 && count > g.maxSelection) {
        errors.push(
          `"${g.name}" allows maximum ${g.maxSelection} selection(s) (currently ${count}).`
        );
      }
    }
    return errors;
  }, [assignedGroups, selectedMap]);

  // Price calculations
  const baseUnitPrice = Number(product?.price || 0);

  const addonsPerUnitTotal = useMemo(() => {
    return Object.values(selectedMap).reduce(
      (sum, item) => sum + (Number(item.addon.price || 0) * item.quantity),
      0
    );
  }, [selectedMap]);

  const perUnitTotal = baseUnitPrice + addonsPerUnitTotal;
  const grandTotal = perUnitTotal * productQuantity;

  if (!isOpen || !product) return null;

  const handleConfirm = () => {
    if (validationErrors.length > 0) return;

    const selectedList: SelectedAddon[] = Object.values(selectedMap).map((s) => ({
      id: s.addon.id,
      name: s.addon.name,
      price: Number(s.addon.price || 0),
      quantity: s.quantity,
      groupId: s.group.id,
      groupName: s.group.name,
      tax: s.addon.tax,
    }));

    onConfirm(product, selectedList, productQuantity);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl rounded-3xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200">
        {/* 1. Header Banner */}
        <div className="bg-theme-bar p-5 border-b border-theme flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            {product.image ? (
              <img
                src={product.image}
                alt=""
                className="h-12 w-12 rounded-2xl object-cover border border-white/20 shadow-md"
              />
            ) : (
              <div className="h-12 w-12 rounded-2xl bg-black/30 border border-white/20 flex items-center justify-center font-black text-sm">
                {product.name.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-1.5">
                <span>{product.name}</span>
              </h2>
              <p className="text-xs text-pink-100 font-mono mt-0.5">
                Base Price: ₹{baseUnitPrice.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 bg-black/40 text-pink-200 hover:text-white hover:bg-black/60 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 2. Scrollable Body: Add-on Groups and Items */}
        <div className="p-5 flex-1 overflow-y-auto space-y-6 no-scrollbar">
          {loading ? (
            <div className="py-12 text-center text-zinc-400">
              <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-theme border-t-transparent" />
              Loading add-ons...
            </div>
          ) : assignedGroups.length === 0 ? (
            <div className="py-8 text-center text-zinc-400">
              <p className="text-xs">No active add-on groups found for this product.</p>
            </div>
          ) : (
            assignedGroups.map((g) => {
              const isSingle = g.selectionType === 'single';
              const items = g.items || [];

              return (
                <div
                  key={g.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3"
                >
                  {/* Group header */}
                  <div className="flex items-center justify-between gap-2 border-b border-zinc-800/80 pb-2">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-pink-400" />
                        <span>{g.name}</span>
                      </h4>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {isSingle
                          ? 'Select 1 option'
                          : `Select up to ${g.maxSelection || 'any'}`}
                      </p>
                    </div>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold border uppercase tracking-wider ${
                        g.isRequired
                          ? 'bg-amber-950/60 border-amber-600/40 text-amber-300'
                          : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {g.isRequired ? 'Required' : 'Optional'}
                    </span>
                  </div>

                  {/* Items list */}
                  <div className="space-y-1.5">
                    {items.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic py-1">No items in this group.</p>
                    ) : (
                      items.map((ai) => {
                        const key = `${g.id}:::${ai.id}`;
                        const isSelected = Boolean(selectedMap[key]);
                        const currentQty = selectedMap[key]?.quantity || 0;
                        const isOutOfStock = ai.trackStock && (ai.stock || 0) <= 0;

                        if (isSingle) {
                          // Radio style for single choice
                          return (
                            <div
                              key={ai.id}
                              onClick={() => {
                                if (isOutOfStock) return;
                                handleToggleSingle(g, ai);
                              }}
                              className={`flex items-center justify-between p-2.5 rounded-xl border transition cursor-pointer select-none ${
                                isOutOfStock
                                  ? 'opacity-40 cursor-not-allowed bg-zinc-900 border-zinc-800'
                                  : isSelected
                                  ? 'bg-theme-badge border-theme ring-1 ring-theme shadow-sm'
                                  : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div
                                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                    isSelected
                                      ? 'border-theme-accent bg-theme-accent'
                                      : 'border-zinc-700 bg-zinc-800'
                                  }`}
                                >
                                  {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-white block">{ai.name}</span>
                                  {isOutOfStock && (
                                    <span className="text-[10px] text-rose-400">Out of Stock</span>
                                  )}
                                </div>
                              </div>
                              <span className="text-xs font-mono font-bold text-theme-accent">
                                +₹{Number(ai.price || 0).toFixed(2)}
                              </span>
                            </div>
                          );
                        }

                        // Multiple choice with increment / decrement
                        return (
                          <div
                            key={ai.id}
                            className={`flex items-center justify-between p-2.5 rounded-xl border transition select-none ${
                              isOutOfStock
                                ? 'opacity-40 bg-zinc-900 border-zinc-800'
                                : isSelected
                                ? 'bg-theme-badge border-theme ring-1 ring-theme shadow-sm'
                                : 'bg-zinc-900/90 border-zinc-800 hover:border-zinc-700'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <button
                                type="button"
                                disabled={isOutOfStock}
                                onClick={() => handleUpdateMultipleQty(g, ai, isSelected ? -currentQty : 1)}
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border cursor-pointer ${
                                  isSelected
                                    ? 'border-theme-accent bg-theme-accent text-white'
                                    : 'border-zinc-700 bg-zinc-800'
                                }`}
                              >
                                {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                              </button>
                              <div>
                                <span className="text-xs font-bold text-white block">{ai.name}</span>
                                <span className="text-[10px] font-mono text-zinc-400">
                                  +₹{Number(ai.price || 0).toFixed(2)} each
                                </span>
                              </div>
                            </div>

                            {/* Quantity controls */}
                            <div className="flex items-center gap-1.5">
                              {isSelected ? (
                                <div className="flex items-center rounded-lg border border-zinc-800 bg-zinc-950 overflow-hidden">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateMultipleQty(g, ai, -1)}
                                    className="h-6 w-6 flex items-center justify-center text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                                  >
                                    <Minus className="h-3 w-3" />
                                  </button>
                                  <span className="w-6 text-center text-xs font-mono font-bold text-white">
                                    {currentQty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateMultipleQty(g, ai, 1)}
                                    className="h-6 w-6 flex items-center justify-center text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
                                  >
                                    <Plus className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isOutOfStock}
                                  onClick={() => handleUpdateMultipleQty(g, ai, 1)}
                                  className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 3. Validation Warnings (if required selections missing) */}
        {validationErrors.length > 0 && (
          <div className="px-5 py-2 bg-amber-950/70 border-t border-amber-900/60 text-xs text-amber-200 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
            <div className="truncate">
              <span>{validationErrors[0]}</span>
            </div>
          </div>
        )}

        {/* 4. Footer Breakdown & Action Buttons */}
        <div className="p-5 bg-zinc-950 border-t border-zinc-800 shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Real-time price breakdown */}
          <div className="flex flex-col">
            <div className="text-[11px] text-zinc-400 flex flex-wrap items-center gap-1 font-mono">
              <span>{product.name} (₹{baseUnitPrice})</span>
              {addonsPerUnitTotal > 0 && (
                <span>+ Extras (₹{addonsPerUnitTotal.toFixed(2)})</span>
              )}
              {productQuantity > 1 && (
                <span className="text-zinc-500">× {productQuantity}</span>
              )}
            </div>
            <div className="text-xl font-black font-mono text-white flex items-center gap-1">
              <span>Total:</span>
              <span className="text-theme-accent">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {/* Product Quantity Adjuster */}
            <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden mr-2">
              <button
                type="button"
                onClick={() =>
                  setProductQuantity((q) =>
                    Math.max(product.quantityStep || 1, q - (product.quantityStep || 1))
                  )
                }
                className="h-9 w-8 flex items-center justify-center text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-8 text-center text-xs font-mono font-bold text-white">
                {productQuantity}
              </span>
              <button
                type="button"
                onClick={() =>
                  setProductQuantity((q) => q + (product.quantityStep || 1))
                }
                className="h-9 w-8 flex items-center justify-center text-zinc-300 hover:bg-zinc-800 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={validationErrors.length > 0}
              onClick={handleConfirm}
              className="rounded-xl btn-theme-primary px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-95 transition cursor-pointer flex items-center gap-1.5"
            >
              <ShoppingCart className="h-3.5 w-3.5" />
              <span>Add to Cart (₹{grandTotal.toFixed(2)})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
