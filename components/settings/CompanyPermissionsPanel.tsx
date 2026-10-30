'use client';

import { useState, useEffect } from 'react';
import {
  Sliders,
  Building2,
  CheckCircle,
  RefreshCw,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import {
  DASHBOARD_COLLECTION_MODULES,
  DashboardModuleDefinition,
  CompanyPermissions
} from '@/lib/dashboard-modules';

interface Company {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export default function CompanyPermissionsPanel() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [permissions, setPermissions] = useState<CompanyPermissions | null>(null);
  const [modules, setModules] = useState<DashboardModuleDefinition[]>(DASHBOARD_COLLECTION_MODULES);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 1. Fetch companies list
  useEffect(() => {
    fetch('/api/companies')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setCompanies(data);
          if (data.length > 0) {
            setSelectedCompanyId(data[0].id);
          }
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setIsLoading(false));
  }, []);

  // 2. Fetch permissions & dynamic modules when selected company changes
  const fetchPermissionsAndModules = (companyId: string) => {
    if (!companyId) return;
    setIsLoading(true);
    setError('');
    fetch(`/api/companies/permissions?companyId=${companyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setPermissions(data);
        if (data._availableModules && Array.isArray(data._availableModules)) {
          setModules(data._availableModules);
        } else if (data.modules && Array.isArray(data.modules)) {
          setModules(data.modules);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => {
        setIsLoading(false);
        setIsRefreshing(false);
      });
  };

  useEffect(() => {
    if (selectedCompanyId) {
      fetchPermissionsAndModules(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchPermissionsAndModules(selectedCompanyId);
  };

  const handleToggle = (key: string) => {
    if (!permissions) return;
    setPermissions({
      ...permissions,
      [key]: !permissions[key],
    });
  };

  const handleSave = async () => {
    if (!selectedCompanyId || !permissions) return;
    setIsSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const res = await fetch('/api/companies/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(permissions),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update permissions');
      setSuccessMsg('Company collection permissions saved successfully!');
      if (data._availableModules && Array.isArray(data._availableModules)) {
        setModules(data._availableModules);
      }
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 text-white">
      <div className="border-b pb-4 border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-pink-500/10 border border-pink-500/30 text-pink-400">
              <Sliders className="h-4 w-4" />
            </div>
            Company Access Permissions (Super Admin Only)
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Configure which dashboard collections are enabled or disabled for each company. Newly created database tables and collections appear here automatically.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition shadow-sm cursor-pointer"
            title="Scan database for new collections and tables"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-pink-400' : 'text-zinc-400'}`} />
            <span>Scan Collections</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-950/60 p-3 text-xs text-rose-300 border border-rose-800/80 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-950/60 p-3 text-xs text-emerald-300 border border-emerald-800/80 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Target Company Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800">
        <div className="flex items-center gap-2 text-xs font-bold text-zinc-300 uppercase tracking-wider">
          <Building2 className="h-4 w-4 text-pink-400" />
          <span>Select Target Company:</span>
        </div>
        <select
          value={selectedCompanyId}
          onChange={(e) => setSelectedCompanyId(e.target.value)}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-semibold text-white focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
        >
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.code}) {!c.isActive ? '- [Inactive]' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Dashboard Collection Module Toggles */}
      {isLoading ? (
        <div className="p-8 text-center text-zinc-400 flex items-center justify-center gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-pink-400" />
          <span>Loading collection permissions...</span>
        </div>
      ) : permissions ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-medium px-1">
            <span>Active Collections & Modules ({modules.length})</span>
            <span className="text-[11px] text-zinc-500">Default for new collections: Enabled</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {modules.map(({ key, label, desc, isCustom }: DashboardModuleDefinition) => {
              const isEnabled = permissions[key] !== false;
              return (
                <div
                  key={key}
                  className={`rounded-2xl border p-4 transition flex items-center justify-between ${
                    isEnabled
                      ? 'border-pink-500/30 bg-zinc-900/90 shadow-sm'
                      : 'border-zinc-800 bg-zinc-950/60 opacity-60'
                  }`}
                >
                  <div className="pr-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">{label}</span>
                      {isEnabled ? (
                        <span className="rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5">
                          Enabled
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 text-[10px] font-bold px-2 py-0.5">
                          Disabled
                        </span>
                      )}
                      {isCustom && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-pink-950/50 text-pink-300 border border-pink-500/30 text-[9px] font-semibold px-2 py-0.5">
                          <Sparkles className="h-2.5 w-2.5" />
                          Auto-Detected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{desc}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggle(key)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isEnabled ? 'bg-theme-bar shadow-theme-glow' : 'bg-zinc-700'
                    }`}
                    role="switch"
                    aria-checked={isEnabled}
                    title={`Toggle ${label} for this company`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="pt-4 flex items-center justify-between border-t border-zinc-800">
            <span className="text-xs text-zinc-400">
              Changes take effect immediately on next request for company users.
            </span>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl btn-theme-primary disabled:opacity-50 px-5 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer active:scale-95"
            >
              {isSaving ? 'Saving...' : 'Save Permissions'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

