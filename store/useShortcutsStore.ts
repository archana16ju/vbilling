import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  StoredShortcutConfig,
  getDefaultStoredShortcutsConfig,
  ALL_SHORTCUT_DEFINITIONS,
  matchesKeyboardEvent,
  findShortcutConflict,
} from '@/lib/shortcuts-config';

interface ShortcutsState {
  config: StoredShortcutConfig;
  isCustom: boolean;
  activeCompanyId: string;
  isLoaded: boolean;
  isHelpModalOpen: boolean;

  // Modal actions
  openHelpModal: () => void;
  closeHelpModal: () => void;
  toggleHelpModal: () => void;

  // Config modifier actions
  setShowKeysOnButtons: (show: boolean) => void;
  toggleActionEnabled: (actionId: string, enabled?: boolean) => void;
  setActionKey: (
    actionId: string,
    keyIndex: number,
    newKey: string
  ) => { success: boolean; conflictMessage?: string };
  addActionKey: (
    actionId: string,
    newKey: string
  ) => { success: boolean; conflictMessage?: string };
  removeActionKey: (actionId: string, keyIndex: number) => void;
  resetAction: (actionId: string) => void;
  resetAll: () => void;

  // Remote persistence
  fetchCompanyShortcuts: (companyId?: string) => Promise<void>;
  saveToDatabase: (companyId?: string) => Promise<{ success: boolean; error?: string }>;
  resetInDatabase: (companyId?: string) => Promise<{ success: boolean; error?: string }>;

  // Matcher & visual getters
  isActionTriggered: (actionId: string, e: KeyboardEvent) => boolean;
  getActionDisplayKey: (actionId: string) => string | null;
}

export const useShortcutsStore = create<ShortcutsState>()(
  persist(
    (set, get) => ({
      config: getDefaultStoredShortcutsConfig(),
      isCustom: false,
      activeCompanyId: '',
      isLoaded: false,
      isHelpModalOpen: false,

      openHelpModal: () => set({ isHelpModalOpen: true }),
      closeHelpModal: () => set({ isHelpModalOpen: false }),
      toggleHelpModal: () => set((s) => ({ isHelpModalOpen: !s.isHelpModalOpen })),

      setShowKeysOnButtons: (show: boolean) =>
        set((state) => ({
          config: {
            ...state.config,
            showKeysOnButtons: show,
          },
        })),

      toggleActionEnabled: (actionId: string, enabled?: boolean) =>
        set((state) => {
          const current = state.config.actions[actionId] || { enabled: true, keys: [] };
          const nextEnabled = enabled !== undefined ? enabled : !current.enabled;
          return {
            config: {
              ...state.config,
              actions: {
                ...state.config.actions,
                [actionId]: {
                  ...current,
                  enabled: nextEnabled,
                },
              },
            },
          };
        }),

      setActionKey: (actionId: string, keyIndex: number, newKey: string) => {
        const state = get();
        const conflict = findShortcutConflict(state.config, actionId, newKey);
        if (conflict) {
          return {
            success: false,
            conflictMessage: `Shortcut '${newKey}' is already assigned to '${conflict.conflictActionLabel}'. Please select another key.`,
          };
        }

        const currentAction = state.config.actions[actionId] || { enabled: true, keys: [] };
        const newKeys = [...currentAction.keys];
        if (keyIndex >= 0 && keyIndex < newKeys.length) {
          newKeys[keyIndex] = newKey;
        } else {
          newKeys.push(newKey);
        }

        set({
          config: {
            ...state.config,
            actions: {
              ...state.config.actions,
              [actionId]: {
                ...currentAction,
                keys: newKeys,
              },
            },
          },
        });
        return { success: true };
      },

      addActionKey: (actionId: string, newKey: string) => {
        const state = get();
        const conflict = findShortcutConflict(state.config, actionId, newKey);
        if (conflict) {
          return {
            success: false,
            conflictMessage: `Shortcut '${newKey}' is already assigned to '${conflict.conflictActionLabel}'. Please select another key.`,
          };
        }

        const currentAction = state.config.actions[actionId] || { enabled: true, keys: [] };
        if (currentAction.keys.includes(newKey)) {
          return { success: true };
        }

        set({
          config: {
            ...state.config,
            actions: {
              ...state.config.actions,
              [actionId]: {
                ...currentAction,
                keys: [...currentAction.keys, newKey],
              },
            },
          },
        });
        return { success: true };
      },

      removeActionKey: (actionId: string, keyIndex: number) => {
        const state = get();
        const currentAction = state.config.actions[actionId];
        if (!currentAction || currentAction.keys.length <= 1) return;

        const newKeys = currentAction.keys.filter((_, idx) => idx !== keyIndex);
        set({
          config: {
            ...state.config,
            actions: {
              ...state.config.actions,
              [actionId]: {
                ...currentAction,
                keys: newKeys,
              },
            },
          },
        });
      },

      resetAction: (actionId: string) => {
        const def = ALL_SHORTCUT_DEFINITIONS.find((d) => d.id === actionId);
        if (!def) return;
        set((state) => ({
          config: {
            ...state.config,
            actions: {
              ...state.config.actions,
              [actionId]: {
                enabled: true,
                keys: [...def.defaultKeys],
              },
            },
          },
        }));
      },

      resetAll: () => {
        set({ config: getDefaultStoredShortcutsConfig(), isCustom: false });
      },

      fetchCompanyShortcuts: async (companyId?: string) => {
        try {
          const url = companyId
            ? `/api/companies/shortcuts?companyId=${encodeURIComponent(companyId)}`
            : '/api/companies/shortcuts';
          const res = await fetch(url, { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && data.config) {
              set({
                config: data.config,
                isCustom: !!data.isCustom,
                activeCompanyId: data.companyId || companyId || '',
                isLoaded: true,
              });
            }
          }
        } catch (e) {
          console.warn('Failed to fetch company shortcuts, using cached/default:', e);
        }
      },

      saveToDatabase: async (companyId?: string) => {
        const state = get();
        try {
          const res = await fetch('/api/companies/shortcuts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              companyId: companyId || state.activeCompanyId,
              config: state.config,
            }),
          });
          const data = await res.json();
          if (data && data.success) {
            set({ isCustom: true });
            return { success: true };
          }
          return { success: false, error: data?.error || 'Failed to save shortcuts' };
        } catch (err: any) {
          return { success: false, error: err.message || 'Network error saving shortcuts' };
        }
      },

      resetInDatabase: async (companyId?: string) => {
        const state = get();
        try {
          const res = await fetch('/api/companies/shortcuts', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'reset',
              companyId: companyId || state.activeCompanyId,
            }),
          });
          const data = await res.json();
          if (data && data.success) {
            set({
              config: data.config || getDefaultStoredShortcutsConfig(),
              isCustom: false,
            });
            return { success: true };
          }
          return { success: false, error: data?.error || 'Failed to reset shortcuts' };
        } catch (err: any) {
          return { success: false, error: err.message || 'Network error resetting shortcuts' };
        }
      },

      isActionTriggered: (actionId: string, e: KeyboardEvent) => {
        const state = get();
        const action = state.config.actions[actionId];
        if (!action || !action.enabled) return false;

        for (const pattern of action.keys || []) {
          if (matchesKeyboardEvent(e, pattern)) {
            return true;
          }
        }
        return false;
      },

      getActionDisplayKey: (actionId: string) => {
        const state = get();
        if (!state.config.showKeysOnButtons) return null;
        const action = state.config.actions[actionId];
        if (!action || !action.enabled || !action.keys || action.keys.length === 0) {
          return null;
        }
        return action.keys[0];
      },
    }),
    {
      name: 'pos-shortcuts-storage',
      version: 1,
    }
  )
);
