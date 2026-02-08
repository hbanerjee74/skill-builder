import { create } from "zustand";
import type { GitHubUser } from "@/lib/tauri";

interface AuthState {
  isAuthenticated: boolean;
  user: GitHubUser | null;
  token: string | null;
  isLoading: boolean;
  setUser: (user: GitHubUser, token: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  token: null,
  isLoading: true,
  setUser: (user, token) =>
    set({ isAuthenticated: true, user, token, isLoading: false }),
  logout: () =>
    set({ isAuthenticated: false, user: null, token: null, isLoading: false }),
  setLoading: (loading) => set({ isLoading: loading }),
}));
