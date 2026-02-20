import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransitionGateDialog } from "@/components/transition-gate-dialog";
import type { PerQuestionVerdict } from "@/lib/tauri";

const defaultProps = {
  open: true,
  verdict: null as null,
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
    it("shows 'Auto-fill Missing Answers?' title", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" />
      );
      expect(screen.getByText("Auto-fill Missing Answers?")).toBeInTheDocument();
    });

    it("shows unanswered count when provided", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" totalCount={9} unansweredCount={5} />
      );
      expect(screen.getByText(/5 of 9/)).toBeInTheDocument();
    });

    it("has 'Auto-fill & Research' and 'Let Me Answer' buttons", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" />
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
        <TransitionGateDialog {...defaultProps} verdict="mixed" onLetMeAnswer={onLetMeAnswer} />
      );
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("disables 'Auto-fill & Research' button when isAutofilling is true", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" isAutofilling={true} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeDisabled();
    });

    it("enables 'Auto-fill & Research' button when isAutofilling is false", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" isAutofilling={false} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Research/i })).toBeEnabled();
    });
  });

  describe("insufficient verdict", () => {
    it("shows 'Use Recommended Answers?' title with counts", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" totalCount={8} unansweredCount={8} />
      );
      expect(screen.getByText("Use Recommended Answers?")).toBeInTheDocument();
      expect(screen.getByText(/8 of 8/)).toBeInTheDocument();
    });

    it("has 'Auto-fill & Skip' and 'Let Me Answer' buttons", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
    });

    it("calls onAutofillAndSkip when 'Auto-fill & Skip' is clicked", async () => {
      const user = userEvent.setup();
      const onAutofillAndSkip = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" onAutofillAndSkip={onAutofillAndSkip} />
      );
      await user.click(screen.getByRole("button", { name: /Auto-fill & Skip/i }));
      expect(onAutofillAndSkip).toHaveBeenCalledOnce();
    });

    it("calls onLetMeAnswer when 'Let Me Answer' is clicked", async () => {
      const user = userEvent.setup();
      const onLetMeAnswer = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" onLetMeAnswer={onLetMeAnswer} />
      );
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(onLetMeAnswer).toHaveBeenCalledOnce();
    });

    it("disables 'Auto-fill & Skip' button when isAutofilling is true", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" isAutofilling={true} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeDisabled();
    });
  });

  describe("per-question breakdown", () => {
    const perQuestion: PerQuestionVerdict[] = [
      { question_id: "Q1", verdict: "clear" },
      { question_id: "Q2", verdict: "not_answered" },
      { question_id: "Q3", verdict: "vague" },
      { question_id: "Q4", verdict: "not_answered" },
      { question_id: "Q5", verdict: "clear" },
      { question_id: "Q6", verdict: "vague" },
    ];

    it("shows unanswered and vague IDs for mixed verdict", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" perQuestion={perQuestion} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("Unanswered: Q2, Q4");
      expect(breakdown).toHaveTextContent("Vague: Q3, Q6");
    });

    it("shows unanswered and vague IDs for insufficient verdict", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="insufficient" perQuestion={perQuestion} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("Unanswered: Q2, Q4");
      expect(breakdown).toHaveTextContent("Vague: Q3, Q6");
    });

    it("does not show breakdown for sufficient verdict", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" perQuestion={perQuestion} />
      );
      expect(screen.queryByTestId("question-breakdown")).not.toBeInTheDocument();
    });

    it("does not show breakdown when perQuestion is empty", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" perQuestion={[]} />
      );
      expect(screen.queryByTestId("question-breakdown")).not.toBeInTheDocument();
    });

    it("shows only unanswered when no vague questions", () => {
      const onlyUnanswered: PerQuestionVerdict[] = [
        { question_id: "Q1", verdict: "not_answered" },
        { question_id: "Q2", verdict: "clear" },
      ];
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" perQuestion={onlyUnanswered} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).toHaveTextContent("Unanswered: Q1");
      expect(breakdown).not.toHaveTextContent("Vague:");
    });

    it("shows only vague when no unanswered questions", () => {
      const onlyVague: PerQuestionVerdict[] = [
        { question_id: "Q1", verdict: "vague" },
        { question_id: "Q2", verdict: "clear" },
      ];
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" perQuestion={onlyVague} />
      );
      const breakdown = screen.getByTestId("question-breakdown");
      expect(breakdown).not.toHaveTextContent("Unanswered:");
      expect(breakdown).toHaveTextContent("Vague: Q1");
    });
  });
});
