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

  // Persistence metadata
  isLoaded: boolean;
  isSaving: boolean;
  isCustom: boolean;
  activeCompanyId: string;

  // Actions
  updateDesign: (updates: Partial<Omit<TerminalDesignState, 'updateDesign' | 'resetDesign' | 'fetchCompanyTerminalDesign' | 'saveToDatabase' | 'resetInDatabase'>>) => void;
  resetDesign: () => void;
  fetchCompanyTerminalDesign: (companyId?: string) => Promise<void>;
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

  // Metadata
  isLoaded: false,
  isSaving: false,
  isCustom: false,
  activeCompanyId: '',
};

function broadcastDesignChange(state: Partial<TerminalDesignState>) {
  if (typeof window !== 'undefined') {
    try {
      window.dispatchEvent(new CustomEvent('terminal-design-changed', { detail: state }));
      localStorage.setItem('terminal_design_broadcast_ts', Date.now().toString());
    } catch {}
  }
}

export const useTerminalDesignStore = create<TerminalDesignState>()(
  persist(
    (set, get) => ({
      ...initialDesignState,

      updateDesign: (updates) => {
        set((state) => {
          const next = { ...state, ...updates };
          broadcastDesignChange(next);
          return next;
        });
      },

      resetDesign: () => {
        set(() => {
          broadcastDesignChange(initialDesignState);
          return { ...initialDesignState, isLoaded: true };
        });
      },

      fetchCompanyTerminalDesign: async (companyId?: string) => {
        try {
          const url = companyId
            ? `/api/companies/terminal-design?companyId=${encodeURIComponent(companyId)}`
            : '/api/companies/terminal-design';

          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.success && data.design) {
              set((state) => ({
                ...state,
                ...data.design,
                isLoaded: true,
                isCustom: !!data.isCustom,
                activeCompanyId: data.companyId || state.activeCompanyId,
              }));
              broadcastDesignChange(data.design);
            }
          }
        } catch (err) {
          console.warn('Failed to fetch company terminal design:', err);
          set((state) => ({ ...state, isLoaded: true }));
        }
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
            set({ isSaving: false, isCustom: true });
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
            set(() => ({
              ...initialDesignState,
              isLoaded: true,
              isSaving: false,
              isCustom: false,
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
      migrate: (persistedState: any) => ({
        ...initialDesignState,
        ...(persistedState as any),
      }),
    }
  )
);
