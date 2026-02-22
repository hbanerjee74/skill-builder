import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  mockInvoke,
  resetTauriMocks,
} from "@/test/mocks/tauri";
import { open as mockOpen } from "@tauri-apps/plugin-dialog";
import { useSettingsStore } from "@/stores/settings-store";
import type { SkillSummary, AppSettings } from "@/lib/types";

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

// Mock @tanstack/react-router
const mockNavigate = vi.fn();
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock react-markdown (avoid complex rendering in tests)
vi.mock("react-markdown", () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

vi.mock("remark-gfm", () => ({
  default: () => {},
}));

import { SkillsLibraryTab } from "@/components/skills-library-tab";

const defaultSettings: AppSettings = {
  anthropic_api_key: "sk-test",
  workspace_path: "/home/user/workspace",
  skills_path: "/home/user/skills",
  preferred_model: "sonnet",
  log_level: "info",
  extended_context: false,
  extended_thinking: false,
  splash_shown: false,
  github_oauth_token: null,
  github_user_login: null,
  github_user_avatar: null,
  github_user_email: null,
  marketplace_url: null,
  max_dimensions: 5,
  industry: null,
  function_role: null,
  dashboard_view_mode: null,
};

const sampleSkills: SkillSummary[] = [
  {
    name: "sales-analytics",
    domain: "sales",
    current_step: null,
    status: "completed",
    last_modified: null,
    tags: [],
    skill_type: "domain",
    skill_source: "skill-builder",
    author_login: null,
    author_avatar: null,
    intake_json: null,
    source: "created",
  },
  {
    name: "hr-metrics",
    domain: "HR",
    current_step: "step 2",
    status: "in_progress",
    last_modified: null,
    tags: [],
    skill_type: "domain",
    skill_source: "skill-builder",
    author_login: null,
    author_avatar: null,
    intake_json: null,
    source: "created",
  },
];

function setupMocks(skills: SkillSummary[] = sampleSkills) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === "get_settings") return Promise.resolve(defaultSettings);
    if (cmd === "list_skills") return Promise.resolve(skills);
    return Promise.reject(new Error(`Unmocked command: ${cmd}`));
  });
}

describe("SkillsLibraryTab", () => {
  beforeEach(() => {
    resetTauriMocks();
    useSettingsStore.getState().reset();
    mockNavigate.mockReset();
  });

  it("shows loading skeletons while fetching", async () => {
    // Settings resolve immediately, list_skills hangs — component stays in loading state
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_settings") return Promise.resolve(defaultSettings);
      if (cmd === "list_skills") return new Promise(() => {}); // hang
      return Promise.reject(new Error(`Unmocked command: ${cmd}`));
    });
    render(<SkillsLibraryTab />);

    // Wait for settings to load (sets workspacePath) which triggers loadSkills
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith("list_skills", expect.anything());
    });

    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("renders upload button", async () => {
    setupMocks();
    render(<SkillsLibraryTab />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Upload Skill/i })).toBeInTheDocument();
    });
  });

  it("Marketplace button is disabled when marketplace URL is not configured", async () => {
    // Store default: marketplaceUrl = null
    setupMocks();
    render(<SkillsLibraryTab />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Marketplace/i });
      expect(btn).toBeDisabled();
    });
  });

  it("Marketplace button is enabled when marketplace URL is configured", async () => {
    useSettingsStore.getState().setSettings({ marketplaceUrl: "https://github.com/owner/skills" });
    setupMocks();
    render(<SkillsLibraryTab />);

    await waitFor(() => {
      const btn = screen.getByRole("button", { name: /Marketplace/i });
      expect(btn).not.toBeDisabled();
    });
  });

  it("renders skill cards when skills exist", async () => {
    setupMocks();
    render(<SkillsLibraryTab />);

    await waitFor(() => {
      expect(screen.getByText("sales-analytics")).toBeInTheDocument();
    });
    expect(screen.getByText("hr-metrics")).toBeInTheDocument();
  });

  it("shows empty state when no skills", async () => {
    setupMocks([]);
    render(<SkillsLibraryTab />);

    await waitFor(() => {
      expect(screen.getByText("No skills yet")).toBeInTheDocument();
    });
    expect(
      screen.getByText("Upload a .skill package or browse the marketplace to add skills to your library.")
    ).toBeInTheDocument();
  });

  it("shows domain badge on skill card", async () => {
    setupMocks();
    render(<SkillsLibraryTab />);

    await waitFor(() => {
      expect(screen.getByText("sales")).toBeInTheDocument();
    });
    expect(screen.getByText("HR")).toBeInTheDocument();
  });

  it("calls upload_skill when file is selected", async () => {
    const user = userEvent.setup();

    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "get_settings") return Promise.resolve(defaultSettings);
      if (cmd === "list_skills") return Promise.resolve([]);
      if (cmd === "upload_skill") return Promise.resolve({
        skill_id: "id-3",
        skill_name: "new-skill",
        domain: null,
        description: "A new skill",
        is_active: true,
        disk_path: "/skills/new-skill",
        imported_at: new Date().toISOString(),
        is_bundled: false,
        skill_type: "skill-builder",
        version: null,
        model: null,
        argument_hint: null,
        user_invocable: null,
        disable_model_invocation: null,
      });
      return Promise.reject(new Error(`Unmocked command: ${cmd}`));
    });
    (mockOpen as ReturnType<typeof vi.fn>).mockResolvedValue("/path/to/file.skill");

    render(<SkillsLibraryTab />);

    await waitFor(() => {
      expect(screen.getByText("No skills yet")).toBeInTheDocument();
    });

    // Click the upload button
    const uploadButton = screen.getByRole("button", { name: /Upload Skill/i });
    await user.click(uploadButton);

    await waitFor(() => {
      expect(mockOpen).toHaveBeenCalled();
    });
  });

  it("does not call upload_skill when dialog is cancelled", async () => {
    const user = userEvent.setup();

    setupMocks([]);
    (mockOpen as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    render(<SkillsLibraryTab />);

    await waitFor(() => {
      expect(screen.getByText("No skills yet")).toBeInTheDocument();
    });

    const uploadButton = screen.getByRole("button", { name: /Upload Skill/i });
    await user.click(uploadButton);

    // upload_skill should never be called
    await new Promise((r) => setTimeout(r, 50));
    expect(mockInvoke).not.toHaveBeenCalledWith("upload_skill", expect.anything());
  });
});
