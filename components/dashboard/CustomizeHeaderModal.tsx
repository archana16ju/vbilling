'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  RotateCcw,
  Save,
  Check,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  LayoutGrid,
  Home,
  ShoppingBag,
  BarChart3,
  Package,
  Settings as SettingsIcon,
  ClipboardList,
  List,
  Utensils,
  Truck,
  Tags,
  Layers,
  BadgePercent,
  Box,
  User,
  CalendarCheck,
  Users,
  Building2,
  Megaphone,
  BellRing,
  ShieldAlert,
  ShieldCheck,
  Compass,
  ChevronDown,
  Layers3,
} from 'lucide-react';
import {
  CompanyHeaderNavConfig,
  DEFAULT_HEADER_NAV_CONFIG,
  HeaderNavItemConfig,
  normalizeHeaderNavConfig,
} from '@/lib/header-nav-config';

// Icon mapping helper
const ICON_MAP: Record<string, React.ElementType> = {
  Home,
  ShoppingBag,
  BarChart3,
  Package,
  Settings: SettingsIcon,
  LayoutGrid,
  ClipboardList,
  List,
  Utensils,
  Truck,
  Tags,
  Layers,
  BadgePercent,
  Box,
  User,
  CalendarCheck,
  Users,
  Building2,
  Megaphone,
  BellRing,
  ShieldAlert,
  ShieldCheck,
};

interface CustomizeHeaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (newConfig: CompanyHeaderNavConfig) => void;
}

export default function CustomizeHeaderModal({
  isOpen,
  onClose,
  onSaved,
}: CustomizeHeaderModalProps) {
  const [config, setConfig] = useState<CompanyHeaderNavConfig>(DEFAULT_HEADER_NAV_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing company configuration when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setStatusMessage(null);

    fetch('/api/companies/header-nav-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.config) {
          setConfig(normalizeHeaderNavConfig(data.config));
        } else {
          setConfig(DEFAULT_HEADER_NAV_CONFIG);
        }
      })
      .catch(() => {
        setConfig(DEFAULT_HEADER_NAV_CONFIG);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleMaxHeaderItemsChange = (newCount: number) => {
    setConfig((prev) => ({
      ...prev,
      maxHeaderItems: newCount,
    }));
  };

  const handleToggleVisible = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, visible: !it.visible } : it)),
    }));
  };

  const handleTogglePlacement = (id: string, showInHeader: boolean) => {
    setConfig((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, showInHeader } : it)),
    }));
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    const newItems = [...config.items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;

    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Re-index order
    newItems.forEach((it, idx) => {
      it.order = idx + 1;
    });

    setConfig((prev) => ({ ...prev, items: newItems }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/companies/header-nav-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save configuration');

      setStatusMessage({ type: 'success', text: 'Header navigation updated successfully!' });

      try {
        localStorage.setItem('company_header_nav_config', JSON.stringify(data.config));
        window.dispatchEvent(new CustomEvent('header-nav-config-changed', { detail: data.config }));
      } catch {}

      if (onSaved) onSaved(data.config);

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error saving configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset header navigation to factory defaults?')) {
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/companies/header-nav-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to reset configuration');

      const resetConfig = normalizeHeaderNavConfig(data.config || DEFAULT_HEADER_NAV_CONFIG);
      setConfig(resetConfig);
      setStatusMessage({ type: 'success', text: 'Reset to default navigation layout.' });

      try {
        localStorage.removeItem('company_header_nav_config');
        window.dispatchEvent(new CustomEvent('header-nav-config-changed', { detail: resetConfig }));
      } catch {}

      if (onSaved) onSaved(resetConfig);

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error resetting configuration' });
    } finally {
      setIsSaving(false);
    }
  };

  // Compute live breakdown stats
  const headerItems = config.items.filter((it) => it.visible && it.showInHeader);
  const directHeaderCount = Math.min(headerItems.length, config.maxHeaderItems);
  const moreDropdownCount = Math.max(0, headerItems.length - config.maxHeaderItems);
  const sidebarCount = config.items.filter((it) => it.visible && !it.showInHeader).length;
  const hiddenCount = config.items.filter((it) => !it.visible).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative flex flex-col w-full max-w-4xl max-h-[92vh] rounded-3xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden text-zinc-100">
        
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-500/20 text-pink-400 border border-pink-500/30 shadow-inner">
              <SlidersHorizontal className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                Customize Dashboard Header Navigation
              </h2>
              <p className="text-xs text-zinc-400 font-medium">
                Choose header menus, reorder items, set direct limits, and prevent sidebar duplicates.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Live Stats Summary Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 px-6 py-3 bg-zinc-950/40 border-b border-zinc-800 text-xs shrink-0">
          <div className="flex items-center justify-between p-2 rounded-xl bg-pink-950/30 border border-pink-500/30">
            <span className="text-pink-300 font-bold">Direct in Header</span>
            <span className="font-black text-pink-400 font-mono text-sm">{directHeaderCount}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-indigo-500/15 border border-indigo-500/40 dark:bg-indigo-950/50 dark:border-indigo-500/40">
            <span className="text-indigo-950 dark:text-indigo-200 font-extrabold">In &quot;More&quot; Dropdown</span>
            <span className="font-black text-indigo-950 dark:text-white font-mono text-sm">{moreDropdownCount}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/40 dark:bg-emerald-950/50 dark:border-emerald-500/40">
            <span className="text-emerald-950 dark:text-emerald-200 font-extrabold">In Sidebar</span>
            <span className="font-black text-emerald-950 dark:text-white font-mono text-sm">{sidebarCount}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-800/40 border border-zinc-700/40">
            <span className="text-zinc-400 font-bold">Hidden</span>
            <span className="font-black text-zinc-300 font-mono text-sm">{hiddenCount}</span>
          </div>
        </div>

        {/* ── Controls: Max Direct Header Items ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
          <div>
            <span className="text-xs font-bold text-zinc-200">Max Direct Items in Header Capsule</span>
            <p className="text-[11px] text-zinc-400">
              Additional enabled header items will automatically overflow into the &quot;More ⌄&quot; dropdown.
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {[3, 4, 5, 6, 7, 8].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => handleMaxHeaderItemsChange(count)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                  config.maxHeaderItems === count
                    ? 'bg-pink-600 text-white shadow-md shadow-pink-950'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {/* ── Scrollable Items Table / List ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2 no-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-zinc-400 text-sm">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-pink-500 border-t-transparent mr-3" />
              Loading company navigation settings...
            </div>
          ) : (
            config.items.map((item, index) => {
              const IconComp = ICON_MAP[item.icon] || Compass;
              
              // Calculate where this item currently falls
              let placementBadge = 'Hidden';
              let badgeColor = 'bg-zinc-800 text-zinc-400 border-zinc-700';

              if (item.visible) {
                if (item.showInHeader) {
                  // Determine if in direct header or more
                  const precedingHeaderCount = config.items
                    .slice(0, index)
                    .filter((it) => it.visible && it.showInHeader).length;

                  if (precedingHeaderCount < config.maxHeaderItems) {
                    placementBadge = `Header (#${precedingHeaderCount + 1})`;
                    badgeColor = 'bg-pink-950/50 text-pink-300 border-pink-500/40';
                  } else {
                    placementBadge = 'Header (More ⌄)';
                    badgeColor = 'bg-indigo-500/15 text-indigo-950 dark:text-indigo-200 border-indigo-400/50 dark:border-indigo-500/40 font-bold dark:bg-indigo-950/50';
                  }
                } else {
                  placementBadge = 'Sidebar Only';
                  badgeColor = 'bg-emerald-500/15 text-emerald-950 dark:text-emerald-200 border-emerald-400/50 dark:border-emerald-500/40 font-bold dark:bg-emerald-950/50';
                }
              }

              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl border transition-all ${
                    !item.visible
                      ? 'border-zinc-800/40 bg-zinc-950/30 opacity-60'
                      : item.showInHeader
                      ? 'border-pink-900/40 bg-zinc-950/80 shadow-xs'
                      : 'border-zinc-800 bg-zinc-950/50'
                  }`}
                >
                  {/* Left: Icon, Label, Route & Placement Badge */}
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Order Controls */}
                    <div className="flex flex-col gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleMoveItem(index, 'up')}
                        disabled={index === 0}
                        className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800/80 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveItem(index, 'down')}
                        disabled={index === config.items.length - 1}
                        className="flex h-5 w-5 items-center justify-center rounded bg-zinc-800/80 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Icon */}
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border shrink-0 ${
                        item.showInHeader && item.visible
                          ? 'bg-pink-500/20 text-pink-400 border-pink-500/40'
                          : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      <IconComp className="h-4 w-4" />
                    </div>

                    {/* Title & Route */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white truncate">
                          {item.label}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold border tracking-wide ${badgeColor}`}
                        >
                          {placementBadge}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-400 truncate block">
                        {item.href}
                      </span>
                    </div>
                  </div>

                  {/* Right: Location Toggle & Visibility Toggle */}
                  <div className="flex items-center gap-2 sm:self-center self-end shrink-0">
                    {/* Location Choice: Header vs Sidebar */}
                    <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
                      <button
                        type="button"
                        onClick={() => handleTogglePlacement(item.id, true)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                          item.showInHeader
                            ? 'bg-pink-600 text-white shadow-xs'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Show in Header (will not duplicate in Sidebar)"
                      >
                        Header
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTogglePlacement(item.id, false)}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${
                          !item.showInHeader
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                        title="Show in Sidebar only"
                      >
                        Sidebar
                      </button>
                    </div>

                    {/* Master Visibility Toggle */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisible(item.id)}
                      className={`flex h-8 items-center gap-1.5 px-2.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
                        item.visible
                          ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300 hover:bg-emerald-950/60'
                          : 'border-zinc-700 bg-zinc-800/80 text-zinc-400 hover:text-white'
                      }`}
                      title={item.visible ? 'Menu is active' : 'Menu is hidden everywhere'}
                    >
                      {item.visible ? (
                        <>
                          <Eye className="h-3.5 w-3.5 text-emerald-400" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="h-3.5 w-3.5 text-zinc-400" />
                          <span>Hidden</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Status Message Feedback ── */}
        {statusMessage && (
          <div
            className={`px-6 py-2 text-xs font-bold text-center border-t ${
              statusMessage.type === 'success'
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
            }`}
          >
            {statusMessage.text}
          </div>
        )}

        {/* ── Modal Footer ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-950/80 shrink-0">
          <button
            type="button"
            onClick={handleReset}
            disabled={isSaving}
            className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50 cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset to Factory Default</span>
          </button>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold shadow-lg shadow-pink-950/60 transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
