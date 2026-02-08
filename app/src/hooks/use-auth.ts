import { useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import {
  getSettings,
  getCurrentUser,
  startDeviceFlow,
  pollDeviceFlow,
  logoutUser,
} from "@/lib/tauri";

export function useAuth() {
  const { isAuthenticated, user, token, isLoading, setUser, logout: clearAuth, setLoading } =
    useAuthStore();

  const checkAuth = useCallback(async () => {
    setLoading(true);
    try {
      const settings = await getSettings();
      if (settings.github_token) {
        const githubUser = await getCurrentUser(settings.github_token);
        setUser(githubUser, settings.github_token);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [setUser, setLoading]);

  const startLogin = useCallback(async () => {
    const response = await startDeviceFlow();
    return response;
  }, []);

  const pollLogin = useCallback(
    async (deviceCode: string) => {
      const result = await pollDeviceFlow(deviceCode);
      if (result.status === "complete" && result.token) {
        const githubUser = await getCurrentUser(result.token);
        setUser(githubUser, result.token);
      }
      return result;
    },
    [setUser]
  );

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  return { isAuthenticated, user, token, isLoading, checkAuth, startLogin, pollLogin, logout };
}
