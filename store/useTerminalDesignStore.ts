import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TerminalDesignState {
  // Main display layout
  displayStyle: 'default' | 'image-grid' | 'compact-grid' | 'search-based';

  // Grid layout options
  gridColumns: number; // 2, 3, 4, 5
  cardAspectRatio: '4/3' | '1/1' | '16/10' | '3/2';
  cardRadius: 'rounded-lg' | 'rounded-xl' | 'rounded-2xl' | 'rounded-3xl';
  cardGap: 'gap-2' | 'gap-3' | 'gap-4' | 'gap-6';

  // Product Name & Price options
  namePlacement: 'bottom-gradient' | 'top-badge' | 'bottom-bar' | 'none';
  pricePlacement: 'bottom-right' | 'bottom-left' | 'top-right';
  priceStyle: 'dark-navy' | 'theme-accent' | 'glass' | 'white';

  // Themes and colors
  themePreset: 'black-cherry' | 'ocean-blue' | 'royal-purple' | 'emerald-green' | 'sunset-orange' | 'custom' | string;
  themeMode: 'dark' | 'light' | 'system';
  accentColor: string;
  activeBorderColor: string;
  bannerBgColor: string;
  bannerTextColor: string;

  // Tap Mode Banner
  showTapBanner: boolean;
  tapBannerText: string;
  tapBannerBadgeText: string;

  // Currency & Badges
  currencySymbol: string;
  showCartBadge: boolean;
  quickDoubleTap: boolean;

  // Category Design options
  categoryStyle: 'card-tile' | 'compact-list' | 'grid-2col';
  categoryCardHeight: 'h-20' | 'h-24' | 'h-28';
  categoryThumbnailShape: 'rounded-full' | 'rounded-xl' | 'rounded-lg';
  showCategoryCount: boolean;
  categorySearchPlaceholder: string;
  isFixedCategorySection: boolean;
  categoryVisibleCount: number;

  // Persistence metadata
  isLoaded: boolean;
  isFetching: boolean;
  isSaving: boolean;
  isCustom: boolean;
  activeCompanyId: string;

  // Actions
  updateDesign: (updates: Partial<Omit<TerminalDesignState, 'updateDesign' | 'resetDesign' | 'fetchCompanyTerminalDesign' | 'saveToDatabase' | 'resetInDatabase'>>) => void;
  resetDesign: () => void;
  fetchCompanyTerminalDesign: (companyId?: string, force?: boolean) => Promise<void>;
  saveToDatabase: (companyId?: string) => Promise<{ success: boolean; error?: string }>;
  resetInDatabase: (companyId?: string) => Promise<{ success: boolean; error?: string }>;
}

export const THEME_PRESETS: Record<string, { label: string; accentColor: string; activeBorderColor: string; bannerBgColor: string }> = {
  'black-cherry': {
    label: 'Black Cherry (Default)',
    accentColor: '#DB2777',
    activeBorderColor: '#DB2777',
    bannerBgColor: '#1F0715',
  },
  'ocean-blue': {
    label: 'Ocean Blue',
    accentColor: '#0284C7',
    activeBorderColor: '#38BDF8',
    bannerBgColor: '#031726',
  },
  'royal-purple': {
    label: 'Royal Purple',
    accentColor: '#8B5CF6',
    activeBorderColor: '#A78BFA',
    bannerBgColor: '#12072B',
  },
  'emerald-green': {
    label: 'Emerald Green',
    accentColor: '#10B981',
    activeBorderColor: '#34D399',
    bannerBgColor: '#042014',
  },
  'sunset-orange': {
    label: 'Sunset Orange',
    accentColor: '#EA580C',
    activeBorderColor: '#FB923C',
    bannerBgColor: '#260B03',
  },
};

const initialDesignState: Omit<
  TerminalDesignState,
  'updateDesign' | 'resetDesign' | 'fetchCompanyTerminalDesign' | 'saveToDatabase' | 'resetInDatabase'
> = {
  // Existing default design is preserved as default
  displayStyle: 'default',

  // Grid layout defaults for modern visual grid
  gridColumns: 4,
  cardAspectRatio: '4/3',
  cardRadius: 'rounded-2xl',
  cardGap: 'gap-4',

  // Product Name & Price placement
  namePlacement: 'bottom-gradient',
  pricePlacement: 'bottom-right',
  priceStyle: 'dark-navy',

  // Default Theme is Black Cherry (preserving exact HEX values)
  themePreset: 'black-cherry',
  themeMode: 'dark',
  accentColor: '#DB2777',
  activeBorderColor: '#DB2777',
  bannerBgColor: '#1F0715',
  bannerTextColor: '#f4f4f5',

  // Tap banner settings
  showTapBanner: true,
  tapBannerText: 'Tap to Add to Cart • Double-tap to +1 Qty',
  tapBannerBadgeText: 'TAP MODE ACTIVE',

  // Currency & interactions
  currencySymbol: '₹',
  showCartBadge: true,
  quickDoubleTap: true,

  // Category design defaults
  categoryStyle: 'card-tile',
  categoryCardHeight: 'h-24',
  categoryThumbnailShape: 'rounded-full',
  showCategoryCount: true,
  categorySearchPlaceholder: 'Search category...',
  isFixedCategorySection: false,
  categoryVisibleCount: 4,

  // Metadata
  isLoaded: false,
  isFetching: false,
  isSaving: false,
  isCustom: false,
  activeCompanyId: '',
};

function broadcastDesignChange(state: Partial<TerminalDesignState>) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('terminal-design-changed', { detail: state }));
      localStorage.setItem('terminal_design_broadcast_ts', Date.now().toString());
    } catch { }
  }
}

// In-flight request tracking
let inFlightFetchPromise: Promise<void> | null = null;
let inFlightCompanyId: string | undefined = undefined;
let fetchRequestId = 0;

export const useTerminalDesignStore = create<TerminalDesignState>()(
  persist(
    (set, get) => ({
      ...initialDesignState,

      updateDesign: (updates) => {
        set((state) => ({ ...state, ...updates }));
        broadcastDesignChange(updates);
      },

      resetDesign: () => {
        set(() => {
          broadcastDesignChange(initialDesignState);
          return { ...initialDesignState, isLoaded: true };
        });
      },

      fetchCompanyTerminalDesign: async (companyId?: string, force = false) => {
        const requestId = ++fetchRequestId;
        const state = get();
        const cookieCompanyId =
          typeof document !== 'undefined'
            ? document.cookie.match(/(^| )auth_company_id=([^;]+)/)?.[2] || ''
            : '';
        const targetCompanyId = companyId || cookieCompanyId;

        // 1. Skip redundant fetch if already loaded for this company (unless force reload is requested)
        if (!force && state.isLoaded && !state.isFetching) {
          if (targetCompanyId && state.activeCompanyId === targetCompanyId) {
            return;
          }
          if (!targetCompanyId && state.activeCompanyId) {
            return;
          }
        }

        // 2. Request deduplication: reuse active promise if a fetch for the same target is already in flight
        if (inFlightFetchPromise && inFlightCompanyId === targetCompanyId && !force) {
          return inFlightFetchPromise;
        }

        set({ isFetching: true });
        inFlightCompanyId = targetCompanyId;

        inFlightFetchPromise = (async () => {
          try {
            const url = targetCompanyId
              ? `/api/companies/terminal-design?companyId=${encodeURIComponent(targetCompanyId)}`
              : '/api/companies/terminal-design';

            const res = await fetch(url, { cache: 'no-store' });

            if (requestId !== fetchRequestId) return;

            if (res.ok) {
              const data = await res.json();

              if (requestId !== fetchRequestId) return;
              if (data && data.success && data.design) {
                set((s) => ({
                  ...s,
                  ...data.design,
                  isLoaded: true,
                  isFetching: false,
                  isCustom: !!data.isCustom,
                  activeCompanyId: data.companyId || targetCompanyId || s.activeCompanyId,
                }));
              } else {
                set({
                  ...initialDesignState,
                  isLoaded: true,
                  isFetching: false,
                  activeCompanyId: targetCompanyId || '',
                });
              }
            } else {
              set({
                ...initialDesignState,
                isLoaded: true,
                isFetching: false,
                activeCompanyId: targetCompanyId || '',
              });
            }
          } catch (err) {
            console.warn('Failed to fetch company terminal design:', err);
            set({
              ...initialDesignState,
              isLoaded: true,
              isFetching: false,
              activeCompanyId: targetCompanyId || '',
            });
          } finally {
            if (requestId === fetchRequestId) {
              inFlightFetchPromise = null;
              inFlightCompanyId = undefined;
            }
          }
        })();

        return inFlightFetchPromise;
      },

      saveToDatabase: async (companyId?: string) => {
        set({ isSaving: true });
        try {
          const state = get();
          const designPayload = {
            displayStyle: state.displayStyle,
            gridColumns: state.gridColumns,
            cardAspectRatio: state.cardAspectRatio,
            cardRadius: state.cardRadius,
            cardGap: state.cardGap,
            namePlacement: state.namePlacement,
            pricePlacement: state.pricePlacement,
            priceStyle: state.priceStyle,
            themePreset: state.themePreset,
            themeMode: state.themeMode || 'dark',
            accentColor: state.accentColor,
            activeBorderColor: state.activeBorderColor,
            bannerBgColor: state.bannerBgColor,
            bannerTextColor: state.bannerTextColor,
            showTapBanner: state.showTapBanner,
            tapBannerText: state.tapBannerText,
            tapBannerBadgeText: state.tapBannerBadgeText,
            currencySymbol: state.currencySymbol,
            showCartBadge: state.showCartBadge,
            quickDoubleTap: state.quickDoubleTap,
            categoryStyle: state.categoryStyle || 'card-tile',
            categoryCardHeight: state.categoryCardHeight || 'h-24',
            categoryThumbnailShape: state.categoryThumbnailShape || 'rounded-full',
            showCategoryCount: state.showCategoryCount ?? true,
            categorySearchPlaceholder: state.categorySearchPlaceholder || 'Search category...',
            isFixedCategorySection: state.isFixedCategorySection ?? false,
            categoryVisibleCount: state.categoryVisibleCount || 4,
          };

          const res = await fetch('/api/companies/terminal-design', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId,
              design: designPayload,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            set((s) => ({
              ...s,
              ...designPayload,
              isSaving: false,
              isCustom: true,
              activeCompanyId: data.companyId || companyId || s.activeCompanyId,
            }));
            broadcastDesignChange(designPayload);
            return { success: true };
          } else {
            set({ isSaving: false });
            return { success: false, error: data.error || 'Failed to save terminal design' };
          }
        } catch (err: any) {
          set({ isSaving: false });
          return { success: false, error: err.message || 'Network error while saving terminal design' };
        }
      },

      resetInDatabase: async (companyId?: string) => {
        set({ isSaving: true });
        try {
          const res = await fetch('/api/companies/terminal-design', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'reset',
              companyId,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            set((s) => ({
              ...s,
              ...initialDesignState,
              isLoaded: true,
              isSaving: false,
              isCustom: false,
              activeCompanyId: data.companyId || companyId || s.activeCompanyId,
            }));
            broadcastDesignChange(initialDesignState);
            return { success: true };
          } else {
            set({ isSaving: false });
            return { success: false, error: data.error || 'Failed to reset terminal design' };
          }
        } catch (err: any) {
          set({ isSaving: false });
          return { success: false, error: err.message || 'Network error while resetting terminal design' };
        }
      },
    }),
    {
      name: 'terminal-design-storage',
      version: 2,
      partialize: (state) => {
        // Exclude transient in-flight states & isLoaded flag from storage so server updates always re-validate
        const { isFetching, isSaving, isLoaded, ...rest } = state;
        return rest;
      },
      migrate: (persistedState: any) => ({
        ...initialDesignState,
        ...(persistedState as any),
        isLoaded: false,
        isFetching: false,
        isSaving: false,
      }),
    }
  )
);

// Cross-tab and window reactive synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('terminal-design-changed', (e: any) => {
    if (e?.detail) {
      useTerminalDesignStore.setState((s) => ({ ...s, ...e.detail }));
    }
  });

  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === 'terminal_design_broadcast_ts' || e.key === 'terminal-design-storage') {
      useTerminalDesignStore.getState().fetchCompanyTerminalDesign(undefined, true);
    }
  });
}
