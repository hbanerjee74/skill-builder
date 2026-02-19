import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TransitionGateDialog } from "@/components/transition-gate-dialog";

const defaultProps = {
  open: true,
  verdict: null as const,
  onSkip: vi.fn(),
  onAutofillAndSkip: vi.fn(),
  onContinue: vi.fn(),
};

describe("TransitionGateDialog", () => {
  it("renders nothing when verdict is null", () => {
    const { container } = render(
      <TransitionGateDialog {...defaultProps} verdict={null} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when verdict is insufficient", () => {
    const { container } = render(
      <TransitionGateDialog {...defaultProps} verdict="insufficient" />
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

    it("calls onContinue when 'Run Research Anyway' is clicked", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="sufficient" onContinue={onContinue} />
      );
      await user.click(screen.getByRole("button", { name: /Run Research Anyway/i }));
      expect(onContinue).toHaveBeenCalledOnce();
    });
  });

  describe("mixed verdict", () => {
    it("shows 'Auto-fill Missing Answers?' title", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" />
      );
      expect(screen.getByText("Auto-fill Missing Answers?")).toBeInTheDocument();
    });

    it("has 'Auto-fill & Skip' and 'Let Me Answer' buttons", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Let Me Answer/i })).toBeInTheDocument();
    });

    it("calls onAutofillAndSkip when 'Auto-fill & Skip' is clicked", async () => {
      const user = userEvent.setup();
      const onAutofillAndSkip = vi.fn();
      render(
        <TransitionGateDialog
          {...defaultProps}
          verdict="mixed"
          onAutofillAndSkip={onAutofillAndSkip}
        />
      );
      await user.click(screen.getByRole("button", { name: /Auto-fill & Skip/i }));
      expect(onAutofillAndSkip).toHaveBeenCalledOnce();
    });

    it("calls onContinue when 'Let Me Answer' is clicked", async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" onContinue={onContinue} />
      );
      await user.click(screen.getByRole("button", { name: /Let Me Answer/i }));
      expect(onContinue).toHaveBeenCalledOnce();
    });

    it("disables 'Auto-fill & Skip' button when isAutofilling is true", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" isAutofilling={true} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeDisabled();
    });

    it("enables 'Auto-fill & Skip' button when isAutofilling is false", () => {
      render(
        <TransitionGateDialog {...defaultProps} verdict="mixed" isAutofilling={false} />
      );
      expect(screen.getByRole("button", { name: /Auto-fill & Skip/i })).toBeEnabled();
    });
  });
});
