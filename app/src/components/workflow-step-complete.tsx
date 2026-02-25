import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-link";
import { CheckCircle2, FileText, Clock, DollarSign, ArrowRight, Loader2, MessageSquare, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { readFile, listSkillFiles, getStepAgentRuns } from "@/lib/tauri";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AgentStatsBar } from "@/components/agent-stats-bar";
import { ClarificationsEditor } from "@/components/clarifications-editor";
import { ResearchSummaryCard } from "@/components/research-summary-card";
import { DecisionsSummaryCard } from "@/components/decisions-summary-card";
import { type ClarificationsFile, parseClarifications } from "@/lib/clarifications-types";
import type { AgentRunRecord } from "@/lib/types";
import { formatElapsed } from "@/lib/utils";

interface WorkflowStepCompleteProps {
  stepName: string;
  stepId?: number;
  outputFiles: string[];
  duration?: number;
  cost?: number;
  onNextStep?: () => void;
  onClose?: () => void;
  onRefine?: () => void;
  isLastStep?: boolean;
  reviewMode?: boolean;
  skillName?: string;
  workspacePath?: string;
  skillsPath?: string | null;
  /** When true, show editable ClarificationsEditor on the completion screen */
  clarificationsEditable?: boolean;
  onClarificationsChange?: (data: ClarificationsFile) => void;
  onClarificationsContinue?: () => void;
  saveStatus?: "idle" | "dirty" | "saving" | "saved";
  evaluating?: boolean;
}

/** Shared action bar: Refine/Done on last step, Next Step otherwise. Hidden in review mode. */
function StepActionBar({
  isLastStep,
  reviewMode,
  onRefine,
  onClose,
  onNextStep,
}: {
  isLastStep: boolean;
  reviewMode?: boolean;
  onRefine?: () => void;
  onClose?: () => void;
  onNextStep?: () => void;
}) {
  if (reviewMode) return null;

  return (
    <div className="flex items-center justify-end gap-2 border-t pt-4">
      {isLastStep ? (
        <>
          {onRefine && (
            <Button size="sm" variant="outline" onClick={onRefine}>
              <MessageSquare className="size-3.5" />
              Refine
            </Button>
          )}
          {onClose && (
            <Button size="sm" onClick={onClose}>
              <CheckCircle2 className="size-3.5" />
              Done
            </Button>
          )}
        </>
      ) : (
        onNextStep && (
          <Button size="sm" onClick={onNextStep}>
            <ArrowRight className="size-3.5" />
            Next Step
          </Button>
        )
      )}
    </div>
  );
}

export function WorkflowStepComplete({
  stepName,
  stepId,
  outputFiles,
  duration,
  cost,
  onNextStep,
  onClose,
  onRefine,
  isLastStep = false,
  reviewMode,
  skillName,
  workspacePath,
  skillsPath,
  clarificationsEditable,
  onClarificationsChange,
  onClarificationsContinue,
  saveStatus,
  evaluating,
}: WorkflowStepCompleteProps) {
  const [fileContents, setFileContents] = useState<Map<string, string>>(new Map());
  const [resolvedFiles, setResolvedFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [agentRuns, setAgentRuns] = useState<AgentRunRecord[]>([]);

  useEffect(() => {
    if (!skillName || stepId == null) {
      setAgentRuns([]);
      return;
    }

    getStepAgentRuns(skillName, stepId)
      .then((runs) => setAgentRuns(runs))
      .catch((err) => console.error("Failed to load agent stats:", err));
  }, [skillName, stepId]);

  // Always load file contents when skillName is available (both review and non-review mode)
  useEffect(() => {
    if (!skillName || outputFiles.length === 0) {
      setFileContents(new Map());
      setResolvedFiles([]);
      setSelectedFile(null);
      return;
    }

    let cancelled = false;
    setLoadingFiles(true);

    (async () => {
      // Expand directory paths (ending with "/") into individual files
      const expandedFiles: string[] = [];
      const dirPaths = outputFiles.filter((f) => f.endsWith("/"));
      const filePaths = outputFiles.filter((f) => !f.endsWith("/"));
      expandedFiles.push(...filePaths);

      if (dirPaths.length > 0 && skillsPath) {
        try {
          const allEntries = await listSkillFiles(skillsPath, skillName);
          for (const dir of dirPaths) {
            // dir is like "skill/references/" — strip "skill/" prefix to match on-disk paths
            const diskPrefix = dir.startsWith("skill/") ? dir.slice("skill/".length) : dir;
            for (const entry of allEntries) {
              if (!entry.is_directory && entry.relative_path.startsWith(diskPrefix)) {
                expandedFiles.push(`skill/${entry.relative_path}`);
              }
            }
          }
        } catch {
          // list failed — directory paths won't be expanded
        }
      }

      const results = new Map<string, string>();

      await Promise.all(
        expandedFiles.map(async (relativePath) => {
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

          results.set(relativePath, content ?? "__NOT_FOUND__");
        })
      );

      if (!cancelled) {
        setFileContents(new Map(results));
        setResolvedFiles(expandedFiles);
        setSelectedFile(expandedFiles[0] ?? null);
        setLoadingFiles(false);
      }
    })();

    return () => { cancelled = true; };
  }, [skillName, workspacePath, skillsPath, outputFiles]);

  const hasFileContents = fileContents.size > 0;

  // In review mode (history): derive cost from DB-loaded agentRuns — DB is source of truth.
  // In live mode (just completed): use the cost prop from Zustand — the DB write is still
  // in-flight and may return stale data (e.g. a previous session's run with total_cost=0).
  const dbCost = agentRuns.length > 0
    ? agentRuns.reduce((sum, r) => sum + r.total_cost, 0)
    : undefined;
  const displayCost = reviewMode ? dbCost : cost;

  // Loading spinner — shown while files are being fetched (initial or re-fetch)
  if (loadingFiles) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check if this is a research step (has both research-plan.md and clarifications.json in output list)
  const researchPlanContent = fileContents.get("context/research-plan.md");
  const clarificationsContent = fileContents.get("context/clarifications.json");
  const isResearchStep = outputFiles.includes("context/research-plan.md")
    && outputFiles.includes("context/clarifications.json");

  if (isResearchStep) {
    // Missing files = error
    const missingFiles: string[] = [];
    if (!researchPlanContent || researchPlanContent === "__NOT_FOUND__") missingFiles.push("context/research-plan.md");
    if (!clarificationsContent || clarificationsContent === "__NOT_FOUND__") missingFiles.push("context/clarifications.json");

    if (missingFiles.length > 0) {
      return (
        <div className="flex h-full flex-col gap-4 overflow-hidden">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <AlertTriangle className="size-8 text-destructive/50" />
            <div className="text-center">
              <p className="font-medium text-destructive">Research step completed but output files are missing</p>
              <div className="mt-2 text-sm">
                {missingFiles.map((f) => (
                  <p key={f}>Expected <code className="text-xs">{f}</code> but it was not found.</p>
                ))}
              </div>
              <p className="mt-2 text-sm">The agent may not have written files to the correct path. Reset and re-run the step.</p>
            </div>
          </div>
          <StepActionBar isLastStep={isLastStep} reviewMode={reviewMode} onRefine={onRefine} onClose={onClose} onNextStep={onNextStep} />
        </div>
      );
    }

    const clarData = parseClarifications(clarificationsContent!);
    if (!clarData) {
      return (
        <div className="flex h-full flex-col gap-4 overflow-hidden">
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-muted-foreground">
            <AlertTriangle className="size-8 text-destructive/50" />
            <div className="text-center">
              <p className="font-medium text-destructive">Invalid clarifications.json</p>
              <p className="mt-1 text-sm">The agent wrote a file that is not valid JSON. Reset and re-run the step.</p>
            </div>
          </div>
          <StepActionBar isLastStep={isLastStep} reviewMode={reviewMode} onRefine={onRefine} onClose={onClose} onNextStep={onNextStep} />
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        {reviewMode && agentRuns.length > 0 && (
          <div className="shrink-0">
            <AgentStatsBar runs={agentRuns} />
          </div>
        )}
        {clarificationsEditable ? (
          /* Editable mode: ResearchSummaryCard with collapsible plan + editable clarifications.
             The ClarificationsEditor's Continue button handles advancement — no StepActionBar. */
          <div className="min-h-0 flex-1 overflow-auto">
            <div className="pr-4">
              <ResearchSummaryCard
                researchPlan={researchPlanContent!}
                clarificationsData={clarData}
                duration={!reviewMode ? duration : undefined}
                cost={displayCost}
                editable
                onClarificationsChange={onClarificationsChange}
                onClarificationsContinue={onClarificationsContinue}
                saveStatus={saveStatus}
                evaluating={evaluating}
              />
            </div>
          </div>
        ) : (
          /* Read-only mode (review): show research plan expanded, clarifications read-only */
          <>
            <ScrollArea className="min-h-0 flex-1">
              <div className="pr-4">
                <ResearchSummaryCard
                  researchPlan={researchPlanContent!}
                  clarificationsData={clarData}
                  duration={!reviewMode ? duration : undefined}
                  cost={displayCost}
                />
              </div>
            </ScrollArea>
            <StepActionBar
              isLastStep={isLastStep}
              reviewMode={reviewMode}
              onRefine={onRefine}
              onClose={onClose}
              onNextStep={onNextStep}
            />
          </>
        )}
      </div>
    );
  }

  // Detailed research step: only clarifications.json (no research-plan.md)
  const isClarificationsOnlyStep = !isResearchStep
    && outputFiles.includes("context/clarifications.json")
    && !outputFiles.includes("context/research-plan.md")
    && clarificationsContent && clarificationsContent !== "__NOT_FOUND__";

  if (isClarificationsOnlyStep) {
    const clarOnlyData = parseClarifications(clarificationsContent!);

    if (clarOnlyData) {
      return (
        <div className="flex h-full flex-col gap-4 overflow-hidden">
          {reviewMode && agentRuns.length > 0 && (
            <div className="shrink-0">
              <AgentStatsBar runs={agentRuns} />
            </div>
          )}
          {clarificationsEditable ? (
            /* Editable mode: ClarificationsEditor with edit props. Continue button handles advancement. */
            <ClarificationsEditor
              data={clarOnlyData}
              onChange={onClarificationsChange ?? (() => {})}
              onContinue={onClarificationsContinue}
              saveStatus={saveStatus}
              evaluating={evaluating}
            />
          ) : (
            /* Read-only mode (review) */
            <>
              <div className="rounded-lg border shadow-sm min-h-0 flex-1" style={{ height: "min(600px, 60vh)" }}>
                <ClarificationsEditor data={clarOnlyData} onChange={() => {}} readOnly />
              </div>
              <StepActionBar
                isLastStep={isLastStep}
                reviewMode={reviewMode}
                onRefine={onRefine}
                onClose={onClose}
                onNextStep={onNextStep}
              />
            </>
          )}
        </div>
      );
    }
  }

  // Decisions step: show summary card when decisions.md is the output
  const decisionsContent = fileContents.get("context/decisions.md");
  const isDecisionsStep = outputFiles.includes("context/decisions.md")
    && decisionsContent && decisionsContent !== "__NOT_FOUND__";

  if (isDecisionsStep) {
    return (
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        {reviewMode && agentRuns.length > 0 && (
          <div className="shrink-0">
            <AgentStatsBar runs={agentRuns} />
          </div>
        )}
        <ScrollArea className="min-h-0 flex-1">
          <div className="pr-4">
            <DecisionsSummaryCard
              decisionsContent={decisionsContent}
              duration={!reviewMode ? duration : undefined}
              cost={displayCost}
            />
          </div>
        </ScrollArea>
        <StepActionBar
          isLastStep={isLastStep}
          reviewMode={reviewMode}
          onRefine={onRefine}
          onClose={onClose}
          onNextStep={onNextStep}
        />
      </div>
    );
  }

  // Default: show file contents with a dropdown selector when multiple files exist
  const visibleFiles = resolvedFiles.filter((f) => !f.endsWith("/"));
  if (hasFileContents && visibleFiles.length > 0) {
    const activeFile = selectedFile && visibleFiles.includes(selectedFile) ? selectedFile : visibleFiles[0];
    const activeContent = fileContents.get(activeFile);
    const activeNotFound = activeContent === "__NOT_FOUND__";

    /** Display label for a file path: SKILL.md or references/foo.md */
    const fileLabel = (f: string) => {
      const stripped = f.startsWith("skill/") ? f.slice("skill/".length) : f;
      return stripped;
    };

    return (
      <div className="flex h-full flex-col gap-4 overflow-hidden">
        {reviewMode && agentRuns.length > 0 && (
          <div className="shrink-0">
            <AgentStatsBar runs={agentRuns} />
          </div>
        )}
        {/* Header row: step complete badge + file selector */}
        <div className="flex items-center gap-3 shrink-0">
          {!reviewMode && (
            <>
              <CheckCircle2 className="size-4 shrink-0" style={{ color: "var(--color-seafoam)" }} />
              <span className="text-sm font-semibold tracking-tight">{stepName} Complete</span>
            </>
          )}
          {visibleFiles.length > 1 && (
            <Select value={activeFile} onValueChange={setSelectedFile}>
              <SelectTrigger size="sm" className="font-mono text-xs">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleFiles.map((f) => (
                  <SelectItem key={f} value={f} className="font-mono text-xs">
                    {fileLabel(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {visibleFiles.length === 1 && (
            <span className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              <FileText className="size-3.5 shrink-0" />
              {fileLabel(activeFile)}
            </span>
          )}
          <div className="flex-1" />
          {!reviewMode && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {duration !== undefined && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {formatElapsed(duration)}
                </span>
              )}
              {displayCost !== undefined && (
                <span className="flex items-center gap-1">
                  <DollarSign className="size-3" />
                  ${displayCost.toFixed(4)}
                </span>
              )}
            </div>
          )}
        </div>
        {/* File content */}
        <ScrollArea className="min-h-0 flex-1">
          <div className="pr-4">
            {activeNotFound && (
              <p className="text-sm text-muted-foreground italic">File not found</p>
            )}
            {!activeNotFound && activeContent && (
              <FileContentRenderer file={activeFile} content={activeContent} />
            )}
          </div>
        </ScrollArea>
        <StepActionBar
          isLastStep={isLastStep}
          reviewMode={reviewMode}
          onRefine={onRefine}
          onClose={onClose}
          onNextStep={onNextStep}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <CheckCircle2 className="size-12" style={{ color: "var(--color-seafoam)" }} />
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
                {formatElapsed(duration)}
              </span>
            )}
            {displayCost !== undefined && (
              <span className="flex items-center gap-1">
                <DollarSign className="size-3" />
                ${displayCost.toFixed(4)}
              </span>
            )}
          </div>
        </div>
      </div>
      <StepActionBar
        isLastStep={isLastStep}
        reviewMode={reviewMode}
        onRefine={onRefine}
        onClose={onClose}
        onNextStep={onNextStep}
      />
    </div>
  );
}

// ─── File Content Renderer ────────────────────────────────────────────────────

function FileContentRenderer({ file, content }: { file: string; content: string }) {
  // Detect clarifications.json — render with the structured editor in read-only mode
  if (file.endsWith("clarifications.json")) {
    const data = parseClarifications(content);
    if (data?.version && data.sections) {
      return (
        <div className="rounded-md border" style={{ height: "min(600px, 60vh)" }}>
          <ClarificationsEditor data={data} onChange={() => {}} readOnly />
        </div>
      );
    }
  }

  // Default: render as markdown
  return (
    <div className="rounded-md border">
      <div className="markdown-body compact max-w-none p-4">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}
