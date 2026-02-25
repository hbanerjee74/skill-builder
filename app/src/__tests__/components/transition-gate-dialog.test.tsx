import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransitionGateDialog } from "@/components/transition-gate-dialog";
import type { AnswerEvaluation, PerQuestionVerdict } from "@/lib/tauri";

// ─── Test Data ────────────────────────────────────────────────────────────────

function makeEvaluation(
  verdict: "sufficient" | "mixed" | "insufficient",
  perQuestion: PerQuestionVerdict[] = [],
): AnswerEvaluation {
  const answered = perQuestion.filter(q => q.verdict === "clear" || q.verdict === "needs_refinement").length;
  const empty = perQuestion.filter(q => q.verdict === "not_answered").length;
  const vague = perQuestion.filter(q => q.verdict === "vague").length;
  const contradictory = perQuestion.filter(q => q.verdict === "contradictory").length;
  return {
    verdict,
    answered_count: answered,
    empty_count: empty,
    vague_count: vague,
    contradictory_count: contradictory > 0 ? contradictory : undefined,
    total_count: perQuestion.length,
    reasoning: "test evaluation",
    per_question: perQuestion,
  };
}

// Sufficient: all clear
const sufficientEval = makeEvaluation("sufficient", [
  { question_id: "Q1", verdict: "clear" },
  { question_id: "Q2", verdict: "clear" },
  { question_id: "Q3", verdict: "clear" },
]);

// Mixed — only needs_refinement (no missing/vague/contradictory)
const onlyRefinementEval = makeEvaluation("mixed", [
  { question_id: "Q1", verdict: "clear" },
  { question_id: "Q2", verdict: "needs_refinement" },
  { question_id: "Q3", verdict: "clear" },
  { question_id: "Q4", verdict: "needs_refinement" },
]);

// Mixed — has missing + vague
const mixedEval = makeEvaluation("mixed", [
  { question_id: "Q1", verdict: "clear" },
  { question_id: "Q2", verdict: "not_answered" },
  { question_id: "Q3", verdict: "vague" },
  { question_id: "Q4", verdict: "clear" },
]);

// Insufficient — mostly empty/vague
const insufficientEval = makeEvaluation("insufficient", [
  { question_id: "Q1", verdict: "not_answered" },
  { question_id: "Q2", verdict: "not_answered" },
  { question_id: "Q3", verdict: "vague" },
  { question_id: "Q4", verdict: "vague" },
  { question_id: "Q5", verdict: "clear" },
]);

const defaultHandlers = {
  onSkip: vi.fn(),
  onResearch: vi.fn(),
  onAutofillAndSkip: vi.fn(),
  onAutofillAndResearch: vi.fn(),
  onLetMeAnswer: vi.fn(),
};

function resetHandlers() {
  Object.values(defaultHandlers).forEach(fn => fn.mockClear());
}

// ─── Gate 1: After Step 2 (clarifications review) ─────────────────────────────

describe("TransitionGateDialog — Gate 1 (clarifications)", () => {
  const gate1Props = { open: true, context: "clarifications" as const, ...defaultHandlers };

  beforeEach(resetHandlers);

  describe("sufficient → Run Research Anyway | Skip to Decisions", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="sufficient" evaluation={sufficientEval} />);
      expect(screen.getByText("Skip Detailed Research?")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Run Research Anyway/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Skip to Decisions/i })).toBeInTheDocument();
    });

    it("Run Research Anyway calls onResearch", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="sufficient" evaluation={sufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Run Research Anyway/i }));
      expect(defaultHandlers.onResearch).toHaveBeenCalledOnce();
    });

    it("Skip to Decisions calls onSkip", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="sufficient" evaluation={sufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Skip to Decisions/i }));
      expect(defaultHandlers.onSkip).toHaveBeenCalledOnce();
    });

    it("does not show evaluation breakdown", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="sufficient" evaluation={sufficientEval} />);
      expect(screen.queryByTestId("question-breakdown")).not.toBeInTheDocument();
    });
  });

  describe("only needs_refinement → Continue to Research", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={onlyRefinementEval} />);
      expect(screen.getByText("Some Answers Need Deeper Research")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue to Research/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Revise/i })).toBeInTheDocument();
    });

    it("does NOT show Auto-fill button", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={onlyRefinementEval} />);
      expect(screen.queryByRole("button", { name: /Auto-fill/i })).not.toBeInTheDocument();
    });

    it("Continue to Research calls onResearch", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={onlyRefinementEval} />);
      await user.click(screen.getByRole("button", { name: /Continue to Research/i }));
      expect(defaultHandlers.onResearch).toHaveBeenCalledOnce();
    });

    it("Let Me Revise calls onLetMeAnswer", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={onlyRefinementEval} />);
      await user.click(screen.getByRole("button", { name: /Let Me Revise/i }));
      expect(defaultHandlers.onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("shows evaluation breakdown with needs refinement questions", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={onlyRefinementEval} />);
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent(/Needs refinement:/);
      expect(breakdown).toHaveTextContent("Q2");
      expect(breakdown).toHaveTextContent("Q4");
    });
  });

  describe("mixed (has missing/vague) → Let Me Answer | Auto-fill & Research", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={mixedEval} />);
      expect(screen.getByText("Review Answer Quality")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeInTheDocument();
    });

    it("Auto-fill & Research calls onAutofillAndResearch", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={mixedEval} />);
      await user.click(screen.getByRole("button", { name: /Auto-fill & Research/i }));
      expect(defaultHandlers.onAutofillAndResearch).toHaveBeenCalledOnce();
    });

    it("Let Me Answer calls onLetMeAnswer", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={mixedEval} />);
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(defaultHandlers.onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("shows breakdown with missing and vague categories", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={mixedEval} />);
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent(/Missing:.*Q2/);
      expect(breakdown).toHaveTextContent(/Vague:.*Q3/);
    });

    it("disables Auto-fill button when isAutofilling", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="mixed" evaluation={mixedEval} isAutofilling />);
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeDisabled();
    });
  });

  describe("insufficient → Let Me Answer | Auto-fill & Research", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="insufficient" evaluation={insufficientEval} />);
      expect(screen.getByText("Review Answer Quality")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeInTheDocument();
    });

    it("Auto-fill & Research calls onAutofillAndResearch", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="insufficient" evaluation={insufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Auto-fill & Research/i }));
      expect(defaultHandlers.onAutofillAndResearch).toHaveBeenCalledOnce();
    });

    it("Let Me Answer calls onLetMeAnswer", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate1Props} verdict="insufficient" evaluation={insufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(defaultHandlers.onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("shows breakdown with missing and vague categories", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="insufficient" evaluation={insufficientEval} />);
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent(/Missing:.*Q1/);
      expect(breakdown).toHaveTextContent(/Vague:.*Q3/);
    });

    it("disables Auto-fill button when isAutofilling", () => {
      render(<TransitionGateDialog {...gate1Props} verdict="insufficient" evaluation={insufficientEval} isAutofilling />);
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeDisabled();
    });
  });
});

// ─── Gate 2: After Step 3 (refinements review) ───────────────────────────────

describe("TransitionGateDialog — Gate 2 (refinements)", () => {
  const gate2Props = { open: true, context: "refinements" as const, ...defaultHandlers };

  beforeEach(resetHandlers);

  describe("sufficient → Continue to Decisions", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate2Props} verdict="sufficient" evaluation={sufficientEval} />);
      expect(screen.getByText("Refinement Answers Complete")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Continue to Decisions/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Back to Review/i })).toBeInTheDocument();
    });

    it("Continue to Decisions calls onResearch", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate2Props} verdict="sufficient" evaluation={sufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Continue to Decisions/i }));
      expect(defaultHandlers.onResearch).toHaveBeenCalledOnce();
    });

    it("Back to Review calls onLetMeAnswer", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate2Props} verdict="sufficient" evaluation={sufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Back to Review/i }));
      expect(defaultHandlers.onLetMeAnswer).toHaveBeenCalledOnce();
    });
  });

  describe("mixed → Let Me Answer | Auto-fill & Continue", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate2Props} verdict="mixed" evaluation={mixedEval} />);
      expect(screen.getByText("Some Refinements Unanswered")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Auto-fill & Continue/i })).toBeInTheDocument();
    });

    it("Auto-fill & Continue calls onAutofillAndSkip", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate2Props} verdict="mixed" evaluation={mixedEval} />);
      await user.click(screen.getByRole("button", { name: /Auto-fill & Continue/i }));
      expect(defaultHandlers.onAutofillAndSkip).toHaveBeenCalledOnce();
    });

    it("Let Me Answer calls onLetMeAnswer", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate2Props} verdict="mixed" evaluation={mixedEval} />);
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(defaultHandlers.onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("disables Auto-fill button when isAutofilling", () => {
      render(<TransitionGateDialog {...gate2Props} verdict="mixed" evaluation={mixedEval} isAutofilling />);
      expect(screen.getByRole("button", { name: /Auto-fill & Continue/i })).toBeDisabled();
    });
  });

  describe("insufficient → Let Me Answer | Auto-fill & Continue", () => {
    it("shows correct title and buttons", () => {
      render(<TransitionGateDialog {...gate2Props} verdict="insufficient" evaluation={insufficientEval} />);
      expect(screen.getByText("Refinements Need Attention")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Auto-fill & Continue/i })).toBeInTheDocument();
    });

    it("Auto-fill & Continue calls onAutofillAndSkip", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate2Props} verdict="insufficient" evaluation={insufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Auto-fill & Continue/i }));
      expect(defaultHandlers.onAutofillAndSkip).toHaveBeenCalledOnce();
    });

    it("Let Me Answer calls onLetMeAnswer", async () => {
      const user = userEvent.setup();
      render(<TransitionGateDialog {...gate2Props} verdict="insufficient" evaluation={insufficientEval} />);
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(defaultHandlers.onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("disables Auto-fill button when isAutofilling", () => {
      render(<TransitionGateDialog {...gate2Props} verdict="insufficient" evaluation={insufficientEval} isAutofilling />);
      expect(screen.getByRole("button", { name: /Auto-fill & Continue/i })).toBeDisabled();
    });
  });
});

// ─── Evaluation Breakdown ─────────────────────────────────────────────────────

describe("TransitionGateDialog — EvaluationBreakdown", () => {
  const props = { open: true, context: "clarifications" as const, ...defaultHandlers };

  it("shows contradictory category with conflict info", () => {
    const eval_ = makeEvaluation("mixed", [
      { question_id: "Q1", verdict: "contradictory", contradicts: "Q3" },
      { question_id: "Q2", verdict: "clear" },
      { question_id: "Q3", verdict: "clear" },
    ]);
    render(<TransitionGateDialog {...props} verdict="mixed" evaluation={eval_} />);
    const breakdown = screen.getByTestId("question-breakdown");
    expect(breakdown).toHaveTextContent(/Contradictory:/);
    expect(breakdown).toHaveTextContent("Q1 (conflicts with Q3)");
  });

  it("shows all five categories when all present", () => {
    const eval_ = makeEvaluation("mixed", [
      { question_id: "Q1", verdict: "clear" },
      { question_id: "Q2", verdict: "not_answered" },
      { question_id: "Q3", verdict: "vague" },
      { question_id: "Q4", verdict: "contradictory", contradicts: "Q1" },
      { question_id: "Q5", verdict: "needs_refinement" },
    ]);
    render(<TransitionGateDialog {...props} verdict="mixed" evaluation={eval_} />);
    const breakdown = screen.getByTestId("question-breakdown");
    expect(breakdown).toHaveTextContent(/OK:/);
    expect(breakdown).toHaveTextContent(/Missing:.*Q2/);
    expect(breakdown).toHaveTextContent(/Vague:.*Q3/);
    expect(breakdown).toHaveTextContent(/Contradictory:.*Q4/);
    expect(breakdown).toHaveTextContent(/Needs refinement:.*Q5/);
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("TransitionGateDialog — Edge Cases", () => {
  const props = { open: true, context: "clarifications" as const, ...defaultHandlers };

  it("renders nothing when verdict is null", () => {
    const { container } = render(<TransitionGateDialog {...props} verdict={null} evaluation={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when open is false", () => {
    render(<TransitionGateDialog {...props} open={false} verdict="sufficient" evaluation={sufficientEval} />);
    expect(screen.queryByText("Skip Detailed Research?")).not.toBeInTheDocument();
  });
});
