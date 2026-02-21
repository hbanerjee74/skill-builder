import { test, expect } from "@playwright/test";
import { waitForAppReady } from "../helpers/app-helpers";
import importedSkillsFixture from "../fixtures/imported-skills.json" with { type: "json" };

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

test.describe("Skills Library", { tag: "@skills" }, () => {
  test("shows empty state when no skills exist", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    // Empty state card should be visible (CardTitle renders as <div>, not a heading)
    await expect(page.getByText("No imported skills")).toBeVisible();
    await expect(
      page.getByText("Upload a .skill package or browse the marketplace to add skills to your library.")
    ).toBeVisible();
  });

  test("shows action buttons in Skills Library tab", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    // Settings page header
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    // Settings sidebar shows "Skills" as active section
    await expect(page.locator("nav button", { hasText: "Skills" })).toBeVisible();

    // Action buttons — Marketplace button exists (may be disabled without marketplaceUrl)
    await expect(page.getByRole("button", { name: /marketplace/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /upload skill/i }).first()).toBeVisible();
  });

  test("shows populated state with skill cards", async ({ page }) => {
    // Add skill_type: "skill-builder" to fixture items so they pass the displayedSkills filter
    const skillsWithType = importedSkillsFixture
      .filter((s) => !s.is_bundled)
      .map((s) => ({ ...s, skill_type: "skill-builder" }));

    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: skills,
      };
    }, skillsWithType);

    await navigateToSkillsLibrary(page);

    // Both skill cards should be visible (CardTitle renders as <div>, not a heading)
    await expect(page.getByText("data-analytics")).toBeVisible();
    await expect(page.getByText("api-design")).toBeVisible();

    // Domain badges
    await expect(page.getByText("Data", { exact: true })).toBeVisible();
    await expect(page.getByText("Engineering", { exact: true })).toBeVisible();

    // argument_hint is displayed on the card
    await expect(page.getByText("When the user asks about data analysis...")).toBeVisible();
    await expect(page.getByText("When designing REST APIs...")).toBeVisible();
  });

  test("can toggle skill active state", async ({ page }) => {
    const skillsWithType = importedSkillsFixture
      .filter((s) => !s.is_bundled)
      .map((s) => ({ ...s, skill_type: "skill-builder" }));

    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: skills,
        toggle_skill_active: undefined,
      };
    }, skillsWithType);

    await navigateToSkillsLibrary(page);

    // Find the switch for data-analytics skill
    const dataAnalyticsSwitch = page.getByLabel("Toggle data-analytics active");
    await expect(dataAnalyticsSwitch).toBeChecked();

    // Toggle it off
    await dataAnalyticsSwitch.click();

    // The card should now have opacity-60 class (we can verify by checking the card's opacity style)
    const dataAnalyticsCard = page.locator(".opacity-60").filter({
      hasText: "data-analytics",
    });
    await expect(dataAnalyticsCard).toBeVisible();
  });

  test("can delete skill with two-click confirmation", async ({ page }) => {
    const skillsWithType = importedSkillsFixture
      .filter((s) => !s.is_bundled)
      .map((s) => ({ ...s, skill_type: "skill-builder" }));

    await page.addInitScript((skills) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: skills,
        delete_imported_skill: undefined,
      };
    }, skillsWithType);

    await navigateToSkillsLibrary(page);

    // Find the delete button for data-analytics (CardTitle is a <div>, not a heading)
    const dataAnalyticsCard = page.locator("[data-slot='card']").filter({
      hasText: "data-analytics",
    }).first();

    const deleteButton = dataAnalyticsCard.getByLabel("Delete skill");
    await expect(deleteButton).toBeVisible();

    // First click - should change to destructive variant
    await deleteButton.click();
    await expect(dataAnalyticsCard.getByLabel("Confirm delete")).toBeVisible();

    // Second click - should delete the skill
    await dataAnalyticsCard.getByLabel("Confirm delete").click();

    // Card should disappear
    await expect(page.getByText("data-analytics")).not.toBeVisible();
    // But the other skill should remain
    await expect(page.getByText("api-design")).toBeVisible();
  });

  test("can open preview dialog", async ({ page }) => {
    const mockSkillContent = "# Data Analytics Skill\n\nThis is a sample skill for data analytics.";
    const skillsWithType = importedSkillsFixture
      .filter((s) => !s.is_bundled)
      .map((s) => ({ ...s, skill_type: "skill-builder" }));

    await page.addInitScript(
      ({ skills, content }) => {
        (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
          list_imported_skills: skills,
          get_skill_content: content,
        };
      },
      { skills: skillsWithType, content: mockSkillContent }
    );

    await navigateToSkillsLibrary(page);

    // Click the Preview button for data-analytics (CardTitle is a <div>, not a heading)
    const dataAnalyticsCard = page.locator("[data-slot='card']").filter({
      hasText: "data-analytics",
    }).first();

    await dataAnalyticsCard.getByRole("button", { name: /preview/i }).click();

    // Dialog should open with skill name as title (DialogTitle IS a heading)
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: "data-analytics" })).toBeVisible();
    await expect(page.getByText("SKILL.md content preview")).toBeVisible();

    // Should show the markdown content
    await expect(page.getByText("Data Analytics Skill")).toBeVisible();
  });

  test("can close preview dialog", async ({ page }) => {
    const mockSkillContent = "# API Design Skill\n\nREST API best practices.";
    const skillsWithType = importedSkillsFixture
      .filter((s) => !s.is_bundled)
      .map((s) => ({ ...s, skill_type: "skill-builder" }));

    await page.addInitScript(
      ({ skills, content }) => {
        (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
          list_imported_skills: skills,
          get_skill_content: content,
        };
      },
      { skills: skillsWithType, content: mockSkillContent }
    );

    await navigateToSkillsLibrary(page);

    // Open preview (CardTitle is a <div>, not a heading)
    const apiDesignCard = page.locator("[data-slot='card']").filter({
      hasText: "api-design",
    }).first();

    await apiDesignCard.getByRole("button", { name: /preview/i }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    // Close dialog by pressing Escape (the X button uses sr-only "Close" text)
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });

  test("upload skill button is clickable", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    // Verify the Upload Skill button exists and is clickable
    const uploadButton = page.getByRole("button", { name: /upload skill/i }).first();
    await expect(uploadButton).toBeVisible();
    await expect(uploadButton).toBeEnabled();
  });

  test("can open Marketplace import dialog", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: [],
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

    // Dialog should open and auto-browse (shows loading or "Browse Marketplace" heading)
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Marketplace button is disabled without marketplace URL configured", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        list_imported_skills: [],
      };
    });

    await navigateToSkillsLibrary(page);

    // Marketplace button should be disabled when no marketplace URL is set (default mock has no marketplace_url)
    const marketplaceButton = page.getByRole("button", { name: /marketplace/i }).first();
    await expect(marketplaceButton).toBeVisible();
    await expect(marketplaceButton).toBeDisabled();
  });
});
