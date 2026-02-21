import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockInvoke, resetTauriMocks } from "@/test/mocks/tauri";
import { toast } from "sonner";
import { useSettingsStore } from "@/stores/settings-store";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
  Toaster: () => null,
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
}));

import SkillDialog from "@/components/skill-dialog";
import type { SkillSummary } from "@/lib/types";

const sampleSkill: SkillSummary = {
  name: "sales-pipeline",
  domain: "sales",
  current_step: "Step 3",
  status: "in_progress",
  last_modified: new Date().toISOString(),
  tags: ["analytics", "crm"],
  skill_type: "domain",
  author_login: null,
  author_avatar: null,
  intake_json: null,
  description: "A skill for managing sales pipelines",
};

/** Navigate to the given step by clicking Next buttons */
async function goToStep(user: ReturnType<typeof userEvent.setup>, target: 2 | 3 | 4) {
  if (target >= 2) {
    await user.click(screen.getByRole("button", { name: /Next/i }));
  }
  if (target >= 3) {
    await user.click(screen.getByRole("button", { name: /Next/i }));
  }
  if (target >= 4) {
    await user.click(screen.getByRole("button", { name: /Next/i }));
  }
}

describe("SkillDialog (edit mode)", () => {
  beforeEach(() => {
    resetTauriMocks();
    vi.mocked(toast.success).mockReset();
    vi.mocked(toast.error).mockReset();
    useSettingsStore.getState().reset();
    useSettingsStore.getState().setSettings({ workspacePath: "/test/workspace" });
  });

  it("renders dialog title when open", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByText("Edit Skill")).toBeInTheDocument();
  });

  it("shows step 1 description by default", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByText("Update name, type, and description.")).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("does not render when open is false", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={false}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.queryByText("Edit Skill")).not.toBeInTheDocument();
  });

  it("shows existing tags as badges on step 1", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByText("analytics")).toBeInTheDocument();
    expect(screen.getByText("crm")).toBeInTheDocument();
  });

  it("has Cancel and Next buttons on step 1", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
  });

  it("has Back and Next buttons on step 2", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 2);
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/i })).not.toBeInTheDocument();
  });

  it("has Back and Next buttons on step 3", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 3);
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Save/i })).not.toBeInTheDocument();
  });

  it("has Back, Skip, and Save buttons on step 4", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 4);
    expect(screen.getByRole("button", { name: /Back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Skip/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Next/i })).not.toBeInTheDocument();
  });

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={onOpenChange}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );

    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("navigates between steps with Next and Back", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );

    // Step 1
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
    expect(screen.getByLabelText("Skill Name")).toBeInTheDocument();

    // Go to step 2
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("What does this skill cover?")).toBeInTheDocument();

    // Go to step 3
    await user.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText("Step 3 of 4")).toBeInTheDocument();
    expect(screen.getByLabelText("What makes your setup unique?")).toBeInTheDocument();

    // Go back to step 2
    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText("Step 2 of 4")).toBeInTheDocument();

    // Go back to step 1
    await user.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText("Step 1 of 4")).toBeInTheDocument();
  });

  it("calls update_skill_metadata and callbacks on successful save from step 4", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onSaved = vi.fn();
    mockInvoke.mockResolvedValue(undefined);

    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={onOpenChange}
        onSaved={onSaved}
        tagSuggestions={[]}
      />
    );

    await goToStep(user, 4);
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_skill_metadata", {
        skillName: "sales-pipeline",
        domain: "sales",
        skillType: "domain",
        tags: ["analytics", "crm"],
        intakeJson: null,
        description: "A skill for managing sales pipelines",
        version: "1.0.0",
        model: null,
        argumentHint: null,
        userInvocable: true,
        disableModelInvocation: false,
      });
    });

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
    expect(onSaved).toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Skill updated");
  });

  it("shows error toast on failed save", async () => {
    const user = userEvent.setup();
    mockInvoke.mockRejectedValue(new Error("DB error"));

    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );

    await goToStep(user, 4);
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Failed to update skill: DB error",
        { duration: Infinity },
      );
    });
  });

  it("handles null skill gracefully", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={null}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByText("Edit Skill")).toBeInTheDocument();
  });

  it("shows skill name input pre-filled with current name", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByLabelText("Skill Name")).toHaveValue("sales-pipeline");
  });

  it("shows skill type radio group on step 1", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(4);
  });

  it("shows skill type descriptions on step 1", () => {
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    expect(screen.getByText(/Business domain knowledge/)).toBeInTheDocument();
    expect(screen.getByText(/Source system extraction/)).toBeInTheDocument();
  });

  it("shows domain input pre-filled on step 2", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 2);
    expect(screen.getByPlaceholderText("What does this skill cover?")).toHaveValue("sales");
  });

  it("shows audience and challenges fields on step 2", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 2);
    expect(screen.getByLabelText("Target Audience")).toBeInTheDocument();
    expect(screen.getByLabelText("Key Challenges")).toBeInTheDocument();
  });

  it("shows optional detail fields on step 3", async () => {
    const user = userEvent.setup();
    render(
      <SkillDialog
        mode="edit"
        skill={sampleSkill}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 3);
    expect(screen.getByLabelText("What makes your setup unique?")).toBeInTheDocument();
    expect(screen.getByLabelText("What does Claude get wrong?")).toBeInTheDocument();
  });

  it("pre-fills intake fields from intake_json on step 2", async () => {
    const user = userEvent.setup();
    const skillWithIntake: SkillSummary = {
      ...sampleSkill,
      intake_json: JSON.stringify({
        audience: "Revenue analysts",
        challenges: "ASC 606 issues",
        scope: "B2B SaaS only",
      }),
    };
    render(
      <SkillDialog
        mode="edit"
        skill={skillWithIntake}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={vi.fn()}
        tagSuggestions={[]}
      />
    );
    await goToStep(user, 2);
    expect(screen.getByLabelText("Target Audience")).toHaveValue("Revenue analysts");
    expect(screen.getByLabelText("Key Challenges")).toHaveValue("ASC 606 issues");
  });

  it("sends intake_json on save when intake fields are filled", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    mockInvoke.mockResolvedValue(undefined);

    const skillWithIntake: SkillSummary = {
      ...sampleSkill,
      intake_json: JSON.stringify({ audience: "Analysts" }),
    };

    render(
      <SkillDialog
        mode="edit"
        skill={skillWithIntake}
        open={true}
        onOpenChange={vi.fn()}
        onSaved={onSaved}
        tagSuggestions={[]}
      />
    );

    // Save from step 4
    await goToStep(user, 4);
    await user.click(screen.getByRole("button", { name: /Save/i }));

    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("update_skill_metadata", {
        skillName: "sales-pipeline",
        domain: "sales",
        skillType: "domain",
        tags: ["analytics", "crm"],
        intakeJson: JSON.stringify({ audience: "Analysts" }),
        description: "A skill for managing sales pipelines",
        version: "1.0.0",
        model: null,
        argumentHint: null,
        userInvocable: true,
        disableModelInvocation: false,
      });
    });
  });

  // --- isLocked prop ---

  describe("isLocked", () => {
    it("shows lock banner when isLocked is true", () => {
      render(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={true}
        />
      );
      expect(
        screen.getByText("This skill is being edited in another window")
      ).toBeInTheDocument();
    });

    it("does not show lock banner when isLocked is false", () => {
      render(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={false}
        />
      );
      expect(
        screen.queryByText("This skill is being edited in another window")
      ).not.toBeInTheDocument();
    });

    it("disables skill name input when isLocked is true", () => {
      render(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={true}
        />
      );
      expect(screen.getByLabelText("Skill Name")).toBeDisabled();
    });

    it("disables Next button on step 1 when isLocked is true", () => {
      render(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={true}
        />
      );
      expect(screen.getByRole("button", { name: /Next/i })).toBeDisabled();
    });

    it("disables Save button on step 2 when isLocked is true", async () => {
      const user = userEvent.setup();
      // Render unlocked first so the user can navigate to step 2,
      // then re-render with isLocked to verify the Save button is disabled.
      const { rerender } = render(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={false}
        />
      );
      await goToStep(user, 2);
      rerender(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={true}
        />
      );
      expect(screen.getByRole("button", { name: /Save/i })).toBeDisabled();
    });

    it("does not invoke save when isLocked is true and Save is clicked", async () => {
      const user = userEvent.setup();
      mockInvoke.mockResolvedValue(undefined);

      const { rerender } = render(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={false}
        />
      );
      await goToStep(user, 2);
      rerender(
        <SkillDialog
          mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
          isLocked={true}
        />
      );

      // Save button is disabled; clicking it should not trigger the save
      const saveBtn = screen.getByRole("button", { name: /Save/i });
      expect(saveBtn).toBeDisabled();
      await user.click(saveBtn);

      expect(mockInvoke).not.toHaveBeenCalledWith(
        "update_skill_metadata",
        expect.anything()
      );
    });
  });

  describe("rename flow", () => {
    it("calls rename_skill before update_skill_metadata when name changes", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      render(
        <SkillDialog
        mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={onSaved}
          tagSuggestions={[]}
        />
      );

      const nameInput = screen.getByLabelText("Skill Name");
      await user.clear(nameInput);
      await user.type(nameInput, "revenue-tracker");

      // Navigate to step 4 to access Save
      await goToStep(user, 4);
      await user.click(screen.getByRole("button", { name: /Save/i }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("rename_skill", {
          oldName: "sales-pipeline",
          newName: "revenue-tracker",
          workspacePath: "/test/workspace",
        });
      });

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("update_skill_metadata", {
          skillName: "revenue-tracker",
          domain: "sales",
          skillType: "domain",
          tags: ["analytics", "crm"],
          intakeJson: null,
          description: "A skill for managing sales pipelines",
          version: "1.0.0",
          model: null,
          argumentHint: null,
          userInvocable: true,
          disableModelInvocation: false,
        });
      });

      // Verify rename_skill was called before update_skill_metadata
      const calls = mockInvoke.mock.calls.map((c) => c[0]);
      const renameIndex = calls.indexOf("rename_skill");
      const updateIndex = calls.indexOf("update_skill_metadata");
      expect(renameIndex).toBeLessThan(updateIndex);
    });

    it("shows rename warning when skill name is changed", async () => {
      const user = userEvent.setup();

      render(
        <SkillDialog
        mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
        />
      );

      const nameInput = screen.getByLabelText("Skill Name");
      await user.clear(nameInput);
      await user.type(nameInput, "revenue-tracker");

      expect(
        screen.getByText("Renaming will move the skill directory")
      ).toBeInTheDocument();
    });

    it("disables Next when skill name is invalid kebab-case", async () => {
      const user = userEvent.setup();

      render(
        <SkillDialog
        mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={vi.fn()}
          tagSuggestions={[]}
        />
      );

      const nameInput = screen.getByLabelText("Skill Name");
      const nextButton = screen.getByRole("button", { name: /Next/i });

      // Initially valid
      expect(nextButton).toBeEnabled();

      // Clear and type a name with trailing hyphen (invalid kebab-case)
      await user.clear(nameInput);
      await user.type(nameInput, "my-skill-");

      expect(nextButton).toBeDisabled();
    });

    it("does not call rename_skill when name is unchanged", async () => {
      const user = userEvent.setup();
      const onSaved = vi.fn();
      mockInvoke.mockResolvedValue(undefined);

      render(
        <SkillDialog
        mode="edit"
          skill={sampleSkill}
          open={true}
          onOpenChange={vi.fn()}
          onSaved={onSaved}
          tagSuggestions={[]}
        />
      );

      // Navigate to step 4 and save
      await goToStep(user, 4);
      await user.click(screen.getByRole("button", { name: /Save/i }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("update_skill_metadata", {
          skillName: "sales-pipeline",
          domain: "sales",
          skillType: "domain",
          tags: ["analytics", "crm"],
          intakeJson: null,
          description: "A skill for managing sales pipelines",
          version: "1.0.0",
          model: null,
          argumentHint: null,
          userInvocable: true,
          disableModelInvocation: false,
        });
      });

      expect(mockInvoke).not.toHaveBeenCalledWith(
        "rename_skill",
        expect.anything()
      );
    });
  });
});
