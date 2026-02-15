import {
  createRouter,
  createRoute,
  createRootRoute,
} from "@tanstack/react-router";
import { AppLayout } from "./components/layout/app-layout";
import DashboardPage from "./pages/dashboard";
import SettingsPage from "./pages/settings";
import WorkflowPage from "./pages/workflow";
import PromptsPage from "./pages/prompts";
import SkillsPage from "./pages/skills";
import UsagePage from "./pages/usage";
const rootRoute = createRootRoute({
  component: AppLayout,
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
  component: WorkflowPage,
});

const promptsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/prompts",
  component: PromptsPage,
});

const skillsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/skills",
  component: SkillsPage,
});

const usageRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/usage",
  component: UsagePage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  settingsRoute,
  promptsRoute,
  skillsRoute,
  usageRoute,
  workflowRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
