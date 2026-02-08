import { Outlet, useRouterState, Navigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

export function AppLayout() {
  const { isAuthenticated, isLoading } = useAuthStore();
  const routerState = useRouterState();
  const isLoginPage = routerState.location.pathname === "/login";

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated && !isLoginPage) {
    return <Navigate to="/login" />;
  }

  if (isLoginPage) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
