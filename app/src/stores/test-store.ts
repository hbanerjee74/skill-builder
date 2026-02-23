import { create } from "zustand";

interface TestRunState {
  isRunning: boolean;
  setRunning: (running: boolean) => void;
}

export const useTestStore = create<TestRunState>((set) => ({
  isRunning: false,
  setRunning: (running) => set({ isRunning: running }),
}));
