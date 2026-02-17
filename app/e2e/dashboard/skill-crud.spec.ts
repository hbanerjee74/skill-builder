import { test, expect } from "@playwright/test";
import { waitForAppReady } from "../helpers/app-helpers";

const WORKSPACE_OVERRIDES = {
  get_settings: {
    anthropic_api_key: "sk-ant-test",
    workspace_path: "/tmp/test-workspace",
    skills_path: "/tmp/test-skills",
  },
  check_workspace_path: true,
  list_skills: [],
};

test.describe("Skill CRUD", { tag: "@dashboard" }, () => {
  test.beforeEach(async ({ page }) => {
    // Configure a workspace so the dashboard shows the New Skill button
    await page.addInitScript((overrides) => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = overrides;
    }, WORKSPACE_OVERRIDES);
    await page.goto("/");
    await waitForAppReady(page);
  });

  test("shows New Skill button when workspace is configured", async ({ page }) => {
    const newSkillButton = page.getByRole("button", { name: /new skill/i }).first();
    await expect(newSkillButton).toBeVisible();
  });

  test("can submit create skill form", async ({ page }) => {
    const newSkillButton = page.getByRole("button", { name: /new skill/i }).first();
    await newSkillButton.click();

    // Select a skill type (required for the Create button to be enabled)
    await page.getByRole("radio", { name: /Domain/ }).click();

    await page.getByRole("textbox", { name: "Domain" }).fill("HR analytics");
    await expect(page.getByRole("textbox", { name: "Skill Name" })).toHaveValue("hr-analytics");

    // Submit
    const createButton = page.getByRole("button", { name: "Create" });
    await expect(createButton).toBeEnabled();
    await createButton.click();

    // Dialog should close (mock returns success)
    await expect(page.getByRole("heading", { name: "Create New Skill" })).not.toBeVisible();
  });

  test("shows skill cards when skills exist", async ({ page }) => {
    // Override with skills data
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        get_settings: {
          anthropic_api_key: "sk-ant-test",
          workspace_path: "/tmp/test-workspace",
          skills_path: "/tmp/test-skills",
        },
        check_workspace_path: true,
        list_skills: [
          {
            name: "sales-pipeline",
            domain: "Sales",
            current_step: "Step 3",
            status: "in_progress",
            last_modified: new Date().toISOString(),
          },
        ],
      };
    });
    await page.goto("/");
    await waitForAppReady(page);

    // Skill card should show the formatted name
    await expect(page.getByText("Sales Pipeline")).toBeVisible();
    await expect(page.getByText("Sales", { exact: true })).toBeVisible();
    await expect(page.getByText("In Progress")).toBeVisible();
  });

  test("can open delete dialog from skill card", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        get_settings: {
          anthropic_api_key: "sk-ant-test",
          workspace_path: "/tmp/test-workspace",
          skills_path: "/tmp/test-skills",
        },
        check_workspace_path: true,
        list_skills: [
          {
            name: "my-skill",
            domain: "Testing",
            current_step: null,
            status: null,
            last_modified: null,
          },
        ],
      };
    });
    await page.goto("/");
    await waitForAppReady(page);

    // Click the delete icon button on the skill card
    const deleteButton = page.locator("button").filter({ has: page.locator("svg.lucide-trash-2") });
    await deleteButton.click();

    // Delete confirmation dialog should appear
    await expect(page.getByRole("heading", { name: "Delete Skill" })).toBeVisible();
    await expect(page.getByText("my-skill")).toBeVisible();
  });

  test("can confirm skill deletion", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        get_settings: {
          anthropic_api_key: "sk-ant-test",
          workspace_path: "/tmp/test-workspace",
          skills_path: "/tmp/test-skills",
        },
        check_workspace_path: true,
        list_skills: [
          {
            name: "delete-me",
            domain: "Test",
            current_step: null,
            status: null,
            last_modified: null,
          },
        ],
        delete_skill: undefined,
      };
    });
    await page.goto("/");
    await waitForAppReady(page);

    // Open delete dialog
    const deleteButton = page.locator("button").filter({ has: page.locator("svg.lucide-trash-2") });
    await deleteButton.click();

    // Confirm deletion
    const confirmButton = page.getByRole("button", { name: "Delete" });
    await confirmButton.click();

    // Dialog should close
    await expect(page.getByRole("heading", { name: "Delete Skill" })).not.toBeVisible();
  });

  test("can cancel delete dialog", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = {
        get_settings: {
          anthropic_api_key: "sk-ant-test",
          workspace_path: "/tmp/test-workspace",
          skills_path: "/tmp/test-skills",
        },
        check_workspace_path: true,
        list_skills: [
          {
            name: "keep-me",
            domain: "Test",
            current_step: null,
            status: null,
            last_modified: null,
          },
        ],
      };
    });
    await page.goto("/");
    await waitForAppReady(page);

    // Open delete dialog
    const deleteButton = page.locator("button").filter({ has: page.locator("svg.lucide-trash-2") });
    await deleteButton.click();

    // Cancel
    await page.getByRole("button", { name: "Cancel" }).click();

    // Dialog should close, skill card should remain
    await expect(page.getByRole("heading", { name: "Delete Skill" })).not.toBeVisible();
    await expect(page.getByText("Keep Me")).toBeVisible();
  });
});
