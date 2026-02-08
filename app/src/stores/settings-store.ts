import { create } from "zustand";

interface SettingsState {
  anthropicApiKey: string | null;
  githubRepo: string | null;
  workspacePath: string | null;
  autoCommit: boolean;
  autoPush: boolean;
  isConfigured: boolean;
  setSettings: (settings: Partial<Omit<SettingsState, "isConfigured" | "setSettings" | "reset">>) => void;
  reset: () => void;
}

const initialState = {
  anthropicApiKey: null,
  githubRepo: null,
  workspacePath: null,
  autoCommit: false,
  autoPush: false,
  isConfigured: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialState,
  setSettings: (settings) =>
    set((state) => {
      const next = { ...state, ...settings };
      return {
        ...next,
        isConfigured: !!(next.anthropicApiKey && next.githubRepo),
      };
    }),
  reset: () => set(initialState),
}));
