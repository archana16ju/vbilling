'use client';

import { useState, useEffect } from 'react';
import { Search, UserPlus, X, User, Phone, Check, Loader2 } from 'lucide-react';
import { Customer } from '@/lib/mysql-billing';

interface QuickCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (cust: Customer) => void;
  currentSelectedId?: string;
}

export default function QuickCustomerModal({
  isOpen,
  onClose,
  onSelectCustomer,
  currentSelectedId,
}: QuickCustomerModalProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isAddingNew, setIsAddingNew] = useState(false);

  // New customer form state
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCustomers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/customers?stats=false');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCustomers(data);
        }
      }
    } catch (err) {
      console.error('Failed to load customers for modal:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCustomers();
      setIsAddingNew(false);
      setSearch('');
      setFormError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filtered = customers.filter((c) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q)) ||
      (c.email && c.email.toLowerCase().includes(q))
    );
  });

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newName.trim()) {
      setFormError('Customer name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          phone: newPhone.trim(),
          email: newEmail.trim(),
          address: newAddress.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setFormError(data.error || 'Failed to create customer');
      } else {
        const createdCust = data.customer;
        onSelectCustomer(createdCust);
        onClose();
      }
    } catch (err: any) {
      setFormError(err.message || 'Error creating customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-white">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div 
              className="flex h-9 w-9 items-center justify-center rounded-xl border"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)'
              }}
            >
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                {isAddingNew ? 'Add New Customer' : 'Select Customer'}
              </h3>
              <p className="text-xs text-zinc-400">
                {isAddingNew
                  ? 'Quickly register customer and link to bill'
                  : 'Link a customer or guest to this order'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!isAddingNew ? (
          <div className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
              <input
                type="text"
                placeholder="Search name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 pl-9 pr-4 py-2.5 text-xs text-white placeholder:text-zinc-500 focus:border-theme focus:outline-none transition"
              />
            </div>

            <div className="flex items-center justify-between text-xs px-1 text-zinc-400 font-semibold">
              <span>{filtered.length} customers found</span>
              <button
                type="button"
                onClick={() => setIsAddingNew(true)}
                style={{ color: 'var(--theme-accent, #DB2777)' }}
                className="font-bold hover:opacity-80 flex items-center gap-1 cursor-pointer transition"
              >
                <UserPlus className="h-3.5 w-3.5" />
                + Add New Guest
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-1.5 no-scrollbar pr-0.5">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
                  <Loader2 className="h-6 w-6 animate-spin mb-2" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                  <span className="text-xs font-semibold">Loading customers...</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="py-8 text-center text-zinc-500">
                  <p className="text-sm font-semibold">No customers found</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNew(true);
                      setNewName(search);
                    }}
                    style={{ color: 'var(--theme-accent, #DB2777)' }}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-bold hover:opacity-80 underline cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Create &quot;{search}&quot;
                  </button>
                </div>
              ) : (
                filtered.map((c) => {
                  const isSelected = c.id === currentSelectedId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        onSelectCustomer(c);
                        onClose();
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition ${
                        isSelected
                          ? 'border-theme bg-theme-bar text-white shadow-md'
                          : 'border-zinc-800 bg-zinc-950/70 hover:border-theme hover:bg-zinc-800/60 text-white'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-bold text-xs"
                          style={
                            isSelected 
                              ? { backgroundColor: 'var(--theme-accent, #DB2777)', color: '#fff' }
                              : { backgroundColor: '#27272a', borderColor: '#3f3f46', color: 'var(--theme-accent, #DB2777)' }
                          }
                        >
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                            {c.name}
                          </p>
                          <p className={`text-[11px] truncate ${isSelected ? 'text-white/80' : 'text-zinc-400'}`}>
                            {c.phone || c.email || 'No contact info'}
                          </p>
                        </div>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-white shrink-0 font-bold" />}
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleCreateCustomer} className="mt-4 space-y-3">
            {formError && (
              <div className="rounded-xl bg-rose-950/60 p-2.5 text-xs text-rose-300 border border-rose-800/80 font-medium">
                {formError}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Guest Name <span className="text-rose-400">*</span>
              </label>
              <input
                required
                type="text"
                placeholder="e.g. Karthik Raja"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-theme focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Phone Number
              </label>
              <div className="flex gap-2">
                <span className="inline-flex items-center px-3 rounded-xl border border-zinc-700 bg-zinc-800 text-xs font-bold text-zinc-300">
                  +91
                </span>
                <input
                  type="text"
                  placeholder="98400 12345"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-theme focus:outline-none transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Email (optional)
              </label>
              <input
                type="email"
                placeholder="name@example.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-theme focus:outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                Delivery Address (optional)
              </label>
              <textarea
                rows={2}
                placeholder="14, 2nd Cross St, Landmark..."
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-theme focus:outline-none transition resize-none"
              />
            </div>

            <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsAddingNew(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Back to List
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-theme-bar hover:opacity-95 text-white shadow-lg shadow-theme-glow border border-theme px-5 py-2 text-xs font-bold transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Add & Link Guest
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
