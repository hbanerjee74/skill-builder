import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CloseGuard } from "@/components/close-guard";
import { mockInvoke, mockListen, mockGetCurrentWindow, resetTauriMocks } from "@/test/mocks/tauri";
import { useWorkflowStore } from "@/stores/workflow-store";

describe("CloseGuard", () => {
  let closeRequestedCallback: (() => void) | null = null;

  beforeEach(() => {
    resetTauriMocks();
    useWorkflowStore.getState().reset();
    closeRequestedCallback = null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (mockListen as any).mockImplementation((eventName: string, callback: () => void) => {
      if (eventName === "close-requested") {
        closeRequestedCallback = callback;
      }
      return Promise.resolve(() => {});
    });
  });

  it("shows dialog with Stay and Close Anyway when agents are running", async () => {
    useWorkflowStore.setState({ workflowSessionId: "session-1" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "has_running_agents") return Promise.resolve(true);
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    render(<CloseGuard />);
    closeRequestedCallback?.();

    await waitFor(() => {
      expect(screen.getByText("Agents Still Running")).toBeInTheDocument();
    });

    expect(screen.getByText("Stay")).toBeInTheDocument();
    expect(screen.getByText("Close Anyway")).toBeInTheDocument();
  });

  it("calls graceful_shutdown and closes without dialog when no agents running", async () => {
    useWorkflowStore.setState({ workflowSessionId: "session-1" });
    const callOrder: string[] = [];
    const destroyFn = vi.fn(() => {
      callOrder.push("destroy");
      return Promise.resolve();
    });
    mockGetCurrentWindow.mockReturnValue({
      close: vi.fn(() => Promise.resolve()),
      destroy: destroyFn,
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "has_running_agents") return Promise.resolve(false);
      if (cmd === "graceful_shutdown") {
        callOrder.push("graceful_shutdown");
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    render(<CloseGuard />);
    closeRequestedCallback?.();

    await waitFor(() => {
      expect(destroyFn).toHaveBeenCalled();
    });

    expect(callOrder).toEqual(["graceful_shutdown", "destroy"]);
  });

  it("closes without dialog when no workflow session active", async () => {
    const callOrder: string[] = [];
    const destroyFn = vi.fn(() => {
      callOrder.push("destroy");
      return Promise.resolve();
    });
    mockGetCurrentWindow.mockReturnValue({
      close: vi.fn(() => Promise.resolve()),
      destroy: destroyFn,
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "has_running_agents") return Promise.resolve(false);
      if (cmd === "graceful_shutdown") {
        callOrder.push("graceful_shutdown");
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    render(<CloseGuard />);
    closeRequestedCallback?.();

    await waitFor(() => {
      expect(destroyFn).toHaveBeenCalled();
    });

    expect(callOrder).toEqual(["graceful_shutdown", "destroy"]);
  });

  it("Stay button dismisses dialog", async () => {
    const user = userEvent.setup();
    useWorkflowStore.setState({ workflowSessionId: "session-1" });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "has_running_agents") return Promise.resolve(true);
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    render(<CloseGuard />);
    closeRequestedCallback?.();

    await waitFor(() => {
      expect(screen.getByText("Agents Still Running")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Stay"));

    await waitFor(() => {
      expect(screen.queryByText("Agents Still Running")).not.toBeInTheDocument();
    });
  });

  it("Close Anyway calls graceful_shutdown then destroys window", async () => {
    const user = userEvent.setup();
    useWorkflowStore.setState({ workflowSessionId: "session-1" });
    const callOrder: string[] = [];

    const destroyFn = vi.fn(() => {
      callOrder.push("destroy");
      return Promise.resolve();
    });
    mockGetCurrentWindow.mockReturnValue({
      close: vi.fn(() => Promise.resolve()),
      destroy: destroyFn,
    });
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === "has_running_agents") return Promise.resolve(true);
      if (cmd === "graceful_shutdown") {
        callOrder.push("graceful_shutdown");
        return Promise.resolve();
      }
      return Promise.reject(new Error(`Unmocked: ${cmd}`));
    });

    render(<CloseGuard />);
    closeRequestedCallback?.();

    await waitFor(() => {
      expect(screen.getByText("Close Anyway")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Close Anyway"));

    await waitFor(() => {
      expect(destroyFn).toHaveBeenCalled();
    });

    // graceful_shutdown must be called before destroy
    expect(callOrder).toEqual(["graceful_shutdown", "destroy"]);
  });
});
