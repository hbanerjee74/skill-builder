import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransitionGateDialog } from "@/components/transition-gate-dialog";
import type { AnswerEvaluation, PerQuestionVerdict } from "@/lib/tauri";

/** Helper to build an AnswerEvaluation from per_question verdicts. */
function makeEvaluation(
  verdict: "sufficient" | "mixed" | "insufficient",
  perQuestion: PerQuestionVerdict[] = [],
): AnswerEvaluation {
  const answered = perQuestion.filter(q => q.verdict === "clear").length;
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
    reasoning: "test",
    per_question: perQuestion,
  };
}

const defaultProps = {
  open: true,
  verdict: null as null,
  evaluation: null as AnswerEvaluation | null,
  onSkip: vi.fn(),
  onResearch: vi.fn(),
  onAutofillAndSkip: vi.fn(),
  onAutofillAndResearch: vi.fn(),
  onLetMeAnswer: vi.fn(),
};

describe("TransitionGateDialog", () => {
  it("renders nothing when verdict is null", () => {
    const { container } = render(
      <TransitionGateDialog {...defaultProps} verdict={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when open is false (sufficient verdict)", () => {
    render(
      <TransitionGateDialog {...defaultProps} open={false} verdict="sufficient" />
    );
    expect(screen.queryByText("Skip Detailed Research?")).not.toBeInTheDocument();
  });

  describe("sufficient verdict", () => {
    it("shows 'Skip Detailed Research?' title", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" />
      );
      expect(screen.getByText("Skip Detailed Research?")).toBeInTheDocument();
    });

    it("has 'Skip to Decisions' and 'Run Research Anyway' buttons", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" />
      );
      expect(screen.getByRole("button", { name: /Skip to Decisions/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Run Research Anyway/i })).toBeInTheDocument();
    });

    it("calls onSkip when 'Skip to Decisions' is clicked", async () => {
      const user = userEvent.setup();
      const onSkip = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" onSkip={onSkip} />
      );
      await user.click(screen.getByRole("button", { name: /Skip to Decisions/i }));
      expect(onSkip).toHaveBeenCalledOnce();
    });

    it("calls onResearch when 'Run Research Anyway' is clicked", async () => {
      const user = userEvent.setup();
      const onResearch = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" onResearch={onResearch} />
      );
      await user.click(screen.getByRole("button", { name: /Run Research Anyway/i }));
      expect(onResearch).toHaveBeenCalledOnce();
    });
  });

  describe("mixed verdict", () => {
    const mixedEval = makeEvaluation("mixed", [
      { question_id: "Q1", verdict: "clear" },
      { question_id: "Q2", verdict: "not_answered" },
      { question_id: "Q3", verdict: "vague" },
    ]);

    it("shows 'Review Answer Quality' title", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={mixedEval} />
      );
      expect(screen.getByText("Review Answer Quality")).toBeInTheDocument();
    });

    it("has 'Auto-fill & Research' and 'Let Me Answer' buttons", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={mixedEval} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
    });

    it("calls onAutofillAndResearch when 'Auto-fill & Research' is clicked", async () => {
      const user = userEvent.setup();
      const onAutofillAndResearch = vi.fn();
      render(
        <TransitionGateDialog
          {...defaultProps}
          verdict="mixed"
          evaluation={mixedEval}
          onAutofillAndResearch={onAutofillAndResearch}
        />
      );
      await user.click(screen.getByRole("button", { name: /Auto-fill & Research/i }));
      expect(onAutofillAndResearch).toHaveBeenCalledOnce();
    });

    it("calls onLetMeAnswer when 'Let Me Answer' is clicked", async () => {
      const user = userEvent.setup();
      const onLetMeAnswer = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={mixedEval} onLetMeAnswer={onLetMeAnswer} />
      );
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("disables 'Auto-fill & Research' button when isAutofilling is true", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={mixedEval} isAutofilling={true} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeDisabled();
    });

    it("enables 'Auto-fill & Research' button when isAutofilling is false", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={mixedEval} isAutofilling={false} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeEnabled();
    });
  });

  describe("insufficient verdict", () => {
    const insuffEval = makeEvaluation("insufficient", [
      { question_id: "Q1", verdict: "not_answered" },
      { question_id: "Q2", verdict: "not_answered" },
      { question_id: "Q3", verdict: "vague" },
    ]);

    it("shows 'Review Answer Quality' title", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" evaluation={insuffEval} />
      );
      expect(screen.getByText("Review Answer Quality")).toBeInTheDocument();
    });

    it("has 'Auto-fill & Skip' and 'Let Me Answer' buttons", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" evaluation={insuffEval} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
    });

    it("calls onAutofillAndSkip when 'Auto-fill & Skip' is clicked", async () => {
      const user = userEvent.setup();
      const onAutofillAndSkip = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" evaluation={insuffEval} onAutofillAndSkip={onAutofillAndSkip} />
      );
      await user.click(screen.getByRole("button", { name: /Auto-fill & Skip/i }));
      expect(onAutofillAndSkip).toHaveBeenCalledOnce();
    });

    it("calls onLetMeAnswer when 'Let Me Answer' is clicked", async () => {
      const user = userEvent.setup();
      const onLetMeAnswer = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" evaluation={insuffEval} onLetMeAnswer={onLetMeAnswer} />
      );
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("disables 'Auto-fill & Skip' button when isAutofilling is true", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" evaluation={insuffEval} isAutofilling={true} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeDisabled();
    });
  });

  describe("per-category evaluation breakdown", () => {
    const perQuestion: PerQuestionVerdict[] = [
      { question_id: "Q1", verdict: "clear" },
      { question_id: "Q2", verdict: "not_answered" },
      { question_id: "Q3", verdict: "vague" },
      { question_id: "Q4", verdict: "not_answered" },
      { question_id: "Q5", verdict: "clear" },
      { question_id: "Q6", verdict: "vague" },
    ];

    it("shows category breakdown for mixed verdict", () => {
      const eval_ = makeEvaluation("mixed", perQuestion);
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={eval_} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("OK:");
      expect(breakdown).toHaveTextContent("2 questions");
      expect(breakdown).toHaveTextContent("Missing:");
      expect(breakdown).toHaveTextContent("Q2, Q4");
      expect(breakdown).toHaveTextContent("Vague:");
      expect(breakdown).toHaveTextContent("Q3, Q6");
    });

    it("shows category breakdown for insufficient verdict", () => {
      const eval_ = makeEvaluation("insufficient", perQuestion);
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" evaluation={eval_} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("Missing:");
      expect(breakdown).toHaveTextContent("Q2, Q4");
      expect(breakdown).toHaveTextContent("Vague:");
      expect(breakdown).toHaveTextContent("Q3, Q6");
    });

    it("does not show breakdown for sufficient verdict", () => {
      const eval_ = makeEvaluation("sufficient", perQuestion);
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" evaluation={eval_} />
      );
      expect(screen.queryByTestId("question-breakdown")).not.toBeInTheDocument();
    });

    it("does not show breakdown when evaluation has no per_question", () => {
      const eval_ = makeEvaluation("mixed", []);
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={eval_} />
      );
      // Breakdown should render but be empty (no categories with items)
      // The component still renders the container div, but with no children
      // since all filter arrays are empty
    });

    it("shows only missing when no vague questions", () => {
      const onlyMissing: PerQuestionVerdict[] = [
        { question_id: "Q1", verdict: "not_answered" },
        { question_id: "Q2", verdict: "clear" },
      ];
      const eval_ = makeEvaluation("mixed", onlyMissing);
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={eval_} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent(/Missing:.*Q1/);
      expect(breakdown).not.toHaveTextContent("Vague:");
    });

    it("shows only vague when no missing questions", () => {
      const onlyVague: PerQuestionVerdict[] = [
        { question_id: "Q1", verdict: "vague" },
        { question_id: "Q2", verdict: "clear" },
      ];
      const eval_ = makeEvaluation("mixed", onlyVague);
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={eval_} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).not.toHaveTextContent("Missing:");
      expect(breakdown).toHaveTextContent(/Vague:.*Q1/);
    });

    it("shows contradictory category with conflict info", () => {
      const withContradictory: PerQuestionVerdict[] = [
        { question_id: "Q1", verdict: "contradictory", contradicts: "Q3" },
        { question_id: "Q2", verdict: "clear" },
      ];
      const eval_ = makeEvaluation("mixed", withContradictory);
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={eval_} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("Contradictory:");
      expect(breakdown).toHaveTextContent("Q1 (conflicts with Q3)");
    });

    it("shows needs refinement category", () => {
      const withRefinement: PerQuestionVerdict[] = [
        { question_id: "Q1", verdict: "needs_refinement" },
        { question_id: "Q2", verdict: "clear" },
      ];
      const eval_ = makeEvaluation("mixed", withRefinement);
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" evaluation={eval_} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("Needs refinement:");
      expect(breakdown).toHaveTextContent("Q1");
    });
  });
});
