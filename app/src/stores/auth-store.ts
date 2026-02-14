import { create } from "zustand";
import type { GitHubUser } from "@/lib/types";
import { githubGetUser, githubLogout } from "@/lib/tauri";

interface AuthState {
  user: GitHubUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  loadUser: () => Promise<void>;
  setUser: (user: GitHubUser | null) => void;
  logout: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  user: null,
  isLoggedIn: false,
  isLoading: false,
};

export const useAuthStore = create<AuthState>((set) => ({
  ...initialState,

  loadUser: async () => {
    set({ isLoading: true });
    try {
      const user = await githubGetUser();
      set({ user, isLoggedIn: user !== null, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  setUser: (user) => set({ user, isLoggedIn: user !== null }),

  logout: async () => {
    try {
      await githubLogout();
      set({ user: null, isLoggedIn: false });
    } catch (error) {
      console.error("Logout failed:", error);
    }
  },

  reset: () => set(initialState),
}));
