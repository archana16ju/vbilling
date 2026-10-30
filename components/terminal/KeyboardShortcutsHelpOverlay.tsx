'use client';

import React, { useState, useEffect } from 'react';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import { ALL_SHORTCUT_DEFINITIONS, ShortcutGroupId } from '@/lib/shortcuts-config';
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
  const { isHelpModalOpen, closeHelpModal, config } = useShortcutsStore();
  const [selectedGroup, setSelectedGroup] = useState<ShortcutGroupId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Close on Escape key
  useEffect(() => {
    if (!isHelpModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        closeHelpModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isHelpModalOpen, closeHelpModal]);

  if (!isHelpModalOpen) return null;

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-4xl max-h-[85vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 text-zinc-900 dark:text-zinc-100">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-2xl border shadow-xs"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-zinc-900 dark:text-white">
                  Keyboard Shortcuts Cheatsheet
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                  Press ? anywhere
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Quick reference for counter shortcuts. Press <kbd className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">Esc</kbd> to close.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Search shortcut or key..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 py-2 pl-9 pr-4 text-xs font-medium text-zinc-800 dark:text-white outline-none focus:border-zinc-400 dark:focus:border-zinc-500 shadow-inner"
              />
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

        {/* Group Filter Tabs */}
        <div className="px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
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

        {/* Shortcuts List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar">
          {filteredShortcuts.length === 0 ? (
            <div className="py-16 text-center text-zinc-400">
              <Keyboard className="mx-auto mb-2 h-10 w-10 text-zinc-300 dark:text-zinc-700" />
              <p className="text-sm font-bold">No matching shortcuts found</p>
              <p className="text-xs text-zinc-500 mt-1">Try another search term or clear the filter</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredShortcuts.map((def) => {
                const actionState = config.actions[def.id] || {
                  enabled: true,
                  keys: def.defaultKeys,
                };
                const isEnabled = actionState.enabled;
                const assignedKeys = actionState.keys && actionState.keys.length > 0 ? actionState.keys : def.defaultKeys;

                return (
                  <div
                    key={def.id}
                    className={`flex items-start justify-between rounded-2xl border p-3.5 transition-all ${
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
                      <span className="inline-block mt-1 text-[10px] font-semibold text-zinc-400 dark:text-zinc-500">
                        {def.groupLabel}
                      </span>
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
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/80 px-6 py-3 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            Customize any key or add secondary keys in <strong>Settings → Keyboard Shortcuts</strong>
          </span>
          <button
            onClick={closeHelpModal}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-1.5 font-bold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
