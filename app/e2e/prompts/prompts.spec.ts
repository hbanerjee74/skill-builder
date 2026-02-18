import { test, expect } from "@playwright/test";
import { waitForAppReady } from "../helpers/app-helpers";

test.describe("Prompts Page", { tag: "@prompts" }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/prompts");
    await waitForAppReady(page);
  });

  test("shows empty state when no skill type or phase selected", async ({ page }) => {
    // Both dropdowns should be empty by default
    const skillTypeSelect = page.locator('select[aria-label="Skill Type"]');
    const phaseSelect = page.locator('select[aria-label="Phase"]');

    await expect(skillTypeSelect).toHaveValue("");
    await expect(phaseSelect).toHaveValue("");

    // Should show empty state message
    await expect(
      page.getByText("Select a skill type and phase to view the agent prompt.")
    ).toBeVisible();
  });

  test("loads and renders prompt content when skill type and phase are selected", async ({
    page,
  }) => {
    // Select skill type "Domain"
    const skillTypeSelect = page.locator('select[aria-label="Skill Type"]');
    await skillTypeSelect.selectOption("domain");

    // Select phase "Research"
    const phaseSelect = page.locator('select[aria-label="Phase"]');
    await phaseSelect.selectOption("research");

    // Wait for loading to complete - default mock returns sample content
    await expect(page.getByText("Loading prompt...")).not.toBeVisible();

    // Verify markdown content is rendered
    const markdownBody = page.locator("div.markdown-body");
    await expect(markdownBody).toBeVisible();

    // Verify content from mock: "# Sample Agent Prompt"
    await expect(
      markdownBody.getByRole("heading", { name: "Sample Agent Prompt" })
    ).toBeVisible();

    // Verify "## Instructions" heading is present
    await expect(
      markdownBody.getByRole("heading", { name: "Instructions" })
    ).toBeVisible();
  });

  test("shows error state when prompt loading fails", async ({ page }) => {
    // Override mock to throw an error
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        get_agent_prompt: new Error("Network error"),
      };
    });

    // Reload the page to apply the override
    await page.goto("/prompts");
    await waitForAppReady(page);

    // Select skill type and phase to trigger the error
    const skillTypeSelect = page.locator('select[aria-label="Skill Type"]');
    await skillTypeSelect.selectOption("platform");

    const phaseSelect = page.locator('select[aria-label="Phase"]');
    await phaseSelect.selectOption("generate-skill");

    // Should show error message in destructive text
    await expect(page.getByText(/Failed to load prompt:/)).toBeVisible();
    await expect(page.getByText(/Network error/)).toBeVisible();
  });

  test("can change selections to load different prompts", async ({ page }) => {
    // First selection
    const skillTypeSelect = page.locator('select[aria-label="Skill Type"]');
    await skillTypeSelect.selectOption("source");

    const phaseSelect = page.locator('select[aria-label="Phase"]');
    await phaseSelect.selectOption("confirm-decisions");

    // Content should load
    await expect(page.locator("div.markdown-body")).toBeVisible();

    // Change skill type
    await skillTypeSelect.selectOption("platform");

    // Content should reload (loading state may be brief)
    await expect(page.locator("div.markdown-body")).toBeVisible();

    // Change phase
    await phaseSelect.selectOption("validate-skill");

    // Content should reload again
    await expect(page.locator("div.markdown-body")).toBeVisible();
  });

  test("page heading is visible", async ({ page }) => {
    await expect(page.getByRole("heading", { name: "Agent Prompts" })).toBeVisible();
  });
});
