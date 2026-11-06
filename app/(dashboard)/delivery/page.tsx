'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import {
  Truck,
  MessageCircle,
  Navigation,
  Eye,
  Users,
  UserPlus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PackageCheck,
  Search,
  Filter,
  RefreshCw,
  Phone,
  MapPin,
  ChevronRight,
  Shield,
  MoreVertical,
  Check,
  X,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Power,
  RotateCw,
  Globe,
  Copy,
  ExternalLink,
  ChefHat,
  Bike,
  Package,
  Settings,
  Zap,
  Play,
  Pencil,
  Trash2,
  Banknote,
  QrCode,
  CreditCard
} from 'lucide-react';
import { Delivery, DeliveryPerson, DeliveryStatus, AvailabilityStatus, OnlineOrderConfig } from '@/types/delivery';

export default function DeliveryManagementPage() {
  const shortcutsStore = useShortcutsStore();
  const showShortcutBadges = shortcutsStore.config.showKeysOnButtons;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedDeliveryIndex, setSelectedDeliveryIndex] = useState(0);

  const [activeTab, setActiveTab] = useState<
    'all' | 'unassigned' | 'assigned' | 'preparing' | 'ready_for_pickup' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled'
  >('all');
  const [subView, setSubView] = useState<'deliveries' | 'staff' | 'online_apis'>('deliveries');

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [staff, setStaff] = useState<DeliveryPerson[]>([]);
  const [onlineConfigs, setOnlineConfigs] = useState<OnlineOrderConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);
  const [viewingOrderItems, setViewingOrderItems] = useState<Delivery | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Modals
  const [isAddStaffModalOpen, setIsAddStaffModalOpen] = useState(false);
  const [assigningDelivery, setAssigningDelivery] = useState<Delivery | null>(null);
  const [statusUpdateDelivery, setStatusUpdateDelivery] = useState<Delivery | null>(null);
  const [statusNotes, setStatusNotes] = useState('');
  const [editingConfig, setEditingConfig] = useState<OnlineOrderConfig | null>(null);
  const [isSimulatingOrder, setIsSimulatingOrder] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  const handleCollectPayment = async (delivery: Delivery, method: 'Cash' | 'UPI' | 'Card') => {
    if (!delivery.billId) {
      showToast('Error: No Bill ID associated with this delivery order.');
      return;
    }
    setIsProcessingPayment(true);
    try {
      const res = await fetch('/api/db/updateSalePayment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billId: delivery.billId,
          paymentMethod: method,
          cashReceived: delivery.totalAmount || 0,
          changeReturned: 0,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        showToast(data.error || 'Failed to update payment status');
      } else {
        showToast(`Payment of ₹${(delivery.totalAmount || 0).toFixed(2)} received via ${method}`);
        setViewingOrderItems((prev) =>
          prev
            ? {
                ...prev,
                paymentStatus: 'paid',
                paymentMethod: method,
              }
            : null
        );
        loadData(true);
      }
    } catch (err: any) {
      console.error('handleCollectPayment error:', err);
      showToast(err.message || 'Error processing payment');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Form states for adding delivery staff
  const [staffName, setStaffName] = useState('');
  const [staffEmployeeId, setStaffEmployeeId] = useState('');
  const [staffPhone, setStaffPhone] = useState('');
  const [staffMaxActive, setStaffMaxActive] = useState('3');
  const [isSubmittingStaff, setIsSubmittingStaff] = useState(false);
  const [staffFormError, setStaffFormError] = useState('');

  // Form states for editing delivery staff
  const [editingStaff, setEditingStaff] = useState<DeliveryPerson | null>(null);
  const [editStaffName, setEditStaffName] = useState('');
  const [editStaffEmployeeId, setEditStaffEmployeeId] = useState('');
  const [editStaffPhone, setEditStaffPhone] = useState('');
  const [editStaffMaxActive, setEditStaffMaxActive] = useState('3');
  const [isSubmittingEditStaff, setIsSubmittingEditStaff] = useState(false);
  const [editStaffError, setEditStaffError] = useState('');

  // Form states for online config
  const [configStoreId, setConfigStoreId] = useState('');
  const [configApiKey, setConfigApiKey] = useState('');
  const [configApiSecret, setConfigApiSecret] = useState('');
  const [configWebhookSecret, setConfigWebhookSecret] = useState('');
  const [configAutoAccept, setConfigAutoAccept] = useState(true);
  const [configIsEnabled, setConfigIsEnabled] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const [delRes, staffRes, confRes] = await Promise.all([
        fetch('/api/delivery'),
        fetch('/api/delivery-persons'),
        fetch('/api/online-orders/config'),
      ]);

      if (delRes.ok) {
        const dData = await delRes.json();
        if (Array.isArray(dData)) setDeliveries(dData);
      }
      if (staffRes.ok) {
        const sData = await staffRes.json();
        if (Array.isArray(sData)) setStaff(sData);
      }
      if (confRes.ok) {
        const cData = await confRes.json();
        if (Array.isArray(cData)) setOnlineConfigs(cData);
      }
    } catch (err: any) {
      console.error('Failed to load delivery data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Close search overlay on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    if (isSearchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSearchOpen]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me && me.authenticated) {
          setCurrentUserRole(me.role);
          setCurrentUsername(me.username);
        }
      })
      .catch(() => {});
  }, []);

  const isDeliveryStaff = currentUserRole === 'delivery_staff';

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(true), 12000); // Polling every 12s
    const handleCompanySwitched = () => {
      loadData(true);
    };
    window.addEventListener('company-switched', handleCompanySwitched);
    return () => {
      clearInterval(interval);
      window.removeEventListener('company-switched', handleCompanySwitched);
    };
  }, []);

  // Staff edit
  const handleSaveEditStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    setEditStaffError('');
    setIsSubmittingEditStaff(true);

    try {
      const res = await fetch('/api/delivery-persons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingStaff.id,
          name: editStaffName.trim(),
          employeeId: editStaffEmployeeId.trim(),
          phone: editStaffPhone.trim(),
          maxActiveDeliveries: Number(editStaffMaxActive) || 3,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setEditStaffError(data.error || 'Failed to update delivery staff');
      } else {
        showToast(`Delivery staff "${editStaffName}" updated successfully`);
        setEditingStaff(null);
        loadData(true);
      }
    } catch (err: any) {
      setEditStaffError(err.message || 'Error updating delivery staff');
    } finally {
      setIsSubmittingEditStaff(false);
    }
  };

  // Staff delete
  const handleDeleteStaff = async (person: DeliveryPerson) => {
    if (!confirm(`Are you sure you want to delete delivery rider "${person.name}" (${person.employeeId})?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/delivery-persons?id=${person.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Staff member "${person.name}" removed successfully`);
        loadData(true);
      } else {
        alert(data.error || 'Failed to delete delivery staff');
      }
    } catch (err: any) {
      alert('Error deleting delivery staff: ' + err.message);
    }
  };

  // Staff creation
  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffFormError('');
    setIsSubmittingStaff(true);

    try {
      const res = await fetch('/api/delivery-persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: staffName.trim(),
          employeeId: staffEmployeeId.trim(),
          phone: staffPhone.trim(),
          maxActiveDeliveries: Number(staffMaxActive) || 3,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setStaffFormError(data.error || 'Failed to register delivery staff');
      } else {
        showToast(`Staff member "${data.deliveryPerson.name}" registered successfully`);
        setIsAddStaffModalOpen(false);
        setStaffName('');
        setStaffEmployeeId('');
        setStaffPhone('');
        setStaffMaxActive('3');
        loadData(true);
      }
    } catch (err: any) {
      setStaffFormError(err.message || 'Error creating staff');
    } finally {
      setIsSubmittingStaff(false);
    }
  };

  // Staff availability / active toggle
  const handleToggleStaffStatus = async (person: DeliveryPerson, updates: Partial<DeliveryPerson>) => {
    try {
      const res = await fetch('/api/delivery-persons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: person.id,
          ...updates,
        }),
      });

      if (res.ok) {
        showToast(`Updated status for ${person.name}`);
        loadData(true);
      }
    } catch (err) {
      console.error('Failed to update staff status:', err);
    }
  };

  // Manual Assign or Reassign
  const handleAssignDelivery = async (deliveryId: string, deliveryPersonId: string | null) => {
    try {
      const res = await fetch('/api/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign',
          deliveryId,
          deliveryPersonId,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(deliveryPersonId ? 'Delivery person assigned successfully' : 'Delivery unassigned');
        setAssigningDelivery(null);
        loadData(true);
      } else {
        alert(data.error || 'Failed to update assignment');
      }
    } catch (err: any) {
      alert('Error updating delivery assignment: ' + err.message);
    }
  };

  // Update delivery status
  const handleUpdateStatus = async (deliveryId: string, newStatus: DeliveryStatus, notes?: string) => {
    try {
      const res = await fetch('/api/delivery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateStatus',
          deliveryId,
          newStatus,
          deliveryNotes: notes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast(`Delivery status changed to "${newStatus.replace('_', ' ')}"`);
        setStatusUpdateDelivery(null);
        setStatusNotes('');
        loadData(true);
      } else {
        alert(data.error || 'Failed to update delivery status');
      }
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  // Copy tracking link to clipboard
  const handleCopyTrackingLink = (delivery: Delivery) => {
    if (!delivery.trackingToken) {
      alert('Tracking token not yet assigned for this delivery.');
      return;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = `${origin}/delivery/track/${delivery.trackingToken}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast(`Tracking link copied: ${url}`);
    }).catch(() => {
      prompt('Customer Tracking Link:', url);
    });
  };

  // Save platform configuration
  const handleSavePlatformConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingConfig) return;
    setIsSavingConfig(true);

    try {
      const res = await fetch('/api/online-orders/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: editingConfig.platform,
          displayName: editingConfig.displayName,
          isEnabled: configIsEnabled,
          storeId: configStoreId.trim() || null,
          apiKey: configApiKey.trim() || null,
          apiSecret: configApiSecret.trim() || null,
          webhookSecret: configWebhookSecret.trim() || null,
          autoAccept: configAutoAccept,
          connectionStatus: configIsEnabled && configApiKey.trim() ? 'connected' : 'disconnected',
        }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`${editingConfig.displayName} configuration updated successfully!`);
        setEditingConfig(null);
        loadData(true);
      } else {
        alert(json.error || 'Failed to save configuration');
      }
    } catch (err: any) {
      alert('Error saving configuration: ' + err.message);
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Simulate incoming test order from platform
  const handleSimulateOrder = async (platformName: string) => {
    const inputOrderId = window.prompt(`Enter actual ${platformName} Order ID (from merchant ticket/app):`);
    if (!inputOrderId || !inputOrderId.trim()) {
      return;
    }

    setIsSimulatingOrder(platformName);
    try {
      const res = await fetch('/api/online-orders/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: platformName, onlineOrderId: inputOrderId.trim() }),
      });

      const json = await res.json();
      if (res.ok && json.success) {
        showToast(`Test ${platformName} order #${json.sale?.billNumber} (Order ID: #${json.sale?.onlineOrderId || inputOrderId.trim()}) imported successfully!`);
        loadData(true);
        setSubView('deliveries');
      } else {
        alert(json.error || `Failed to simulate ${platformName} order`);
      }
    } catch (err: any) {
      alert(`Simulation error: ${err.message}`);
    } finally {
      setIsSimulatingOrder(null);
    }
  };

  // Filtered deliveries
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      // Tab filter
      if (activeTab === 'unassigned' && d.assignmentStatus !== 'unassigned') return false;
      if (activeTab === 'out_for_delivery' && d.deliveryStatus !== 'out_for_delivery' && d.deliveryStatus !== 'in_transit') return false;
      if (activeTab === 'cancelled' && d.deliveryStatus !== 'cancelled' && d.deliveryStatus !== 'failed') return false;
      if (activeTab !== 'all' && activeTab !== 'unassigned' && activeTab !== 'out_for_delivery' && activeTab !== 'cancelled' && d.deliveryStatus !== activeTab) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesBill = d.billId?.toLowerCase().includes(q);
        const matchesCustomer = d.customerName?.toLowerCase().includes(q);
        const matchesPhone = d.customerPhone?.toLowerCase().includes(q);
        const matchesAddress = d.deliveryAddress?.toLowerCase().includes(q);
        const matchesStaff = d.deliveryPersonName?.toLowerCase().includes(q);
        const matchesOnline = d.onlineOrderId?.toLowerCase().includes(q);
        const matchesSource = d.orderSource?.toLowerCase().includes(q);
        return matchesBill || matchesCustomer || matchesPhone || matchesAddress || matchesStaff || matchesOnline || matchesSource;
      }

      return true;
    });
  }, [deliveries, activeTab, searchQuery]);

  // Keyboard shortcut listener: Ctrl+F, ↑, ↓, Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (shortcutsStore.isActionTriggered('screen_search', e)) {
        e.preventDefault();
        setIsSearchOpen(true);
        setTimeout(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }, 50);
        return;
      }

      if (e.key === 'Escape' && isSearchOpen) {
        setIsSearchOpen(false);
        return;
      }

      if (isInput) return;

      if (shortcutsStore.isActionTriggered('screen_next_row', e) || e.key === 'ArrowDown') {
        e.preventDefault();
        if (filteredDeliveries.length > 0) {
          setSelectedDeliveryIndex((prev) => Math.min(filteredDeliveries.length - 1, prev + 1));
        }
        return;
      }

      if (shortcutsStore.isActionTriggered('screen_prev_row', e) || e.key === 'ArrowUp') {
        e.preventDefault();
        if (filteredDeliveries.length > 0) {
          setSelectedDeliveryIndex((prev) => Math.max(0, prev - 1));
        }
        return;
      }

      if (shortcutsStore.isActionTriggered('screen_open_row', e) || e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredDeliveries[selectedDeliveryIndex];
        if (selected) {
          setStatusUpdateDelivery(selected);
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredDeliveries, selectedDeliveryIndex, shortcutsStore]);

  // Statistics
  const stats = useMemo(() => {
    const total = deliveries.length;
    const unassigned = deliveries.filter((d) => d.assignmentStatus === 'unassigned').length;
    const assigned = deliveries.filter((d) => d.deliveryStatus === 'assigned').length;
    const preparing = deliveries.filter((d) => ['accepted', 'preparing', 'ready_for_pickup'].includes(d.deliveryStatus)).length;
    const inTransit = deliveries.filter((d) => ['picked_up', 'out_for_delivery', 'in_transit'].includes(d.deliveryStatus)).length;
    const delivered = deliveries.filter((d) => d.deliveryStatus === 'delivered').length;
    const failed = deliveries.filter((d) => ['cancelled', 'failed'].includes(d.deliveryStatus)).length;

    const activeStaff = staff.filter((s) => s.isActive && s.availabilityStatus === 'available').length;
    const busyStaff = staff.filter((s) => s.isActive && s.availabilityStatus === 'busy').length;

    return { total, unassigned, assigned, preparing, inTransit, delivered, failed, activeStaff, busyStaff };
  }, [deliveries, staff]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-4 sm:p-6 md:p-8 space-y-6">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-bold text-black shadow-2xl animate-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Title & Navigation Switches */}
      <div className="rounded-3xl p-6 bg-theme-bar border border-theme shadow-2xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div
          className="absolute right-0 top-0 -mt-8 -mr-8 h-40 w-40 rounded-full blur-3xl pointer-events-none opacity-25"
          style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
        />
        <div className="flex items-center gap-3.5 relative z-10">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 border border-white/30 text-white shadow-inner backdrop-blur-sm">
            <Truck className="h-6 w-6 text-white stroke-[2.2]" />
          </div>
          <div>
{isDeliveryStaff ? (
              <>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  <Bike className="h-6 w-6 text-pink-400" /> My Assigned Deliveries
                </h1>
                <p className="text-xs text-white/90 font-medium mt-0.5">
                  Logged in as <span className="font-bold text-white">{currentUsername}</span>. View customer details, order items, and update delivery milestones.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                  Delivery Collection & Online Orders
                </h1>
                <p className="text-xs text-white/90 font-medium mt-0.5">
                  Terminal deliveries, Zomato/Swiggy API dispatch & automatic fleet workload management
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 relative z-10 flex-wrap">
          {/* View Toggle */}
          {!isDeliveryStaff && (
            <div className="flex items-center gap-1 rounded-2xl bg-black/40 p-1 border border-white/20 backdrop-blur-md">
              <button
                onClick={() => setSubView('deliveries')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  subView === 'deliveries' ? 'bg-theme-gradient text-white shadow-lg shadow-theme-glow' : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Truck className="h-3.5 w-3.5" />
                <span>Deliveries ({deliveries.length})</span>
              </button>
              <button
                onClick={() => setSubView('staff')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  subView === 'staff' ? 'bg-theme-gradient text-white shadow-lg shadow-theme-glow' : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Staff ({staff.length})</span>
              </button>
              <button
                onClick={() => setSubView('online_apis')}
                className={`flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                  subView === 'online_apis' ? 'bg-theme-gradient text-white shadow-lg shadow-theme-glow' : 'text-zinc-300 hover:text-white'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Online Order APIs</span>
              </button>
            </div>
          )}

          <button
            onClick={() => loadData(true)}
            className="flex items-center gap-1.5 rounded-xl border border-pink-500/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-100 hover:bg-black/60 hover:text-white transition cursor-pointer backdrop-blur-md"
            title="Refresh Deliveries"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          {subView === 'staff' && (
            <button
              onClick={() => setIsAddStaffModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white transition shadow-lg cursor-pointer active:scale-95"
            >
              <UserPlus className="h-4 w-4" />
              <span>Register Staff</span>
            </button>
          )}
        </div>
      </div>

      {/* Live Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Deliveries</div>
          <div className="text-2xl font-black text-white mt-1">{stats.total}</div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Pending Assignment</div>
          <div className="text-2xl font-black text-amber-400 mt-1">{stats.unassigned}</div>
        </div>

        <div className="rounded-2xl border border-blue-500/30 bg-blue-950/20 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">Assigned / Prep</div>
          <div className="text-2xl font-black text-blue-400 mt-1">{stats.assigned + stats.preparing}</div>
        </div>

        <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Out for Delivery</div>
          <div className="text-2xl font-black text-purple-400 mt-1">{stats.inTransit}</div>
        </div>

        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">Delivered</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">{stats.delivered}</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm">
          <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Available Staff</div>
          <div className="text-2xl font-black text-emerald-400 mt-1">
            {stats.activeStaff} <span className="text-xs text-zinc-400 font-normal">/ {staff.length}</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: DELIVERIES */}
      {subView === 'deliveries' && (
        <div className="space-y-4">
          {/* Controls: Search & Section Tabs */}
          <div className="flex items-center justify-between gap-3 relative">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 flex-1 min-w-0">
              {(isDeliveryStaff
                ? [
                    { id: 'all', label: 'All Assigned', count: filteredDeliveries.length },
                    { id: 'assigned', label: 'Assigned', count: deliveries.filter((d) => d.deliveryStatus === 'assigned').length },
                    { id: 'picked_up', label: 'Picked Up', count: deliveries.filter((d) => d.deliveryStatus === 'picked_up').length },
                    { id: 'out_for_delivery', label: 'Out for Delivery', count: deliveries.filter((d) => d.deliveryStatus === 'out_for_delivery' || d.deliveryStatus === 'in_transit').length },
                    { id: 'delivered', label: 'Delivery History', count: deliveries.filter((d) => d.deliveryStatus === 'delivered').length },
                  ]
                : [
                    { id: 'all', label: 'All Orders', count: stats.total },
                    { id: 'unassigned', label: 'Pending Assignment', count: stats.unassigned, alert: stats.unassigned > 0 },
                    { id: 'assigned', label: 'Assigned', count: stats.assigned },
                    { id: 'preparing', label: 'Preparing', count: stats.preparing },
                    { id: 'out_for_delivery', label: 'Out for Delivery', count: stats.inTransit },
                    { id: 'delivered', label: 'Delivered', count: stats.delivered },
                    { id: 'cancelled', label: 'Cancelled', count: stats.failed },
                  ]
              ).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition whitespace-nowrap cursor-pointer shrink-0 ${
                      isActive
                        ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
                        : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-mono ${
                        isActive
                          ? 'bg-white text-pink-950 font-black'
                          : tab.alert
                          ? 'bg-amber-400 text-zinc-950 font-bold'
                          : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Search Trigger Icon & Overlay */}
            <div className="relative shrink-0" ref={searchContainerRef}>
              {/* Trigger Button: Clean Search Icon */}
              <button
                type="button"
                onClick={() => {
                  setIsSearchOpen((prev) => {
                    const next = !prev;
                    if (next) {
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                        searchInputRef.current?.select();
                      }, 50);
                    }
                    return next;
                  });
                }}
                className={`relative flex items-center justify-center h-9 w-9 rounded-xl border transition cursor-pointer ${
                  isSearchOpen || searchQuery
                    ? 'border-pink-500 bg-pink-950/40 text-pink-400 shadow-md shadow-pink-500/10'
                    : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 hover:border-zinc-700'
                }`}
                title="Search deliveries in Delivery Collection (Ctrl+F)"
                aria-label="Search deliveries"
              >
                <Search className="h-4 w-4" />
                {searchQuery && !isSearchOpen && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-pink-500 ring-2 ring-zinc-950" />
                )}
              </button>

              {/* Search Overlay */}
              {isSearchOpen && (
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 z-50 flex items-center gap-2 rounded-2xl border border-zinc-700 bg-zinc-900/95 backdrop-blur-xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150"
                  style={{ minWidth: '320px', maxWidth: 'calc(100vw - 32px)' }}
                >
                  {/* Search Icon inside overlay */}
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-pink-400 shrink-0">
                    <Search className="h-4 w-4" />
                  </div>

                  {/* Search Input beside the search icon */}
                  <div className="relative flex-1">
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder="Search bill, online ID, customer, rider, source..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setIsSearchOpen(false);
                        }
                      }}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-800 pl-3 pr-14 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500 font-medium"
                      autoFocus
                    />
                    {showShortcutBadges && !searchQuery && (
                      <kbd className="absolute right-2 top-1.5 rounded bg-zinc-800 border border-zinc-700 px-1 py-0.5 text-[9px] font-mono text-zinc-400">
                        {shortcutsStore.getActionDisplayKey('screen_search') || 'Ctrl+F'}
                      </kbd>
                    )}
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer p-0.5"
                        title="Clear search"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Close Overlay Button */}
                  <button
                    type="button"
                    onClick={() => setIsSearchOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer shrink-0"
                    title="Close search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Deliveries Table */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 overflow-hidden shadow-2xl">
            {isLoading ? (
              <div className="py-20 text-center text-zinc-500">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-pink-500 mb-3" />
                <p className="text-sm font-semibold">Loading delivery orders from local database...</p>
              </div>
            ) : filteredDeliveries.length === 0 ? (
              <div className="py-20 text-center text-zinc-500">
                <Truck className="mx-auto h-10 w-10 text-zinc-600 mb-3" />
                <p className="text-base font-bold text-zinc-300">No deliveries found</p>
                <p className="text-xs text-zinc-500 mt-1">
                  {searchQuery ? 'Try matching a different keyword or reset filters' : 'Terminal deliveries & online orders will appear here automatically.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-[11px] text-zinc-300">
                  <thead className="border-b border-zinc-800 bg-zinc-900/90 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="px-2.5 py-2.5 w-[16%] whitespace-nowrap">{isDeliveryStaff ? 'Bill / Details' : 'Bill / Source'}</th>
                      <th className="px-2.5 py-2.5 w-[16%] whitespace-nowrap">Customer & Contact</th>
                      <th className="px-2.5 py-2.5 w-[15%]">Delivery Address</th>
                      <th className="px-2.5 py-2.5 w-[14%] whitespace-nowrap">{isDeliveryStaff ? 'Rider' : 'Assigned Rider'}</th>
                      <th className="px-2 py-2.5 w-[9%] whitespace-nowrap">Order Time</th>
                      <th className="px-2 py-2.5 w-[9%] whitespace-nowrap">Status</th>
                      <th className="px-2.5 py-2.5 w-[21%] text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredDeliveries.map((delivery) => {
                      const isUnassigned = delivery.assignmentStatus === 'unassigned';
                      const source = delivery.orderSource || 'Terminal';

                      return (
                        <tr key={delivery.id} className="hover:bg-zinc-800/40 transition group">
                          {/* Bill & Source & Items */}
                          <td className="px-3.5 py-2 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-white">#{delivery.billId}</span>
                              {delivery.paymentStatus && (
                                <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${
                                  delivery.paymentStatus.toLowerCase() === 'paid'
                                    ? 'bg-emerald-950/70 border border-emerald-700/70 text-emerald-300'
                                    : 'bg-amber-950/70 border border-amber-700/70 text-amber-300'
                                }`}>
                                  {delivery.paymentStatus.toLowerCase() === 'paid' ? 'PAID' : 'COD'}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`inline-flex items-center rounded px-1.5 py-0.2 text-[9px] font-bold ${
                                source === 'Zomato'
                                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                  : source === 'Swiggy'
                                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                              }`}>
                                {source}
                              </span>
                              {delivery.onlineOrderId && (
                                <span className={`text-[9px] font-mono font-bold px-1 py-0.2 rounded border ${
                                  source === 'Zomato'
                                    ? 'bg-red-950/60 text-red-300 border-red-500/40'
                                    : source === 'Swiggy'
                                    ? 'bg-orange-950/60 text-orange-300 border-orange-500/40'
                                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                                }`}>
                                  #{delivery.onlineOrderId}
                                </span>
                              )}
                              {delivery.totalAmount !== undefined && (
                                <span className="text-[11px] font-mono text-pink-400 font-bold ml-1">
                                  ₹{delivery.totalAmount.toFixed(2)}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => setViewingOrderItems(delivery)}
                                className="inline-flex items-center gap-0.5 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-1.5 py-0.2 text-[9px] font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
                                title="View order items"
                              >
                                <Eye className="h-2.5 w-2.5 text-pink-400" />
                                <span>({delivery.items?.length || 0})</span>
                              </button>
                            </div>
                          </td>

                          {/* Customer & Phone */}
                          <td className="px-3.5 py-2">
                            <div className="font-bold text-xs text-white leading-tight">{delivery.customerName || 'Walk-in / Guest'}</div>
                            {delivery.customerPhone ? (
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                                <Phone className="h-2.5 w-2.5 text-zinc-500 shrink-0" />
                                <span className="font-mono">{delivery.customerPhone}</span>
                                <div className="inline-flex items-center gap-1 ml-0.5">
                                  <a
                                    href={`tel:${delivery.customerPhone}`}
                                    className="inline-flex items-center gap-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 px-1 py-0.2 text-[9px] font-bold text-emerald-300 hover:bg-emerald-900/80 transition"
                                    title="Call customer directly"
                                  >
                                    <Phone className="h-2 w-2 text-emerald-400" />
                                    <span>Call</span>
                                  </a>
                                  <a
                                    href={`https://wa.me/${delivery.customerPhone.replace(/\D/g, '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 rounded bg-emerald-600/20 border border-emerald-500/40 px-1 py-0.2 text-[9px] font-bold text-emerald-400 hover:bg-emerald-600/30 transition"
                                    title="Message customer on WhatsApp"
                                  >
                                    <MessageCircle className="h-2 w-2 text-emerald-400" />
                                    <span>WA</span>
                                  </a>
                                </div>
                              </div>
                            ) : (
                              <div className="text-[10px] text-zinc-500 italic mt-0.5">No phone provided</div>
                            )}
                          </td>

                          {/* Address */}
                          <td className="px-3.5 py-2 max-w-[220px]">
                            {delivery.deliveryAddress ? (
                              <div className="space-y-0.5">
                                <div className="flex items-start gap-1 text-zinc-300">
                                  <MapPin className="h-3 w-3 text-pink-400 shrink-0 mt-0.5" />
                                  <span className="text-[11px] line-clamp-1 text-zinc-200" title={delivery.deliveryAddress}>
                                    {delivery.deliveryAddress}
                                  </span>
                                  <a
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(delivery.deliveryAddress)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-pink-400 hover:text-white shrink-0 ml-0.5"
                                    title="Open Google Maps directions"
                                  >
                                    <ExternalLink className="h-2.5 w-2.5" />
                                  </a>
                                </div>
                                {delivery.deliveryNotes && (
                                  <div className="text-[9px] text-zinc-400 italic line-clamp-1 bg-zinc-800/40 rounded px-1 border border-zinc-700/40" title={delivery.deliveryNotes}>
                                    Note: {delivery.deliveryNotes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-[10px] text-zinc-500 italic">No address specified</span>
                            )}
                          </td>

                          {/* Assigned Rider */}
                          <td className="px-3.5 py-2 whitespace-nowrap">
                            {delivery.deliveryPersonName ? (
                              <div className="flex items-center gap-1.5">
                                <div className="h-6 w-6 rounded-lg bg-pink-900/60 border border-pink-700/50 flex items-center justify-center text-pink-300 font-bold text-[10px] shrink-0">
                                  {delivery.deliveryPersonName[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-xs text-white leading-tight">{delivery.deliveryPersonName}</div>
                                  <div className="text-[9px] text-zinc-400 font-mono">{delivery.deliveryPersonPhone || 'No phone'}</div>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-950/40 px-2 py-0.5 text-[10px] font-bold text-amber-400">
                                <AlertTriangle className="h-2.5 w-2.5" />
                                Pending Assignment
                              </span>
                            )}
                          </td>

                          {/* Order Time */}
                          <td className="px-3.5 py-2 whitespace-nowrap text-zinc-400" suppressHydrationWarning>
                            <div className="text-[11px] font-medium text-zinc-200">
                              {delivery.orderTime ? new Date(delivery.orderTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                            </div>
                            <div className="text-[9px] text-zinc-500">
                              {delivery.orderTime ? new Date(delivery.orderTime).toLocaleDateString() : ''}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-3.5 py-2 whitespace-nowrap">
                            <StatusBadge status={delivery.deliveryStatus} />
                          </td>

                          {/* Actions */}
                          <td className="px-2.5 py-2 text-right whitespace-nowrap">
                            {isDeliveryStaff ? (
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                {/* Tracking Link */}
                                {delivery.trackingToken && (
                                  <button
                                    onClick={() => handleCopyTrackingLink(delivery)}
                                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                                    title="Copy customer tracking URL"
                                  >
                                    <Copy className="h-2.5 w-2.5 text-pink-400" />
                                    <span>Track</span>
                                  </button>
                                )}

                                {/* Direct Status Action Buttons - No dropdown */}
                                {delivery.deliveryStatus === 'assigned' && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'picked_up')}
                                    className="rounded bg-purple-600 hover:bg-purple-500 px-2.5 py-1 text-[10px] font-bold text-white transition flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                  >
                                    <PackageCheck className="h-3 w-3" />
                                    <span>Picked Up</span>
                                  </button>
                                )}
                                {delivery.deliveryStatus === 'picked_up' && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'out_for_delivery')}
                                    className="rounded bg-pink-600 hover:bg-pink-500 px-2.5 py-1 text-[10px] font-bold text-white transition flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                  >
                                    <Truck className="h-3 w-3" />
                                    <span>Out for Delivery</span>
                                  </button>
                                )}
                                {(delivery.deliveryStatus === 'out_for_delivery' || delivery.deliveryStatus === 'in_transit') && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'delivered')}
                                    className="rounded bg-emerald-600 hover:bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-white transition flex items-center gap-1 shadow-sm cursor-pointer active:scale-95"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Mark Delivered</span>
                                  </button>
                                )}
                                {delivery.deliveryStatus === 'delivered' && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 rounded px-2.5 py-1">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    Delivered
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                                {/* Customer Tracking Link */}
                                {delivery.trackingToken && (
                                  <button
                                    onClick={() => handleCopyTrackingLink(delivery)}
                                    className="flex items-center gap-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 transition cursor-pointer shrink-0"
                                    title="Copy customer tracking URL"
                                  >
                                    <Copy className="h-2.5 w-2.5 text-pink-400" />
                                    <span>Track</span>
                                  </button>
                                )}

                                {/* Assign / Reassign */}
                                <button
                                  onClick={() => setAssigningDelivery(delivery)}
                                  className="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-[10px] font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer shrink-0"
                                  title="Assign or Reassign Delivery Person"
                                >
                                  {isUnassigned ? 'Assign' : 'Reassign'}
                                </button>

                                {/* Status Action Buttons */}
                                {delivery.deliveryStatus === 'pending' && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'accepted')}
                                    className="rounded bg-indigo-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-indigo-500 transition cursor-pointer shrink-0 shadow-sm"
                                  >
                                    Accept
                                  </button>
                                )}

                                {(delivery.deliveryStatus === 'assigned' || delivery.deliveryStatus === 'accepted') && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'preparing')}
                                    className="rounded bg-amber-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-amber-500 transition cursor-pointer shrink-0 shadow-sm"
                                  >
                                    Prepare
                                  </button>
                                )}

                                {delivery.deliveryStatus === 'preparing' && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'ready_for_pickup')}
                                    className="rounded bg-blue-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-blue-500 transition cursor-pointer shrink-0 shadow-sm"
                                  >
                                    Ready
                                  </button>
                                )}

                                {delivery.deliveryStatus === 'ready_for_pickup' && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'picked_up')}
                                    className="rounded bg-purple-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-purple-500 transition cursor-pointer shrink-0 shadow-sm"
                                  >
                                    Picked Up
                                  </button>
                                )}

                                {delivery.deliveryStatus === 'picked_up' && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'out_for_delivery')}
                                    className="rounded bg-purple-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-purple-500 transition cursor-pointer shrink-0 shadow-sm"
                                  >
                                    Dispatch
                                  </button>
                                )}

                                {(delivery.deliveryStatus === 'out_for_delivery' || delivery.deliveryStatus === 'in_transit') && (
                                  <button
                                    onClick={() => handleUpdateStatus(delivery.id, 'delivered')}
                                    className="rounded bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-emerald-500 transition cursor-pointer shrink-0 shadow-sm"
                                  >
                                    Delivered
                                  </button>
                                )}

                                {!['delivered', 'cancelled', 'failed'].includes(delivery.deliveryStatus) && (
                                  <button
                                    onClick={() => setStatusUpdateDelivery(delivery)}
                                    className="rounded border border-red-800/80 bg-red-950/40 px-2 py-1 text-[10px] font-semibold text-red-400 hover:bg-red-900/60 transition cursor-pointer shrink-0"
                                    title="Cancel delivery order"
                                  >
                                    Cancel
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: DELIVERY STAFF */}
      {subView === 'staff' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Registered Delivery Staff</h2>
            <p className="text-xs text-zinc-400">
              Only active delivery persons with status <span className="text-emerald-400 font-semibold">&quot;Available&quot;</span> receive automatic assignments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {staff.map((person) => {
              return (
                <div
                  key={person.id}
                  className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 space-y-4 hover:border-zinc-700 transition shadow-xl"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-2xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center font-bold text-base">
                        {person.name[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{person.name}</div>
                        <div className="text-xs text-zinc-400 font-mono">ID: {person.employeeId}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Edit Button */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingStaff(person);
                          setEditStaffName(person.name);
                          setEditStaffEmployeeId(person.employeeId);
                          setEditStaffPhone(person.phone);
                          setEditStaffMaxActive(String(person.maxActiveDeliveries || 3));
                          setEditStaffError('');
                        }}
                        className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:text-white hover:border-pink-500 hover:bg-zinc-700 transition cursor-pointer"
                        title={`Edit ${person.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteStaff(person)}
                        className="p-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:text-red-400 hover:border-red-600/60 hover:bg-red-950/40 transition cursor-pointer"
                        title={`Delete ${person.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>

                      {/* Active Switch */}
                      <button
                        onClick={() => handleToggleStaffStatus(person, { isActive: !person.isActive })}
                        className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition cursor-pointer ${
                          person.isActive
                            ? 'bg-emerald-950/60 border border-emerald-800 text-emerald-400'
                            : 'bg-zinc-800 border border-zinc-700 text-zinc-500'
                        }`}
                      >
                        <Power className="h-3 w-3" />
                        <span>{person.isActive ? 'Active' : 'Inactive'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-zinc-300">
                    <Phone className="h-3.5 w-3.5 text-zinc-500" />
                    <span>{person.phone}</span>
                  </div>

                  {/* Workload Progress & Availability */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-400">Current Workload</span>
                      <span className="font-bold text-white">
                        {person.assignedDeliveryCount} / {person.maxActiveDeliveries} orders
                      </span>
                    </div>

                    <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          person.assignedDeliveryCount >= person.maxActiveDeliveries
                            ? 'bg-amber-500'
                            : 'bg-pink-500'
                        }`}
                        style={{
                          width: `${Math.min(100, (person.assignedDeliveryCount / person.maxActiveDeliveries) * 100)}%`,
                        }}
                      />
                    </div>

                    {/* Availability Dropdown */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-zinc-400">Availability:</span>
                      <select
                        value={person.availabilityStatus}
                        onChange={(e) =>
                          handleToggleStaffStatus(person, {
                            availabilityStatus: e.target.value as AvailabilityStatus,
                          })
                        }
                        className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-[11px] font-semibold text-zinc-200 focus:outline-hidden focus:border-pink-500 cursor-pointer"
                      >
                        <option value="available">🟢 Available</option>
                        <option value="busy">🟡 Busy (Auto)</option>
                        <option value="offline">⚪ Offline</option>
                      </select>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: ONLINE ORDER APIS */}
      {subView === 'online_apis' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white">Online Ordering Platform Integrations</h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Configure approved platform APIs (Zomato, Swiggy) to automatically stream online delivery orders into local billing and reports.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* ZOMATO CARD */}
            {(() => {
              const zomato: Partial<OnlineOrderConfig> = onlineConfigs.find((c) => c.platform === 'zomato') || {
                platform: 'zomato',
                displayName: 'Zomato',
                isEnabled: false,
                connectionStatus: 'disconnected',
                storeId: undefined,
                apiKey: undefined,
                apiSecret: undefined,
                webhookSecret: undefined,
                autoAccept: true,
              };

              return (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-red-600/20 border border-red-500/40 text-red-500 flex items-center justify-center font-black text-xl">
                        Z
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">Zomato Food Delivery API</h3>
                        <p className="text-xs text-zinc-400">Direct Merchant & Webhook Order Sync</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      zomato.isEnabled && zomato.connectionStatus === 'connected'
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${zomato.isEnabled && zomato.connectionStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
                      {zomato.isEnabled && zomato.connectionStatus === 'connected' ? 'Active / Connected' : 'Disconnected'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Store / Restaurant ID:</span>
                      <span className="font-mono font-bold text-white">{zomato.storeId || 'Not configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">API Merchant Key:</span>
                      <span className="font-mono text-zinc-300">{zomato.apiKey ? '••••••••' + zomato.apiKey.slice(-4) : 'Not configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Auto-Accept Orders:</span>
                      <span className="font-semibold text-emerald-400">{zomato.autoAccept !== false ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => {
                        setEditingConfig(zomato as any);
                        setConfigStoreId(zomato.storeId || '');
                        setConfigApiKey(zomato.apiKey || '');
                        setConfigApiSecret(zomato.apiSecret || '');
                        setConfigWebhookSecret(zomato.webhookSecret || '');
                        setConfigAutoAccept(zomato.autoAccept !== false);
                        setConfigIsEnabled(Boolean(zomato.isEnabled));
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 transition cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Configure API</span>
                    </button>

                    <button
                      disabled={isSimulatingOrder === 'Zomato'}
                      onClick={() => handleSimulateOrder('Zomato')}
                      className="flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition shadow-lg shadow-red-600/30 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>{isSimulatingOrder === 'Zomato' ? 'Importing...' : 'Test Zomato Order'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* SWIGGY CARD */}
            {(() => {
              const swiggy: Partial<OnlineOrderConfig> = onlineConfigs.find((c) => c.platform === 'swiggy') || {
                platform: 'swiggy',
                displayName: 'Swiggy',
                isEnabled: false,
                connectionStatus: 'disconnected',
                storeId: undefined,
                apiKey: undefined,
                apiSecret: undefined,
                webhookSecret: undefined,
                autoAccept: true,
              };

              return (
                <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 space-y-5 shadow-2xl relative overflow-hidden">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-2xl bg-orange-600/20 border border-orange-500/40 text-orange-500 flex items-center justify-center font-black text-xl">
                        S
                      </div>
                      <div>
                        <h3 className="text-base font-black text-white">Swiggy Delivery Partner API</h3>
                        <p className="text-xs text-zinc-400">Direct Outlet & Webhook Order Sync</p>
                      </div>
                    </div>

                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
                      swiggy.isEnabled && swiggy.connectionStatus === 'connected'
                        ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                        : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${swiggy.isEnabled && swiggy.connectionStatus === 'connected' ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
                      {swiggy.isEnabled && swiggy.connectionStatus === 'connected' ? 'Active / Connected' : 'Disconnected'}
                    </span>
                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Outlet ID:</span>
                      <span className="font-mono font-bold text-white">{swiggy.storeId || 'Not configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Partner Key:</span>
                      <span className="font-mono text-zinc-300">{swiggy.apiKey ? '••••••••' + swiggy.apiKey.slice(-4) : 'Not configured'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-400">Auto-Accept Orders:</span>
                      <span className="font-semibold text-emerald-400">{swiggy.autoAccept !== false ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <button
                      onClick={() => {
                        setEditingConfig(swiggy as any);
                        setConfigStoreId(swiggy.storeId || '');
                        setConfigApiKey(swiggy.apiKey || '');
                        setConfigApiSecret(swiggy.apiSecret || '');
                        setConfigWebhookSecret(swiggy.webhookSecret || '');
                        setConfigAutoAccept(swiggy.autoAccept !== false);
                        setConfigIsEnabled(Boolean(swiggy.isEnabled));
                      }}
                      className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 transition cursor-pointer"
                    >
                      <Settings className="h-3.5 w-3.5 text-zinc-400" />
                      <span>Configure API</span>
                    </button>

                    <button
                      disabled={isSimulatingOrder === 'Swiggy'}
                      onClick={() => handleSimulateOrder('Swiggy')}
                      className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white hover:bg-orange-500 transition shadow-lg shadow-orange-600/30 cursor-pointer disabled:opacity-50"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>{isSimulatingOrder === 'Swiggy' ? 'Importing...' : 'Test Swiggy Order'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Webhook Endpoint Instructions */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Zap className="h-4 w-4 text-pink-400" />
              Webhook Order Integration URL
            </h4>
            <p className="text-xs text-zinc-400">
              Provide this webhook endpoint URL to Zomato or Swiggy merchant dashboards for instant real-time order ingress:
            </p>
            <div className="flex items-center gap-2 rounded-2xl bg-zinc-950 border border-zinc-800 p-3 font-mono text-xs text-pink-300">
              <span className="flex-1 truncate">
                {typeof window !== 'undefined' ? `${window.location.origin}/api/online-orders/webhook` : '/api/online-orders/webhook'}
              </span>
              <button
                onClick={() => {
                  const url = typeof window !== 'undefined' ? `${window.location.origin}/api/online-orders/webhook` : '/api/online-orders/webhook';
                  navigator.clipboard.writeText(url);
                  showToast('Webhook URL copied to clipboard');
                }}
                className="flex items-center gap-1 rounded-lg bg-zinc-800 px-3 py-1 text-xs text-zinc-200 hover:text-white hover:bg-zinc-700 transition"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: REGISTER STAFF */}
      {isAddStaffModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setIsAddStaffModalOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-pink-500/10 text-pink-400 flex items-center justify-center">
                  <UserPlus className="h-4 w-4" />
                </div>
                <h3 className="font-bold text-sm">Register Delivery Staff</h3>
              </div>
              <button
                onClick={() => setIsAddStaffModalOpen(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {staffFormError && (
              <div className="rounded-xl bg-red-950/60 border border-red-800 p-3 text-xs text-red-200 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                <span>{staffFormError}</span>
              </div>
            )}

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Suresh Kumar"
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Employee ID / Rider Username <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RIDER-001"
                  value={staffEmployeeId}
                  onChange={(e) => setStaffEmployeeId(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9845012345"
                  value={staffPhone}
                  onChange={(e) => setStaffPhone(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Max Active Deliveries (Workload Capacity)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={staffMaxActive}
                  onChange={(e) => setStaffMaxActive(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddStaffModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingStaff}
                  className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-bold text-white hover:bg-pink-500 transition shadow-lg shadow-pink-600/30 cursor-pointer"
                >
                  {isSubmittingStaff ? 'Registering...' : 'Save Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DELIVERY STAFF */}
      {editingStaff && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setEditingStaff(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Edit Delivery Staff</h3>
                <p className="text-xs text-zinc-400">Update rider credentials and active workload</p>
              </div>
              <button
                onClick={() => setEditingStaff(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {editStaffError && (
              <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-2.5 text-xs text-red-300">
                {editStaffError}
              </div>
            )}

            <form onSubmit={handleSaveEditStaff} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Full Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={editStaffName}
                  onChange={(e) => setEditStaffName(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Employee / Rider ID <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. RIDER-001"
                  value={editStaffEmployeeId}
                  onChange={(e) => setEditStaffEmployeeId(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Phone Number <span className="text-red-400">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9845012345"
                  value={editStaffPhone}
                  onChange={(e) => setEditStaffPhone(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Max Active Deliveries (Workload Capacity)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={editStaffMaxActive}
                  onChange={(e) => setEditStaffMaxActive(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingStaff(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEditStaff}
                  className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-bold text-white hover:bg-pink-500 transition shadow-lg shadow-pink-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingEditStaff ? 'Saving...' : 'Update Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CONFIGURE ONLINE PLATFORM */}
      {editingConfig && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setEditingConfig(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-sm text-white">Configure {editingConfig.displayName} API</h3>
                <p className="text-xs text-zinc-400">Store credentials & webhook integration</p>
              </div>
              <button
                onClick={() => setEditingConfig(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSavePlatformConfig} className="space-y-3.5">
              <div className="flex items-center justify-between rounded-2xl bg-zinc-950 border border-zinc-800 p-3">
                <div>
                  <div className="text-xs font-bold text-white">Enable Integration</div>
                  <div className="text-[10px] text-zinc-400">Receive and sync orders from this service</div>
                </div>
                <input
                  type="checkbox"
                  checked={configIsEnabled}
                  onChange={(e) => setConfigIsEnabled(e.target.checked)}
                  className="h-4 w-4 rounded accent-pink-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Store / Restaurant ID
                </label>
                <input
                  type="text"
                  placeholder="e.g. RES_128941"
                  value={configStoreId}
                  onChange={(e) => setConfigStoreId(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  API Key / Merchant Token
                </label>
                <input
                  type="text"
                  placeholder="e.g. zom_live_key_..."
                  value={configApiKey}
                  onChange={(e) => setConfigApiKey(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  API Secret (Optional)
                </label>
                <input
                  type="password"
                  placeholder="Secret key"
                  value={configApiSecret}
                  onChange={(e) => setConfigApiSecret(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Webhook Signature Secret
                </label>
                <input
                  type="text"
                  placeholder="whsec_..."
                  value={configWebhookSecret}
                  onChange={(e) => setConfigWebhookSecret(e.target.value)}
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-zinc-950 border border-zinc-800 p-3">
                <div>
                  <div className="text-xs font-bold text-white">Auto-Accept Orders</div>
                  <div className="text-[10px] text-zinc-400">Immediately accept incoming orders into billing</div>
                </div>
                <input
                  type="checkbox"
                  checked={configAutoAccept}
                  onChange={(e) => setConfigAutoAccept(e.target.checked)}
                  className="h-4 w-4 rounded accent-pink-600 cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setEditingConfig(null)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingConfig}
                  className="rounded-xl bg-pink-600 px-5 py-2 text-xs font-bold text-white hover:bg-pink-500 transition shadow-lg shadow-pink-600/30 cursor-pointer"
                >
                  {isSavingConfig ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN / REASSIGN DELIVERY PERSON */}
      {assigningDelivery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setAssigningDelivery(null)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="font-bold text-sm">Assign Delivery Staff</h3>
                <p className="text-xs text-zinc-400">Order #{assigningDelivery.billId}</p>
              </div>
              <button
                onClick={() => setAssigningDelivery(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
              {/* Option to Unassign */}
              <button
                type="button"
                onClick={() => handleAssignDelivery(assigningDelivery.id, null)}
                className="w-full flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-950 p-3 text-left hover:border-zinc-700 transition cursor-pointer"
              >
                <div>
                  <div className="font-bold text-xs text-amber-400">Mark as Pending Assignment</div>
                  <div className="text-[10px] text-zinc-500">Remove current rider assignment</div>
                </div>
                <X className="h-4 w-4 text-zinc-500" />
              </button>

              {/* Staff List */}
              {staff
                .filter((s) => s.isActive)
                .map((person) => {
                  const isCurrent = assigningDelivery.deliveryPersonId === person.id;

                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => handleAssignDelivery(assigningDelivery.id, person.id)}
                      className={`w-full flex items-center justify-between rounded-2xl border p-3 text-left transition cursor-pointer ${
                        isCurrent
                          ? 'border-pink-500 bg-pink-950/40 text-white'
                          : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700 text-zinc-300'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-xs flex items-center gap-2">
                          <span>{person.name}</span>
                          <span className="text-[10px] text-zinc-500 font-mono">({person.employeeId})</span>
                          {isCurrent && (
                            <span className="rounded bg-pink-500 text-white text-[9px] px-1.5 py-0.2 font-bold">
                              Current
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">
                          Workload: {person.assignedDeliveryCount} / {person.maxActiveDeliveries} orders ·{' '}
                          <span
                            className={
                              person.availabilityStatus === 'available'
                                ? 'text-emerald-400'
                                : 'text-amber-400'
                            }
                          >
                            {person.availabilityStatus}
                          </span>
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-zinc-500" />
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VIEW ORDER ITEMS & PAYMENT DETAILS */}
      {viewingOrderItems && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4"
          onClick={() => setViewingOrderItems(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-white">Order Details</h3>
                  <span className="font-mono text-xs text-pink-400 font-bold">#{viewingOrderItems.billId}</span>
                  {viewingOrderItems.onlineOrderId && (
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                      Online ID: #{viewingOrderItems.onlineOrderId}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {viewingOrderItems.customerName || 'Customer'} · {viewingOrderItems.customerPhone || 'No phone'}
                </p>
              </div>
              <button
                onClick={() => setViewingOrderItems(null)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Customer & Address Details */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-2 text-xs">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-pink-400 shrink-0 mt-0.5" />
                <div className="text-zinc-300">
                  <span className="text-zinc-500 text-[11px] block font-medium">Delivery Address:</span>
                  {viewingOrderItems.deliveryAddress}
                </div>
              </div>
              {viewingOrderItems.deliveryNotes && (
                <div className="text-[11px] text-amber-300 bg-amber-950/30 border border-amber-800/40 rounded-lg p-2 mt-1">
                  <span className="font-bold">Instructions:</span> {viewingOrderItems.deliveryNotes}
                </div>
              )}
            </div>

            {/* Items List */}
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">Order Items</div>
              <div className="max-h-56 overflow-y-auto no-scrollbar divide-y divide-zinc-800 border border-zinc-800 rounded-2xl bg-zinc-950">
                {viewingOrderItems.items && viewingOrderItems.items.length > 0 ? (
                  viewingOrderItems.items.map((item: any, idx: number) => {
                    const name = item.product?.name || item.name || item.productName || item.title || 'Product';
                    const price = Number(item.product?.price ?? item.price ?? 0);
                    const qty = Number(item.quantity ?? 1);
                    const lineTotal = Number(item.total ?? (price * qty));
                    const image = item.product?.image || item.image;
                    const addOns = Array.isArray(item.selectedAddOns) ? item.selectedAddOns : [];

                    return (
                      <div key={idx} className="flex items-center justify-between p-3 text-xs gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {image && (
                            <img
                              src={image}
                              alt={name}
                              className="h-8 w-8 rounded-lg object-cover border border-zinc-800 shrink-0 bg-zinc-900"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="h-5 w-5 rounded-md bg-pink-500/20 border border-pink-500/30 text-pink-400 flex items-center justify-center text-[11px] font-bold shrink-0">
                            {qty}x
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-white block truncate">{name}</span>
                            {addOns.length > 0 && (
                              <div className="text-[10px] text-pink-400 truncate">
                                + {addOns.map((a: any) => `${a.name || a.addonName || ''}${a.price ? ` (₹${a.price})` : ''}`).join(', ')}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right font-mono shrink-0">
                          <span className="text-zinc-400 text-[11px] block">₹{price.toFixed(2)} each</span>
                          <div className="font-bold text-white">₹{lineTotal.toFixed(2)}</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-4 text-center text-xs text-zinc-500">No individual item details recorded for this order.</div>
                )}
              </div>
            </div>

            {/* Payment Information */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-zinc-400 font-medium">Payment Status</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        (viewingOrderItems.paymentStatus || '').toLowerCase() === 'paid'
                          ? 'bg-emerald-950 border border-emerald-700 text-emerald-300'
                          : 'bg-amber-950 border border-amber-700 text-amber-300'
                      }`}
                    >
                      {(viewingOrderItems.paymentStatus || '').toLowerCase() === 'paid' ? 'PAID' : 'COD'}
                    </span>
                    {viewingOrderItems.paymentMethod && (
                      <span className="text-xs text-zinc-400 font-mono">({viewingOrderItems.paymentMethod})</span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-zinc-400 font-medium">Total Bill</div>
                  <div className="text-lg font-black font-mono text-pink-400">
                    ₹{(viewingOrderItems.totalAmount || 0).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* COD Payment Collection Option for Delivery Staff & Cashier */}
              {(viewingOrderItems.paymentStatus || '').toLowerCase() !== 'paid' && (
                <div className="pt-2.5 border-t border-zinc-800/80">
                  <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Collect Payment:</span>
                    </span>
                    <span className="text-zinc-400 lowercase font-normal text-[10px]">
                      Select method to mark paid
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      disabled={isProcessingPayment}
                      onClick={() => handleCollectPayment(viewingOrderItems, 'Cash')}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      <Banknote className="h-3.5 w-3.5 shrink-0" />
                      <span>Cash</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingPayment}
                      onClick={() => handleCollectPayment(viewingOrderItems, 'UPI')}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 active:scale-95 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      <QrCode className="h-3.5 w-3.5 shrink-0" />
                      <span>UPI / QR</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessingPayment}
                      onClick={() => handleCollectPayment(viewingOrderItems, 'Card')}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 shadow-md"
                    >
                      <CreditCard className="h-3.5 w-3.5 shrink-0" />
                      <span>Card</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingOrderItems(null)}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 px-4 py-2 text-xs font-bold text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CANCEL / FAILED WITH NOTES */}
      {statusUpdateDelivery && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
          onClick={() => setStatusUpdateDelivery(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 text-white space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-bold text-sm text-red-400">Cancel Delivery</h3>
              <button
                onClick={() => setStatusUpdateDelivery(null)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                Reason / Cancellation Notes
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Customer unreachable, wrong address, rejected..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="w-full rounded-2xl bg-zinc-800 border border-zinc-700 p-2.5 text-xs text-white focus:outline-hidden focus:border-red-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setStatusUpdateDelivery(null)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(statusUpdateDelivery.id, 'cancelled', statusNotes)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: DeliveryStatus }) {
  const map: Record<string, { label: string; bg: string; text: string; icon: any }> = {
    pending: { label: 'Pending', bg: 'bg-amber-950/40 border-amber-800/60', text: 'text-amber-400', icon: Clock },
    assigned: { label: 'Assigned', bg: 'bg-blue-950/40 border-blue-800/60', text: 'text-blue-400', icon: Bike },
    accepted: { label: 'Accepted', bg: 'bg-indigo-950/40 border-indigo-800/60', text: 'text-indigo-400', icon: Check },
    preparing: { label: 'Preparing', bg: 'bg-amber-950/40 border-amber-800/60', text: 'text-amber-400', icon: ChefHat },
    ready_for_pickup: { label: 'Ready', bg: 'bg-blue-950/40 border-blue-800/60', text: 'text-blue-400', icon: PackageCheck },
    picked_up: { label: 'Picked Up', bg: 'bg-purple-950/40 border-purple-800/60', text: 'text-purple-400', icon: PackageCheck },
    out_for_delivery: { label: 'Out for Delivery', bg: 'bg-pink-950/40 border-pink-800/60', text: 'text-pink-400', icon: Truck },
    in_transit: { label: 'In Transit', bg: 'bg-pink-950/40 border-pink-800/60', text: 'text-pink-400', icon: Truck },
    delivered: { label: 'Delivered', bg: 'bg-emerald-950/40 border-emerald-800/60', text: 'text-emerald-400', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', bg: 'bg-red-950/40 border-red-800/60', text: 'text-red-400', icon: XCircle },
    failed: { label: 'Failed', bg: 'bg-red-950/40 border-red-800/60', text: 'text-red-400', icon: XCircle },
  };

  const item = map[status] || map.pending;
  const Icon = item.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${item.bg} ${item.text}`}
    >
      <Icon className="h-2.5 w-2.5" />
      <span>{item.label}</span>
    </span>
  );
}
