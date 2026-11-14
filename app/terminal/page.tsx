'use client';
import { useState, useEffect } from 'react';
import TerminalHeader from '@/components/terminal/TerminalHeader';
import CategoryPanel from '@/components/terminal/CategoryPanel';
import ProductPanel from '@/components/terminal/ProductPanel';
import CartPanel from '@/components/terminal/CartPanel';
import { useTerminalDesignStore, THEME_PRESETS } from '@/store/useTerminalDesignStore';
import { useTerminalStore } from '@/store/useTerminalStore';
import { applyThemeToDom as applyCompanyThemeToDom, DEFAULT_BLACK_CHERRY_THEME } from '@/lib/theme-config';
import { getPromotions } from '@/lib/actions/promotions';

/* Resolve the effective dark/light mode, honouring 'system' via matchMedia */
function resolveEffectiveMode(themeMode: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  // 'system' — follow OS preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'dark'; // SSR fallback
}

/* Apply effective mode to the DOM (html + body classes and data-theme) */
function applyThemeToDom(effectiveMode: 'dark' | 'light', settingMode?: string) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', effectiveMode);
  if (settingMode) root.setAttribute('data-theme-setting', settingMode);
  root.style.setProperty('--theme-mode', effectiveMode);
  if (effectiveMode === 'light') {
    root.classList.add('light-mode');
    root.classList.remove('dark-mode', 'dark');
    if (document.body) {
      document.body.setAttribute('data-theme', 'light');
      document.body.classList.add('light-mode');
      document.body.classList.remove('dark-mode', 'dark');
    }
  } else {
    root.classList.add('dark-mode', 'dark');
    root.classList.remove('light-mode');
    if (document.body) {
      document.body.setAttribute('data-theme', 'dark');
      document.body.classList.add('dark-mode', 'dark');
      document.body.classList.remove('light-mode');
    }
  }
}

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const design = useTerminalDesignStore();
  const terminalModeOverride = useTerminalStore((s) => s.terminalModeOverride);
  const terminalThemeMode = useTerminalStore((s) => (s as any).terminalThemeMode);

  // Initial fetch and restore persisted terminal mode
  useEffect(() => {
    setMounted(true);
    try {
      const stored = (localStorage.getItem('terminal_theme_mode') || localStorage.getItem('dashboard_theme_mode') || 'system') as 'dark' | 'light' | 'system';
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        const store = useTerminalStore.getState();
        if (store.setTerminalThemeMode) store.setTerminalThemeMode(stored);
        if (store.setTerminalModeOverride) store.setTerminalModeOverride(stored);
        const resolved = resolveEffectiveMode(stored);
        applyThemeToDom(resolved, stored);
      }
    } catch {}
    design.fetchCompanyTerminalDesign(undefined, true);
    getPromotions()
      .then((promos) => {
        if (Array.isArray(promos)) {
          useTerminalStore.getState().setPromotions(promos);
        }
      })
      .catch((err) => console.warn('Terminal getPromotions notice:', err));
  }, []);

  // Listen for OS system theme changes and dashboard theme switches
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
      const currentStored = (useTerminalStore.getState().terminalThemeMode || localStorage.getItem('terminal_theme_mode') || localStorage.getItem('dashboard_theme_mode') || 'system') as 'dark' | 'light' | 'system';
      if (currentStored === 'system') {
        const nextEffective = e.matches ? 'dark' : 'light';
        applyThemeToDom(nextEffective, 'system');
      }
    };
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    const handleDashboardThemeEvent = (e: any) => {
      const mode = e?.detail?.mode;
      if (mode === 'light' || mode === 'dark' || mode === 'system') {
        const store = useTerminalStore.getState();
        if (store.setTerminalThemeMode) store.setTerminalThemeMode(mode);
        if (store.setTerminalModeOverride) store.setTerminalModeOverride(mode);
        const resolved = resolveEffectiveMode(mode);
        applyThemeToDom(resolved, mode);
      }
    };
    window.addEventListener('dashboard-theme-mode-changed', handleDashboardThemeEvent);

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
      window.removeEventListener('dashboard-theme-mode-changed', handleDashboardThemeEvent);
    };
  }, []);

  // Restore dashboard company theme when leaving terminal interface
  useEffect(() => {
    return () => {
      try {
        const activeCid = document.cookie.match(/(^| )auth_company_id=([^;]+)/)?.[2] || '';
        const cached = localStorage.getItem(activeCid ? `company_theme_${activeCid}` : 'company_theme_default');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.gradientStart) {
            applyCompanyThemeToDom(parsed, true);
            return;
          }
        }
        applyCompanyThemeToDom(DEFAULT_BLACK_CHERRY_THEME, true);
      } catch {}
    };
  }, []);

  // ── Derive effective mode (Honours 'system', 'light', and 'dark') ──
  const rawMode: 'dark' | 'light' | 'system' = mounted
    ? (terminalThemeMode || terminalModeOverride || (typeof window !== 'undefined' ? (localStorage.getItem('terminal_theme_mode') || localStorage.getItem('dashboard_theme_mode') as any) : null) || 'system')
    : 'dark';
  const effectiveMode = resolveEffectiveMode(rawMode);
  const isLight = effectiveMode === 'light';

  // ── Sync theme + accent colors to DOM ──────────────────────────────────────
  useEffect(() => {
    applyThemeToDom(effectiveMode, rawMode);

    if (!mounted) return;

    // Apply CSS custom properties for accent / border / glow + gradients
    const root = document.documentElement;
    if (design.accentColor) {
      root.style.setProperty('--theme-accent', design.accentColor);
      root.style.setProperty('--theme-active-border', design.activeBorderColor || design.accentColor);
      root.style.setProperty('--theme-badge-bg', `${design.accentColor}26`);
      root.style.setProperty('--theme-badge-text', design.accentColor);
      root.style.setProperty('--theme-glow', `${design.accentColor}73`);

      // Resolve gradient vars from named preset or derive from accent color
      const preset = design.themePreset ? THEME_PRESETS[design.themePreset] : null;
      if (preset) {
        const gradientMap: Record<string, [string, string, string]> = {
          'black-cherry':   ['#1F0715', '#701A3B', '#DB2777'],
          'ocean-blue':     ['#031726', '#0C4A6E', '#0284C7'],
          'royal-purple':   ['#12072B', '#4C1D95', '#8B5CF6'],
          'emerald-green':  ['#042014', '#065F46', '#10B981'],
          'sunset-orange':  ['#260B03', '#7C2D12', '#EA580C'],
        };
        const [gs, gm, ge] = gradientMap[design.themePreset] || [design.accentColor, design.accentColor, design.accentColor];
        root.style.setProperty('--theme-gradient-start', gs);
        root.style.setProperty('--theme-gradient-mid', gm);
        root.style.setProperty('--theme-gradient-end', ge);
      } else {
        root.style.setProperty('--theme-gradient-start', design.accentColor);
        root.style.setProperty('--theme-gradient-mid', design.accentColor);
        root.style.setProperty('--theme-gradient-end', design.accentColor);
      }
    }

    // ── Live-follow OS preference changes when in 'system' mode and without cashier override ─────────────
    if (terminalModeOverride || design.themeMode !== 'system' || typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeToDom(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mounted, effectiveMode, design.themeMode, design.accentColor, design.activeBorderColor, terminalModeOverride]);

  return (
    <main
      data-theme={effectiveMode}
      className={`flex h-screen flex-col overflow-hidden transition-colors duration-150 ${
        isLight ? 'bg-slate-50 text-zinc-900 light-mode' : 'bg-zinc-950 text-white dark-mode'
      }`}
    >
      <TerminalHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Enlarged Category Section with rich image cards and overlay labels */}
        <div className={`hidden shrink-0 lg:block transition-all duration-200 ${design.categoryStyle === 'grid-2col' ? 'w-56 xl:w-64' : 'w-40'}`}>
          <CategoryPanel />
        </div>

        <div className={`flex-1 overflow-hidden border-l ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
          <ProductPanel />
        </div>

        <div className={`w-[330px] shrink-0 border-l xl:w-[320px] ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`}>
          <CartPanel />
        </div>
      </div>
    </main>
  );
}
