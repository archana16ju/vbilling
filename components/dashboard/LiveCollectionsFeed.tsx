'use client';

import React, { useState } from 'react';
import {
  Receipt,
  Search,
  ExternalLink,
  Banknote,
  QrCode,
  CreditCard,
  Clock,
  Globe,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';

export interface RecentBillItem {
  id: string;
  billNumber: string;
  customerName: string;
  itemsCount: number;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  createdBy: string;
  createdAt: string;
  orderType: string;
}

interface LiveCollectionsFeedProps {
  bills: RecentBillItem[];
  currencySymbol?: string;
}

export default function LiveCollectionsFeed({
  bills = [],
  currencySymbol = '₹',
}: LiveCollectionsFeedProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredBills = bills.filter((b) => {
    const q = searchTerm.toLowerCase();
    return (
      b.billNumber.toLowerCase().includes(q) ||
      b.customerName.toLowerCase().includes(q) ||
      b.createdBy.toLowerCase().includes(q) ||
      b.paymentMethod.toLowerCase().includes(q)
    );
  });

  const getPaymentBadge = (method: string) => {
    const m = method.toLowerCase();
    if (m === 'cash') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/70">
          <Banknote className="h-3 w-3" />
          Cash
        </span>
      );
    }
    if (m === 'upi') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-800/70">
          <QrCode className="h-3 w-3" />
          UPI
        </span>
      );
    }
    if (m === 'card') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-800/70">
          <CreditCard className="h-3 w-3" />
          Card
        </span>
      );
    }
    if (m.includes('bill') || m.includes('credit')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/70">
          <Clock className="h-3 w-3" />
          Bill Only
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-950/60 text-pink-300 border border-pink-800/70">
        <Globe className="h-3 w-3" />
        {method}
      </span>
    );
  };

  const formatTime = (isoString: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '-';
    }
  };

  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col justify-between">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-pink-500/10 text-pink-400 border border-pink-500/20">
            <Receipt className="h-4 w-4" />
          </span>
          <div>
            <h3 className="text-base font-black text-white tracking-tight">
              Live Transactions & Collection Feed
            </h3>
            <p className="text-xs text-zinc-400">Real-time ledger of latest customer receipts</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search bill or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-40 sm:w-56 rounded-xl border border-zinc-800 bg-zinc-950/80 pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 outline-none focus:border-theme transition"
            />
          </div>

          <Link
            href="/sales"
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-300 transition cursor-pointer"
          >
            <span>All Sales</span>
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto no-scrollbar">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
              <th className="py-2.5 px-3 rounded-l-lg">Bill No</th>
              <th className="py-2.5 px-3">Time</th>
              <th className="py-2.5 px-3">Customer</th>
              <th className="py-2.5 px-3">Items</th>
              <th className="py-2.5 px-3">Payment</th>
              <th className="py-2.5 px-3">Processed By</th>
              <th className="py-2.5 px-3 text-right">Amount</th>
              <th className="py-2.5 px-3 text-center rounded-r-lg">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50">
            {filteredBills.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-500 font-medium">
                  {searchTerm ? 'No matching bills found' : 'No transactions recorded in this period'}
                </td>
              </tr>
            ) : (
              filteredBills.map((b) => (
                <tr key={b.id} className="hover:bg-zinc-800/30 transition">
                  <td className="py-2.5 px-3 font-mono font-bold text-white">
                    {b.billNumber}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 font-mono text-[11px]">
                    {formatTime(b.createdAt)}
                  </td>
                  <td className="py-2.5 px-3 font-medium text-zinc-200 truncate max-w-[140px]">
                    {b.customerName}
                  </td>
                  <td className="py-2.5 px-3 text-zinc-400 font-mono">
                    {b.itemsCount} {b.itemsCount === 1 ? 'item' : 'items'}
                  </td>
                  <td className="py-2.5 px-3">
                    {getPaymentBadge(b.paymentMethod)}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="font-medium text-zinc-300 flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                      {b.createdBy}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                    {currencySymbol}{b.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {b.paymentStatus === 'paid' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400">
                        <AlertCircle className="h-3 w-3" />
                        {b.paymentStatus}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
