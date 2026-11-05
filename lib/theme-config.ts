export interface CompanyTheme {
  id: 'black-cherry' | 'ocean-blue' | 'royal-purple' | 'emerald-green' | 'sunset-orange' | 'custom' | string;
  name: string;
  mode?: 'dark' | 'light';
  gradientStart: string;
  gradientMid: string;
  gradientEnd: string;
  accentColor: string;
  accentHover: string;
  glowColor: string;
  activeBorderColor: string;
  badgeBg: string;
  badgeText: string;
}

export const DEFAULT_BLACK_CHERRY_THEME: CompanyTheme = {
  id: 'black-cherry',
  name: 'Black Cherry',
  mode: 'dark',
  gradientStart: '#1F0715',
  gradientMid: '#701A3B',
  gradientEnd: '#DB2777',
  accentColor: '#DB2777',
  accentHover: '#BE185D',
  glowColor: 'rgba(219, 39, 119, 0.45)',
  activeBorderColor: '#DB2777',
  badgeBg: 'rgba(219, 39, 119, 0.15)',
  badgeText: '#F472B6',
};

export const PREDEFINED_THEMES: Record<string, CompanyTheme> = {
  'black-cherry': DEFAULT_BLACK_CHERRY_THEME,
  'ocean-blue': {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    mode: 'dark',
    gradientStart: '#031726',
    gradientMid: '#0A436D',
    gradientEnd: '#0284C7',
    accentColor: '#0284C7',
    accentHover: '#0369A1',
    glowColor: 'rgba(2, 132, 199, 0.45)',
    activeBorderColor: '#38BDF8',
    badgeBg: 'rgba(2, 132, 199, 0.15)',
    badgeText: '#38BDF8',
  },
  'royal-purple': {
    id: 'royal-purple',
    name: 'Royal Purple',
    mode: 'dark',
    gradientStart: '#12072B',
    gradientMid: '#3B1A70',
    gradientEnd: '#8B5CF6',
    accentColor: '#8B5CF6',
    accentHover: '#7C3AED',
    glowColor: 'rgba(139, 92, 246, 0.45)',
    activeBorderColor: '#A78BFA',
    badgeBg: 'rgba(139, 92, 246, 0.15)',
    badgeText: '#C4B5FD',
  },
  'emerald-green': {
    id: 'emerald-green',
    name: 'Emerald Green',
    mode: 'dark',
    gradientStart: '#042014',
    gradientMid: '#0E4D30',
    gradientEnd: '#10B981',
    accentColor: '#10B981',
    accentHover: '#059669',
    glowColor: 'rgba(16, 185, 129, 0.45)',
    activeBorderColor: '#34D399',
    badgeBg: 'rgba(16, 185, 129, 0.15)',
    badgeText: '#6EE7B7',
  },
  'sunset-orange': {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    mode: 'dark',
    gradientStart: '#260B03',
    gradientMid: '#662408',
    gradientEnd: '#EA580C',
    accentColor: '#EA580C',
    accentHover: '#C2410C',
    glowColor: 'rgba(234, 88, 12, 0.45)',
    activeBorderColor: '#FB923C',
    badgeBg: 'rgba(234, 88, 12, 0.15)',
    badgeText: '#FDBA74',
  },
};

/**
 * Injects CSS custom properties into document.documentElement so all modules
 * immediately re-render using the active company theme and appearance mode.
 */
export function applyThemeToDom(theme?: Partial<CompanyTheme> | null, forceApplyMode: boolean = false) {
  if (typeof document === 'undefined') return;

  const t = {
    ...DEFAULT_BLACK_CHERRY_THEME,
    ...(theme || {}),
  };

  const root = document.documentElement;
  const isTerminal = !forceApplyMode && typeof window !== 'undefined' && window.location.pathname.startsWith('/terminal');

  // If on terminal and not forced, DO NOT overwrite terminal's own independent dark/light mode with dashboard mode!
  if (!isTerminal) {
    const mode = t.mode === 'light' ? 'light' : 'dark';
    root.setAttribute('data-theme', mode);
    if (mode === 'light') {
      root.classList.add('light-mode');
      root.classList.remove('dark-mode');
      root.classList.remove('dark');
      if (document.body) {
        document.body.setAttribute('data-theme', 'light');
        document.body.classList.add('light-mode');
        document.body.classList.remove('dark-mode');
        document.body.classList.remove('dark');
      }
    } else {
      root.classList.add('dark-mode');
      root.classList.add('dark');
      root.classList.remove('light-mode');
      if (document.body) {
        document.body.setAttribute('data-theme', 'dark');
        document.body.classList.add('dark-mode');
        document.body.classList.add('dark');
        document.body.classList.remove('light-mode');
      }
    }
    root.style.setProperty('--theme-mode', mode);
  }

  // Always apply company theme color vars and gradients across both Dashboard and Terminal
  root.style.setProperty('--theme-gradient-start', t.gradientStart);
  root.style.setProperty('--theme-gradient-mid', t.gradientMid);
  root.style.setProperty('--theme-gradient-end', t.gradientEnd);
  root.style.setProperty('--theme-accent', t.accentColor);
  root.style.setProperty('--theme-accent-hover', t.accentHover || t.accentColor);
  root.style.setProperty('--theme-glow', t.glowColor || 'rgba(219, 39, 119, 0.45)');
  root.style.setProperty('--theme-active-border', t.activeBorderColor || t.accentColor);
  root.style.setProperty('--theme-badge-bg', t.badgeBg || 'rgba(219, 39, 119, 0.15)');
  root.style.setProperty('--theme-badge-text', t.badgeText || t.accentColor);
}
