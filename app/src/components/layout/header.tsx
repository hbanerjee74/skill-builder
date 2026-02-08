import { useEffect, useState } from "react";
import { Settings, ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useSettingsStore } from "@/stores/settings-store";
import { useAuthStore } from "@/stores/auth-store";
import { gitPull, commitAndPush } from "@/lib/tauri";
import type { GitHubUser, AppSettings } from "@/lib/types";

export function Header() {
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const workspacePath = useSettingsStore((s) => s.workspacePath);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const settings = await invoke<AppSettings>("get_settings");
        if (settings.github_token) {
          const githubUser = await invoke<GitHubUser>("get_current_user", {
            token: settings.github_token,
          });
          setUser(githubUser);
        }
      } catch {
        // No token or invalid — that's fine
      }
    };
    fetchUser();
  }, []);

  const handlePull = async () => {
    if (!workspacePath || !token) return;
    setIsPulling(true);
    try {
      const result = await gitPull(workspacePath, token);
      if (result.up_to_date) {
        toast.info("Already up to date");
      } else {
        toast.success(`Pulled ${result.commits_pulled} commit(s)`);
      }
    } catch (err) {
      toast.error(`Pull failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    if (!workspacePath || !token) return;
    setIsPushing(true);
    try {
      await commitAndPush(workspacePath, "Manual push from Skill Builder", token);
      toast.success("Pushed to remote");
    } catch (err) {
      toast.error(`Push failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Skill Builder</h1>
        {workspacePath && token && (
          <>
            <Separator orientation="vertical" className="mx-1 h-6" />
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handlePull}
                disabled={isPulling}
                title="Pull from remote"
              >
                {isPulling ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowDown className="size-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={handlePush}
                disabled={isPushing}
                title="Push to remote"
              >
                {isPushing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ArrowUp className="size-4" />
                )}
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <Avatar className="size-7">
              <AvatarImage src={user.avatar_url} alt={user.login} />
              <AvatarFallback>
                {user.login.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="text-muted-foreground">{user.name ?? user.login}</span>
          </div>
        )}
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="size-8">
            <Settings className="size-4" />
          </Button>
        </Link>
      </div>
    </header>
  );
}
