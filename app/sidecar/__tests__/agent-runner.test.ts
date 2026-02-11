import { describe, it, expect } from "vitest";
import { buildQueryOptions, type SidecarConfig } from "../agent-runner.js";

/** Minimal config every test needs — prompt, apiKey, and cwd are required. */
function baseConfig(overrides: Partial<SidecarConfig> = {}): SidecarConfig {
  return {
    prompt: "test prompt",
    apiKey: "sk-test",
    cwd: "/tmp/test",
    ...overrides,
  };
}

describe("buildQueryOptions", () => {
  // -----------------------------------------------------------------
  // Agent / model resolution
  // -----------------------------------------------------------------

  it("agent-only: passes agent + settingSources, no model", () => {
    const opts = buildQueryOptions(baseConfig({ agentName: "research" }));

    expect(opts).toHaveProperty("agent", "research");
    expect(opts).toHaveProperty("settingSources", ["project"]);
    expect(opts).not.toHaveProperty("model");
  });

  it("model-only: passes model, no agent", () => {
    const opts = buildQueryOptions(
      baseConfig({ model: "claude-sonnet-4-20250514" }),
    );

    expect(opts).toHaveProperty("model", "claude-sonnet-4-20250514");
    expect(opts).not.toHaveProperty("agent");
    expect(opts).not.toHaveProperty("settingSources");
  });

  it("both agent + model: passes agent + settingSources + model (model overrides front-matter)", () => {
    const opts = buildQueryOptions(
      baseConfig({
        agentName: "research",
        model: "claude-haiku-4-20250414",
      }),
    );

    expect(opts).toHaveProperty("agent", "research");
    expect(opts).toHaveProperty("settingSources", ["project"]);
    expect(opts).toHaveProperty("model", "claude-haiku-4-20250414");
  });

  it("neither agent nor model: no agent/model/settingSources in options", () => {
    const opts = buildQueryOptions(baseConfig());

    expect(opts).not.toHaveProperty("agent");
    expect(opts).not.toHaveProperty("settingSources");
    expect(opts).not.toHaveProperty("model");
  });

  // -----------------------------------------------------------------
  // Required fields always present
  // -----------------------------------------------------------------

  it("always includes cwd, allowedTools, maxTurns, permissionMode, executable", () => {
    const opts = buildQueryOptions(baseConfig());

    expect(opts).toHaveProperty("cwd", "/tmp/test");
    expect(opts).toHaveProperty("maxTurns", 50);
    expect(opts).toHaveProperty("permissionMode", "bypassPermissions");
    expect(opts).toHaveProperty("executable");
  });

  it("uses provided maxTurns when set", () => {
    const opts = buildQueryOptions(baseConfig({ maxTurns: 10 }));
    expect(opts.maxTurns).toBe(10);
  });

  it("uses provided permissionMode when set", () => {
    const opts = buildQueryOptions(baseConfig({ permissionMode: "default" }));
    expect(opts.permissionMode).toBe("default");
  });

  // -----------------------------------------------------------------
  // Optional fields — only present when provided
  // -----------------------------------------------------------------

  it("spreads sessionId as resume when provided", () => {
    const opts = buildQueryOptions(
      baseConfig({ sessionId: "sess-abc-123" }),
    );
    expect(opts).toHaveProperty("resume", "sess-abc-123");
  });

  it("does not include resume when sessionId is missing", () => {
    const opts = buildQueryOptions(baseConfig());
    expect(opts).not.toHaveProperty("resume");
  });

  it("spreads betas when provided", () => {
    const opts = buildQueryOptions(
      baseConfig({ betas: ["interleaved-thinking-2025-05-14"] }),
    );
    expect(opts).toHaveProperty("betas", [
      "interleaved-thinking-2025-05-14",
    ]);
  });

  it("does not include betas when missing", () => {
    const opts = buildQueryOptions(baseConfig());
    expect(opts).not.toHaveProperty("betas");
  });

  it("spreads pathToClaudeCodeExecutable when provided", () => {
    const opts = buildQueryOptions(
      baseConfig({ pathToClaudeCodeExecutable: "/usr/local/bin/claude" }),
    );
    expect(opts).toHaveProperty(
      "pathToClaudeCodeExecutable",
      "/usr/local/bin/claude",
    );
  });

  it("does not include pathToClaudeCodeExecutable when missing", () => {
    const opts = buildQueryOptions(baseConfig());
    expect(opts).not.toHaveProperty("pathToClaudeCodeExecutable");
  });
});
