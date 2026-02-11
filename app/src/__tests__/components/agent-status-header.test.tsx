import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAgentStore } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { AgentStatusHeader } from "@/components/agent-status-header";

describe("AgentStatusHeader", () => {
  beforeEach(() => {
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  it("returns null when no run exists", () => {
    const { container } = render(<AgentStatusHeader agentId="test-agent" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders status and model badges for a running agent", () => {
    useAgentStore.getState().startRun("test-agent", "sonnet");
    render(<AgentStatusHeader agentId="test-agent" />);

    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText("Sonnet")).toBeInTheDocument();
  });

  it("shows Thinking badge when extendedThinking is enabled", () => {
    useAgentStore.getState().startRun("test-agent", "sonnet");
    useSettingsStore.getState().setSettings({ extendedThinking: true });
    render(<AgentStatusHeader agentId="test-agent" />);

    expect(screen.getByText("Thinking")).toBeInTheDocument();
  });

  it("does NOT show Thinking badge when extendedThinking is disabled", () => {
    useAgentStore.getState().startRun("test-agent", "sonnet");
    useSettingsStore.getState().setSettings({ extendedThinking: false });
    render(<AgentStatusHeader agentId="test-agent" />);

    expect(screen.queryByText("Thinking")).not.toBeInTheDocument();
  });

  it("shows cost badge when totalCost is available", () => {
    useAgentStore.getState().startRun("test-agent", "opus");
    useAgentStore.getState().addMessage("test-agent", {
      type: "result",
      content: "Done",
      raw: {
        usage: { input_tokens: 1500, output_tokens: 500 },
        total_cost_usd: 0.042,
      },
      timestamp: Date.now(),
    });
    render(<AgentStatusHeader agentId="test-agent" />);

    expect(screen.getByText("$0.0420")).toBeInTheDocument();
    expect(screen.getByText("2,000 tokens")).toBeInTheDocument();
  });
});
