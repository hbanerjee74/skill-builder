import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mockInvoke,
  mockInvokeCommands,
  resetTauriMocks,
} from "@/test/mocks/tauri";
import type { AvailableSkill } from "@/lib/types";

// Mock sonner
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    loading: vi.fn(() => "toast-id"),
    dismiss: vi.fn(),
  }),
  Toaster: () => null,
}));

import GitHubImportDialog from "@/components/github-import-dialog";
import { toast } from "sonner";

const DEFAULT_REPO_INFO = { owner: "acme", repo: "skills", branch: "main", subpath: null };

const sampleSkills: AvailableSkill[] = [
  {
    path: "skills/sales-analytics",
    name: "Sales Analytics",
    domain: "sales",
    description: "Analyze your sales pipeline",
    skill_type: "skill-builder",
  },
  {
    path: "skills/hr-metrics",
    name: "HR Metrics",
    domain: null,
    description: null,
    skill_type: "skill-builder",
  },
];

function renderDialog(props: Partial<React.ComponentProps<typeof GitHubImportDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onImported = vi.fn(() => Promise.resolve());
  return {
    onOpenChange,
    onImported,
    ...render(
      <GitHubImportDialog
        open={true}
        onOpenChange={onOpenChange}
        onImported={onImported}
        url="https://github.com/acme/skills"
        {...props}
      />
    ),
  };
}

describe("GitHubImportDialog", () => {
  describe("Loading state", () => {
    it("shows spinner while loading", () => {
      // Never resolve — component stays in loading state
      mockInvoke.mockImplementation(() => new Promise(() => {}));
      renderDialog();
      expect(screen.getByText("Loading skills...")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("shows error message and Retry button after browse fails", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "parse_github_url") return Promise.reject(new Error("Invalid GitHub URL"));
        return Promise.reject(new Error(`Unmocked command: ${cmd}`));
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Invalid GitHub URL")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /Retry/i })).toBeInTheDocument();
      expect(screen.queryByText("Loading skills...")).not.toBeInTheDocument();
    });

    it("hides skill list after browse fails", async () => {
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "parse_github_url") return Promise.reject(new Error("Network error"));
        return Promise.reject(new Error(`Unmocked command: ${cmd}`));
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.queryByText("Loading skills...")).not.toBeInTheDocument();
      });

      expect(screen.queryByRole("button", { name: /Import/i })).not.toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows no skill rows when list_github_skills returns empty array", async () => {
      // When the skill list is empty, the component sets an error state internally
      // ("No skills found in this repository.") and does not populate the skill list.
      // After loading completes, the spinner is gone and no Import buttons are shown.
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: [],
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.queryByText("Loading skills...")).not.toBeInTheDocument();
      });
      expect(screen.queryByRole("button", { name: /Import/i })).not.toBeInTheDocument();
    });
  });

  describe("Skill list", () => {
    beforeEach(() => {
      resetTauriMocks();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
      });
    });

    it("shows skill name for each skill", async () => {
      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Sales Analytics")).toBeInTheDocument();
      });
      expect(screen.getByText("HR Metrics")).toBeInTheDocument();
    });

    it("shows domain badge when domain is present", async () => {
      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("sales")).toBeInTheDocument();
      });
    });

    it("does not show domain badge when domain is null", async () => {
      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("HR Metrics")).toBeInTheDocument();
      });
      // HR Metrics has no domain — only "sales" badge should appear
      const badges = screen.getAllByText("sales");
      expect(badges).toHaveLength(1);
    });

    it("shows description when present", async () => {
      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Analyze your sales pipeline")).toBeInTheDocument();
      });
    });

    it("does not show skills filtered out by typeFilter", async () => {
      const mixed: AvailableSkill[] = [
        { path: "skills/a", name: "Skill A", domain: null, description: null, skill_type: "skill-builder" },
        { path: "skills/b", name: "Skill B", domain: null, description: null, skill_type: "domain" },
        { path: "skills/c", name: "Skill C", domain: null, description: null, skill_type: null },
      ];
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: mixed,
        get_installed_skill_names: [],
      });

      renderDialog({ typeFilter: ["skill-builder"] });

      await waitFor(() => {
        expect(screen.getByText("Skill A")).toBeInTheDocument();
      });
      expect(screen.queryByText("Skill B")).not.toBeInTheDocument();
      expect(screen.queryByText("Skill C")).not.toBeInTheDocument();
    });

    it("shows Import button for each skill initially", async () => {
      renderDialog();

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });
    });

    it("pre-marks skills that are already installed as 'In library'", async () => {
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: ["Sales Analytics"], // first skill already installed
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("HR Metrics")).toBeInTheDocument();
      });

      // Sales Analytics should show "In library" without any click
      expect(screen.getByText("In library")).toBeInTheDocument();
      // HR Metrics should still have Import button
      expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(1);
    });
  });

  describe("Import — skill-library mode", () => {
    const onImported = vi.fn(() => Promise.resolve());

    beforeEach(() => {
      resetTauriMocks();
      onImported.mockReset().mockResolvedValue(undefined);
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
      });
    });

    it("calls import_marketplace_to_library with the skill path when Import is clicked", async () => {
      const user = userEvent.setup();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_marketplace_to_library: [{ skill_name: "Sales Analytics", success: true, error: null }],
      });

      renderDialog({ mode: "skill-library", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("import_marketplace_to_library", {
          skillPaths: ["skills/sales-analytics"],
        });
      });
    });

    it("shows 'Importing…' while import is in flight", async () => {
      const user = userEvent.setup();

      let resolveImport!: (v: unknown) => void;
      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "parse_github_url") return Promise.resolve(DEFAULT_REPO_INFO);
        if (cmd === "list_github_skills") return Promise.resolve(sampleSkills);
        if (cmd === "get_installed_skill_names") return Promise.resolve([]);
        if (cmd === "import_marketplace_to_library") {
          return new Promise((res) => { resolveImport = res; });
        }
        return Promise.reject(new Error(`Unmocked command: ${cmd}`));
      });

      renderDialog({ mode: "skill-library", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(screen.getByText("Importing…")).toBeInTheDocument();
      });

      // Clean up by resolving the import
      resolveImport([{ skill_name: "Sales Analytics", success: true, error: null }]);
    });

    it("shows 'Imported' label, calls onImported, and fires success toast on success", async () => {
      const user = userEvent.setup();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_marketplace_to_library: [{ skill_name: "Sales Analytics", success: true, error: null }],
      });

      renderDialog({ mode: "skill-library", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(screen.getByText("Imported")).toBeInTheDocument();
      });
      expect(onImported).toHaveBeenCalledOnce();
      expect(toast.success).toHaveBeenCalledWith('Imported "Sales Analytics"');
    });

    it("shows 'In library' and 'Already in your library' when result.success is false", async () => {
      const user = userEvent.setup();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_marketplace_to_library: [{ skill_name: "Sales Analytics", success: false, error: "already exists" }],
      });

      renderDialog({ mode: "skill-library", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(screen.getByText("In library")).toBeInTheDocument();
      });
      expect(screen.getByText("Already in your library")).toBeInTheDocument();
      // onImported should NOT be called when skill already exists
      expect(onImported).not.toHaveBeenCalled();
    });

    it("other skills remain importable after one is imported", async () => {
      const user = userEvent.setup();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_marketplace_to_library: [{ skill_name: "Sales Analytics", success: true, error: null }],
      });

      renderDialog({ mode: "skill-library", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(screen.getByText("Imported")).toBeInTheDocument();
      });

      // Second skill should still have an Import button
      expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(1);
    });
  });

  describe("Import — settings-skills mode", () => {
    const onImported = vi.fn(() => Promise.resolve());

    beforeEach(() => {
      resetTauriMocks();
      onImported.mockReset().mockResolvedValue(undefined);
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
      });
    });

    it("calls import_github_skills when Import is clicked", async () => {
      const user = userEvent.setup();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_github_skills: [],
      });

      renderDialog({ mode: "settings-skills", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("import_github_skills", {
          owner: "acme",
          repo: "skills",
          branch: "main",
          skillPaths: ["skills/sales-analytics"],
        });
      });
    });

    it("shows 'Imported' label, calls onImported, and fires success toast on success", async () => {
      const user = userEvent.setup();
      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_github_skills: [],
      });

      renderDialog({ mode: "settings-skills", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(screen.getByText("Imported")).toBeInTheDocument();
      });
      expect(onImported).toHaveBeenCalledOnce();
      expect(toast.success).toHaveBeenCalledWith('Imported "Sales Analytics"');
    });
  });

  describe("Import error", () => {
    const onImported = vi.fn(() => Promise.resolve());

    beforeEach(() => {
      resetTauriMocks();
      onImported.mockReset().mockResolvedValue(undefined);
    });

    it("resets to idle and fires error toast when import throws", async () => {
      const user = userEvent.setup();

      mockInvoke.mockImplementation((cmd: string) => {
        if (cmd === "parse_github_url") return Promise.resolve(DEFAULT_REPO_INFO);
        if (cmd === "list_github_skills") return Promise.resolve(sampleSkills);
        if (cmd === "get_installed_skill_names") return Promise.resolve([]);
        if (cmd === "import_marketplace_to_library")
          return Promise.reject(new Error("Import failed: server error"));
        return Promise.reject(new Error(`Unmocked command: ${cmd}`));
      });

      renderDialog({ mode: "skill-library", onImported });

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Import failed: server error");
      });

      // Button should be back (state reset to idle)
      expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      expect(onImported).not.toHaveBeenCalled();
    });
  });

  describe("Dialog close", () => {
    it("resets state when closed and reopened (new browse on reopen)", async () => {
      const user = userEvent.setup();

      mockInvokeCommands({
        parse_github_url: DEFAULT_REPO_INFO,
        list_github_skills: sampleSkills,
        get_installed_skill_names: [],
        import_marketplace_to_library: [{ skill_name: "Sales Analytics", success: true, error: null }],
      });

      const onImported = vi.fn(() => Promise.resolve());

      // Use a wrapper component so we can toggle open/closed via state
      let setOpenFromOutside!: (v: boolean) => void;
      function Wrapper() {
        const [open, setOpen] = React.useState(true);
        setOpenFromOutside = setOpen;
        return (
          <GitHubImportDialog
            open={open}
            onOpenChange={setOpen}
            onImported={onImported}
            url="https://github.com/acme/skills"
            mode="skill-library"
          />
        );
      }

      render(<Wrapper />);

      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });

      // Import first skill
      await user.click(screen.getAllByRole("button", { name: /Import/i })[0]);

      await waitFor(() => {
        expect(screen.getByText("Imported")).toBeInTheDocument();
      });

      // Close the dialog via the Radix close button (triggers handleOpenChange(false) → reset())
      const closeButton = screen.getByRole("button", { name: /close/i });
      await user.click(closeButton);

      // Reopen via external state change
      setOpenFromOutside(true);

      // After reopen, browse() fires again — state should be reset so all skills are importable
      await waitFor(() => {
        expect(screen.getAllByRole("button", { name: /Import/i })).toHaveLength(2);
      });
      // "Imported" label should be gone (state was reset on close)
      expect(screen.queryByText("Imported")).not.toBeInTheDocument();
    });
  });
});
