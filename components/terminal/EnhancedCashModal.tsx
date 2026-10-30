'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { X, Banknote } from 'lucide-react';
import { useShortcutsStore } from '@/store/useShortcutsStore';

interface EnhancedCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  total: number;
  onCompleteSale: (opts: {
    paymentMethod: string;
    amountReceived: number;
    changeReturned: number;
    isBillOnly?: boolean;
  }) => void;
  isProcessing: boolean;
}

function getQuickCashAmounts(total: number): number[] {
  const roundedTotal = parseFloat(total.toFixed(2));
  const result: number[] = [roundedTotal];
  const standardDenominations = [10, 20, 50, 100, 200, 500, 2000];

  for (const d of standardDenominations) {
    if (d > total && !result.includes(d) && result.length < 4) {
      result.push(d);
    }
  }

  // Fallback to next round hundreds if needed
  let next = Math.ceil(total / 100) * 100;
  if (next <= total) next += 100;
  while (result.length < 4) {
    if (!result.includes(next)) {
      result.push(next);
    }
    next += next >= 500 ? 500 : 100;
  }

  return result.slice(0, 4);
}

export default function EnhancedCashModal({
  isOpen,
  onClose,
  total,
  onCompleteSale,
  isProcessing,
}: EnhancedCashModalProps) {
  const [cashHandedOver, setCashHandedOver] = useState<string>('');
  const shortcutsStore = useShortcutsStore();
  const showShortcutBadges = shortcutsStore.config.showKeysOnButtons;

  const quickAmounts = useMemo(() => getQuickCashAmounts(total), [total]);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setCashHandedOver(total > 0 ? total.toFixed(2) : '');
    }
  }, [isOpen, total]);

  // Keyboard shortcuts handling
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      // Exact amount: Ctrl + Enter
      if (shortcutsStore.isActionTriggered('pay_exact', e)) {
        e.preventDefault();
        setCashHandedOver(total.toFixed(2));
        return;
      }

      // Bill only: F10
      if (shortcutsStore.isActionTriggered('bill_only', e)) {
        e.preventDefault();
        handleBillOnly();
        return;
      }

      // Enter to submit
      if (shortcutsStore.isActionTriggered('pay_complete', e) || e.key === 'Enter') {
        e.preventDefault();
        handleTakePayment();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, cashHandedOver, total, isProcessing, shortcutsStore]);

  if (!isOpen) return null;

  const enteredNum = parseFloat(cashHandedOver || '0');
  const changeToGiveBack = enteredNum >= total ? enteredNum - total : null;

  // Keypad actions
  const handleKeypadPress = (val: string) => {
    if (val === '.') {
      if (!cashHandedOver.includes('.')) {
        setCashHandedOver((prev) => (prev ? prev + '.' : '0.'));
      }
      return;
    }

    if (val === 'backspace') {
      setCashHandedOver((prev) => (prev.length > 1 ? prev.slice(0, -1) : ''));
      return;
    }

    // Number press
    setCashHandedOver((prev) => {
      if (prev === '0') return val;
      return prev + val;
    });
  };

  const handleTakePayment = () => {
    if (isProcessing) return;
    const finalReceived = cashHandedOver.trim() ? enteredNum : total;
    const change = Math.max(0, finalReceived - total);

    onCompleteSale({
      paymentMethod: 'Cash',
      amountReceived: finalReceived,
      changeReturned: change,
    });
  };

  const handleBillOnly = () => {
    if (isProcessing) return;
    onCompleteSale({
      paymentMethod: 'Bill Only',
      amountReceived: 0,
      changeReturned: 0,
      isBillOnly: true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-150">
      <div className="relative w-full max-w-[560px] rounded-3xl bg-zinc-900 p-6 sm:p-7 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200">
        {/* Header - Cash Payment only */}
        <div className="flex items-center justify-between mb-5 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              <Banknote className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white leading-tight">Cash Payment</h2>
              <p className="text-xs text-zinc-400">
                Amount Due: <span className="font-black font-mono text-sm ml-0.5" style={{ color: 'var(--theme-accent, #DB2777)' }}>₹{total.toFixed(2)}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Main Section: Left (Cash Handed Over & Quick Buttons & Change) | Right (Numeric Keypad) */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 mb-6">
          {/* Left Column (Span 6) */}
          <div className="sm:col-span-6 flex flex-col justify-between space-y-4">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                CASH HANDED OVER
              </label>

              {/* Handed Over Input Field */}
              <div className="relative">
                <input
                  type="text"
                  inputMode="decimal"
                  value={cashHandedOver}
                  onChange={(e) => setCashHandedOver(e.target.value)}
                  className="w-full rounded-2xl border-2 border-emerald-500/70 bg-zinc-950 px-3.5 py-2.5 text-2xl font-bold tracking-tight text-white outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-mono placeholder-zinc-600"
                  placeholder="0.00"
                  autoFocus
                />
              </div>

              {/* Quick Cash Amount Buttons */}
              <div className="grid grid-cols-4 gap-1.5 mt-3">
                {quickAmounts.map((amt) => {
                  const isMatch = parseFloat(cashHandedOver || '0') === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCashHandedOver(amt.toString())}
                      className={`rounded-xl border py-2 text-xs font-bold transition-all text-center cursor-pointer ${
                        isMatch
                          ? 'border-emerald-500/80 bg-emerald-950/60 text-emerald-300 shadow-sm font-black'
                          : 'border-zinc-800 bg-zinc-950 text-zinc-300 hover:bg-zinc-800 hover:text-white hover:border-zinc-700'
                      }`}
                    >
                      {amt % 1 === 0 ? amt : amt.toFixed(2)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Change to Give Back */}
            <div className="pt-2">
              <div className="flex items-center justify-between py-2.5 border-t border-zinc-800">
                <span className="text-sm font-semibold text-zinc-400">Change to give back</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  {changeToGiveBack !== null && changeToGiveBack > 0
                    ? `₹${changeToGiveBack.toFixed(2)}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: On-Screen Numeric Keypad (Span 6) */}
          <div className="sm:col-span-6">
            <div className="grid grid-cols-3 gap-2">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeypadPress(digit)}
                  className="h-12 sm:h-13 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 active:scale-95 text-xl font-bold text-white transition-all flex items-center justify-center select-none shadow-sm font-mono border border-zinc-700/60 cursor-pointer"
                >
                  {digit}
                </button>
              ))}

              {/* Backspace Key */}
              <button
                type="button"
                onClick={() => handleKeypadPress('backspace')}
                aria-label="Backspace"
                className="h-12 sm:h-13 rounded-2xl bg-zinc-800/80 hover:bg-zinc-700/80 active:scale-95 text-rose-400 transition-all flex items-center justify-center select-none shadow-sm border border-zinc-700/60 cursor-pointer"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
                  <line x1="18" y1="9" x2="12" y2="15" />
                  <line x1="12" y1="9" x2="18" y2="15" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Row Action Buttons */}
        <div className="flex gap-3 pt-2 border-t border-zinc-800">
          {/* Bill Only Button */}
          <button
            type="button"
            onClick={handleBillOnly}
            disabled={isProcessing}
            className="flex flex-col items-center justify-center rounded-2xl border border-zinc-700 bg-zinc-800 px-6 py-2.5 text-sm sm:text-base font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white active:scale-95 transition-all disabled:opacity-50 cursor-pointer shadow-sm whitespace-nowrap"
          >
            <span>Bill only</span>
            {showShortcutBadges && (
              <span className="text-[10px] text-zinc-400 font-mono mt-0.5">
                {shortcutsStore.getActionDisplayKey('bill_only') || 'F10'}
              </span>
            )}
          </button>

          {/* Take Cash Button */}
          <button
            type="button"
            onClick={handleTakePayment}
            disabled={isProcessing}
            className="flex-1 flex flex-col items-center justify-center rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-98 text-white py-2.5 px-6 text-sm sm:text-base font-black transition-all disabled:opacity-50 shadow-lg shadow-emerald-900/40 border border-emerald-400/30 cursor-pointer"
          >
            <span>{isProcessing ? 'Processing...' : `Take ₹${(enteredNum || total).toFixed(2)} cash`}</span>
            {showShortcutBadges && (
              <span className="text-[10px] bg-black/30 px-2 py-0.2 rounded font-mono text-emerald-200 mt-0.5">
                {shortcutsStore.getActionDisplayKey('pay_complete') || 'Enter ↵'}
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
