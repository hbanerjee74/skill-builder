import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the SDK before importing anything that uses it
vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
  query: vi.fn(),
}));

import { query } from "@anthropic-ai/claude-agent-sdk";
import { runAgentRequest } from "../run-agent.js";
import type { SidecarConfig } from "../config.js";

const mockQuery = vi.mocked(query);

function baseConfig(overrides: Partial<SidecarConfig> = {}): SidecarConfig {
  return {
    prompt: "test prompt",
    apiKey: "sk-test",
    cwd: "/tmp/test",
    ...overrides,
  };
}

describe("runAgentRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls query with the correct prompt", async () => {
    async function* fakeConversation() {
      yield { type: "result", content: "done" };
    }
    mockQuery.mockReturnValue(fakeConversation() as ReturnType<typeof query>);

    const messages: Record<string, unknown>[] = [];
    await runAgentRequest(baseConfig({ prompt: "hello agent" }), (msg) =>
      messages.push(msg),
    );

    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "hello agent",
      }),
    );
  });

  it("streams all messages to the onMessage callback", async () => {
    const sdkMessages = [
      { type: "agent_message", content: "step 1" },
      { type: "tool_use", name: "Read", input: {} },
      { type: "result", content: "done" },
    ];

    async function* fakeConversation() {
      for (const msg of sdkMessages) {
        yield msg;
      }
    }
    mockQuery.mockReturnValue(fakeConversation() as ReturnType<typeof query>);

    const messages: Record<string, unknown>[] = [];
    await runAgentRequest(baseConfig(), (msg) => messages.push(msg));

    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ type: "agent_message", content: "step 1" });
    expect(messages[1]).toEqual({ type: "tool_use", name: "Read", input: {} });
    expect(messages[2]).toEqual({ type: "result", content: "done" });
  });

  it("propagates SDK errors", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("SDK failure");
    });

    await expect(
      runAgentRequest(baseConfig(), vi.fn()),
    ).rejects.toThrow("SDK failure");
  });

  it("sets ANTHROPIC_API_KEY when apiKey is provided", async () => {
    async function* fakeConversation() {
      yield { type: "result", content: "done" };
    }
    mockQuery.mockReturnValue(fakeConversation() as ReturnType<typeof query>);

    const originalKey = process.env.ANTHROPIC_API_KEY;
    try {
      await runAgentRequest(
        baseConfig({ apiKey: "sk-my-test-key" }),
        vi.fn(),
      );
      expect(process.env.ANTHROPIC_API_KEY).toBe("sk-my-test-key");
    } finally {
      if (originalKey !== undefined) {
        process.env.ANTHROPIC_API_KEY = originalKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  it("passes options with correct defaults", async () => {
    async function* fakeConversation() {
      yield { type: "result", content: "done" };
    }
    mockQuery.mockReturnValue(fakeConversation() as ReturnType<typeof query>);

    await runAgentRequest(baseConfig(), vi.fn());

    const callArgs = mockQuery.mock.calls[0][0];
    expect(callArgs.options).toMatchObject({
      cwd: "/tmp/test",
      maxTurns: 50,
      permissionMode: "bypassPermissions",
    });
  });
});
