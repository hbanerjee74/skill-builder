import {
  createRouter,
  createRoute,
  createRootRoute,
} from "@tanstack/react-router";
import { AppLayout } from "./components/layout/app-layout";
import LoginPage from "./pages/login";
import DashboardPage from "./pages/dashboard";
import SettingsPage from "./pages/settings";

const rootRoute = createRootRoute({
  component: AppLayout,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const workflowRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skill/$skillName",
  component: () => <div className="p-8">Workflow — coming in Phase 2</div>,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  dashboardRoute,
  settingsRoute,
  workflowRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
