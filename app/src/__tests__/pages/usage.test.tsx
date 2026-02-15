import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { resetTauriMocks } from "@/test/mocks/tauri";
import { useUsageStore } from "@/stores/usage-store";
import type { UsageSummary, AgentRunRecord, UsageByStep, UsageByModel } from "@/lib/types";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock the tauri functions used by usage-store
vi.mock("@/lib/tauri", () => ({
  getUsageSummary: vi.fn(() => Promise.resolve({ total_cost: 0, total_runs: 0, avg_cost_per_run: 0 })),
  getRecentRuns: vi.fn(() => Promise.resolve([])),
  getUsageByStep: vi.fn(() => Promise.resolve([])),
  getUsageByModel: vi.fn(() => Promise.resolve([])),
  resetUsage: vi.fn(() => Promise.resolve()),
}));

import UsagePage from "@/pages/usage";

const mockSummary: UsageSummary = {
  total_cost: 12.5678,
  total_runs: 42,
  avg_cost_per_run: 0.2992,
};

const mockByStep: UsageByStep[] = [
  { step_id: 1, step_name: "Research Concepts", total_cost: 3.5, run_count: 10 },
  { step_id: 5, step_name: "Reasoning", total_cost: 6.0, run_count: 8 },
  { step_id: 6, step_name: "Build", total_cost: 2.0, run_count: 5 },
];

const mockByModel: UsageByModel[] = [
  { model: "claude-sonnet-4-520250514", total_cost: 5.5, run_count: 20 },
  { model: "claude-opus-4-20250514", total_cost: 7.0, run_count: 12 },
];

const mockRecentRuns: AgentRunRecord[] = [
  {
    agent_id: "agent-1",
    skill_name: "my-skill",
    step_id: 1,
    model: "claude-sonnet-4-520250514",
    status: "completed",
    input_tokens: 12450,
    output_tokens: 3200,
    cache_read_tokens: 5000,
    cache_write_tokens: 1500,
    total_cost: 0.0523,
    duration_ms: 45000,
    session_id: null,
    started_at: new Date(Date.now() - 120000).toISOString(), // 2 min ago
    completed_at: new Date(Date.now() - 75000).toISOString(),
  },
  {
    agent_id: "agent-2",
    skill_name: "another-skill",
    step_id: 5,
    model: "claude-opus-4-20250514",
    status: "completed",
    input_tokens: 50000,
    output_tokens: 8000,
    cache_read_tokens: 20000,
    cache_write_tokens: 3000,
    total_cost: 1.2345,
    duration_ms: 180000,
    session_id: null,
    started_at: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    completed_at: new Date(Date.now() - 3420000).toISOString(),
  },
];

function setStoreData(overrides?: {
  summary?: UsageSummary | null;
  recentRuns?: AgentRunRecord[];
  byStep?: UsageByStep[];
  byModel?: UsageByModel[];
  loading?: boolean;
  error?: string | null;
}) {
  useUsageStore.setState({
    summary: overrides?.summary !== undefined ? overrides.summary : mockSummary,
    recentRuns: overrides?.recentRuns ?? mockRecentRuns,
    byStep: overrides?.byStep ?? mockByStep,
    byModel: overrides?.byModel ?? mockByModel,
    loading: overrides?.loading ?? false,
    error: overrides?.error ?? null,
    fetchUsage: vi.fn(() => Promise.resolve()),
    resetCounter: vi.fn(() => Promise.resolve()),
  });
}

describe("UsagePage", () => {
  beforeEach(() => {
    resetTauriMocks();
    // Reset to default populated state
    setStoreData();
  });

  it("renders summary cards with correct values", () => {
    render(<UsagePage />);

    expect(screen.getByText("Usage")).toBeInTheDocument();
    expect(screen.getByTestId("total-cost")).toHaveTextContent("$12.57");
    expect(screen.getByTestId("total-runs")).toHaveTextContent("42");
    expect(screen.getByTestId("avg-cost")).toHaveTextContent("$0.2992");
  });

  it("renders cost-by-step breakdown", () => {
    render(<UsagePage />);

    expect(screen.getByText("Cost by Step")).toBeInTheDocument();
    // Step names may appear multiple times (in breakdown and in recent runs badges),
    // so use getAllByText to verify they exist
    expect(screen.getAllByText("Research Concepts").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Reasoning").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Build").length).toBeGreaterThanOrEqual(1);
    // Check cost text is rendered (unique to the breakdown section)
    expect(screen.getByText(/\$3\.5000 \(10 runs\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$6\.0000 \(8 runs\)/)).toBeInTheDocument();
  });

  it("renders cost-by-model breakdown", () => {
    render(<UsagePage />);

    expect(screen.getByText("Cost by Model")).toBeInTheDocument();
    // Model names may appear multiple times (in breakdown and in recent runs badges)
    expect(screen.getAllByText("claude-sonnet-4-520250514").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("claude-opus-4-20250514").length).toBeGreaterThanOrEqual(1);
    // Cost text is unique to the breakdown section
    expect(screen.getByText(/\$5\.5000 \(20 runs\)/)).toBeInTheDocument();
    expect(screen.getByText(/\$7\.0000 \(12 runs\)/)).toBeInTheDocument();
  });

  it("renders recent runs list", () => {
    render(<UsagePage />);

    expect(screen.getByText("Recent Runs")).toBeInTheDocument();
    expect(screen.getByText("my-skill")).toBeInTheDocument();
    expect(screen.getByText("another-skill")).toBeInTheDocument();
    // Step badges
    const conceptsBadges = screen.getAllByText("Research Concepts");
    expect(conceptsBadges.length).toBeGreaterThanOrEqual(1);
    const reasoningBadges = screen.getAllByText("Reasoning");
    expect(reasoningBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("expanding a run shows token details", async () => {
    const user = userEvent.setup();
    render(<UsagePage />);

    // Find expand button for first run
    const expandButton = screen.getByLabelText(/Toggle details for my-skill Research Concepts run/);
    expect(expandButton).toHaveAttribute("aria-expanded", "false");

    await user.click(expandButton);

    expect(expandButton).toHaveAttribute("aria-expanded", "true");

    const details = screen.getByTestId("run-details-0");
    expect(details).toBeInTheDocument();
    expect(details).toHaveTextContent("12,450");
    expect(details).toHaveTextContent("3,200");
    expect(details).toHaveTextContent("5,000");
    expect(details).toHaveTextContent("1,500");
    expect(details).toHaveTextContent("45s");
  });

  it("reset button shows confirmation dialog", async () => {
    const user = userEvent.setup();
    render(<UsagePage />);

    const resetButton = screen.getByRole("button", { name: /Reset/i });
    await user.click(resetButton);

    await waitFor(() => {
      expect(screen.getByText("Reset Usage Data")).toBeInTheDocument();
      expect(screen.getByText(/permanently delete all usage tracking data/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reset All Data/i })).toBeInTheDocument();
    });
  });

  it("calls resetCounter when confirmation is accepted", async () => {
    const mockResetCounter = vi.fn(() => Promise.resolve());
    useUsageStore.setState({ resetCounter: mockResetCounter });

    const user = userEvent.setup();
    render(<UsagePage />);

    const resetButton = screen.getByRole("button", { name: /Reset/i });
    await user.click(resetButton);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reset All Data/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /Reset All Data/i }));

    await waitFor(() => {
      expect(mockResetCounter).toHaveBeenCalled();
    });
  });

  it("empty state shows when no data", () => {
    setStoreData({
      summary: { total_cost: 0, total_runs: 0, avg_cost_per_run: 0 },
      recentRuns: [],
      byStep: [],
      byModel: [],
    });
    render(<UsagePage />);

    expect(screen.getByText("No usage data yet.")).toBeInTheDocument();
    expect(screen.getByText("Run an agent to start tracking costs.")).toBeInTheDocument();
  });

  it("loading state renders correctly", () => {
    setStoreData({ loading: true });
    render(<UsagePage />);

    const spinner = document.querySelector(".animate-spin");
    expect(spinner).toBeInTheDocument();
    // Should not show any data
    expect(screen.queryByText("Total Spent")).not.toBeInTheDocument();
  });

  it("error state shows error message", () => {
    setStoreData({ error: "Database connection failed" });
    render(<UsagePage />);

    expect(screen.getByText(/Failed to load usage data:/)).toBeInTheDocument();
    expect(screen.getByText(/Database connection failed/)).toBeInTheDocument();
  });

  it("calls fetchUsage on mount", () => {
    const mockFetchUsage = vi.fn(() => Promise.resolve());
    useUsageStore.setState({ fetchUsage: mockFetchUsage });
    render(<UsagePage />);

    expect(mockFetchUsage).toHaveBeenCalled();
  });

  it("collapsing an expanded run hides token details", async () => {
    const user = userEvent.setup();
    render(<UsagePage />);

    const expandButton = screen.getByLabelText(/Toggle details for my-skill Research Concepts run/);

    // Expand
    await user.click(expandButton);
    expect(screen.getByTestId("run-details-0")).toBeInTheDocument();

    // Collapse
    await user.click(expandButton);
    expect(screen.queryByTestId("run-details-0")).not.toBeInTheDocument();
    expect(expandButton).toHaveAttribute("aria-expanded", "false");
  });

  it("shows null summary as zero values", () => {
    setStoreData({
      summary: null,
      recentRuns: [],
    });
    render(<UsagePage />);

    // null summary with no runs triggers empty state
    expect(screen.getByText("No usage data yet.")).toBeInTheDocument();
  });
});
