/**
 * Shared refine-page helpers for E2E tests.
 *
 * Mirrors workflow-helpers.ts: provides mock overrides and navigation
 * utilities so refine specs share the same foundation.
 */
import type { Page } from "@playwright/test";
import { waitForAppReady } from "./app-helpers";

/**
 * Common mock overrides for the refine page.
 * Configures settings, a couple of refinable skills, and skill file listing.
 */
export const REFINE_OVERRIDES: Record<string, unknown> = {
  get_settings: {
    anthropic_api_key: "sk-ant-test",
    workspace_path: "/tmp/test-workspace",
    skills_path: "/tmp/test-skills",
  },
  list_refinable_skills: [
    {
      name: "test-skill",
      display_name: "Test Skill",
      domain: "Testing",
      current_step: null,
      status: "completed",
      last_modified: null,
      skill_type: "domain",
    },
    {
      name: "analytics-skill",
      display_name: "Analytics",
      domain: "Data",
      current_step: null,
      status: "completed",
      last_modified: null,
      skill_type: "source",
    },
  ],
  list_skill_files: [
    { relative_path: "SKILL.md" },
    { relative_path: "references/glossary.md" },
  ],
  read_file:
    "# Test Skill\n\nA skill for testing.\n\n## Instructions\n\nFollow these steps...",
  start_agent: "agent-refine-001",
};

/**
 * Navigate to the refine page without a pre-selected skill.
 * Waits for splash → setup → skill picker to be visible.
 */
export async function navigateToRefine(
  page: Page,
  overrides?: Record<string, unknown>,
): Promise<void> {
  const merged = { ...REFINE_OVERRIDES, ...overrides };
  await page.addInitScript((o) => {
    (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = o;
  }, merged);
  await page.goto("/refine");
  await waitForAppReady(page);
  // Wait for skill picker to finish loading
  await page.getByRole("button", { name: /Select a skill/ }).waitFor({ timeout: 10_000 });
}

/**
 * Navigate to the refine page with `?skill=test-skill` so the skill
 * is auto-selected and files are loaded on mount.
 */
export async function navigateToRefineWithSkill(
  page: Page,
  overrides?: Record<string, unknown>,
): Promise<void> {
  const merged = { ...REFINE_OVERRIDES, ...overrides };
  await page.addInitScript((o) => {
    (window as unknown as Record<string, unknown>).__TAURI_MOCK_OVERRIDES__ = o;
  }, merged);
  await page.goto("/refine?skill=test-skill");
  await waitForAppReady(page);
  // Wait for the auto-selected skill name to appear in the picker
  await page.getByText("Test Skill").first().waitFor({ timeout: 10_000 });
}
