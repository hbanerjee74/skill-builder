import { create } from "zustand";
import type { UsageSummary, WorkflowSessionRecord, UsageByStep, UsageByModel } from "@/lib/types";
import { getUsageSummary, getRecentWorkflowSessions, getUsageByStep, getUsageByModel, resetUsage } from "@/lib/tauri";

interface UsageState {
  summary: UsageSummary | null;
  recentSessions: WorkflowSessionRecord[];
  byStep: UsageByStep[];
  byModel: UsageByModel[];
  loading: boolean;
  error: string | null;

  fetchUsage: () => Promise<void>;
  resetCounter: () => Promise<void>;
}

export const useUsageStore = create<UsageState>((set) => ({
  summary: null,
  recentSessions: [],
  byStep: [],
  byModel: [],
  loading: false,
  error: null,

  fetchUsage: async () => {
    set({ loading: true, error: null });
    try {
      const [summary, recentSessions, byStep, byModel] = await Promise.all([
        getUsageSummary(),
        getRecentWorkflowSessions(50),
        getUsageByStep(),
        getUsageByModel(),
      ]);
      set({ summary, recentSessions, byStep, byModel, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  resetCounter: async () => {
    set({ loading: true, error: null });
    try {
      await resetUsage();
      const [summary, recentSessions, byStep, byModel] = await Promise.all([
        getUsageSummary(),
        getRecentWorkflowSessions(50),
        getUsageByStep(),
        getUsageByModel(),
      ]);
      set({ summary, recentSessions, byStep, byModel, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
