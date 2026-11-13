'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import KeyboardShortcutsHelpOverlay from '@/components/terminal/KeyboardShortcutsHelpOverlay';
import { Lock, Unlock, Clock } from 'lucide-react';

export default function GlobalShortcutsHandler() {
  const router = useRouter();
  const { isActionTriggered, toggleHelpModal, openHelpModal, closeHelpModal, fetchCompanyShortcuts } =
    useShortcutsStore();

  const [isCounterLocked, setIsCounterLocked] = useState(false);
  const [showShiftNotice, setShowShiftNotice] = useState(false);

  // Initialize company shortcuts on load and react to company switches
  useEffect(() => {
    fetchCompanyShortcuts();

    const handleCompanyChange = () => {
      fetchCompanyShortcuts();
    };
    window.addEventListener('company-theme-changed', handleCompanyChange);
    window.addEventListener('company-switched', handleCompanyChange);
    window.addEventListener('focus', handleCompanyChange);
    return () => {
      window.removeEventListener('company-theme-changed', handleCompanyChange);
      window.removeEventListener('company-switched', handleCompanyChange);
      window.removeEventListener('focus', handleCompanyChange);
    };
  }, [fetchCompanyShortcuts]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // 1. Show all shortcuts overlay on '?' (only when not typing in an input field)
      if (isActionTriggered('global_show_shortcuts', e) && !isInput) {
        e.preventDefault();
        toggleHelpModal();
        return;
      }

      // 2. Help for this screen: Alt + H
      if (isActionTriggered('global_help_screen', e)) {
        e.preventDefault();
        openHelpModal();
        return;
      }

      // 3. Close dialog: Esc
      if (isActionTriggered('global_close_dialog', e)) {
        closeHelpModal();
        setIsCounterLocked(false);
        setShowShiftNotice(false);
        return;
      }

      // 4. Lock counter: Ctrl + L
      if (isActionTriggered('global_lock_counter', e)) {
        e.preventDefault();
        setIsCounterLocked(true);
        return;
      }

      // 5. Open/close shift: Ctrl + Shift + S
      if (isActionTriggered('global_shift', e)) {
        e.preventDefault();
        setShowShiftNotice(true);
        setTimeout(() => setShowShiftNotice(false), 3000);
        return;
      }

      // 6. Reload this screen: Ctrl + R
      if (isActionTriggered('global_reload', e) && !isInput) {
        // Let standard browser reload happen, or trigger router refresh
        // router.refresh();
      }

      // 7. Global Navigation: F1 - F8, Ctrl + ,
      if (isActionTriggered('global_terminal', e)) {
        e.preventDefault();
        router.push('/terminal');
        return;
      }
      if (isActionTriggered('global_tables', e)) {
        e.preventDefault();
        router.push('/tables');
        return;
      }
      if (isActionTriggered('global_orders', e)) {
        e.preventDefault();
        router.push('/sales');
        return;
      }
      if (isActionTriggered('global_kitchen', e)) {
        e.preventDefault();
        router.push('/kitchen');
        return;
      }
      if (isActionTriggered('global_delivery', e)) {
        e.preventDefault();
        router.push('/delivery');
        return;
      }
      if (isActionTriggered('global_menu', e)) {
        e.preventDefault();
        router.push('/products');
        return;
      }
      if (isActionTriggered('global_guests', e)) {
        e.preventDefault();
        router.push('/customers');
        return;
      }
      if (isActionTriggered('global_reports', e)) {
        e.preventDefault();
        router.push('/reports');
        return;
      }
      if (isActionTriggered('global_settings', e)) {
        e.preventDefault();
        router.push('/settings');
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActionTriggered, toggleHelpModal, openHelpModal, closeHelpModal, router]);

  return (
    <>
      <KeyboardShortcutsHelpOverlay />

      {/* Counter Lock Overlay */}
      {isCounterLocked && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/90 backdrop-blur-xl p-6 text-white animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-3xl border border-zinc-800 bg-zinc-900 p-8 text-center shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 mb-4">
              <Lock className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-black text-white">Counter Screen Locked</h2>
            <p className="text-xs text-zinc-400 mt-2">
              Terminal is paused for security. Click below or press <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[11px]">Esc</kbd> to unlock.
            </p>
            <button
              onClick={() => setIsCounterLocked(false)}
              className="mt-6 w-full rounded-xl btn-theme-primary py-3 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Unlock className="h-4 w-4" />
              <span>Unlock Counter</span>
            </button>
          </div>
        </div>
      )}

      {/* Shift Notification */}
      {showShiftNotice && (
        <div className="fixed bottom-6 right-6 z-[120] rounded-2xl border border-theme bg-theme-bar px-5 py-3.5 text-white shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black/30 text-white">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-bold">Cashier Shift Status</div>
            <div className="text-[11px] text-white/80">Active Shift: Regular Counter Shift #1</div>
          </div>
        </div>
      )}
    </>
  );
}
