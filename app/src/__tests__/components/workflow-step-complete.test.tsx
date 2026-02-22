import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { AgentRunRecord } from "@/lib/types";

// Mock tauri before importing the component
const mockGetStepAgentRuns = vi.fn();
const mockReadFile = vi.fn();

vi.mock("@/lib/tauri", () => ({
  getStepAgentRuns: (...args: unknown[]) => mockGetStepAgentRuns(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Mock react-markdown to avoid ESM issues in tests
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
vi.mock("remark-gfm", () => ({ default: () => {} }));

import { WorkflowStepComplete } from "@/components/workflow-step-complete";

function makeRun(totalCost: number): AgentRunRecord {
  return {
    agent_id: "agent-1",
    skill_name: "my-skill",
    step_id: 0,
    model: "claude-sonnet-4-5",
    status: "completed",
    stop_reason: "end_turn",
    input_tokens: 100,
    output_tokens: 50,
    cache_read_tokens: 0,
    cache_write_tokens: 0,
    total_cost: totalCost,
    duration_ms: 1000,
    duration_api_ms: 900,
    num_turns: 2,
    tool_use_count: 3,
    compaction_count: 0,
    workflow_session_id: "session-1",
    created_at: "2024-01-01T00:00:00Z",
  };
}

const baseProps = {
  stepName: "Research",
  stepId: 0,
  outputFiles: [],
  skillName: "my-skill",
  skillsPath: "/skills",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockReadFile.mockResolvedValue(null);
});

describe("WorkflowStepComplete — cost display", () => {
  it("shows cost from DB in non-review mode", async () => {
    mockGetStepAgentRuns.mockResolvedValue([makeRun(0.042)]);

    render(<WorkflowStepComplete {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText(/\$0\.0420/)).toBeInTheDocument();
    });
    expect(mockGetStepAgentRuns).toHaveBeenCalledWith("my-skill", 0);
  });

  it("sums multiple agent runs for the step cost", async () => {
    mockGetStepAgentRuns.mockResolvedValue([makeRun(0.03), makeRun(0.015)]);

    render(<WorkflowStepComplete {...baseProps} />);

    await waitFor(() => {
      expect(screen.getByText(/\$0\.0450/)).toBeInTheDocument();
    });
  });

  it("falls back to cost prop when DB returns empty (race window)", async () => {
    mockGetStepAgentRuns.mockResolvedValue([]);

    render(<WorkflowStepComplete {...baseProps} cost={0.025} />);

    await waitFor(() => {
      expect(screen.getByText(/\$0\.0250/)).toBeInTheDocument();
    });
  });

  it("shows no cost when DB returns empty and no cost prop", async () => {
    mockGetStepAgentRuns.mockResolvedValue([]);

    render(<WorkflowStepComplete {...baseProps} />);

    // Wait for the async DB load to settle, then confirm no cost badge shown
    await waitFor(() => {
      expect(mockGetStepAgentRuns).toHaveBeenCalled();
    });
    expect(screen.queryByText(/\$0\./)).not.toBeInTheDocument();
  });

  it("does not show AgentStatsBar in non-review mode", async () => {
    mockGetStepAgentRuns.mockResolvedValue([makeRun(0.042)]);

    render(<WorkflowStepComplete {...baseProps} />);

    await waitFor(() => {
      expect(mockGetStepAgentRuns).toHaveBeenCalled();
    });
    // AgentStatsBar has a "Cost" label in its summary row — should not appear
    expect(screen.queryByText("Cost")).not.toBeInTheDocument();
  });

  it("loads agent runs in review mode too", async () => {
    mockGetStepAgentRuns.mockResolvedValue([makeRun(0.042)]);

    render(<WorkflowStepComplete {...baseProps} reviewMode />);

    await waitFor(() => {
      expect(mockGetStepAgentRuns).toHaveBeenCalledWith("my-skill", 0);
    });
    // Cost is shown from DB data even in review mode's fallback center view
    expect(screen.getByText(/\$0\.0420/)).toBeInTheDocument();
  });
});
