import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAgentStore } from "@/stores/agent-store";
import { toast } from "sonner";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

// Mock startAgent from @/lib/tauri
const { mockStartAgent } = vi.hoisted(() => ({
  mockStartAgent: vi.fn<(...args: unknown[]) => Promise<string>>(() =>
    Promise.resolve("feedback-123"),
  ),
}));

vi.mock("@/lib/tauri", () => ({
  startAgent: mockStartAgent,
}));

import {
  FeedbackDialog,
  buildFeedbackPrompt,
} from "@/components/feedback-dialog";

describe("buildFeedbackPrompt", () => {
  it("builds a bug prompt with correct label", () => {
    const prompt = buildFeedbackPrompt("bug", "App crashes", "It crashes on start");
    expect(prompt).toContain("Title: App crashes");
    expect(prompt).toContain("It crashes on start");
    expect(prompt).toContain('"Bug"');
    expect(prompt).toContain("linear-server create_issue");
    expect(prompt).toContain("Team: Vibedata");
    expect(prompt).toContain("Project: Skill Builder");
  });

  it("builds a feature prompt with correct label", () => {
    const prompt = buildFeedbackPrompt("feature", "Add dark mode", "Would be nice");
    expect(prompt).toContain("Title: Add dark mode");
    expect(prompt).toContain("Would be nice");
    expect(prompt).toContain('"Feature"');
  });
});

describe("FeedbackDialog", () => {
  beforeEach(() => {
    useAgentStore.getState().clearRuns();
    mockStartAgent.mockReset().mockResolvedValue("feedback-123");
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("renders the feedback trigger button", () => {
    render(<FeedbackDialog />);
    expect(screen.getByTitle("Send feedback")).toBeInTheDocument();
  });

  it("opens the dialog when trigger is clicked", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByText("Send Feedback")).toBeInTheDocument();
    expect(
      screen.getByText(/Report a bug or request a feature/),
    ).toBeInTheDocument();
  });

  it("renders Bug and Feature Request radio options", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByLabelText("Bug")).toBeInTheDocument();
    expect(screen.getByLabelText("Feature Request")).toBeInTheDocument();
  });

  it("renders title and description fields", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByLabelText("Title")).toBeInTheDocument();
    expect(screen.getByLabelText("Description")).toBeInTheDocument();
  });

  it("has Cancel and Submit buttons", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    expect(
      screen.getByRole("button", { name: /Cancel/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Submit/i }),
    ).toBeInTheDocument();
  });

  it("defaults to Bug feedback type", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    const bugRadio = screen.getByLabelText("Bug");
    expect(bugRadio).toBeChecked();
  });

  it("shows error toast when submitting with empty title", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    expect(toast.error).toHaveBeenCalledWith("Please enter a title");
    expect(mockStartAgent).not.toHaveBeenCalled();
  });

  it("calls startAgent with correct parameters on submit", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "App crashes on startup");
    await user.type(
      screen.getByLabelText("Description"),
      "Steps to reproduce...",
    );
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(mockStartAgent).toHaveBeenCalledTimes(1);
    });

    const [agentId, prompt, model, cwd, allowedTools, maxTurns] =
      mockStartAgent.mock.calls[0] as [
        string,
        string,
        string,
        string,
        string[] | undefined,
        number,
      ];
    expect(agentId).toMatch(/^feedback-\d+$/);
    expect(prompt).toContain("Title: App crashes on startup");
    expect(prompt).toContain("Steps to reproduce...");
    expect(prompt).toContain('"Bug"');
    expect(model).toBe("haiku");
    expect(cwd).toBe(".");
    expect(allowedTools).toBeUndefined();
    expect(maxTurns).toBe(5);
  });

  it("submits feature request with correct type in prompt", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.click(screen.getByLabelText("Feature Request"));
    await user.type(screen.getByLabelText("Title"), "Add dark mode");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(mockStartAgent).toHaveBeenCalledTimes(1);
    });

    const prompt = mockStartAgent.mock.calls[0][1] as string;
    expect(prompt).toContain('"Feature"');
    expect(prompt).toContain("Title: Add dark mode");
  });

  it("shows success toast when agent completes", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "Something broke");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(mockStartAgent).toHaveBeenCalledTimes(1);
    });

    // Extract the agentId from the startAgent call
    const agentId = mockStartAgent.mock.calls[0][0] as string;

    // Simulate agent completion via the store
    act(() => {
      const store = useAgentStore.getState();
      store.addMessage(agentId, {
        type: "result",
        content: "VD-500",
        raw: { result: "VD-500" },
        timestamp: Date.now(),
      });
      store.completeRun(agentId, true);
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Feedback submitted (VD-500)");
    });
  });

  it("shows error toast when agent fails", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "Something broke");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(mockStartAgent).toHaveBeenCalledTimes(1);
    });

    const agentId = mockStartAgent.mock.calls[0][0] as string;

    // Simulate agent failure (register the run first so completeRun finds it)
    act(() => {
      const store = useAgentStore.getState();
      store.registerRun(agentId, "haiku");
      store.completeRun(agentId, false);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to submit feedback", {
        duration: 5000,
      });
    });
  });

  it("shows error toast when startAgent throws", async () => {
    mockStartAgent.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();
    render(<FeedbackDialog />);

    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "Something broke");
    await user.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to submit feedback: Network error",
        { duration: 5000 },
      );
    });
  });

  it("resets form when dialog is closed via Cancel", async () => {
    const user = userEvent.setup();
    render(<FeedbackDialog />);

    // Open and fill out form
    await user.click(screen.getByTitle("Send feedback"));
    await user.type(screen.getByLabelText("Title"), "Some title");
    await user.type(
      screen.getByLabelText("Description"),
      "Some description",
    );

    // Close via Cancel
    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    // Re-open and verify fields are reset
    await user.click(screen.getByTitle("Send feedback"));
    expect(screen.getByLabelText("Title")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });
});
