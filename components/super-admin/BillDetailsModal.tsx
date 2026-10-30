'use client';

import React from 'react';
import { X, Receipt, Building2, User, Phone, Calendar, Clock, DollarSign, Printer, CheckCircle2 } from 'lucide-react';

interface BillItem {
  product?: {
    id?: string;
    name?: string;
    sku?: string;
    price?: number;
    tax?: number;
    unit?: string;
    categoryName?: string;
  };
  product_name?: string;
  name?: string;
  sku?: string;
  unit?: string;
  price?: number;
  unit_price?: number;
  quantity?: number;
  qty?: number;
  tax?: number;
  total?: number;
}

interface BillData {
  id: string;
  bill_number?: string;
  company_id?: string;
  company_name?: string;
  created_at?: string;
  customer_name?: string;
  customer_phone?: string;
  order_type?: string;
  payment_method?: string;
  payment_status?: string;
  created_by?: string;
  subtotal?: number;
  discount?: number;
  tax?: number;
  round_off?: number;
  total?: number;
  items?: BillItem[];
}

interface BillDetailsModalProps {
  bill: BillData | null;
  currencySymbol?: string;
  onClose: () => void;
}

export default function BillDetailsModal({
  bill,
  currencySymbol = '₹',
  onClose,
}: BillDetailsModalProps) {
  if (!bill) return null;

  const items = Array.isArray(bill.items) ? bill.items : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl bg-zinc-950 border border-zinc-800 text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/80 bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-500/10 text-pink-400 border border-pink-500/20">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  Bill #{bill.bill_number || bill.id}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" />
                  {bill.payment_status || 'Paid'}
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-zinc-500" />
                  {bill.company_name || 'Store'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-zinc-500" />
                  {bill.created_at ? new Date(bill.created_at).toLocaleString() : 'N/A'}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3 py-1.5 text-xs font-bold text-zinc-200 transition cursor-pointer"
              title="Print Receipt"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-0.5">
                Customer
              </span>
              <span className="font-bold text-zinc-200 block truncate">
                {bill.customer_name || 'Walk-in Customer'}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {bill.customer_phone || 'No phone'}
              </span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-0.5">
                Channel & Type
              </span>
              <span className="font-bold text-indigo-400 block truncate">
                {bill.order_type || 'Dine In'}
              </span>
              <span className="text-[10px] text-zinc-400">Order Channel</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-0.5">
                Payment Method
              </span>
              <span className="font-bold text-emerald-400 block truncate">
                {bill.payment_method || 'Cash'}
              </span>
              <span className="text-[10px] text-zinc-400">Settled Full</span>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-0.5">
                Billed By
              </span>
              <span className="font-bold text-zinc-200 block truncate">
                {bill.created_by || 'Cashier'}
              </span>
              <span className="text-[10px] text-zinc-400">Terminal Staff</span>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/70 font-bold uppercase text-[10px] tracking-wider text-zinc-400">
              Purchased Items ({items.length})
            </div>
            {items.length === 0 ? (
              <div className="p-6 text-center text-zinc-500">
                No individual item details stored in bill record.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/50 text-[10px] font-bold uppercase text-zinc-500 border-b border-zinc-800/60">
                  <tr>
                    <th className="px-4 py-2.5">Item Name</th>
                    <th className="px-4 py-2.5 text-center">Qty</th>
                    <th className="px-4 py-2.5 text-right">Price</th>
                    <th className="px-4 py-2.5 text-right">Tax</th>
                    <th className="px-4 py-2.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {items.map((it, idx) => {
                    const prod = it.product || it;
                    const name = prod.name || it.product_name || it.name || `Item #${idx + 1}`;
                    const qty = Number(it.quantity ?? it.qty ?? 1);
                    const pr = Number(prod.price ?? it.price ?? it.unit_price ?? 0);
                    const taxRate = Number(prod.tax ?? it.tax ?? 0);
                    const lineTotal = Number(it.total ?? (qty * pr));

                    return (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-white">{name}</div>
                          {prod.sku && <div className="text-[10px] text-zinc-500 font-mono">SKU: {prod.sku}</div>}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono font-bold text-zinc-300">
                          {qty} {prod.unit || ''}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-300">
                          {currencySymbol}{pr.toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono text-zinc-400">
                          {taxRate > 0 ? `${taxRate}%` : '0%'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                          {currencySymbol}{lineTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Totals Breakdown */}
          <div className="flex justify-end">
            <div className="w-full sm:w-72 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-2 text-xs">
              <div className="flex justify-between text-zinc-400">
                <span>Subtotal:</span>
                <span className="font-mono text-zinc-200">
                  {currencySymbol}{(Number(bill.subtotal) || 0).toFixed(2)}
                </span>
              </div>
              {Number(bill.discount) > 0 && (
                <div className="flex justify-between text-pink-400">
                  <span>Discount:</span>
                  <span className="font-mono">
                    -{currencySymbol}{(Number(bill.discount) || 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-zinc-400">
                <span>Taxes & GST:</span>
                <span className="font-mono text-zinc-200">
                  {currencySymbol}{(Number(bill.tax) || 0).toFixed(2)}
                </span>
              </div>
              {Number(bill.round_off) !== 0 && bill.round_off !== undefined && (
                <div className="flex justify-between text-zinc-500">
                  <span>Round Off:</span>
                  <span className="font-mono">
                    {Number(bill.round_off) > 0 ? '+' : ''}{currencySymbol}{(Number(bill.round_off) || 0).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="border-t border-zinc-800 pt-2 flex justify-between font-black text-sm text-white">
                <span>Grand Total:</span>
                <span className="font-mono text-emerald-400 text-base">
                  {currencySymbol}{(Number(bill.total) || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-zinc-500">
            Read-only bill inspection mode. Records cannot be altered.
          </span>
          <button
            onClick={onClose}
            className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
