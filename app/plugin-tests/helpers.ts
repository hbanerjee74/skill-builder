import { spawnSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

export const PLUGIN_DIR = path.resolve(__dirname, "../..");
export const CLAUDE_BIN = process.env.CLAUDE_BIN ?? "claude";
export const HAS_API_KEY = !!process.env.ANTHROPIC_API_KEY;

export function hasClaude(): boolean {
  const result = spawnSync("which", [CLAUDE_BIN], { encoding: "utf8" });
  return result.status === 0;
}

/** Create a temp directory for a test fixture, cleaned up automatically via afterAll. */
export function makeTempDir(label: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `skill-builder-test-${label}-`));
}

/**
 * Run Claude CLI with a prompt and return the stdout output.
 * Returns null if the process times out or exits non-zero.
 */
export function runClaude(
  prompt: string,
  budgetUsd: string,
  timeoutMs: number,
  cwd: string
): string | null {
  // Unset CLAUDECODE so Claude doesn't detect it's inside a Claude Code session
  const env = { ...process.env, CLAUDECODE: undefined };

  const result = spawnSync(
    CLAUDE_BIN,
    [
      "-p",
      "--plugin-dir",
      PLUGIN_DIR,
      "--dangerously-skip-permissions",
      "--max-budget-usd",
      budgetUsd,
    ],
    {
      input: prompt,
      encoding: "utf8",
      cwd,
      env,
      timeout: timeoutMs,
    }
  );

  if (result.error || result.status !== 0) {
    return null;
  }
  return (result.stdout ?? "").trim();
}
