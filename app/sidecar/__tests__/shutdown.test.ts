import { describe, it, expect, vi } from "vitest";
import { createAbortState, handleShutdown } from "../shutdown.js";

describe("createAbortState", () => {
  it("returns aborted=false and a fresh AbortController", () => {
    const state = createAbortState();
    expect(state.aborted).toBe(false);
    expect(state.abortController).toBeInstanceOf(AbortController);
    expect(state.abortController.signal.aborted).toBe(false);
  });
});

describe("handleShutdown", () => {
  it("sets aborted flag to true", () => {
    const state = createAbortState();
    const exitFn = vi.fn();
    const timerFn = vi.fn(() => ({ unref: vi.fn() }));

    handleShutdown(state, exitFn, timerFn);

    expect(state.aborted).toBe(true);
  });

  it("calls abort() on the controller", () => {
    const state = createAbortState();
    const exitFn = vi.fn();
    const timerFn = vi.fn(() => ({ unref: vi.fn() }));

    handleShutdown(state, exitFn, timerFn);

    expect(state.abortController.signal.aborted).toBe(true);
  });

  it("schedules a force-exit timeout of 3 seconds", () => {
    const state = createAbortState();
    const exitFn = vi.fn();
    const unrefMock = vi.fn();
    const timerFn = vi.fn(() => ({ unref: unrefMock }));

    handleShutdown(state, exitFn, timerFn);

    expect(timerFn).toHaveBeenCalledOnce();
    expect(timerFn).toHaveBeenCalledWith(expect.any(Function), 3000);
    expect(unrefMock).toHaveBeenCalledOnce();
  });

  it("force-exit callback calls exitFn with code 0", () => {
    const state = createAbortState();
    const exitFn = vi.fn();
    const timerFn = vi.fn((cb: () => void, _ms: number) => {
      cb(); // immediately invoke the callback
      return { unref: vi.fn() };
    });

    handleShutdown(state, exitFn, timerFn);

    expect(exitFn).toHaveBeenCalledWith(0);
  });
});
