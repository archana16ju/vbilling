'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  RotateCcw,
  AlertTriangle,
  User,
  Phone,
  Receipt,
  UtensilsCrossed,
  Truck,
  CreditCard,
  Banknote,
  Wallet,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Sale } from '@/store/useTerminalStore';

interface RefundBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  isProcessing: boolean;
  onConfirmRefund: (sale: Sale, reason: string) => void;
}

const COMMON_REASONS = [
  'Customer Request',
  'Wrong Order / Items',
  'Item Quality Issue',
  'Order Cancelled',
  'Billing Error',
  'Other',
];

export default function RefundBillModal({
  isOpen,
  onClose,
  sale,
  isProcessing,
  onConfirmRefund,
}: RefundBillModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>('Customer Request');
  const [customReason, setCustomReason] = useState<string>('');

  useEffect(() => {
    if (sale) {
      setSelectedReason('Customer Request');
      setCustomReason('');
    }
  }, [sale]);

  if (!isOpen || !sale) return null;

  const total = Number(sale.total) || 0;
  const subtotal = Number(sale.subtotal) || 0;
  const discount = Number(sale.discount) || 0;
  const tax = Number(sale.tax) || 0;
  const cgst = sale.cgst !== undefined ? Number(sale.cgst) : tax / 2;
  const sgst = sale.sgst !== undefined ? Number(sale.sgst) : tax / 2;
  const roundOff = Number(sale.roundOff) || 0;

  const items = Array.isArray(sale.items) ? sale.items : [];
  const totalItemCount = items.reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0);

  const formattedDateTime = sale.timestamp
    ? new Date(sale.timestamp).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '-';

  const cashierName = sale.createdBy === 'admin' ? 'Superadmin' : (sale.createdBy || 'Cashier');
  const orderType = sale.orderType || 'Dine In';
  const customerName = sale.customerName || 'Walk-in Customer';
  const customerPhone = sale.customerPhone || '';

  const finalReason = selectedReason === 'Other' && customReason.trim()
    ? customReason.trim()
    : selectedReason;

  const handleRefund = () => {
    if (isProcessing) return;
    onConfirmRefund(sale, finalReason);
  };

  const getPaymentIcon = (method: string) => {
    switch (method?.toLowerCase()) {
      case 'cash':
        return <Banknote className="h-3.5 w-3.5 text-emerald-400" />;
      case 'card':
        return <CreditCard className="h-3.5 w-3.5 text-purple-400" />;
      case 'upi':
        return <Wallet className="h-3.5 w-3.5 text-cyan-400" />;
      default:
        return <Receipt className="h-3.5 w-3.5 text-zinc-400" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-zinc-900 text-white shadow-2xl border border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header */}
        <div className="p-5 pb-3 bg-zinc-950/70 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/30">
                <RotateCcw className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white tracking-tight font-mono">
                    #{sale.id}
                  </h2>
                  <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-950/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
                    Refund Review
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Verify customer and bill details before issuing refund
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="rounded-xl p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer disabled:opacity-40"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 no-scrollbar">
          {/* 2. Customer & Bill Meta Details Card */}
          <div className="grid grid-cols-2 gap-3 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-3.5 text-xs">
            {/* Customer */}
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Customer</div>
                <div className="font-bold text-white truncate">{customerName}</div>
                {customerPhone && (
                  <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5 font-mono">
                    <Phone className="h-2.5 w-2.5" />
                    <span>{customerPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Date & Time */}
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Date & Time</div>
                <div className="font-semibold text-zinc-200 text-[11px]">{formattedDateTime}</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Staff: <span className="text-zinc-300 font-medium">{cashierName}</span></div>
              </div>
            </div>

            {/* Order Type */}
            <div className="flex items-start gap-2.5 pt-2 border-t border-zinc-800/60">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {orderType === 'Delivery' ? (
                  <Truck className="h-3.5 w-3.5" />
                ) : (
                  <UtensilsCrossed className="h-3.5 w-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Order Type</div>
                <div className="font-bold text-white">{orderType}</div>
                {sale.tableName && (
                  <div className="text-[11px] text-pink-300 font-medium">{sale.tableName}</div>
                )}
              </div>
            </div>

            {/* Original Payment Method */}
            <div className="flex items-start gap-2.5 pt-2 border-t border-zinc-800/60">
              <div className="p-2 rounded-xl bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                {getPaymentIcon(sale.paymentMethod)}
              </div>
              <div className="min-w-0">
                <div className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Paid Via</div>
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>{sale.paymentMethod}</span>
                  <span className="text-[10px] font-bold text-emerald-400">✓ Paid</span>
                </div>
                {sale.amountReceived ? (
                  <div className="text-[11px] text-zinc-400 font-mono">
                    Recv: ₹{Number(sale.amountReceived).toFixed(2)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* 3. Items List */}
          <div className="rounded-2xl bg-zinc-950/40 border border-zinc-800/70 p-3.5">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2.5">
              <span>Items In Bill</span>
              <span className="text-zinc-500 font-mono">{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</span>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto no-scrollbar pr-1">
              {items.length === 0 ? (
                <div className="text-xs text-zinc-500 italic py-2">No item details available</div>
              ) : (
                items.map((item, idx) => {
                  const qty = Number(item.quantity) || 1;
                  const unitPrice = Number(item.product?.price) || 0;
                  const lineTotal = unitPrice * qty;

                  return (
                    <div key={idx} className="flex items-center justify-between gap-3 text-xs py-1 border-b border-zinc-800/40 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-5 w-5 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-[11px] font-bold text-zinc-200 shrink-0">
                          {qty}
                        </span>
                        <div className="min-w-0 truncate">
                          <span className="font-semibold text-zinc-200 truncate block">
                            {item.product?.name || 'Item'}
                          </span>
                          <span className="text-[10px] text-zinc-400 font-mono">
                            ₹{unitPrice.toFixed(2)} each
                          </span>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-white shrink-0">
                        ₹{lineTotal.toFixed(2)}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Financial Breakdown */}
          <div className="rounded-2xl bg-zinc-950/60 border border-zinc-800/80 p-3.5 text-xs space-y-1.5 text-zinc-400">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-mono text-zinc-200">₹{subtotal.toFixed(2)}</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between text-rose-400">
                <span>Discount</span>
                <span className="font-mono">-₹{discount.toFixed(2)}</span>
              </div>
            )}

            {tax > 0 && (
              <>
                <div className="flex justify-between">
                  <span>CGST</span>
                  <span className="font-mono text-zinc-200">₹{cgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST</span>
                  <span className="font-mono text-zinc-200">₹{sgst.toFixed(2)}</span>
                </div>
              </>
            )}

            {roundOff !== 0 && (
              <div className="flex justify-between">
                <span>Round Off</span>
                <span className="font-mono text-zinc-200">
                  {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
                </span>
              </div>
            )}

            <div className="border-t border-zinc-800 pt-2.5 mt-2 flex justify-between items-baseline">
              <div>
                <span className="text-sm font-bold text-white block">Refund Amount</span>
                <span className="text-[10px] text-zinc-400">Full invoice value to be returned</span>
              </div>
              <span className="text-2xl font-black text-rose-400 font-mono tracking-tight">
                ₹{total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* 5. Reason for Refund */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 block">
              Reason for Refund
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REASONS.map((reason) => {
                const isSelected = selectedReason === reason;
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSelectedReason(reason)}
                    className={`rounded-xl px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                      isSelected
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700/60 hover:text-white'
                    }`}
                  >
                    {reason}
                  </button>
                );
              })}
            </div>

            {selectedReason === 'Other' && (
              <input
                type="text"
                placeholder="Enter specific refund reason..."
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                className="w-full mt-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-rose-500 transition"
              />
            )}
          </div>

          {/* 6. Caution Alert */}
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/30 p-3 flex items-start gap-2.5 text-rose-200 text-xs">
            <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed">
              This action will mark Bill <span className="font-mono font-bold text-white">#{sale.id}</span> as <span className="font-bold text-rose-300">Refunded</span> and update the ledger. This cannot be undone.
            </div>
          </div>
        </div>

        {/* 7. Footer Action Buttons */}
        <div className="p-5 pt-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleRefund}
            disabled={isProcessing}
            className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-95 text-white py-3 px-5 text-sm font-bold shadow-lg shadow-rose-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className={`h-4 w-4 stroke-[2.5] ${isProcessing ? 'animate-spin' : ''}`} />
            <span>{isProcessing ? 'Processing Refund...' : `Confirm Refund ₹${total.toFixed(2)}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
