'use client';

import React, { useState, useEffect } from 'react';
import { X, Printer, IndianRupee, CreditCard, Banknote, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';
import { Sale } from '@/store/useTerminalStore';

interface SettlementBillModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  isProcessing: boolean;
  onSettle: (opts: {
    paymentMethod: string;
    amountReceived: number;
    changeReturned: number;
    isBillOnly?: boolean;
  }) => void;
  onPrint?: (sale: Sale) => void;
}

export default function SettlementBillModal({
  isOpen,
  onClose,
  sale,
  isProcessing,
  onSettle,
  onPrint,
}: SettlementBillModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<'Cash' | 'UPI' | 'Card'>('Cash');
  const [amountReceived, setAmountReceived] = useState<string>('');

  useEffect(() => {
    if (sale) {
      setSelectedMethod('Cash');
      setAmountReceived(Number(sale.total || 0).toFixed(2));
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

  // Time formatting
  const formattedTime = sale.timestamp
    ? new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  const cashierName = sale.createdBy === 'admin' ? 'Superadmin' : (sale.createdBy || 'Cashier');
  const orderType = sale.orderType || 'Dine In';

  const enteredCash = parseFloat(amountReceived) || total;
  const changeToGive = enteredCash > total ? enteredCash - total : 0;

  const handleConfirmSettle = () => {
    if (isProcessing) return;
    onSettle({
      paymentMethod: selectedMethod,
      amountReceived: selectedMethod === 'Cash' ? enteredCash : total,
      changeReturned: selectedMethod === 'Cash' ? changeToGive : 0,
      isBillOnly: false,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-zinc-900 text-white shadow-2xl border border-zinc-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header with Black Cherry Gradient accent */}
        <div className="p-5 pb-3 bg-zinc-950/60 border-b border-zinc-800">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="text-2xl font-black text-white tracking-tight font-mono">
                #{sale.id}
              </h2>
              {/* Status Badge */}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-950/60 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-300 shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                Unpaid
              </span>
            </div>

            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Subheader: Order Type · Item count · Time · Cashier */}
          <div className="mt-2 text-xs font-medium text-zinc-400 flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-theme-accent">{orderType}</span>
            <span>·</span>
            <span>{totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}</span>
            <span>·</span>
            <span>{formattedTime}</span>
            <span>·</span>
            <span className="text-zinc-300 font-medium">{cashierName}</span>
          </div>
        </div>

        {/* 2. Bill Items Section */}
        <div className="flex-1 overflow-y-auto px-5 py-3.5 no-scrollbar max-h-56">
          <div className="text-[11px] font-bold tracking-wider text-theme-accent uppercase mb-2.5">
            {totalItemCount} {totalItemCount === 1 ? 'ITEM' : 'ITEMS'} IN BILL
          </div>

          <div className="space-y-2.5">
            {items.length === 0 ? (
              <div className="text-xs text-zinc-500 italic py-2">No items listed</div>
            ) : (
              items.map((item, idx) => {
                const qty = Number(item.quantity) || 1;
                const unitPrice = Number(item.product?.price) || 0;
                const lineTotal = unitPrice * qty;

                return (
                  <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-5 w-5 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-[11px] font-bold text-zinc-200 shrink-0">
                        {qty}
                      </span>
                      <span className="font-semibold text-zinc-200 truncate">
                        {item.product?.name || 'Item'}
                      </span>
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

        {/* 3. Financial Breakdown */}
        <div className="px-5 py-3 text-xs space-y-1.5 text-zinc-400 bg-zinc-950/70 border-t border-zinc-800">
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

          <div className="flex justify-between">
            <span>CGST</span>
            <span className="font-mono text-zinc-200">₹{cgst.toFixed(2)}</span>
          </div>

          <div className="flex justify-between">
            <span>SGST</span>
            <span className="font-mono text-zinc-200">₹{sgst.toFixed(2)}</span>
          </div>

          {roundOff !== 0 && (
            <div className="flex justify-between">
              <span>Round Off</span>
              <span className="font-mono text-zinc-200">
                {roundOff > 0 ? `+₹${roundOff.toFixed(2)}` : `-₹${Math.abs(roundOff).toFixed(2)}`}
              </span>
            </div>
          )}

          {/* Solid Divider */}
          <div className="border-t border-zinc-800 pt-2.5 mt-2 flex justify-between items-baseline">
            <span className="text-base font-bold text-white">Total</span>
            <span className="text-2xl font-black text-theme-accent font-mono tracking-tight">
              ₹{total.toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] font-medium text-amber-400">
            <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
            <span>Nothing paid yet</span>
          </div>
        </div>

        {/* 4. Payment Method Selector */}
        <div className="px-5 py-3 border-t border-zinc-800 bg-zinc-900">
          <div className="text-[11px] font-bold uppercase tracking-wider text-theme-accent mb-2">
            Select Payment Method to Settle
          </div>

          {/* Payment method neon buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'Cash', label: 'Cash', icon: Banknote },
              { id: 'UPI', label: 'UPI', icon: Wallet },
              { id: 'Card', label: 'Card', icon: CreditCard },
            ].map(({ id, label, icon: Icon }) => {
              const isSelected = selectedMethod === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedMethod(id as any)}
                  className={`flex flex-col items-center justify-center py-2.5 px-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'border-theme bg-theme-bar text-white shadow-lg shadow-theme-glow font-bold'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 mb-1" />
                  <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Cash Payment Details */}
          {selectedMethod === 'Cash' && (
            <div className="mt-3 p-3 rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-between gap-3 text-xs animate-in fade-in duration-100">
              <span className="font-semibold text-zinc-300">Cash Received:</span>
              <div className="flex items-center gap-2">
                <span className="text-theme-accent font-bold">₹</span>
                <input
                  type="number"
                  step="any"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(e.target.value)}
                  className="w-24 rounded-lg border border-zinc-700 bg-zinc-900 px-2 py-1 text-right font-mono font-bold text-white outline-none focus:border-theme theme-input-focus"
                  placeholder={total.toFixed(2)}
                />
              </div>
              {changeToGive > 0 && (
                <div className="text-right text-[11px] font-bold text-emerald-400">
                  Change: ₹{changeToGive.toFixed(2)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Bottom Action Buttons with Neon Style */}
        <div className="p-5 pt-3 border-t border-zinc-800 bg-zinc-950/80 flex items-center gap-3">
          {onPrint && (
            <button
              type="button"
              onClick={() => onPrint(sale)}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white active:scale-95 transition cursor-pointer"
            >
              <Printer className="h-4 w-4 text-zinc-400" />
              <span>Print Bill</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirmSettle}
            disabled={isProcessing}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-95 text-white py-3 px-5 text-sm font-bold shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
            <span>{isProcessing ? 'Settling...' : `Settle ₹${total.toFixed(2)}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
