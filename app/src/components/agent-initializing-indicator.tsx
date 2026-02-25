import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflow-store";
import { formatElapsed } from "@/lib/utils";

export function AgentInitializingIndicator() {
  const initStartTime = useWorkflowStore((s) => s.initStartTime);
  const initProgressMessage = useWorkflowStore((s) => s.initProgressMessage);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (initStartTime === null) {
      setElapsed(0);
      return;
    }

    // Set initial elapsed immediately
    setElapsed(Date.now() - initStartTime);

    const id = setInterval(() => {
      setElapsed(Date.now() - initStartTime);
    }, 1000);

    return () => clearInterval(id);
  }, [initStartTime]);

  const displayMessage = initProgressMessage ?? "Initializing agent...";

  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground"
      data-testid="agent-initializing-indicator"
    >
      <Loader2 className="size-8 animate-spin" />
      <p className="text-sm font-medium" data-testid="init-progress-message">
        {displayMessage}
      </p>
      {elapsed > 0 && (
        <p className="text-xs tabular-nums" data-testid="elapsed-time">
          {formatElapsed(elapsed)}
        </p>
      )}
    </div>
  );
}
