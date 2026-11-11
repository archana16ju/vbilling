'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Search,
  Plus,
  Download,
  Upload,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  Edit2,
  Trash2,
  ShoppingBag,
  Receipt,
  CheckCircle2,
  AlertCircle,
  X,
  FileSpreadsheet,
  ChevronRight,
  FileText,
  RefreshCw,
  Award,
  Crown,
  Coins,
  Sparkles,
  Sliders,
} from 'lucide-react';
import { CustomerWithStats } from '@/lib/mysql-billing';
import { useTerminalStore } from '@/store/useTerminalStore';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import {
  getLoyaltySettings,
  saveLoyaltySettings,
  getCustomerLoyaltyHistory,
} from '@/lib/actions/loyalty';
import { LoyaltySettings, DEFAULT_LOYALTY_SETTINGS, LoyaltyTransaction } from '@/types/loyalty';

export default function CustomersPage() {
  const router = useRouter();
  const setSelectedCustomer = useTerminalStore((state) => state.setSelectedCustomer);
  const shortcutsStore = useShortcutsStore();
  const showShortcutBadges = shortcutsStore.config.showKeysOnButtons;

  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerOrders, setSelectedCustomerOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerWithStats | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCountryCode, setFormCountryCode] = useState('+91');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // CSV Import state
  const [csvText, setCsvText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  // Loyalty Program state
  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null);
  const [isLoyaltyModalOpen, setIsLoyaltyModalOpen] = useState(false);
  const [loyaltyForm, setLoyaltyForm] = useState<LoyaltySettings>({
    companyId: '',
    isEnabled: true,
    pointsPerAmount: 100,
    amountPerPoint: 1.0,
    minPointsToRedeem: 50,
    maxRedeemPercentPerBill: 50,
    minBillAmountToEarn: 100,
    silverThreshold: 0,
    goldThreshold: 500,
    platinumThreshold: 1500,
    silverMultiplier: 1.0,
    goldMultiplier: 1.25,
    platinumMultiplier: 1.5,
    expiryMonths: 12,
    updatedAt: Date.now(),
  });
  const [isSavingLoyalty, setIsSavingLoyalty] = useState(false);
  const [loyaltySaveMsg, setLoyaltySaveMsg] = useState<string | null>(null);
  const [loyaltyHistory, setLoyaltyHistory] = useState<LoyaltyTransaction[]>([]);
  const [isLoadingLoyalty, setIsLoadingLoyalty] = useState(false);
  const [detailTab, setDetailTab] = useState<'details' | 'loyalty' | 'orders'>('details');

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl + F or '/' to focus search bar, and Arrow keys to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((shortcutsStore.isActionTriggered('screen_search', e) || e.key === '/') && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (isInput) return;

      if (shortcutsStore.isActionTriggered('screen_next_row', e) || e.key === 'ArrowDown') {
        e.preventDefault();
        if (customers.length > 0) {
          const curIdx = customers.findIndex((c) => c.id === selectedCustomerId);
          const nextIdx = Math.min(customers.length - 1, curIdx + 1);
          setSelectedCustomerId(customers[nextIdx].id);
        }
        return;
      }

      if (shortcutsStore.isActionTriggered('screen_prev_row', e) || e.key === 'ArrowUp') {
        e.preventDefault();
        if (customers.length > 0) {
          const curIdx = customers.findIndex((c) => c.id === selectedCustomerId);
          const prevIdx = Math.max(0, curIdx - 1);
          setSelectedCustomerId(customers[prevIdx].id);
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [customers, selectedCustomerId, shortcutsStore]);

  const fetchCustomers = async (maintainSelectedId?: string) => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/customers?stats=true');
      if (res.ok) {
        const data: CustomerWithStats[] = await res.json();
        setCustomers(data);
        if (data.length > 0) {
          const targetId = maintainSelectedId || selectedCustomerId || data[0].id;
          const exists = data.some((c) => c.id === targetId);
          setSelectedCustomerId(exists ? targetId : data[0].id);
        } else {
          setSelectedCustomerId(null);
        }
      }
    } catch (err) {
      console.error('Failed to fetch customers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchCustomers(selectedCustomerId || undefined);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    fetchCustomers();
    // Load loyalty settings
    getLoyaltySettings()
      .then((settings) => {
        if (settings) {
          setLoyaltySettings(settings);
          setLoyaltyForm(settings);
        }
      })
      .catch((err) => console.error('Failed to load loyalty settings:', err));
  }, []);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  // Fetch recent orders & loyalty history whenever the selected customer changes
  useEffect(() => {
    if (!selectedCustomer) {
      setSelectedCustomerOrders([]);
      setLoyaltyHistory([]);
      return;
    }

    const fetchOrders = async () => {
      try {
        setIsLoadingOrders(true);
        const params = new URLSearchParams();
        params.set('orders', 'true');
        if (selectedCustomer.name) params.set('name', selectedCustomer.name);
        if (selectedCustomer.phone) params.set('phone', selectedCustomer.phone);

        const res = await fetch(`/api/customers?${params.toString()}`);
        if (res.ok) {
          const orders = await res.json();
          setSelectedCustomerOrders(orders);
        }
      } catch (err) {
        console.error('Failed to load customer orders:', err);
      } finally {
        setIsLoadingOrders(false);
      }
    };

    const fetchLoyalty = async () => {
      try {
        setIsLoadingLoyalty(true);
        const history = await getCustomerLoyaltyHistory(selectedCustomer.id);
        setLoyaltyHistory(history);
      } catch (err) {
        console.error('Failed to load customer loyalty history:', err);
      } finally {
        setIsLoadingLoyalty(false);
      }
    };

    fetchOrders();
    fetchLoyalty();
  }, [selectedCustomerId]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setFormName('');
    setFormCountryCode('+91');
    setFormPhone('');
    setFormEmail('');
    setFormAddress('');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: CustomerWithStats) => {
    setEditingCustomer(c);
    setFormName(c.name);
    // Parse phone and code
    let phone = c.phone || '';
    let code = '+91';
    if (phone.startsWith('+')) {
      const parts = phone.split(' ');
      if (parts.length > 1) {
        code = parts[0];
        phone = parts.slice(1).join(' ');
      }
    }
    setFormCountryCode(code);
    setFormPhone(phone);
    setFormEmail(c.email || '');
    setFormAddress(c.address || '');
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formName.trim()) {
      setFormError('Customer name is required');
      return;
    }

    const fullPhone = formPhone.trim()
      ? `${formCountryCode.trim()} ${formPhone.trim()}`
      : undefined;

    setIsSaving(true);
    try {
      const method = editingCustomer ? 'PUT' : 'POST';
      const payload: any = {
        name: formName.trim(),
        phone: fullPhone,
        email: formEmail.trim() || undefined,
        address: formAddress.trim() || undefined,
      };
      if (editingCustomer) {
        payload.id = editingCustomer.id;
      }

      const res = await fetch('/api/customers', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setFormError(data.error || 'Failed to save customer');
      } else {
        setIsAddModalOpen(false);
        const newSelectedId = editingCustomer ? editingCustomer.id : data.customer?.id;
        await fetchCustomers(newSelectedId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Error occurred while saving');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCustomer = async (c: CustomerWithStats) => {
    if (!confirm(`Are you sure you want to delete customer "${c.name}"?`)) return;

    try {
      const res = await fetch(`/api/customers?id=${c.id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchCustomers();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (customers.length === 0) {
      alert('No customer data to export.');
      return;
    }

    const headers = ['Name', 'Phone', 'Email', 'Address', 'Visits', 'Total Spent', 'Avg Bill', 'Last Visit'];
    const rows = customers.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      `"${(c.address || '').replace(/"/g, '""')}"`,
      c.visits,
      c.totalSpent,
      c.avgBill,
      c.lastVisit ? new Date(c.lastVisit).toLocaleDateString() : '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import parser
  const handleImportCSVSubmit = async () => {
    if (!csvText.trim()) return;
    setIsImporting(true);
    setImportStatus(null);

    try {
      const lines = csvText.split('\n').map((l) => l.trim()).filter(Boolean);
      let importedCount = 0;

      for (let i = 0; i < lines.length; i++) {
        // Skip header if line has 'name' or 'phone'
        if (i === 0 && (lines[i].toLowerCase().includes('name') || lines[i].toLowerCase().includes('guest'))) {
          continue;
        }

        const cols = lines[i].split(',').map((c) => c.replace(/^["']|["']$/g, '').trim());
        const name = cols[0];
        const phone = cols[1];
        const email = cols[2];
        const address = cols[3];

        if (name) {
          await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone, email, address }),
          });
          importedCount++;
        }
      }

      setImportStatus(`Successfully imported ${importedCount} customers!`);
      setTimeout(() => {
        setIsImportModalOpen(false);
        setCsvText('');
        setImportStatus(null);
        fetchCustomers();
      }, 1500);
    } catch (err: any) {
      setImportStatus(`Import failed: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveLoyaltySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingLoyalty(true);
    setLoyaltySaveMsg(null);
    try {
      const updated = await saveLoyaltySettings(loyaltyForm);
      setLoyaltySettings(updated);
      setLoyaltySaveMsg('Loyalty rules updated successfully!');
      setTimeout(() => {
        setLoyaltySaveMsg(null);
        setIsLoyaltyModalOpen(false);
      }, 1200);
    } catch (err: any) {
      setLoyaltySaveMsg(`Failed to save: ${err.message}`);
    } finally {
      setIsSavingLoyalty(false);
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  // Calculate monthly stats
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const visitedThisMonth = customers.filter((c) => {
    if (!c.lastVisit) return false;
    const vDate = new Date(c.lastVisit);
    return vDate.getMonth() === currentMonth && vDate.getFullYear() === currentYear;
  }).length;

  const formatDate = (ts?: number) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const formatJoinedDate = (ts?: number) => {
    if (!ts) return 'since recently';
    const d = new Date(ts);
    return `since ${d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  };

  const handleStartNewOrder = (cust: CustomerWithStats) => {
    setSelectedCustomer({
      id: cust.id,
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      address: cust.address,
    });
    router.push('/terminal');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] space-y-4">
      {/* Dynamic Theme Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-5 text-white shadow-xl shrink-0 border border-theme">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-pink-300 shadow-inner">
              <Users className="h-6 w-6 text-pink-300" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Guests Directory
              </h1>
              <p className="text-xs font-medium text-pink-100/80">
                {customers.length} guests · {visitedThisMonth} visited this month
              </p>
            </div>
          </div>

          {/* Search bar with shortcut hint */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-pink-200/70" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search name or phone number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/20 bg-black/40 pl-10 pr-10 py-2 text-xs text-white placeholder:text-pink-200/60 focus:border-pink-400 focus:bg-black/60 focus:outline-none transition shadow-inner backdrop-blur-md"
            />
            <span className="absolute right-3.5 top-2 text-[10px] font-mono text-pink-300 bg-white/10 px-1.5 py-0.5 rounded border border-white/10">
              /
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setIsLoyaltyModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/20 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/30 transition cursor-pointer shadow-sm shadow-amber-900/30"
              title="Configure Customer Loyalty & Rewards"
            >
              <Award className="h-3.5 w-3.5 text-amber-300" />
              Loyalty Rules
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/30 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-white hover:bg-black/50 transition cursor-pointer disabled:opacity-50"
              title="Refresh guests"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin text-pink-300" : "text-zinc-200"}`} />
              Refresh
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/30 backdrop-blur-md px-3.5 py-2 text-xs font-bold text-white hover:bg-black/50 transition cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-pink-300" />
              Export
            </button>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add guest
            </button>
          </div>
        </div>
      </div>

      {/* Master-Detail Split Screen Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 overflow-hidden min-h-0">
        {/* Left Panel: Guests Table (7 cols on large screens) */}
        <div className="lg:col-span-7 bg-zinc-900/80 rounded-2xl border border-zinc-800 shadow-xl flex flex-col overflow-hidden backdrop-blur-sm">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-5 py-3 border-b border-zinc-800 text-[11px] font-bold text-zinc-400 uppercase tracking-wider bg-zinc-950/80">
            <div className="col-span-4">GUEST</div>
            <div className="col-span-2">TIER & POINTS</div>
            <div className="col-span-2">PHONE</div>
            <div className="col-span-1 text-center">VISITS</div>
            <div className="col-span-1 text-center">LAST VISIT</div>
            <div className="col-span-2 text-right">SPENT</div>
          </div>

          {/* Table Rows List */}
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/60 no-scrollbar">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-sm animate-pulse">
                <span>Loading guests...</span>
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-zinc-500 text-sm">
                <User className="h-8 w-8 mb-2 opacity-30" />
                <span>No guests found matching your search.</span>
              </div>
            ) : (
              filteredCustomers.map((cust) => {
                const isSelected = cust.id === selectedCustomerId;
                return (
                  <div
                    key={cust.id}
                    onClick={() => setSelectedCustomerId(cust.id)}
                    className={`grid grid-cols-12 items-center px-5 py-3.5 cursor-pointer transition ${
                      isSelected
                        ? 'bg-pink-950/30 border-l-4 border-l-pink-500 text-white'
                        : 'hover:bg-zinc-800/40 text-zinc-300'
                    }`}
                  >
                    {/* Guest Avatar & Name */}
                    <div className="col-span-4 flex items-center gap-3 min-w-0 pr-2">
                      <div
                        className={`h-9 w-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs uppercase ${
                          isSelected
                            ? 'bg-theme-gradient text-white shadow-md shadow-theme-glow'
                            : 'bg-zinc-800 text-theme-accent border border-zinc-700'
                        }`}
                      >
                        {cust.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-white truncate">
                          {cust.name}
                        </p>
                        {cust.email && (
                          <p className="text-xs text-zinc-500 truncate">
                            {cust.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Loyalty Tier & Points */}
                    <div className="col-span-2 flex flex-col items-start gap-0.5 pr-2">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
                        cust.loyaltyTier === 'Platinum'
                          ? 'bg-purple-950/80 text-purple-300 border border-purple-700/60'
                          : cust.loyaltyTier === 'Gold'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                            : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                      }`}>
                        {cust.loyaltyTier === 'Platinum' ? <Crown className="h-2.5 w-2.5 text-purple-400" /> : cust.loyaltyTier === 'Gold' ? <Award className="h-2.5 w-2.5 text-amber-400" /> : <Sparkles className="h-2.5 w-2.5 text-zinc-400" />}
                        {cust.loyaltyTier || 'Silver'}
                      </span>
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {Number(cust.loyaltyPointsBalance || 0).toLocaleString()} pts
                      </span>
                    </div>

                    {/* Phone */}
                    <div className="col-span-2 text-xs text-zinc-400 font-mono truncate">
                      {cust.phone || '-'}
                    </div>

                    {/* Visits count */}
                    <div className="col-span-1 text-center text-xs font-bold text-zinc-200">
                      {cust.visits}
                    </div>

                    {/* Last Visit date */}
                    <div className="col-span-1 text-center text-xs text-zinc-400 whitespace-nowrap">
                      {formatDate(cust.lastVisit)}
                    </div>

                    {/* Spent */}
                    <div className="col-span-2 text-right text-xs font-bold font-mono text-pink-400">
                      ₹{cust.totalSpent.toFixed(2)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Panel: Selected Guest Details (5 cols on large screens) */}
        <div className="lg:col-span-5 bg-zinc-900/80 rounded-2xl border border-zinc-800 shadow-xl flex flex-col overflow-hidden backdrop-blur-sm text-white">
          {!selectedCustomer ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
              <div className="h-16 w-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center mb-4 text-zinc-400">
                <User className="h-8 w-8" />
              </div>
              <h3 className="text-base font-bold text-white">Pick a guest</h3>
              <p className="text-xs text-zinc-400 max-w-xs mt-1">
                Their visits, address and recent bills show here. Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-pink-300 font-mono">/</kbd> to search.
              </p>
            </div>
          ) : (
            /* Active Customer Detail View */
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              {/* Profile Header */}
              <div className="p-5 border-b border-zinc-800">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <div className="h-12 w-12 rounded-2xl bg-theme-gradient flex items-center justify-center font-bold text-base text-white uppercase shadow-md shadow-theme-glow">
                      {selectedCustomer.name.charAt(0)}
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white leading-tight">
                        {selectedCustomer.name}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 mt-0.5">
                        <span className="font-mono">{selectedCustomer.phone || 'No phone'}</span>
                        <span>·</span>
                        <span>{formatJoinedDate(selectedCustomer.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit(selectedCustomer)}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteCustomer(selectedCustomer)}
                      className="p-2 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete guest"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 4 Metric Cards */}
                <div className="grid grid-cols-4 gap-2 mt-4">
                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center">
                    <span className="block text-lg font-bold text-pink-400 font-mono">
                      {selectedCustomer.visits}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">visits</span>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center">
                    <span className="block text-lg font-bold text-white font-mono">
                      ₹{selectedCustomer.avgBill.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">avg bill</span>
                  </div>

                  <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-2.5 text-center">
                    <span className="block text-lg font-bold text-emerald-400 font-mono">
                      ₹{selectedCustomer.totalSpent.toFixed(0)}
                    </span>
                    <span className="text-[10px] text-zinc-400 font-medium">total spent</span>
                  </div>

                  <div className="rounded-xl border border-amber-900/50 bg-amber-950/30 p-2.5 text-center">
                    <span className="block text-lg font-bold text-amber-300 font-mono">
                      {Number(selectedCustomer.loyaltyPointsBalance || 0).toLocaleString()}
                    </span>
                    <span className="text-[10px] text-amber-200/80 font-medium flex items-center justify-center gap-1">
                      <Award className="h-2.5 w-2.5 text-amber-400" />
                      {selectedCustomer.loyaltyTier || 'Silver'}
                    </span>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex border-b border-zinc-800/80 mt-4 -mb-1 gap-1">
                  <button
                    onClick={() => setDetailTab('details')}
                    className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                      detailTab === 'details'
                        ? 'border-pink-500 text-white'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setDetailTab('loyalty')}
                    className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-1.5 cursor-pointer ${
                      detailTab === 'loyalty'
                        ? 'border-amber-500 text-amber-300'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Award className="h-3 w-3 text-amber-400" />
                    Loyalty ({loyaltyHistory.length})
                  </button>
                  <button
                    onClick={() => setDetailTab('orders')}
                    className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                      detailTab === 'orders'
                        ? 'border-pink-500 text-white'
                        : 'border-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Orders ({selectedCustomerOrders.length})
                  </button>
                </div>
              </div>

              {/* Scrollable details: Address, Meal Plans, Recent Orders, Loyalty Ledger */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
                {detailTab === 'loyalty' ? (
                  /* LOYALTY LEDGER TAB */
                  <div className="space-y-4">
                    {/* Tier and Points Summary Card */}
                    <div className="rounded-2xl border border-amber-900/60 bg-gradient-to-br from-amber-950/40 via-zinc-900/80 to-zinc-950 p-4 shadow-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            {selectedCustomer.loyaltyTier === 'Platinum' ? <Crown className="h-5 w-5" /> : <Award className="h-5 w-5" />}
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400/80 block">Current Tier</span>
                            <span className="text-base font-black text-white">{selectedCustomer.loyaltyTier || 'Silver'} Member</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 block">Balance Value</span>
                          <span className="text-sm font-mono font-black text-amber-300">
                            ≈ ₹{((Number(selectedCustomer.loyaltyPointsBalance || 0)) * (loyaltySettings?.amountPerPoint || 1)).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-amber-900/40 text-xs">
                        <div className="bg-zinc-950/60 rounded-xl p-2 text-center border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">Lifetime Earned</span>
                          <span className="font-mono font-bold text-emerald-400">+{Number(selectedCustomer.totalPointsEarned || 0).toLocaleString()} pts</span>
                        </div>
                        <div className="bg-zinc-950/60 rounded-xl p-2 text-center border border-zinc-800">
                          <span className="text-[10px] text-zinc-400 block">Total Redeemed</span>
                          <span className="font-mono font-bold text-rose-400">-{Number(selectedCustomer.totalPointsRedeemed || 0).toLocaleString()} pts</span>
                        </div>
                      </div>
                    </div>

                    {/* Transaction History */}
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2 flex items-center justify-between">
                        <span>Points Activity Ledger</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{loyaltyHistory.length} entries</span>
                      </h4>

                      {isLoadingLoyalty ? (
                        <div className="py-6 text-center text-xs text-zinc-500 animate-pulse">Loading points ledger...</div>
                      ) : loyaltyHistory.length === 0 ? (
                        <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/40 text-center text-xs text-zinc-500">
                          No loyalty points transactions yet. Points will be automatically credited on completed bills!
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {loyaltyHistory.map((tx) => {
                            const isPositive = tx.points >= 0;
                            return (
                              <div
                                key={tx.id}
                                className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 transition"
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                      tx.type === 'earned'
                                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                                        : tx.type === 'redeemed'
                                          ? 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                                          : 'bg-zinc-800 text-zinc-300'
                                    }`}>
                                      {tx.type}
                                    </span>
                                    {tx.saleId && (
                                      <span className="font-mono text-[11px] text-zinc-400">Bill #{tx.saleId}</span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-zinc-500 mt-1">
                                    {formatDate(tx.createdAt)} {tx.note ? `· ${tx.note}` : ''}
                                  </div>
                                </div>

                                <div className="text-right">
                                  <span className={`font-mono text-xs font-black block ${
                                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                                  }`}>
                                    {isPositive ? '+' : ''}{tx.points} pts
                                  </span>
                                  <span className="text-[10px] text-zinc-500 font-mono">
                                    Bal: {tx.balanceAfter} pts
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ) : detailTab === 'orders' ? (
                  /* ORDERS TAB */
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      RECENT ORDERS
                    </h4>
                    {isLoadingOrders ? (
                      <div className="py-4 text-center text-xs text-zinc-500 animate-pulse">
                        Loading recent bills...
                      </div>
                    ) : selectedCustomerOrders.length === 0 ? (
                      <p className="text-xs text-zinc-500 py-2">No past orders recorded yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedCustomerOrders.map((order: any) => {
                          const itemCount = Array.isArray(order.items) ? order.items.length : 0;
                          const isPaid = order.paymentStatus !== 'unpaid' && order.paymentStatus !== 'cancelled';
                          return (
                            <div
                              key={order.id}
                              className="flex items-center justify-between p-2.5 rounded-xl border border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 transition"
                            >
                              <div>
                                <span className="font-mono text-xs font-bold text-white block">
                                  #{order.billNumber || order.id}
                                </span>
                                <span className="text-[11px] text-zinc-400">
                                  {formatDate(order.timestamp)} · {itemCount} {itemCount === 1 ? 'item' : 'items'}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    isPaid
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  {isPaid ? 'Paid' : 'Unpaid'}
                                </span>
                                <span className="font-mono text-xs font-bold text-pink-400 min-w-[60px] text-right">
                                  ₹{Number(order.total || 0).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  /* OVERVIEW & ADDRESS TAB */
                  <>
                    {/* ADDRESS SECTION */}
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
                        ADDRESS
                      </h4>
                      {selectedCustomer.address ? (
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex items-start gap-2.5">
                          <MapPin className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
                          <div className="flex-1 text-xs text-zinc-300 leading-relaxed whitespace-pre-line">
                            {selectedCustomer.address}
                          </div>
                          <button
                            onClick={() => handleOpenEdit(selectedCustomer)}
                            className="text-xs font-bold text-pink-400 hover:underline shrink-0 cursor-pointer"
                          >
                            Edit
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleOpenEdit(selectedCustomer)}
                          className="text-xs font-bold text-pink-400 hover:text-pink-300 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          + Add a delivery address
                        </button>
                      )}
                    </div>

                    {/* MEAL PLANS / NOTES SECTION */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                          MEAL PLANS
                        </h4>
                        <span className="text-xs font-bold text-pink-400 hover:underline cursor-pointer">
                          + Sell a plan
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">No plan on this guest.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Sticky Footer Actions */}
              <div className="p-4 border-t border-zinc-800 bg-zinc-900 grid grid-cols-2 gap-3 shrink-0">
                <button
                  onClick={() => router.push('/sales')}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition text-center cursor-pointer"
                >
                  Order history
                </button>
                <button
                  onClick={() => handleStartNewOrder(selectedCustomer)}
                  className="rounded-xl btn-theme-primary py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition text-center cursor-pointer"
                >
                  New order
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Guest Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black text-white">
                {editingCustomer ? 'Edit guest' : 'Add guest'}
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-3.5">
              {formError && (
                <div className="rounded-xl bg-rose-500/15 p-2.5 text-xs text-rose-400 border border-rose-500/30">
                  {formError}
                </div>
              )}

              {/* NAME */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  NAME
                </label>
                <input
                  required
                  type="text"
                  placeholder="Guest name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  autoFocus
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                />
              </div>

              {/* CODE & PHONE */}
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-4">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    CODE
                  </label>
                  <input
                    type="text"
                    value={formCountryCode}
                    onChange={(e) => setFormCountryCode(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white text-center focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div className="col-span-8">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    PHONE
                  </label>
                  <input
                    type="text"
                    placeholder="98400 12345"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* EMAIL */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  EMAIL <span className="text-zinc-500 font-normal lowercase">· optional</span>
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                />
              </div>

              {/* DELIVERY ADDRESS */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  DELIVERY ADDRESS <span className="text-zinc-500 font-normal lowercase">· optional</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="14, 2nd Cross St, T. Nagar&#10;Landmark: opposite the park"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-xs text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSaving ? 'Saving...' : editingCustomer ? 'Save changes' : 'Add guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-600 text-white shadow-md shadow-pink-900/40">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Import Guests via CSV</h3>
                  <p className="text-xs text-zinc-400">Paste your customer CSV rows below</p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-zinc-400">
                Format: <code>Name, Phone, Email, Address</code> (one guest per row)
              </p>
              <textarea
                rows={6}
                placeholder={`Karthik Raja, +91 98844 55667, karthik@example.com, Chennai\nLakshmi Narayanan, +91 98400 11223, lakshmi@example.com, Bangalore`}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
              />

              {importStatus && (
                <div className="rounded-xl bg-emerald-500/15 p-2.5 text-xs text-emerald-400 border border-emerald-500/30">
                  {importStatus}
                </div>
              )}

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting || !csvText.trim()}
                  onClick={handleImportCSVSubmit}
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {isImporting ? 'Importing...' : 'Upload & Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loyalty Program Rules Modal */}
      {isLoyaltyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150 no-scrollbar">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Award className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Loyalty & Rewards Configuration</h3>
                  <p className="text-xs text-zinc-400">Rules for point accumulation, tiers and checkout redemption</p>
                </div>
              </div>
              <button
                onClick={() => setIsLoyaltyModalOpen(false)}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoyaltySettings} className="mt-4 space-y-4">
              {/* Program Enabled Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <div>
                  <span className="text-xs font-bold text-white block">Enable Loyalty Program</span>
                  <span className="text-[11px] text-zinc-400">Award points automatically during checkout</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={loyaltyForm.isEnabled}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, isEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {/* Core Earning & Redemption Rates */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Points Earning Rate
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-400">₹</span>
                    <input
                      type="number"
                      min={1}
                      value={loyaltyForm.pointsPerAmount}
                      onChange={(e) => setLoyaltyForm({ ...loyaltyForm, pointsPerAmount: Number(e.target.value) || 100 })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400 whitespace-nowrap">= 1 pt</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Spend ₹100 to get 1 point</span>
                </div>

                <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Redemption Value
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-400 whitespace-nowrap">1 pt = ₹</span>
                    <input
                      type="number"
                      step="0.1"
                      min={0.1}
                      value={loyaltyForm.amountPerPoint}
                      onChange={(e) => setLoyaltyForm({ ...loyaltyForm, amountPerPoint: Number(e.target.value) || 1 })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-1 block">Each point gives ₹1.00 discount</span>
                </div>
              </div>

              {/* Thresholds & Bill Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Min Points to Redeem
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={loyaltyForm.minPointsToRedeem}
                    onChange={(e) => setLoyaltyForm({ ...loyaltyForm, minPointsToRedeem: Number(e.target.value) || 0 })}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Max Redeem % per Bill
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={loyaltyForm.maxRedeemPercentPerBill}
                      onChange={(e) => setLoyaltyForm({ ...loyaltyForm, maxRedeemPercentPerBill: Number(e.target.value) || 50 })}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-2 text-xs text-zinc-500">%</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Min Bill to Earn
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-zinc-500">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={loyaltyForm.minBillAmountToEarn}
                      onChange={(e) => setLoyaltyForm({ ...loyaltyForm, minBillAmountToEarn: Number(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-6 pr-3 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Membership Tier Thresholds & Multipliers */}
              <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
                <span className="text-xs font-bold text-white block flex items-center gap-1.5">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  Membership Tiers & Earning Multipliers
                </span>

                <div className="grid grid-cols-3 gap-2.5 text-xs">
                  {/* Silver */}
                  <div className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-900/60">
                    <span className="font-bold text-zinc-300 block mb-1.5">Silver Tier</span>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase">Min Points</span>
                        <input
                          type="number"
                          value={loyaltyForm.silverThreshold}
                          onChange={(e) => setLoyaltyForm({ ...loyaltyForm, silverThreshold: Number(e.target.value) || 0 })}
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-zinc-300"
                        />
                      </div>
                      <div>
                        <span className="text-zinc-500 block text-[9px] uppercase">Multiplier</span>
                        <input
                          type="number"
                          step="0.05"
                          value={loyaltyForm.silverMultiplier}
                          onChange={(e) => setLoyaltyForm({ ...loyaltyForm, silverMultiplier: Number(e.target.value) || 1 })}
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-zinc-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Gold */}
                  <div className="p-2.5 rounded-xl border border-amber-900/40 bg-amber-950/20">
                    <span className="font-bold text-amber-300 block mb-1.5">Gold Tier</span>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-amber-400/70 block text-[9px] uppercase">Min Points</span>
                        <input
                          type="number"
                          value={loyaltyForm.goldThreshold}
                          onChange={(e) => setLoyaltyForm({ ...loyaltyForm, goldThreshold: Number(e.target.value) || 500 })}
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-amber-300"
                        />
                      </div>
                      <div>
                        <span className="text-amber-400/70 block text-[9px] uppercase">Multiplier</span>
                        <input
                          type="number"
                          step="0.05"
                          value={loyaltyForm.goldMultiplier}
                          onChange={(e) => setLoyaltyForm({ ...loyaltyForm, goldMultiplier: Number(e.target.value) || 1.25 })}
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-amber-300"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Platinum */}
                  <div className="p-2.5 rounded-xl border border-purple-900/40 bg-purple-950/20">
                    <span className="font-bold text-purple-300 block mb-1.5">Platinum Tier</span>
                    <div className="space-y-1.5 text-[11px]">
                      <div>
                        <span className="text-purple-400/70 block text-[9px] uppercase">Min Points</span>
                        <input
                          type="number"
                          value={loyaltyForm.platinumThreshold}
                          onChange={(e) => setLoyaltyForm({ ...loyaltyForm, platinumThreshold: Number(e.target.value) || 1500 })}
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-purple-300"
                        />
                      </div>
                      <div>
                        <span className="text-purple-400/70 block text-[9px] uppercase">Multiplier</span>
                        <input
                          type="number"
                          step="0.05"
                          value={loyaltyForm.platinumMultiplier}
                          onChange={(e) => setLoyaltyForm({ ...loyaltyForm, platinumMultiplier: Number(e.target.value) || 1.5 })}
                          className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs font-mono text-purple-300"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {loyaltySaveMsg && (
                <div className={`rounded-xl p-2.5 text-xs border ${
                  loyaltySaveMsg.includes('Failed')
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                }`}>
                  {loyaltySaveMsg}
                </div>
              )}

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsLoyaltyModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingLoyalty}
                  className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2 text-xs font-black text-zinc-950 shadow-lg active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSavingLoyalty ? 'Saving...' : 'Save Loyalty Rules'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
