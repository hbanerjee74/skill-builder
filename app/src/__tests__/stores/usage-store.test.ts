import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockInvoke } from "@/test/mocks/tauri";
import { useUsageStore } from "@/stores/usage-store";
import type { UsageSummary, AgentRunRecord, UsageByStep, UsageByModel } from "@/lib/types";

const mockSummary: UsageSummary = {
  total_cost: 1.25,
  total_runs: 10,
  avg_cost_per_run: 0.125,
};

const mockRuns: AgentRunRecord[] = [
  {
    agent_id: "agent-1",
    skill_name: "my-skill",
    step_id: 0,
    model: "sonnet",
    status: "completed",
    input_tokens: 5000,
    output_tokens: 1000,
    cache_read_tokens: 3000,
    cache_write_tokens: 500,
    total_cost: 0.05,
    duration_ms: 12000,
    session_id: "sess-1",
    started_at: "2026-02-15T10:00:00Z",
    completed_at: "2026-02-15T10:00:12Z",
  },
];

const mockByStep: UsageByStep[] = [
  { step_id: 0, step_name: "Research Concepts", total_cost: 0.50, run_count: 3 },
  { step_id: 2, step_name: "Perform Research", total_cost: 0.75, run_count: 5 },
];

const mockByModel: UsageByModel[] = [
  { model: "sonnet", total_cost: 0.80, run_count: 6 },
  { model: "opus", total_cost: 0.45, run_count: 4 },
];

function setupInvokeMock() {
  mockInvoke.mockImplementation((cmd: string) => {
    switch (cmd) {
      case "get_usage_summary":
        return Promise.resolve(mockSummary);
      case "get_recent_runs":
        return Promise.resolve(mockRuns);
      case "get_usage_by_step":
        return Promise.resolve(mockByStep);
      case "get_usage_by_model":
        return Promise.resolve(mockByModel);
      case "reset_usage":
        return Promise.resolve();
      default:
        return Promise.reject(new Error(`Unmocked command: ${cmd}`));
    }
  });
}

describe("useUsageStore", () => {
  beforeEach(() => {
    useUsageStore.setState({
      summary: null,
      recentRuns: [],
      byStep: [],
      byModel: [],
      loading: false,
      error: null,
    });
    mockInvoke.mockReset();
  });

  it("has correct initial state", () => {
    const state = useUsageStore.getState();
    expect(state.summary).toBeNull();
    expect(state.recentRuns).toEqual([]);
    expect(state.byStep).toEqual([]);
    expect(state.byModel).toEqual([]);
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  describe("fetchUsage", () => {
    it("loads all data and sets loading states", async () => {
      setupInvokeMock();

      const fetchPromise = useUsageStore.getState().fetchUsage();

      // loading should be true while fetching
      expect(useUsageStore.getState().loading).toBe(true);
      expect(useUsageStore.getState().error).toBeNull();

      await fetchPromise;

      const state = useUsageStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.summary).toEqual(mockSummary);
      expect(state.recentRuns).toEqual(mockRuns);
      expect(state.byStep).toEqual(mockByStep);
      expect(state.byModel).toEqual(mockByModel);
    });

    it("calls all four Tauri commands", async () => {
      setupInvokeMock();

      await useUsageStore.getState().fetchUsage();

      const calledCommands = mockInvoke.mock.calls.map((c) => c[0]);
      expect(calledCommands).toContain("get_usage_summary");
      expect(calledCommands).toContain("get_recent_runs");
      expect(calledCommands).toContain("get_usage_by_step");
      expect(calledCommands).toContain("get_usage_by_model");
    });

    it("passes limit to get_recent_runs", async () => {
      setupInvokeMock();

      await useUsageStore.getState().fetchUsage();

      const recentRunsCall = mockInvoke.mock.calls.find((c) => c[0] === "get_recent_runs");
      expect(recentRunsCall).toBeDefined();
      expect(recentRunsCall![1]).toEqual({ limit: 50 });
    });

    it("sets error state on failure", async () => {
      mockInvoke.mockRejectedValue(new Error("DB connection failed"));

      await useUsageStore.getState().fetchUsage();

      const state = useUsageStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe("Error: DB connection failed");
      expect(state.summary).toBeNull();
    });
  });

  describe("resetCounter", () => {
    it("calls resetUsage and refetches all data", async () => {
      setupInvokeMock();

      await useUsageStore.getState().resetCounter();

      const calledCommands = mockInvoke.mock.calls.map((c) => c[0]);
      expect(calledCommands).toContain("reset_usage");
      expect(calledCommands).toContain("get_usage_summary");
      expect(calledCommands).toContain("get_recent_runs");
      expect(calledCommands).toContain("get_usage_by_step");
      expect(calledCommands).toContain("get_usage_by_model");

      const state = useUsageStore.getState();
      expect(state.summary).toEqual(mockSummary);
      expect(state.recentRuns).toEqual(mockRuns);
      expect(state.byStep).toEqual(mockByStep);
      expect(state.byModel).toEqual(mockByModel);
    });

    it("calls reset_usage before refetching", async () => {
      setupInvokeMock();

      await useUsageStore.getState().resetCounter();

      // reset_usage should be called first
      const firstCall = mockInvoke.mock.calls[0][0];
      expect(firstCall).toBe("reset_usage");
    });

    it("propagates errors from resetUsage", async () => {
      mockInvoke.mockRejectedValue(new Error("Reset failed"));

      await expect(useUsageStore.getState().resetCounter()).rejects.toThrow("Reset failed");
    });
  });
});
