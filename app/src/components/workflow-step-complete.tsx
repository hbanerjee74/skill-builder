import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckCircle2, FileText, Clock, DollarSign, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readFile } from "@/lib/tauri";

interface WorkflowStepCompleteProps {
  stepName: string;
  outputFiles: string[];
  duration?: number;
  cost?: number;
  onNextStep?: () => void;
  isLastStep?: boolean;
  reviewMode?: boolean;
  skillName?: string;
  workspacePath?: string;
  skillsPath?: string | null;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function WorkflowStepComplete({
  stepName,
  outputFiles,
  duration,
  cost,
  onNextStep,
  isLastStep = false,
  reviewMode,
  skillName,
  workspacePath,
  skillsPath,
}: WorkflowStepCompleteProps) {
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [loadingFiles, setLoadingFiles] = useState(false);

  useEffect(() => {
    if (!reviewMode || !skillName || outputFiles.length === 0) {
      setFileContents(new Map());
      return;
    }

    let cancelled = false;
    setLoadingFiles(true);
    const results = new Map<string, string>();

    const loadPromises = outputFiles
      .filter((f) => !f.endsWith("/"))
      .map(async (relativePath) => {
        // Try skills path first (strip "skill/" prefix since skill output dir
        // already nests under skillName), then workspace path (uses path as-is)
        let content: string | null = null;
        const skillsRelative = relativePath.startsWith("skill/")
          ? relativePath.slice("skill/".length)
          : relativePath;

        if (skillsPath) {
          try {
            content = await readFile(`${skillsPath}/${skillName}/${skillsRelative}`);
          } catch {
            // not found in skills path
          }
        }

        if (!content && workspacePath) {
          try {
            content = await readFile(`${workspacePath}/${skillName}/${relativePath}`);
          } catch {
            // not found in workspace path either
          }
        }

        if (content) {
          results.set(relativePath, content);
        } else {
          results.set(relativePath, "__NOT_FOUND__");
        }
      });

    Promise.all(loadPromises).then(() => {
      if (!cancelled) {
        setFileContents(new Map(results));
        setLoadingFiles(false);
      }
    });

    return () => { cancelled = true; };
  }, [reviewMode, skillName, workspacePath, skillsPath, outputFiles]);

  // Review mode: show file contents
  if (reviewMode && outputFiles.length > 0) {
    if (loadingFiles) {
      return (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-6 pr-4">
            {outputFiles
              .filter((f) => !f.endsWith("/"))
              .map((file) => {
                const content = fileContents.get(file);
                const notFound = content === "__NOT_FOUND__";

                return (
                  <div key={file} className="flex flex-col gap-2">
                    <p className="text-xs font-mono text-muted-foreground flex items-center gap-2">
                      <FileText className="size-3.5 shrink-0" />
                      {file}
                    </p>
                    {notFound ? (
                      <p className="text-sm text-muted-foreground italic">
                        File not found
                      </p>
                    ) : content ? (
                      <div className="rounded-md border">
                        <div className="markdown-body max-w-none p-4">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </div>
        </ScrollArea>
      </div>
    );
  }

  // Default rendering (non-review mode)
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckCircle2 className="size-12 text-green-500" />
        <h3 className="text-lg font-semibold">{stepName} Complete</h3>

        {outputFiles.length > 0 && (
          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Created Files
            </p>
            {outputFiles.map((file) => (
              <div
                key={file}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <FileText className="size-3.5" />
                <span>{file}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {duration !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(duration)}
            </span>
          )}
          {cost !== undefined && (
            <span className="flex items-center gap-1">
              <DollarSign className="size-3" />
              ${cost.toFixed(4)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 mt-2">
          {onNextStep && !isLastStep && !reviewMode && (
            <Button size="sm" onClick={onNextStep}>
              <ArrowRight className="size-3.5" />
              Next Step
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
