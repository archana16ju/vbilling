'use client';

import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';
import { generateReceiptHtml } from '@/lib/printSystem';
import { useTerminalStore, Sale } from "@/store/useTerminalStore";
import { 
  IndianRupee, 
  CreditCard, 
  Banknote, 
  Wallet, 
  Receipt, 
  X, 
  Printer, 
  Trash2,
  Shield,
  Building2,
  User as UserIcon,
  RefreshCw,
  RotateCcw,
  Truck,
  ExternalLink,
  UtensilsCrossed,
  Search,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { clearAllSales, getLiveSales, updateSalePayment, refundSale } from "@/lib/actions/db";
import SettlementBillModal from "@/components/sales/SettlementBillModal";
import RefundBillModal from "@/components/sales/RefundBillModal";
import { useShortcutsStore } from "@/store/useShortcutsStore";
import { useTableStore } from "@/store/useTableStore";

const formatShortDateTime = (timestamp?: number | string | Date) => {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${day}/${month}/${year}, ${hours}:${minutes} ${ampm}`;
};

export default function SalesPage() {
  const [mounted, setMounted] = useState(false);
  const printerDesign = usePrinterDesignStore();
  const { sales, clearSales, enableCashChange } = useTerminalStore();
  const shortcutsStore = useShortcutsStore();
  const showShortcutBadges = shortcutsStore.config.showKeysOnButtons;

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToSettle, setSaleToSettle] = useState<Sale | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [saleToRefund, setSaleToRefund] = useState<Sale | null>(null);
  const [isRefunding, setIsRefunding] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [liveSales, setLiveSales] = useState<Sale[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<'All' | 'Cash' | 'Card' | 'UPI' | 'Bill Only'>('All');
  const [sourceFilter, setSourceFilter] = useState<'All' | 'Terminal' | 'Zomato' | 'Swiggy' | 'Delivery'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadSales = async () => {
    setIsLoading(true);
    try {
      const res = await getLiveSales();
      if (Array.isArray(res)) {
        setLiveSales(res as Sale[]);
      }
    } catch (err) {
      console.error("Failed to load live sales:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);

    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = roleMatch ? roleMatch[2] : null;
    const normalizedRole = r === 'admin' ? 'company_admin' : r;
    if (normalizedRole) setCurrentRole(normalizedRole);

    const userMatch = document.cookie.match(/(^| )auth_username=([^;]+)/);
    if (userMatch) setCurrentUsername(userMatch[2]);

    // Fetch verified session to guarantee role and username are current
    fetch('/api/auth/me')
      .then(res => res.ok ? res.json() : null)
      .then(me => {
        if (me && me.authenticated) {
          if (me.role) {
            const roleNorm = me.role === 'admin' ? 'company_admin' : me.role;
            setCurrentRole(roleNorm);
          }
          if (me.username) setCurrentUsername(me.username);
        }
      })
      .catch(() => {});

    loadSales();
  }, []);

  const isSuperAdmin = currentRole === 'super_admin';
  const isCompanyAdmin = currentRole === 'company_admin';
  const isCashier = currentRole === 'cashier';

  // Merge live database sales with only PENDING offline sales from local store
  // (Prevents stale cached sales of other companies/roles from polluting this view)
  const allSalesMap = new Map<string, Sale>();
  liveSales.forEach((s) => allSalesMap.set((s as any)._id || `${s.id}-${s.timestamp}`, s));

  sales
    .filter((s) => s.syncStatus === 'PENDING_SYNC')
    .forEach((s) => {
      // If cashier, only show their pending sales
      if (isCashier && s.createdBy && currentUsername && s.createdBy !== currentUsername) {
        return;
      }
      allSalesMap.set((s as any)._id || `${s.id}-${s.timestamp}`, s);
    });

  const allSales = Array.from(allSalesMap.values()).sort((a, b) => (Number(b.timestamp) || 0) - (Number(a.timestamp) || 0));

  const filteredSales = allSales.filter((s) => {
    if (paymentFilter !== 'All' && s.paymentMethod !== paymentFilter) return false;
    if (sourceFilter === 'Terminal' && s.orderSource && s.orderSource !== 'Terminal') return false;
    if (sourceFilter === 'Zomato' && s.orderSource !== 'Zomato') return false;
    if (sourceFilter === 'Swiggy' && s.orderSource !== 'Swiggy') return false;
    if (sourceFilter === 'Delivery' && s.orderType !== 'Delivery') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const idMatch = (s.id || '').toLowerCase().includes(q);
      const custMatch =
        (s.customerName || '').toLowerCase().includes(q) ||
        (s.customerPhone || '').includes(q);
      const cashierMatch = (s.createdBy || '').toLowerCase().includes(q);
      const totalMatch = (s.total?.toString() || '').includes(q);
      if (!idMatch && !custMatch && !cashierMatch && !totalMatch) return false;
    }
    return true;
  });

  const handlePrint = (sale: Sale) => {
    const printWindow = window.open('', '_blank', 'width=340,height=700');
    if (printWindow) {
      printWindow.document.write(generateReceiptHtml(sale, printerDesign));
      printWindow.document.close();
    }
  };

  // Keyboard shortcut listener for Sales screen: Ctrl+F, ↑, ↓, Enter, Ctrl+P
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Search this screen: Ctrl + F
      if (shortcutsStore.isActionTriggered('screen_search', e)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (isInput) return;

      // Previous row: ↑
      if (shortcutsStore.isActionTriggered('screen_prev_row', e) || e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredSales.length > 0) {
          setSelectedRowIndex((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      // Next row: ↓
      if (shortcutsStore.isActionTriggered('screen_next_row', e) || e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredSales.length > 0) {
          setSelectedRowIndex((prev) => Math.min(filteredSales.length - 1, prev + 1));
        }
        return;
      }

      // Open selected row: Enter
      if (shortcutsStore.isActionTriggered('screen_open_row', e) || e.key === 'Enter') {
        e.preventDefault();
        if (filteredSales[selectedRowIndex]) {
          setSelectedSale(filteredSales[selectedRowIndex]);
        }
        return;
      }

      // Reprint selected bill: Ctrl + P
      if (shortcutsStore.isActionTriggered('screen_reprint', e)) {
        e.preventDefault();
        if (filteredSales[selectedRowIndex]) {
          handlePrint(filteredSales[selectedRowIndex]);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredSales, selectedRowIndex, shortcutsStore]);

  const totalSales = allSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const cashSales = allSales.filter((s) => s.paymentMethod === 'Cash').reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const cardSales = allSales.filter((s) => s.paymentMethod === 'Card').reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
  const upiSales = allSales.filter((s) => s.paymentMethod === 'UPI').reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);

  const handleSettleSale = async (opts: {
    paymentMethod: string;
    amountReceived: number;
    changeReturned: number;
    isBillOnly?: boolean;
  }) => {
    if (!saleToSettle) return;
    setIsSettling(true);
    try {
      const res = await updateSalePayment(
        saleToSettle.id,
        opts.paymentMethod,
        opts.amountReceived,
        opts.changeReturned
      );
      if (res && res.success) {
        useTerminalStore.getState().updateSalePayment(
          saleToSettle.id,
          opts.paymentMethod,
          opts.amountReceived,
          opts.changeReturned
        );
        if (saleToSettle.tableId) {
          useTableStore.getState().releaseTable(saleToSettle.tableId);
        }
        await loadSales();
        setToastMsg(`Bill #${saleToSettle.id} successfully settled with ${opts.paymentMethod}!`);
        setTimeout(() => setToastMsg(null), 3500);
        setSaleToSettle(null);
      } else {
        alert("Failed to settle bill: " + (res?.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error settling bill: " + e.message);
    } finally {
      setIsSettling(false);
    }
  };

  const handleConfirmRefund = async (sale: Sale, reason: string) => {
    setIsRefunding(true);
    try {
      const res = await refundSale(sale.id, reason);
      if (res && res.success) {
        if (useTerminalStore.getState().refundSale) {
          useTerminalStore.getState().refundSale(sale.id);
        }
        await loadSales();
        setToastMsg(`Bill #${sale.id} successfully refunded!`);
        setTimeout(() => setToastMsg(null), 3500);
        setSaleToRefund(null);
      } else {
        alert("Failed to refund bill: " + (res?.error || "Unknown error"));
      }
    } catch (e: any) {
      alert("Error refunding bill: " + (e?.message || "Unknown error"));
    } finally {
      setIsRefunding(false);
    }
  };

  return (
    <div>
      {toastMsg && (
        <div className="fixed top-6 right-6 z-50 rounded-xl bg-black text-white px-4 py-3 shadow-xl font-bold text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-4 border border-zinc-700">
          <span className="text-emerald-400">✓</span>
          <span>{toastMsg}</span>
        </div>
      )}
      <div className="mb-6 relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <Receipt className="h-6 w-6 text-pink-300" />
                Sales & Bills
              </h1>
              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-pink-400/30 bg-black/40 px-2.5 py-0.5 text-xs font-bold text-pink-200 uppercase tracking-wider">
                  <Shield className="h-3 w-3 text-pink-400" />
                  All Companies
                </span>
              ) : isCompanyAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-pink-400/30 bg-black/40 px-2.5 py-0.5 text-xs font-bold text-pink-200 uppercase tracking-wider">
                  <Building2 className="h-3 w-3 text-pink-400" />
                  Company Overview
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-pink-400/30 bg-black/40 px-2.5 py-0.5 text-xs font-bold text-pink-200 uppercase tracking-wider">
                  <UserIcon className="h-3 w-3 text-pink-400" />
                  My Transactions
                </span>
              )}
            </div>
            <p className="text-pink-100/70 text-xs mt-1">
              {isSuperAdmin
                ? 'Complete multi-company transaction log and billing registry.'
                : isCompanyAdmin
                ? 'All transactions, bills, and cashier records for your company.'
                : 'Your personal POS transactions and recent completed bills.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadSales}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-xl border border-pink-400/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/60 hover:text-white transition shadow-sm cursor-pointer"
              title="Refresh sales list"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {!isCashier && (
              <button
                onClick={async () => {
                  const confirmMsg = isSuperAdmin
                    ? "Are you sure you want to reset sales for the active company? This cannot be undone."
                    : "Are you sure you want to reset all sales for your company? This cannot be undone.";
                  if (!confirm(confirmMsg)) return;

                  setResetting(true);
                  try {
                    await clearAllSales();
                    clearSales();
                    await loadSales();
                  } catch (e) {
                    console.error("Failed to clear sales:", e);
                  } finally {
                    setResetting(false);
                  }
                }}
                disabled={resetting || allSales.length === 0}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-3.5 py-2 text-xs font-bold text-white hover:from-rose-500 hover:to-red-500 disabled:opacity-40 shadow-lg shadow-rose-600/30 transition cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {resetting ? "Resetting..." : "Reset All Sales"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Revenue" value={totalSales} icon={IndianRupee} color="blue" />
        <SummaryCard title="Cash Sales" value={cashSales} icon={Banknote} color="emerald" />
        <SummaryCard title="Card Sales" value={cardSales} icon={CreditCard} color="purple" />
        <SummaryCard title="UPI Sales" value={upiSales} icon={Wallet} color="orange" />
      </div>

      {/* Filter Section (Payment Method & Channel Filters beside each other with same button UI) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-y-3 gap-x-6">
          {/* Payment Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">
              Payment:
            </span>
            {(['All', 'Cash', 'Card', 'UPI', 'Bill Only'] as const).map((method) => {
              const isSelected = paymentFilter === method;
              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentFilter(method)}
                  className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isSelected
                      ? 'border-theme bg-theme-bar text-white shadow-md shadow-theme-glow'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  {method === 'Bill Only' ? '⚠️ Bill Only' : method}
                </button>
              );
            })}
          </div>

          <div className="hidden xl:block h-6 w-px bg-zinc-800" />

          {/* Channel Filter (Beside Payment with exact same button UI) */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider mr-1">
              Channel:
            </span>
            {(
              [
                { key: 'All', label: 'All' },
                { key: 'Terminal', label: 'Terminal / POS' },
                { key: 'Zomato', label: '🔴 Zomato' },
                { key: 'Swiggy', label: '🟠 Swiggy' },
                { key: 'Delivery', label: '🛵 Deliveries Only' },
              ] as const
            ).map((source) => {
              const isSelected = sourceFilter === source.key;
              return (
                <button
                  key={source.key}
                  type="button"
                  onClick={() => setSourceFilter(source.key as any)}
                  className={`rounded-xl border px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    isSelected
                      ? 'border-theme bg-theme-bar text-white shadow-md shadow-theme-glow'
                      : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:border-zinc-500 hover:text-white'
                  }`}
                >
                  {source.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search bills, customer, cashier..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedRowIndex(0);
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-1.5 pl-9 pr-16 text-xs text-white placeholder-zinc-500 outline-none focus:border-theme transition"
            />
            {showShortcutBadges && (
              <kbd className="absolute right-2 top-2 rounded bg-zinc-800 border border-zinc-700 px-1.5 py-0.5 text-[9px] font-mono text-zinc-400">
                {shortcutsStore.getActionDisplayKey('screen_search') || 'Ctrl+F'}
              </kbd>
            )}
          </div>

          <div className="text-xs font-semibold text-zinc-400 whitespace-nowrap">
            Showing <span className="text-pink-400 font-bold">{filteredSales.length}</span> of {allSales.length} bills
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-950/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-bold whitespace-nowrap">Bill ID</th>
              {isSuperAdmin && <th className="px-6 py-4 font-bold">Company</th>}
              <th className="px-6 py-4 font-bold">Cashier / Staff</th>
              <th className="px-6 py-4 font-bold whitespace-nowrap">Date & Time</th>
              <th className="px-6 py-4 font-bold">Items</th>
              <th className="px-6 py-4 font-bold">Type</th>
              <th className="px-6 py-4 font-bold">Payment Method</th>
              <th className="px-6 py-4 font-bold">Status</th>
              <th className="px-6 py-4 font-bold text-right">Total Amount</th>
              <th className="px-6 py-4 font-bold text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filteredSales.length === 0 ? (
              <tr>
                <td colSpan={isSuperAdmin ? 10 : 9} className="px-6 py-12 text-center text-zinc-500">
                  <Receipt className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
                  No sales found for the selected filter or search.
                </td>
              </tr>
            ) : (
              filteredSales.map((sale, index) => {
                const isSelected = selectedRowIndex === index;
                return (
                  <tr
                    key={`${sale.id}-${index}`}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-zinc-800/80 ring-1 ring-inset ring-pink-500/60'
                        : 'hover:bg-zinc-800/50'
                    }`}
                    onClick={() => {
                      setSelectedRowIndex(index);
                      setSelectedSale(sale);
                    }}
                  >
                  <td className="px-6 py-4 font-semibold text-white font-mono text-xs whitespace-nowrap">
                    <div>#{sale.id}</div>
                    {sale.onlineOrderId && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          sale.orderSource === 'Zomato'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                            : sale.orderSource === 'Swiggy'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                        }`}>
                          {sale.orderSource || 'Online'}
                        </span>
                        <span className="text-[10px] text-zinc-400 font-mono">
                          #{sale.onlineOrderId}
                        </span>
                      </div>
                    )}
                  </td>
                  {isSuperAdmin && (
                    <td className="px-6 py-4 text-xs font-medium text-zinc-300">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-zinc-200">
                        <Building2 className="h-3 w-3 text-pink-400" />
                        {sale.companyName || sale.companyId || 'company-1'}
                      </span>
                    </td>
                  )}
                  <td className="px-6 py-4 text-xs">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-950 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300">
                      <UserIcon className="h-3 w-3 text-pink-400" />
                      {(sale.createdBy === 'admin' ? 'superadmin' : sale.createdBy) || 'Cashier'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-400 whitespace-nowrap">
                    {formatShortDateTime(sale.timestamp)}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {(Array.isArray(sale.items) ? sale.items : []).reduce((sum, item) => sum + (Number(item?.quantity) || 0), 0)} items
                  </td>

                  {/* Type Column */}
                  <td className="px-6 py-4 text-xs">
                    <div>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-transparent ${
                          sale.orderType === 'Delivery'
                            ? 'border-pink-400 dark:border-pink-500/60 text-pink-600 dark:text-pink-400'
                            : sale.orderType === 'Takeaway'
                            ? 'border-amber-400 dark:border-amber-500/60 text-amber-700 dark:text-amber-400'
                            : 'border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {sale.orderType === 'Delivery' && <Truck className="h-3 w-3" />}
                        {sale.orderType || 'Dine In'}
                      </span>
                      {sale.tableName && (
                        <div className="text-[10px] text-zinc-300 mt-1 font-bold">
                          {sale.tableName}
                        </div>
                      )}
                      {sale.waiterName && (
                        <div className="text-[10px] text-indigo-400 font-semibold">
                          Server: {sale.waiterName}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Payment Method Column */}
                  <td className="px-6 py-4">
                    {sale.paymentMethod === 'Bill Only' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSaleToSettle(sale);
                        }}
                        className="inline-flex items-center rounded-full border border-amber-300 dark:border-amber-500/50 bg-amber-50 dark:bg-amber-950/50 px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/60 cursor-pointer shadow-sm active:scale-95 transition"
                        title="Click to Settle this bill"
                      >
                        ⚠️ Bill Only
                      </button>
                    ) : (
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                          sale.paymentMethod === 'Cash'
                            ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : sale.paymentMethod === 'Card'
                            ? 'border-purple-300 dark:border-purple-500/40 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400'
                            : sale.paymentMethod === 'UPI'
                            ? 'border-cyan-300 dark:border-cyan-500/40 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400'
                            : 'border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                        }`}
                      >
                        {sale.paymentMethod}
                      </span>
                    )}
                  </td>

                  {/* Status Column (Clean static status badge - Dropdown removed) */}
                  <td className="px-6 py-4">
                    {sale.orderType === 'Delivery' && sale.delivery?.deliveryStatus && sale.delivery.deliveryStatus !== 'delivered' ? (
                      <span
                        className={`inline-flex items-center rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider bg-transparent ${
                          sale.delivery.deliveryStatus === 'pending'
                            ? 'border-pink-400 dark:border-pink-500/60 text-pink-600 dark:text-pink-400'
                            : sale.delivery.deliveryStatus === 'cancelled'
                            ? 'border-rose-400 dark:border-rose-500/60 text-rose-600 dark:text-rose-400'
                            : 'border-pink-400 dark:border-pink-500/60 text-pink-600 dark:text-pink-400'
                        }`}
                      >
                        {sale.delivery.deliveryStatus.replace(/_/g, ' ')}
                      </span>
                    ) : sale.syncStatus === 'PENDING_SYNC' ? (
                      <span className="inline-flex items-center rounded-full border border-pink-400 dark:border-pink-500/60 text-pink-600 dark:text-pink-400 bg-transparent px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                        PENDING
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full border border-emerald-400 dark:border-emerald-500/60 text-emerald-600 dark:text-emerald-400 bg-transparent px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider">
                        COMPLETED
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-pink-300 font-mono text-base">
                    ₹{(Number(sale.total) || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {sale.paymentStatus === 'refunded' || (sale as any).payment_status === 'refunded' ? (
                        <span
                          className="inline-flex items-center gap-1 rounded-xl bg-rose-950/40 border border-rose-900/50 px-3 py-1.5 text-xs font-bold text-rose-400 cursor-not-allowed opacity-80"
                          title="This bill has already been refunded"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Refunded</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSaleToRefund(sale);
                          }}
                          className="inline-flex items-center gap-1 rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-1.5 text-xs font-bold text-rose-300 hover:bg-rose-950/60 hover:border-rose-700 hover:text-white transition cursor-pointer active:scale-95 shadow-sm"
                          title="Open refund review and details"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Refund</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })
          )}
          </tbody>
        </table>
      </div>

      {/* Bill Preview Thermal Receipt Popup */}
      {selectedSale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setSelectedSale(null)}
        >
          <div
            className="relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar text-white"
            style={{ width: '380px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close & Print buttons */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-bold text-white">Receipt Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePrint(selectedSale)}
                  className="flex items-center gap-1 rounded-xl btn-theme-primary px-3 py-1.5 text-xs font-bold text-white shadow-md cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="flex items-center justify-center rounded-xl bg-zinc-800 p-1.5 hover:bg-zinc-700 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Dine In Table & Waiter Info Banner */}
            {selectedSale.orderType === 'Dine In' && (selectedSale.tableName || selectedSale.waiterName) && (
              <div className="mb-3 rounded-xl border border-emerald-500/30 bg-emerald-950/60 p-3 text-xs text-emerald-200">
                <div className="font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-white">
                    <UtensilsCrossed className="h-4 w-4 text-emerald-400" />
                    {selectedSale.tableName || 'Dine-In Order'}
                  </span>
                  {selectedSale.servingStatus && (
                    <span className="capitalize font-mono text-[10px] px-2 py-0.5 bg-emerald-900 border border-emerald-400/30 rounded font-bold text-emerald-300">
                      {selectedSale.servingStatus}
                    </span>
                  )}
                </div>
                {selectedSale.waiterName && (
                  <div className="text-[11px] mt-1.5 text-emerald-300 flex items-center gap-1.5">
                    <span className="font-semibold text-zinc-400">Assigned Waiter:</span>
                    <span className="font-bold text-white">{selectedSale.waiterName}</span>
                  </div>
                )}
              </div>
            )}

            {/* Delivery Order Info Banner */}
            {selectedSale.orderType === 'Delivery' && (
              <div className="mb-3 rounded-xl border border-indigo-500/30 bg-indigo-950/60 p-3 text-xs text-indigo-200">
                <div className="font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-white">
                    <Truck className="h-4 w-4 text-indigo-400" />
                    Delivery Order
                  </span>
                  <span className="capitalize font-mono text-[10px] px-2 py-0.5 bg-indigo-900 border border-indigo-400/30 rounded font-bold text-indigo-300">
                    {selectedSale.delivery?.deliveryStatus
                      ? selectedSale.delivery.deliveryStatus.replace(/_/g, ' ')
                      : 'pending'}
                  </span>
                </div>
                {selectedSale.orderSource && selectedSale.orderSource !== 'Terminal' && (
                  <div className="text-[11px] mt-1.5 flex items-center gap-2">
                    <span className="font-semibold text-zinc-400">Platform:</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        selectedSale.orderSource === 'Zomato'
                          ? 'bg-red-900/60 text-red-300 border border-red-500/30'
                          : 'bg-orange-900/60 text-orange-300 border border-orange-500/30'
                      }`}
                    >
                      {selectedSale.orderSource}
                    </span>
                    {selectedSale.onlineOrderId && (
                      <span className="font-mono text-zinc-400 text-[10px]">
                        ID: #{selectedSale.onlineOrderId}
                      </span>
                    )}
                  </div>
                )}
                {selectedSale.delivery?.deliveryPersonName ? (
                  <div className="text-[11px] mt-1 text-indigo-300">
                    <span className="font-semibold text-zinc-400">Assigned Rider:</span>{' '}
                    {selectedSale.delivery.deliveryPersonName} (
                    {selectedSale.delivery.deliveryPersonPhone || 'N/A'})
                  </div>
                ) : (
                  <div className="text-[11px] mt-1 text-amber-400 font-medium">
                    Rider: Pending Assignment
                  </div>
                )}
                {selectedSale.delivery?.deliveryAddress && (
                  <div className="text-[11px] mt-0.5 text-zinc-300">
                    <span className="font-semibold text-zinc-400">Address:</span>{' '}
                    {selectedSale.delivery.deliveryAddress}
                  </div>
                )}
                {selectedSale.delivery?.deliveryNotes && (
                  <div className="text-[11px] mt-0.5 text-zinc-400 italic">
                    <span className="font-semibold not-italic text-zinc-400">Note:</span>{' '}
                    {selectedSale.delivery.deliveryNotes}
                  </div>
                )}
                {selectedSale.delivery?.trackingToken && (
                  <div className="mt-2.5 pt-2 border-t border-indigo-500/20 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-400">Live Customer Tracker:</span>
                    <a
                      href={`/delivery/track/${selectedSale.delivery.trackingToken}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold transition shadow-sm"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Open Tracker
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Thermal Receipt Preview */}
            <div
              className="bg-white overflow-hidden rounded-xl shadow-inner"
              style={{ width: '80mm', minHeight: '300px', margin: '0 auto', border: '1px solid #3f3f46' }}
            >
              <iframe
                title="Receipt Preview"
                srcDoc={generateReceiptHtml(selectedSale, printerDesign)}
                className="w-full h-full border-0"
                style={{ minHeight: '400px' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Redesigned Settlement Bill Overlay */}
      {saleToSettle && (
        <SettlementBillModal
          isOpen={!!saleToSettle}
          onClose={() => setSaleToSettle(null)}
          sale={saleToSettle}
          isProcessing={isSettling}
          onSettle={handleSettleSale}
          onPrint={handlePrint}
        />
      )}

      {/* Refund Bill Overlay */}
      {saleToRefund && (
        <RefundBillModal
          isOpen={!!saleToRefund}
          onClose={() => setSaleToRefund(null)}
          sale={saleToRefund}
          isProcessing={isRefunding}
          onConfirmRefund={handleConfirmRefund}
        />
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-pink-950/60 text-pink-400 border border-pink-500/30 shadow-pink-500/10",
    emerald: "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-emerald-500/10",
    purple: "bg-purple-950/60 text-purple-400 border border-purple-500/30 shadow-purple-500/10",
    orange: "bg-cyan-950/60 text-cyan-400 border border-cyan-500/30 shadow-cyan-500/10",
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
      <div className="flex items-center gap-4">
        <div className={`rounded-xl p-3 ${colorMap[color] || colorMap.blue}`}>
          <Icon className="h-6 w-6 stroke-[2.2]" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
          <p className="text-2xl font-black text-white font-mono mt-0.5">₹{(Number(value) || 0).toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}
