'use client';

import { useEffect } from 'react';
import { applyThemeToDom, DEFAULT_BLACK_CHERRY_THEME, CompanyTheme } from '@/lib/theme-config';
import { useTerminalDesignStore } from '@/store/useTerminalDesignStore';

export default function CompanyThemeLoader() {
  const updateDesign = useTerminalDesignStore((state) => state.updateDesign);

  useEffect(() => {
    let currentCompanyId = '';

    const getCookieCompanyId = () => {
      const match = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
      return match ? match[2] : '';
    };

    const loadTheme = async () => {
      const activeCid = getCookieCompanyId();
      currentCompanyId = activeCid;

      const roleMatch = document.cookie.match(/(^| )auth_role=([^;]+)/);
      const userRole = roleMatch ? roleMatch[2] : '';
      const isSuperAdminDashboard = userRole === 'super_admin' && (typeof window !== 'undefined' && window.location.pathname.startsWith('/super-admin'));

      // 1. Instant cache check to avoid flash of unstyled theme
      const cacheKey = isSuperAdminDashboard
        ? 'super_admin_theme_default'
        : (activeCid ? `company_theme_${activeCid}` : 'company_theme_default');
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.gradientStart) {
            applyThemeToDom(parsed);
          }
        }
      } catch {}

      // 2. Fetch authoritative theme from database API
      try {
        const endpoint = isSuperAdminDashboard ? '/api/system/default-theme' : '/api/companies/theme';
        const res = await fetch(endpoint, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.theme) {
            const theme: CompanyTheme = data.theme;
            applyThemeToDom(theme);

            // Sync with terminal design store for product grid highlights
            updateDesign({
              accentColor: theme.accentColor,
              activeBorderColor: theme.activeBorderColor,
              bannerBgColor: theme.gradientStart,
              themePreset: (theme.id as any) || 'custom',
            });

            // Cache per-company or for super admin
            try {
              localStorage.setItem(cacheKey, JSON.stringify(theme));
            } catch {}
          }
        }
      } catch (err) {
        // Fallback to Black Cherry default
        applyThemeToDom(DEFAULT_BLACK_CHERRY_THEME);
      }

      // 3. Fetch authoritative terminal design for this company
      try {
        await useTerminalDesignStore.getState().fetchCompanyTerminalDesign();
      } catch {}
    };

    loadTheme();

    // Listen for custom company switch, theme change, or terminal design change events
    const handleThemeChange = () => {
      loadTheme();
    };

    const handleDesignChange = () => {
      useTerminalDesignStore.getState().fetchCompanyTerminalDesign();
    };

    // Check periodically for company cookie switch (e.g. from company switcher dropdown)
    const interval = setInterval(() => {
      const cid = getCookieCompanyId();
      if (cid !== currentCompanyId) {
        loadTheme();
      }
    }, 1500);

    window.addEventListener('company-theme-changed', handleThemeChange);
    window.addEventListener('terminal-design-changed', handleDesignChange);
    window.addEventListener('focus', handleThemeChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('company-theme-changed', handleThemeChange);
      window.removeEventListener('terminal-design-changed', handleDesignChange);
      window.removeEventListener('focus', handleThemeChange);
    };
  }, [updateDesign]);

  return null;
}
