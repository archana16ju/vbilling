'use client';

import { useState, useEffect } from 'react';
import {
  Truck,
  X,
  MapPin,
  User,
  Phone,
  FileText,
  Check,
  Search,
  AlertCircle,
  RefreshCw,
  Zap,
  Users,
  CheckCircle2,
} from 'lucide-react';
import { useTableStore } from '@/store/useTableStore';
import { useTerminalStore } from '@/store/useTerminalStore';
import { Customer, DeliveryPerson } from '@/lib/mysql-billing';

interface DeliveryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PendingOnlineOrder {
  deliveryId?: string;
  onlineOrderId: string;
  platform: string;
  customerName: string;
  customerPhone?: string;
  deliveryAddress: string;
  deliveryNotes?: string;
  total?: number;
  items?: Array<{ name: string; quantity: number; price: number }>;
  billId?: string | null;
}

// Helpers to identify dummy/placeholder customer details
function isDummyCustomerName(name?: string | null): boolean {
  if (!name) return true;
  const lower = name.trim().toLowerCase();
  return (
    lower === '' ||
    lower === 'online customer' ||
    lower === 'customer' ||
    lower === 'walk-in' ||
    lower === 'walk in' ||
    lower === 'walk-in customer' ||
    lower === 'rajesh sharma' ||
    lower === 'priya sundaram'
  );
}

function isDummyCustomerPhone(phone?: string | null): boolean {
  if (!phone) return true;
  const trimmed = phone.trim();
  return (
    trimmed === '' ||
    trimmed === '9876543210' ||
    trimmed === '9845012345' ||
    trimmed === '0000000000'
  );
}

function isDummyAddress(addr?: string | null): boolean {
  if (!addr) return true;
  const lower = addr.trim().toLowerCase();
  return (
    lower === '' ||
    lower === 'online order delivery address' ||
    lower === 'no address specified' ||
    lower === '123 main street, sector 4' ||
    lower.includes('green valley apts') ||
    lower.includes('t nagar')
  );
}

export default function DeliveryDetailsModal({ isOpen, onClose }: DeliveryDetailsModalProps) {
  const { deliveryInfo, setDeliveryInfo, clearDeliveryInfo } = useTableStore();
  const { selectedCustomer, setSelectedCustomer, addToCart, cart, activeCompanyId } = useTerminalStore();

  const [platform, setPlatform] = useState<'Delivery' | 'Zomato' | 'Swiggy'>('Delivery');
  const [onlineOrderId, setOnlineOrderId] = useState('');
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');

  // Delivery Staff (from Delivery Collection)
  const [staffList, setStaffList] = useState<DeliveryPerson[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>('auto');
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);

  // Store Customer Directory
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Online orders connection states
  const [showOnlineOrdersPicker, setShowOnlineOrdersPicker] = useState(false);
  const [pendingOrders, setPendingOrders] = useState<PendingOnlineOrder[]>([]);
  const [onlineConfigs, setOnlineConfigs] = useState<any[]>([]);
  const [isLoadingPending, setIsLoadingPending] = useState(false);

  // Fetch Delivery Staff from Delivery Collection
  const loadDeliveryStaff = async () => {
    try {
      setIsLoadingStaff(true);
      const res = await fetch('/api/delivery-persons');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setStaffList(data);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch delivery staff:', e);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      // If deliveryInfo belongs to another company, clear it to prevent cross-company data leakage
      if (deliveryInfo.companyId && activeCompanyId && deliveryInfo.companyId !== activeCompanyId) {
        clearDeliveryInfo();
      }

      const currentPlatform = (deliveryInfo.platform as any) || 'Delivery';
      const initialPlatform = currentPlatform === 'Zomato' ? 'Zomato' : currentPlatform === 'Swiggy' ? 'Swiggy' : 'Delivery';
      setPlatform(initialPlatform);
      setOnlineOrderId(deliveryInfo.onlineOrderId || '');

      const isCrossCompany = Boolean(deliveryInfo.companyId && activeCompanyId && deliveryInfo.companyId !== activeCompanyId);

      // Strictly isolate customer details for online channels:
      // Only display customer details if they are valid, not dummy placeholders, and not from another company.
      // Do NOT leak unrelated selectedCustomer (from table or walk-in) into Zomato/Swiggy.
      if (initialPlatform === 'Zomato' || initialPlatform === 'Swiggy') {
        setCustomerName(!isCrossCompany && !isDummyCustomerName(deliveryInfo.customerName) ? deliveryInfo.customerName : '');
        setCustomerPhone(!isCrossCompany && !isDummyCustomerPhone(deliveryInfo.customerPhone) ? deliveryInfo.customerPhone : '');
        setDeliveryAddress(!isCrossCompany && !isDummyAddress(deliveryInfo.deliveryAddress) ? deliveryInfo.deliveryAddress : '');
      } else {
        // Direct in-house delivery: use saved delivery customer, or empty
        setCustomerName(!isCrossCompany && !isDummyCustomerName(deliveryInfo.customerName) ? deliveryInfo.customerName : '');
        setCustomerPhone(!isCrossCompany && !isDummyCustomerPhone(deliveryInfo.customerPhone) ? deliveryInfo.customerPhone : '');
        setDeliveryAddress(!isCrossCompany && !isDummyAddress(deliveryInfo.deliveryAddress) ? deliveryInfo.deliveryAddress : '');
      }

      setDeliveryNotes(deliveryInfo.deliveryNotes || '');
      const defaultStaff = (initialPlatform === 'Zomato' || initialPlatform === 'Swiggy') ? 'none' : 'auto';
      setSelectedStaffId(deliveryInfo.deliveryPersonId !== undefined ? deliveryInfo.deliveryPersonId : defaultStaff);
      setErrorMsg('');
      setShowCustomerSearch(false);
      setShowOnlineOrdersPicker(false);
      setSearch('');

      // Load registered delivery staff from Delivery Collection
      loadDeliveryStaff();

      // Auto-load pending online orders from API (auto-fills latest order if online channel is active and no order ID set yet)
      const initialOrderId = deliveryInfo.onlineOrderId || '';
      loadPendingOnlineOrders(initialPlatform, false, initialOrderId);

      // Fetch customer list for customer search
      fetch('/api/customers?stats=false')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setCustomers(data);
        })
        .catch(() => {});

      // Fetch platform API integration statuses
      fetch('/api/online-orders/config')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => {
          if (Array.isArray(data)) setOnlineConfigs(data);
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // Load online orders from Zomato / Swiggy
  const loadPendingOnlineOrders = async (targetPlatform?: string, forceAutoFillLatest = false, currentId = '') => {
    try {
      setIsLoadingPending(true);
      const res = await fetch('/api/online-orders/pending');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setPendingOrders(data.orders);
          const activePlat = targetPlatform || platform;
          if (activePlat === 'Zomato' || activePlat === 'Swiggy') {
            const matching = data.orders.filter(
              (o: PendingOnlineOrder) => o.platform.toLowerCase() === activePlat.toLowerCase()
            );
            const effectiveId = currentId !== undefined && currentId !== '' ? currentId : onlineOrderId;
            if (matching.length > 0 && (!effectiveId || forceAutoFillLatest)) {
              handleSelectOnlineOrder(matching[0]);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load pending online orders:', e);
    } finally {
      setIsLoadingPending(false);
    }
  };

  // Switching delivery channels: Clear dummy or unrelated customer data when switching to Zomato/Swiggy
  const handleSwitchPlatform = (newPlatform: 'Delivery' | 'Zomato' | 'Swiggy') => {
    setPlatform(newPlatform);
    setErrorMsg('');
    setSelectedDeliveryId(null);
    if (newPlatform === 'Zomato' || newPlatform === 'Swiggy') {
      setSelectedStaffId('none');
      loadPendingOnlineOrders(newPlatform, true, '');
      if (isDummyCustomerName(customerName)) {
        setCustomerName('');
      }
      if (isDummyCustomerPhone(customerPhone)) {
        setCustomerPhone('');
      }
      if (isDummyAddress(deliveryAddress)) {
        setDeliveryAddress('');
      }
    } else {
      setOnlineOrderId('');
    }
  };

  // Select an incoming Online Order ID
  const handleSelectOnlineOrder = (order: PendingOnlineOrder) => {
    setPlatform(order.platform === 'Swiggy' ? 'Swiggy' : 'Zomato');
    setOnlineOrderId(order.onlineOrderId);
    setSelectedDeliveryId(order.deliveryId || null);
    setSelectedStaffId('none');

    // Only populate customer details if actually received from a valid online order API
    // Do not display dummy, default, or unrelated customer information
    setCustomerName(!isDummyCustomerName(order.customerName) ? order.customerName : '');
    setCustomerPhone(!isDummyCustomerPhone(order.customerPhone) ? order.customerPhone || '' : '');
    setDeliveryAddress(!isDummyAddress(order.deliveryAddress) ? order.deliveryAddress : '');
    setDeliveryNotes(order.deliveryNotes || '');

    // Optionally import items into cart if available and cart is currently empty
    if (cart.length === 0 && Array.isArray(order.items) && order.items.length > 0) {
      order.items.forEach((it: any, idx) => {
        addToCart({
          id: `online_item_${idx}_${Date.now()}`,
          name: it.name || it.product?.name || 'Item',
          sku: `ONL-${idx}`,
          barcode: '',
          price: Number(it.price || it.product?.price) || 0,
          stock: 999,
          unit: 'plate',
          quantityStep: 1,
          categoryId: 'all',
          tax: 5,
          discount: 0,
        });
      });
    }

    setShowOnlineOrdersPicker(false);
    setErrorMsg('');
  };

  const isZomatoConnected = Boolean(
    onlineConfigs.find(
      (c) => c.platform?.toLowerCase() === 'zomato' && c.isEnabled && c.connectionStatus === 'connected'
    )
  );
  const isSwiggyConnected = Boolean(
    onlineConfigs.find(
      (c) => c.platform?.toLowerCase() === 'swiggy' && c.isEnabled && c.connectionStatus === 'connected'
    )
  );
  const isCurrentPlatformConnected =
    platform === 'Zomato' ? isZomatoConnected : platform === 'Swiggy' ? isSwiggyConnected : false;

  if (!isOpen) return null;

  // Selecting an existing customer from the store directory
  const handleSelectCustomer = (cust: Customer) => {
    setCustomerName(cust.name || '');
    setCustomerPhone(cust.phone || '');
    if (cust.address) setDeliveryAddress(cust.address);
    setSelectedCustomer({
      id: cust.id,
      name: cust.name,
      phone: cust.phone,
      email: cust.email,
      address: cust.address,
    });
    setShowCustomerSearch(false);
    setErrorMsg('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if ((platform === 'Zomato' || platform === 'Swiggy') && !onlineOrderId.trim()) {
      setErrorMsg(`Please enter the platform's actual Order ID for ${platform}. Fake order IDs cannot be generated.`);
      return;
    }

    // Direct in-house delivery requires customer details for our riders
    if (platform === 'Delivery') {
      if (!customerName.trim()) {
        setErrorMsg('Customer name is required for in-house delivery.');
        return;
      }
      if (!customerPhone.trim()) {
        setErrorMsg('Customer contact phone is required for in-house delivery.');
        return;
      }
      if (!deliveryAddress.trim()) {
        setErrorMsg('Delivery address is required for in-house delivery.');
        return;
      }
    }

    // Determine assigned staff details
    const assignedStaff = staffList.find((s) => s.id === selectedStaffId);
    let riderName: string | null = null;
    let riderPhone: string | null = null;

    if (assignedStaff) {
      riderName = assignedStaff.name;
      riderPhone = assignedStaff.phone;
    } else if (selectedStaffId === 'auto') {
      riderName = 'Auto-Assign';
    } else if (selectedStaffId === 'none') {
      riderName = null;
    }

    setDeliveryInfo({
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: deliveryAddress.trim(),
      deliveryNotes: deliveryNotes.trim() || undefined,
      platform: platform,
      onlineOrderId: (platform === 'Zomato' || platform === 'Swiggy') ? onlineOrderId.trim() : undefined,
      deliveryPersonId: selectedStaffId,
      deliveryPersonName: riderName,
      deliveryPersonPhone: riderPhone,
      companyId: activeCompanyId || null,
    });

    if (customerName.trim() && platform === 'Delivery') {
      setSelectedCustomer({
        id: selectedCustomer?.id,
        name: customerName.trim(),
        phone: customerPhone.trim(),
        address: deliveryAddress.trim(),
      });
    }

    onClose();
  };

  const filteredCustomers = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 md:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[1360px] max-h-[92vh] flex flex-col rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl text-white overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900/95 px-6 py-3.5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl border shrink-0"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Delivery Order & Staff Assignment</h2>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300">
                  Terminal Dispatch
                </span>
              </div>
              <p className="text-xs text-zinc-400">Configure delivery channel, staff assignment, and customer details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Main scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-4 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {errorMsg && (
              <div className="flex items-center gap-2.5 rounded-xl bg-rose-950/60 border border-rose-800/80 p-3 text-xs text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 3-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
              {/* ======================================================== */}
              {/* 1. LEFT COLUMN: DELIVERY CHANNEL / PLATFORM */}
              {/* ======================================================== */}
              <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/70">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      1. Delivery Channel / Platform
                    </label>
                    <p className="text-[10px] text-zinc-400">Choose in-house or connected channel</p>
                  </div>
                  {(platform === 'Zomato' || platform === 'Swiggy') && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 border ${
                      isCurrentPlatformConnected
                        ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                        : 'text-zinc-400 bg-zinc-800 border-zinc-700'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${isCurrentPlatformConnected ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
                      <span>{isCurrentPlatformConnected ? 'Live API Sync' : 'Manual Entry'}</span>
                    </span>
                  )}
                </div>

                {/* Platforms List */}
                <div className="flex flex-col gap-2.5">
                  {/* Option 1: Delivery */}
                  <button
                    type="button"
                    onClick={() => handleSwitchPlatform('Delivery')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${
                      platform === 'Delivery'
                        ? 'bg-zinc-800/90 border-theme text-white shadow-sm ring-1'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                    style={
                      platform === 'Delivery'
                        ? { borderColor: 'var(--theme-accent, #DB2777)' }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg border text-white shrink-0"
                        style={{
                          backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.2))',
                          borderColor: 'var(--theme-active-border, rgba(219,39,119,0.4))',
                          color: 'var(--theme-accent, #DB2777)',
                        }}
                      >
                        <Truck className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white">Delivery</div>
                        <div className="text-[10px] text-zinc-400">Direct In-House / Store Delivery</div>
                      </div>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        platform === 'Delivery' ? 'border-theme' : 'border-zinc-600'
                      }`}
                      style={platform === 'Delivery' ? { borderColor: 'var(--theme-accent, #DB2777)' } : {}}
                    >
                      {platform === 'Delivery' && (
                        <div
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
                        />
                      )}
                    </div>
                  </button>

                  {/* Option 2: Zomato */}
                  <button
                    type="button"
                    onClick={() => handleSwitchPlatform('Zomato')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${
                      platform === 'Zomato'
                        ? 'bg-red-950/40 border-red-500 text-white shadow-sm ring-1 ring-red-500/50'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 font-black text-white text-base shadow-sm shrink-0">
                        Z
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <span>Zomato</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              isZomatoConnected
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {isZomatoConnected ? '🟢 API Connected' : '⚪ API Not Connected'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {isZomatoConnected
                            ? 'Orders stream automatically with actual Order ID'
                            : 'Manual entry · Enter Order ID from merchant ticket'}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        platform === 'Zomato' ? 'border-red-500' : 'border-zinc-600'
                      }`}
                    >
                      {platform === 'Zomato' && <div className="h-2 w-2 rounded-full bg-red-500" />}
                    </div>
                  </button>

                  {/* Option 3: Swiggy */}
                  <button
                    type="button"
                    onClick={() => handleSwitchPlatform('Swiggy')}
                    className={`flex items-center justify-between p-3 rounded-xl border transition cursor-pointer text-left ${
                      platform === 'Swiggy'
                        ? 'bg-orange-950/40 border-orange-500 text-white shadow-sm ring-1 ring-orange-500/50'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-600 font-black text-white text-base shadow-sm shrink-0">
                        S
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-2">
                          <span>Swiggy</span>
                          <span
                            className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                              isSwiggyConnected
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                            }`}
                          >
                            {isSwiggyConnected ? '🟢 API Connected' : '⚪ API Not Connected'}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {isSwiggyConnected
                            ? 'Orders stream automatically with actual Order ID'
                            : 'Manual entry · Enter Order ID from merchant ticket'}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        platform === 'Swiggy' ? 'border-orange-500' : 'border-zinc-600'
                      }`}
                    >
                      {platform === 'Swiggy' && <div className="h-2 w-2 rounded-full bg-orange-500" />}
                    </div>
                  </button>
                </div>

                {/* Live Incoming Online Orders from Connected API */}
                {(platform === 'Zomato' || platform === 'Swiggy') && (
                  <div className="rounded-xl border border-amber-500/30 bg-zinc-900/90 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-amber-400" />
                        <span className="text-xs font-bold text-amber-300">
                          Live {platform} Orders ({pendingOrders.filter((o) => o.platform.toLowerCase() === platform.toLowerCase()).length})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {pendingOrders.filter((o) => o.platform.toLowerCase() === platform.toLowerCase()).length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const matching = pendingOrders.filter((o) => o.platform.toLowerCase() === platform.toLowerCase());
                              if (matching.length > 0) handleSelectOnlineOrder(matching[0]);
                            }}
                            className="text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded border border-amber-500/30 transition cursor-pointer"
                          >
                            Auto-Fill Latest
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => loadPendingOnlineOrders()}
                          className="text-zinc-400 hover:text-white transition cursor-pointer p-0.5"
                          title="Refresh orders from API"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isLoadingPending ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 pr-1 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {isLoadingPending ? (
                        <p className="text-center text-xs text-zinc-400 py-3">Fetching orders from {platform} API...</p>
                      ) : pendingOrders.filter((o) => o.platform.toLowerCase() === platform.toLowerCase()).length === 0 ? (
                        <div className="text-center py-3.5 px-3 text-xs text-zinc-400 space-y-1.5 bg-zinc-950/60 rounded-lg border border-zinc-800">
                          {isCurrentPlatformConnected ? (
                            <>
                              <p className="text-emerald-400 font-semibold flex items-center justify-center gap-1">
                                <span>🟢 {platform} API Connected</span>
                              </p>
                              <p className="text-[11px] text-zinc-300">
                                No unbilled orders currently in the incoming stream.
                              </p>
                              <p className="text-[10px] text-zinc-500">
                                New orders will automatically appear here when placed on {platform}.
                              </p>
                            </>
                          ) : (
                            <>
                              <p className="text-zinc-400 font-semibold flex items-center justify-center gap-1">
                                <span>⚪ {platform} API Disconnected (Manual Entry)</span>
                              </p>
                              <p className="text-[11px] text-zinc-400">
                                Enter the Order ID below from your {platform} merchant tablet or printed kitchen ticket.
                              </p>
                              <p className="text-[10px] text-zinc-500">
                                To stream orders automatically, connect your API or Webhook in Delivery Management.
                              </p>
                            </>
                          )}
                        </div>
                      ) : (
                        pendingOrders
                          .filter((o) => o.platform.toLowerCase() === platform.toLowerCase())
                          .map((ord) => {
                            const isSelected = selectedDeliveryId
                              ? selectedDeliveryId === ord.deliveryId
                              : onlineOrderId === ord.onlineOrderId;
                            return (
                              <div
                                key={ord.deliveryId || ord.onlineOrderId}
                                onClick={() => handleSelectOnlineOrder(ord)}
                                className={`p-2.5 rounded-lg border cursor-pointer transition flex items-center justify-between ${
                                  isSelected
                                    ? 'border-amber-400 bg-amber-950/40 text-white shadow-sm ring-1 ring-amber-400/50'
                                    : 'border-zinc-800 bg-zinc-950/80 hover:border-amber-500/50 hover:bg-zinc-800/80'
                                }`}
                              >
                                <div className="min-w-0 pr-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-xs text-amber-400">
                                      #{ord.onlineOrderId}
                                    </span>
                                    {ord.customerName && !isDummyCustomerName(ord.customerName) && (
                                      <span className="font-bold text-xs text-white truncate">{ord.customerName}</span>
                                    )}
                                  </div>
                                  {ord.deliveryAddress && !isDummyAddress(ord.deliveryAddress) && (
                                    <div className="text-[10px] text-zinc-400 truncate">
                                      {ord.deliveryAddress}
                                    </div>
                                  )}
                                  {ord.items && ord.items.length > 0 && (
                                    <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                                      {ord.items.map((i: any) => `${i.quantity || 1}x ${i.name || i.product?.name || 'Item'}`).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right shrink-0">
                                  {ord.total && (
                                    <div className="font-mono text-xs font-bold text-emerald-400">
                                      ₹{ord.total}
                                    </div>
                                  )}
                                  <span
                                    className={`inline-block mt-1 text-[9px] font-bold px-2 py-0.5 rounded border ${
                                      isSelected
                                        ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/40'
                                        : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                    }`}
                                  >
                                    {isSelected ? '✓ Auto-Filled' : 'Click to Auto-Fill'}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </div>
                )}

                {/* Actual Order ID Input (When Zomato or Swiggy selected) */}
                {(platform === 'Zomato' || platform === 'Swiggy') && (
                  <div className="space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-300 flex items-center gap-1">
                        <span>Actual {platform} Order ID</span>
                        <span className="text-rose-400">*</span>
                      </label>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          onlineOrderId && pendingOrders.some((o) => o.onlineOrderId === onlineOrderId)
                            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-400'
                            : isCurrentPlatformConnected
                            ? 'bg-amber-950/60 border-amber-800 text-amber-400'
                            : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                        }`}
                      >
                        {onlineOrderId && pendingOrders.some((o) => o.onlineOrderId === onlineOrderId)
                          ? '✓ Auto-synced from API'
                          : isCurrentPlatformConnected
                          ? (onlineOrderId ? 'Manual Override ID' : '🟢 API Connected · Select Order')
                          : 'Manual Ticket Entry'}
                      </span>
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-2.5 flex items-center pointer-events-none">
                        <span className="text-xs font-bold text-zinc-500">#</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder={
                          isCurrentPlatformConnected
                            ? `Click an order above or enter ${platform} ID...`
                            : platform === 'Zomato'
                            ? 'e.g. 1048592039 (from Zomato merchant ticket)'
                            : 'e.g. 149204928173 (from Swiggy partner app)'
                        }
                        value={onlineOrderId}
                        onChange={(e) => setOnlineOrderId(e.target.value)}
                        className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-zinc-500 focus:outline-none focus:border-theme"
                      />
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-normal">
                      {isCurrentPlatformConnected
                        ? `Auto-filled from live ${platform} stream above. Click any card to switch, or enter here to manually override ticket ID.`
                        : `Auto-filled when you click any order from the API above. You only need to type here if punching directly from a printed paper ticket or merchant tablet.`}
                    </p>
                  </div>
                )}
              </div>

              {/* ======================================================== */}
              {/* 2. CENTER COLUMN: ASSIGN DELIVERY STAFF (COLLECTION) */}
              {/* ======================================================== */}
              <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/70">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300 flex items-center gap-1.5">
                      <Users className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                      <span>2. Assign Delivery Staff</span>
                    </label>
                    <p className="text-[10px] text-zinc-400">Delivery Collection & Dispatch</p>
                  </div>
                  <button
                    type="button"
                    onClick={loadDeliveryStaff}
                    className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 cursor-pointer bg-zinc-800/80 hover:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700 transition"
                    title="Refresh delivery staff"
                  >
                    <RefreshCw className={`h-3 w-3 ${isLoadingStaff ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                {/* Platform Context Hint */}
                <div
                  className={`p-2.5 rounded-xl border text-[11px] leading-relaxed ${
                    platform === 'Delivery'
                      ? 'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                      : 'bg-amber-950/30 border-amber-800/40 text-amber-200/90'
                  }`}
                >
                  {platform === 'Delivery' ? (
                    <span>Assign an in-house delivery rider to deliver this order, or choose Auto-Assign based on lowest workload.</span>
                  ) : (
                    <span>
                      <strong>{platform} Staff Assignment:</strong> Choose <em>{platform} Fleet</em> if {platform}&apos;s rider handles delivery, or select an in-house rider if using Self-Delivery / Store Dispatch.
                    </span>
                  )}
                </div>

                {/* Auto-Assign and Unassigned Options */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Auto-Assign */}
                  <div
                    onClick={() => setSelectedStaffId('auto')}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedStaffId === 'auto'
                        ? 'bg-zinc-800/90 border-theme text-white shadow-sm ring-1'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/40'
                    }`}
                    style={
                      selectedStaffId === 'auto'
                        ? { borderColor: 'var(--theme-accent, #DB2777)' }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="flex h-7 w-7 items-center justify-center rounded-lg border text-white text-xs font-bold shrink-0"
                        style={{
                          backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.2))',
                          borderColor: 'var(--theme-active-border, rgba(219,39,119,0.4))',
                          color: 'var(--theme-accent, #DB2777)',
                        }}
                      >
                        ⚡
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">Auto-Assign</div>
                        <div className="text-[10px] text-zinc-400 truncate">Lowest workload</div>
                      </div>
                    </div>
                    {selectedStaffId === 'auto' && (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--theme-accent, #DB2777)' }}
                      />
                    )}
                  </div>

                  {/* Leave Unassigned / Platform Fleet */}
                  <div
                    onClick={() => setSelectedStaffId('none')}
                    className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                      selectedStaffId === 'none'
                        ? 'bg-zinc-800/90 border-theme text-white shadow-sm ring-1'
                        : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/40'
                    }`}
                    style={
                      selectedStaffId === 'none'
                        ? { borderColor: 'var(--theme-accent, #DB2777)' }
                        : {}
                    }
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-400 text-xs font-bold shrink-0">
                        ⚪
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-white truncate">
                          {platform === 'Delivery' ? 'Unassigned' : `${platform} Fleet`}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate">
                          {platform === 'Delivery' ? 'Assign later' : 'Aggregator rider'}
                        </div>
                      </div>
                    </div>
                    {selectedStaffId === 'none' && (
                      <CheckCircle2
                        className="h-4 w-4 shrink-0"
                        style={{ color: 'var(--theme-accent, #DB2777)' }}
                      />
                    )}
                  </div>
                </div>

                {/* In-House Riders Cards */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 px-0.5">
                    <span>Registered In-House Riders ({staffList.length})</span>
                    <span className="text-[10px] text-zinc-500">Pick specific rider</span>
                  </div>

                  <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {staffList.map((staff) => {
                      const isSelected = selectedStaffId === staff.id;
                      const isAvailable =
                        staff.isActive &&
                        staff.availabilityStatus === 'available' &&
                        staff.assignedDeliveryCount < staff.maxActiveDeliveries;
                      const isBusy =
                        staff.assignedDeliveryCount >= staff.maxActiveDeliveries ||
                        staff.availabilityStatus === 'busy';

                      return (
                        <div
                          key={staff.id}
                          onClick={() => setSelectedStaffId(staff.id)}
                          className={`p-2.5 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-zinc-800/90 border-theme text-white shadow-sm ring-1'
                              : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:bg-zinc-800/40'
                          }`}
                          style={
                            isSelected
                              ? { borderColor: 'var(--theme-accent, #DB2777)' }
                              : {}
                          }
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 shrink-0 font-bold text-xs">
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-white truncate flex items-center gap-1.5">
                                <span className="truncate">{staff.name}</span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded font-bold border shrink-0 ${
                                    isAvailable
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                      : isBusy
                                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                  }`}
                                >
                                  {isAvailable
                                    ? '🟢 Available'
                                    : isBusy
                                    ? `🟡 Busy (${staff.assignedDeliveryCount}/${staff.maxActiveDeliveries})`
                                    : '⚪ Offline'}
                                </span>
                              </div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {staff.employeeId} · {staff.phone}
                              </div>
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 ml-2"
                              style={{ color: 'var(--theme-accent, #DB2777)' }}
                            />
                          )}
                        </div>
                      );
                    })}

                    {staffList.length === 0 && !isLoadingStaff && (
                      <div className="text-center py-6 px-4 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/30">
                        <p className="text-xs text-zinc-400">No delivery staff found in Delivery Collection.</p>
                        <p className="text-[10px] text-zinc-500 mt-1">
                          Register delivery staff in Delivery Management to enable direct rider assignments.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ======================================================== */}
              {/* 3. RIGHT COLUMN: CUSTOMER DETAILS */}
              {/* ======================================================== */}
              <div className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/70">
                  <div>
                    <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-300">
                      3. Customer Details
                    </label>
                    <p className="text-[10px] text-zinc-400">
                      {platform === 'Delivery' ? 'Required for delivery routing' : `Auto-synced from ${platform}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCustomerSearch(!showCustomerSearch)}
                    style={{ color: 'var(--theme-accent, #DB2777)' }}
                    className="text-xs font-bold hover:opacity-80 flex items-center gap-1 cursor-pointer shrink-0 bg-zinc-800/80 hover:bg-zinc-800 px-2 py-1 rounded-lg border border-zinc-700 transition"
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span>{showCustomerSearch ? 'Close' : 'Directory'}</span>
                  </button>
                </div>

                {/* Customer Directory Search Drawer */}
                {showCustomerSearch && (
                  <div className="rounded-xl border border-zinc-700 bg-zinc-900/95 p-3 space-y-2">
                    <input
                      type="text"
                      placeholder="Search customer by name, phone or address..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full rounded-lg bg-zinc-950 border border-zinc-700 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-theme"
                      autoFocus
                    />
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1 no-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                      {filteredCustomers.length === 0 ? (
                        <p className="text-[11px] text-zinc-400 py-2 text-center">No matching customers found</p>
                      ) : (
                        filteredCustomers.slice(0, 10).map((c) => (
                          <div
                            key={c.id}
                            onClick={() => handleSelectCustomer(c)}
                            className="flex items-center justify-between rounded-lg p-2 text-xs hover:bg-zinc-800 cursor-pointer transition border border-transparent hover:border-zinc-700"
                          >
                            <div className="min-w-0 pr-2">
                              <div className="font-semibold text-zinc-200 truncate">{c.name}</div>
                              <div className="text-[10px] text-zinc-400 truncate">
                                {c.phone || 'No phone'} · {c.address || 'No address'}
                              </div>
                            </div>
                            <span
                              className="text-[10px] rounded-full border px-2 py-0.5 font-bold shrink-0"
                              style={{
                                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                                color: 'var(--theme-badge-text, #F472B6)',
                              }}
                            >
                              Select
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Customer Name & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Customer Name {platform === 'Delivery' && <span className="text-rose-400">*</span>}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input
                        type="text"
                        required={platform === 'Delivery'}
                        placeholder={
                          platform === 'Delivery' ? 'e.g. Rahul Sharma' : 'Auto-synced or leave blank'
                        }
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-theme"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                      Customer Phone {platform === 'Delivery' && <span className="text-rose-400">*</span>}
                    </label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                      <input
                        type="tel"
                        required={platform === 'Delivery'}
                        placeholder={
                          platform === 'Delivery' ? 'e.g. 9876543210' : 'Contact number (if provided)'
                        }
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-theme"
                      />
                    </div>
                  </div>
                </div>

                {/* Delivery Address */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Delivery Address {platform === 'Delivery' && <span className="text-rose-400">*</span>}
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <textarea
                      required={platform === 'Delivery'}
                      rows={2}
                      placeholder={
                        platform === 'Delivery'
                          ? 'Street address, flat / building number, landmark, locality...'
                          : 'Delivery address (from API or leave blank)'
                      }
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-theme resize-none"
                    />
                  </div>
                </div>

                {/* Delivery Instructions */}
                <div>
                  <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                    Delivery Notes / Instructions (optional)
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="e.g. Ring bell, deliver to security, contactless..."
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      className="w-full rounded-xl bg-zinc-950 border border-zinc-700 pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-theme"
                    />
                  </div>
                </div>

                {(platform === 'Zomato' || platform === 'Swiggy') && (
                  <p className="text-[10px] text-zinc-500 leading-normal pt-1">
                    Customer data is isolated for {platform} orders. Only valid details received from online APIs are displayed.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sticky/Fixed Footer Action Bar */}
          <div className="shrink-0 flex items-center justify-between border-t border-zinc-800 bg-zinc-900/95 px-6 py-3.5 backdrop-blur-md">
            {/* Quick configuration summary */}
            <div className="hidden sm:flex items-center gap-3 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500">Channel:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded text-[11px] border ${
                    platform === 'Zomato'
                      ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : platform === 'Swiggy'
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                      : 'bg-zinc-800 text-zinc-200 border-zinc-700'
                  }`}
                >
                  {platform}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-zinc-500">Staff:</span>
                <span className="font-semibold text-zinc-200 text-[11px]">
                  {selectedStaffId === 'auto'
                    ? '⚡ Auto-Assign'
                    : selectedStaffId === 'none'
                    ? (platform === 'Delivery' ? '⚪ Unassigned' : `⚪ ${platform} Fleet`)
                    : staffList.find((s) => s.id === selectedStaffId)?.name || 'Selected'}
                </span>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-theme-bar hover:opacity-95 px-6 py-2 text-xs font-bold text-white transition shadow-lg shadow-theme-glow border border-theme cursor-pointer active:scale-95"
              >
                <Check className="h-4 w-4" />
                <span>Save & Apply</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
