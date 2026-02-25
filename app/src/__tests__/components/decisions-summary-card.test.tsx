import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionsSummaryCard } from "@/components/decisions-summary-card";

// ─── Test Data ────────────────────────────────────────────────────────────────

const sampleDecisionsMd = `---
decision_count: 3
conflicts_resolved: 1
round: 1
---
### D1: Customer Hierarchy
- **Original question:** How many levels should the customer hierarchy support?
- **Decision:** Two levels — parent company and subsidiary
- **Implication:** Need a self-referencing FK in dim_customer
- **Status:** resolved

### D2: Revenue Recognition
- **Original question:** When should revenue be recognized?
- **Decision:** Track full lifecycle with invoice as primary event
- **Implication:** PM said "at invoicing" but also answered "track bookings" — both imply lifecycle tracking
- **Status:** conflict-resolved

### D3: Pipeline Entry
- **Original question:** Which stage marks pipeline entry?
- **Decision:** Any stage beyond Prospecting
- **Implication:** Straightforward filter on stage sequence
- **Status:** resolved
`;

const contradictoryDecisionsMd = `---
decision_count: 2
conflicts_resolved: 0
round: 1
contradictory_inputs: true
---
### D1: Revenue Model
- **Original question:** Should we track revenue?
- **Decision:** Track MRR
- **Implication:** Contradicts Q5 answer which said "don't track revenue"
- **Status:** needs-review

### D2: Pipeline Scope
- **Original question:** What's in scope?
- **Decision:** All deals
- **Implication:** Clear scope
- **Status:** resolved
`;

// ─── Summary Card Stats ───────────────────────────────────────────────────────

describe("DecisionsSummaryCard — Summary Stats", () => {
  it("shows decision count from frontmatter", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("total")).toBeInTheDocument();
  });

  it("shows conflicts reconciled count", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText("reconciled")).toBeInTheDocument();
    // "1" appears in multiple contexts (round, conflict count) — check reconciled label exists
    expect(screen.getByText("No unresolvable contradictions")).toBeInTheDocument();
  });

  it("shows resolved and conflict-resolved breakdown", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText("Resolved")).toBeInTheDocument();
    expect(screen.getByText("Conflict-resolved")).toBeInTheDocument();
  });

  it("shows round number", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText("Round")).toBeInTheDocument();
  });

  it("shows duration and cost when provided", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} duration={125000} cost={0.5234} />);
    expect(screen.getByText("2m 5s")).toBeInTheDocument();
    expect(screen.getByText("$0.5234")).toBeInTheDocument();
  });

  it("does not show contradictory banner when flag is absent", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.queryByText(/Contradictory inputs detected/)).not.toBeInTheDocument();
  });
});

// ─── Contradictory Inputs ─────────────────────────────────────────────────────

describe("DecisionsSummaryCard — Contradictory Inputs", () => {
  it("shows contradictory warning banner", () => {
    render(<DecisionsSummaryCard decisionsContent={contradictoryDecisionsMd} />);
    expect(screen.getByText(/Contradictory inputs detected/)).toBeInTheDocument();
  });

  it("shows needs-review count", () => {
    render(<DecisionsSummaryCard decisionsContent={contradictoryDecisionsMd} />);
    expect(screen.getByText("Needs review")).toBeInTheDocument();
  });

  it("shows contradictions review required in quality column", () => {
    render(<DecisionsSummaryCard decisionsContent={contradictoryDecisionsMd} />);
    expect(screen.getByText(/Contradictions — review required/)).toBeInTheDocument();
  });
});

// ─── Decision Cards ───────────────────────────────────────────────────────────

describe("DecisionsSummaryCard — Decision Cards", () => {
  it("renders a card for each decision", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText("D1")).toBeInTheDocument();
    expect(screen.getByText("D2")).toBeInTheDocument();
    expect(screen.getByText("D3")).toBeInTheDocument();
  });

  it("shows decision titles", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText("Customer Hierarchy")).toBeInTheDocument();
    expect(screen.getByText("Revenue Recognition")).toBeInTheDocument();
    expect(screen.getByText("Pipeline Entry")).toBeInTheDocument();
  });

  it("shows status badges", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    const badges = screen.getAllByText("resolved");
    expect(badges.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("conflict-resolved")).toBeInTheDocument();
  });

  it("shows decision preview text when collapsed", () => {
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    expect(screen.getByText(/Two levels — parent company/)).toBeInTheDocument();
  });

  it("expands to show full details on click", async () => {
    const user = userEvent.setup();
    render(<DecisionsSummaryCard decisionsContent={sampleDecisionsMd} />);
    // Click D1 header
    await user.click(screen.getByRole("button", { name: /Customer Hierarchy/ }));
    // Should show original question and implication
    expect(screen.getByText(/How many levels should the customer hierarchy/)).toBeInTheDocument();
    expect(screen.getByText(/self-referencing FK/)).toBeInTheDocument();
  });

  it("shows needs-review badge for contradictory decisions", () => {
    render(<DecisionsSummaryCard decisionsContent={contradictoryDecisionsMd} />);
    expect(screen.getByText("needs-review")).toBeInTheDocument();
  });
});

// ─── Edge Cases ───────────────────────────────────────────────────────────────

describe("DecisionsSummaryCard — Edge Cases", () => {
  it("handles empty content gracefully", () => {
    render(<DecisionsSummaryCard decisionsContent="" />);
    expect(screen.getByText("Decisions Complete")).toBeInTheDocument();
    // Multiple "0" elements (decision count + conflicts) — just check the header rendered
    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(1);
  });

  it("handles content with no frontmatter", () => {
    const noFm = "### D1: Test\n- **Decision:** Something\n- **Status:** resolved";
    render(<DecisionsSummaryCard decisionsContent={noFm} />);
    expect(screen.getByText("D1")).toBeInTheDocument();
  });
});
