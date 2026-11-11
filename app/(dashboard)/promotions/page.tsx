'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Tag,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Calendar,
  X,
  RefreshCw,
  Edit2,
  Trash2,
  Percent,
  IndianRupee,
  Gift,
  Zap,
  Sparkles,
  Layers,
} from 'lucide-react';
import { Promotion, PromotionType, PromotionScope } from '@/types/promotions';
import { Category } from '@/lib/mock-data';
import { Product } from '@/types/product';
import {
  getPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  getPromoStackingSetting,
  setPromoStackingSetting,
} from '@/lib/actions/promotions';
import { getCategories, getProducts } from '@/lib/actions/db';
import { useTerminalStore } from '@/store/useTerminalStore';

const DEFAULT_PROMO_TYPES = [
  { id: 'percentage', label: 'Percentage Discount (%)' },
  { id: 'flat_amount', label: 'Flat Amount Discount (₹)' },
  { id: 'happy_hour', label: 'Happy Hour Discount (%)' },
  { id: 'bogo', label: 'Buy 1 Get 1 Free (BOGO)' },
];

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | PromotionType>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'expired'>('all');

  // Custom Promotion Types State
  const [customPromoTypes, setCustomPromoTypes] = useState<{ id: string; label: string }[]>([]);
  const [isAddingCustomType, setIsAddingCustomType] = useState(false);
  const [newCustomTypeName, setNewCustomTypeName] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form State
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formType, setFormType] = useState<PromotionType>('percentage');
  const [formDiscountValue, setFormDiscountValue] = useState('');
  const [formMaxDiscount, setFormMaxDiscount] = useState('');
  const [formMinCartValue, setFormMinCartValue] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formIsHappyHour, setFormIsHappyHour] = useState(false);
  const [formHappyHourStart, setFormHappyHourStart] = useState('16:00:00');
  const [formHappyHourEnd, setFormHappyHourEnd] = useState('19:00:00');
  const [formApplicableDays, setFormApplicableDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [formScope, setFormScope] = useState<PromotionScope>('entire_bill');
  const [formScopeIds, setFormScopeIds] = useState<string[]>([]);
  const [formBogoBuyProduct, setFormBogoBuyProduct] = useState('');
  const [formBogoBuyQty, setFormBogoBuyQty] = useState('1');
  const [formBogoGetProduct, setFormBogoGetProduct] = useState('');
  const [formBogoGetQty, setFormBogoGetQty] = useState('1');
  const [formUsageLimitTotal, setFormUsageLimitTotal] = useState('');
  const [formUsageLimitPerCustomer, setFormUsageLimitPerCustomer] = useState('1');
  const [formBogoBuyPrice, setFormBogoBuyPrice] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Company Promo Stacking Setting
  const [allowPromoStacking, setAllowPromoStacking] = useState<boolean>(false);
  const [isUpdatingStacking, setIsUpdatingStacking] = useState<boolean>(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [promos, cats, prods, stacking] = await Promise.all([
        getPromotions(),
        getCategories(),
        getProducts(),
        getPromoStackingSetting(),
      ]);
      setPromotions(promos);
      useTerminalStore.getState().setPromotions(promos);
      setCategories(cats);
      setProducts(prods);
      setAllowPromoStacking(stacking);
    } catch (err: any) {
      console.error('Failed to load promotions data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleStacking = async () => {
    setIsUpdatingStacking(true);
    try {
      const nextVal = !allowPromoStacking;
      await setPromoStackingSetting(nextVal);
      setAllowPromoStacking(nextVal);
    } catch (err: any) {
      alert(err.message || 'Failed to update promo stacking policy');
    } finally {
      setIsUpdatingStacking(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Load custom promo types from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('custom_promotion_types');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setCustomPromoTypes(parsed);
          }
        }
      } catch (e) {
        console.error('Failed to load custom promotion types from localStorage', e);
      }
    }
  }, []);

  // Merge any custom promo types found in fetched promotions
  useEffect(() => {
    if (promotions.length > 0) {
      setCustomPromoTypes((prev) => {
        const defaultIds = new Set(DEFAULT_PROMO_TYPES.map((d) => d.id));
        const knownIds = new Set([...defaultIds, ...prev.map((c) => c.id)]);
        const newTypes: { id: string; label: string }[] = [];
        for (const promo of promotions) {
          if (promo.promoType && !knownIds.has(promo.promoType)) {
            knownIds.add(promo.promoType);
            const label = promo.promoType
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
              .join(' ');
            newTypes.push({ id: promo.promoType, label });
          }
        }
        if (newTypes.length > 0) {
          const merged = [...prev, ...newTypes];
          if (typeof window !== 'undefined') {
            localStorage.setItem('custom_promotion_types', JSON.stringify(merged));
          }
          return merged;
        }
        return prev;
      });
    }
  }, [promotions]);

  const handleAddCustomType = () => {
    const trimmed = newCustomTypeName.trim();
    if (!trimmed) return;
    const id = trimmed.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const existsInDefault = DEFAULT_PROMO_TYPES.some((d) => d.id === id);
    const existsInCustom = customPromoTypes.some(
      (c) => c.id === id || c.label.toLowerCase() === trimmed.toLowerCase()
    );

    if (!existsInDefault && !existsInCustom) {
      const updated = [...customPromoTypes, { id, label: trimmed }];
      setCustomPromoTypes(updated);
      if (typeof window !== 'undefined') {
        localStorage.setItem('custom_promotion_types', JSON.stringify(updated));
      }
    }

    setFormType(id as PromotionType);
    setNewCustomTypeName('');
    setIsAddingCustomType(false);
  };

  const getPromoTypeLabel = (type: string) => {
    const def = DEFAULT_PROMO_TYPES.find((d) => d.id === type);
    if (def) return def.label;
    const custom = customPromoTypes.find((c) => c.id === type);
    if (custom) return custom.label;
    return type
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  };

  const selectedBuyProduct = useMemo(() => {
    return products.find((p) => p.id === formBogoBuyProduct);
  }, [products, formBogoBuyProduct]);

  const onSelectBogoBuyProduct = (productId: string) => {
    setFormBogoBuyProduct(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod && prod.price != null) {
      setFormBogoBuyPrice(String(prod.price));
    } else {
      setFormBogoBuyPrice('');
    }
  };

  const openCreateModal = () => {
    setEditingPromo(null);
    setFormCode('SAVE10');
    setFormTitle('10% Off Your Entire Bill');
    setFormDescription('Special discount for our valued customers.');
    setFormType('percentage');
    setFormDiscountValue('10');
    setFormMaxDiscount('200');
    setFormMinCartValue('200');
    const today = new Date().toISOString().split('T')[0];
    const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    setFormStartDate(today);
    setFormEndDate(nextMonth);
    setFormIsHappyHour(false);
    setFormHappyHourStart('16:00:00');
    setFormHappyHourEnd('19:00:00');
    setFormApplicableDays(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    setFormScope('entire_bill');
    setFormScopeIds([]);
    const firstProd = products[0];
    setFormBogoBuyProduct(firstProd?.id || '');
    setFormBogoBuyPrice(firstProd?.price != null ? String(firstProd.price) : '');
    setFormBogoBuyQty('1');
    setFormBogoGetProduct(firstProd?.id || '');
    setFormBogoGetQty('1');
    setFormUsageLimitTotal('100');
    setFormUsageLimitPerCustomer('1');
    setFormIsActive(true);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const openEditModal = (promo: Promotion) => {
    setEditingPromo(promo);
    setFormCode(promo.code);
    setFormTitle(promo.title);
    setFormDescription(promo.description || '');
    setFormType(promo.promoType);
    setFormDiscountValue(String(promo.discountValue));
    setFormMaxDiscount(promo.maxDiscountAmount ? String(promo.maxDiscountAmount) : '');
    setFormMinCartValue(String(promo.minCartValue || 0));
    setFormStartDate(promo.startDate);
    setFormEndDate(promo.endDate);
    setFormIsHappyHour(promo.isHappyHour);
    setFormHappyHourStart(promo.happyHourStart || '16:00:00');
    setFormHappyHourEnd(promo.happyHourEnd || '19:00:00');
    setFormApplicableDays(promo.applicableDays || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
    setFormScope(promo.applicableScope);
    setFormScopeIds(promo.scopeIds || []);
    const buyId = promo.bogoBuyProductId || products[0]?.id || '';
    setFormBogoBuyProduct(buyId);
    if (promo.promotionalPrice != null) {
      setFormBogoBuyPrice(String(promo.promotionalPrice));
    } else {
      const buyProd = products.find((p) => p.id === buyId);
      setFormBogoBuyPrice(buyProd?.price != null ? String(buyProd.price) : '');
    }
    setFormBogoBuyQty(String(promo.bogoBuyQuantity || 1));
    setFormBogoGetProduct(promo.bogoGetProductId || products[0]?.id || '');
    setFormBogoGetQty(String(promo.bogoGetQuantity || 1));
    setFormUsageLimitTotal(promo.usageLimitTotal ? String(promo.usageLimitTotal) : '');
    setFormUsageLimitPerCustomer(String(promo.usageLimitPerCustomer || 1));
    setFormIsActive(promo.isActive);
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      setErrorMsg('Promo code is required.');
      return;
    }
    if (!formTitle.trim()) {
      setErrorMsg('Promotion title is required.');
      return;
    }
    const val = parseFloat(formDiscountValue);
    if (isNaN(val) || val < 0) {
      setErrorMsg('Discount value must be a valid number.');
      return;
    }
    if (!formStartDate || !formEndDate) {
      setErrorMsg('Start date and end date are required.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const payload: Partial<Promotion> = {
        code: formCode.trim().toUpperCase(),
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        promoType: formType,
        discountValue: val,
        maxDiscountAmount: formMaxDiscount ? parseFloat(formMaxDiscount) : null,
        minCartValue: formMinCartValue ? parseFloat(formMinCartValue) : 0,
        startDate: formStartDate,
        endDate: formEndDate,
        isHappyHour: formIsHappyHour,
        happyHourStart: formIsHappyHour ? formHappyHourStart : null,
        happyHourEnd: formIsHappyHour ? formHappyHourEnd : null,
        applicableDays: formApplicableDays,
        applicableScope: formScope,
        scopeIds: formScope === 'entire_bill' ? null : formScopeIds,
        bogoBuyProductId: formType === 'bogo' ? formBogoBuyProduct : null,
        bogoBuyQuantity: formType === 'bogo' ? parseInt(formBogoBuyQty) || 1 : 1,
        promotionalPrice: formType === 'bogo' && formBogoBuyPrice ? parseFloat(formBogoBuyPrice) : null,
        bogoGetProductId: formType === 'bogo' ? formBogoGetProduct : null,
        bogoGetQuantity: formType === 'bogo' ? parseInt(formBogoGetQty) || 1 : 1,
        usageLimitTotal: formUsageLimitTotal ? parseInt(formUsageLimitTotal) : null,
        usageLimitPerCustomer: parseInt(formUsageLimitPerCustomer) || 1,
        isActive: formIsActive,
      };

      if (editingPromo) {
        await updatePromotion(editingPromo.id, payload);
      } else {
        await createPromotion(payload as any);
      }

      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save promotion.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this promotion?')) return;
    try {
      await deletePromotion(id);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete promotion.');
    }
  };

  const metrics = useMemo(() => {
    const total = promotions.length;
    const nowStr = new Date().toISOString().split('T')[0];
    const active = promotions.filter((p) => p.isActive && p.endDate >= nowStr).length;
    const happyHours = promotions.filter((p) => p.isHappyHour && p.isActive).length;
    const totalUses = promotions.reduce((sum, p) => sum + (p.totalUsedCount || 0), 0);
    return { total, active, happyHours, totalUses };
  }, [promotions]);

  const filteredPromotions = useMemo(() => {
    const nowStr = new Date().toISOString().split('T')[0];
    return promotions.filter((p) => {
      if (typeFilter !== 'all' && p.promoType !== typeFilter) return false;
      if (statusFilter === 'active' && (!p.isActive || p.endDate < nowStr)) return false;
      if (statusFilter === 'inactive' && p.isActive) return false;
      if (statusFilter === 'expired' && p.endDate >= nowStr) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          p.code.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [promotions, typeFilter, statusFilter, searchQuery]);

  const toggleDay = (day: string) => {
    if (formApplicableDays.includes(day)) {
      setFormApplicableDays(formApplicableDays.filter((d) => d !== day));
    } else {
      setFormApplicableDays([...formApplicableDays, day]);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-theme-bar p-6 text-white shadow-2xl border border-theme">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner">
              <Tag className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Discounts, Coupons & Promotions</h1>
              <p className="text-xs text-white/80 mt-1">
                Configure promo codes, minimum cart rules, Happy Hours, and BOGO deals for your POS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/30 px-3.5 py-2 text-xs font-bold text-white hover:bg-black/50 transition cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openCreateModal}
              style={{ color: '#0f172a' }}
              className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-pink-100 shadow-lg transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              New Promotion
            </button>
          </div>
        </div>
      </div>

      {/* Company Promo Stacking Rule Config */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-zinc-800 bg-zinc-900/60">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-400 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-white">Promo Stacking Policy</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${allowPromoStacking ? 'bg-emerald-950/80 text-emerald-400 border-emerald-800' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                {allowPromoStacking ? 'Stacking Allowed' : 'Strict Isolation (Default)'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {allowPromoStacking
                ? 'Cashiers can combine manual cashier discounts with promo code discounts on the same bill.'
                : 'Cashiers cannot combine manual discounts and promotional coupons on the same bill.'}
            </p>
          </div>
        </div>

        <button
          onClick={handleToggleStacking}
          disabled={isUpdatingStacking}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 ${allowPromoStacking ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'}`}
        >
          {isUpdatingStacking ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <span className={`h-2.5 w-2.5 rounded-full ${allowPromoStacking ? 'bg-emerald-300' : 'bg-zinc-500'}`} />
          )}
          <span>{allowPromoStacking ? 'Disable Stacking' : 'Enable Stacking'}</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Promos</span>
            <Tag className="h-4 w-4 text-theme-accent" />
          </div>
          <div className="text-2xl font-black text-white">{metrics.total}</div>
        </div>

        <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-4">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Active Campaigns</span>
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-emerald-400">{metrics.active}</div>
        </div>

        <div className="rounded-2xl border border-purple-900/40 bg-purple-950/20 p-4">
          <div className="flex items-center justify-between text-purple-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Happy Hours</span>
            <Zap className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-purple-400">{metrics.happyHours}</div>
        </div>

        <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-4">
          <div className="flex items-center justify-between text-blue-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Usages</span>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black text-blue-400">{metrics.totalUses}</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search code or title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 pl-9 pr-3 text-xs text-white placeholder-zinc-500 focus:border-theme focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e: any) => setTypeFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 px-3 text-xs text-zinc-300 focus:border-theme focus:outline-none cursor-pointer"
          >
            <option value="all">All Promo Types</option>
            {DEFAULT_PROMO_TYPES.map((pt) => (
              <option key={pt.id} value={pt.id}>
                {pt.label}
              </option>
            ))}
            {customPromoTypes.length > 0 && (
              <optgroup label="Customised Types">
                {customPromoTypes.map((pt) => (
                  <option key={pt.id} value={pt.id}>
                    {pt.label}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-zinc-800 bg-zinc-900/80 py-2 px-3 text-xs text-zinc-300 focus:border-theme focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
            <option value="expired">Expired Only</option>
          </select>
        </div>
      </div>

      {/* Promotions List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-16 text-center text-zinc-500">
            <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-theme-accent" />
            Loading promotions...
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="col-span-full py-16 text-center text-zinc-500 border border-zinc-800 rounded-3xl bg-zinc-900/30">
            <Tag className="h-10 w-10 mx-auto mb-2 opacity-30" />
            No promotions found matching current filters.
          </div>
        ) : (
          filteredPromotions.map((promo) => {
            const nowStr = new Date().toISOString().split('T')[0];
            const isExpired = promo.endDate < nowStr;
            return (
              <div
                key={promo.id}
                className={`relative rounded-2xl border p-5 transition flex flex-col justify-between ${
                  !promo.isActive || isExpired
                    ? 'border-zinc-800 bg-zinc-900/40 opacity-70'
                    : 'border-zinc-800 bg-zinc-900/80 hover:border-theme hover:shadow-theme-glow'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono font-black text-sm text-theme-accent bg-theme-badge border border-theme px-2.5 py-1 rounded-lg">
                      {promo.code}
                    </span>
                    <div className="flex items-center gap-1">
                      {isExpired ? (
                        <span className="rounded-full bg-rose-950/60 border border-rose-800 px-2 py-0.5 text-[9px] font-bold text-rose-400">
                          Expired
                        </span>
                      ) : promo.isActive ? (
                        <span className="rounded-full bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2 py-0.5 text-[9px] font-bold text-zinc-400">
                          Disabled
                        </span>
                      )}
                    </div>
                  </div>

                  <h3 className="font-bold text-white text-sm mt-1">{promo.title}</h3>
                  {promo.description && (
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{promo.description}</p>
                  )}

                  <div className="mt-3 pt-3 border-t border-zinc-800/80 space-y-1.5 text-xs text-zinc-400">
                    <div className="flex justify-between">
                      <span>Discount:</span>
                      <span className="font-bold text-white font-mono">
                        {promo.promoType === 'percentage'
                          ? `${promo.discountValue}% OFF`
                          : promo.promoType === 'flat_amount'
                          ? `₹${promo.discountValue.toFixed(2)} FLAT`
                          : promo.promoType === 'happy_hour'
                          ? `${promo.discountValue}% (Happy Hour)`
                          : promo.promoType === 'bogo'
                          ? 'BOGO (Buy 1 Get 1)'
                          : `${promo.discountValue}% (${getPromoTypeLabel(promo.promoType)})`}
                      </span>
                    </div>

                    {promo.promotionalPrice != null && (
                      <div className="flex justify-between">
                        <span>Promotional Price:</span>
                        <span className="text-amber-400 font-mono font-bold">₹{Number(promo.promotionalPrice).toFixed(2)}</span>
                      </div>
                    )}

                    {promo.minCartValue > 0 && (
                      <div className="flex justify-between">
                        <span>Min Cart Value:</span>
                        <span className="text-zinc-200 font-mono">₹{promo.minCartValue.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Valid:</span>
                      <span className="text-zinc-300">
                        {promo.startDate} to {promo.endDate}
                      </span>
                    </div>

                    {promo.isHappyHour && promo.happyHourStart && (
                      <div className="flex justify-between text-purple-400 font-semibold">
                        <span>Time Window:</span>
                        <span>
                          {promo.happyHourStart} - {promo.happyHourEnd}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between">
                      <span>Total Used:</span>
                      <span className="font-mono text-zinc-300">
                        {promo.totalUsedCount} {promo.usageLimitTotal ? `/ ${promo.usageLimitTotal}` : 'times'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">
                    {promo.applicableScope === 'entire_bill'
                      ? 'Entire Bill'
                      : promo.applicableScope === 'specific_categories'
                      ? 'Categories'
                      : 'Specific Products'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEditModal(promo)}
                      className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition cursor-pointer"
                      title="Edit Promotion"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(promo.id)}
                      className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/40 transition cursor-pointer"
                      title="Delete Promotion"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create / Edit Promotion */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-white">
                {editingPromo ? 'Edit Promotion' : 'Create New Promotion'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white rounded-lg p-1 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="rounded-xl border border-rose-800 bg-rose-950/50 p-3 text-xs text-rose-300">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Promo Code *</label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. SAVE10"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono uppercase font-bold text-theme-accent focus:border-theme focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-zinc-400">Promotion Type</label>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomType((prev) => !prev)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-theme-accent hover:underline transition"
                      title="Add Custom Promotion Type"
                    >
                      <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                      <span>Customise</span>
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formType}
                      onChange={(e: any) => setFormType(e.target.value)}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-white focus:border-theme focus:outline-none"
                    >
                      {DEFAULT_PROMO_TYPES.map((pt) => (
                        <option key={pt.id} value={pt.id}>
                          {pt.label}
                        </option>
                      ))}
                      {customPromoTypes.length > 0 && (
                        <optgroup label="Customised Types">
                          {customPromoTypes.map((pt) => (
                            <option key={pt.id} value={pt.id}>
                              {pt.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsAddingCustomType((prev) => !prev)}
                      className="p-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-300 hover:text-white hover:border-theme transition cursor-pointer shrink-0"
                      title="Add Custom Promotion Type"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {isAddingCustomType && (
                    <div className="mt-2 flex items-center gap-1.5 p-1.5 rounded-xl border border-theme bg-zinc-950">
                      <input
                        type="text"
                        value={newCustomTypeName}
                        onChange={(e) => setNewCustomTypeName(e.target.value)}
                        placeholder="Enter custom promotion type..."
                        className="flex-1 bg-transparent px-2 py-1 text-xs text-white placeholder-zinc-500 focus:outline-none"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomType();
                          } else if (e.key === 'Escape') {
                            setIsAddingCustomType(false);
                            setNewCustomTypeName('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomType}
                        className="px-2.5 py-1 text-xs font-bold bg-theme-bar hover:opacity-90 text-white rounded-lg transition"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingCustomType(false);
                          setNewCustomTypeName('');
                        }}
                        className="p-1 text-zinc-400 hover:text-white rounded-lg transition"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. 10% Off on Weekend Dinners"
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-white focus:border-theme focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Description (Optional)</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={2}
                  placeholder="Additional conditions or promo details..."
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-white focus:border-theme focus:outline-none"
                />
              </div>

              {formType !== 'bogo' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      {formType === 'percentage' || formType === 'happy_hour'
                        ? 'Discount Percentage (%) *'
                        : formType === 'flat_amount'
                        ? 'Flat Discount Amount (₹) *'
                        : `${getPromoTypeLabel(formType)} Value *`}
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={formDiscountValue}
                      onChange={(e) => setFormDiscountValue(e.target.value)}
                      placeholder={formType === 'percentage' || formType === 'happy_hour' ? '10' : '50.00'}
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-white focus:border-theme focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                      Max Discount Cap (₹)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={formMaxDiscount}
                      onChange={(e) => setFormMaxDiscount(e.target.value)}
                      placeholder="e.g. 200 (optional)"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-white focus:border-theme focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* BOGO Fields */}
              {formType === 'bogo' && (
                <div className="space-y-3 rounded-2xl border border-purple-900/50 bg-purple-950/20 p-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-300 mb-1">Buy Item</label>
                      <select
                        value={formBogoBuyProduct}
                        onChange={(e) => onSelectBogoBuyProduct(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} (₹{Number(p.price).toFixed(2)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-300 mb-1">
                        Buy Item&apos;s Price (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={formBogoBuyPrice}
                        onChange={(e) => setFormBogoBuyPrice(e.target.value)}
                        placeholder={selectedBuyProduct?.price != null ? String(selectedBuyProduct.price) : '0.00'}
                        className="w-full rounded-xl border border-purple-800/60 bg-zinc-950 p-2 font-mono text-white focus:border-purple-400 focus:outline-none"
                      />
                    </div>
                  </div>

                  {selectedBuyProduct && (
                    <div className="flex items-center justify-between text-[11px] text-purple-300/80 bg-purple-900/30 px-3 py-1.5 rounded-lg border border-purple-800/40">
                      <span>Original Selling Price: <strong className="text-white font-mono">₹{Number(selectedBuyProduct.price).toFixed(2)}</strong></span>
                      <span>Custom Promo Price: <strong className="text-amber-300 font-mono">₹{formBogoBuyPrice ? Number(formBogoBuyPrice).toFixed(2) : Number(selectedBuyProduct.price).toFixed(2)}</strong></span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-1 border-t border-purple-900/40">
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-300 mb-1">Buy Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={formBogoBuyQty}
                        onChange={(e) => setFormBogoBuyQty(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2 font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-purple-300 mb-1">Get Free Item</label>
                      <select
                        value={formBogoGetProduct}
                        onChange={(e) => setFormBogoGetProduct(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-white"
                      >
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Min Cart Subtotal (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formMinCartValue}
                    onChange={(e) => setFormMinCartValue(e.target.value)}
                    placeholder="e.g. 250.00"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-white focus:border-theme focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                    Usage Limit Per Customer
                  </label>
                  <input
                    type="number"
                    value={formUsageLimitPerCustomer}
                    onChange={(e) => setFormUsageLimitPerCustomer(e.target.value)}
                    placeholder="1"
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-white focus:border-theme focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-white focus:border-theme focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-400 mb-1">End Date *</label>
                  <input
                    type="date"
                    required
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-white focus:border-theme focus:outline-none"
                  />
                </div>
              </div>

              {/* Happy Hour Toggle & Times */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsHappyHour}
                      onChange={(e) => setFormIsHappyHour(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-theme-accent focus:ring-0"
                    />
                    <span className="font-semibold text-white">Enable Happy Hour Time Restriction</span>
                  </label>
                  {formIsHappyHour && (
                    <span className="text-[10px] text-purple-400 font-bold uppercase tracking-wider">
                      Time-Window Active
                    </span>
                  )}
                </div>

                {formIsHappyHour && (
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800">
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">Start Time (HH:MM:SS)</label>
                      <input
                        type="time"
                        step="1"
                        value={formHappyHourStart}
                        onChange={(e) => setFormHappyHourStart(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-zinc-400 mb-1">End Time (HH:MM:SS)</label>
                      <input
                        type="time"
                        step="1"
                        value={formHappyHourEnd}
                        onChange={(e) => setFormHappyHourEnd(e.target.value)}
                        className="w-full rounded-xl border border-zinc-800 bg-zinc-900 p-2 text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Applicable Days */}
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1.5">
                  Valid Days of Week
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                    const isSelected = formApplicableDays.includes(day);
                    return (
                      <button
                        type="button"
                        key={day}
                        onClick={() => toggleDay(day)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition cursor-pointer ${
                          isSelected
                            ? 'bg-theme-bar border-theme text-white shadow-theme-glow'
                            : 'border-zinc-800 bg-zinc-950 text-zinc-500 hover:text-white'
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="rounded border-zinc-700 bg-zinc-900 text-theme-accent focus:ring-0"
                  />
                  <span className="font-semibold text-white">Active and ready to use in Terminal</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="rounded-xl bg-theme-bar border border-theme shadow-theme-glow px-5 py-2 text-xs font-bold text-white hover:opacity-95 transition disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : editingPromo ? 'Update Promotion' : 'Save Promotion'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
