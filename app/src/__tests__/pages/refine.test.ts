import { describe, it, expect } from "vitest";
import { buildPrompt, resolveAgentName } from "@/pages/refine";

describe("buildPrompt", () => {
  const skillDir = "/home/user/skill-builder/my-skill";

  it("uses absolute skill dir path in default refine prompt", () => {
    const prompt = buildPrompt("Add metrics section", skillDir, "");
    expect(prompt).toContain(`${skillDir}/`);
    expect(prompt).not.toContain("my-skill/ directory");
  });

  it("uses absolute skill dir path in rewrite prompt", () => {
    const prompt = buildPrompt("", skillDir, "", "rewrite");
    expect(prompt).toContain(`${skillDir}/SKILL.md`);
    expect(prompt).toContain(`${skillDir}/references/`);
  });

  it("uses absolute skill dir path in validate prompt", () => {
    const prompt = buildPrompt("", skillDir, "", "validate");
    expect(prompt).toContain(`${skillDir}/SKILL.md`);
    expect(prompt).toContain(`${skillDir}/references/`);
  });

  it("includes file constraint when provided", () => {
    const constraint = `\n\nIMPORTANT: Only edit these files: ${skillDir}/SKILL.md`;
    const prompt = buildPrompt("fix overview", skillDir, constraint);
    expect(prompt).toContain("IMPORTANT: Only edit these files");
    expect(prompt).toContain(`${skillDir}/SKILL.md`);
  });

  it("includes user text in refine prompt", () => {
    const prompt = buildPrompt("Add SLA metrics", skillDir, "");
    expect(prompt).toContain("Add SLA metrics");
  });

  it("includes additional instructions in rewrite prompt", () => {
    const prompt = buildPrompt("Focus on examples", skillDir, "", "rewrite");
    expect(prompt).toContain("Additional instructions: Focus on examples");
  });
});

describe("resolveAgentName", () => {
  it("returns refine-skill for default", () => {
    expect(resolveAgentName()).toBe("refine-skill");
    expect(resolveAgentName(undefined)).toBe("refine-skill");
  });

  it("returns rewrite-skill for rewrite command", () => {
    expect(resolveAgentName("rewrite")).toBe("rewrite-skill");
  });

  it("returns validate-skill for validate command", () => {
    expect(resolveAgentName("validate")).toBe("validate-skill");
  });
});
