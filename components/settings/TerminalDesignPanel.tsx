'use client';

import React, { useState, useEffect } from 'react';
import {
  useTerminalDesignStore,
  THEME_PRESETS,
  TerminalDesignState,
} from '@/store/useTerminalDesignStore';
import {
  LayoutGrid,
  Palette,
  Sliders,
  Sparkles,
  RotateCcw,
  Check,
  Eye,
  Layers,
  Smartphone,
  Tag,
  Table,
  ScanBarcode,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  SunMoon,
  Building2,
  UtensilsCrossed,
  List,
  Grid,
  Grid2X2,
  Search,
} from 'lucide-react';

const DEMO_CATEGORIES = [
  { id: 'all', name: 'All Items', image: '' },
  { id: 'cat-biryani', name: 'Biryani', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=300&auto=format&fit=crop&q=80' },
  { id: 'cat-breads', name: 'Breads / Parotta', image: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=300&auto=format&fit=crop&q=80' },
  { id: 'cat-rice', name: 'Chinese Rice', image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&auto=format&fit=crop&q=80' },
  { id: 'cat-starters', name: 'Chinese Starters', image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=300&auto=format&fit=crop&q=80' },
  { id: 'cat-egg', name: 'Egg', image: 'https://images.unsplash.com/photo-1525351484163-7529414344d8?w=300&auto=format&fit=crop&q=80' },
];
import ProductGridCard from '@/components/terminal/ProductGridCard';
import { Product } from '@/lib/mock-data';

// Sample demonstration products matching the user's reference image!
const PREVIEW_PRODUCTS: Product[] = [
  {
    id: 'demo-apple',
    name: 'Fresh Red Apple',
    sku: 'FRU-01',
    barcode: '9001',
    price: 3.99,
    stock: 50,
    unit: 'kg',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-avocado',
    name: 'Ripe Hass Avocado',
    sku: 'FRU-02',
    barcode: '9002',
    price: 2.49,
    stock: 35,
    unit: 'pcs',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-banana',
    name: 'Organic Bananas',
    sku: 'FRU-03',
    barcode: '9003',
    price: 1.29,
    stock: 60,
    unit: 'bunch',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-tomato',
    name: 'Heirloom Tomatoes',
    sku: 'VEG-01',
    barcode: '9004',
    price: 4.50,
    stock: 40,
    unit: 'kg',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-cucumber',
    name: 'English Cucumber',
    sku: 'VEG-02',
    barcode: '9005',
    price: 1.79,
    stock: 45,
    unit: 'pcs',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1449339854873-750e6913301b?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-strawberry',
    name: 'Sweet Strawberries Box',
    sku: 'FRU-04',
    barcode: '9006',
    price: 4.99,
    stock: 25,
    unit: 'box',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1464965911861-746a04b4bca6?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-avocado-2',
    name: 'Mini Avocado Pack',
    sku: 'FRU-05',
    barcode: '9007',
    price: 1.35,
    stock: 30,
    unit: 'pcs',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
  },
  {
    id: 'demo-avocado-active',
    name: 'Premium California Avocado',
    sku: 'FRU-06',
    barcode: '9008',
    price: 3.99,
    stock: 20,
    unit: 'pcs',
    quantityStep: 1,
    categoryId: 'c1',
    image: 'https://images.unsplash.com/photo-1523049673857-eb18f1d7b578?auto=format&fit=crop&w=600&q=80',
  },
];

export default function TerminalDesignPanel() {
  const design = useTerminalDesignStore();
  const [activeSubTab, setActiveSubTab] = useState<'layout' | 'appearance' | 'product-card' | 'category-design' | 'tap-banner'>('layout');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [saveToast, setSaveToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewActiveId, setPreviewActiveId] = useState<string>('demo-avocado-active');
  const [previewCategoryId, setPreviewCategoryId] = useState<string>('all');
  const [previewSearch, setPreviewSearch] = useState<string>('');

  // Super Admin & Company State
  const [role, setRole] = useState<string | null>(null);
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Automatically fetch authoritative company terminal design on mount
  useEffect(() => {
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const userRole = roleMatch ? roleMatch[2] : null;
    setRole(userRole);

    const cidMatch = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
    const userCid = cidMatch ? cidMatch[2] : '';

    if (userRole === 'super_admin') {
      fetch('/api/companies')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setAllCompanies(data);
            const activeCid = userCid || data[0].id;
            setSelectedCompanyId(activeCid);
            design.fetchCompanyTerminalDesign(activeCid, true);
          } else {
            design.fetchCompanyTerminalDesign(undefined, true);
          }
        })
        .catch(() => {
          design.fetchCompanyTerminalDesign(undefined, true);
        });
    } else {
      if (userCid) setSelectedCompanyId(userCid);
      design.fetchCompanyTerminalDesign(userCid || undefined, true);
    }
  }, []);

  const handleCompanyChange = (newCid: string) => {
    setSelectedCompanyId(newCid);
    design.fetchCompanyTerminalDesign(newCid, true);
  };

  // Sync preview theme when design.themeMode changes
  useEffect(() => {
    if (design.themeMode === 'light') {
      setPreviewTheme('light');
    } else if (design.themeMode === 'dark') {
      setPreviewTheme('dark');
    } else {
      const isDocLight = typeof document !== 'undefined' && document.documentElement.classList.contains('light-mode');
      setPreviewTheme(isDocLight ? 'light' : 'dark');
    }
  }, [design.themeMode]);

  const handleSave = async () => {
    setSaveError(null);
    const result = await design.saveToDatabase(selectedCompanyId || undefined);
    if (result.success) {
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 3000);
    } else {
      setSaveError(result.error || 'Failed to save terminal design settings.');
      setTimeout(() => setSaveError(null), 5000);
    }
  };

  const handleReset = async () => {
    if (confirm('Are you sure you want to reset all Terminal Design settings to default?')) {
      const result = await design.resetInDatabase(selectedCompanyId || undefined);
      if (result.success) {
        setSaveToast(true);
        setTimeout(() => setSaveToast(false), 3000);
        setPreviewActiveId('demo-avocado-active');
      } else {
        setSaveError(result.error || 'Failed to reset terminal design settings.');
      }
    }
  };

  const applyThemePreset = (presetKey: string) => {
    const preset = THEME_PRESETS[presetKey];
    if (preset) {
      design.updateDesign({
        themePreset: presetKey as any,
        accentColor: preset.accentColor,
        activeBorderColor: preset.activeBorderColor,
        bannerBgColor: preset.bannerBgColor,
      });
    }
  };

  const isImageGrid = design.displayStyle === 'image-grid' || design.displayStyle === 'compact-grid';
  const isLightPreview = previewTheme === 'light';

  return (
    <div className="space-y-6">
      {/* Header with Save / Reset */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl text-white backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl theme-icon-box shadow-md">
                <LayoutGrid className="h-5 w-5" />
              </span>
              <h2 className="text-xl font-black text-white">Terminal Design Settings</h2>
            </div>
            <p className="mt-1 text-xs text-zinc-400">
              Customize the center terminal layout, product cards, dark &amp; light theme modes, colors, and tap interactions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              disabled={design.isSaving}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3.5 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={design.isSaving}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white preserve-white border-theme shadow-lg shadow-theme-glow hover:opacity-95 active:scale-95 transition-all disabled:opacity-60 cursor-pointer"
            >
              {design.isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>

        {saveToast && (
          <div className="mt-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 p-3 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <Check className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>Terminal design settings saved and applied to POS Terminal successfully!</span>
          </div>
        )}

        {saveError && (
          <div className="mt-4 rounded-xl bg-rose-950/60 border border-rose-500/40 p-3 text-xs font-semibold text-rose-300 flex items-center gap-2 animate-in fade-in">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
      </div>

      {/* Super Admin Target Company Selector */}
      {role === 'super_admin' && allCompanies.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 shadow-xl text-white backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
            <Building2 className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
            <span>Target Company for Terminal Design:</span>
          </div>
          <select
            value={selectedCompanyId}
            onChange={(e) => handleCompanyChange(e.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-theme focus:ring-1 focus:ring-theme cursor-pointer"
          >
            {allCompanies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Main Settings Navigation & Configuration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Column */}
        <div className="lg:col-span-7 xl:col-span-7 space-y-6">
          {/* Subtabs */}
          <div className="flex rounded-xl bg-zinc-950/80 p-1 border border-zinc-800 shadow-md">
            {[
              { id: 'layout', label: 'Layout & Grid' },
              { id: 'product-card', label: 'Product Card' },
              { id: 'category-design', label: 'Category Design' },
              { id: 'appearance', label: 'Theme & Colors' },
              { id: 'tap-banner', label: 'Tap Mode Banner' },
            ].map((tab) => {
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all cursor-pointer ${isActive
                    ? 'btn-theme-primary text-white shadow-theme-glow preserve-white font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Subtab 1: Layout & Grid */}
          {activeSubTab === 'layout' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl space-y-6 text-white backdrop-blur-sm">
              <div>
                <label className="block text-sm font-bold text-white mb-1">
                  Product Display Style
                </label>
                <p className="text-xs text-zinc-400 mb-3">
                  Choose between the default classic list or the new visual image grid matching the reference design.
                </p>

                <div className="flex flex-col gap-3.5">
                  {/* Option 1: Classic List (Default) */}
                  <div
                    onClick={() => design.updateDesign({ displayStyle: 'default' })}
                    className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${design.displayStyle === 'default'
                      ? 'border-emerald-500 bg-emerald-950/30 shadow-md ring-2 ring-emerald-500/20'
                      : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                      }`}
                  >
                    {/* Header: Icon, Title, Badge & Radio */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${design.displayStyle === 'default'
                            ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:bg-zinc-800'
                            }`}
                        >
                          <Table className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              Classic List (Default)
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-0.5 rounded-full">
                              Preserved Default
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Radio / Selection Indicator */}
                      <div className="shrink-0 flex items-center gap-2">
                        {design.displayStyle === 'default' && (
                          <span className="hidden sm:inline-flex text-[11px] font-bold text-emerald-300 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                            Active
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${design.displayStyle === 'default'
                            ? 'border-emerald-500 bg-emerald-600 text-white shadow-xs'
                            : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                            }`}
                        >
                          {design.displayStyle === 'default' && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-zinc-400 sm:pl-[52px] leading-relaxed mb-3">
                      Original table layout with columns for Product, Price, and Quick Tender.
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        ⚡ Fast Line Billing
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        📋 Product, Price &amp; Tender
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        ⌨️ Keyboard-First Workflow
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Visual Image Grid */}
                  <div
                    onClick={() => design.updateDesign({ displayStyle: 'image-grid' })}
                    className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${design.displayStyle === 'image-grid'
                      ? 'border-theme bg-theme-badge/20 shadow-md ring-2 ring-theme/30'
                      : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                      }`}
                    style={
                      design.displayStyle === 'image-grid'
                        ? {
                          borderColor: 'var(--theme-accent, #DB2777)',
                          backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.12))',
                        }
                        : undefined
                    }
                  >
                    {/* Header: Icon, Title, Badge & Radio */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${design.displayStyle === 'image-grid'
                            ? 'shadow-xs text-white'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:bg-zinc-800'
                            }`}
                          style={
                            design.displayStyle === 'image-grid'
                              ? {
                                backgroundColor: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-accent, #DB2777)',
                              }
                              : undefined
                          }
                        >
                          <LayoutGrid className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              Visual Image Grid
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                                color: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                              }}
                            >
                              Image Grid
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Radio / Selection Indicator */}
                      <div className="shrink-0 flex items-center gap-2">
                        {design.displayStyle === 'image-grid' && (
                          <span
                            className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                              color: 'var(--theme-accent, #DB2777)',
                            }}
                          >
                            Active
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${design.displayStyle === 'image-grid'
                            ? 'text-white shadow-xs'
                            : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                            }`}
                          style={
                            design.displayStyle === 'image-grid'
                              ? {
                                backgroundColor: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-accent, #DB2777)',
                              }
                              : undefined
                          }
                        >
                          {design.displayStyle === 'image-grid' && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-zinc-400 sm:pl-[52px] leading-relaxed mb-3">
                      Modern photo-centric cards with high-contrast price pills and active touch feedback.
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🖼️ High-Res Photo Cards
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        👆 Touch &amp; Tap to Add
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🏷️ Dark &amp; Light Price Pills
                      </span>
                    </div>
                  </div>

                  {/* Option 3: Search-Based Fast Billing */}
                  <div
                    onClick={() => design.updateDesign({ displayStyle: 'search-based' })}
                    className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${design.displayStyle === 'search-based'
                      ? 'border-indigo-500 bg-indigo-950/30 shadow-md ring-2 ring-indigo-500/20'
                      : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                      }`}
                  >
                    {/* Header: Icon, Title, Badge & Radio */}
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${design.displayStyle === 'search-based'
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                            : 'bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:bg-zinc-800'
                            }`}
                        >
                          <ScanBarcode className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              Search-Based Billing
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 bg-indigo-950/60 border border-indigo-500/40 px-2.5 py-0.5 rounded-full">
                              <Sparkles className="h-3 w-3 text-indigo-400" />
                              Fast Scan Standby
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Radio / Selection Indicator */}
                      <div className="shrink-0 flex items-center gap-2">
                        {design.displayStyle === 'search-based' && (
                          <span className="hidden sm:inline-flex text-[11px] font-bold text-indigo-300 bg-indigo-950/70 border border-indigo-500/30 px-2 py-0.5 rounded-md">
                            Active
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${design.displayStyle === 'search-based'
                            ? 'border-indigo-500 bg-indigo-600 text-white shadow-xs'
                            : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                            }`}
                        >
                          {design.displayStyle === 'search-based' && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs sm:text-sm text-zinc-400 sm:pl-[52px] leading-relaxed mb-3">
                      Product area stays empty by default. Type name or scan barcode to display matching products; auto-adds to cart.
                    </p>

                    {/* Feature Pills */}
                    <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🔍 Standby Clean Screen
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        ⚡ Instant Barcode &amp; SKU Match
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🛒 Auto-Add on Selection
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid Column Selector (Only applies for Visual Image Grid) */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                {!isImageGrid && (
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-400">
                    <span className="text-base">🔒</span>
                    <span>Grid settings below only apply to <strong className="text-zinc-200">Visual Image Grid</strong> layout. Select it above to enable these options.</span>
                  </div>
                )}

                <div className={!isImageGrid ? 'opacity-40 pointer-events-none select-none' : ''}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Grid Columns
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { cols: 3, label: '3 Columns (Spacious)' },
                      { cols: 4, label: '4 Columns (Reference)' },
                      { cols: 5, label: '5 Columns (Dense)' },
                    ].map((item) => (
                      <button
                        key={item.cols}
                        type="button"
                        onClick={() => design.updateDesign({ gridColumns: item.cols })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${design.gridColumns === item.cols
                          ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Aspect Ratio */}
                <div className={!isImageGrid ? 'opacity-40 pointer-events-none select-none' : ''}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Card Aspect Ratio
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { ratio: '4/3' as const, label: '4:3 (Reference)' },
                      { ratio: '1/1' as const, label: '1:1 (Square)' },
                      { ratio: '16/10' as const, label: '16:10 (Wide)' },
                    ].map((item) => (
                      <button
                        key={item.ratio}
                        type="button"
                        onClick={() => design.updateDesign({ cardAspectRatio: item.ratio })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${design.cardAspectRatio === item.ratio
                          ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card Corner Radius */}
                <div className={!isImageGrid ? 'opacity-40 pointer-events-none select-none' : ''}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Card Corner Radius
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { radius: 'rounded-lg' as const, label: 'Subtle (8px)' },
                      { radius: 'rounded-xl' as const, label: 'Curved (12px)' },
                      { radius: 'rounded-2xl' as const, label: 'Extra Rounded (16px)' },
                    ].map((item) => (
                      <button
                        key={item.radius}
                        type="button"
                        onClick={() => design.updateDesign({ cardRadius: item.radius })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${design.cardRadius === item.radius
                          ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Grid Spacing / Gap */}
                <div className={!isImageGrid ? 'opacity-40 pointer-events-none select-none' : ''}>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Card Spacing (Gap)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { gap: 'gap-3' as const, label: 'Tight (12px)' },
                      { gap: 'gap-4' as const, label: 'Standard (16px)' },
                      { gap: 'gap-6' as const, label: 'Relaxed (24px)' },
                    ].map((item) => (
                      <button
                        key={item.gap}
                        type="button"
                        onClick={() => design.updateDesign({ cardGap: item.gap })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${design.cardGap === item.gap
                          ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 2: Product Card */}
          {activeSubTab === 'product-card' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl space-y-6 text-white backdrop-blur-sm">
              {/* Product Name Placement */}
              <div>
                <label className="block text-sm font-bold text-white mb-1">
                  Product Name Display &amp; Placement
                </label>
                <p className="text-xs text-zinc-400 mb-3">
                  Control how the product title is displayed on top of the image card.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { id: 'bottom-gradient' as const, label: 'Bottom Gradient (Recommended)', desc: 'Smooth dark gradient at bottom' },
                    { id: 'top-badge' as const, label: 'Top Pill Badge', desc: 'Floating rounded badge on top left' },
                    { id: 'bottom-bar' as const, label: 'Bottom Solid Bar', desc: 'Semi-transparent dark bar across bottom' },
                    { id: 'none' as const, label: 'Minimalist (Price Only)', desc: 'Clean photo and price badge only' },
                  ].map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => design.updateDesign({ namePlacement: pos.id })}
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${design.namePlacement === pos.id
                        ? 'border-theme bg-theme-badge/20 ring-2 ring-theme/30 shadow-md text-white'
                        : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/50 text-zinc-300'
                        }`}
                    >
                      <div className="text-xs font-bold text-white">{pos.label}</div>
                      <div className="text-[11px] text-zinc-400 mt-0.5">{pos.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Badge Style & Placement */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-1">
                    Price Badge Styling
                  </label>
                  <p className="text-xs text-zinc-400 mb-3">
                    Design of the price tag on the card.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {[
                      { id: 'dark-navy' as const, label: 'Dark Charcoal Pill', desc: 'Slate-800 pill (#1e293b, matches reference)' },
                      { id: 'theme-accent' as const, label: 'Theme Accent Pill', desc: 'Matches active theme color' },
                      { id: 'glass' as const, label: 'Frosted Glass', desc: 'Translucent blur effect with white text' },
                      { id: 'white' as const, label: 'Crisp White Pill', desc: 'High-contrast white badge' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => design.updateDesign({ priceStyle: style.id })}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${design.priceStyle === style.id
                          ? 'border-theme bg-theme-badge/20 ring-2 ring-theme/30 shadow-md text-white'
                          : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/50 text-zinc-300'
                          }`}
                      >
                        <div className="text-xs font-bold text-white">{style.label}</div>
                        <div className="text-[11px] text-zinc-400 mt-0.5">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Price Badge Placement
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { pos: 'bottom-right' as const, label: 'Bottom Right (Reference)' },
                      { pos: 'bottom-left' as const, label: 'Bottom Left' },
                      { pos: 'top-right' as const, label: 'Top Right' },
                    ].map((p) => (
                      <button
                        key={p.pos}
                        type="button"
                        onClick={() => design.updateDesign({ pricePlacement: p.pos })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${design.pricePlacement === p.pos
                          ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                          : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Currency Symbol */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Currency Symbol
                  </label>
                  <div className="flex items-center gap-2">
                    {['₹', '$', '€', '£'].map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        onClick={() => design.updateDesign({ currencySymbol: sym })}
                        className={`h-9 w-12 rounded-xl text-sm font-bold border transition-all cursor-pointer ${design.currencySymbol === sym
                          ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800'
                          }`}
                      >
                        {sym}
                      </button>
                    ))}
                    <input
                      type="text"
                      maxLength={4}
                      placeholder="Custom"
                      value={design.currencySymbol}
                      onChange={(e) => design.updateDesign({ currencySymbol: e.target.value })}
                      className="h-9 w-24 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-bold text-white outline-none focus:border-theme transition"
                    />
                  </div>
                </div>

                {/* Badges and Qty */}
                <div className="pt-3 border-t border-zinc-800/80">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <div className="text-sm font-bold text-white">Show Cart Quantity Badge</div>
                      <div className="text-xs text-zinc-400">Displays &quot;2 in cart&quot; badge on products already added</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={design.showCartBadge}
                      onChange={(e) => design.updateDesign({ showCartBadge: e.target.checked })}
                      className="h-5 w-5 rounded border-zinc-700 bg-zinc-950 text-pink-600 focus:ring-pink-500 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Subtab: Category Design */}
          {activeSubTab === 'category-design' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl space-y-6 text-white backdrop-blur-sm">
              <div>
                <label className="block text-sm font-bold text-white mb-1">
                  Category Display Style
                </label>
                <p className="text-xs text-zinc-400 mb-3">
                  Choose between the Visual Card Tile layout with rich photo backgrounds, or the Compact Row List with circular thumbnails and category count badge.
                </p>

                <div className="flex flex-col gap-3.5">
                  {/* Option 1: Visual Card Tiles (Reference Image 2) */}
                  <div
                    onClick={() => design.updateDesign({ categoryStyle: 'card-tile' })}
                    className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                      (design.categoryStyle || 'card-tile') === 'card-tile'
                        ? 'border-theme bg-theme-badge/20 ring-2 ring-theme/30 shadow-md'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                    style={
                      (design.categoryStyle || 'card-tile') === 'card-tile'
                        ? {
                            borderColor: 'var(--theme-accent, #DB2777)',
                            backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.12))',
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${
                            (design.categoryStyle || 'card-tile') === 'card-tile'
                              ? 'text-white shadow-xs'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:bg-zinc-800'
                          }`}
                          style={
                            (design.categoryStyle || 'card-tile') === 'card-tile'
                              ? {
                                  backgroundColor: 'var(--theme-accent, #DB2777)',
                                  borderColor: 'var(--theme-accent, #DB2777)',
                                }
                              : undefined
                          }
                        >
                          <Grid className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              Visual Card Tiles
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                                color: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                              }}
                            >
                              Image Tile Cards (Ref 1)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {(design.categoryStyle || 'card-tile') === 'card-tile' && (
                          <span
                            className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                              color: 'var(--theme-accent, #DB2777)',
                            }}
                          >
                            Active
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            (design.categoryStyle || 'card-tile') === 'card-tile'
                              ? 'text-white shadow-xs'
                              : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                          }`}
                          style={
                            (design.categoryStyle || 'card-tile') === 'card-tile'
                              ? {
                                  backgroundColor: 'var(--theme-accent, #DB2777)',
                                  borderColor: 'var(--theme-accent, #DB2777)',
                                }
                              : undefined
                          }
                        >
                          {(design.categoryStyle || 'card-tile') === 'card-tile' && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-400 sm:pl-[52px] leading-relaxed mb-3">
                      Large photo cards with dark bottom gradient text overlay, plus dedicated theme-gradient &quot;All Items&quot; card.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🖼️ Full Photo Tiles
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🎨 Theme Gradient &quot;All Items&quot;
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        👆 Touchscreen Targets
                      </span>
                    </div>
                  </div>

                  {/* Option 2: Compact Row List (Reference Image 3) */}
                  <div
                    onClick={() => design.updateDesign({ categoryStyle: 'compact-list' })}
                    className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                      design.categoryStyle === 'compact-list'
                        ? 'border-theme bg-theme-badge/20 ring-2 ring-theme/30 shadow-md'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                    style={
                      design.categoryStyle === 'compact-list'
                        ? {
                            borderColor: 'var(--theme-accent, #DB2777)',
                            backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.12))',
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${
                            design.categoryStyle === 'compact-list'
                              ? 'text-white shadow-xs'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:bg-zinc-800'
                          }`}
                          style={
                            design.categoryStyle === 'compact-list'
                              ? {
                                  backgroundColor: 'var(--theme-accent, #DB2777)',
                                  borderColor: 'var(--theme-accent, #DB2777)',
                                }
                              : undefined
                          }
                        >
                          <List className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              Compact Row List
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                                color: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                              }}
                            >
                              List &amp; Thumbnails (Ref 2)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {design.categoryStyle === 'compact-list' && (
                          <span
                            className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                              color: 'var(--theme-accent, #DB2777)',
                            }}
                          >
                            Active
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            design.categoryStyle === 'compact-list'
                              ? 'text-white shadow-xs'
                              : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                          }`}
                          style={
                            design.categoryStyle === 'compact-list'
                              ? {
                                  backgroundColor: 'var(--theme-accent, #DB2777)',
                                  borderColor: 'var(--theme-accent, #DB2777)',
                                }
                              : undefined
                          }
                        >
                          {design.categoryStyle === 'compact-list' && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-400 sm:pl-[52px] leading-relaxed mb-3">
                      Sleek vertical rows with circular dish thumbnails, header category count badge, and high-visibility active pill.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🏷️ Categories Header &amp; Count (11)
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🎯 Circular Dish Thumbnails
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        ⚡ Fast Quick-Scroll Browse
                      </span>
                    </div>
                  </div>

                  {/* Option 3: 2-Column Grid Box Layout (New) */}
                  <div
                    onClick={() => design.updateDesign({ categoryStyle: 'grid-2col' })}
                    className={`group relative flex flex-col p-4 sm:p-5 rounded-2xl border-2 transition-all cursor-pointer ${
                      design.categoryStyle === 'grid-2col'
                        ? 'border-theme bg-theme-badge/20 ring-2 ring-theme/30 shadow-md'
                        : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                    }`}
                    style={
                      design.categoryStyle === 'grid-2col'
                        ? {
                            borderColor: 'var(--theme-accent, #DB2777)',
                            backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.12))',
                          }
                        : undefined
                    }
                  >
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${
                            design.categoryStyle === 'grid-2col'
                              ? 'text-white shadow-xs'
                              : 'bg-zinc-900 text-zinc-400 border-zinc-800 group-hover:bg-zinc-800'
                          }`}
                          style={
                            design.categoryStyle === 'grid-2col'
                              ? {
                                  backgroundColor: 'var(--theme-accent, #DB2777)',
                                  borderColor: 'var(--theme-accent, #DB2777)',
                                }
                              : undefined
                          }
                        >
                          <Grid2X2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-sm sm:text-base text-white">
                              2-Column Grid Boxes
                            </span>
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border"
                              style={{
                                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                                color: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                              }}
                            >
                              2-Column Grid Box (New)
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        {design.categoryStyle === 'grid-2col' && (
                          <span
                            className="hidden sm:inline-flex text-[11px] font-bold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                              color: 'var(--theme-accent, #DB2777)',
                            }}
                          >
                            Active
                          </span>
                        )}
                        <div
                          className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all ${
                            design.categoryStyle === 'grid-2col'
                              ? 'text-white shadow-xs'
                              : 'border-zinc-700 bg-zinc-900 group-hover:border-zinc-600'
                          }`}
                          style={
                            design.categoryStyle === 'grid-2col'
                              ? {
                                  backgroundColor: 'var(--theme-accent, #DB2777)',
                                  borderColor: 'var(--theme-accent, #DB2777)',
                                }
                              : undefined
                          }
                        >
                          {design.categoryStyle === 'grid-2col' && (
                            <Check className="h-3 w-3 stroke-[3]" />
                          )}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-zinc-400 sm:pl-[52px] leading-relaxed mb-3">
                      Modern 2-column square photo grid boxes with category title overlay and active indicators.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 sm:pl-[52px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🔲 2-Column Grid
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        🖼️ Compact Box Cards
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-md">
                        📱 Touchscreen Optimized
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Category Section Display Option */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-xl border border-zinc-800 bg-zinc-950/60">
                  <div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Fixed Category Section</span>
                      {design.isFixedCategorySection && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-pink-500/20 text-pink-400 border border-pink-500/30">
                          Active ({design.categoryVisibleCount || 4} Visible)
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      Fix category display height and limit how many categories (1 to 6) are visible before scrolling.
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={design.isFixedCategorySection ?? false}
                      onChange={(e) => design.updateDesign({ isFixedCategorySection: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                  </label>
                </div>

                {design.isFixedCategorySection && (
                  <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300">
                        Visible Categories in Scroll View (1 to 6)
                      </label>
                      <span className="text-xs font-black text-pink-400 bg-pink-500/10 px-2 py-0.5 rounded-md border border-pink-500/20">
                        {design.categoryVisibleCount || 4} Categories
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400">
                      Choose how many categories are visible at a glance in the scrollable sidebar before scrolling:
                    </p>
                    <div className="grid grid-cols-6 gap-2 pt-1">
                      {[1, 2, 3, 4, 5, 6].map((count) => {
                        const isSelected = (design.categoryVisibleCount || 4) === count;
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => design.updateDesign({ categoryVisibleCount: count })}
                            className={`py-2.5 rounded-xl text-xs font-black border transition-all text-center cursor-pointer ${
                              isSelected
                                ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white scale-105'
                                : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800'
                            }`}
                          >
                            {count}
                          </button>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 pt-1">
                      <Sparkles className="h-3 w-3 text-pink-400 shrink-0" />
                      <span>
                        Showing {design.categoryVisibleCount || 4} {(design.categoryVisibleCount || 4) === 1 ? 'category' : 'categories'} visible in viewport. Other categories scroll smoothly inside.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Sub-options for Card Tile */}
              {(design.categoryStyle || 'card-tile') === 'card-tile' && (
                <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Card Height &amp; Density
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { height: 'h-20' as const, label: 'Compact (80px)' },
                      { height: 'h-24' as const, label: 'Standard (96px, Ref)' },
                      { height: 'h-28' as const, label: 'Spacious (112px)' },
                    ].map((item) => (
                      <button
                        key={item.height}
                        type="button"
                        onClick={() => design.updateDesign({ categoryCardHeight: item.height })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                          (design.categoryCardHeight || 'h-24') === item.height
                            ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                            : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-options for Compact Row List */}
              {design.categoryStyle === 'compact-list' && (
                <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                      Dish Thumbnail Shape
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { shape: 'rounded-full' as const, label: 'Circle (Reference)' },
                        { shape: 'rounded-xl' as const, label: 'Curved Square' },
                        { shape: 'rounded-lg' as const, label: 'Subtle Round' },
                      ].map((item) => (
                        <button
                          key={item.shape}
                          type="button"
                          onClick={() => design.updateDesign({ categoryThumbnailShape: item.shape })}
                          className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                            (design.categoryThumbnailShape || 'rounded-full') === item.shape
                              ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                              : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800/80">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="text-sm font-bold text-white">Show Categories Count Badge</div>
                        <div className="text-xs text-zinc-400">Displays header pill with category total, e.g. &quot;CATEGORIES (11)&quot;</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={design.showCategoryCount !== false}
                        onChange={(e) => design.updateDesign({ showCategoryCount: e.target.checked })}
                        className="h-5 w-5 rounded border-zinc-700 bg-zinc-950 text-pink-600 focus:ring-pink-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Sub-options for 2-Column Grid Box */}
              {design.categoryStyle === 'grid-2col' && (
                <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                    Grid Box Height &amp; Density
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { height: 'h-20' as const, label: 'Compact (80px)' },
                      { height: 'h-24' as const, label: 'Standard (96px)' },
                      { height: 'h-28' as const, label: 'Spacious (112px)' },
                    ].map((item) => (
                      <button
                        key={item.height}
                        type="button"
                        onClick={() => design.updateDesign({ categoryCardHeight: item.height })}
                        className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center cursor-pointer ${
                          (design.categoryCardHeight || 'h-24') === item.height
                            ? 'btn-theme-primary text-white border-theme shadow-theme-glow preserve-white'
                            : 'border-zinc-800 bg-zinc-950/70 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Common Search Bar Options */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Search Bar Placeholder
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {[
                    'Search category...',
                    'Filter categories...',
                    'Find category or dish...',
                  ].map((ph) => (
                    <button
                      key={ph}
                      type="button"
                      onClick={() => design.updateDesign({ categorySearchPlaceholder: ph })}
                      className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all cursor-pointer ${
                        (design.categorySearchPlaceholder || ((design.categoryStyle || 'card-tile') === 'compact-list' ? 'Filter categories...' : 'Search category...')) === ph
                          ? 'border-theme bg-theme-badge/20 text-white ring-2 ring-theme/30'
                          : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:text-white hover:bg-zinc-800/40'
                      }`}
                    >
                      {ph}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Subtab 3: Theme & Colors */}
          {activeSubTab === 'appearance' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl space-y-6 text-white backdrop-blur-sm">
              {/* Terminal Appearance Mode: Dark / Light / System */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SunMoon className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                  <label className="block text-sm font-bold text-white">
                    Terminal Appearance Mode
                  </label>
                  <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-bold text-zinc-300 uppercase border border-zinc-700">
                    {(design.themeMode || 'dark')} Active
                  </span>
                </div>
                <p className="text-xs text-zinc-400 mb-3">
                  Choose whether the POS center terminal display operates in sleek Dark Mode, crisp Light Mode, or inherits the company theme mode automatically.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: 'dark' as const,
                      icon: Moon,
                      iconColor: 'text-indigo-400',
                      title: 'Dark Mode',
                      badge: 'Recommended',
                      desc: 'Deep zinc surfaces, high-contrast neon accents, reduced eye fatigue for counters',
                    },
                    {
                      id: 'light' as const,
                      icon: Sun,
                      iconColor: 'text-amber-400',
                      title: 'Light Mode',
                      badge: 'Daytime',
                      desc: 'Crisp white & slate surfaces with sharp product photography and high visibility',
                    },
                    {
                      id: 'system' as const,
                      icon: Sparkles,
                      iconColor: 'text-pink-400',
                      title: 'Sync with System',
                      badge: 'Auto',
                      desc: 'Follows the active company/system theme mode toggle set in Company Theme',
                    },
                  ].map((m) => {
                    const isSelected = (design.themeMode || 'dark') === m.id;
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          design.updateDesign({ themeMode: m.id });
                          setPreviewTheme(m.id === 'system' ? (document.documentElement.classList.contains('light-mode') ? 'light' : 'dark') : m.id);
                        }}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${isSelected
                          ? 'border-theme bg-theme-badge/20 ring-2 ring-theme/40 shadow-md'
                          : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60 hover:border-zinc-700'
                          }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Icon className={`h-4 w-4 ${m.iconColor}`} />
                              <span className="text-xs font-black text-white">{m.title}</span>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isSelected
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-zinc-800 text-zinc-400'
                              }`}>
                              {m.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-400 leading-snug">{m.desc}</p>
                        </div>
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-zinc-800/80">
                          <span className="text-[10px] font-mono text-zinc-500">Center Terminal</span>
                          <span className={`h-2.5 w-2.5 rounded-full ${isSelected ? 'bg-emerald-400 shadow-sm animate-pulse' : 'bg-zinc-700'}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Theme Presets */}
              <div className="pt-4 border-t border-zinc-800/80">
                <label className="block text-sm font-bold text-white mb-1">
                  Terminal Color Theme Presets
                </label>
                <p className="text-xs text-zinc-400 mb-3">
                  Select a tailored palette for active borders, highlight glows, and banners.
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(THEME_PRESETS).map(([key, preset]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => applyThemePreset(key)}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between cursor-pointer ${design.themePreset === key
                        ? 'border-theme ring-2 ring-theme/30 bg-theme-badge/20 shadow-md'
                        : 'border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800/60'
                        }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="h-4 w-4 rounded-full shadow-xs shrink-0"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                        <span className="text-xs font-bold text-white truncate">
                          {preset.label}
                        </span>
                      </div>
                      <div
                        className="h-3 w-full rounded"
                        style={{ backgroundColor: preset.bannerBgColor }}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Color Overrides */}
              <div className="pt-4 border-t border-zinc-800/80 space-y-4">
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Custom Color Tuning
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Active Card Outline Color */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Active Card Outline / Ring Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.activeBorderColor || '#DB2777'}
                        onChange={(e) =>
                          design.updateDesign({
                            activeBorderColor: e.target.value,
                            themePreset: 'custom',
                          })
                        }
                        className="h-9 w-12 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-950 p-0.5"
                      />
                      <input
                        type="text"
                        value={design.activeBorderColor || '#DB2777'}
                        onChange={(e) =>
                          design.updateDesign({
                            activeBorderColor: e.target.value,
                            themePreset: 'custom',
                          })
                        }
                        className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-mono text-white outline-none focus:border-theme uppercase transition"
                      />
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Shown on tapped or selected cards (as seen in reference image).
                    </p>
                  </div>

                  {/* Primary Accent Color */}
                  <div>
                    <label className="block text-xs font-medium text-zinc-300 mb-1">
                      Primary Accent Color
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={design.accentColor || '#DB2777'}
                        onChange={(e) =>
                          design.updateDesign({
                            accentColor: e.target.value,
                            themePreset: 'custom',
                          })
                        }
                        className="h-9 w-12 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-950 p-0.5"
                      />
                      <input
                        type="text"
                        value={design.accentColor || '#DB2777'}
                        onChange={(e) =>
                          design.updateDesign({
                            accentColor: e.target.value,
                            themePreset: 'custom',
                          })
                        }
                        className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-mono text-white outline-none focus:border-theme uppercase transition"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Subtab 4: Tap Mode Banner */}
          {activeSubTab === 'tap-banner' && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl space-y-6 text-white backdrop-blur-sm">
              <div>
                <label className="flex items-center justify-between cursor-pointer mb-3">
                  <div>
                    <div className="text-sm font-bold text-white">
                      Enable Touch Mode Helper Banner
                    </div>
                    <div className="text-xs text-zinc-400">
                      Displays the top pastel bar with tap instruction and active status badge.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={design.showTapBanner}
                    onChange={(e) => design.updateDesign({ showTapBanner: e.target.checked })}
                    className="h-5 w-5 rounded border-zinc-700 bg-zinc-950 text-pink-600 focus:ring-pink-500 cursor-pointer"
                  />
                </label>
              </div>

              {design.showTapBanner && (
                <div className="space-y-4 pt-4 border-t border-zinc-800/80">
                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Instruction Text (Left Side)
                    </label>
                    <input
                      type="text"
                      value={design.tapBannerText}
                      onChange={(e) => design.updateDesign({ tapBannerText: e.target.value })}
                      placeholder="Tap to Add to Cart • Double-tap to +1 Qty"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs text-white outline-none focus:border-theme transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-300 mb-1">
                      Status Badge Text (Right Side)
                    </label>
                    <input
                      type="text"
                      value={design.tapBannerBadgeText}
                      onChange={(e) => design.updateDesign({ tapBannerBadgeText: e.target.value })}
                      placeholder="TAP MODE ACTIVE"
                      className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-2.5 text-xs font-mono uppercase text-white outline-none focus:border-theme transition"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Banner Background
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={design.bannerBgColor || '#1F0715'}
                          onChange={(e) => design.updateDesign({ bannerBgColor: e.target.value })}
                          className="h-9 w-12 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-950 p-0.5"
                        />
                        <input
                          type="text"
                          value={design.bannerBgColor || '#1F0715'}
                          onChange={(e) => design.updateDesign({ bannerBgColor: e.target.value })}
                          className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-mono text-white outline-none focus:border-theme uppercase transition"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-300 mb-1">
                        Banner Text Color
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={design.bannerTextColor || '#f4f4f5'}
                          onChange={(e) => design.updateDesign({ bannerTextColor: e.target.value })}
                          className="h-9 w-12 rounded-lg cursor-pointer border border-zinc-700 bg-zinc-950 p-0.5"
                        />
                        <input
                          type="text"
                          value={design.bannerTextColor || '#f4f4f5'}
                          onChange={(e) => design.updateDesign({ bannerTextColor: e.target.value })}
                          className="h-9 flex-1 rounded-xl border border-zinc-800 bg-zinc-950 px-3 text-xs font-mono text-white outline-none focus:border-theme uppercase transition"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center justify-between cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-white">
                          Enable Double-Tap for Quick +1 Qty
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Double clicking an item increments quantity quickly
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={design.quickDoubleTap}
                        onChange={(e) => design.updateDesign({ quickDoubleTap: e.target.checked })}
                        className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-pink-600 focus:ring-pink-500 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Live Interactive Preview Column */}
        <div className="lg:col-span-5 xl:col-span-5">
          <div className="sticky top-6 rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden backdrop-blur-sm">
            {/* Preview Header with Dark/Light Toggle */}
            <div className="border-b border-zinc-800 bg-zinc-950/80 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Live Terminal Preview
                </span>
              </div>

              {/* Preview Dark / Light Theme Mode Switcher */}
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-lg bg-zinc-900 p-0.5 border border-zinc-800">
                  <button
                    type="button"
                    onClick={() => setPreviewTheme('dark')}
                    title="Preview in Dark Mode"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewTheme === 'dark'
                      ? 'bg-zinc-800 text-white shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    <Moon className="h-3 w-3 text-indigo-400" />
                    <span>Dark</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewTheme('light')}
                    title="Preview in Light Mode"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${previewTheme === 'light'
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-400 hover:text-white'
                      }`}
                  >
                    <Sun className="h-3 w-3 text-amber-500" />
                    <span>Light</span>
                  </button>
                </div>

                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-block"
                  style={{
                    backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                    color: 'var(--theme-accent, #DB2777)',
                    borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                  }}
                >
                  Center Display
                </span>
              </div>
            </div>

            {/* Preview Body */}
            <div
              className={`p-4 min-h-[500px] transition-colors duration-200 ${isLightPreview ? 'bg-slate-100 text-zinc-900' : 'bg-zinc-950 text-white'
                }`}
            >
              {/* Category & Search mock bar */}
              <div
                className={`mb-3 p-3 rounded-xl border flex items-center justify-between transition-colors shadow-xs ${isLightPreview
                  ? 'bg-white border-zinc-200 text-zinc-900'
                  : 'bg-zinc-900/90 border-zinc-800 text-white'
                  }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`font-bold text-sm ${isLightPreview ? 'text-zinc-900' : 'text-white'}`}>
                    Fresh Fruits &amp; Veggies
                  </span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                    style={{
                      backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                      color: 'var(--theme-accent, #DB2777)',
                      borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                    }}
                  >
                    8 items
                  </span>
                </div>
                <span className={`text-[11px] font-mono ${isLightPreview ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  Scan / Search Active
                </span>
              </div>

              {/* Tap Mode Banner (When enabled) */}
              {isImageGrid && design.showTapBanner && (
                <div
                  style={{
                    backgroundColor: design.bannerBgColor || (isLightPreview ? '#FDF2F8' : '#1F0715'),
                  }}
                  className={`mb-3 flex items-center justify-between rounded-xl px-3 py-2 border shadow-xs ${isLightPreview ? 'border-pink-200/80' : 'border-zinc-800'
                    }`}
                >
                  <div
                    className="flex items-center gap-2 text-xs font-semibold"
                    style={{
                      color:
                        design.bannerTextColor ||
                        (isLightPreview ? '#831843' : '#f4f4f5'),
                    }}
                  >
                    <span>👆</span>
                    <span>{design.tapBannerText || 'Tap to Add to Cart • Double-tap to +1 Qty'}</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider font-mono"
                    style={{
                      color:
                        design.accentColor && design.accentColor !== '#DB2777'
                          ? design.accentColor
                          : 'var(--theme-accent, #DB2777)',
                    }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full animate-pulse"
                      style={{
                        backgroundColor:
                          design.accentColor && design.accentColor !== '#DB2777'
                            ? design.accentColor
                            : 'var(--theme-accent, #DB2777)',
                      }}
                    />
                    <span>{design.tapBannerBadgeText || 'TAP MODE ACTIVE'}</span>
                  </div>
                </div>
              )}

              {/* Category Design Live Interactive Preview */}
              {activeSubTab === 'category-design' && (
                <div className="mb-4 rounded-xl border p-3.5 space-y-3 transition-colors bg-opacity-70 ${
                  isLightPreview ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'
                }">
                  <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-zinc-300">
                        {(design.categoryStyle || 'card-tile') === 'compact-list'
                          ? 'Compact Row List Preview'
                          : design.categoryStyle === 'grid-2col'
                            ? '2-Column Grid Box Preview'
                            : 'Visual Card Tile Preview'}
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold border"
                        style={{
                          backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                          color: 'var(--theme-accent, #DB2777)',
                          borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                        }}
                      >
                        Interactive
                      </span>
                    </div>
                    <span className={`text-[11px] ${isLightPreview ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Click to test selection
                    </span>
                  </div>

                  <div className="flex gap-3">
                    {/* Live Category Sidebar Mock */}
                    <div className={`${design.categoryStyle === 'grid-2col' ? 'w-52' : 'w-44'} shrink-0 rounded-xl border p-2 flex flex-col ${
                      isLightPreview ? 'bg-slate-100 border-zinc-200 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-white'
                    }`}>
                      {/* Header for compact-list */}
                      {design.categoryStyle === 'compact-list' && (
                        <div className={`px-2 py-1.5 border-b mb-2 flex items-center justify-between ${
                          isLightPreview ? 'border-zinc-200/80 bg-slate-50' : 'border-zinc-800/80 bg-zinc-950'
                        }`}>
                          <div className="flex items-center gap-1.5">
                            <LayoutGrid className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                            <span className="font-black text-[10px] uppercase tracking-wider" style={{ color: 'var(--theme-accent, #DB2777)' }}>
                              Categories
                            </span>
                          </div>
                          {design.showCategoryCount !== false && (
                            <span
                              className="rounded-full px-1.5 py-0.2 text-[9px] font-black border"
                              style={{
                                color: 'var(--theme-accent, #DB2777)',
                                borderColor: 'var(--theme-accent, #DB2777)',
                                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                              }}
                            >
                              {DEMO_CATEGORIES.length}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Search bar */}
                      <div className="mb-2">
                        <div className="relative flex items-center">
                          <Search className={`absolute left-2 h-3 w-3 ${isLightPreview ? 'text-zinc-400' : 'text-zinc-500'}`} />
                          <input
                            type="text"
                            readOnly
                            placeholder={design.categorySearchPlaceholder || ((design.categoryStyle || 'card-tile') === 'compact-list' ? 'Filter categories...' : 'Search category...')}
                            className={`w-full rounded-lg border py-1 pl-6 pr-2 text-[10px] outline-none ${
                              isLightPreview ? 'border-zinc-300 bg-white text-zinc-700' : 'border-zinc-800 bg-zinc-900 text-zinc-300'
                            }`}
                          />
                        </div>
                      </div>

                      {/* Category Items */}
                      {design.categoryStyle === 'compact-list' ? (
                        <div className="space-y-1 max-h-[300px] overflow-y-auto no-scrollbar">
                          {DEMO_CATEGORIES.map((cat) => {
                            const isActive = previewCategoryId === cat.id;
                            return (
                              <div
                                key={cat.id}
                                onClick={() => setPreviewCategoryId(cat.id)}
                                className={`flex items-center gap-2 p-1.5 rounded-xl transition cursor-pointer text-left ${
                                  isActive
                                    ? 'border-2 shadow-sm'
                                    : isLightPreview ? 'hover:bg-zinc-200/70 text-zinc-800' : 'hover:bg-zinc-900 text-zinc-300'
                                }`}
                                style={
                                  isActive
                                    ? {
                                        borderColor: 'var(--theme-accent, #DB2777)',
                                        background: 'linear-gradient(135deg, var(--theme-gradient-start, #1F0715) 0%, var(--theme-gradient-end, #DB2777) 100%)',
                                      }
                                    : undefined
                                }
                              >
                                {cat.id === 'all' ? (
                                  <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 border ${
                                    isActive ? 'bg-black/40 border-white/20 text-amber-400' : isLightPreview ? 'bg-zinc-200 border-zinc-300 text-zinc-600' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                                  }`}>
                                    <UtensilsCrossed className="h-3 w-3" />
                                  </div>
                                ) : (
                                  <div className={`h-6 w-6 ${design.categoryThumbnailShape || 'rounded-full'} overflow-hidden border shrink-0 flex items-center justify-center ${
                                    isActive ? 'border-white/30' : isLightPreview ? 'border-zinc-300 bg-zinc-200' : 'border-zinc-700 bg-zinc-800'
                                  }`}>
                                    {cat.image ? (
                                      <img src={cat.image} alt={cat.name} className="h-full w-full object-cover" />
                                    ) : (
                                      <span className="text-[9px] font-black">{cat.name.charAt(0)}</span>
                                    )}
                                  </div>
                                )}
                                <span className={`text-[11px] truncate flex-1 ${
                                  isActive ? 'text-white font-black' : isLightPreview ? 'text-zinc-800 font-medium' : 'text-zinc-300 font-medium'
                                }`}>
                                  {cat.name}
                                </span>
                                {isActive && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0 mr-0.5" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : design.categoryStyle === 'grid-2col' ? (
                        <div
                          className="space-y-1.5 overflow-y-auto no-scrollbar"
                          style={design.isFixedCategorySection ? { maxHeight: `${Math.min(300, (design.categoryVisibleCount || 4) <= 2 ? 115 : (design.categoryVisibleCount || 4) <= 4 ? 175 : 235)}px` } : { maxHeight: '300px' }}
                        >
                          {/* All items card */}
                          <div
                            onClick={() => setPreviewCategoryId('all')}
                            className={`flex items-center gap-1.5 p-1.5 rounded-xl border transition cursor-pointer h-9 ${
                              previewCategoryId === 'all'
                                ? 'border-theme ring-2 ring-[var(--theme-accent,#DB2777)] shadow-sm'
                                : isLightPreview ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                            }`}
                            style={
                              previewCategoryId === 'all'
                                ? {
                                    background: 'linear-gradient(135deg, var(--theme-gradient-start, #1F0715) 0%, var(--theme-gradient-mid, #701A3B) 50%, var(--theme-gradient-end, #DB2777) 100%)',
                                    borderColor: 'var(--theme-accent, #DB2777)',
                                  }
                                : undefined
                            }
                          >
                            <div className={`h-5 w-5 rounded-md flex items-center justify-center shrink-0 border ${
                              previewCategoryId === 'all' ? 'bg-black/40 border-white/20 text-white' : isLightPreview ? 'bg-zinc-100 border-zinc-200 text-zinc-600' : 'bg-zinc-800 border-zinc-700 text-zinc-400'
                            }`}>
                              <UtensilsCrossed className="h-3 w-3" />
                            </div>
                            <span className={`text-[10px] font-black uppercase tracking-wider truncate flex-1 ${
                              previewCategoryId === 'all' ? 'text-white' : isLightPreview ? 'text-zinc-800' : 'text-zinc-200'
                            }`}>
                              All Items
                            </span>
                            {previewCategoryId === 'all' && (
                              <span className="h-1.5 w-1.5 rounded-full bg-white shrink-0 mr-0.5" />
                            )}
                          </div>

                          {/* 2-column grid */}
                          <div className="grid grid-cols-2 gap-1.5">
                            {DEMO_CATEGORIES.filter(c => c.id !== 'all').map((cat) => {
                              const isActive = previewCategoryId === cat.id;
                              return (
                                <div
                                  key={cat.id}
                                  onClick={() => setPreviewCategoryId(cat.id)}
                                  className={`group relative flex w-full flex-col justify-end rounded-xl border overflow-hidden transition cursor-pointer h-16 ${
                                    isActive
                                      ? 'border-theme ring-2 ring-[var(--theme-accent,#DB2777)] shadow-sm'
                                      : isLightPreview ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                  }`}
                                >
                                  {cat.image ? (
                                    <img src={cat.image} alt={cat.name} className="absolute inset-0 h-full w-full object-cover" />
                                  ) : (
                                    <div className={`absolute inset-0 flex items-center justify-center font-bold text-xs ${isLightPreview ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-800 text-zinc-300'}`}>
                                      {cat.name.charAt(0)}
                                    </div>
                                  )}
                                  {isActive && (
                                    <span
                                      className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full border border-black shadow"
                                      style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
                                    />
                                  )}
                                  <div className="relative z-10 w-full bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-2.5 pb-1 px-1">
                                    <span className="font-extrabold text-[8px] text-white uppercase truncate block text-center drop-shadow">
                                      {cat.name}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="space-y-1.5 overflow-y-auto no-scrollbar"
                          style={design.isFixedCategorySection ? { maxHeight: `${Math.min(300, (design.categoryVisibleCount || 4) * 60)}px` } : { maxHeight: '300px' }}
                        >
                          {DEMO_CATEGORIES.map((cat) => {
                            const isActive = previewCategoryId === cat.id;
                            const cardH = (design.categoryCardHeight || 'h-24') === 'h-20' ? 'h-14' : (design.categoryCardHeight || 'h-24') === 'h-28' ? 'h-20' : 'h-16';
                            return (
                              <div
                                key={cat.id}
                                onClick={() => setPreviewCategoryId(cat.id)}
                                className={`group relative flex w-full flex-col justify-end rounded-xl border overflow-hidden transition cursor-pointer ${cardH} ${
                                  isActive
                                    ? 'border-theme ring-2 ring-[var(--theme-accent,#DB2777)] shadow-md'
                                    : isLightPreview ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                                }`}
                              >
                                {cat.id === 'all' ? (
                                  <div
                                    className="absolute inset-0 flex items-center justify-center"
                                    style={{
                                      background: isActive
                                        ? 'linear-gradient(135deg, var(--theme-gradient-start, #1F0715) 0%, var(--theme-gradient-mid, #701A3B) 50%, var(--theme-gradient-end, #DB2777) 100%)'
                                        : isLightPreview ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)' : 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
                                    }}
                                  >
                                    <UtensilsCrossed className={`h-5 w-5 ${isActive ? 'text-white' : isLightPreview ? 'text-zinc-600' : 'text-zinc-400'}`} />
                                  </div>
                                ) : cat.image ? (
                                  <img src={cat.image} alt={cat.name} className="absolute inset-0 h-full w-full object-cover" />
                                ) : (
                                  <div className={`absolute inset-0 flex items-center justify-center font-bold text-sm ${isLightPreview ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-800 text-zinc-300'}`}>
                                    {cat.name.charAt(0)}
                                  </div>
                                )}
                                {isActive && (
                                  <span
                                    className="absolute top-1 right-1 h-2 w-2 rounded-full border border-black shadow"
                                    style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
                                  />
                                )}
                                <div className="relative z-10 w-full bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-3 pb-1 px-1.5">
                                  <span className="font-extrabold text-[9px] text-white uppercase truncate block drop-shadow">
                                    {cat.name}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Preview explanation */}
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <div className={`p-4 rounded-xl border text-xs space-y-2 ${
                        isLightPreview ? 'bg-slate-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                      }`}>
                        <div className="font-bold flex items-center gap-1.5" style={{ color: 'var(--theme-accent, #DB2777)' }}>
                          <Sparkles className="h-4 w-4" />
                          <span>Active Category Style</span>
                        </div>
                        <p className="text-[11px] leading-relaxed">
                          {(design.categoryStyle || 'card-tile') === 'compact-list'
                            ? 'Compact Row List layout active. Featuring circular food thumbnails, category header counter badge, and theme gradient selected pills.'
                            : design.categoryStyle === 'grid-2col'
                              ? '2-Column Grid Box layout active. Featuring compact 2-column square photo boxes with category title overlay and active indicators.'
                              : 'Visual Card Tile layout active. Featuring large photo cards with bottom text overlays and full theme-gradient "All Items" tile.'
                          }
                        </p>
                        {design.isFixedCategorySection && (
                          <div className="pt-2 border-t border-zinc-800/40 flex items-center gap-2 text-[10px]">
                            <span className="font-semibold text-zinc-300">Fixed Category View:</span>
                            <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-pink-950 text-pink-300 border border-pink-700/50">
                              {design.categoryVisibleCount || 4} Categories Visible
                            </span>
                          </div>
                        )}
                        <div className="pt-2 border-t border-zinc-800/40 flex items-center gap-2 text-[10px]">
                          <span className="font-semibold text-zinc-300">Selected Category:</span>
                          <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 border border-zinc-700">
                            {DEMO_CATEGORIES.find(c => c.id === previewCategoryId)?.name || 'All Items'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Product Grid, Classic List, or Search-Based Preview */}
              {design.displayStyle === 'search-based' ? (
                <div
                  className={`rounded-xl border p-4 space-y-3 transition-colors ${isLightPreview
                    ? 'bg-white border-zinc-200'
                    : 'bg-zinc-900 border-zinc-800'
                    }`}
                >
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Try typing in preview (e.g. Avocado, Apple)..."
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className={`w-full rounded-xl border p-2 pl-8 text-xs font-medium outline-none focus:border-theme transition ${isLightPreview
                        ? 'border-zinc-200 bg-zinc-50 text-zinc-900'
                        : 'border-zinc-800 bg-zinc-950 text-white'
                        }`}
                    />
                    <span className="absolute left-2.5 top-2.5 text-xs text-zinc-400">🔍</span>
                    {previewSearch && (
                      <button
                        onClick={() => setPreviewSearch('')}
                        className="absolute right-2.5 top-2 text-xs text-zinc-400 hover:text-zinc-600 cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  {!previewSearch ? (
                    <div className="py-10 text-center text-zinc-400">
                      <div
                        className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border mb-2.5 shadow-xs font-mono font-bold text-lg"
                        style={{
                          backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                          borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                          color: 'var(--theme-accent, #DB2777)',
                        }}
                      >
                        |||
                      </div>
                      <p className={`text-xs font-bold ${isLightPreview ? 'text-zinc-900' : 'text-white'}`}>
                        Product Area Empty by Default
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-1 max-w-xs mx-auto">
                        Type in the search field above or simulate a barcode scan to display matching products
                      </p>
                      <button
                        type="button"
                        onClick={() => setPreviewSearch('avocado')}
                        className={`mt-3 inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-[11px] font-bold cursor-pointer transition ${isLightPreview
                          ? 'border-zinc-200 bg-zinc-100 text-zinc-800 hover:bg-zinc-200'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800'
                          }`}
                      >
                        Simulate Scan: &quot;avocado&quot;
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {PREVIEW_PRODUCTS.filter(
                        (p) =>
                          p.name.toLowerCase().includes(previewSearch.toLowerCase()) ||
                          p.sku.toLowerCase().includes(previewSearch.toLowerCase())
                      ).map((prod) => (
                        <div
                          key={prod.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition ${isLightPreview
                            ? 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                            : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                            }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <img
                              src={prod.image}
                              alt={prod.name}
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                            <div>
                              <div className={`font-bold text-xs ${isLightPreview ? 'text-zinc-900' : 'text-white'}`}>
                                {prod.name}
                              </div>
                              <div className="text-[10px] text-zinc-400 font-mono">
                                SKU: {prod.sku} • Stock: {prod.stock}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className="font-bold text-xs font-mono"
                              style={{ color: 'var(--theme-accent, #DB2777)' }}
                            >
                              {design.currencySymbol}
                              {prod.price}
                            </span>
                            <span className="rounded-lg btn-theme-primary px-2.5 py-1 text-[10px] font-bold text-white shadow-xs">
                              + Add
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : !isImageGrid ? (
                <div
                  className={`rounded-xl border overflow-hidden transition-colors ${isLightPreview
                    ? 'bg-white border-zinc-200'
                    : 'bg-zinc-900 border-zinc-800'
                    }`}
                >
                  <div
                    className={`grid grid-cols-12 gap-2 border-b px-4 py-2 text-[10px] font-bold tracking-wider uppercase ${isLightPreview
                      ? 'border-zinc-200 bg-zinc-50 text-zinc-600'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400'
                      }`}
                  >
                    <div className="col-span-7">PRODUCT</div>
                    <div className="col-span-2 text-right">PRICE</div>
                    <div className="col-span-3 text-right">QUICK TENDER</div>
                  </div>
                  <div className={`divide-y ${isLightPreview ? 'divide-zinc-200' : 'divide-zinc-800'}`}>
                    {PREVIEW_PRODUCTS.slice(0, 4).map((p) => (
                      <div key={p.id} className="grid grid-cols-12 items-center px-4 py-2.5 text-xs">
                        <div className="col-span-7 flex items-center gap-2">
                          <img
                            src={p.image}
                            alt={p.name}
                            className="h-9 w-9 rounded-lg object-cover"
                          />
                          <span className={`font-bold truncate ${isLightPreview ? 'text-zinc-900' : 'text-white'}`}>
                            {p.name}
                          </span>
                        </div>
                        <div className="col-span-2 text-right font-bold" style={{ color: 'var(--theme-accent, #DB2777)' }}>
                          {design.currencySymbol}{p.price}
                        </div>
                        <div className="col-span-3 text-right">
                          <span className="rounded-lg btn-theme-primary px-2 py-1 text-[10px] font-bold text-white shadow-xs">
                            + Add
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div
                  className={`grid ${design.gridColumns === 3
                      ? 'grid-cols-3'
                      : design.gridColumns === 5
                        ? 'grid-cols-5'
                        : 'grid-cols-4'} ${design.cardGap || 'gap-3'}`}
                >
                  {PREVIEW_PRODUCTS.map((prod) => (
                    <ProductGridCard
                      key={prod.id}
                      product={prod}
                      themeMode={previewTheme}
                      isActive={previewActiveId === prod.id}
                      onSelect={() => setPreviewActiveId(prod.id)}
                    />
                  ))}
                </div>
              )}

              <p className={`mt-3 text-center text-[11px] ${isLightPreview ? 'text-zinc-500' : 'text-zinc-400'}`}>
                Interactive preview ({isLightPreview ? 'Light Mode' : 'Dark Mode'}): Click or double-tap cards to test touch feedback and active outline.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
