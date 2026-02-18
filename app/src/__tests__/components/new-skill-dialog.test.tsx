import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockInvoke, resetTauriMocks } from "@/test/mocks/tauri";
import { toast } from "sonner";

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

import NewSkillDialog from "@/components/new-skill-dialog";
import { useSettingsStore } from "@/stores/settings-store";

// Helper: open dialog
async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /New Skill/i }));
}

// Helper: fill Step 1 (name + type) and advance to Step 2
async function fillStep1AndAdvance(
  user: ReturnType<typeof userEvent.setup>,
  name = "test-skill",
  typeLabel = /Platform/i,
) {
  const nameInput = screen.getByLabelText("Skill Name");
  await user.type(nameInput, name);
  await user.click(screen.getByRole("radio", { name: typeLabel }));
  await user.click(screen.getByRole("button", { name: /Next/i }));
}

// Helper: advance from Step 2 to Step 3
async function advanceToStep3(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /^Next$/i }));
}

function renderDialog(props: Partial<React.ComponentProps<typeof NewSkillDialog>> = {}) {
  return render(
    <NewSkillDialog
      workspacePath="/workspace"
      onCreated={props.onCreated ?? vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
      tagSuggestions={props.tagSuggestions}
    />,
  );
}

describe("NewSkillDialog", () => {
  beforeEach(() => {
    resetTauriMocks();
    mockNavigate.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    useSettingsStore.getState().reset();
  });

  // --- Trigger & dialog open ---

  it("renders trigger button", () => {
    renderDialog();
    expect(
      screen.getByRole("button", { name: /New Skill/i }),
    ).toBeInTheDocument();
  });

  it("opens dialog on Step 1 when trigger button is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    expect(screen.getByText("Create New Skill")).toBeInTheDocument();
    expect(
      screen.getByText("Name your skill and choose its type."),
    ).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  });

  // --- Step 1: Name + Type ---

  it("renders skill name input and type radio group on Step 1", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    expect(screen.getByLabelText("Skill Name")).toBeInTheDocument();
    expect(screen.getByText("Skill Type")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Data Engineering")).toBeInTheDocument();
    expect(screen.getByText(/Business domain knowledge/)).toBeInTheDocument();
  });

  it("enforces kebab-case on skill name input", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "Sales Pipeline");

    // toKebabChars strips non-[a-z0-9-] chars (spaces removed, uppercase lowered)
    expect(nameInput).toHaveValue("salespipeline");
  });

  it("disables Next button when name is empty", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  it("disables Next button when skill type is not selected", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByLabelText("Skill Name"), "test-skill");

    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(nextButton).toBeDisabled();
  });

  it("enables Next button when name is valid and type selected", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    await user.type(screen.getByLabelText("Skill Name"), "test-skill");
    await user.click(screen.getByRole("radio", { name: /Platform/i }));

    const nextButton = screen.getByRole("button", { name: /Next/i });
    expect(nextButton).toBeEnabled();
  });

  it("does not show Create button on Step 1", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    expect(screen.queryByRole("button", { name: /^Create$/i })).not.toBeInTheDocument();
  });

  it("has Cancel button on Step 1 that closes dialog", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);

    expect(screen.getByText("Create New Skill")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Create New Skill")).not.toBeInTheDocument();
    });
  });

  // --- Step 2: Domain ---

  it("advances to Step 2 when Next is clicked", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(
      screen.getByText("Describe the domain, scope, and tags."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Domain")).toBeInTheDocument();
    expect(screen.getByLabelText("Scope")).toBeInTheDocument();
    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("shows skills output location on Step 2 when skillsPath is set", async () => {
    useSettingsStore.getState().setSettings({ skillsPath: "/my/skills" });
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user, "sales-pipeline");

    expect(screen.getByText(/\/my\/skills\/sales-pipeline\//)).toBeInTheDocument();
  });

  it("shows Back, Next, and Create buttons on Step 2", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);

    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Next$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Create$/i })).toBeInTheDocument();
  });

  it("navigates back to Step 1 when Back is clicked on Step 2", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back/i }));

    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill Name")).toBeInTheDocument();
  });

  it("can submit from Step 2 with Create button", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
    renderDialog({ onCreated });

    await openDialog(user);
    await fillStep1AndAdvance(user, "sales-pipeline", /Domain/i);

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_skill", {
        workspacePath: "/workspace",
        name: "sales-pipeline",
        domain: "sales pipeline",
        tags: null,
        skillType: "domain",
        intakeJson: null,
      });
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Skill "sales-pipeline" created',
    );
  });

  it("uses explicit domain when provided on Step 2", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);
    renderDialog();

    await openDialog(user);
    await fillStep1AndAdvance(user, "sales-pipeline", /Domain/i);

    const domainInput = screen.getByLabelText("Domain");
    await user.type(domainInput, "Revenue Pipeline Analysis");

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_skill", {
        workspacePath: "/workspace",
        name: "sales-pipeline",
        domain: "Revenue Pipeline Analysis",
        tags: null,
        skillType: "domain",
        intakeJson: null,
      });
    });
  });

  // --- Step 3: Optional fields ---

  it("advances to Step 3 when Next is clicked on Step 2", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);
    await advanceToStep3(user);

    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();
    expect(
      screen.getByText("Add optional details to guide research."),
    ).toBeInTheDocument();
  });

  it("renders all optional fields on Step 3", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);
    await advanceToStep3(user);

    expect(screen.getByLabelText("Target Audience")).toBeInTheDocument();
    expect(screen.getByLabelText("Key Challenges")).toBeInTheDocument();
    expect(screen.getByLabelText("What makes your setup unique?")).toBeInTheDocument();
    expect(screen.getByLabelText("What does Claude get wrong?")).toBeInTheDocument();
  });

  it("shows Back and Create buttons on Step 3 (no Next)", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);
    await advanceToStep3(user);

    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Create$/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Next$/i })).not.toBeInTheDocument();
  });

  it("navigates back to Step 2 when Back is clicked on Step 3", async () => {
    const user = userEvent.setup();
    renderDialog();
    await openDialog(user);
    await fillStep1AndAdvance(user);
    await advanceToStep3(user);

    expect(screen.getByText("Step 3 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Back/i }));

    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();
    expect(screen.getByLabelText("Domain")).toBeInTheDocument();
  });

  // --- Submit scenarios ---

  it("passes selected skillType to invoke on submit", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);
    renderDialog();

    await openDialog(user);
    await fillStep1AndAdvance(user, "etl-patterns", /Data Engineering/i);

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_skill", {
        workspacePath: "/workspace",
        name: "etl-patterns",
        domain: "etl patterns",
        tags: null,
        skillType: "data-engineering",
        intakeJson: null,
      });
    });
  });

  it("passes tags to invoke when tags are added on Step 2", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);
    renderDialog();

    await openDialog(user);
    await fillStep1AndAdvance(user, "test-domain", /Source/i);

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(tagInput, "analytics{Enter}");
    await user.type(tagInput, "salesforce{Enter}");

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_skill", {
        workspacePath: "/workspace",
        name: "test-domain",
        domain: "test domain",
        tags: ["analytics", "salesforce"],
        skillType: "source",
        intakeJson: null,
      });
    });
  });

  it("navigates to skill editor after successful creation", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);
    renderDialog({ onCreated });

    await openDialog(user);
    await fillStep1AndAdvance(user, "sales-pipeline", /Domain/i);

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/skill/$skillName",
      params: { skillName: "sales-pipeline" },
    });
  });

  // --- Error handling ---

  it("does not navigate on failed creation", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Skill already exists"));
    renderDialog();

    await openDialog(user);
    await fillStep1AndAdvance(user);

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Skill already exists")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows error message and toast on failed submit", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Skill already exists"));
    renderDialog();

    await openDialog(user);
    await fillStep1AndAdvance(user);

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Skill already exists")).toBeInTheDocument();
    });
    expect(toast.error).toHaveBeenCalledWith("Failed to create skill", {
      duration: Infinity,
    });
  });

  // --- Tag autocomplete ---

  it("forwards tagSuggestions to TagInput as suggestions", async () => {
    const user = userEvent.setup();
    renderDialog({ tagSuggestions: ["analytics", "salesforce", "workday"] });

    await openDialog(user);
    await fillStep1AndAdvance(user);

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(tagInput, "ana");

    // Suggestion from tagSuggestions should appear
    expect(screen.getByText("analytics")).toBeInTheDocument();
    // Non-matching suggestions should not appear
    expect(screen.queryByText("workday")).not.toBeInTheDocument();
  });

  it("shows autocomplete dropdown and allows selecting a suggestion", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);
    renderDialog({ tagSuggestions: ["analytics", "salesforce", "workday"] });

    await openDialog(user);
    await fillStep1AndAdvance(user, "test");

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(tagInput, "sale");

    // Autocomplete dropdown should show matching suggestion
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("salesforce")).toBeInTheDocument();
    expect(screen.queryByText("analytics")).not.toBeInTheDocument();

    // Select the suggestion via keyboard
    await user.keyboard("{ArrowDown}{Enter}");

    // Suggestion should be added as a tag badge
    expect(screen.getByText("salesforce")).toBeInTheDocument();
    // Dropdown should be dismissed
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    // Submit to verify the selected suggestion is included in the invoke call
    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("create_skill", {
        workspacePath: "/workspace",
        name: "test",
        domain: "test",
        tags: ["salesforce"],
        skillType: "platform",
        intakeJson: null,
      });
    });
  });

  it("autocomplete matches case-insensitively", async () => {
    const user = userEvent.setup();
    renderDialog({ tagSuggestions: ["Analytics", "Salesforce"] });

    await openDialog(user);
    await fillStep1AndAdvance(user);

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(tagInput, "ANA");

    // Should match case-insensitively
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.queryByText("Salesforce")).not.toBeInTheDocument();
  });

  it("hides already-added tags from autocomplete suggestions", async () => {
    const user = userEvent.setup();
    renderDialog({ tagSuggestions: ["analytics", "anomaly"] });

    await openDialog(user);
    await fillStep1AndAdvance(user);

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });

    // Add "analytics" as a tag
    await user.type(tagInput, "analytics{Enter}");

    // Now type "an" -- "analytics" should NOT appear since it's already added
    await user.type(tagInput, "an");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("anomaly");
  });
});
