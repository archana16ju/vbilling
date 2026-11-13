'use client';

import React, { useState, useEffect } from 'react';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import {
  ALL_SHORTCUT_DEFINITIONS,
  ShortcutGroupId,
  normalizeEventToShortcutString,
} from '@/lib/shortcuts-config';
import {
  Keyboard,
  X,
  Search,
  Globe,
  ShoppingCart,
  Receipt,
  CreditCard,
  FileSpreadsheet,
  ChefHat,
  Sparkles,
  Sliders,
  RotateCcw,
  Save,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Building2,
  HelpCircle,
  Eye,
} from 'lucide-react';

const GROUPS: { id: ShortcutGroupId | 'all'; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Shortcuts', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'global', label: 'Anywhere', icon: <Globe className="h-4 w-4" /> },
  { id: 'sell_menu', label: 'Product Menu', icon: <ShoppingCart className="h-4 w-4" /> },
  { id: 'sell_receipt', label: 'Receipt & Cart', icon: <Receipt className="h-4 w-4" /> },
  { id: 'settlement', label: 'Payment / Settlement', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'screens', label: 'Orders & Guests', icon: <FileSpreadsheet className="h-4 w-4" /> },
  { id: 'kitchen', label: 'Kitchen (KDS)', icon: <ChefHat className="h-4 w-4" /> },
];

export default function KeyboardShortcutsHelpOverlay() {
  const {
    isHelpModalOpen,
    closeHelpModal,
    config,
    isCustom,
    activeCompanyId,
    activeCompanyName,
    toggleActionEnabled,
    setActionKey,
    addActionKey,
    removeActionKey,
    resetAction,
    resetAll,
    fetchCompanyShortcuts,
    saveToDatabase,
    resetInDatabase,
  } = useShortcutsStore();

  const [activeTab, setActiveTab] = useState<'cheatsheet' | 'customize'>('cheatsheet');
  const [selectedGroup, setSelectedGroup] = useState<ShortcutGroupId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Customization state
  const [editingTarget, setEditingTarget] = useState<{ actionId: string; keyIndex: number } | null>(null);
  const [addingTarget, setAddingTarget] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Detect user role & company list for Super Admin
  useEffect(() => {
    if (!isHelpModalOpen) return;

    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const role = roleMatch ? roleMatch[2] : '';
    const superAdmin = role === 'super_admin';
    setIsSuperAdmin(superAdmin);

    const compMatch = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
    const activeCid = compMatch ? compMatch[2] : (activeCompanyId || '');
    setSelectedCompanyId(activeCid);

    if (superAdmin) {
      fetch('/api/companies')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCompanies(data);
          }
        })
        .catch(() => {});
    }

    fetchCompanyShortcuts(activeCid || undefined);
  }, [isHelpModalOpen, activeCompanyId, fetchCompanyShortcuts]);

  // Handle key recording when editing or adding a shortcut
  useEffect(() => {
    if (!isHelpModalOpen || (!editingTarget && !addingTarget)) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape cancels key recording without closing overlay
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setEditingTarget(null);
        setAddingTarget(null);
        setConflictError(null);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const pressedStr = normalizeEventToShortcutString(e);
      if (!pressedStr) return; // ignore bare modifier presses (e.g. just Ctrl)

      setConflictError(null);

      if (editingTarget) {
        const res = setActionKey(
          editingTarget.actionId,
          editingTarget.keyIndex,
          pressedStr
        );
        if (!res.success) {
          setConflictError(res.conflictMessage || 'Shortcut conflict detected.');
        } else {
          setEditingTarget(null);
        }
      } else if (addingTarget) {
        const res = addActionKey(addingTarget, pressedStr);
        if (!res.success) {
          setConflictError(res.conflictMessage || 'Shortcut conflict detected.');
        } else {
          setAddingTarget(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isHelpModalOpen, editingTarget, addingTarget, setActionKey, addActionKey]);

  // Close overlay on Escape when NOT actively recording a key
  useEffect(() => {
    if (!isHelpModalOpen || editingTarget || addingTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeHelpModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isHelpModalOpen, editingTarget, addingTarget, closeHelpModal]);

  if (!isHelpModalOpen) return null;

  const handleCompanySwitch = (newCid: string) => {
    setSelectedCompanyId(newCid);
    setConflictError(null);
    setEditingTarget(null);
    setAddingTarget(null);
    fetchCompanyShortcuts(newCid);
  };

  const handleSave = async () => {
    setStatusMessage({ type: 'info', text: 'Saving company shortcuts...' });
    const targetCid = selectedCompanyId || activeCompanyId;
    const res = await saveToDatabase(targetCid);
    if (res.success) {
      const compLabel = companies.find((c) => c.id === targetCid)?.name || activeCompanyName || targetCid;
      setStatusMessage({
        type: 'success',
        text: `Shortcuts saved successfully for ${compLabel}!`,
      });
      setTimeout(() => setStatusMessage(null), 3500);
    } else {
      setStatusMessage({
        type: 'error',
        text: res.error || 'Failed to save shortcuts.',
      });
      setTimeout(() => setStatusMessage(null), 4500);
    }
  };

  const handleResetToDefaults = async () => {
    if (
      confirm(
        'Are you sure you want to reset all keyboard shortcuts for this company back to original system defaults?'
      )
    ) {
      setStatusMessage({ type: 'info', text: 'Resetting to system defaults...' });
      const targetCid = selectedCompanyId || activeCompanyId;
      const res = await resetInDatabase(targetCid);
      if (res.success) {
        setStatusMessage({
          type: 'success',
          text: 'Reset to system defaults successfully!',
        });
        setTimeout(() => setStatusMessage(null), 3500);
      } else {
        resetAll();
        setStatusMessage({
          type: 'info',
          text: 'Reset to defaults locally.',
        });
        setTimeout(() => setStatusMessage(null), 3500);
      }
    }
  };

  const query = searchQuery.toLowerCase().trim();

  const filteredShortcuts = ALL_SHORTCUT_DEFINITIONS.filter((def) => {
    if (selectedGroup !== 'all' && def.group !== selectedGroup) return false;
    if (!query) return true;

    const actionState = config.actions[def.id];
    const keysStr = (actionState?.keys || def.defaultKeys).join(' ').toLowerCase();
    return (
      def.label.toLowerCase().includes(query) ||
      def.description.toLowerCase().includes(query) ||
      def.groupLabel.toLowerCase().includes(query) ||
      keysStr.includes(query)
    );
  });

  const displayCompanyName =
    companies.find((c) => c.id === (selectedCompanyId || activeCompanyId))?.name ||
    activeCompanyName ||
    selectedCompanyId ||
    activeCompanyId ||
    'Active Company';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
        
        {/* Header Bar */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 px-5 sm:px-6 py-4 flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center rounded-2xl border shadow-xs shrink-0"
                style={{
                  backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                  borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                  color: 'var(--theme-accent, #DB2777)',
                }}
              >
                <Keyboard className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                    Keyboard Shortcuts
                  </h2>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    Press ? anywhere
                  </span>
                  {isCustom ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400">
                      Company Customized
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                      System Default
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                  <Building2 className="h-3 w-3 text-pink-500 shrink-0" />
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    {displayCompanyName}
                  </span>
                  {(selectedCompanyId || activeCompanyId) && (
                    <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                      {selectedCompanyId || activeCompanyId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mode Switcher Tabs + Close */}
            <div className="flex items-center gap-2 self-end sm:self-center">
              <div className="flex items-center rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setActiveTab('cheatsheet')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'cheatsheet'
                      ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" />
                  <span>Cheatsheet</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('customize')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    activeTab === 'customize'
                      ? 'btn-theme-primary text-white shadow-theme-glow preserve-white'
                      : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Customize</span>
                </button>
              </div>

              <button
                onClick={closeHelpModal}
                className="rounded-xl p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Super Admin Company Selector (If Super Admin) */}
          {isSuperAdmin && companies.length > 0 && activeTab === 'customize' && (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-900/60 text-xs">
              <span className="font-bold text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-pink-500" />
                Select Company to Customize:
              </span>
              <select
                value={selectedCompanyId || activeCompanyId}
                onChange={(e) => handleCompanySwitch(e.target.value)}
                className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2.5 py-1 text-xs font-bold text-zinc-900 dark:text-white outline-none focus:border-pink-500"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Search bar & Group tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search shortcut, key or action..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-4 text-xs font-medium text-zinc-800 dark:text-white outline-none focus:border-pink-500 shadow-inner"
              />
            </div>

            {/* Quick Action buttons in Customize mode */}
            {activeTab === 'customize' && (
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 px-3 py-1.5 text-xs font-bold text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 transition cursor-pointer"
                  title="Reset this company's shortcuts to system defaults"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-theme-glow border border-theme transition active:scale-95 cursor-pointer"
                  title="Save shortcuts to company database"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Group Filter Tabs */}
        <div className="px-5 sm:px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {GROUPS.map((grp) => {
            const isActive = selectedGroup === grp.id;
            return (
              <button
                key={grp.id}
                onClick={() => setSelectedGroup(grp.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'btn-theme-primary text-white shadow-theme-glow preserve-white'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                }`}
              >
                {grp.icon}
                <span>{grp.label}</span>
              </button>
            );
          })}
        </div>

        {/* Status / Conflict Alert Banner */}
        {conflictError && (
          <div className="px-6 py-2.5 bg-rose-500/15 border-b border-rose-500/30 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-500" />
              <span>{conflictError}</span>
            </div>
            <button
              onClick={() => setConflictError(null)}
              className="text-rose-500 hover:text-rose-700 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {statusMessage && (
          <div
            className={`px-6 py-2.5 border-b flex items-center justify-between text-xs font-bold animate-in fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : statusMessage.type === 'error'
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                : 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="opacity-70 hover:opacity-100 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 no-scrollbar">
          {filteredShortcuts.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <Keyboard className="mx-auto mb-2 h-10 w-10 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-bold">No matching shortcuts found</p>
              <p className="text-xs text-zinc-500 mt-1">Try another search term or clear the filter</p>
            </div>
          ) : activeTab === 'cheatsheet' ? (
            /* ─────────────────────────────────────────
               MODE 1: CHEATSHEET (View Mode)
            ───────────────────────────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredShortcuts.map((def) => {
                const actionState = config.actions[def.id] || {
                  enabled: true,
                  keys: def.defaultKeys,
                };
                const isEnabled = actionState.enabled;
                const assignedKeys =
                  actionState.keys && actionState.keys.length > 0 ? actionState.keys : def.defaultKeys;

                return (
                  <div
                    key={def.id}
                    className={`flex items-start justify-between rounded-2xl border p-3.5 transition-all group ${
                      isEnabled
                        ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700'
                        : 'border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-100/40 dark:bg-zinc-950/20 opacity-50'
                    }`}
                  >
                    <div className="flex-1 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-zinc-900 dark:text-white">
                          {def.label}
                        </span>
                        {!isEnabled && (
                          <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                            Disabled
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                        {def.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                          {def.groupLabel}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('customize');
                            setEditingTarget({ actionId: def.id, keyIndex: 0 });
                          }}
                          className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-pink-500 hover:underline transition cursor-pointer"
                        >
                          Customize
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end max-w-[180px]">
                      {assignedKeys.map((k, i) => (
                        <kbd
                          key={i}
                          className="rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-mono font-bold shadow-xs transition"
                          style={{ color: 'var(--theme-accent, #DB2777)' }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ─────────────────────────────────────────
               MODE 2: CUSTOMIZE (Edit Mode)
            ───────────────────────────────────────── */
            <div className="space-y-3">
              <div className="p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Click any key chip to record a new key combination. Duplicate keys are automatically checked and prevented.
                </span>
                <span className="text-[11px] font-bold text-pink-500 shrink-0">
                  Isolated for: {displayCompanyName}
                </span>
              </div>

              {filteredShortcuts.map((def) => {
                const actionState = config.actions[def.id] || {
                  enabled: true,
                  keys: def.defaultKeys,
                };
                const isEnabled = actionState.enabled;
                const assignedKeys =
                  actionState.keys && actionState.keys.length > 0 ? actionState.keys : def.defaultKeys;
                const isAdding = addingTarget === def.id;

                return (
                  <div
                    key={def.id}
                    className={`rounded-2xl border p-4 transition-all ${
                      isEnabled
                        ? 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70'
                        : 'border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-100/40 dark:bg-zinc-950/20 opacity-60'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      {/* Left: Action Label & Description */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5">
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => toggleActionEnabled(def.id)}
                              className="sr-only peer"
                            />
                            <div className="w-8 h-4.5 bg-zinc-300 dark:bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-pink-600"></div>
                          </label>
                          <span className="font-bold text-sm text-zinc-900 dark:text-white">
                            {def.label}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                            {def.groupLabel}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 pl-10.5">
                          {def.description}
                        </p>
                      </div>

                      {/* Right: Key Chips, Add Key, and Reset */}
                      <div className="flex items-center gap-2 flex-wrap justify-end pl-10.5 sm:pl-0">
                        {assignedKeys.map((k, idx) => {
                          const isEditingThis =
                            editingTarget?.actionId === def.id && editingTarget?.keyIndex === idx;

                          return (
                            <div key={idx} className="relative flex items-center">
                              {isEditingThis ? (
                                <button
                                  type="button"
                                  className="rounded-xl border-2 border-pink-500 bg-pink-500/10 px-3 py-1.5 text-xs font-mono font-bold text-pink-500 animate-pulse flex items-center gap-1.5 shadow-sm"
                                  title="Press any key combination on your keyboard (Esc to cancel)"
                                >
                                  <span>Press keys...</span>
                                  <span className="text-[9px] font-sans opacity-70">(Esc to cancel)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConflictError(null);
                                    setAddingTarget(null);
                                    setEditingTarget({ actionId: def.id, keyIndex: idx });
                                  }}
                                  className="group inline-flex items-center gap-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-mono font-bold text-zinc-800 dark:text-white hover:border-pink-500 hover:text-pink-500 transition shadow-xs cursor-pointer"
                                  title="Click to change this key"
                                >
                                  <span>{k}</span>
                                  <span className="text-[9px] text-zinc-400 group-hover:text-pink-400">
                                    Edit
                                  </span>
                                </button>
                              )}

                              {assignedKeys.length > 1 && !isEditingThis && (
                                <button
                                  type="button"
                                  onClick={() => removeActionKey(def.id, idx)}
                                  className="ml-1 rounded-lg p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                                  title="Remove this alternative shortcut"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {/* Add Secondary Key */}
                        {isAdding ? (
                          <button
                            type="button"
                            className="rounded-xl border-2 border-indigo-500 bg-indigo-500/10 px-3 py-1.5 text-xs font-mono font-bold text-indigo-500 animate-pulse flex items-center gap-1.5 shadow-sm"
                            title="Press any key combination to add (Esc to cancel)"
                          >
                            <span>Press key to add...</span>
                            <span className="text-[9px] font-sans opacity-70">(Esc)</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setConflictError(null);
                              setEditingTarget(null);
                              setAddingTarget(def.id);
                            }}
                            className="inline-flex items-center gap-1 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 px-2.5 py-1.5 text-xs font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:border-zinc-400 transition cursor-pointer"
                            title="Add an alternative key for this action"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Add Key</span>
                          </button>
                        )}

                        {/* Reset individual action */}
                        <button
                          type="button"
                          onClick={() => resetAction(def.id)}
                          className="rounded-xl p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition cursor-pointer"
                          title="Reset this action to its default key"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 px-5 sm:px-6 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>
              {activeTab === 'cheatsheet' ? (
                <>
                  Need to change a shortcut? Switch to <strong>Customize</strong> above or press <strong>Customize</strong> on any item.
                </>
              ) : (
                <>
                  Shortcuts are saved separately for <strong>{displayCompanyName}</strong> in its company database.
                </>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            {activeTab === 'customize' && (
              <>
                <button
                  type="button"
                  onClick={handleResetToDefaults}
                  className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-xl btn-theme-primary px-4 py-1.5 font-bold text-white shadow-theme-glow border border-theme transition cursor-pointer"
                >
                  Save Shortcuts
                </button>
              </>
            )}
            <button
              onClick={closeHelpModal}
              className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-1.5 font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
