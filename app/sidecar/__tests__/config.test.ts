import { describe, it, expect } from "vitest";
import { parseConfig } from "../config.js";

describe("parseConfig", () => {
  it("throws when config argument is missing", () => {
    // argv[0] = node, argv[1] = script — no argv[2]
    expect(() => parseConfig(["node", "agent-runner.js"])).toThrow(
      "Missing config argument"
    );
  });

  it("throws when config argument is empty string", () => {
    expect(() => parseConfig(["node", "agent-runner.js", ""])).toThrow(
      "Missing config argument"
    );
  });

  it("throws on invalid JSON", () => {
    expect(() =>
      parseConfig(["node", "agent-runner.js", "not-json"])
    ).toThrow("Failed to parse config:");
  });

  it("parses valid JSON config", () => {
    const config = {
      prompt: "test prompt",
      apiKey: "sk-test",
      cwd: "/tmp",
    };
    const result = parseConfig([
      "node",
      "agent-runner.js",
      JSON.stringify(config),
    ]);
    expect(result).toEqual(config);
  });

  it("preserves all optional fields", () => {
    const config = {
      prompt: "test prompt",
      apiKey: "sk-test",
      cwd: "/tmp",
      model: "claude-sonnet-4-20250514",
      agentName: "my-agent",
      allowedTools: ["Read", "Write"],
      maxTurns: 10,
      permissionMode: "acceptEdits",
      sessionId: "sess-123",
      betas: ["beta-1"],
      pathToClaudeCodeExecutable: "/usr/local/bin/claude",
    };
    const result = parseConfig([
      "node",
      "agent-runner.js",
      JSON.stringify(config),
    ]);
    expect(result).toEqual(config);
  });
});
