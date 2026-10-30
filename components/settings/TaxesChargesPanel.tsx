'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit2, Trash2, Check, Percent, IndianRupee, Plus, Sliders, Info } from 'lucide-react';
import { TaxItem, ChargeItem, DEFAULT_TAXES, DEFAULT_CHARGES } from '@/types/taxes-charges';

export default function TaxesChargesPanel() {
  const [taxes, setTaxes] = useState<TaxItem[]>(DEFAULT_TAXES);
  const [charges, setCharges] = useState<ChargeItem[]>(DEFAULT_CHARGES);
  const [isLoading, setIsLoading] = useState(true);

  // Modal states
  const [isTaxModalOpen, setIsTaxModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxItem | null>(null);
  const [taxName, setTaxName] = useState('');
  const [taxRate, setTaxRate] = useState('');

  const [isChargeModalOpen, setIsChargeModalOpen] = useState(false);
  const [editingCharge, setEditingCharge] = useState<ChargeItem | null>(null);
  const [chargeName, setChargeName] = useState('');
  const [chargeType, setChargeType] = useState<'percentage' | 'fixed'>('percentage');
  const [chargeValue, setChargeValue] = useState('');
  const [chargeAppliesTo, setChargeAppliesTo] = useState<string[]>(['Dine In']);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/settings/taxes-charges');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.taxes)) setTaxes(data.taxes);
        if (Array.isArray(data.charges)) setCharges(data.charges);
      }
    } catch (e) {
      console.warn('Failed to fetch taxes/charges:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // --- TAX HANDLERS ---
  const handleToggleTax = async (id: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setTaxes(prev => prev.map(t => t.id === id ? { ...t, isActive: nextActive } : t));
    try {
      await fetch('/api/settings/taxes-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_tax', id, isActive: nextActive }),
      });
    } catch (err) {
      console.error('Failed to toggle tax:', err);
    }
  };

  const handleOpenAddTax = () => {
    setEditingTax(null);
    setTaxName('');
    setTaxRate('');
    setIsTaxModalOpen(true);
  };

  const handleOpenEditTax = (tax: TaxItem) => {
    setEditingTax(tax);
    setTaxName(tax.name);
    setTaxRate(tax.rate.toString());
    setIsTaxModalOpen(true);
  };

  const handleSaveTax = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taxName.trim() || !taxRate.trim()) return;

    const rateNum = parseFloat(taxRate) || 0;
    const payload = {
      id: editingTax?.id,
      name: taxName.trim(),
      rate: rateNum,
      appliesTo: 'Every bill',
      isActive: editingTax ? editingTax.isActive : true,
    };

    try {
      const res = await fetch('/api/settings/taxes-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_tax', tax: payload }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tax) {
          if (editingTax) {
            setTaxes(prev => prev.map(t => t.id === data.tax.id ? data.tax : t));
          } else {
            setTaxes(prev => [...prev, data.tax]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save tax:', err);
    } finally {
      setIsTaxModalOpen(false);
    }
  };

  const handleDeleteTax = async (id: string) => {
    if (!confirm('Are you sure you want to remove this tax?')) return;
    setTaxes(prev => prev.filter(t => t.id !== id));
    try {
      await fetch('/api/settings/taxes-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_tax', id }),
      });
    } catch (err) {
      console.error('Failed to delete tax:', err);
    }
  };

  // --- CHARGE HANDLERS ---
  const handleToggleCharge = async (id: string, currentActive: boolean) => {
    const nextActive = !currentActive;
    setCharges(prev => prev.map(c => c.id === id ? { ...c, isActive: nextActive } : c));
    try {
      await fetch('/api/settings/taxes-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_charge', id, isActive: nextActive }),
      });
    } catch (err) {
      console.error('Failed to toggle charge:', err);
    }
  };

  const handleOpenAddCharge = () => {
    setEditingCharge(null);
    setChargeName('');
    setChargeType('percentage');
    setChargeValue('');
    setChargeAppliesTo(['Dine In']);
    setIsChargeModalOpen(true);
  };

  const handleOpenEditCharge = (charge: ChargeItem) => {
    setEditingCharge(charge);
    setChargeName(charge.name);
    setChargeType(charge.type);
    setChargeValue(charge.value.toString());
    setChargeAppliesTo(charge.appliesTo || ['Dine In']);
    setIsChargeModalOpen(true);
  };

  const handleToggleAppliesTo = (orderType: string) => {
    setChargeAppliesTo(prev => {
      if (prev.includes(orderType)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter(t => t !== orderType);
      } else {
        return [...prev, orderType];
      }
    });
  };

  const handleSaveCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chargeName.trim() || !chargeValue.trim()) return;

    const valNum = parseFloat(chargeValue) || 0;
    const payload = {
      id: editingCharge?.id,
      name: chargeName.trim(),
      type: chargeType,
      value: valNum,
      appliesTo: chargeAppliesTo.length > 0 ? chargeAppliesTo : ['Dine In'],
      isActive: editingCharge ? editingCharge.isActive : true,
    };

    try {
      const res = await fetch('/api/settings/taxes-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_charge', charge: payload }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.charge) {
          if (editingCharge) {
            setCharges(prev => prev.map(c => c.id === data.charge.id ? data.charge : c));
          } else {
            setCharges(prev => [...prev, data.charge]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to save charge:', err);
    } finally {
      setIsChargeModalOpen(false);
    }
  };

  const handleDeleteCharge = async (id: string) => {
    if (!confirm('Are you sure you want to remove this charge?')) return;
    setCharges(prev => prev.filter(c => c.id !== id));
    try {
      await fetch('/api/settings/taxes-charges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_charge', id }),
      });
    } catch (err) {
      console.error('Failed to delete charge:', err);
    }
  };

  return (
    <div className="space-y-6 text-white">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-theme-badge border border-theme text-theme-accent shadow-xs">
            <Percent className="h-5 w-5" />
          </div>
          <span>Taxes & Charges</span>
        </h1>
        <p className="text-xs text-zinc-400 mt-1 pl-11.5">
          Taxes sit on items (each item says which apply). Charges are added to the bill for the order types you pick.
        </p>
      </div>

      {/* Taxes Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Taxes</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">Item-level GST and tax rates calculated on bill items</p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddTax}
            className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white preserve-white shadow-md shadow-theme-glow hover:opacity-95 active:scale-95 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Tax</span>
          </button>
        </div>

        {/* Notice Pill Container */}
        <div className="rounded-xl bg-zinc-950/70 border border-zinc-800/90 px-4 py-3 text-xs text-zinc-300 flex items-start gap-2.5 mb-3">
          <span
            className="h-2 w-2 rounded-full mt-1 shrink-0"
            style={{
              backgroundColor: 'var(--theme-accent, #DB2777)',
              boxShadow: '0 0 8px var(--theme-accent, #DB2777)'
            }}
          />
          <span>This restaurant taxes the whole bill: every active tax here goes on every bill, whatever the items say.</span>
        </div>

        {/* Tax List */}
        <div className="divide-y divide-zinc-800/60">
          {taxes.map((tax) => (
            <div
              key={tax.id}
              className="group flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-zinc-800/40 transition cursor-pointer"
              onClick={() => handleOpenEditTax(tax)}
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-white">
                    {tax.name}
                  </span>
                  <span className="rounded-md bg-zinc-800/90 border border-zinc-700/80 px-2 py-0.5 text-xs font-mono font-bold text-theme-badge">
                    {tax.rate}%
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {tax.appliesTo || 'Every bill'}
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleOpenEditTax(tax)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Edit Tax"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteTax(tax.id)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  title="Delete Tax"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Theme-Adaptive Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={tax.isActive}
                  onClick={() => handleToggleTax(tax.id, tax.isActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none ${
                    tax.isActive
                      ? 'bg-theme-bar shadow-md shadow-theme-glow'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                  title={tax.isActive ? `Disable ${tax.name}` : `Enable ${tax.name}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      tax.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charges Card */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800/80">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Charges</span>
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Service charge, packaging, delivery fee, and bill surcharges
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenAddCharge}
            className="inline-flex items-center gap-1.5 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white preserve-white shadow-md shadow-theme-glow hover:opacity-95 active:scale-95 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Charge</span>
          </button>
        </div>

        {/* Charge List */}
        <div className="divide-y divide-zinc-800/60">
          {charges.map((charge) => (
            <div
              key={charge.id}
              className="group flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-zinc-800/40 transition cursor-pointer"
              onClick={() => handleOpenEditCharge(charge)}
            >
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-bold text-sm text-white">
                    {charge.name}
                  </span>
                  <span className="rounded-md bg-zinc-800/90 border border-zinc-700/80 px-2 py-0.5 text-xs font-mono font-bold text-theme-badge">
                    {charge.type === 'percentage' ? `${charge.value}%` : `₹${charge.value.toFixed(2)}`}
                  </span>
                </div>
                <div className="text-xs text-zinc-400 mt-0.5">
                  {Array.isArray(charge.appliesTo) ? charge.appliesTo.join(', ') : charge.appliesTo || 'Dine In'}
                </div>
              </div>

              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => handleOpenEditCharge(charge)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition cursor-pointer"
                  title="Edit Charge"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteCharge(charge.id)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition cursor-pointer"
                  title="Delete Charge"
                >
                  <Trash2 className="h-4 w-4" />
                </button>

                {/* Theme-Adaptive Toggle Switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={charge.isActive}
                  onClick={() => handleToggleCharge(charge.id, charge.isActive)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-all duration-200 ease-in-out focus:outline-none ${
                    charge.isActive
                      ? 'bg-theme-bar shadow-md shadow-theme-glow'
                      : 'bg-zinc-700 hover:bg-zinc-600'
                  }`}
                  title={charge.isActive ? `Disable ${charge.name}` : `Enable ${charge.name}`}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                      charge.isActive ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- ADD / EDIT TAX MODAL --- */}
      {isTaxModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setIsTaxModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 relative text-white animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Percent className="h-4 w-4 text-theme-accent" />
                <span>{editingTax ? 'Edit Tax' : 'Add Tax'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTax} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {/* NAME */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Tax Name
                  </label>
                  <input
                    type="text"
                    required
                    autoFocus
                    placeholder="e.g. CGST, SGST"
                    value={taxName}
                    onChange={(e) => setTaxName(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-theme focus:ring-1 focus:ring-theme"
                  />
                </div>

                {/* PERCENT */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Rate (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="2.5"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white text-right outline-none transition focus:border-theme focus:ring-1 focus:ring-theme"
                  />
                </div>
              </div>

              {/* Helper Note */}
              <p className="text-xs text-zinc-400 leading-normal pt-1">
                New items get every active tax by default; you can adjust applied taxes per product in the Products catalog.
              </p>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsTaxModalOpen(false)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl btn-theme-primary px-4 py-2.5 text-xs font-bold text-white preserve-white shadow-md shadow-theme-glow hover:opacity-95 active:scale-95 transition cursor-pointer"
                >
                  Save Tax
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- ADD / EDIT CHARGE MODAL --- */}
      {isChargeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setIsChargeModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 relative text-white animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-800">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <IndianRupee className="h-4 w-4 text-theme-accent" />
                <span>{editingCharge ? 'Edit Charge' : 'Add Charge'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsChargeModalOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-700 transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveCharge} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Charge Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Service charge, Packing fee, Delivery surcharge"
                  value={chargeName}
                  onChange={(e) => setChargeName(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-theme focus:ring-1 focus:ring-theme"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* TYPE */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    Calculation Type
                  </label>
                  <div className="flex rounded-xl border border-zinc-700 p-1 bg-zinc-950">
                    <button
                      type="button"
                      onClick={() => setChargeType('percentage')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        chargeType === 'percentage'
                          ? 'bg-theme-bar border border-theme text-white preserve-white shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      % Percent
                    </button>
                    <button
                      type="button"
                      onClick={() => setChargeType('fixed')}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition cursor-pointer ${
                        chargeType === 'fixed'
                          ? 'bg-theme-bar border border-theme text-white preserve-white shadow-xs'
                          : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                      }`}
                    >
                      ₹ Fixed
                    </button>
                  </div>
                </div>

                {/* VALUE */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                    {chargeType === 'percentage' ? 'Rate (%)' : 'Amount (₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder={chargeType === 'percentage' ? '5.0' : '10.00'}
                    value={chargeValue}
                    onChange={(e) => setChargeValue(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white text-right outline-none transition focus:border-theme focus:ring-1 focus:ring-theme"
                  />
                </div>
              </div>

              {/* APPLIES TO ORDER TYPES */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Applies to Order Types
                </label>
                <div className="flex items-center gap-2">
                  {['Dine In', 'Takeaway', 'Delivery'].map((type) => {
                    const isSelected = chargeAppliesTo.includes(type);
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleToggleAppliesTo(type)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-theme-bar border border-theme text-white preserve-white shadow-xs'
                            : 'border-zinc-700 bg-zinc-950 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-800'
                        }`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Charge will only be added to selected order types at billing time.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsChargeModalOpen(false)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-xs font-bold text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-700 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl btn-theme-primary px-4 py-2.5 text-xs font-bold text-white preserve-white shadow-md shadow-theme-glow hover:opacity-95 active:scale-95 transition cursor-pointer"
                >
                  Save Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
