import { test, expect } from "@playwright/test";
import { waitForAppReady } from "../helpers/app-helpers";
import workspaceSkillsFixture from "../fixtures/workspace-skills.json" with { type: "json" };

/** Navigate to the Skills section of the Settings page. */
async function navigateToSkillsLibrary(page: Parameters<typeof waitForAppReady>[0]) {
  await page.goto("/settings");
  await waitForAppReady(page);
  // Wait for settings to finish loading (spinner disappears, nav buttons become visible)
  const skillsNavBtn = page.locator("nav button", { hasText: "Skills" });
  await skillsNavBtn.waitFor({ state: "visible", timeout: 5_000 });
  // Click the "Skills" section in the settings sidebar nav
  await skillsNavBtn.click();
  // Wait for the SkillsLibraryTab to mount
  await page.waitForTimeout(300);
}

/** Navigate to the main dashboard (skills list with grid/list view toggle). */
async function navigateToDashboard(page: Parameters<typeof waitForAppReady>[0]) {
  await page.goto("/");
  await waitForAppReady(page);
  await page.waitForTimeout(300);
}

test.describe("Skills Library", { tag: "@skills" }, () => {
  test("shows empty state when no skills exist", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    await expect(page.getByText("No workspace skills")).toBeVisible();
    await expect(
      page.getByText("Upload a .skill package or browse the marketplace to add skills.")
    ).toBeVisible();
  });

  test("shows action buttons in Skills Library tab", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.locator("nav button", { hasText: "Skills" })).toBeVisible();

    // Action buttons — Marketplace button exists (may be disabled without marketplaceUrl)
    await expect(page.getByRole("button", { name: /marketplace/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /upload skill/i }).first()).toBeVisible();
  });

  test("shows skill list with names and version badges", async ({ page }) => {
    const nonBundled = workspaceSkillsFixture.filter((s) => !s.is_bundled);

    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: skills,
      };
    }, nonBundled);

    await navigateToSkillsLibrary(page);

    // Both skills should be visible in the list
    await expect(page.getByText("data-analytics")).toBeVisible();
    await expect(page.getByText("api-design")).toBeVisible();

    // Domain subtext
    await expect(page.getByText("Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Engineering", { exact: true })).toBeVisible();

    // data-analytics has version "1.0.0", api-design has no version (shows "—")
    await expect(page.getByText("1.0.0")).toBeVisible();
  });

  test("can toggle skill active state", async ({ page }) => {
    const nonBundled = workspaceSkillsFixture.filter((s) => !s.is_bundled);

    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: skills,
        toggle_skill_active: undefined,
      };
    }, nonBundled);

    await navigateToSkillsLibrary(page);

    // Find the active toggle for data-analytics
    const toggle = page.getByLabel("Toggle data-analytics");
    await expect(toggle).toBeVisible();
    await expect(toggle).toBeChecked();

    // Toggle it — should fire toggle_skill_active without error
    await toggle.click();
  });

  test("delete button is hidden for bundled skills", async ({ page }) => {
    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: skills,
      };
    }, workspaceSkillsFixture);

    await navigateToSkillsLibrary(page);

    // Non-bundled skills should have a delete button
    await expect(page.getByLabel("Delete data-analytics")).toBeVisible();

    // Bundled skills must NOT have a delete button
    await expect(page.getByLabel("Delete skill-builder-practices")).not.toBeVisible();
  });

  test("can delete a non-bundled skill", async ({ page }) => {
    const nonBundled = workspaceSkillsFixture.filter((s) => !s.is_bundled);

    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: skills,
        delete_imported_skill: undefined,
      };
    }, nonBundled);

    await navigateToSkillsLibrary(page);

    // Both skills visible
    await expect(page.getByText("data-analytics")).toBeVisible();
    await expect(page.getByText("api-design")).toBeVisible();

    // Delete data-analytics
    await page.getByLabel("Delete data-analytics").click();

    // data-analytics should disappear; api-design remains
    await expect(page.getByText("data-analytics")).not.toBeVisible();
    await expect(page.getByText("api-design")).toBeVisible();
  });

  test("upload skill button is clickable", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    const uploadButton = page.getByRole("button", { name: /upload skill/i }).first();
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeEnabled();
  });

  test("can open Marketplace import dialog", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: [],
        get_settings: {
          anthropic_api_key: "sk-ant-test",
          workspace_path: "/tmp/test-workspace",
          skills_path: "/tmp/test-skills",
          marketplace_url: "https://github.com/test-owner/test-repo",
        },
        parse_github_url: {
          owner: "test-owner",
          repo: "test-repo",
          branch: "main",
          subpath: null,
        },
        list_github_skills: [],
        get_installed_skill_names: [],
      };
    });

    await navigateToSkillsLibrary(page);

    // Click Marketplace button (enabled when marketplace_url is configured)
    await page.getByRole("button", { name: /marketplace/i }).first().click();

    // Dialog should open and auto-browse
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  // ─── List view ───────────────────────────────────────────────────────────

  /** SkillSummary-shaped skills for dashboard list view tests. */
  const DASHBOARD_SKILLS = [
    {
      name: "data-analytics",
      domain: "Data",
      current_step: null,
      status: "completed",
      last_modified: "2025-01-15T10:00:00Z",
      tags: [],
      skill_type: "domain",
      skill_source: "marketplace",
      author_login: null,
      author_avatar: null,
      intake_json: null,
    },
    {
      name: "api-design",
      domain: "Engineering",
      current_step: null,
      status: "completed",
      last_modified: "2025-01-14T09:00:00Z",
      tags: [],
      skill_type: "platform",
      skill_source: "imported",
      author_login: null,
      author_avatar: null,
      intake_json: null,
    },
  ];

  const DASHBOARD_MOCKS = {
    get_settings: {
      anthropic_api_key: "sk-ant-test",
      workspace_path: "/tmp/ws",
      skills_path: "/tmp/skills",
      dashboard_view_mode: null,
    },
    list_skills: DASHBOARD_SKILLS,
    get_all_tags: [],
    save_settings: undefined,
    check_workspace_path: true,
  };

  test("can switch to list view and back to grid view", async ({ page }) => {
    await page.addInitScript((mocks) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = mocks;
    }, DASHBOARD_MOCKS);

    await navigateToDashboard(page);

    // Default is grid view
    await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");

    // Switch to list view — skills still visible
    await page.getByRole("button", { name: "List view" }).click();
    await expect(page.getByRole("button", { name: "List view" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("data-analytics")).toBeVisible();
    await expect(page.getByText("api-design")).toBeVisible();

    // Switch back to grid view
    await page.getByRole("button", { name: "Grid view" }).click();
    await expect(page.getByRole("button", { name: "Grid view" })).toHaveAttribute("aria-pressed", "true");
  });

  test("shows table header columns in list view", async ({ page }) => {
    await page.addInitScript((mocks) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = mocks;
    }, DASHBOARD_MOCKS);

    await navigateToDashboard(page);
    await page.getByRole("button", { name: "List view" }).click();

    await expect(page.getByRole("button", { name: "Name" })).toBeVisible();
    // "Source" and "Status" also appear as filter dropdown buttons; use last() to target the table header
    await expect(page.getByRole("button", { name: "Source" }).last()).toBeVisible();
    await expect(page.getByRole("button", { name: "Status" }).last()).toBeVisible();
    await expect(page.getByText("Actions", { exact: true })).toBeVisible();
  });

  test("source and status column data is left-aligned with column headers", async ({ page }) => {
    await page.addInitScript((mocks) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = mocks;
    }, DASHBOARD_MOCKS);

    await navigateToDashboard(page);
    await page.getByRole("button", { name: "List view" }).click();

    // Get Source column header button's left edge (the sort button, not the filter dropdown)
    const sourceHeaderBox = await page.getByRole("button", { name: "Source" }).last().boundingBox();
    // Get the Source badge ELEMENT's left edge (not the text inside, which is offset by icon+padding).
    // Scope to the data-analytics row to avoid matching the top-bar "Marketplace" import button.
    const dataAnalyticsRow = page
      .locator("tr")
      .filter({ hasText: "data-analytics" });
    // The Source badge is a <span> containing "Marketplace" text
    const sourceBadgeBox = await dataAnalyticsRow
      .locator("span")
      .filter({ hasText: "Marketplace" })
      .first()
      .boundingBox();

    expect(sourceHeaderBox).not.toBeNull();
    expect(sourceBadgeBox).not.toBeNull();

    // Badge left edge should be within 5px of the header label left edge — both are at the Source column start.
    // If centered in a ~260px column, the offset would be ~130px — this test would catch that.
    expect(Math.abs(sourceBadgeBox!.x - sourceHeaderBox!.x)).toBeLessThan(5);
  });

  test("shows skill type subtitle in list view name column", async ({ page }) => {
    await page.addInitScript((mocks) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = mocks;
    }, DASHBOARD_MOCKS);

    await navigateToDashboard(page);
    await page.getByRole("button", { name: "List view" }).click();

    // data-analytics has skill_type "domain" → "Domain" label
    await expect(page.getByText("Domain", { exact: true })).toBeVisible();
    // api-design has skill_type "platform" → "Platform" label
    await expect(page.getByText("Platform", { exact: true })).toBeVisible();
  });

  test("can sort skills by name in list view", async ({ page }) => {
    await page.addInitScript((mocks) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = mocks;
    }, DASHBOARD_MOCKS);

    await navigateToDashboard(page);
    await page.getByRole("button", { name: "List view" }).click();

    // Default: ascending by name — "api-design" comes before "data-analytics"
    const apiBoxAsc = await page.getByText("api-design").first().boundingBox();
    const dataBoxAsc = await page.getByText("data-analytics").first().boundingBox();
    expect(apiBoxAsc!.y).toBeLessThan(dataBoxAsc!.y);

    // Click Name to reverse to descending
    await page.getByRole("button", { name: "Name" }).click();

    // Now "data-analytics" comes before "api-design"
    const apiBoxDesc = await page.getByText("api-design").first().boundingBox();
    const dataBoxDesc = await page.getByText("data-analytics").first().boundingBox();
    expect(dataBoxDesc!.y).toBeLessThan(apiBoxDesc!.y);
  });

  test("Marketplace button is disabled without marketplace URL configured", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_workspace_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    const marketplaceButton = page.getByRole("button", { name: /marketplace/i }).first();
    await expect(marketplaceButton).toBeVisible();
    await expect(marketplaceButton).toBeDisabled();
  });
});
