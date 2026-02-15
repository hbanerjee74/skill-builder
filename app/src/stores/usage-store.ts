import { create } from "zustand";
import type { UsageSummary, AgentRunRecord, UsageByStep, UsageByModel } from "@/lib/types";
import { getUsageSummary, getRecentRuns, getUsageByStep, getUsageByModel, resetUsage } from "@/lib/tauri";

interface UsageState {
  summary: UsageSummary | null;
  recentRuns: AgentRunRecord[];
  byStep: UsageByStep[];
  byModel: UsageByModel[];
  loading: boolean;
  error: string | null;

  fetchUsage: () => Promise<void>;
  resetCounter: () => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  recentRuns: [],
  byStep: [],
  byModel: [],
  loading: false,
  error: null,

  fetchUsage: async () => {
    set({ loading: true, error: null });
    try {
      const [summary, recentRuns, byStep, byModel] = await Promise.all([
        getUsageSummary(),
        getRecentRuns(50),
        getUsageByStep(),
        getUsageByModel(),
      ]);
      set({ summary, recentRuns, byStep, byModel, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  resetCounter: async () => {
    set({ loading: true, error: null });
    try {
      await resetUsage();
      const [summary, recentRuns, byStep, byModel] = await Promise.all([
        getUsageSummary(),
        getRecentRuns(50),
        getUsageByStep(),
        getUsageByModel(),
      ]);
      set({ summary, recentRuns, byStep, byModel, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
