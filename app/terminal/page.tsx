'use client';
import { useState, useEffect } from 'react';
import TerminalHeader from "@/components/terminal/TerminalHeader"
import CategoryPanel from "@/components/terminal/CategoryPanel"
import ProductPanel from "@/components/terminal/ProductPanel"
import CartPanel from "@/components/terminal/CartPanel"
import { useTerminalDesignStore } from '@/store/useTerminalDesignStore';

export default function TerminalPage() {
  const [mounted, setMounted] = useState(false);
  const design = useTerminalDesignStore();

  useEffect(() => {
    setMounted(true);
    design.fetchCompanyTerminalDesign(undefined, true);
  }, []);

  // Sync DOM with terminal themeMode and custom accent/border colors
  useEffect(() => {
    if (!mounted || typeof document === 'undefined') return;
    const root = document.documentElement;

    const currentDocTheme = root.getAttribute('data-theme') || (root.classList.contains('light-mode') ? 'light' : 'dark');
    const effectiveMode =
      design.themeMode === 'light'
        ? 'light'
        : design.themeMode === 'dark'
          ? 'dark'
          : currentDocTheme;

    root.setAttribute('data-theme', effectiveMode);
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

    // Apply terminal design custom colors to CSS variables
    if (design.accentColor) {
      root.style.setProperty('--theme-accent', design.accentColor);
      root.style.setProperty('--theme-active-border', design.activeBorderColor || design.accentColor);
      root.style.setProperty('--theme-badge-bg', `${design.accentColor}26`);
      root.style.setProperty('--theme-badge-text', design.accentColor);
      root.style.setProperty('--theme-glow', `${design.accentColor}73`);
    }
  }, [mounted, design.themeMode, design.accentColor, design.activeBorderColor]);

  const effectiveThemeMode =
    design.themeMode === 'light'
      ? 'light'
      : design.themeMode === 'dark'
        ? 'dark'
        : (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  const isLight = effectiveThemeMode === 'light';

  return (
    <main
      className={`flex h-screen flex-col overflow-hidden transition-colors duration-150 ${isLight ? 'bg-slate-50 text-zinc-900 light-mode' : 'bg-zinc-950 text-white dark-mode'
        }`}
      data-theme={effectiveThemeMode}
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