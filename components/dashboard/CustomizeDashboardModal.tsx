'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  SlidersHorizontal,
  Check,
  RotateCcw,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  LayoutGrid,
  BarChart3,
  TrendingUp,
  FileText,
  Sparkles,
  Layers,
  Save,
  CheckCircle2,
  AlertCircle,
  Building2,
} from 'lucide-react';
import {
  CompanyDashboardConfig,
  DashboardWidgetConfig,
  DEFAULT_COMPANY_DASHBOARD_CONFIG,
  DEFAULT_DASHBOARD_WIDGETS,
} from '@/lib/dashboard-config';

interface CustomizeDashboardProps {
  isOpen?: boolean;
  onClose?: () => void;
  isInline?: boolean; // When rendered directly inside Settings page tab
}

export default function CustomizeDashboardModal({
  isOpen = true,
  onClose,
  isInline = false,
}: CustomizeDashboardProps) {
  const [config, setConfig] = useState<CompanyDashboardConfig>(DEFAULT_COMPANY_DASHBOARD_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [companyInfo, setCompanyInfo] = useState<{ id: string; name: string } | null>(null);
  const [filterCategory, setFilterCategory] = useState<'all' | 'kpi' | 'chart' | 'analytics' | 'feed'>('all');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load active company's dashboard config
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    fetch('/api/companies/dashboard-config')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isMounted && data && data.success && data.config) {
          setConfig(data.config);
          if (data.companyId) {
            setCompanyInfo({ id: data.companyId, name: data.companyName || data.companyId });
          }
        }
      })
      .catch((err) => {
        console.error('Error fetching dashboard configuration:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleWidgetVisibility = (widgetId: string) => {
    setConfig((prev) => ({
      ...prev,
      widgets: prev.widgets.map((w) =>
        w.id === widgetId ? { ...w, visible: !w.visible } : w
      ),
    }));
  };

  const moveWidget = (index: number, direction: 'up' | 'down') => {
    setConfig((prev) => {
      const list = [...prev.widgets];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= list.length) return prev;

      const temp = list[index];
      list[index] = list[targetIndex];
      list[targetIndex] = temp;

      // Re-index orders
      const reordered = list.map((item, idx) => ({ ...item, order: idx }));
      return { ...prev, widgets: reordered };
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/companies/dashboard-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to save dashboard configuration.');
      }

      setSuccessMessage('Dashboard customization saved successfully for this company!');
      
      // Dispatch event to inform dashboard page to refresh its widget order & visibility
      try {
        window.dispatchEvent(
          new CustomEvent('company-dashboard-config-updated', {
            detail: { config: result.config },
          })
        );
      } catch {}

      setTimeout(() => {
        if (onClose && !isInline) onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error saving dashboard configuration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset the dashboard widgets and layout to the system default?')) {
      return;
    }

    setIsResetting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/companies/dashboard-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || 'Failed to reset dashboard configuration.');
      }

      setConfig(result.config || DEFAULT_COMPANY_DASHBOARD_CONFIG);
      setSuccessMessage('Dashboard reset to system default!');

      try {
        window.dispatchEvent(
          new CustomEvent('company-dashboard-config-updated', {
            detail: { config: result.config || DEFAULT_COMPANY_DASHBOARD_CONFIG },
          })
        );
      } catch {}
    } catch (err: any) {
      setErrorMessage(err.message || 'Error resetting dashboard configuration.');
    } finally {
      setIsResetting(false);
    }
  };

  if (!isOpen && !isInline) return null;

  const filteredWidgets = config.widgets.filter((w) =>
    filterCategory === 'all' ? true : w.category === filterCategory
  );

  const visibleCount = config.widgets.filter((w) => w.visible).length;

  const content = (
    <div className="flex flex-col h-full text-zinc-100 max-h-[85vh]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-600 to-rose-600 text-white shadow-lg shadow-pink-600/30">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                Customize Dashboard
              </h3>
              {companyInfo && (
                <span className="inline-flex items-center gap-1 rounded-full bg-pink-500/15 border border-pink-500/30 px-2 py-0.5 text-[10px] font-bold text-pink-400 font-mono">
                  <Building2 className="h-2.5 w-2.5" />
                  {companyInfo.name}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400">
              Configure widget visibility, ordering, and layout density for your company.
            </p>
          </div>
        </div>

        {onClose && !isInline && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-950/70 border border-emerald-500/40 p-2.5 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="mb-3 flex items-center gap-2 rounded-xl bg-rose-950/70 border border-rose-500/40 p-2.5 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-3 border-b border-zinc-800/60">
        {/* Layout Density */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-zinc-300">Layout Density:</span>
          <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900/90 p-1">
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, layoutMode: 'comfortable' }))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                config.layoutMode === 'comfortable'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Comfortable
            </button>
            <button
              type="button"
              onClick={() => setConfig((prev) => ({ ...prev, layoutMode: 'compact' }))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition ${
                config.layoutMode === 'compact'
                  ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Compact
            </button>
          </div>
        </div>

        {/* Filter Categories */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-zinc-400 mr-1 font-mono">
            {visibleCount}/{config.widgets.length} visible
          </span>
          {(['all', 'kpi', 'chart', 'analytics', 'feed'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilterCategory(cat)}
              className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition uppercase tracking-wider ${
                filterCategory === cat
                  ? 'bg-pink-500/20 border border-pink-500/40 text-pink-300'
                  : 'bg-zinc-900/80 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Widget List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 no-scrollbar">
        {filteredWidgets.map((widget) => {
          const originalIndex = config.widgets.findIndex((w) => w.id === widget.id);
          const isFirst = originalIndex === 0;
          const isLast = originalIndex === config.widgets.length - 1;

          return (
            <div
              key={widget.id}
              className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-all ${
                widget.visible
                  ? 'bg-zinc-900/90 border-zinc-800/80 hover:border-zinc-700'
                  : 'bg-zinc-950/60 border-zinc-900 opacity-60'
              }`}
            >
              {/* Left: Visibility toggle & details */}
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => toggleWidgetVisibility(widget.id)}
                  className={`flex h-8 w-8 items-center justify-center rounded-xl border transition cursor-pointer shrink-0 ${
                    widget.visible
                      ? 'bg-pink-500/20 border-pink-500/40 text-pink-400 hover:bg-pink-500/30'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'
                  }`}
                  title={widget.visible ? 'Hide widget' : 'Show widget'}
                >
                  {widget.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold truncate ${widget.visible ? 'text-white' : 'text-zinc-400'}`}>
                      {widget.label}
                    </p>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[9px] font-mono uppercase text-zinc-400 shrink-0">
                      {widget.category}
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                    {widget.description}
                  </p>
                </div>
              </div>

              {/* Right: Reorder Up / Down */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  disabled={isFirst}
                  onClick={() => moveWidget(originalIndex, 'up')}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                    isFirst
                      ? 'border-transparent text-zinc-700 cursor-not-allowed'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer'
                  }`}
                  title="Move Up"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => moveWidget(originalIndex, 'down')}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                    isLast
                      ? 'border-transparent text-zinc-700 cursor-not-allowed'
                      : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer'
                  }`}
                  title="Move Down"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-800/80 gap-3">
        <button
          type="button"
          disabled={isResetting || isSaving}
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/90 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
        >
          <RotateCcw className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin' : ''}`} />
          <span>Reset to Default</span>
        </button>

        <div className="flex items-center gap-2">
          {onClose && !isInline && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-900 text-xs font-bold text-zinc-300 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
            >
              Cancel
            </button>
          )}

          <button
            type="button"
            disabled={isSaving || isResetting}
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-600 via-rose-500 to-pink-500 text-xs font-black text-white shadow-lg shadow-pink-600/30 hover:opacity-95 transition cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <Save className={`h-3.5 w-3.5 ${isSaving ? 'animate-spin' : ''}`} />
            <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-950/98 p-6 shadow-2xl backdrop-blur-2xl">
        {content}
      </div>
    </div>
  );
}
