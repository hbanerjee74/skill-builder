import { useState, useEffect, useCallback, useRef } from "react";
import { gitFileStatus } from "@/lib/tauri";
import type { GitFileStatusEntry } from "@/lib/tauri";

const POLL_INTERVAL = 10_000; // 10 seconds

export function useGitStatus(workspacePath: string | null) {
  const [files, setFiles] = useState<GitFileStatusEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!workspacePath) return;
    setIsLoading(true);
    try {
      const result = await gitFileStatus(workspacePath);
      setFiles(result);
    } catch {
      // Silently fail — git status polling shouldn't crash the UI
    } finally {
      setIsLoading(false);
    }
  }, [workspacePath]);

  useEffect(() => {
    if (!workspacePath) {
      setFiles([]);
      return;
    }

    refresh();
    intervalRef.current = setInterval(refresh, POLL_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [workspacePath, refresh]);

  const getStatus = useCallback(
    (path: string): string => {
      const entry = files.find((f) => f.path === path);
      return entry?.status ?? "clean";
    },
    [files],
  );

  return { files, isLoading, refresh, getStatus };
}
