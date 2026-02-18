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

describe("NewSkillDialog", () => {
  beforeEach(() => {
    resetTauriMocks();
    mockNavigate.mockReset();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
  });

  it("renders trigger button", () => {
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );
    expect(
      screen.getByRole("button", { name: /New Skill/i })
    ).toBeInTheDocument();
  });

  it("opens dialog when trigger button is clicked", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    expect(screen.getByText("Create New Skill")).toBeInTheDocument();
    expect(
      screen.getByText("Define the scope and context for your new skill.")
    ).toBeInTheDocument();
  });

  it("renders skill name and domain inputs in dialog", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    expect(screen.getByLabelText("Skill Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Domain")).toBeInTheDocument();
  });

  it("enforces kebab-case on skill name input", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "Sales Pipeline");

    // toKebabChars strips non-[a-z0-9-] chars (spaces removed, uppercase lowered)
    expect(nameInput).toHaveValue("salespipeline");
  });

  it("disables Create button when name is empty", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    expect(createButton).toBeDisabled();
  });

  it("enables Create button when name and skill type are set", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "test-skill");

    await user.click(screen.getByRole("radio", { name: /Platform/i }));

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    expect(createButton).toBeEnabled();
  });

  it("disables Create button when skill type is not selected", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "test-skill");

    // No skill type selected
    const createButton = screen.getByRole("button", { name: /^Create$/i });
    expect(createButton).toBeDisabled();
  });

  it("calls invoke create_skill and onCreated on successful submit", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={onCreated} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "sales-pipeline");

    await user.click(screen.getByRole("radio", { name: /Domain/i }));

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
      'Skill "sales-pipeline" created'
    );
  });

  it("navigates to skill editor after successful creation", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    mockInvoke.mockResolvedValue(undefined);

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={onCreated} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "sales-pipeline");

    await user.click(screen.getByRole("radio", { name: /Domain/i }));

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

  it("does not navigate on failed creation", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Skill already exists"));

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "test-skill");

    await user.click(screen.getByRole("radio", { name: /Platform/i }));

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Skill already exists")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows error message on failed submit", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("Skill already exists"));

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "test-skill");

    await user.click(screen.getByRole("radio", { name: /Platform/i }));

    const createButton = screen.getByRole("button", { name: /^Create$/i });
    await user.click(createButton);

    await waitFor(() => {
      expect(screen.getByText("Skill already exists")).toBeInTheDocument();
    });
    expect(toast.error).toHaveBeenCalledWith("Failed to create skill", { duration: Infinity });
  });

  it("has Cancel button that closes dialog", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));
    expect(screen.getByText("Create New Skill")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText("Create New Skill")).not.toBeInTheDocument();
    });
  });

  it("renders tag input in dialog", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    expect(screen.getByText("Tags")).toBeInTheDocument();
  });

  it("passes tags to invoke when tags are added", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "test-domain");

    await user.click(screen.getByRole("radio", { name: /Source/i }));

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

  it("renders skill type radio group with 4 options", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    expect(screen.getByText("Skill Type")).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
    expect(screen.getByText("Platform")).toBeInTheDocument();
    expect(screen.getByText("Source")).toBeInTheDocument();
    expect(screen.getByText("Data Engineering")).toBeInTheDocument();
    // Verify the Domain radio option exists by its description
    expect(screen.getByText(/Business domain knowledge/)).toBeInTheDocument();
  });

  it("passes selected skillType to invoke on submit", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "etl-patterns");

    await user.click(screen.getByRole("radio", { name: /Data Engineering/i }));

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

  it("uses explicit domain when provided", async () => {
    const user = userEvent.setup();
    mockInvoke.mockResolvedValue(undefined);

    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "sales-pipeline");

    await user.click(screen.getByRole("radio", { name: /Domain/i }));

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

  it("forwards tagSuggestions to TagInput as suggestions", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog
        workspacePath="/workspace"
        onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        tagSuggestions={["analytics", "salesforce", "workday"]}
      />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

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

    render(
      <NewSkillDialog
        workspacePath="/workspace"
        onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        tagSuggestions={["analytics", "salesforce", "workday"]}
      />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    // Fill required fields first
    const nameInput = screen.getByLabelText("Skill Name");
    await user.type(nameInput, "test");

    await user.click(screen.getByRole("radio", { name: /Platform/i }));

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
    render(
      <NewSkillDialog
        workspacePath="/workspace"
        onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        tagSuggestions={["Analytics", "Salesforce"]}
      />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });
    await user.type(tagInput, "ANA");

    // Should match case-insensitively
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByText("Analytics")).toBeInTheDocument();
    expect(screen.queryByText("Salesforce")).not.toBeInTheDocument();
  });

  it("hides already-added tags from autocomplete suggestions", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog
        workspacePath="/workspace"
        onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        tagSuggestions={["analytics", "anomaly"]}
      />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    const tagInput = screen.getByRole("textbox", { name: /tag input/i });

    // Add "analytics" as a tag
    await user.type(tagInput, "analytics{Enter}");

    // Now type "an" — "analytics" should NOT appear since it's already added
    await user.type(tagInput, "an");

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent("anomaly");
  });

  it("shows More options section when toggled", async () => {
    const user = userEvent.setup();
    render(
      <NewSkillDialog workspacePath="/workspace" onCreated={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)} />
    );

    await user.click(screen.getByRole("button", { name: /New Skill/i }));

    // Level 2 fields should not be visible initially
    expect(screen.queryByLabelText("Target Audience")).not.toBeInTheDocument();

    // Click "More options" expander
    await user.click(screen.getByText("More options"));

    // Level 2 fields should now be visible
    expect(screen.getByLabelText("Target Audience")).toBeInTheDocument();
    expect(screen.getByLabelText("Key Challenges")).toBeInTheDocument();
    expect(screen.getByLabelText("Scope")).toBeInTheDocument();
  });
});
