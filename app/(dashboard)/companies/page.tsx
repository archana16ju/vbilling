'use client';

import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  Users,
  Edit2,
  CheckCircle,
  XCircle,
  Check,
  RefreshCw,
  AlertCircle,
  Trash2,
  UserPlus,
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  currency: string;
  isActive: boolean;
  userCount?: number;
}

interface UserAssignment {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userRole?: string;
  role: string;
}

interface AvailableUser {
  id: string;
  username: string;
  role: string;
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Modals
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [selectedCompanyForUsers, setSelectedCompanyForUsers] = useState<Company | null>(null);
  const [companyAssignments, setCompanyAssignments] = useState<UserAssignment[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [selectedUserIdToAssign, setSelectedUserIdToAssign] = useState('');

  // Cashier creation state per company
  const [cashierUsername, setCashierUsername] = useState('');
  const [cashierPassword, setCashierPassword] = useState('');
  const [isCreatingCashier, setIsCreatingCashier] = useState(false);
  const [cashierModalMsg, setCashierModalMsg] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  // Load companies & active company
  const fetchCompanies = async () => {
    setIsLoading(true);
    setError('');
    try {
      const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
      const r = match ? match[2] : null;
      let normalizedRole = r === 'admin' ? 'company_admin' : r;
      if (normalizedRole) setCurrentUserRole(normalizedRole);

      if (!normalizedRole) {
        try {
          const meRes = await fetch('/api/auth/me');
          if (meRes.ok) {
            const me = await meRes.json();
            if (me && me.role) {
              normalizedRole = me.role === 'admin' ? 'company_admin' : me.role;
              setCurrentUserRole(normalizedRole);
            }
          }
        } catch {}
      }

      // Cashiers have no access to companies
      if (normalizedRole === 'cashier') {
        setIsLoading(false);
        return;
      }

      const [compRes, activeRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/companies/active'),
      ]);

      const compData = await compRes.json();
      const activeData = await activeRes.json();

      if (!compRes.ok) {
        throw new Error(compData.error || 'Failed to fetch companies');
      }

      setCompanies(Array.isArray(compData) ? compData : []);
      if (activeData.activeCompany) {
        setActiveCompanyId(activeData.activeCompany.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading companies');
    } finally {
      setIsLoading(false);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchCompanies();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const isSuperAdmin = currentUserRole === 'super_admin';

  const handleSwitchCompany = async (companyId: string) => {
    try {
      // Set client cookie directly to ensure immediate consistency
      document.cookie = `auth_company_id=${companyId}; path=/; max-age=604800; SameSite=Lax`;

      const res = await fetch('/api/companies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to switch company');
      setActiveCompanyId(companyId);
      setSuccessMsg(`Switched active company to ${data.company?.name || companyId}`);

      // Dispatch custom events for real-time header and theme updates
      window.dispatchEvent(new CustomEvent('company-switched', { detail: { company: data.company } }));
      window.dispatchEvent(new CustomEvent('company-theme-changed', { detail: { companyId } }));

      try {
        localStorage.removeItem('tables-storage');
        const termData = localStorage.getItem('terminal-storage');
        if (termData) {
          const parsed = JSON.parse(termData);
          if (parsed?.state) {
            parsed.state.cart = [];
            parsed.state.selectedCustomer = null;
            parsed.state.orderNote = '';
            parsed.state.activeCompanyId = companyId;
            localStorage.setItem('terminal-storage', JSON.stringify(parsed));
          }
        }
      } catch {}

      setTimeout(() => {
        window.location.reload();
      }, 150);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOpenCompanyModal = (company?: Company) => {
    if (!isSuperAdmin) return;
    if (company) {
      setEditingCompany(company);
    } else {
      setEditingCompany(null);
    }
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isSuperAdmin) return;
    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name') as string,
      code: formData.get('code') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      gstin: formData.get('gstin') as string,
      currency: (formData.get('currency') as string) || 'INR',
    };

    try {
      let res;
      if (editingCompany) {
        res = await fetch('/api/companies', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingCompany.id, ...payload }),
        });
      } else {
        res = await fetch('/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save company');

      setIsCompanyModalOpen(false);
      setSuccessMsg(editingCompany ? 'Company updated successfully!' : 'Company created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchCompanies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Manage assignments & cashiers modal
  const handleOpenUsersModal = async (company: Company) => {
    setSelectedCompanyForUsers(company);
    setIsUsersModalOpen(true);
    setCashierUsername('');
    setCashierPassword('');
    setCashierModalMsg(null);
    setSelectedUserIdToAssign('');
    try {
      const fetches: Promise<any>[] = [fetch(`/api/companies/assignments?companyId=${company.id}`)];
      if (isSuperAdmin) {
        fetches.push(fetch('/api/users'));
      }

      const [assignRes, usersRes] = await Promise.all(fetches);
      const assignData = await assignRes.json();
      setCompanyAssignments(Array.isArray(assignData) ? assignData : []);

      if (usersRes) {
        const usersData = await usersRes.json();
        setAvailableUsers(Array.isArray(usersData) ? usersData : []);
      }
    } catch (err: any) {
      setError('Failed to load user assignments');
    }
  };

  const handleCreateCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForUsers) return;
    if (!cashierUsername.trim() || !cashierPassword.trim()) {
      setCashierModalMsg({ type: 'error', text: 'Username and password are required.' });
      return;
    }

    setIsCreatingCashier(true);
    setCashierModalMsg(null);
    try {
      const res = await fetch('/api/companies/cashiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyId: selectedCompanyForUsers.id,
          username: cashierUsername.trim(),
          password: cashierPassword.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create cashier');

      setCashierModalMsg({
        type: 'success',
        text: `Cashier account "${data.cashier?.username || cashierUsername}" created successfully for ${selectedCompanyForUsers.name}!`,
      });
      setCashierUsername('');
      setCashierPassword('');

      // Refresh assignments
      const assignRes = await fetch(`/api/companies/assignments?companyId=${selectedCompanyForUsers.id}`);
      const freshAssignments = await assignRes.json();
      setCompanyAssignments(Array.isArray(freshAssignments) ? freshAssignments : []);
      fetchCompanies();
    } catch (err: any) {
      setCashierModalMsg({ type: 'error', text: err.message || 'Failed to create cashier' });
    } finally {
      setIsCreatingCashier(false);
    }
  };

  const handleAssignUser = async () => {
    if (!isSuperAdmin || !selectedCompanyForUsers || !selectedUserIdToAssign) return;
    try {
      const res = await fetch('/api/companies/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedUserIdToAssign,
          companyId: selectedCompanyForUsers.id,
          role: 'company_admin',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign user');

      const assignRes = await fetch(`/api/companies/assignments?companyId=${selectedCompanyForUsers.id}`);
      const freshAssignments = await assignRes.json();
      setCompanyAssignments(Array.isArray(freshAssignments) ? freshAssignments : []);
      setSelectedUserIdToAssign('');
      fetchCompanies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRemoveAssignment = async (userId: string) => {
    if (!selectedCompanyForUsers) return;
    try {
      const res = await fetch(
        `/api/companies/assignments?userId=${userId}&companyId=${selectedCompanyForUsers.id}`,
        { method: 'DELETE' }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove user');
      }

      const assignRes = await fetch(`/api/companies/assignments?companyId=${selectedCompanyForUsers.id}`);
      const freshAssignments = await assignRes.json();
      setCompanyAssignments(Array.isArray(freshAssignments) ? freshAssignments : []);
      fetchCompanies();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCompany = async (id: string, name: string) => {
    if (!isSuperAdmin) return;
    if (confirm(`Are you sure you want to delete "${name}"? This will permanently delete the company and its associated records.`)) {
      try {
        const res = await fetch(`/api/companies?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete company');
        setSuccessMsg(`Company "${name}" deleted successfully.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchCompanies();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  if (currentUserRole === 'cashier') {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-900 rounded-2xl border border-zinc-800 text-center space-y-4 shadow-xl">
        <AlertCircle className="h-12 w-12 text-rose-500" />
        <h2 className="text-xl font-bold text-white">Access Denied</h2>
        <p className="text-sm text-zinc-400 max-w-md">
          Cashier accounts are restricted to the POS terminal.
        </p>
        <button
          onClick={() => { window.location.href = '/terminal'; }}
          className="rounded-xl btn-theme-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
        >
          Return to Terminal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header with Dynamic Theme Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Building2 className="h-7 w-7 text-pink-300" />
              {isSuperAdmin ? 'Company Management' : 'My Assigned Companies'}
            </h1>
            <p className="text-xs text-pink-100/70 mt-1">
              {isSuperAdmin
                ? 'Create, isolate, and assign users to independent billing companies on Local MySQL.'
                : 'Select your assigned company to create and manage cashier accounts.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-black/30 hover:bg-black/50 border border-white/20 text-white px-3.5 py-2.5 text-xs font-bold shadow-lg active:scale-95 transition cursor-pointer disabled:opacity-50"
              title="Refresh companies"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-pink-300" : "text-zinc-200"}`} />
              Refresh
            </button>
            {isSuperAdmin && (
              <button
                onClick={() => handleOpenCompanyModal()}
                style={{ color: '#0f172a' }}
                className="inline-flex items-center gap-2 rounded-xl bg-white text-zinc-950 px-4 py-2.5 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-pink-100 active:scale-95 transition cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                Create Company
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-950/40 p-4 border border-rose-500/30 text-xs font-semibold text-rose-300 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-950/40 p-4 border border-emerald-500/30 text-xs font-semibold text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Companies List */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-zinc-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-pink-400" />
            <span>Loading local companies...</span>
          </div>
        ) : companies.length === 0 ? (
          <div className="p-12 text-center text-zinc-500">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
            <p className="text-base font-bold text-zinc-300">No assigned companies found</p>
            <p className="text-xs text-zinc-500 mt-1">
              {isSuperAdmin
                ? 'Click "Create Company" to create your first company.'
                : 'Please contact the Super Admin to assign a company to your account.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-300">
              <thead className="bg-zinc-950/80 text-xs font-bold uppercase text-zinc-400 border-b border-zinc-800">
                <tr>
                  <th className="px-6 py-4">Company Name</th>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Contact</th>
                  <th className="px-6 py-4">Currency</th>
                  <th className="px-6 py-4 text-center">{isSuperAdmin ? 'Assigned Users' : 'Cashiers'}</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {companies.map((c) => {
                  const isActive = c.id === activeCompanyId;
                  return (
                    <tr key={c.id} className={isActive ? 'bg-pink-950/20' : 'hover:bg-zinc-800/40'}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-bold text-white">
                          <span>{c.name}</span>
                          {isActive && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
                              <Check className="h-3 w-3 stroke-[3]" />
                              Active Context
                            </span>
                          )}
                        </div>
                        {c.address && <div className="text-xs text-zinc-400 mt-0.5 truncate max-w-xs">{c.address}</div>}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs font-bold">
                        <span className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-pink-300">{c.code}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400">
                        <div>{c.phone || 'No phone'}</div>
                        <div className="text-zinc-500">{c.email || ''}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-zinc-200">{c.currency}</td>
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => handleOpenUsersModal(c)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-950/60 hover:bg-blue-900/60 border border-blue-500/40 px-3 py-1.5 text-xs font-bold text-blue-300 transition shadow-sm cursor-pointer"
                          title="Manage cashiers for this company"
                        >
                          <Users className="h-3.5 w-3.5 text-blue-400" />
                          <span>{isSuperAdmin ? `${c.userCount ?? 0} users` : 'Manage Cashiers'}</span>
                        </button>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {c.isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-500">
                            <XCircle className="h-3.5 w-3.5" />
                            Disabled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isActive && (
                            <button
                              onClick={() => handleSwitchCompany(c.id)}
                              className="rounded-xl btn-theme-primary px-3 py-1.5 text-xs font-bold text-white shadow-md transition cursor-pointer"
                              title="Switch to this company context"
                            >
                              Switch Context
                            </button>
                          )}
                          {isSuperAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenCompanyModal(c)}
                                className="rounded-xl p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                                title="Edit Company"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCompany(c.id, c.name)}
                                className="rounded-xl p-1.5 text-zinc-500 hover:bg-rose-950/50 hover:text-rose-400 transition cursor-pointer"
                                title="Delete Company"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Company Modal (Super Admin Only) */}
      {isCompanyModalOpen && isSuperAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold text-white mb-4">
              {editingCompany ? 'Edit Company' : 'Create New Company'}
            </h2>
            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Company Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingCompany?.name || ''}
                    placeholder="e.g. Apex Hypermarket"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Company Code *</label>
                  <input
                    type="text"
                    name="code"
                    required
                    defaultValue={editingCompany?.code || ''}
                    placeholder="e.g. APEX"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono font-bold uppercase text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Address</label>
                <textarea
                  name="address"
                  rows={2}
                  defaultValue={editingCompany?.address || ''}
                  placeholder="Store location / branch address"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingCompany?.phone || ''}
                    placeholder="Phone number"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingCompany?.email || ''}
                    placeholder="billing@company.com"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">GSTIN / Tax ID</label>
                  <input
                    type="text"
                    name="gstin"
                    defaultValue={editingCompany?.gstin || ''}
                    placeholder="GSTIN"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue={editingCompany?.currency || 'INR'}
                    placeholder="INR"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-medium text-white placeholder:text-zinc-500 focus:border-pink-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer"
                >
                  {editingCompany ? 'Save Changes' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage User Assignments & Cashiers Modal */}
      {isUsersModalOpen && selectedCompanyForUsers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-4 border-b pb-3 border-zinc-800 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-pink-400" />
                  {selectedCompanyForUsers.name} ({selectedCompanyForUsers.code}) - {isSuperAdmin ? 'Users & Cashiers' : 'Cashier Management'}
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {isSuperAdmin
                    ? 'Create cashiers specifically for this company or assign administrators.'
                    : 'Create and manage cashier login accounts for this company.'}
                </p>
              </div>
              <button
                onClick={() => setIsUsersModalOpen(false)}
                className="text-zinc-400 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto pr-1 flex-1 space-y-4 no-scrollbar">
              {/* Create Cashier Account Section */}
              <div className="rounded-2xl border border-pink-500/30 bg-pink-950/20 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-pink-300 flex items-center gap-1.5">
                    <UserPlus className="h-4 w-4 text-pink-400" />
                    Create Cashier Account
                  </span>
                  <span className="inline-flex items-center rounded-full bg-pink-950/60 border border-pink-500/40 px-2.5 py-0.5 text-[11px] font-bold text-pink-300">
                    Role: Cashier
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 mb-3">
                  Cashiers created here are automatically assigned to <strong>{selectedCompanyForUsers.name}</strong> and saved in the Users collection with role &quot;cashier&quot;, company ID, and company name.
                </p>

                {cashierModalMsg && (
                  <div
                    className={`mb-3 p-2.5 rounded-xl text-xs border ${cashierModalMsg.type === 'success'
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                        : 'bg-rose-950/60 text-rose-300 border-rose-500/40'
                      }`}
                  >
                    {cashierModalMsg.text}
                  </div>
                )}

                <form onSubmit={handleCreateCashier} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">Username</label>
                    <input
                      type="text"
                      required
                      value={cashierUsername}
                      onChange={(e) => setCashierUsername(e.target.value)}
                      placeholder="e.g. cashier_chennai"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-zinc-300 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={cashierPassword}
                      onChange={(e) => setCashierPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-pink-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <button
                      type="submit"
                      disabled={isCreatingCashier}
                      className="w-full rounded-xl btn-theme-primary disabled:opacity-50 px-3 py-2 text-xs font-bold text-white transition shadow-md cursor-pointer"
                    >
                      {isCreatingCashier ? 'Creating...' : '+ Add Cashier'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Assign Existing Admin User (Super Admin Only) */}
              {isSuperAdmin && (
                <details className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                  <summary className="font-bold text-pink-300 cursor-pointer hover:text-pink-200 select-none px-1">
                    + Assign Existing Admin to this Company
                  </summary>
                  <div className="pt-3 pb-1 px-1 flex flex-col sm:flex-row gap-2 items-center">
                    <div className="flex-1 w-full">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1">Select Admin User</label>
                      <select
                        value={selectedUserIdToAssign}
                        onChange={(e) => setSelectedUserIdToAssign(e.target.value)}
                        className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white focus:outline-none focus:border-pink-500"
                      >
                        <option value="">-- Choose Admin User --</option>
                        {availableUsers
                          .filter((u) => u.role === 'admin' || u.role === 'company_admin')
                          .map((u) => (
                            <option key={u.id} value={u.id} className="bg-zinc-900 text-white">
                              {u.username} (Company Admin)
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="w-full sm:w-auto pt-2 sm:pt-4">
                      <button
                        onClick={handleAssignUser}
                        disabled={!selectedUserIdToAssign}
                        className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition cursor-pointer"
                      >
                        Assign Admin
                      </button>
                    </div>
                  </div>
                </details>
              )}

              {/* Current Company Users / Cashiers Table */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                  {isSuperAdmin ? 'Company Users & Cashiers' : 'Company Cashiers'} ({companyAssignments.length})
                </h3>
                <div className="max-h-52 overflow-y-auto rounded-2xl border border-zinc-800 bg-zinc-950/40">
                  {!Array.isArray(companyAssignments) || companyAssignments.length === 0 ? (
                    <div className="p-6 text-center text-xs text-zinc-500">
                      {isSuperAdmin
                        ? 'No users or cashiers currently assigned to this company.'
                        : 'No cashiers created for this company yet. Use the form above to add one.'}
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs text-zinc-300">
                      <thead className="bg-zinc-900 text-zinc-400 font-bold uppercase">
                        <tr>
                          <th className="px-4 py-2.5">User</th>
                          <th className="px-4 py-2.5">Role</th>
                          <th className="px-4 py-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {companyAssignments.map((a) => (
                          <tr key={a.id} className="hover:bg-zinc-800/40">
                            <td className="px-4 py-2.5 font-bold text-white">
                              {a.userName}
                              {a.userEmail && <span className="text-zinc-500 block text-[10px]">{a.userEmail}</span>}
                            </td>
                            <td className="px-4 py-2.5">
                              {a.role === 'cashier' ? (
                                <span className="inline-flex items-center rounded-full bg-blue-950/60 border border-blue-500/40 px-2 py-0.5 text-[11px] font-bold text-blue-300">
                                  Cashier
                                </span>
                              ) : (
                                <span className="inline-flex items-center rounded-full bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 text-[11px] font-bold text-purple-300">
                                  Company Admin
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-right">
                              {(isSuperAdmin || a.role === 'cashier') && (
                                <button
                                  onClick={() => handleRemoveAssignment(a.userId)}
                                  className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer transition-colors"
                                  title="Delete cashier"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-800 flex justify-end shrink-0">
              <button
                onClick={() => setIsUsersModalOpen(false)}
                className="rounded-xl bg-zinc-800 border border-zinc-700 px-4 py-2 text-xs font-bold text-white hover:bg-zinc-700 transition cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
