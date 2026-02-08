import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ClarificationForm } from "@/components/clarification-form";
import type { ClarificationFile } from "@/lib/tauri";

const sampleFile: ClarificationFile = {
  sections: [
    {
      heading: "Domain Concepts",
      questions: [
        {
          id: "Q1",
          title: "Primary focus",
          question: "What is the primary focus area?",
          choices: [
            {
              letter: "a",
              text: "Sales forecasting",
              rationale: "predict future revenue",
            },
            {
              letter: "b",
              text: "Pipeline management",
              rationale: "track deal progression",
            },
            {
              letter: "c",
              text: "Other (please specify)",
              rationale: "",
            },
          ],
          recommendation: "b — most actionable for day-to-day work",
          answer: null,
        },
        {
          id: "Q2",
          title: "Data granularity",
          question: "What level of data granularity is needed?",
          choices: [
            {
              letter: "a",
              text: "Deal-level",
              rationale: "individual opportunities",
            },
            {
              letter: "b",
              text: "Account-level",
              rationale: "aggregated by company",
            },
          ],
          recommendation: null,
          answer: null,
        },
      ],
    },
  ],
};

describe("ClarificationForm", () => {
  it("renders section heading", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    expect(screen.getByText("Domain Concepts")).toBeInTheDocument();
  });

  it("renders question titles", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    expect(screen.getByText("Q1: Primary focus")).toBeInTheDocument();
    expect(screen.getByText("Q2: Data granularity")).toBeInTheDocument();
  });

  it("renders question text", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    expect(
      screen.getByText("What is the primary focus area?")
    ).toBeInTheDocument();
  });

  it("renders radio buttons for choices", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    expect(screen.getByLabelText(/Sales forecasting/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Pipeline management/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Other/)).toBeInTheDocument();
  });

  it("renders recommendation when present", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    expect(
      screen.getByText(/most actionable for day-to-day work/)
    ).toBeInTheDocument();
  });

  it("shows progress counter", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    expect(screen.getByText("0 of 2 answered")).toBeInTheDocument();
  });

  it("updates progress when selecting a choice", async () => {
    const user = userEvent.setup();
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );

    const radio = screen.getByLabelText(/Sales forecasting/);
    await user.click(radio);

    expect(screen.getByText("1 of 2 answered")).toBeInTheDocument();
  });

  it("calls onSave with updated answers", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<ClarificationForm file={sampleFile} onSave={onSave} />);

    // Select answer for Q1
    await user.click(screen.getByLabelText(/Pipeline management/));

    // Click save
    await user.click(screen.getByRole("button", { name: /Save All Answers/ }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const savedFile = onSave.mock.calls[0][0] as ClarificationFile;
    expect(savedFile.sections[0].questions[0].answer).toBe("b");
    // Q2 unanswered
    expect(savedFile.sections[0].questions[1].answer).toBeNull();
  });

  it("disables save button when no answers selected", () => {
    render(
      <ClarificationForm file={sampleFile} onSave={vi.fn()} />
    );
    const saveButton = screen.getByRole("button", {
      name: /Save All Answers/,
    });
    expect(saveButton).toBeDisabled();
  });

  it("pre-fills existing answers", () => {
    const fileWithAnswer: ClarificationFile = {
      sections: [
        {
          heading: "Review",
          questions: [
            {
              id: "Q1",
              title: "Topic",
              question: "Pick one",
              choices: [
                { letter: "a", text: "First", rationale: "reason" },
                { letter: "b", text: "Second", rationale: "reason" },
              ],
              recommendation: null,
              answer: "a",
            },
          ],
        },
      ],
    };

    render(
      <ClarificationForm file={fileWithAnswer} onSave={vi.fn()} />
    );
    expect(screen.getByText("1 of 1 answered")).toBeInTheDocument();
  });
});
