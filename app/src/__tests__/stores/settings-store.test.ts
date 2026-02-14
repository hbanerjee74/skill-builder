import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore } from "@/stores/settings-store";

describe("useSettingsStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useSettingsStore.getState().reset();
  });

  it("has null fields and isConfigured=false in initial state", () => {
    const state = useSettingsStore.getState();
    expect(state.anthropicApiKey).toBeNull();
    expect(state.workspacePath).toBeNull();
    expect(state.isConfigured).toBe(false);
  });

  it("setSettings with apiKey sets isConfigured to true", () => {
    useSettingsStore.getState().setSettings({
      anthropicApiKey: "sk-ant-test-key",
    });
    const state = useSettingsStore.getState();
    expect(state.anthropicApiKey).toBe("sk-ant-test-key");
    expect(state.isConfigured).toBe(true);
  });

  it("setSettings without apiKey keeps isConfigured false", () => {
    useSettingsStore.getState().setSettings({
      workspacePath: "/some/path",
    });
    const state = useSettingsStore.getState();
    expect(state.workspacePath).toBe("/some/path");
    expect(state.isConfigured).toBe(false);
  });

  it("setSettings preserves existing fields not included in update", () => {
    useSettingsStore.getState().setSettings({
      anthropicApiKey: "sk-ant-test-key",
    });
    useSettingsStore.getState().setSettings({
      workspacePath: "/some/path",
    });
    const state = useSettingsStore.getState();
    expect(state.anthropicApiKey).toBe("sk-ant-test-key");
    expect(state.workspacePath).toBe("/some/path");
    expect(state.isConfigured).toBe(true);
  });

  it("reset returns to initial state", () => {
    useSettingsStore.getState().setSettings({
      anthropicApiKey: "sk-ant-test-key",
      workspacePath: "/some/path",
    });
    // Verify configured before reset
    expect(useSettingsStore.getState().isConfigured).toBe(true);

    useSettingsStore.getState().reset();

    const state = useSettingsStore.getState();
    expect(state.anthropicApiKey).toBeNull();
    expect(state.workspacePath).toBeNull();
    expect(state.isConfigured).toBe(false);
  });

  it("has empty mcpServers in initial state", () => {
    const state = useSettingsStore.getState();
    expect(state.mcpServers).toEqual([]);
  });

  it("addMcpServer adds a server", () => {
    useSettingsStore.getState().addMcpServer({
      name: "linear",
      type: "http",
      url: "https://mcp.linear.app/mcp",
      headers: { Authorization: "Bearer test" },
    });
    const state = useSettingsStore.getState();
    expect(state.mcpServers).toHaveLength(1);
    expect(state.mcpServers[0].name).toBe("linear");
  });

  it("updateMcpServer replaces server by name", () => {
    useSettingsStore.getState().addMcpServer({
      name: "linear",
      type: "http",
      url: "https://old-url.com",
      headers: {},
    });
    useSettingsStore.getState().updateMcpServer("linear", {
      name: "linear",
      type: "http",
      url: "https://mcp.linear.app/mcp",
      headers: { Authorization: "Bearer token" },
    });
    const state = useSettingsStore.getState();
    expect(state.mcpServers).toHaveLength(1);
    expect(state.mcpServers[0].url).toBe("https://mcp.linear.app/mcp");
  });

  it("removeMcpServer removes server by name", () => {
    useSettingsStore.getState().addMcpServer({
      name: "linear",
      type: "http",
      url: "https://mcp.linear.app/mcp",
      headers: {},
    });
    useSettingsStore.getState().addMcpServer({
      name: "notion",
      type: "http",
      url: "https://mcp.notion.com/mcp",
      headers: {},
    });
    useSettingsStore.getState().removeMcpServer("linear");
    const state = useSettingsStore.getState();
    expect(state.mcpServers).toHaveLength(1);
    expect(state.mcpServers[0].name).toBe("notion");
  });

  it("reset clears mcpServers", () => {
    useSettingsStore.getState().addMcpServer({
      name: "linear",
      type: "http",
      url: "https://mcp.linear.app/mcp",
      headers: {},
    });
    useSettingsStore.getState().reset();
    const state = useSettingsStore.getState();
    expect(state.mcpServers).toEqual([]);
  });
});
