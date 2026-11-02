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
} from 'lucide-react';
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
  const [activeSubTab, setActiveSubTab] = useState<'layout' | 'appearance' | 'product-card' | 'tap-banner'>('layout');
  const [previewTheme, setPreviewTheme] = useState<'dark' | 'light'>('dark');
  const [saveToast, setSaveToast] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [previewActiveId, setPreviewActiveId] = useState<string>('demo-avocado-active');
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
