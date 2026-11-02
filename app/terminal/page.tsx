'use client';
import { useState, useEffect } from 'react';
import TerminalHeader from '@/components/terminal/TerminalHeader';
import CategoryPanel from '@/components/terminal/CategoryPanel';
import ProductPanel from '@/components/terminal/ProductPanel';
import CartPanel from '@/components/terminal/CartPanel';
import { useTerminalDesignStore, THEME_PRESETS } from '@/store/useTerminalDesignStore';

/* Resolve the effective dark/light mode, honouring 'system' via matchMedia */
function resolveEffectiveMode(themeMode: 'dark' | 'light' | 'system'): 'dark' | 'light' {
  if (themeMode === 'light') return 'light';
  if (themeMode === 'dark') return 'dark';
  // 'system' — follow OS preference
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark'; // SSR fallback
}

/* Apply effective mode to the DOM (html + body classes and data-theme) */
function applyThemeToDom(effectiveMode: 'dark' | 'light') {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.setAttribute('data-theme', effectiveMode);
  if (effectiveMode === 'light') {
    root.classList.add('light-mode');
    root.classList.remove('dark-mode', 'dark');
    document.body.setAttribute('data-theme', 'light');
    document.body.classList.add('light-mode');
    document.body.classList.remove('dark-mode', 'dark');
  } else {
    root.classList.add('dark-mode', 'dark');
    root.classList.remove('light-mode');
    document.body.setAttribute('data-theme', 'dark');
    document.body.classList.add('dark-mode', 'dark');
    document.body.classList.remove('light-mode');
  }
}

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const design = useTerminalDesignStore();

  // Initial fetch
  useEffect(() => {
    setMounted(true);
    design.fetchCompanyTerminalDesign(undefined, true);
  }, []);

  // ── Sync theme + accent colors to DOM ──────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;

    const effectiveMode = resolveEffectiveMode(design.themeMode);
    applyThemeToDom(effectiveMode);

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
        // Use preset's canonical gradient from Black Cherry default mapping
        // Each preset uses its own start/mid/end derived from known brand values
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
        // Custom / unknown preset: use accent for all three
        root.style.setProperty('--theme-gradient-start', design.accentColor);
        root.style.setProperty('--theme-gradient-mid', design.accentColor);
        root.style.setProperty('--theme-gradient-end', design.accentColor);
      }
    }

    // ── Live-follow OS preference changes when in 'system' mode ─────────────
    if (design.themeMode !== 'system' || typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handleChange = (e: MediaQueryListEvent) => {
      applyThemeToDom(e.matches ? 'light' : 'dark');
    };
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, [mounted, design.themeMode, design.accentColor, design.activeBorderColor]);

  // ── Derive isLight for JSX (client-only after mount) ──────────────────────
  const effectiveMode = mounted ? resolveEffectiveMode(design.themeMode) : 'dark';
  const isLight = effectiveMode === 'light';

  return (
    <main
      data-theme={effectiveMode}
      className={`flex h-screen flex-col overflow-hidden transition-colors duration-150 ${
        isLight ? 'bg-slate-50 text-zinc-900 light-mode' : 'bg-zinc-950 text-white dark-mode'
      }`}
    >
      <TerminalHeader />

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-64 shrink-0 lg:block">
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