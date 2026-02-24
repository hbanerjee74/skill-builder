import { useEffect, useState } from "react";
import { Outlet, useNavigate, useRouterState, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { CloseGuard } from "@/components/close-guard";
import { SplashScreen } from "@/components/splash-screen";
import { SetupScreen } from "@/components/setup-screen";
import OrphanResolutionDialog from "@/components/orphan-resolution-dialog";
import ReconciliationAckDialog from "@/components/reconciliation-ack-dialog";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { getSettings, reconcileStartup, parseGitHubUrl, checkMarketplaceUpdates, importGitHubSkills, importMarketplaceToLibrary, checkSkillCustomized } from "@/lib/tauri";
import { invoke } from "@tauri-apps/api/core";
import type { ModelInfo } from "@/stores/settings-store";
import type { DiscoveredSkill, OrphanSkill } from "@/lib/types";

export function AppLayout() {
  const setSettings = useSettingsStore((s) => s.setSettings);
  const isConfigured = useSettingsStore((s) => s.isConfigured);
  const navigate = useNavigate();
  const router = useRouter();
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isSettings = currentPath === "/settings";
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [reconciled, setReconciled] = useState(false);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const [nodeReady, setNodeReady] = useState(false);
  const [orphans, setOrphans] = useState<OrphanSkill[]>([]);
  const [reconNotifications, setReconNotifications] = useState<string[]>([]);
  const [reconDiscovered, setReconDiscovered] = useState<DiscoveredSkill[]>([]);
  const [ackDone, setAckDone] = useState(true);

  // Hydrate settings store from Tauri backend on app startup
  useEffect(() => {
    let cancelled = false;

    getSettings().then((s) => {
      if (cancelled) return;
      setSettings({
        anthropicApiKey: s.anthropic_api_key,
        workspacePath: s.workspace_path,
        skillsPath: s.skills_path,
        preferredModel: s.preferred_model,
        logLevel: s.log_level,
        extendedThinking: s.extended_thinking,
        githubOauthToken: s.github_oauth_token,
        githubUserLogin: s.github_user_login,
        githubUserAvatar: s.github_user_avatar,
        githubUserEmail: s.github_user_email,
        marketplaceUrl: s.marketplace_url,
        dashboardViewMode: s.dashboard_view_mode,
      });
      setSettingsLoaded(true);
      // Fetch available models in the background — no need to await
      if (s.anthropic_api_key) {
        invoke<ModelInfo[]>("list_models", { apiKey: s.anthropic_api_key })
          .then((models) => { if (!cancelled) setSettings({ availableModels: models }); })
          .catch((err) => console.warn("[app-layout] Could not fetch model list:", err));
      }
      // Check for marketplace updates in the background
      if (s.marketplace_url) {
        parseGitHubUrl(s.marketplace_url)
          .then(async (info) => {
            const { library, workspace } = await checkMarketplaceUpdates(
              info.owner, info.repo, info.branch, info.subpath ?? undefined
            );
            if (cancelled) return;

            if (s.auto_update) {
              // Auto-update: import all non-customized skills silently
              const [libFiltered, wsFiltered] = await Promise.all([
                Promise.all(library.map(async (skill) => {
                  const customized = await checkSkillCustomized(skill.name).catch(() => false);
                  return customized ? null : skill;
                })).then((r) => r.filter((s): s is NonNullable<typeof s> => s !== null)),
                Promise.all(workspace.map(async (skill) => {
                  const customized = await checkSkillCustomized(skill.name).catch(() => false);
                  return customized ? null : skill;
                })).then((r) => r.filter((s): s is NonNullable<typeof s> => s !== null)),
              ]);
              if (cancelled) return;

              await Promise.all([
                libFiltered.length > 0
                  ? importMarketplaceToLibrary(libFiltered.map((s) => s.path)).catch((err) =>
                      console.warn("[app-layout] Auto-update library failed:", err)
                    )
                  : Promise.resolve(),
                wsFiltered.length > 0
                  ? importGitHubSkills(
                      info.owner, info.repo, info.branch,
                      wsFiltered.map((s) => ({ path: s.path, purpose: null, metadata_override: null, version: s.version }))
                    ).catch((err) =>
                      console.warn("[app-layout] Auto-update workspace failed:", err)
                    )
                  : Promise.resolve(),
              ]);
              if (cancelled) return;

              const total = libFiltered.length + wsFiltered.length;
              if (total > 0) {
                toast.success(
                  <div className="space-y-1">
                    <p className="font-medium">Auto-updated {total} skill{total !== 1 ? "s" : ""}</p>
                    {libFiltered.length > 0 && (
                      <p>• Skills Library: {libFiltered.map((s) => s.name).join(", ")}</p>
                    )}
                    {wsFiltered.length > 0 && (
                      <p>• Workspace: {wsFiltered.map((s) => s.name).join(", ")}</p>
                    )}
                  </div>,
                  { duration: Infinity }
                );
              }
            } else {
              // Manual update: show persistent toasts only for versions not yet notified.
              // Suppresses repeated toasts on every cold launch for the same available version.
              const NOTIFIED_KEY = "marketplace_notified_versions";
              const notified: Record<string, string> = (() => {
                try { return JSON.parse(localStorage.getItem(NOTIFIED_KEY) ?? "{}"); }
                catch { return {}; }
              })();

              const libNew = library.filter((s) => notified[`lib:${s.name}`] !== s.version);
              const wsNew = workspace.filter((s) => notified[`ws:${s.name}`] !== s.version);

              if (libNew.length > 0) {
                const names = libNew.map((s) => s.name);
                toast.info(
                  `Skills Library: update available for ${libNew.length} skill${libNew.length !== 1 ? "s" : ""}: ${names.join(", ")}`,
                  {
                    duration: Infinity,
                    action: {
                      label: "Upgrade",
                      onClick: () => {
                        useSettingsStore.getState().setPendingUpgradeOpen({ mode: "skill-library", skills: names });
                        router.navigate({ to: "/" });
                      },
                    },
                  }
                );
              }
              if (wsNew.length > 0) {
                const names = wsNew.map((s) => s.name);
                toast.info(
                  `Settings \u2192 Skills: update available for ${wsNew.length} skill${wsNew.length !== 1 ? "s" : ""}: ${names.join(", ")}`,
                  {
                    duration: Infinity,
                    action: {
                      label: "Upgrade",
                      onClick: () => {
                        useSettingsStore.getState().setPendingUpgradeOpen({ mode: "settings-skills", skills: names });
                        router.navigate({ to: "/settings" });
                      },
                    },
                  }
                );
              }

              // Persist notified versions so the same update doesn't toast on next launch.
              if (libNew.length > 0 || wsNew.length > 0) {
                const updated = { ...notified };
                for (const s of libNew) updated[`lib:${s.name}`] = s.version;
                for (const s of wsNew) updated[`ws:${s.name}`] = s.version;
                try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
              }
            }
          })
          .catch((err) => {
            console.error("[app-layout] Marketplace update check failed:", err);
            toast.error(
              `Marketplace update check failed: ${err instanceof Error ? err.message : String(err)}`,
              { duration: Infinity }
            );
          });
      }
    }).catch(() => {
      // Settings may not exist yet — show splash
      if (!cancelled) setSettingsLoaded(true);
    });

    // Load GitHub auth state
    useAuthStore.getState().loadUser();

    return () => { cancelled = true; };
  }, [setSettings]);

  // Run reconciliation after settings are loaded
  useEffect(() => {
    if (!settingsLoaded) return;

    reconcileStartup()
      .then((result) => {
        // Show toast for auto-cleaned skills (informational, not blocking)
        if (result.auto_cleaned > 0) {
          toast.info(
            `Cleaned up ${result.auto_cleaned} incomplete skill${result.auto_cleaned !== 1 ? "s" : ""}`
          );
        }

        // Block dashboard with ACK dialog if there are notifications or discovered skills
        if (result.notifications.length > 0 || result.discovered_skills.length > 0) {
          console.warn(
            "[app-layout] Reconciliation produced %d notifications, %d discovered skills",
            result.notifications.length,
            result.discovered_skills.length,
          );
          setReconNotifications(result.notifications);
          setReconDiscovered(result.discovered_skills);
          setAckDone(false);
        }

        // Set orphans for dialog
        if (result.orphans.length > 0) {
          setOrphans(result.orphans);
        }

        setReconciled(true);
      })
      .catch((err) => {
        // Reconciliation failed (e.g., workspace not set up yet) — proceed anyway
        console.warn("[app-layout] Reconciliation failed:", err);
        setReconciled(true);
      });
  }, [settingsLoaded]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+, (Mac) or Ctrl+, (Win/Linux) -> Settings
      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        navigate({ to: "/settings" });
      }
      // Cmd+1 -> Dashboard
      if ((e.metaKey || e.ctrlKey) && e.key === "1") {
        e.preventDefault();
        navigate({ to: "/" });
      }
      // Cmd+2 -> Usage
      if ((e.metaKey || e.ctrlKey) && e.key === "2") {
        e.preventDefault();
        navigate({ to: "/usage" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);

  const ready = settingsLoaded && reconciled && nodeReady && ackDone;

  return (
    <div className="flex h-screen overflow-hidden">
      {!isSettings && <Sidebar />}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!isSettings && <Header />}
        <main className={`flex-1 overflow-y-auto${isSettings ? "" : " p-6"}`}>
          {ready && isConfigured ? <Outlet /> : null}
        </main>
      </div>
      <CloseGuard />
      {!splashDismissed && (
        <SplashScreen
          onDismiss={() => setSplashDismissed(true)}
          onReady={() => setNodeReady(true)}
        />
      )}
      {splashDismissed && !isConfigured && <SetupScreen />}
      {orphans.length > 0 && (
        <OrphanResolutionDialog
          orphans={orphans}
          open
          onResolved={() => setOrphans([])}
        />
      )}
      {!ackDone && (
        <ReconciliationAckDialog
          notifications={reconNotifications}
          discoveredSkills={reconDiscovered}
          open
          onAcknowledge={() => {
            setAckDone(true);
            setReconNotifications([]);
            setReconDiscovered([]);
          }}
        />
      )}
    </div>
  );
}
