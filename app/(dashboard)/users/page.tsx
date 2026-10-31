'use client';

import { useState, useEffect } from 'react';
import type { User } from '@/lib/users';
import {
  UserPlus,
  Trash2,
  Shield,
  User as UserIcon,
  Edit2,
  Building2,
  AlertCircle,
  CheckCircle,
  KeyRound,
  UtensilsCrossed,
  Utensils,
  CreditCard,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';

interface CompanyOption {
  id: string;
  name: string;
  code: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [currentCompanyName, setCurrentCompanyName] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<Omit<User, 'password'> | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetUser, setResetUser] = useState<Omit<User, 'password'> | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('cashier');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users');
      const data = await res.json();
      if (Array.isArray(data)) {
        setUsers(data);
      } else {
        setError(data.error || 'Failed to load users: Invalid data received.');
      }
    } catch (err: any) {
      console.error('FETCH USERS ERROR:', err.message || err);
      setError(`Failed to load users: ${err.message || 'API Error'}`);
    }
  };

  const fetchCompanies = async () => {
    try {
      const res = await fetch('/api/companies');
      const data = await res.json();
      if (Array.isArray(data)) {
        setCompanies(data);
        if (data.length > 0) {
          setSelectedCompanyId((prev) => prev || data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load companies for dropdown:', err);
    }
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchUsers(), fetchCompanies()]);
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  };

  useEffect(() => {
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    const initialRole = r === 'admin' ? 'company_admin' : r;
    if (initialRole) setCurrentRole(initialRole);

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((me) => {
        if (me && me.authenticated) {
          const normRole = me.role === 'admin' ? 'company_admin' : me.role;
          setCurrentRole(normRole);
          setCurrentUserId(me.userId);
          setCurrentCompanyId(me.companyId || null);
          setCurrentCompanyName(me.companyName || null);
          if (normRole === 'company_admin' && me.companyId) {
            setSelectedCompanyId(me.companyId);
          }
        }
      })
      .catch(() => {});

    fetchUsers();
    fetchCompanies();
  }, []);

  const isSuperAdmin = currentRole === 'super_admin';
  const isCompanyAdmin = currentRole === 'company_admin';

  const handleOpenForm = (user?: Omit<User, 'password'>) => {
    setError('');
    setSuccessMsg('');
    if (user) {
      setEditingUser(user);
      setSelectedRole(user.role);
      setSelectedCompanyId(user.companyId || (companies[0]?.id || ''));
    } else {
      setEditingUser(null);
      if (isSuperAdmin) {
        setSelectedRole('company_admin');
        setSelectedCompanyId(companies[0]?.id || '');
      } else {
        setSelectedRole('cashier');
        setSelectedCompanyId(currentCompanyId || '');
      }
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  const handleOpenResetPassword = (user: Omit<User, 'password'>) => {
    setError('');
    setSuccessMsg('');
    setResetUser(user);
    setNewPassword('');
    setIsResetPasswordOpen(true);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.trim() === '') {
      setError('New password is required.');
      return;
    }
    setIsSaving(true);
    setError('');
    setSuccessMsg('');

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: resetUser?.id,
          password: newPassword.trim(),
        }),
      });
      const result = await res.json();
      if (!res.ok || result.error) {
        setError(result.error || 'Failed to reset password');
      } else {
        setSuccessMsg(`Password reset successfully for ${resetUser?.username}!`);
        setTimeout(() => setSuccessMsg(''), 3000);
        setIsResetPasswordOpen(false);
        setResetUser(null);
        setNewPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsSaving(true);

    const formData = new FormData(e.currentTarget);
    const roleValue = (formData.get('role') as string) || selectedRole;
    let companyIdValue = (formData.get('companyId') as string) || selectedCompanyId;

    if (isCompanyAdmin) {
      companyIdValue = currentCompanyId || '';
    }

    if (roleValue !== 'super_admin' && !companyIdValue) {
      setError('Please select a company to assign to this account.');
      setIsSaving(false);
      return;
    }

    const payload = {
      username: (formData.get('username') as string).trim(),
      password: (formData.get('password') as string).trim(),
      role: roleValue,
      companyId: roleValue === 'super_admin' ? undefined : companyIdValue,
      id: editingUser ? editingUser.id : undefined,
    };

    try {
      const method = editingUser ? 'PUT' : 'POST';
      const res = await fetch('/api/users', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();

      if (!res.ok || result.error) {
        setError(result.error || 'Failed to save user');
      } else {
        setSuccessMsg(editingUser ? 'User updated successfully!' : 'User created successfully!');
        setTimeout(() => setSuccessMsg(''), 3000);
        handleCloseForm();
        fetchUsers();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, username: string) => {
    if (confirm(`Are you sure you want to delete user "${username}"?`)) {
      try {
        const res = await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete user');
        setSuccessMsg(`User "${username}" deleted successfully.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchUsers();
      } catch (err: any) {
        setError(err.message || 'Failed to delete user');
      }
    }
  };

  // Helper to render role badge
  const renderRoleBadge = (role: string) => {
    switch (role) {
      case 'super_admin':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Shield className="h-3 w-3 text-amber-400" />
            Super Admin
          </span>
        );
      case 'company_admin':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold theme-badge">
            <Building2 className="h-3 w-3 text-theme-accent" />
            Company Admin
          </span>
        );
      case 'manager':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            <ClipboardList className="h-3 w-3 text-purple-400" />
            Manager
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <CreditCard className="h-3 w-3 text-cyan-400" />
            Cashier
          </span>
        );
      case 'chef':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-orange-500/15 text-orange-300 border border-orange-500/30">
            <UtensilsCrossed className="h-3 w-3 text-orange-400" />
            Chef
          </span>
        );
      case 'waiter':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Utensils className="h-3 w-3 text-emerald-400" />
            Waiter
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
            <UserIcon className="h-3 w-3 text-zinc-400" />
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Dynamic Theme Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 text-white shadow-xl border border-theme">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/20 text-white shadow-inner">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">
                  {isSuperAdmin ? 'User & Role Management' : 'Company User & Role Management'}
                </h1>
                {isSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/30 px-2.5 py-0.5 text-xs font-bold text-amber-300">
                    <Shield className="h-3 w-3 text-amber-300" />
                    Super Admin
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full theme-badge px-2.5 py-0.5 text-xs font-bold">
                    <Building2 className="h-3 w-3 text-theme-accent" />
                    Company Admin
                  </span>
                )}
              </div>
              <p className="text-sm font-medium text-white/90 mt-1">
                {isSuperAdmin
                  ? 'Manage all system administrators, company admins, managers, cashiers, chefs, and waiters.'
                  : `Manage users for ${currentCompanyName || 'your company'}: create and manage Managers, Cashiers, Chefs, and Waiters.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 rounded-xl bg-black/30 hover:bg-black/50 border border-white/20 text-white px-4 py-2.5 text-sm font-semibold shadow-lg active:scale-95 transition-all cursor-pointer disabled:opacity-50"
              title="Refresh users"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-pink-300" : "text-zinc-200"}`} />
              <span>Refresh</span>
            </button>
            {(isSuperAdmin || isCompanyAdmin) && (
              <button
                onClick={() => handleOpenForm()}
                className="flex items-center gap-2 rounded-xl btn-theme-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
              >
                <UserPlus className="h-4 w-4" /> Add User
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/15 p-4 text-xs font-semibold text-rose-400 border border-rose-500/30 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-500/15 p-4 text-xs font-semibold text-emerald-400 border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add / Edit User Form Modal (Super Admin & Company Admin) */}
      {isFormOpen && (isSuperAdmin || isCompanyAdmin) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
            <h2 className="mb-4 text-xl font-black text-white">
              {editingUser ? 'Edit User Account' : 'Create New User Account'}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Username *</label>
                <input
                  required
                  defaultValue={editingUser?.username}
                  name="username"
                  placeholder="e.g. rahul_manager"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-theme theme-input-focus transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                  Password {editingUser ? '(leave blank to keep unchanged)' : '*'}
                </label>
                <input
                  required={!editingUser}
                  type="password"
                  name="password"
                  placeholder={editingUser ? '••••••••' : 'Password'}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-theme theme-input-focus transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Role *</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  name="role"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-theme theme-input-focus transition cursor-pointer"
                >
                  {isSuperAdmin && (
                    <>
                      <option value="company_admin">Company Admin</option>
                      <option value="super_admin">Super Admin</option>
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                      <option value="chef">Chef</option>
                      <option value="waiter">Waiter</option>
                    </>
                  )}
                  {isCompanyAdmin && (
                    <>
                      <option value="manager">Manager</option>
                      <option value="cashier">Cashier</option>
                      <option value="chef">Chef</option>
                      <option value="waiter">Waiter</option>
                    </>
                  )}
                </select>
              </div>

              {/* Company Assignment */}
              {isSuperAdmin && selectedRole !== 'super_admin' && (
                <div className="rounded-xl border border-theme bg-theme-badge p-4 space-y-2">
                  <label className="block text-xs font-bold text-theme-accent flex items-center gap-1.5">
                    <Building2 className="h-4 w-4 text-theme-accent" />
                    Assign to Company *
                  </label>
                  <p className="text-[11px] text-zinc-400">
                    This user will be linked to the selected company and restricted to its data.
                  </p>
                  <select
                    name="companyId"
                    required
                    value={selectedCompanyId}
                    onChange={(e) => setSelectedCompanyId(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white outline-none focus:border-theme theme-input-focus cursor-pointer"
                  >
                    <option value="">-- Choose Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isCompanyAdmin && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-400 font-semibold">Assigned Company:</span>
                  <span className="font-bold text-white inline-flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-theme-accent" />
                    {currentCompanyName || currentCompanyId}
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-3 pt-4 border-t border-zinc-800">
                <button
                  disabled={isSaving}
                  type="button"
                  onClick={handleCloseForm}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isSaving}
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {isSaving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider font-bold text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4">Username</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Assigned Company</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs text-zinc-500">
                  No users found.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentUserId;
                const canCompanyAdminManage =
                  isCompanyAdmin &&
                  !isSelf &&
                  user.role !== 'super_admin' &&
                  user.role !== 'company_admin';

                return (
                  <tr key={user.id} className="hover:bg-zinc-800/40 transition">
                    <td className="px-6 py-4 font-bold text-white">
                      <div className="flex items-center gap-2.5">
                        <div className="rounded-xl bg-zinc-800 border border-zinc-700 p-2 text-pink-400">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <div>
                          <span className="font-bold text-white">{user.username}</span>
                          {user.id === 'u1' && (
                            <span className="ml-2 text-[10px] text-pink-400 font-mono bg-pink-950/60 border border-pink-500/40 px-1.5 py-0.5 rounded-md">
                              system-root
                            </span>
                          )}
                          {isSelf && (
                            <span className="ml-2 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 border border-emerald-500/40 px-1.5 py-0.5 rounded-md">
                              you
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{renderRoleBadge(user.role)}</td>
                    <td className="px-6 py-4 text-xs font-medium text-zinc-400">
                      {user.role === 'super_admin' ? (
                        <span className="text-zinc-500 italic">Global System Access</span>
                      ) : user.companyName ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 border border-zinc-700/80 px-2.5 py-1 text-zinc-200 font-semibold">
                          <Building2 className="h-3.5 w-3.5 text-theme-accent" />
                          {user.companyName}
                        </span>
                      ) : user.companyId ? (
                        <span className="font-mono text-zinc-400">{user.companyId}</span>
                      ) : (
                        <span className="text-amber-400 text-xs italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {isSuperAdmin ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenResetPassword(user)}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition cursor-pointer border border-transparent hover:border-zinc-700"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(user)}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-theme-accent transition cursor-pointer border border-transparent hover:border-zinc-700"
                            title="Edit User"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {user.id !== currentUserId && (
                            <button
                              onClick={() => handleDelete(user.id, user.username)}
                              className="rounded-lg p-2 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-400 transition cursor-pointer border border-transparent hover:border-rose-900/50"
                              title="Delete User"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ) : isCompanyAdmin && canCompanyAdminManage ? (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleOpenResetPassword(user)}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-amber-400 transition cursor-pointer border border-transparent hover:border-zinc-700"
                            title="Reset Password"
                          >
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(user)}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-theme-accent transition cursor-pointer border border-transparent hover:border-zinc-700"
                            title="Edit User"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.username)}
                            className="rounded-lg p-2 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-400 transition cursor-pointer border border-transparent hover:border-rose-900/50"
                            title="Delete User"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end">
                          <button
                            onClick={() => handleOpenResetPassword(user)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-theme bg-theme-badge px-3.5 py-1.5 text-xs font-bold text-theme-accent hover:opacity-90 transition shadow-sm cursor-pointer"
                            title="Reset Password"
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                            Reset Password
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Reset Password Modal */}
      {isResetPasswordOpen && resetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl text-white animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-xl theme-icon-box p-2.5">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-white">Reset Password</h2>
                <p className="text-xs text-zinc-400">
                  Update password for <span className="text-white font-bold">{resetUser.username}</span> ({resetUser.role})
                </p>
              </div>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Username</label>
                <input
                  disabled
                  value={resetUser.username}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2.5 text-sm text-zinc-500 cursor-not-allowed font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">New Password *</label>
                <input
                  required
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoFocus
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-theme theme-input-focus transition"
                />
              </div>

              <div className="flex justify-end gap-2 mt-2 pt-4 border-t border-zinc-800">
                <button
                  disabled={isSaving}
                  type="button"
                  onClick={() => {
                    setIsResetPasswordOpen(false);
                    setResetUser(null);
                    setNewPassword('');
                  }}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  disabled={isSaving}
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg transition active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSaving ? 'Updating...' : 'Save New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
