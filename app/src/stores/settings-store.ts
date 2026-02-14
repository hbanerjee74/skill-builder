import { create } from "zustand";
import type { McpServerConfig } from "@/lib/types";

interface SettingsState {
  anthropicApiKey: string | null;
  workspacePath: string | null;
  skillsPath: string | null;
  preferredModel: string | null;
  debugMode: boolean;
  logLevel: string;
  extendedContext: boolean;
  extendedThinking: boolean;
  githubOauthToken: string | null;
  githubUserLogin: string | null;
  githubUserAvatar: string | null;
  githubUserEmail: string | null;
  mcpServers: McpServerConfig[];
  isConfigured: boolean;
  setSettings: (settings: Partial<Omit<SettingsState, "isConfigured" | "setSettings" | "reset" | "addMcpServer" | "updateMcpServer" | "removeMcpServer">>) => void;
  addMcpServer: (server: McpServerConfig) => void;
  updateMcpServer: (name: string, server: McpServerConfig) => void;
  removeMcpServer: (name: string) => void;
  reset: () => void;
}

const initialState = {
  anthropicApiKey: null,
  workspacePath: null,
  skillsPath: null,
  preferredModel: null,
  debugMode: false,
  logLevel: "info",
  extendedContext: false,
  extendedThinking: false,
  githubOauthToken: null,
  githubUserLogin: null,
  githubUserAvatar: null,
  githubUserEmail: null,
  mcpServers: [],
  isConfigured: false,
};

export const useSettingsStore = create<SettingsState>((set) => ({
  ...initialState,
  setSettings: (settings) =>
    set((state) => {
      const next = { ...state, ...settings };
      return {
        ...next,
        isConfigured: !!next.anthropicApiKey,
      };
    }),
  addMcpServer: (server) =>
    set((state) => ({ mcpServers: [...state.mcpServers, server] })),
  updateMcpServer: (name, server) =>
    set((state) => ({
      mcpServers: state.mcpServers.map((s) => (s.name === name ? server : s)),
    })),
  removeMcpServer: (name) =>
    set((state) => ({
      mcpServers: state.mcpServers.filter((s) => s.name !== name),
    })),
  reset: () => set(initialState),
}));
