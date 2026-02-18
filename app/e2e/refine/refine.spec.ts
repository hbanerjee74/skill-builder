/**
 * E2E tests for the Refine page.
 *
 * Tests use the E2E mock layer (TAURI_E2E=true) to replace Tauri
 * commands with in-memory responses. Agent lifecycle events are
 * dispatched through the agent simulator, exercising the same code
 * paths the real sidecar would trigger.
 *
 * Unlike the workflow page (which gets agentId from the `run_workflow_step`
 * mock response), the refine page generates its own agentId via
 * `crypto.randomUUID()`. Tests read the agentId from the rendered
 * `data-agent-id` attribute on the thinking indicator / agent turn element.
 */
import { test, expect, type Page } from "@playwright/test";
import { simulateAgentRun } from "../helpers/agent-simulator";
import {
  navigateToRefine,
  navigateToRefineWithSkill,
} from "../helpers/refine-helpers";

/**
 * After clicking send, wait for the thinking indicator then read the
 * dynamically-generated agent ID from the DOM.
 */
async function getAgentId(page: Page): Promise<string> {
  const thinking = page.getByTestId("refine-agent-thinking");
  await thinking.waitFor({ timeout: 5_000 });
  const agentId = await thinking.getAttribute("data-agent-id");
  if (!agentId) throw new Error("Could not read agent ID from thinking indicator");
  return agentId;
}

test.describe("Refine Page", { tag: "@refine" }, () => {
  test("shows skill picker and placeholder when no skill selected", async ({ page }) => {
    await navigateToRefine(page);

    // Skill picker shows placeholder
    await expect(page.getByRole("button", { name: /Select a skill/ })).toBeVisible();

    // Chat panel shows no-skill prompt
    await expect(page.getByTestId("refine-no-skill")).toBeVisible();
    await expect(page.getByTestId("refine-no-skill")).toContainText(
      "Select a skill to start refining",
    );

    // Preview panel shows no-skill prompt
    await expect(page.getByTestId("refine-preview-empty")).toBeVisible();
    await expect(page.getByTestId("refine-preview-empty")).toContainText(
      "Select a skill to preview its files",
    );
  });

  test("auto-selects skill from search param and loads files", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    // Skill picker shows the selected skill name
    await expect(page.getByText("Test Skill").first()).toBeVisible();

    // Preview panel file picker shows SKILL.md (first file)
    await expect(page.getByTestId("refine-file-picker")).toContainText("SKILL.md");

    // Chat input is enabled
    await expect(page.getByTestId("refine-chat-input")).toBeEnabled();

    // Chat shows empty state (no messages yet)
    await expect(page.getByTestId("refine-chat-empty")).toBeVisible();
  });

  test("skill picker dropdown shows available skills", async ({ page }) => {
    await navigateToRefine(page);

    // Open skill picker
    await page.getByRole("button", { name: /Select a skill/ }).click();

    // Both skills should be visible in the dropdown
    await expect(page.getByRole("option", { name: /Test Skill/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Analytics/ })).toBeVisible();

    // Select Test Skill
    await page.getByRole("option", { name: /Test Skill/ }).click();

    // Skill picker now shows "Test Skill"
    await expect(page.getByText("Test Skill").first()).toBeVisible();

    // Preview panel should load — file picker shows SKILL.md
    await expect(page.getByTestId("refine-file-picker")).toContainText("SKILL.md");
  });

  test("send a refine message and see agent response", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    // Type a message
    const input = page.getByTestId("refine-chat-input");
    await input.fill("improve the intro section");

    // Send
    await page.getByTestId("refine-send-button").click();

    // User message appears in chat
    await expect(page.getByText("improve the intro section")).toBeVisible();

    // Read the dynamically-generated agent ID from the thinking indicator
    const agentId = await getAgentId(page);

    // Simulate agent run
    await simulateAgentRun(page, {
      agentId,
      messages: [
        "Reading SKILL.md...",
        "I've updated the introduction to be more concise and actionable.",
      ],
      result: "Refinement complete.",
    });

    // Agent messages appear
    await expect(
      page.getByText("I've updated the introduction to be more concise and actionable."),
    ).toBeVisible();

    // Thinking indicator is gone (agent has messages now, or has exited)
    await expect(page.getByTestId("refine-agent-thinking")).not.toBeVisible();
  });

  test("slash command /rewrite shows badge and sends command", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    const input = page.getByTestId("refine-chat-input");

    // Type "/" to trigger command picker
    await input.press("/");
    await page.waitForTimeout(100);

    // Command picker should open with both options
    await expect(page.getByText("Rewrite skill")).toBeVisible();
    await expect(page.getByText("Validate skill")).toBeVisible();

    // Select "Rewrite skill"
    await page.getByText("Rewrite skill").click();

    // /rewrite badge should appear
    await expect(page.getByTestId("refine-command-badge")).toBeVisible();
    await expect(page.getByTestId("refine-command-badge")).toContainText("/rewrite");

    // Type additional instructions
    await input.fill("improve structure");

    // Send
    await input.press("Enter");

    // User message in chat should show the /rewrite badge
    await expect(page.getByText("/rewrite").last()).toBeVisible();

    // Read agentId and simulate agent
    const agentId = await getAgentId(page);
    await simulateAgentRun(page, {
      agentId,
      messages: ["Rewriting skill with improved structure..."],
      result: "Rewrite complete.",
    });

    await expect(page.getByText("Rewriting skill with improved structure...")).toBeVisible();
  });

  test("slash command /validate with no text sends correctly", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    const input = page.getByTestId("refine-chat-input");

    // Type "/" to trigger command picker
    await input.press("/");
    await page.waitForTimeout(100);

    // Select "Validate skill"
    await page.getByText("Validate skill").click();

    // /validate badge should appear
    await expect(page.getByTestId("refine-command-badge")).toBeVisible();
    await expect(page.getByTestId("refine-command-badge")).toContainText("/validate");

    // Send with no text (just the command)
    await page.getByTestId("refine-send-button").click();

    // Should see the /validate badge in chat history (no empty bubble)
    await expect(page.getByText("/validate").last()).toBeVisible();

    // Read agentId and simulate agent
    const agentId = await getAgentId(page);
    await simulateAgentRun(page, {
      agentId,
      messages: ["Validating skill files..."],
      result: "Validation complete. No issues found.",
    });

    await expect(page.getByText("Validating skill files...")).toBeVisible();
  });

  test("@file targeting shows file badge", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    const input = page.getByTestId("refine-chat-input");

    // Type "@" to trigger file picker
    await input.press("@");
    await page.waitForTimeout(100);

    // File picker should show available files
    await expect(page.getByText("SKILL.md").last()).toBeVisible();
    await expect(page.getByText("references/glossary.md")).toBeVisible();

    // Select SKILL.md
    await page.getByText("SKILL.md").last().click();

    // @SKILL.md badge should appear — use locator scoped to badges area
    // (avoids matching the textarea which also contains @SKILL.md text)
    const badgeArea = page.locator("[data-variant='secondary']", { hasText: "@SKILL.md" });
    await expect(badgeArea.first()).toBeVisible();

    // Type a message and send
    await input.fill("fix the intro");
    await input.press("Enter");

    // User message should show SKILL.md badge in the chat
    await expect(page.getByText("SKILL.md").last()).toBeVisible();
  });

  test("preview panel file picker switches files", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    // Initially shows SKILL.md
    await expect(page.getByTestId("refine-file-picker")).toContainText("SKILL.md");

    // Open file picker
    await page.getByTestId("refine-file-picker").click();

    // Should show both files
    await expect(page.getByRole("option", { name: /SKILL\.md/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /references\/glossary\.md/ })).toBeVisible();

    // Select glossary
    await page.getByRole("option", { name: /references\/glossary\.md/ }).click();

    // File picker should now show glossary
    await expect(page.getByTestId("refine-file-picker")).toContainText("references/glossary.md");
  });

  test("diff toggle button disabled when no baseline", async ({ page }) => {
    await navigateToRefineWithSkill(page);

    // Diff toggle should exist but be disabled (no baseline snapshot)
    const diffToggle = page.getByTestId("refine-diff-toggle");
    await expect(diffToggle).toBeVisible();
    await expect(diffToggle).toBeDisabled();
  });
});
