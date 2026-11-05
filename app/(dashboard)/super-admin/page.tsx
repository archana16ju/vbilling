'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Building2,
  Plus,
  Users,
  Shield,
  Edit2,
  Trash2,
  CheckCircle,
  XCircle,
  Power,
  Sliders,
  Check,
  RefreshCw,
  AlertCircle,
  Database,
  Palette,
  TrendingUp,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Clock,
} from 'lucide-react';
import Link from 'next/link';
import CompanyThemePanel from '@/components/settings/CompanyThemePanel';
import SuperAdminAnalyticsSection from '@/components/super-admin/SuperAdminAnalyticsSection';
import SuperAdminReportsSection from '@/components/super-admin/SuperAdminReportsSection';

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

import {
  DASHBOARD_COLLECTION_MODULES,
  DashboardModuleDefinition,
  CompanyPermissions,
} from '@/lib/dashboard-modules';

export default function SuperAdminPage() {
  const [role, setRole] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string>('');
  const [isLoadingCompanies, setIsLoadingCompanies] = useState(true);
  const [error, setError] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Active Main Tab: 'analytics' | 'reports' | 'companies'
  const [activeTab, setActiveTab] = useState<'analytics' | 'reports' | 'companies'>('analytics');

  // Global Filter States
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [selectedPreset, setSelectedPreset] = useState<string>('30days');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Auto-Refresh state
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(30); // 30s default
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Analytics API Data State
  const [analyticsData, setAnalyticsData] = useState<any | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(true);

  // Report Jump Target State (when clicking KPI cards)
  const [targetReportKey, setTargetReportKey] = useState<string>('overall_sales');

  // Company Edit/Create Modal
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);

  // Permissions Modal
  const [isPermModalOpen, setIsPermModalOpen] = useState(false);
  const [selectedCompanyForPerms, setSelectedCompanyForPerms] = useState<Company | null>(null);
  const [currentPerms, setCurrentPerms] = useState<CompanyPermissions | null>(null);
  const [availableModules, setAvailableModules] = useState<DashboardModuleDefinition[]>(DASHBOARD_COLLECTION_MODULES);
  const [isSavingPerms, setIsSavingPerms] = useState(false);

  // Theme Modal for Super Admin
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);
  const isLocalMySql = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql';

  // 1. Initial Auth & Data Fetching
  useEffect(() => {
    setIsMounted(true);
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    setRole(r);
    fetchCompanies();
  }, []);

  const handleSwitchCompany = async (companyId: string) => {
    try {
      document.cookie = `auth_company_id=${companyId}; path=/; max-age=604800; SameSite=Lax`;
      const res = await fetch('/api/companies/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to switch company');
      setActiveCompanyId(companyId);
      setSuccessMsg(`Switched active context to ${data.company?.name || companyId}`);
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
      setError(err.message || 'Failed to switch company');
    }
  };

  // 2. Fetch Companies
  const fetchCompanies = async () => {
    setIsLoadingCompanies(true);
    setError('');
    try {
      const [compRes, activeRes] = await Promise.all([
        fetch('/api/companies'),
        fetch('/api/companies/active'),
      ]);
      const compData = await compRes.json();
      const activeData = await activeRes.json();

      if (!compRes.ok) throw new Error(compData.error || 'Failed to fetch companies');
      setCompanies(Array.isArray(compData) ? compData : []);
      if (activeData.activeCompany) {
        setActiveCompanyId(activeData.activeCompany.id);
      }
    } catch (err: any) {
      setError(err.message || 'Error loading Super Admin companies');
    } finally {
      setIsLoadingCompanies(false);
    }
  };

  // 3. Fetch Analytics Data
  const fetchAnalytics = useCallback(async () => {
    setIsAnalyticsLoading(true);
    try {
      let url = `/api/super-admin/analytics?companyId=${encodeURIComponent(selectedCompanyId)}&preset=${encodeURIComponent(selectedPreset)}`;
      if (selectedPreset === 'custom' && customStartDate && customEndDate) {
        url += `&startDate=${encodeURIComponent(customStartDate)}&endDate=${encodeURIComponent(customEndDate)}`;
      }

      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch analytics');
      setAnalyticsData(json);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Super Admin fetchAnalytics error:', err);
      setError(err.message || 'Failed to update analytics');
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [selectedCompanyId, selectedPreset, customStartDate, customEndDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // 4. Background Auto-Refresh Timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (autoRefreshInterval > 0) {
      timerRef.current = setInterval(() => {
        fetchAnalytics();
      }, autoRefreshInterval * 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [autoRefreshInterval, fetchAnalytics]);

  // Handlers for Navigation & KPI card click
  const handleSelectReportFromKpi = (reportKey: string, companyId?: string) => {
    setTargetReportKey(reportKey);
    if (companyId) {
      setSelectedCompanyId(companyId);
    }
    setActiveTab('reports');
    // Scroll gently to top of reports
    window.scrollTo({ top: 350, behavior: 'smooth' });
  };

  // Company management actions
  const handleOpenCompanyModal = (comp?: Company) => {
    setEditingCompany(comp || null);
    setIsCompanyModalOpen(true);
  };

  const handleSaveCompany = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      const method = editingCompany ? 'PUT' : 'POST';
      const body = editingCompany ? { id: editingCompany.id, ...payload } : payload;
      const res = await fetch('/api/companies', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save company');

      setIsCompanyModalOpen(false);
      setSuccessMsg(editingCompany ? 'Company updated successfully!' : 'Company created successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchCompanies();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleActive = async (comp: Company) => {
    try {
      const res = await fetch('/api/companies', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: comp.id, isActive: !comp.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to toggle company status');
      setSuccessMsg(`Company "${comp.name}" ${!comp.isActive ? 'activated' : 'deactivated'} successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      fetchCompanies();
      fetchAnalytics();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCompany = async (comp: Company) => {
    if (confirm(`Are you sure you want to permanently delete "${comp.name}" and all its records? This cannot be undone.`)) {
      try {
        const res = await fetch(`/api/companies?id=${comp.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete company');
        setSuccessMsg(`Company "${comp.name}" deleted.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchCompanies();
        fetchAnalytics();
      } catch (err: any) {
        setError(err.message);
      }
    }
  };

  const handleOpenPermsModal = async (comp: Company) => {
    setSelectedCompanyForPerms(comp);
    setIsPermModalOpen(true);
    setCurrentPerms(null);
    try {
      const res = await fetch(`/api/companies/permissions?companyId=${comp.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to fetch permissions');
      setCurrentPerms(data);
      if (data._availableModules && Array.isArray(data._availableModules)) {
        setAvailableModules(data._availableModules);
      } else if (data.modules && Array.isArray(data.modules)) {
        setAvailableModules(data.modules);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleModule = (key: string) => {
    if (!currentPerms) return;
    setCurrentPerms({
      ...currentPerms,
      [key]: !currentPerms[key],
    });
  };

  const handleSavePerms = async () => {
    if (!selectedCompanyForPerms || !currentPerms) return;
    setIsSavingPerms(true);
    try {
      const res = await fetch('/api/companies/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPerms),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save permissions');
      setSuccessMsg(`Module permissions updated for ${selectedCompanyForPerms.name}!`);
      setTimeout(() => setSuccessMsg(''), 3000);
      setIsPermModalOpen(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSavingPerms(false);
    }
  };

  // Super Admin Authorization Gate
  if (role && role !== 'super_admin') {
    return (
      <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-8 text-center max-w-xl mx-auto my-12 text-white">
        <Shield className="h-12 w-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-red-300 mb-2">Access Denied</h2>
        <p className="text-xs text-red-400 mb-4">
          This Super Admin control panel and analytics system is strictly restricted to authenticated Super Admin users.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer"
        >
          Return to Company Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-white min-h-screen">
      {/* ========================================================= */}
      {/* HEADER HERO BANNER (Theme-ready Black Cherry styling) */}
      {/* ========================================================= */}
      <div className="rounded-3xl p-6 sm:p-8 bg-black-cherry border border-pink-500/30 shadow-2xl relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-52 w-52 rounded-full bg-pink-500/20 blur-3xl pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/50 border border-amber-400/40 px-3 py-1 text-[11px] font-bold text-amber-300 shadow-sm">
              <Shield className="h-3.5 w-3.5 text-amber-400" />
              Super Admin SaaS Operations
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 border border-emerald-400/40 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
              <Database className="h-3 w-3 text-emerald-400" />
              MySQL: local_billing_db
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-black/50 border border-pink-400/40 px-2.5 py-0.5 text-[11px] font-bold text-pink-300">
              <Sparkles className="h-3 w-3 text-pink-400" />
              Live Telemetry
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white preserve-white" style={{ color: '#ffffff' }}>
            Enterprise Analytics & System Administration
          </h1>
          <p className="text-xs sm:text-sm font-medium mt-1 preserve-white text-zinc-100 max-w-2xl" style={{ color: '#f4f4f5' }}>
            Complete real-time multi-tenant intelligence, dynamic sales curves, company matrices, inventory telemetry, and 40+ exportable financial audit reports.
          </p>
        </div>

        {/* Global Toolbar Buttons */}
        <div className="flex items-center gap-2.5 relative z-10 flex-wrap shrink-0">
          <button
            onClick={() => {
              fetchCompanies();
              fetchAnalytics();
            }}
            disabled={isLoadingCompanies || isAnalyticsLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 hover:bg-black/60 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-sm disabled:opacity-50"
            title="Refresh Companies & Analytics"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingCompanies || isAnalyticsLoading ? 'animate-spin text-pink-400' : 'text-zinc-200'}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/users"
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-black/40 hover:bg-black/60 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer shadow-sm"
          >
            <Users className="h-4 w-4 text-zinc-200" />
            <span>Manage Users</span>
          </Link>
          <button
            onClick={() => setIsThemeModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-theme-bar border border-theme shadow-theme-glow hover:opacity-95 px-3.5 py-2 text-xs font-bold text-white transition cursor-pointer active:scale-95"
            title="Configure Super Admin Dashboard & System Theme"
          >
            <Palette className="h-4 w-4" />
            Theme
          </button>
          <button
            onClick={() => handleOpenCompanyModal()}
            className="inline-flex items-center gap-2 rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Create Company
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {error && (
        <div className="rounded-xl bg-red-950/40 border border-red-800/60 p-4 text-xs font-bold text-red-300 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-red-400 hover:text-white cursor-pointer font-bold">&times;</button>
        </div>
      )}

      {successMsg && (
        <div className="rounded-xl bg-emerald-950/40 border border-emerald-800/60 p-4 text-xs font-bold text-emerald-300 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN NAVIGATION TABS & AUTO-REFRESH CONTROLLER */}
      {/* ========================================================= */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-theme-bar text-white shadow-lg border border-theme shadow-theme-glow font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            <span>Analytics & Charts</span>
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'reports'
                ? 'bg-theme-bar text-white shadow-lg border border-theme shadow-theme-glow font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>Detailed Reports</span>
          </button>

          <button
            onClick={() => setActiveTab('companies')}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'companies'
                ? 'bg-theme-bar text-white shadow-lg border border-theme shadow-theme-glow font-black'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Company Management</span>
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-mono text-pink-300">
              {companies.length}
            </span>
          </button>
        </div>

        {/* Auto-Refresh Timer Controller */}
        <div className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-zinc-950/60 border border-zinc-800/80 text-xs">
          <div className="flex items-center gap-1.5 text-zinc-400">
            <Clock className="h-3.5 w-3.5 text-pink-400" />
            <span className="text-[11px] font-bold">Auto-sync:</span>
          </div>
          <select
            value={autoRefreshInterval}
            onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            className="bg-zinc-900 border border-zinc-700/80 rounded-lg px-2 py-1 text-[11px] font-bold text-zinc-200 cursor-pointer"
          >
            <option value={15}>15s (Rapid)</option>
            <option value={30}>30s (Recommended)</option>
            <option value={60}>60s (Standard)</option>
            <option value={120}>2 mins</option>
            <option value={0}>Manual Only</option>
          </select>
          <span className="text-[10px] text-zinc-500 font-mono hidden md:inline" suppressHydrationWarning>
            {isMounted && lastRefreshedAt ? `Updated: ${lastRefreshedAt.toLocaleTimeString()}` : 'Updated: --:--:--'}
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* TAB 1: DYNAMIC ANALYTICS & CHARTS */}
      {/* ========================================================= */}
      {activeTab === 'analytics' && (
        <SuperAdminAnalyticsSection
          data={analyticsData}
          isLoading={isAnalyticsLoading}
          selectedCompanyId={selectedCompanyId}
          selectedPreset={selectedPreset}
          customStartDate={customStartDate}
          customEndDate={customEndDate}
          currencySymbol="₹"
          onCompanyChange={(cid) => setSelectedCompanyId(cid)}
          onPresetChange={(p) => setSelectedPreset(p)}
          onCustomDateChange={(start, end) => {
            setCustomStartDate(start);
            setCustomEndDate(end);
          }}
          onRefresh={fetchAnalytics}
          onSelectReport={handleSelectReportFromKpi}
        />
      )}

      {/* ========================================================= */}
      {/* TAB 2: DETAILED INTERACTIVE REPORTS */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <SuperAdminReportsSection
          initialReportKey={targetReportKey}
          initialCompanyId={selectedCompanyId}
          companiesList={companies.map((c) => ({ id: c.id, name: c.name, code: c.code }))}
          currencySymbol="₹"
          onFilterCompany={(cid) => setSelectedCompanyId(cid)}
        />
      )}

      {/* ========================================================= */}
      {/* TAB 3: COMPANY TENANT MANAGEMENT TABLE */}
      {/* ========================================================= */}
      {activeTab === 'companies' && (
        <div className="space-y-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 shadow-lg">
              <div className="flex items-center justify-between text-zinc-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Companies</span>
                <Building2 className="h-5 w-5 text-zinc-500" />
              </div>
              <div className="text-3xl font-black text-white">{companies.length}</div>
              <p className="text-xs text-zinc-500 mt-1">Multi-tenant isolated entities</p>
            </div>

            <div className="rounded-2xl border border-emerald-900/40 bg-emerald-950/20 p-5 shadow-lg">
              <div className="flex items-center justify-between text-emerald-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Active Entities</span>
                <CheckCircle className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-black text-emerald-300">
                {companies.filter((c) => c.isActive).length}
              </div>
              <p className="text-xs text-emerald-400/60 mt-1">Ready for terminal POS operations</p>
            </div>

            <div className="rounded-2xl border border-blue-900/40 bg-blue-950/20 p-5 shadow-lg">
              <div className="flex items-center justify-between text-blue-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Assigned Staff</span>
                <Users className="h-5 w-5 text-blue-400" />
              </div>
              <div className="text-3xl font-black text-blue-300">
                {companies.reduce((sum, c) => sum + (c.userCount || 0), 0)}
              </div>
              <p className="text-xs text-blue-400/60 mt-1">Company Admins and Cashiers</p>
            </div>

            <div className="rounded-2xl border border-purple-900/40 bg-purple-950/20 p-5 shadow-lg">
              <div className="flex items-center justify-between text-purple-400 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider">Module Security</span>
                <Sliders className="h-5 w-5 text-purple-400" />
              </div>
              <div className="text-3xl font-black text-purple-300">{DASHBOARD_COLLECTION_MODULES.length} Modules</div>
              <p className="text-xs text-purple-400/60 mt-1">Configurable dashboard modules</p>
            </div>
          </div>

          {/* Companies List Table */}
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900/70 shadow-xl overflow-hidden">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-black text-white tracking-tight uppercase">
                  All Registered Companies ({companies.length})
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Multi-company isolation verified against MySQL local_billing_db
                </p>
              </div>
              <button
                onClick={fetchCompanies}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" /> Refresh
              </button>
            </div>

            {isLoadingCompanies ? (
              <div className="p-12 text-center text-zinc-500 flex flex-col items-center justify-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin text-pink-500" />
                <span className="text-xs font-bold">Loading companies...</span>
              </div>
            ) : companies.length === 0 ? (
              <div className="p-12 text-center text-zinc-500">
                <Building2 className="mx-auto mb-3 h-10 w-10 text-zinc-600" />
                <p className="text-base font-bold text-zinc-300">No companies found</p>
                <p className="text-xs text-zinc-500 mt-1">Click &quot;Create Company&quot; to establish your first tenant.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-800">
                    <tr>
                      <th className="px-6 py-3.5">Company Details</th>
                      <th className="px-6 py-3.5">Code</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Assigned Users</th>
                      <th className="px-6 py-3.5 text-center">Module Access</th>
                      <th className="px-6 py-3.5 text-right">Super Admin Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {companies.map((comp) => {
                      const isActiveContext = comp.id === activeCompanyId;
                      return (
                        <tr key={comp.id} className={isActiveContext ? 'bg-amber-950/20' : 'hover:bg-zinc-800/40 transition'}>
                          <td className="px-6 py-4">
                            <div className="font-bold text-white flex items-center gap-2">
                              <span>{comp.name}</span>
                              {isActiveContext && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                  <Check className="h-3 w-3" />
                                  Active Context
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-zinc-500 mt-0.5">
                              {comp.email || comp.phone || comp.address || 'No contact details'}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="rounded-md bg-zinc-800 border border-zinc-700 px-2 py-1 font-mono text-xs font-bold text-pink-300">
                              {comp.code}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {comp.isActive ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-950/60 border border-emerald-800 px-2.5 py-0.5 text-[11px] font-bold text-emerald-400">
                                <CheckCircle className="h-3.5 w-3.5" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[11px] font-bold text-zinc-500">
                                <XCircle className="h-3.5 w-3.5" />
                                Deactivated
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1.5 text-xs text-zinc-300 font-bold">
                              <Users className="h-3.5 w-3.5 text-zinc-400" />
                              {comp.userCount ?? 0} accounts
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={() => handleOpenPermsModal(comp)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold text-white preserve-white transition cursor-pointer active:scale-95 ${
                                isLocalMySql
                                  ? 'btn-theme-primary shadow-md shadow-theme-glow'
                                  : 'bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30'
                              }`}
                              title="Configure module enable/disable permissions"
                            >
                              <Sliders className="h-3.5 w-3.5 text-white preserve-white" style={{ color: '#ffffff' }} />
                              <span className="text-white preserve-white" style={{ color: '#ffffff' }}>Configure Permissions</span>
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isActiveContext && comp.isActive && (
                                <button
                                  onClick={() => handleSwitchCompany(comp.id)}
                                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-white btn-theme-primary transition cursor-pointer active:scale-95 mr-1"
                                  title="Switch active context to this company"
                                >
                                  Switch Context
                                </button>
                              )}
                              <button
                                onClick={() => handleToggleActive(comp)}
                                className={`rounded-lg p-2 transition cursor-pointer ${
                                  comp.isActive
                                    ? 'text-amber-400 hover:bg-amber-950/40'
                                    : 'text-emerald-400 hover:bg-emerald-950/40'
                                }`}
                                title={comp.isActive ? 'Deactivate Company' : 'Activate Company'}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleOpenCompanyModal(comp)}
                                className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                                title="Edit Company"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteCompany(comp)}
                                className="rounded-lg p-2 text-zinc-500 hover:bg-red-950/40 hover:text-red-400 transition cursor-pointer"
                                title="Delete Company"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
        </div>
      )}

      {/* Module Permissions Modal */}
      {isPermModalOpen && selectedCompanyForPerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-zinc-800 shrink-0">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-pink-400" />
                  Module Access Permissions – {selectedCompanyForPerms.name} ({selectedCompanyForPerms.code})
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Enable or disable modules individually. Disabled modules cannot be accessed or modified by Company Admins.
                </p>
              </div>
              <button
                onClick={() => setIsPermModalOpen(false)}
                className="text-zinc-500 hover:text-white text-xl font-bold p-1 cursor-pointer"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto py-4 flex-1 space-y-3">
              {!currentPerms ? (
                <div className="p-8 text-center text-zinc-500 flex items-center justify-center gap-2">
                  <RefreshCw className="h-5 w-5 animate-spin text-pink-500" />
                  <span>Loading permissions...</span>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {availableModules.map(({ key, label, desc, isCustom }: DashboardModuleDefinition) => {
                    const isEnabled = currentPerms[key] !== false;
                    return (
                      <div
                        key={key}
                        className={`rounded-xl border p-3.5 transition flex items-center justify-between ${
                          isEnabled
                            ? 'border-emerald-800/50 bg-emerald-950/20'
                            : 'border-zinc-800 bg-zinc-950 opacity-60'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{label}</span>
                            {isEnabled ? (
                              <span className="rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-1.5 py-0.5">
                                Enabled
                              </span>
                            ) : (
                              <span className="rounded bg-zinc-800 text-zinc-400 text-[10px] font-bold px-1.5 py-0.5">
                                Disabled
                              </span>
                            )}
                            {isCustom && (
                              <span className="rounded bg-pink-950/60 text-pink-400 border border-pink-800 text-[9px] font-bold px-1.5 py-0.5">
                                Auto-Detected
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{desc}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleToggleModule(key)}
                          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                            isEnabled ? 'bg-emerald-500' : 'bg-zinc-800'
                          }`}
                          role="switch"
                          aria-checked={isEnabled}
                        >
                          <span
                            aria-hidden="true"
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                              isEnabled ? 'translate-x-5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between shrink-0">
              <span className="text-xs text-zinc-500">
                Server-side authorization is applied on all API routes and actions.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPermModalOpen(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSavingPerms || !currentPerms}
                  onClick={handleSavePerms}
                  className="rounded-xl btn-theme-primary disabled:opacity-50 px-5 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer active:scale-95"
                >
                  {isSavingPerms ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Company Modal */}
      {isCompanyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white">
            <h3 className="text-base font-black text-white mb-4">
              {editingCompany ? 'Edit Company' : 'Create New Company'}
            </h3>
            <form onSubmit={handleSaveCompany} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Company Name *</label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={editingCompany?.name || ''}
                    placeholder="e.g. Acme Retailers"
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Company Code *</label>
                  <input
                    type="text"
                    name="code"
                    required
                    defaultValue={editingCompany?.code || ''}
                    placeholder="e.g. ACME"
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs font-mono font-bold uppercase text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-300 mb-1">Address</label>
                <textarea
                  name="address"
                  rows={2}
                  defaultValue={editingCompany?.address || ''}
                  placeholder="Location address"
                  className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Phone</label>
                  <input
                    type="text"
                    name="phone"
                    defaultValue={editingCompany?.phone || ''}
                    placeholder="Phone"
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Email</label>
                  <input
                    type="email"
                    name="email"
                    defaultValue={editingCompany?.email || ''}
                    placeholder="billing@company.com"
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
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
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-300 mb-1">Currency</label>
                  <input
                    type="text"
                    name="currency"
                    defaultValue={editingCompany?.currency || 'INR'}
                    placeholder="INR"
                    className="w-full rounded-xl bg-zinc-800 border border-zinc-700 px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-hidden focus:border-pink-500"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCompanyModalOpen(false)}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg transition cursor-pointer active:scale-95"
                >
                  {editingCompany ? 'Save Changes' : 'Create Company'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Super Admin Theme Modal */}
      {isThemeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-5xl rounded-3xl bg-zinc-950 p-6 sm:p-8 shadow-2xl border border-zinc-800 my-8 max-h-[90vh] overflow-y-auto no-scrollbar">
            <CompanyThemePanel
              initialTargetMode="super_admin_system"
              onClose={() => setIsThemeModalOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
