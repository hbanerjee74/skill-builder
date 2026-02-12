import { useCallback, useEffect, useState } from "react";
import { AlertCircle, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNodeValidation } from "@/hooks/use-node-validation";

interface SplashScreenProps {
  onDismiss: () => void;
  onReady: () => void;
}

/**
 * Derive a user-facing error message based on the validation result.
 *
 * - Bundled runtime failed to load  -> suggest reinstall
 * - System Node found but wrong version -> show found version, expected range
 * - No Node at all                  -> point to nodejs.org
 * - Invoke-level / unexpected error -> show raw error
 */
function deriveErrorMessage(
  source: string,
  available: boolean,
  version: string | null,
  meetsMinimum: boolean,
  invokeError: string | null,
): string {
  if (invokeError) {
    return `Node.js check failed: ${invokeError}`;
  }

  if (!available) {
    if (source === "bundled") {
      return "The bundled Node.js runtime could not be loaded. Please reinstall the app.";
    }
    return "Node.js 18\u201324 is required. Install from nodejs.org";
  }

  if (!meetsMinimum) {
    return `Node.js 18\u201324 is required for development. Found v${version ?? "unknown"}.`;
  }

  return "An unexpected error occurred while validating Node.js.";
}

export function SplashScreen({ onDismiss, onReady }: SplashScreenProps) {
  const [fading, setFading] = useState(false);
  const { status, isChecking, error, retry } = useNodeValidation();

  // Once validation passes, signal readiness then start the fade-out.
  const dismiss = useCallback(() => {
    onReady();
    setFading(true);
    setTimeout(onDismiss, 400);
  }, [onDismiss, onReady]);

  useEffect(() => {
    if (isChecking) return;
    if (status?.available && status.meets_minimum) {
      // Small pause so the splash is visible before fading out
      const timer = setTimeout(dismiss, 600);
      return () => clearTimeout(timer);
    }
    // Validation failed -- stay on splash (error UI rendered below)
  }, [isChecking, status, dismiss]);

  const validationFailed =
    !isChecking && (error !== null || !status?.available || !status?.meets_minimum);

  const errorMessage = validationFailed
    ? deriveErrorMessage(
        status?.source ?? "",
        status?.available ?? false,
        status?.version ?? null,
        status?.meets_minimum ?? false,
        error,
      )
    : null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm transition-opacity duration-400 ${fading ? "opacity-0" : "opacity-100"}`}
    >
      <div className="flex max-w-lg flex-col items-center gap-6 rounded-xl border bg-card p-10 text-center shadow-lg">
        <img
          src="/ad-favicon.svg"
          alt="Accelerated Data"
          className="h-20 w-auto"
        />

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Skill Builder</h1>
          <p className="text-muted-foreground">
            Build Claude skills for Vibedata with AI-powered multi-agent
            workflows. Create domain knowledge packages that help data and
            analytics engineers build silver and gold layer models.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-amber-600 dark:text-amber-400">
            Demo Software
          </p>
          <p className="mt-1">
            This software is provided as-is for demonstration and experimental
            purposes. It is not officially supported and may change or break
            without notice. Use at your own risk.
          </p>
        </div>

        {/* Loading indicator while checking */}
        {isChecking && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>Checking Node.js runtime...</span>
          </div>
        )}

        {/* Error state */}
        {validationFailed && errorMessage && (
          <div className="flex w-full flex-col items-center gap-4">
            <div className="flex w-full items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-left text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
              <p className="text-destructive">{errorMessage}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              disabled={isChecking}
            >
              <RefreshCw className="size-4" />
              Retry
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
