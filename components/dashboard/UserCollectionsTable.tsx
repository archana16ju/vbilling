'use client';

import React from 'react';
import {
  Users,
  ShieldCheck,
  UserCheck,
  Banknote,
  QrCode,
  CreditCard,
  Clock,
  ArrowRight,
  TrendingUp,
  CircleDollarSign,
  CheckCircle2,
  XCircle,
  ChefHat,
  UtensilsCrossed,
  Globe,
} from 'lucide-react';

export interface UserStatsItem {
  id: string;
  username: string;
  name: string;
  role: 'super_admin' | 'company_admin' | 'manager' | 'cashier' | 'chef' | 'waiter' | string;
  totalBills: number;
  totalCollections: number;
  avgBill: number;
  paymentSplit: {
    cash: number;
    upi: number;
    card: number;
    billOnly: number;
    online: number;
    other: number;
  };
  percentShare: number;
  lastActive?: string;
}

interface UserCollectionsTableProps {
  usersList: UserStatsItem[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
  currencySymbol?: string;
  companyTotal?: number;
}

export default function UserCollectionsTable({
  usersList = [],
  selectedUserId = 'all',
  onSelectUser,
  currencySymbol = '₹',
  companyTotal = 0,
}: UserCollectionsTableProps) {
  return (
    <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 sm:p-6 backdrop-blur-xl shadow-2xl overflow-hidden flex flex-col justify-between">
      {/* Background ambient glow */}
      <div 
        className="absolute -right-12 -bottom-12 h-44 w-44 rounded-full blur-3xl pointer-events-none opacity-15"
        style={{ backgroundColor: '#06B6D4' }}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 relative z-10">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Users className="h-4 w-4 text-theme-accent" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black text-white tracking-tight">
                Staff & User Collections Report
              </h3>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 text-[10px] font-mono font-bold text-zinc-300">
                {usersList.length} {usersList.length === 1 ? 'User' : 'Users'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Individual cashier & admin collections ledger with payment splits
            </p>
          </div>
        </div>

        {selectedUserId !== 'all' && (
          <button
            onClick={() => onSelectUser('all')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 border border-zinc-700 transition cursor-pointer self-start sm:self-auto"
          >
            <XCircle className="h-3.5 w-3.5 text-zinc-400" />
            <span>Reset to All Users</span>
          </button>
        )}
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto no-scrollbar relative z-10">
        <table className="w-full text-left text-xs text-zinc-300">
          <thead>
            <tr className="border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-950/40">
              <th className="py-3 px-4 rounded-l-xl">User / Cashier</th>
              <th className="py-3 px-3">Role</th>
              <th className="py-3 px-3 text-right">Bills</th>
              <th className="py-3 px-3 text-right">Cash ({currencySymbol})</th>
              <th className="py-3 px-3 text-right">UPI ({currencySymbol})</th>
              <th className="py-3 px-3 text-right">Card ({currencySymbol})</th>
              <th className="py-3 px-3 text-right">Credit / Bill Only</th>
              <th className="py-3 px-4 text-right font-black text-white">Total Collected</th>
              <th className="py-3 px-3 text-right">Avg Ticket</th>
              <th className="py-3 px-3 text-center">Share</th>
              <th className="py-3 px-4 text-right rounded-r-xl">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {usersList.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-8 text-center text-zinc-500 font-medium">
                  No user activity recorded in this selected period
                </td>
              </tr>
            ) : (
              usersList.map((user) => {
                const isSelected = selectedUserId.toLowerCase() === user.username.toLowerCase();
                const normRole = (user.role || '').toLowerCase().trim();
                const isSuperAdmin = normRole === 'super_admin';
                const isAdmin = normRole === 'company_admin' || normRole === 'admin';
                const isManager = normRole === 'manager';
                const isChef = normRole === 'chef';
                const isWaiter = normRole === 'waiter';
                const isOnline = normRole === 'online';
                const hasSales = user.totalBills > 0;

                return (
                  <tr
                    key={user.id}
                    className={`transition-all duration-150 ${
                      isSelected
                        ? 'bg-zinc-800/90 font-semibold ring-1 ring-emerald-500/40'
                        : 'hover:bg-zinc-800/40'
                    }`}
                  >
                    {/* User Identity */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-black text-xs ${
                          isSuperAdmin || isAdmin 
                            ? 'bg-theme-bar border border-theme text-white shadow-theme-glow' 
                            : isManager
                            ? 'bg-purple-950/80 border border-purple-700/60 text-purple-300'
                            : isChef
                            ? 'bg-amber-950/80 border border-amber-700/60 text-amber-300'
                            : isWaiter
                            ? 'bg-emerald-950/80 border border-emerald-700/60 text-emerald-300'
                            : isOnline
                            ? 'bg-indigo-950/80 border border-indigo-700/60 text-indigo-300'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}>
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white block">
                            {user.name}
                          </span>
                          <span className="text-[10px] text-zinc-500 font-mono block">
                            @{user.username}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Role Badge */}
                    <td className="py-3.5 px-3">
                      {isSuperAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-950/60 text-rose-300 border border-rose-800/70">
                          <ShieldCheck className="h-3 w-3" />
                          Super Admin
                        </span>
                      ) : isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black theme-badge border border-theme">
                          <ShieldCheck className="h-3 w-3" />
                          Admin
                        </span>
                      ) : isManager ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-950/60 text-purple-300 border border-purple-800/70">
                          <UserCheck className="h-3 w-3" />
                          Manager
                        </span>
                      ) : isChef ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/70">
                          <ChefHat className="h-3 w-3" />
                          Chef
                        </span>
                      ) : isWaiter ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950/60 text-emerald-300 border border-emerald-800/70">
                          <UtensilsCrossed className="h-3 w-3" />
                          Waiter
                        </span>
                      ) : isOnline ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950/60 text-indigo-300 border border-indigo-800/70">
                          <Globe className="h-3 w-3" />
                          Online API
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/60 text-cyan-300 border border-cyan-800/70">
                          <UserCheck className="h-3 w-3" />
                          Cashier
                        </span>
                      )}
                    </td>

                    {/* Bills Count */}
                    <td className="py-3.5 px-3 text-right font-mono font-bold text-zinc-200">
                      {user.totalBills}
                    </td>

                    {/* Cash */}
                    <td className="py-3.5 px-3 text-right font-mono text-emerald-400">
                      {user.paymentSplit.cash > 0 ? `${currencySymbol}${user.paymentSplit.cash.toLocaleString('en-IN')}` : '-'}
                    </td>

                    {/* UPI */}
                    <td className="py-3.5 px-3 text-right font-mono text-purple-400">
                      {user.paymentSplit.upi > 0 ? `${currencySymbol}${user.paymentSplit.upi.toLocaleString('en-IN')}` : '-'}
                    </td>

                    {/* Card */}
                    <td className="py-3.5 px-3 text-right font-mono text-cyan-400">
                      {user.paymentSplit.card > 0 ? `${currencySymbol}${user.paymentSplit.card.toLocaleString('en-IN')}` : '-'}
                    </td>

                    {/* Credit / Bill Only */}
                    <td className="py-3.5 px-3 text-right font-mono text-amber-400">
                      {user.paymentSplit.billOnly > 0 ? `${currencySymbol}${user.paymentSplit.billOnly.toLocaleString('en-IN')}` : '-'}
                    </td>

                    {/* Total Invoiced */}
                    <td className="py-3.5 px-4 text-right font-mono font-black text-sm text-white">
                      {currencySymbol}{user.totalCollections.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>

                    {/* Avg Ticket */}
                    <td className="py-3.5 px-3 text-right font-mono text-zinc-400">
                      {user.totalBills > 0 ? `${currencySymbol}${user.avgBill.toLocaleString('en-IN')}` : '-'}
                    </td>

                    {/* Share */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="font-mono text-[10px] font-bold text-zinc-300">
                          {user.percentShare}%
                        </span>
                        <div className="w-14 bg-zinc-800 rounded-full h-1 overflow-hidden">
                          <div
                            className="h-full bg-emerald-400 rounded-full"
                            style={{ width: `${Math.min(user.percentShare, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Action Button */}
                    <td className="py-3.5 px-4 text-right">
                      {isSelected ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold">
                          <CheckCircle2 className="h-3 w-3" />
                          Active View
                        </span>
                      ) : (
                        <button
                          onClick={() => onSelectUser(user.username)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-300 border border-zinc-700 text-[11px] font-bold transition cursor-pointer active:scale-95"
                          title={`Filter dashboard to ${user.name}`}
                        >
                          <span>User View</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
