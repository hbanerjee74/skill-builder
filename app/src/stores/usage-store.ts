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
  hideCancelled: boolean;

  fetchUsage: () => Promise<void>;
  resetCounter: () => Promise<void>;
  toggleHideCancelled: () => void;
}

export const useUsageStore = create<UsageState>((set, get) => ({
  summary: null,
  recentSessions: [],
  byStep: [],
  byModel: [],
  loading: false,
  error: null,
  hideCancelled: false,

  fetchUsage: async () => {
    const { hideCancelled } = get();
    set({ loading: true, error: null });
    try {
      const [summary, recentSessions, byStep, byModel] = await Promise.all([
        getUsageSummary(hideCancelled),
        getRecentWorkflowSessions(50, hideCancelled),
        getUsageByStep(hideCancelled),
        getUsageByModel(hideCancelled),
      ]);
      set({ summary, recentSessions, byStep, byModel, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  resetCounter: async () => {
    const { hideCancelled } = get();
    set({ loading: true, error: null });
    try {
      await resetUsage();
      const [summary, recentSessions, byStep, byModel] = await Promise.all([
        getUsageSummary(hideCancelled),
        getRecentWorkflowSessions(50, hideCancelled),
        getUsageByStep(hideCancelled),
        getUsageByModel(hideCancelled),
      ]);
      set({ summary, recentSessions, byStep, byModel, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  toggleHideCancelled: () => {
    const next = !get().hideCancelled;
    set({ hideCancelled: next });
    // Re-fetch with the new filter
    get().fetchUsage();
  },
}));
