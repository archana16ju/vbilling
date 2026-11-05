'use client';

import React, { useState, useEffect } from 'react';
import {
  Palette,
  Check,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  RefreshCw,
  Building2,
  Crown,
  X,
  Layers,
  Sun,
  Moon,
  SunMoon,
} from 'lucide-react';
import {
  CompanyTheme,
  DEFAULT_BLACK_CHERRY_THEME,
  PREDEFINED_THEMES,
  applyThemeToDom,
} from '@/lib/theme-config';

interface CompanyThemePanelProps {
  initialTargetMode?: 'super_admin_system' | 'company_override';
  onClose?: () => void;
}

export default function CompanyThemePanel({
  initialTargetMode = 'super_admin_system',
  onClose,
}: CompanyThemePanelProps) {
  const [activeTheme, setActiveTheme] = useState<CompanyTheme>(DEFAULT_BLACK_CHERRY_THEME);
  const [savedTheme, setSavedTheme] = useState<CompanyTheme>(DEFAULT_BLACK_CHERRY_THEME);
  const [isCustom, setIsCustom] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [role, setRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Super Admin specific state
  const [adminTargetMode, setAdminTargetMode] = useState<'super_admin_system' | 'company_override'>(
    initialTargetMode
  );
  const [allCompanies, setAllCompanies] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

  // Fetch all companies for super admin dropdown
  const fetchCompaniesList = async () => {
    try {
      const res = await fetch('/api/companies');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setAllCompanies(data);
          if (data.length > 0 && !selectedCompanyId) {
            setSelectedCompanyId(data[0].id);
          }
        }
      }
    } catch {}
  };

  // Load theme based on current target mode and role
  const fetchTheme = async (overrideTargetMode?: 'super_admin_system' | 'company_override', targetCompId?: string) => {
    const currentMode = overrideTargetMode || adminTargetMode;
    const cid = targetCompId !== undefined ? targetCompId : selectedCompanyId;

    try {
      setIsLoading(true);
      setErrorMsg(null);

      if (role === 'super_admin' && currentMode === 'super_admin_system') {
        // Fetch System & Super Admin Default Theme
        const res = await fetch('/api/system/default-theme', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.theme) {
            setActiveTheme(data.theme);
            setSavedTheme(data.theme);
            setIsCustom(data.theme.id !== 'black-cherry');
            setCompanyName('Super Admin Dashboard & System Default');
            setCompanyId('SYSTEM');
            applyThemeToDom(data.theme);
          }
        }
      } else {
        // Fetch Company Theme (either authenticated company or selected override)
        const url = cid && role === 'super_admin'
          ? `/api/companies/theme?companyId=${encodeURIComponent(cid)}`
          : '/api/companies/theme';

        const res = await fetch(url, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.theme) {
            setActiveTheme(data.theme);
            setSavedTheme(data.theme);
            setIsCustom(Boolean(data.isCustom));
            setCompanyName(data.companyName || '');
            setCompanyId(data.companyId || '');
            applyThemeToDom(data.theme);
          }
        } else {
          const err = await res.json().catch(() => ({}));
          setErrorMsg(err.error || 'Failed to fetch theme configuration.');
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error connecting to theme service.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = roleMatch ? roleMatch[2] : null;
    setRole(r);

    if (r === 'super_admin') {
      fetchCompaniesList();
      fetchTheme('super_admin_system');
    } else {
      fetchTheme('company_override');
    }
  }, []);

  const handleModeSwitch = (mode: 'super_admin_system' | 'company_override') => {
    setAdminTargetMode(mode);
    fetchTheme(mode);
  };

  const handleCompanySelectChange = (cid: string) => {
    setSelectedCompanyId(cid);
    fetchTheme('company_override', cid);
  };

  const handleModeChange = (mode: 'dark' | 'light') => {
    const updated: CompanyTheme = {
      ...activeTheme,
      mode,
    };
    setActiveTheme(updated);
    applyThemeToDom(updated);

    // Instant local cache update for reactive multi-tab and navigation consistency
    try {
      const isSystem = role === 'super_admin' && adminTargetMode === 'super_admin_system';
      const targetCid = selectedCompanyId || companyId;
      if (isSystem) {
        localStorage.setItem('super_admin_theme_default', JSON.stringify(updated));
        localStorage.setItem('company_theme_default', JSON.stringify(updated));
      } else if (targetCid) {
        localStorage.setItem(`company_theme_${targetCid}`, JSON.stringify(updated));
      }
    } catch {}
    window.dispatchEvent(new Event('company-theme-changed'));
  };

  const handleSelectPreset = (presetKey: string) => {
    const preset = PREDEFINED_THEMES[presetKey];
    if (preset) {
      const updated: CompanyTheme = {
        ...preset,
        mode: activeTheme.mode || 'dark',
      };
      setActiveTheme(updated);
      applyThemeToDom(updated);

      try {
        const isSystem = role === 'super_admin' && adminTargetMode === 'super_admin_system';
        const targetCid = selectedCompanyId || companyId;
        if (isSystem) {
          localStorage.setItem('super_admin_theme_default', JSON.stringify(updated));
          localStorage.setItem('company_theme_default', JSON.stringify(updated));
        } else if (targetCid) {
          localStorage.setItem(`company_theme_${targetCid}`, JSON.stringify(updated));
        }
      } catch {}
      window.dispatchEvent(new Event('company-theme-changed'));
    }
  };

  const handleCustomChange = (field: keyof CompanyTheme, value: string) => {
    const updated: CompanyTheme = {
      ...activeTheme,
      id: 'custom',
      name: 'Custom Palette',
      [field]: value,
    };
    if (field === 'accentColor') {
      updated.activeBorderColor = value;
      updated.badgeText = value;
    }
    setActiveTheme(updated);
    applyThemeToDom(updated);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSaveSuccess(null);

      if (role === 'super_admin' && adminTargetMode === 'super_admin_system') {
        // Save Super Admin & System Default Theme
        const res = await fetch('/api/system/default-theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: activeTheme }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSavedTheme(data.theme || activeTheme);
          setIsCustom(activeTheme.id !== 'black-cherry');
          setSaveSuccess('Super Admin Dashboard & System Theme saved successfully!');
          try {
            localStorage.setItem('company_theme_default', JSON.stringify(activeTheme));
            localStorage.setItem('super_admin_theme_default', JSON.stringify(activeTheme));
          } catch {}
          window.dispatchEvent(new Event('company-theme-changed'));
          setTimeout(() => setSaveSuccess(null), 3500);
        } else {
          setErrorMsg(data.error || 'Failed to save system default theme.');
        }
      } else {
        // Save Company Theme
        const url = selectedCompanyId && role === 'super_admin'
          ? `/api/companies/theme?companyId=${encodeURIComponent(selectedCompanyId)}`
          : '/api/companies/theme';

        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: activeTheme }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          setSavedTheme(data.theme || activeTheme);
          setIsCustom(true);
          setSaveSuccess(`Theme saved successfully for ${companyName || 'the selected company'}!`);
          try {
            const targetCid = selectedCompanyId || companyId;
            if (targetCid) {
              localStorage.setItem(`company_theme_${targetCid}`, JSON.stringify(activeTheme));
            }
          } catch {}
          window.dispatchEvent(new Event('company-theme-changed'));
          setTimeout(() => setSaveSuccess(null), 3500);
        } else {
          setErrorMsg(data.error || 'Failed to save theme.');
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error saving theme.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetToDefault = async () => {
    const isSystemMode = role === 'super_admin' && adminTargetMode === 'super_admin_system';
    const confirmPrompt = isSystemMode
      ? 'Reset the Super Admin Dashboard and System Default to original Black Cherry?'
      : `Reset ${companyName || 'this company'} to inherit the system default theme?`;

    if (!confirm(confirmPrompt)) {
      return;
    }

    try {
      setIsSaving(true);
      setErrorMsg(null);
      setSaveSuccess(null);

      if (isSystemMode) {
        // Reset system default to Black Cherry
        const res = await fetch('/api/system/default-theme', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: DEFAULT_BLACK_CHERRY_THEME }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setActiveTheme(DEFAULT_BLACK_CHERRY_THEME);
          setSavedTheme(DEFAULT_BLACK_CHERRY_THEME);
          setIsCustom(false);
          applyThemeToDom(DEFAULT_BLACK_CHERRY_THEME);
          try {
            localStorage.setItem('company_theme_default', JSON.stringify(DEFAULT_BLACK_CHERRY_THEME));
          } catch {}
          setSaveSuccess('Super Admin & System Default reset to Black Cherry successfully!');
          window.dispatchEvent(new Event('company-theme-changed'));
          setTimeout(() => setSaveSuccess(null), 3500);
        } else {
          setErrorMsg(data.error || 'Failed to reset system theme.');
        }
      } else {
        // Reset company theme
        const url = selectedCompanyId && role === 'super_admin'
          ? `/api/companies/theme?companyId=${encodeURIComponent(selectedCompanyId)}`
          : '/api/companies/theme';

        const res = await fetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reset' }),
        });

        const data = await res.json();
        if (res.ok && data.success) {
          const defTheme = data.theme || DEFAULT_BLACK_CHERRY_THEME;
          setActiveTheme(defTheme);
          setSavedTheme(defTheme);
          setIsCustom(false);
          applyThemeToDom(defTheme);
          setSaveSuccess('Company reset to system default theme successfully!');
          window.dispatchEvent(new Event('company-theme-changed'));
          setTimeout(() => setSaveSuccess(null), 3500);
        } else {
          setErrorMsg(data.error || 'Failed to reset theme.');
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error resetting theme.');
    } finally {
      setIsSaving(false);
    }
  };

  const isSuperAdmin = role === 'super_admin';
  const hasUnsavedChanges = JSON.stringify(activeTheme) !== JSON.stringify(savedTheme);

  return (
    <div className="space-y-6">
      {/* Super Admin Mode Selector Bar */}
      {isSuperAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-zinc-900 border border-zinc-800 p-3 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-zinc-400 pl-2">
              Theme Management Mode:
            </span>
            <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800">
              <button
                type="button"
                onClick={() => handleModeSwitch('super_admin_system')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  adminTargetMode === 'super_admin_system'
                    ? 'bg-theme-bar border border-theme text-white shadow-md shadow-theme-glow font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Crown className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                <span>Super Admin Dashboard & System Theme</span>
              </button>

              <button
                type="button"
                onClick={() => handleModeSwitch('company_override')}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                  adminTargetMode === 'company_override'
                    ? 'bg-theme-bar border border-theme text-white shadow-md shadow-theme-glow font-black'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                <span>Company Theme Overrides</span>
              </button>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer self-end sm:self-auto"
              title="Close Panel"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div 
              className="flex h-12 w-12 items-center justify-center rounded-2xl border shadow-lg"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
                boxShadow: '0 4px 15px -2px var(--theme-glow, rgba(219,39,119,0.4))'
              }}
            >
              <Palette className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">
                  {isSuperAdmin && adminTargetMode === 'super_admin_system'
                    ? 'Super Admin Dashboard & System Theme'
                    : 'Company Theme Customization'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                    isCustom
                      ? 'border'
                      : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  }`}
                  style={isCustom ? {
                    backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                    color: 'var(--theme-badge-text, #F472B6)',
                    borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))'
                  } : undefined}
                >
                  {isCustom ? `${activeTheme.name} Active` : 'System Default (Black Cherry)'}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-400">
                {isSuperAdmin && adminTargetMode === 'super_admin_system'
                  ? 'Configure the theme used across the Super Admin Dashboard and inherited as the default by new companies.'
                  : "Configure company brand colors, gradient headers, and neon button accents. Changes apply to this company only."}
              </p>

              {/* Target Company Dropdown / Tag */}
              {isSuperAdmin && adminTargetMode === 'company_override' ? (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-bold">Select Company:</span>
                  <select
                    value={selectedCompanyId}
                    onChange={(e) => handleCompanySelectChange(e.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs font-bold text-white outline-none focus:border-theme transition"
                  >
                    {allCompanies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : companyName && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-zinc-300 font-semibold">
                  <Building2 className="h-3.5 w-3.5" style={{ color: 'var(--theme-accent, #DB2777)' }} />
                  <span>Target: <strong className="text-white">{companyName}</strong> ({companyId})</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleResetToDefault}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 px-3.5 py-2 text-xs font-bold text-zinc-300 transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="h-3.5 w-3.5 text-zinc-400" />
              <span>Reset to Default</span>
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-theme-bar hover:opacity-95 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-theme-glow border border-theme transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>
                    {hasUnsavedChanges
                      ? isSuperAdmin && adminTargetMode === 'super_admin_system'
                        ? 'Save Super Admin Theme'
                        : 'Save Company Theme'
                      : 'Theme Saved'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/50 p-3 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-950/50 p-3 text-xs font-semibold text-rose-300 flex items-center gap-2 animate-in fade-in">
            <ShieldAlert className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* 2. Appearance Mode Toggle (Dark Mode vs Light Mode) */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-5 shadow-2xl backdrop-blur-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div 
              className="flex h-11 w-11 items-center justify-center rounded-2xl border shadow-md shrink-0"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)',
              }}
            >
              <SunMoon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Appearance Mode</h3>
                <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 text-[10px] font-bold text-zinc-300 border border-zinc-700 uppercase">
                  {(activeTheme.mode || 'dark')} Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Switch between sleek Dark Mode and high-contrast Light Mode. Applies immediately to all cards, tables, inputs, and navigation.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-zinc-950 p-1.5 border border-zinc-800 shrink-0">
            <button
              type="button"
              onClick={() => handleModeChange('dark')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                (activeTheme.mode || 'dark') === 'dark'
                  ? 'bg-zinc-800 border border-zinc-600 text-white shadow-md font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Moon className="h-4 w-4 text-indigo-400" />
              <span>🌙 Dark Mode</span>
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('light')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                activeTheme.mode === 'light'
                  ? 'bg-white border border-zinc-300 text-zinc-900 shadow-md font-black'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-800/60'
              }`}
            >
              <Sun className="h-4 w-4 text-amber-500" />
              <span>☀️ Light Mode</span>
            </button>
          </div>
        </div>
      </div>

      {/* Five Predefined Themes Grid */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="mb-4">
          <h3 className="text-base font-black text-white flex items-center gap-2">
            <Sparkles className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
            <span>Five Predefined Gradient Themes</span>
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Choose a tailored gradient palette. Your selected theme immediately previews across the application.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3.5">
          {Object.entries(PREDEFINED_THEMES).map(([key, preset]) => {
            const isSelected = activeTheme.id === preset.id;
            return (
              <div
                key={key}
                onClick={() => handleSelectPreset(key)}
                className={`relative flex flex-col justify-between rounded-2xl p-4 cursor-pointer transition-all border select-none ${
                  isSelected
                    ? 'border-theme bg-zinc-950 shadow-xl'
                    : 'border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                }`}
                style={isSelected ? {
                  boxShadow: `0 0 0 2px ${preset.accentColor}33, 0 8px 20px -4px ${preset.glowColor}`,
                } : undefined}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-black text-white">{preset.name}</span>
                    {isSelected && (
                      <span 
                        className="flex h-5 w-5 items-center justify-center rounded-full text-white"
                        style={{ backgroundColor: preset.accentColor }}
                      >
                        <Check className="h-3 w-3 stroke-[3]" />
                      </span>
                    )}
                  </div>

                  {/* Gradient Preview Bar */}
                  <div
                    className="h-10 w-full rounded-xl shadow-inner mb-3 border border-white/10"
                    style={{
                      background: `linear-gradient(135deg, ${preset.gradientStart} 0%, ${preset.gradientMid} 55%, ${preset.gradientEnd} 100%)`,
                    }}
                  />

                  {/* Color Swatch Dots & HEX Labels */}
                  <div className="space-y-1 text-[11px] font-mono text-zinc-400">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-sans uppercase">Start</span>
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.gradientStart }} />
                        <span>{preset.gradientStart}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-sans uppercase">Mid</span>
                      <span className="flex items-center gap-1.5 font-bold">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.gradientMid }} />
                        <span>{preset.gradientMid}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-500 font-sans uppercase">Accent</span>
                      <span className="flex items-center gap-1.5 font-bold" style={{ color: preset.accentColor }}>
                        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: preset.accentColor }} />
                        <span>{preset.accentColor}</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-zinc-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-zinc-500">
                    {key === 'black-cherry' ? 'Default Theme' : 'Predefined'}
                  </span>
                  <span 
                    className="font-bold"
                    style={{ color: isSelected ? 'var(--theme-accent, #DB2777)' : '#a1a1aa' }}
                  >
                    {isSelected ? 'Active' : 'Apply →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Custom Theme Studio */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-2xl backdrop-blur-md">
        <div className="mb-5 flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4" style={{ color: 'var(--theme-accent, #DB2777)' }} />
            <h3 className="text-base font-black text-white">Custom Theme Tuning</h3>
          </div>
          <span className="text-xs font-semibold text-zinc-400">
            Tune HEX values for bespoke brand identity
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gradient Start */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Gradient Dark Start
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeTheme.gradientStart || '#1F0715'}
                onChange={(e) => handleCustomChange('gradientStart', e.target.value)}
                className="h-10 w-12 rounded-xl border border-zinc-700 bg-zinc-950 p-1 cursor-pointer"
              />
              <input
                type="text"
                value={activeTheme.gradientStart || ''}
                onChange={(e) => handleCustomChange('gradientStart', e.target.value)}
                className="h-10 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-mono font-bold text-white uppercase outline-none focus:border-theme"
              />
            </div>
            <p className="text-[10px] text-zinc-500">Base dark background tone</p>
          </div>

          {/* Gradient Mid */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Gradient Mid Hue
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeTheme.gradientMid || '#701A3B'}
                onChange={(e) => handleCustomChange('gradientMid', e.target.value)}
                className="h-10 w-12 rounded-xl border border-zinc-700 bg-zinc-950 p-1 cursor-pointer"
              />
              <input
                type="text"
                value={activeTheme.gradientMid || ''}
                onChange={(e) => handleCustomChange('gradientMid', e.target.value)}
                className="h-10 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-mono font-bold text-white uppercase outline-none focus:border-theme"
              />
            </div>
            <p className="text-[10px] text-zinc-500">Center card & header transition</p>
          </div>

          {/* Gradient End */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Gradient Vivid End
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeTheme.gradientEnd || '#DB2777'}
                onChange={(e) => handleCustomChange('gradientEnd', e.target.value)}
                className="h-10 w-12 rounded-xl border border-zinc-700 bg-zinc-950 p-1 cursor-pointer"
              />
              <input
                type="text"
                value={activeTheme.gradientEnd || ''}
                onChange={(e) => handleCustomChange('gradientEnd', e.target.value)}
                className="h-10 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-mono font-bold text-white uppercase outline-none focus:border-theme"
              />
            </div>
            <p className="text-[10px] text-zinc-500">Bright end of header & card gradients</p>
          </div>

          {/* Accent Color */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Primary Neon Accent
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={activeTheme.accentColor || '#DB2777'}
                onChange={(e) => handleCustomChange('accentColor', e.target.value)}
                className="h-10 w-12 rounded-xl border border-zinc-700 bg-zinc-950 p-1 cursor-pointer"
              />
              <input
                type="text"
                value={activeTheme.accentColor || ''}
                onChange={(e) => handleCustomChange('accentColor', e.target.value)}
                className="h-10 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-mono font-bold text-white uppercase outline-none focus:border-theme"
              />
            </div>
            <p className="text-[10px] text-zinc-500">Active rings, indicators, and buttons</p>
          </div>
        </div>

        {/* Live Preview Card */}
        <div className="mt-6 pt-5 border-t border-zinc-800">
          <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3">
            Live Preview (How your selection will look across the billing software)
          </label>

          <div
            className="rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden border"
            style={{
              background: `linear-gradient(135deg, ${activeTheme.gradientStart} 0%, ${activeTheme.gradientMid} 55%, ${activeTheme.gradientEnd} 100%)`,
              borderColor: activeTheme.activeBorderColor || activeTheme.accentColor,
              boxShadow: `0 10px 30px -5px ${activeTheme.glowColor || 'rgba(0,0,0,0.5)'}`,
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider border shadow-sm"
                  style={{
                    backgroundColor: activeTheme.badgeBg || 'rgba(255,255,255,0.15)',
                    color: activeTheme.badgeText || '#fff',
                    borderColor: activeTheme.accentColor,
                  }}
                >
                  <span>Live Theme Preview</span>
                  <span className="opacity-60">•</span>
                  <span>{activeTheme.mode === 'light' ? '☀️ Light Mode' : '🌙 Dark Mode'}</span>
                </span>
                <h4 className="text-xl font-black text-white tracking-tight mt-2">
                  {companyName || 'System'} • {activeTheme.name}
                </h4>
                <p className="text-xs text-white/80 mt-1 max-w-md">
                  This gradient will be applied on the Dashboard, Terminal Header, KOT Kitchen screen, Tables, and Delivery Management.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-xs font-black text-white shadow-lg transition active:scale-95"
                  style={{
                    background: `linear-gradient(90deg, ${activeTheme.gradientMid} 0%, ${activeTheme.gradientEnd} 100%)`,
                    boxShadow: `0 4px 15px -2px ${activeTheme.glowColor || 'rgba(0,0,0,0.4)'}`,
                    border: `1px solid ${activeTheme.accentColor}80`,
                  }}
                >
                  Action Button
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
