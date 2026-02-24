import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { useAgentStore } from "@/stores/agent-store";
import { useSettingsStore } from "@/stores/settings-store";
import { resetTauriMocks } from "@/test/mocks/tauri";

// Mock TanStack Router — useBlocker returns idle state by default
const mockBlocker = vi.hoisted(() => ({
  proceed: vi.fn(),
  reset: vi.fn(),
  status: "idle" as string,
}));
const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ skillName: "test-skill" }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useBlocker: () => mockBlocker,
  useNavigate: () => mockNavigate,
}));

// Mock sonner — use vi.hoisted so the object is available in hoisted vi.mock factory
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: mockToast,
  Toaster: () => null,
}));

// Mock @/lib/tauri
vi.mock("@/lib/tauri", () => ({
  runWorkflowStep: vi.fn(),
  readFile: vi.fn(() => Promise.reject("not found")),
  writeFile: vi.fn(() => Promise.resolve()),
  getWorkflowState: vi.fn(() => Promise.reject("not found")),
  saveWorkflowState: vi.fn(() => Promise.resolve()),
  resetWorkflowStep: vi.fn(() => Promise.resolve()),
  cleanupSkillSidecar: vi.fn(() => Promise.resolve()),
  acquireLock: vi.fn(() => Promise.resolve()),
  releaseLock: vi.fn(() => Promise.resolve()),
  persistAgentRun: vi.fn(() => Promise.resolve()),
  createWorkflowSession: vi.fn(() => Promise.resolve()),
  endWorkflowSession: vi.fn(() => Promise.resolve()),
  verifyStepOutput: vi.fn(() => Promise.resolve(true)),
  previewStepReset: vi.fn(() => Promise.resolve([])),
  getDisabledSteps: vi.fn(() => Promise.resolve([])),
  runAnswerEvaluator: vi.fn(() => Promise.reject("not available")),
  autofillClarifications: vi.fn(() => Promise.resolve(0)),
  logGateDecision: vi.fn(() => Promise.resolve()),
}));

// Mock ClarificationsEditor — renders a simple div with testid and
// exposes onChange/onContinue via buttons so tests can trigger them.
const mockClarificationsOnChange = vi.hoisted(() => vi.fn());
vi.mock("@/components/clarifications-editor", () => ({
  ClarificationsEditor: ({ data, onChange, onContinue }: {
    data: unknown;
    onChange?: (updated: unknown) => void;
    onContinue?: () => void;
  }) => {
    // Stash onChange so tests can call it
    mockClarificationsOnChange.mockImplementation((updated: unknown) => onChange?.(updated));
    return (
      <div data-testid="clarifications-editor">
        <span data-testid="clarifications-data">{JSON.stringify(data)}</span>
        {onContinue && <button data-testid="clarifications-continue" onClick={onContinue}>Complete Step</button>}
      </div>
    );
  },
}));

// Mock heavy sub-components to isolate the effect lifecycle
vi.mock("@/components/workflow-sidebar", () => ({
  WorkflowSidebar: vi.fn(() => <div data-testid="workflow-sidebar" />),
}));
vi.mock("@/components/agent-output-panel", () => ({
  AgentOutputPanel: () => <div data-testid="agent-output" />,
}));
vi.mock("@/components/workflow-step-complete", () => ({
  WorkflowStepComplete: () => (
    <div data-testid="step-complete" />
  ),
}));

// Import after mocks
import WorkflowPage from "@/pages/workflow";
import { getWorkflowState, saveWorkflowState, writeFile, readFile, runWorkflowStep, resetWorkflowStep, cleanupSkillSidecar, endWorkflowSession, previewStepReset, runAnswerEvaluator } from "@/lib/tauri";
import { WorkflowSidebar } from "@/components/workflow-sidebar";
import type { ClarificationsFile } from "@/lib/clarifications-types";

/** Minimal valid ClarificationsFile for tests */
function makeClarificationsJson(overrides?: Partial<ClarificationsFile>): ClarificationsFile {
  return {
    version: "1",
    metadata: {
      title: "Test Clarifications",
      question_count: 2,
      section_count: 1,
      refinement_count: 0,
      must_answer_count: 1,
      priority_questions: ["Q1"],
    },
    sections: [
      {
        id: "S1",
        title: "Test Section",
        questions: [
          {
            id: "Q1",
            title: "Question 1",
            must_answer: true,
            text: "What is the primary focus?",
            choices: [
              { id: "A", text: "Option A", is_other: false },
              { id: "B", text: "Option B", is_other: false },
            ],
            answer_choice: null,
            answer_text: null,
            refinements: [],
          },
          {
            id: "Q2",
            title: "Question 2",
            must_answer: false,
            text: "Secondary concern?",
            choices: [
              { id: "A", text: "Choice A", is_other: false },
              { id: "B", text: "Choice B", is_other: false },
            ],
            answer_choice: null,
            answer_text: null,
            refinements: [],
          },
        ],
      },
    ],
    notes: [],
    ...overrides,
  };
}

describe("WorkflowPage — agent completion lifecycle", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    // Hydrate settings so workflow handlers don't bail
    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();

    // Reset blocker to idle state
    mockBlocker.proceed.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.status = "idle";

    // Clear module-level tauri mock call records so tests don't leak
    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  it("stays on completion screen after agent step when next is human review", async () => {
    // Simulate: step 0 is running an agent (step 1 is human review)
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    render(<WorkflowPage />);

    // Agent completes — should NOT auto-advance because next step is human review
    act(() => {
      useAgentStore.getState().completeRun("agent-1", true);
    });

    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[0].status).toBe("completed");
    });

    const wf = useWorkflowStore.getState();

    // Stays on step 0 completion screen — user sees output files read-only
    expect(wf.currentStep).toBe(0);

    // Running flag cleared
    expect(wf.isRunning).toBe(false);

    expect(mockToast.success).toHaveBeenCalledWith("Step 1 completed");
  });

  it("pauses on completion screen after step 5 (build)", async () => {
    // Simulate: steps 0-4 completed, step 5 running
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    for (let i = 0; i < 5; i++) {
      useWorkflowStore.getState().updateStepStatus(i, "completed");
    }
    useWorkflowStore.getState().setCurrentStep(5);
    useWorkflowStore.getState().updateStepStatus(5, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-build", "sonnet");

    render(<WorkflowPage />);

    // Agent completes step 5 (build)
    act(() => {
      useAgentStore.getState().completeRun("agent-build", true);
    });

    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[5].status).toBe("completed");
    });

    const wf = useWorkflowStore.getState();

    // Step 5 completed
    expect(wf.steps[5].status).toBe("completed");

    // Stays on step 5 completion screen — user clicks "Next Step" to proceed
    expect(wf.currentStep).toBe(5);

    // Running flag cleared
    expect(wf.isRunning).toBe(false);

    expect(mockToast.success).toHaveBeenCalledWith("Step 6 completed");
  });


  it("marks step as error when agent fails — no cascade", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    render(<WorkflowPage />);

    // Agent fails
    act(() => {
      useAgentStore.getState().completeRun("agent-1", false);
    });

    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[0].status).toBe("error");
    });

    const wf = useWorkflowStore.getState();

    // Step 0 errored
    expect(wf.steps[0].status).toBe("error");

    // Should NOT advance
    expect(wf.currentStep).toBe(0);

    // No further steps affected
    expect(wf.steps[1].status).toBe("pending");

    expect(wf.isRunning).toBe(false);
    expect(mockToast.error).toHaveBeenCalledTimes(1);
  });

  it("does not overwrite saved state during hydration", async () => {
    // Simulate: SQLite has step 0 completed from a previous session
    vi.mocked(getWorkflowState).mockResolvedValueOnce({
      run: {
        skill_name: "test-skill",
        current_step: 1,
        status: "pending",
        purpose: "domain",
        created_at: "",
        updated_at: "",
      },
      steps: [
        { skill_name: "test-skill", step_id: 0, status: "completed", started_at: null, completed_at: null },
      ],
    });

    render(<WorkflowPage />);

    // Wait for hydration to complete
    await waitFor(() => {
      expect(useWorkflowStore.getState().hydrated).toBe(true);
    });

    const wf = useWorkflowStore.getState();
    expect(wf.steps[0].status).toBe("completed");
    expect(wf.currentStep).toBe(1);

    // saveWorkflowState should NOT have been called with all-pending state
    // It should only be called after hydration with the correct state
    const saveCalls = vi.mocked(saveWorkflowState).mock.calls;
    for (const call of saveCalls) {
      const stepStatuses = call[3] as Array<{ step_id: number; status: string }>;
      const step0 = stepStatuses.find((s) => s.step_id === 0);
      expect(step0?.status).toBe("completed");
    }
  });

  it("does not complete a step that is not in_progress", async () => {
    // Edge case: agent completion arrives but step is already completed
    // (e.g., from a stale agent)
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().setRunning(false);

    // Stale agent from step 0
    useAgentStore.getState().startRun("stale-agent", "sonnet");
    useAgentStore.getState().completeRun("stale-agent", true);

    render(<WorkflowPage />);

    // Give effects time to fire
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    const wf = useWorkflowStore.getState();

    // Step 1 should still be pending — stale completion must not affect it
    expect(wf.steps[1].status).toBe("pending");

    // No toast for stale completion
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("reverts step to pending on unmount when running", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    const { unmount } = render(<WorkflowPage />);

    // Unmount triggers cleanup (simulates navigating away)
    act(() => {
      unmount();
    });

    // isRunning should be cleared immediately
    expect(useWorkflowStore.getState().isRunning).toBe(false);

    // Step should be reverted to pending (not stuck at in_progress)
    expect(useWorkflowStore.getState().steps[0].status).toBe("pending");
  });

  it("does not revert step on unmount when not running", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setRunning(false);

    const { unmount } = render(<WorkflowPage />);

    act(() => {
      unmount();
    });

    // Completed step should remain completed
    expect(useWorkflowStore.getState().steps[0].status).toBe("completed");
  });

  it("calls cleanupSkillSidecar on unmount when running", async () => {
    vi.mocked(cleanupSkillSidecar).mockClear();

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    const { unmount } = render(<WorkflowPage />);

    act(() => {
      unmount();
    });

    // cleanupSkillSidecar should be called with the skill name
    expect(vi.mocked(cleanupSkillSidecar)).toHaveBeenCalledWith("test-skill");
  });

  it("calls endWorkflowSession on unmount when session is active", async () => {
    vi.mocked(endWorkflowSession).mockClear();

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setRunning(true);
    const sessionId = useWorkflowStore.getState().workflowSessionId;
    expect(sessionId).toBeTruthy();

    const { unmount } = render(<WorkflowPage />);

    act(() => {
      unmount();
    });

    expect(vi.mocked(endWorkflowSession)).toHaveBeenCalledWith(sessionId);
  });

  it("calls cleanupSkillSidecar on unmount even when not running", async () => {
    vi.mocked(cleanupSkillSidecar).mockClear();

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setRunning(false);

    const { unmount } = render(<WorkflowPage />);

    act(() => {
      unmount();
    });

    // cleanupSkillSidecar should still be called (persistent sidecar cleanup)
    expect(vi.mocked(cleanupSkillSidecar)).toHaveBeenCalledWith("test-skill");
  });

  it("shows nav guard dialog when blocker status is blocked", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    // Simulate blocker triggered by navigation attempt
    mockBlocker.status = "blocked";

    const { getByText } = render(<WorkflowPage />);

    // Dialog should be visible
    expect(getByText("Agent Running")).toBeTruthy();
    expect(getByText("Stay")).toBeTruthy();
    expect(getByText("Leave")).toBeTruthy();
  });

  it("clears stale agent data when switching skills", async () => {
    // Simulate: stale agent data from a previous skill
    useAgentStore.getState().startRun("old-agent", "sonnet");
    useAgentStore.getState().completeRun("old-agent", true);
    useAgentStore.getState().setActiveAgent("old-agent");

    expect(useAgentStore.getState().activeAgentId).toBe("old-agent");

    // Render triggers init effect which should clear agent store
    render(<WorkflowPage />);

    await waitFor(() => {
      expect(useWorkflowStore.getState().hydrated).toBe(true);
    });

    // Stale agent data should be cleared — "old-agent" is no longer active
    // (auto-start may have kicked off a new agent, so we check the stale ID is gone)
    expect(useAgentStore.getState().activeAgentId).not.toBe("old-agent");
    expect(useAgentStore.getState().runs).not.toHaveProperty("old-agent");
  });

  it("shows Start Step button on initial create-flow load (no auto-start)", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setPendingUpdateMode(true);
    useWorkflowStore.getState().setReviewMode(false);

    render(<WorkflowPage />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // New skills show Start Step button — auto-start only on review→update toggle
    expect(screen.getByText("Start Step")).toBeDefined();
    expect(vi.mocked(runWorkflowStep)).not.toHaveBeenCalled();
  });

  it("renders completion screen on last step (step 5)", async () => {
    // Simulate all steps complete, on step 5 (the last step)
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    for (let i = 0; i < 6; i++) {
      useWorkflowStore.getState().updateStepStatus(i, "completed");
    }
    useWorkflowStore.getState().setCurrentStep(5);

    render(<WorkflowPage />);

    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // Should render completion screen
    expect(screen.queryByTestId("step-complete")).toBeTruthy();
  });
});

describe("WorkflowPage — human review file loading priority", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      skillsPath: "/test/skills",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockBlocker.proceed.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.status = "idle";

    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
    vi.mocked(readFile).mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  it("loads review content from skillsPath context directory first", async () => {
    // skillsPath has the file — should use it even though workspace also has content
    const jsonData = makeClarificationsJson();
    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(JSON.stringify(jsonData));
      }
      return Promise.reject("not found");
    });

    // Navigate to step 1 (human review for concepts)
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");

    render(<WorkflowPage />);

    // Should render the ClarificationsEditor with the parsed JSON data
    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    // readFile should have been called with the skillsPath location
    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/skills/test-skill/context/clarifications.json"
    );
  });

  it("shows missing file error when skillsPath context file is not found (no workspace fallback)", async () => {
    // skillsPath does NOT have the file — no workspace fallback
    vi.mocked(readFile).mockImplementation(() => {
      return Promise.reject("not found");
    });

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");

    render(<WorkflowPage />);

    // Should show missing file error since skillsPath file not found and no workspace fallback
    await waitFor(() => {
      expect(screen.getByText("Missing clarifications file")).toBeTruthy();
    });
  });

  it("shows missing file error when skillsPath is null", async () => {
    // No skillsPath configured — review loading requires skillsPath
    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      skillsPath: null,
      anthropicApiKey: "sk-test",
    });

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");

    render(<WorkflowPage />);

    // Without skillsPath, review content is null — should show missing file error
    await waitFor(() => {
      expect(screen.getByText("Missing clarifications file")).toBeTruthy();
    });

    // readFile should NOT have been called at all
    expect(vi.mocked(readFile)).not.toHaveBeenCalled();
  });

  it("uses skillsPath context dir for step 3 (clarifications.json) too", async () => {
    // Step 3 reviews clarifications.json — same priority should apply
    const jsonData = makeClarificationsJson();
    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(JSON.stringify(jsonData));
      }
      return Promise.reject("not found");
    });
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().updateStepStatus(1, "completed");
    useWorkflowStore.getState().updateStepStatus(2, "completed");
    useWorkflowStore.getState().setCurrentStep(3);
    useWorkflowStore.getState().updateStepStatus(3, "waiting_for_user");

    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    expect(vi.mocked(readFile)).toHaveBeenCalledWith(
      "/test/skills/test-skill/context/clarifications.json"
    );
  });
});

describe("WorkflowPage — VD-410 human review behavior", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      skillsPath: "/test/skills",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockBlocker.proceed.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.status = "idle";

    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
    vi.mocked(readFile).mockClear();
    vi.mocked(writeFile).mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  it("Complete Step saves JSON content preserving unanswered questions", async () => {
    // Content with empty answers — should be saved as-is
    const jsonData = makeClarificationsJson();
    const jsonString = JSON.stringify(jsonData);

    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(jsonString);
      }
      return Promise.reject("not found");
    });

    // Set up step 1 (human review for concepts)
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");

    render(<WorkflowPage />);

    // Wait for ClarificationsEditor to load and Complete Step button to appear
    await waitFor(() => {
      expect(screen.getByTestId("clarifications-continue")).toBeTruthy();
    });

    // Click "Complete Step" via the ClarificationsEditor's continue button
    act(() => {
      screen.getByTestId("clarifications-continue").click();
    });

    // writeFile should be called with stringified JSON
    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1);
    });

    const writePath = vi.mocked(writeFile).mock.calls[0][0];
    const savedContent = vi.mocked(writeFile).mock.calls[0][1];
    expect(writePath).toBe("/test/skills/test-skill/context/clarifications.json");

    // Saved content should be valid JSON matching the original data
    const parsed = JSON.parse(savedContent);
    expect(parsed.version).toBe("1");
    expect(parsed.sections[0].questions[0].answer_choice).toBeNull();

    // Step should be marked completed and advanced
    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[1].status).toBe("completed");
      expect(useWorkflowStore.getState().currentStep).toBe(2);
    });
  });

  it("pauses on completion screen when next step is human review", async () => {
    // Simulate: step 0 is running an agent (step 1 is human review)
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    render(<WorkflowPage />);

    // Agent completes step 0
    act(() => {
      useAgentStore.getState().completeRun("agent-1", true);
    });

    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[0].status).toBe("completed");
    });

    const wf = useWorkflowStore.getState();

    // Should stay on step 0 completion screen (not auto-advance to human review)
    // User clicks "Next Step" to proceed to review
    expect(wf.currentStep).toBe(0);
  });

  it("preserves partially filled answers in JSON", async () => {
    // Content with mixed answers — some filled, some empty
    const jsonData = makeClarificationsJson();
    jsonData.sections[0].questions[0].answer_choice = "A";
    jsonData.sections[0].questions[0].answer_text = "We use full refresh for this table";
    // Q2 left unanswered
    const jsonString = JSON.stringify(jsonData);

    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(jsonString);
      }
      return Promise.reject("not found");
    });
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");

    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-continue")).toBeTruthy();
    });

    act(() => {
      screen.getByTestId("clarifications-continue").click();
    });

    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1);
    });

    const savedContent = vi.mocked(writeFile).mock.calls[0][1];
    const parsed = JSON.parse(savedContent);

    // User-filled answer should be preserved
    expect(parsed.sections[0].questions[0].answer_choice).toBe("A");
    expect(parsed.sections[0].questions[0].answer_text).toBe("We use full refresh for this table");

    // Empty answer should still be null — not auto-filled
    expect(parsed.sections[0].questions[1].answer_choice).toBeNull();
  });

  it("step 3 human review also saves JSON without auto-fill", async () => {
    // Step 3 reviews clarifications.json — same behavior expected
    const jsonData = makeClarificationsJson();
    const jsonString = JSON.stringify(jsonData);

    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(jsonString);
      }
      return Promise.reject("not found");
    });
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().updateStepStatus(1, "completed");
    useWorkflowStore.getState().updateStepStatus(2, "completed");
    useWorkflowStore.getState().setCurrentStep(3);
    useWorkflowStore.getState().updateStepStatus(3, "waiting_for_user");

    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-continue")).toBeTruthy();
    });

    act(() => {
      screen.getByTestId("clarifications-continue").click();
    });

    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1);
    });

    // Verify it saved to the correct filesystem path for step 3 (skillsPath, no workspace fallback)
    const writePath = vi.mocked(writeFile).mock.calls[0][0];
    expect(writePath).toBe("/test/skills/test-skill/context/clarifications.json");

    const savedContent = vi.mocked(writeFile).mock.calls[0][1];
    const parsed = JSON.parse(savedContent);

    // Answers should remain null — no auto-fill
    expect(parsed.sections[0].questions[0].answer_choice).toBeNull();
    expect(parsed.sections[0].questions[1].answer_choice).toBeNull();

    // Step should be marked completed and advanced
    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[3].status).toBe("completed");
      expect(useWorkflowStore.getState().currentStep).toBe(4);
    });
  });
});

describe("WorkflowPage — reset flow session lifecycle", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      skillsPath: "/test/skills",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockBlocker.proceed.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.status = "idle";

    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
    vi.mocked(readFile).mockClear();
    vi.mocked(writeFile).mockClear();
    vi.mocked(runWorkflowStep).mockClear();
    vi.mocked(resetWorkflowStep).mockClear();
    vi.mocked(endWorkflowSession).mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
    // Restore the default sidebar mock in case a test overrode it
    vi.mocked(WorkflowSidebar).mockImplementation(() => <div data-testid="workflow-sidebar" />);
  });

  it("calls endWorkflowSession on error state reset button", async () => {
    // Set up workflow with an active session
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().setRunning(true); // creates a session ID
    const sessionId = useWorkflowStore.getState().workflowSessionId;
    expect(sessionId).toBeTruthy();

    // Put step 0 in error state (agent failed, not running anymore)
    useWorkflowStore.getState().updateStepStatus(0, "error");
    useWorkflowStore.getState().setRunning(false);

    // readFile rejects — no partial artifacts on disk
    vi.mocked(readFile).mockRejectedValue("not found");

    render(<WorkflowPage />);

    // Wait for the error UI to render with the "Reset Step" button
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reset Step/ })).toBeTruthy();
    });

    // Click the "Reset Step" button (no artifacts → no confirmation dialog)
    await act(async () => {
      screen.getByRole("button", { name: /Reset Step/ }).click();
    });

    // endWorkflowSession should have been called with the session ID
    expect(vi.mocked(endWorkflowSession)).toHaveBeenCalledWith(sessionId);
  });

  it("calls endWorkflowSession on reset confirmation dialog", async () => {
    // Set up workflow with an active session
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().setRunning(true); // creates a session ID
    const sessionId = useWorkflowStore.getState().workflowSessionId;
    expect(sessionId).toBeTruthy();

    // Put step 0 in error state
    useWorkflowStore.getState().updateStepStatus(0, "error");
    useWorkflowStore.getState().setRunning(false);

    // readFile returns content for the step's first output file -> errorHasArtifacts = true
    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path.includes("research-plan.md")) {
        return Promise.resolve("partial content");
      }
      return Promise.reject("not found");
    });

    render(<WorkflowPage />);

    // Wait for artifact detection to complete (readFile resolves asynchronously)
    await waitFor(() => {
      expect(vi.mocked(readFile)).toHaveBeenCalledWith(
        expect.stringContaining("research-plan.md")
      );
    });
    // Flush promise so errorHasArtifacts state updates
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

    // Click "Reset Step" — should show confirmation dialog (since artifacts exist)
    await act(async () => {
      screen.getByRole("button", { name: /Reset Step/ }).click();
    });

    // Confirmation dialog should appear with "Reset Step?" title
    await waitFor(() => {
      expect(screen.getByText("Reset Step?")).toBeTruthy();
    });

    // Click "Reset" in the confirmation dialog (destructive variant)
    await act(async () => {
      screen.getByRole("button", { name: "Reset" }).click();
    });

    // endWorkflowSession should have been called with the session ID
    expect(vi.mocked(endWorkflowSession)).toHaveBeenCalledWith(sessionId);
  });

  it("calls endWorkflowSession on ResetStepDialog reset", async () => {
    // Override WorkflowSidebar mock to expose onStepClick for this test
    vi.mocked(WorkflowSidebar).mockImplementation(({ onStepClick }: { onStepClick?: (id: number) => void }) => (
      <div data-testid="workflow-sidebar">
        <button data-testid="sidebar-step-0" onClick={() => onStepClick?.(0)}>Step 0</button>
      </div>
    ));

    // Mock previewStepReset so the ResetStepDialog can load
    vi.mocked(previewStepReset).mockResolvedValue([]);

    // Set up workflow with an active session
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().setRunning(true); // creates a session ID
    const sessionId = useWorkflowStore.getState().workflowSessionId;
    expect(sessionId).toBeTruthy();

    // Complete steps 0-2 and navigate to step 3
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().updateStepStatus(1, "completed");
    useWorkflowStore.getState().updateStepStatus(2, "completed");
    useWorkflowStore.getState().setCurrentStep(3);
    useWorkflowStore.getState().setRunning(false);

    render(<WorkflowPage />);

    // Click step 0 in the sidebar — triggers ResetStepDialog (since step 0 < currentStep 3)
    await act(async () => {
      screen.getByTestId("sidebar-step-0").click();
    });

    // ResetStepDialog should appear
    await waitFor(() => {
      expect(screen.getByText("Reset to Earlier Step")).toBeTruthy();
    });

    // Wait for the preview to load and the Reset button to be enabled
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Reset" })).toBeEnabled();
    });

    // Click "Reset" in the ResetStepDialog
    await act(async () => {
      screen.getByRole("button", { name: "Reset" }).click();
    });

    // endWorkflowSession should have been called with the session ID
    await waitFor(() => {
      expect(vi.mocked(endWorkflowSession)).toHaveBeenCalledWith(sessionId);
    });
  });

  it("shows inline Retry button on error and calls runWorkflowStep when clicked", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);

    // Put step 0 in error state (agent failed)
    useWorkflowStore.getState().updateStepStatus(0, "error");

    // No partial artifacts on disk
    vi.mocked(readFile).mockRejectedValue("not found");

    render(<WorkflowPage />);

    // Wait for error UI to render
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Retry/ })).toBeTruthy();
    });

    // Clear previous calls so we can assert the retry call
    vi.mocked(runWorkflowStep).mockClear();

    // Click the inline Retry button
    await act(async () => {
      screen.getByRole("button", { name: /Retry/ }).click();
    });

    // Should trigger the agent step to restart
    await waitFor(() => {
      expect(vi.mocked(runWorkflowStep)).toHaveBeenCalled();
    });
  });
});

describe("WorkflowPage — VD-615 clarifications editor", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      skillsPath: "/test/skills",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockBlocker.proceed.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.status = "idle";

    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
    vi.mocked(readFile).mockClear();
    vi.mocked(writeFile).mockClear();
    vi.mocked(runAnswerEvaluator).mockClear();
    mockClarificationsOnChange.mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  /** Helper: set up step 1 (human review) with JSON content loaded */
  function setupHumanReviewStep(data?: ClarificationsFile) {
    const jsonData = data ?? makeClarificationsJson();
    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(JSON.stringify(jsonData));
      }
      return Promise.reject("not found");
    });

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");
  }

  it("renders ClarificationsEditor when JSON content is loaded", async () => {
    setupHumanReviewStep();
    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    // Verify data was passed through
    const dataEl = screen.getByTestId("clarifications-data");
    const parsed = JSON.parse(dataEl.textContent ?? "");
    expect(parsed.version).toBe("1");
    expect(parsed.sections).toHaveLength(1);
  });

  it("Complete Step via ClarificationsEditor saves and advances", async () => {
    setupHumanReviewStep();
    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-continue")).toBeTruthy();
    });

    // Click "Complete Step" via the ClarificationsEditor's continue button
    act(() => {
      screen.getByTestId("clarifications-continue").click();
    });

    // writeFile should be called with stringified JSON
    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(1);
    });

    const writePath = vi.mocked(writeFile).mock.calls[0][0];
    expect(writePath).toBe("/test/skills/test-skill/context/clarifications.json");

    const savedContent = vi.mocked(writeFile).mock.calls[0][1];
    const parsed = JSON.parse(savedContent);
    expect(parsed.version).toBe("1");

    // Gate evaluator should be invoked (runAnswerEvaluator rejects → fail-open → advances)
    expect(vi.mocked(runAnswerEvaluator)).toHaveBeenCalled();

    // Step should be completed and advanced (via fail-open gate path)
    await waitFor(() => {
      expect(useWorkflowStore.getState().steps[1].status).toBe("completed");
      expect(useWorkflowStore.getState().currentStep).toBe(2);
    });
  });

  it("onChange from ClarificationsEditor marks content as dirty (triggers autosave)", async () => {
    vi.useRealTimers();

    setupHumanReviewStep();
    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    vi.mocked(writeFile).mockClear();

    // Simulate user editing a question via the ClarificationsEditor onChange callback
    const updatedData = makeClarificationsJson();
    updatedData.sections[0].questions[0].answer_choice = "A";
    act(() => {
      mockClarificationsOnChange(updatedData);
    });

    // Dirty flag is set internally — autosave should fire after 1500ms
    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Saved content should include the edit
    const savedContent = vi.mocked(writeFile).mock.calls[0][1];
    const parsed = JSON.parse(savedContent);
    expect(parsed.sections[0].questions[0].answer_choice).toBe("A");
  }, 10000);

  it("shows nav guard with unsaved changes text when blocker is triggered", async () => {
    setupHumanReviewStep();

    // Simulate blocker triggered (not running, so it must be unsaved changes)
    mockBlocker.status = "blocked";

    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByText("Unsaved Changes")).toBeTruthy();
      expect(screen.getByText("You have unsaved edits that will be lost if you leave.")).toBeTruthy();
    });
  });

  it("shows nav guard with agent running text when agent is running", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().updateStepStatus(0, "in_progress");
    useWorkflowStore.getState().setRunning(true);
    useAgentStore.getState().startRun("agent-1", "sonnet");

    mockBlocker.status = "blocked";

    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByText("Agent Running")).toBeTruthy();
      expect(screen.getByText("An agent is still running on this step. Leaving will abandon it.")).toBeTruthy();
    });
  });
});

describe("WorkflowPage — VD-863 autosave on human review steps", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      skillsPath: "/test/skills",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockToast.info.mockClear();
    mockBlocker.proceed.mockClear();
    mockBlocker.reset.mockClear();
    mockBlocker.status = "idle";

    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
    vi.mocked(readFile).mockClear();
    vi.mocked(writeFile).mockClear();
    vi.mocked(runAnswerEvaluator).mockClear();
    mockClarificationsOnChange.mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setupHumanReviewStep(data?: ClarificationsFile) {
    const jsonData = data ?? makeClarificationsJson();
    vi.mocked(readFile).mockImplementation((path: string) => {
      if (path === "/test/skills/test-skill/context/clarifications.json") {
        return Promise.resolve(JSON.stringify(jsonData));
      }
      return Promise.reject("not found");
    });

    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().updateStepStatus(0, "completed");
    useWorkflowStore.getState().setCurrentStep(1);
    useWorkflowStore.getState().updateStepStatus(1, "waiting_for_user");
  }

  it("autosave fires writeFile after 1500ms debounce when content is edited", async () => {
    // Use real timers for this test to avoid conflicts with waitFor polling
    vi.useRealTimers();

    setupHumanReviewStep();
    render(<WorkflowPage />);

    // Wait for ClarificationsEditor to load
    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    vi.mocked(writeFile).mockClear();

    // Edit content via ClarificationsEditor onChange — triggers dirty flag and 1500ms autosave timer
    const updatedData = makeClarificationsJson();
    updatedData.sections[0].questions[0].answer_choice = "A";
    act(() => {
      mockClarificationsOnChange(updatedData);
    });

    // Autosave fires after 1500ms — wait up to 3000ms
    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalled();
      const writePath = vi.mocked(writeFile).mock.calls[0][0];
      expect(writePath).toBe("/test/skills/test-skill/context/clarifications.json");
    }, { timeout: 3000 });

    // Autosave calls handleSave(true) — silent mode, so no toast is shown
    expect(mockToast.success).not.toHaveBeenCalledWith("Saved");
  }, 10000);

  it("autosave does NOT fire on non-human-review steps", async () => {
    // Use real timers — no timer-based interaction needed
    vi.useRealTimers();

    // Set up an agent step (step 0)
    vi.mocked(readFile).mockRejectedValue("not found");
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    useWorkflowStore.getState().setReviewMode(false);
    useWorkflowStore.getState().setCurrentStep(0);

    render(<WorkflowPage />);

    // Wait a bit — autosave should never fire on non-human steps
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });

    // On a non-human-review step, writeFile should not be called by autosave
    expect(vi.mocked(writeFile)).not.toHaveBeenCalled();
  });

  it("autosave clears dirty state after write completes", async () => {
    vi.useRealTimers();

    setupHumanReviewStep();
    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    vi.mocked(writeFile).mockClear();

    // Edit content via onChange — sets dirty flag internally
    const updatedData = makeClarificationsJson();
    updatedData.sections[0].questions[0].answer_choice = "B";
    act(() => {
      mockClarificationsOnChange(updatedData);
    });

    // After autosave fires (1500ms), writeFile should be called
    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalled();
    }, { timeout: 3000 });

    // Autosave calls handleSave(true) — silent mode, no toast
    expect(mockToast.success).not.toHaveBeenCalledWith("Saved");
  }, 10000);

  it("autosave writes updated JSON data to correct path", async () => {
    vi.useRealTimers();

    setupHumanReviewStep();
    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByTestId("clarifications-editor")).toBeTruthy();
    });

    vi.mocked(writeFile).mockClear();

    // Edit content via ClarificationsEditor onChange
    const updatedData = makeClarificationsJson();
    updatedData.sections[0].questions[0].answer_choice = "A";
    act(() => {
      mockClarificationsOnChange(updatedData);
    });

    // Autosave fires after 1500ms
    await waitFor(() => {
      expect(vi.mocked(writeFile)).toHaveBeenCalled();
      const writePath = vi.mocked(writeFile).mock.calls[0][0];
      expect(writePath).toBe("/test/skills/test-skill/context/clarifications.json");
    }, { timeout: 3000 });

    // Verify the saved JSON has the expected edit
    const savedContent = vi.mocked(writeFile).mock.calls[0][1];
    const parsed = JSON.parse(savedContent);
    expect(parsed.sections[0].questions[0].answer_choice).toBe("A");
  }, 10000);
});

describe("WorkflowPage — review mode default state", () => {
  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();

    useSettingsStore.getState().setSettings({
      workspacePath: "/test/workspace",
      anthropicApiKey: "sk-test",
    });

    mockToast.success.mockClear();
    mockToast.error.mockClear();
    mockBlocker.status = "idle";
    vi.mocked(saveWorkflowState).mockClear();
    vi.mocked(getWorkflowState).mockClear();
    vi.mocked(runWorkflowStep).mockClear();
  });

  afterEach(() => {
    useWorkflowStore.getState().reset();
    useAgentStore.getState().clearRuns();
    useSettingsStore.getState().reset();
  });

  it("shows 'Switch to Update mode' message in review mode on pending agent step", async () => {
    useWorkflowStore.getState().initWorkflow("test-skill", "test domain");
    useWorkflowStore.getState().setHydrated(true);
    // reviewMode defaults to true from initWorkflow

    render(<WorkflowPage />);

    await waitFor(() => {
      expect(screen.getByText("Switch to Update mode to run this step.")).toBeTruthy();
    });

    // Should NOT show the initializing indicator
    expect(screen.queryByText("Initializing agent")).toBeNull();
    // Should NOT have called runWorkflowStep (no auto-start in review mode)
    expect(vi.mocked(runWorkflowStep)).not.toHaveBeenCalled();
  });

  it("consumeUpdateMode works even when getWorkflowState returns saved state", async () => {
    // Simulate the race: create-flow sets pendingUpdateMode, but persistence
    // saved state before getWorkflowState resolved, so state.run exists.
    useWorkflowStore.getState().setPendingUpdateMode(true);

    vi.mocked(getWorkflowState).mockResolvedValueOnce({
      run: {
        skill_name: "test-skill",
        current_step: 0,
        status: "pending",
        purpose: "domain",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      steps: [],
    });

    render(<WorkflowPage />);

    // After init, reviewMode should be false (create flow) even though state.run exists
    await waitFor(() => {
      expect(useWorkflowStore.getState().hydrated).toBe(true);
    });
    expect(useWorkflowStore.getState().reviewMode).toBe(false);
  });
});
