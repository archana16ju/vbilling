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
  Save,
  RotateCcw,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  Building2,
  Sliders,
  HelpCircle,
  Eye,
} from 'lucide-react';

const CATEGORIES: { id: ShortcutGroupId; label: string }[] = [
  { id: 'global', label: 'Anywhere – Global' },
  { id: 'sell_menu', label: 'Sell – Product Menu' },
  { id: 'sell_receipt', label: 'Sell – Receipt / Cart' },
  { id: 'settlement', label: 'Settlement / Payment' },
  { id: 'screens', label: 'Orders, Guests & Menu' },
  { id: 'kitchen', label: 'Kitchen' },
];

export default function KeyboardShortcutsSettingsPanel() {
  const {
    config,
    isCustom,
    activeCompanyId,
    openHelpModal,
    setShowKeysOnButtons,
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

  const [activeCategory, setActiveCategory] = useState<ShortcutGroupId>('global');
  const [editingTarget, setEditingTarget] = useState<{ actionId: string; keyIndex: number } | null>(
    null
  );
  const [addingTarget, setAddingTarget] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Identify role and load available companies for Super Admin
  useEffect(() => {
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const role = roleMatch ? roleMatch[2] : '';
    const superAdmin = role === 'super_admin';
    setIsSuperAdmin(superAdmin);

    const compMatch = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
    const activeCid = compMatch ? compMatch[2] : '';
    setSelectedCompanyId(activeCid);

    if (superAdmin) {
      fetch('/api/companies')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setCompanies(data);
            if (!activeCid && data.length > 0) {
              setSelectedCompanyId(data[0].id);
              fetchCompanyShortcuts(data[0].id);
            }
          }
        })
        .catch(() => {});
    } else {
      fetchCompanyShortcuts(activeCid);
    }
  }, [fetchCompanyShortcuts]);

  // Handle key recording when editing or adding a shortcut
  useEffect(() => {
    if (!editingTarget && !addingTarget) return;

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [editingTarget, addingTarget, setActionKey, addActionKey]);

  const handleCompanySwitch = (newCid: string) => {
    setSelectedCompanyId(newCid);
    setConflictError(null);
    setEditingTarget(null);
    setAddingTarget(null);
    fetchCompanyShortcuts(newCid);
  };

  const handleSave = async () => {
    setSaveStatus('Saving shortcuts...');
    const res = await saveToDatabase(selectedCompanyId);
    if (res.success) {
      setSaveStatus('Shortcuts saved successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } else {
      setSaveStatus(res.error || 'Failed to save');
      setTimeout(() => setSaveStatus(null), 4000);
    }
  };

  const handleResetToDefaults = async () => {
    if (
      confirm(
        'Are you sure you want to reset all keyboard shortcuts to their original system defaults?'
      )
    ) {
      setSaveStatus('Resetting...');
      const res = await resetInDatabase(selectedCompanyId);
      if (res.success) {
        setSaveStatus('Reset to system defaults successfully!');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        resetAll();
        setSaveStatus('Reset to defaults locally.');
        setTimeout(() => setSaveStatus(null), 3000);
      }
    }
  };

  const currentCategoryDefinitions = ALL_SHORTCUT_DEFINITIONS.filter(
    (def) => def.group === activeCategory
  );

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl text-white backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl border shrink-0 mt-0.5 shadow-sm"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <Keyboard className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-white">Keyboard Shortcuts</h2>
                {isCustom ? (
                  <span className="rounded-full bg-theme-bar border border-theme px-2.5 py-0.5 text-[10px] font-bold text-white shadow-xs">
                    Customized for Company
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-bold text-zinc-400">
                    System Default
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-zinc-400 max-w-2xl leading-relaxed">
                Every key this counter responds to. Change any of them, or add a second key of your own. Press ? on any screen to see the list while working.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openHelpModal}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-2 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              title="Show interactive overlay cheatsheet (?)"
            >
              <HelpCircle className="h-3.5 w-3.5 text-pink-400" />
              <span>Press ? Preview</span>
            </button>
            <button
              type="button"
              onClick={handleResetToDefaults}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-950/30 px-3 py-2 text-xs font-bold text-rose-300 hover:bg-rose-900/40 transition cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Defaults</span>
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-theme-glow border border-theme transition active:scale-95 cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Shortcuts</span>
            </button>
          </div>
        </div>

        {/* Super Admin Company Selector */}
        {isSuperAdmin && companies.length > 0 && (
          <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-950/40 p-3 rounded-xl border">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-theme-accent" />
              <span className="text-xs font-bold text-zinc-300">
                Configure Shortcuts for Company:
              </span>
            </div>
            <select
              value={selectedCompanyId}
              onChange={(e) => handleCompanySwitch(e.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-theme"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.id})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Save feedback toast */}
        {saveStatus && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-400 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{saveStatus}</span>
          </div>
        )}

        {/* Conflict Error Message */}
        {conflictError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-500/15 border border-rose-500/30 p-3 text-xs font-bold text-rose-300 animate-in fade-in">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span className="flex-1">{conflictError}</span>
            <button
              onClick={() => setConflictError(null)}
              className="text-zinc-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Button Key Indicator Option Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-xl text-white backdrop-blur-sm">
        <label className="flex items-center justify-between cursor-pointer">
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl border shadow-xs"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <Eye className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">
                Show the keys on the buttons
              </div>
              <div className="text-xs text-zinc-400">
                Display small, unobtrusive shortcut keys beneath or beside terminal buttons (e.g. F9 under Send to Kitchen, F10 under Bill Only, F12 under Bill & Settle).
              </div>
            </div>
          </div>
          <div
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              config.showKeysOnButtons
                ? 'bg-theme-bar shadow-theme-glow'
                : 'bg-zinc-800'
            }`}
          >
            <input
              type="checkbox"
              checked={config.showKeysOnButtons}
              onChange={(e) => setShowKeysOnButtons(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                config.showKeysOnButtons ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </label>
      </div>

      {/* Category Tabs */}
      <div className="flex rounded-2xl bg-zinc-900/90 p-1.5 border border-zinc-800 overflow-x-auto no-scrollbar gap-1">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setEditingTarget(null);
                setAddingTarget(null);
                setConflictError(null);
              }}
              className={`rounded-xl px-4 py-2.5 text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'btn-theme-primary text-white shadow-theme-glow preserve-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Shortcuts Action Table / Cards */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-xl overflow-hidden divide-y divide-zinc-800/60 text-white backdrop-blur-sm">
        {currentCategoryDefinitions.map((def) => {
          const actionState = config.actions[def.id] || {
            enabled: true,
            keys: [...def.defaultKeys],
          };
          const isEnabled = actionState.enabled;
          const assignedKeys =
            actionState.keys && actionState.keys.length > 0
              ? actionState.keys
              : [...def.defaultKeys];
          const isEditingAny =
            editingTarget?.actionId === def.id || addingTarget === def.id;

          return (
            <div
              key={def.id}
              className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                !isEnabled ? 'opacity-50 bg-zinc-950/40' : 'hover:bg-zinc-800/30'
              }`}
            >
              {/* Left Column: Switch + Label + Description */}
              <div className="flex items-start gap-3.5 flex-1">
                <button
                  type="button"
                  onClick={() => toggleActionEnabled(def.id)}
                  title={isEnabled ? 'Click to disable shortcut' : 'Click to enable shortcut'}
                  className={`mt-1 relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${
                    isEnabled ? 'bg-theme-bar shadow-theme-glow' : 'bg-zinc-800'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
                      isEnabled ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>

                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white">{def.label}</h3>
                    {!isEnabled && (
                      <span className="text-[10px] font-mono uppercase font-bold text-zinc-500 bg-zinc-800 px-1.5 py-0.2 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{def.description}</p>
                </div>
              </div>

              {/* Right Column: Keys List & Actions */}
              <div className="flex items-center gap-2 flex-wrap md:justify-end">
                {assignedKeys.map((k, keyIdx) => {
                  const isThisKeyEditing =
                    editingTarget?.actionId === def.id &&
                    editingTarget.keyIndex === keyIdx;

                  return (
                    <div
                      key={keyIdx}
                      className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1 shadow-inner group"
                    >
                      {isThisKeyEditing ? (
                        <span
                          className="px-2 py-0.5 text-xs font-mono font-bold animate-pulse rounded"
                          style={{
                            backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                            color: 'var(--theme-badge-text, #F472B6)',
                          }}
                        >
                          Press key combo...
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setConflictError(null);
                            setAddingTarget(null);
                            setEditingTarget({ actionId: def.id, keyIndex: keyIdx });
                          }}
                          className="text-xs font-mono font-bold hover:underline cursor-pointer"
                          style={{ color: 'var(--theme-accent, #DB2777)' }}
                          title="Click to change this shortcut key"
                        >
                          {k}
                        </button>
                      )}

                      {/* Remove additional key (allowed if more than 1 key assigned) */}
                      {assignedKeys.length > 1 && !isThisKeyEditing && (
                        <button
                          type="button"
                          onClick={() => removeActionKey(def.id, keyIdx)}
                          className="text-zinc-500 hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
                          title="Remove additional shortcut key"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}

                      {isThisKeyEditing && (
                        <button
                          type="button"
                          onClick={() => setEditingTarget(null)}
                          className="text-zinc-400 hover:text-white p-0.5"
                          title="Cancel"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}

                {/* Add Second / Extra Key Button */}
                {addingTarget === def.id ? (
                  <div
                    className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-theme px-3 py-1 text-xs font-mono font-bold animate-pulse"
                    style={{
                      backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                      color: 'var(--theme-badge-text, #F472B6)',
                    }}
                  >
                    <span>Press second key...</span>
                    <button
                      type="button"
                      onClick={() => setAddingTarget(null)}
                      className="text-zinc-400 hover:text-white"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setConflictError(null);
                      setEditingTarget(null);
                      setAddingTarget(def.id);
                    }}
                    className="inline-flex items-center gap-1 rounded-xl border border-zinc-700 bg-zinc-800/60 px-2.5 py-1 text-[11px] font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                    title="Add a second shortcut key for this action"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Key</span>
                  </button>
                )}

                {/* Action-level reset button if modified */}
                {(assignedKeys.join(',') !== def.defaultKeys.join(',') || !isEnabled) && (
                  <button
                    type="button"
                    onClick={() => resetAction(def.id)}
                    className="rounded-xl px-2 py-1 text-[11px] font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                    title="Reset this action to default"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
