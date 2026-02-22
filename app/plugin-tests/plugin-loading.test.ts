import { describe, it, expect } from "vitest";
import { HAS_API_KEY, makeTempDir, runClaude } from "./helpers";

const BUDGET = process.env.MAX_BUDGET_T2 ?? "0.10";

describe.skipIf(!HAS_API_KEY)("plugin loading", () => {
  const dir = makeTempDir("t2");

  it(
    "Claude responds to plugin query",
    { timeout: 60_000 },
    () => {
      const output = runClaude(
        "What can the skill-builder plugin help me with? What types of skills can it build?",
        BUDGET,
        45_000,
        dir
      );
      expect(output).not.toBeNull();
    }
  );

  it(
    "response acknowledges plugin capabilities",
    { timeout: 60_000 },
    () => {
      const output = runClaude(
        "What can the skill-builder plugin help me with? What types of skills can it build?",
        BUDGET,
        45_000,
        dir
      );
      expect(output).toMatch(/plugin|skill|build|domain|platform|source|analytics|engineer/i);
    }
  );

  it(
    "skill can be triggered from natural language",
    { timeout: 75_000 },
    () => {
      const output = runClaude(
        "I want to build a domain skill for pet-store analytics. What are the first steps? Be brief.",
        BUDGET,
        60_000,
        dir
      );
      expect(output).toMatch(/domain|skill|research|question|knowledge|analytics|pet/i);
    }
  );
});
