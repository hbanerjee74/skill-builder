import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { NodeStatus } from "@/lib/types";

interface UseNodeValidationReturn {
  status: NodeStatus | null;
  isChecking: boolean;
  error: string | null;
  retry: () => void;
}

export function useNodeValidation(): UseNodeValidationReturn {
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(() => {
    setIsChecking(true);
    setError(null);
    setStatus(null);

    invoke<NodeStatus>("check_node")
      .then((result) => {
        setStatus(result);
        setIsChecking(false);
      })
      .catch((err: unknown) => {
        const message =
          err instanceof Error ? err.message : String(err);
        setError(message || "Failed to check Node.js availability");
        setIsChecking(false);
      });
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  return { status, isChecking, error, retry: check };
}
