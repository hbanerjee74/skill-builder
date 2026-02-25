import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Circle, AlertCircle, XCircle, Info } from "lucide-react";
import type { AnswerEvaluation } from "@/lib/tauri";

export type GateVerdict = "sufficient" | "mixed" | "insufficient";

interface TransitionGateDialogProps {
  open: boolean;
  verdict: GateVerdict | null;
  evaluation: AnswerEvaluation | null;
  /** Gate context: "clarifications" (gate 1, before research) or "refinements" (gate 2, before decisions). */
  context?: "clarifications" | "refinements";
  /** Sufficient: skip straight to decisions. */
  onSkip: () => void;
  /** Sufficient override: run research anyway (no autofill needed). */
  onResearch: () => void;
  /** Insufficient: auto-fill all answers then skip to decisions. */
  onAutofillAndSkip: () => void;
  /** Mixed: auto-fill empty answers then continue to detailed research. */
  onAutofillAndResearch: () => void;
  /** Override for mixed/insufficient: go back to review to answer manually. */
  onLetMeAnswer: () => void;
  isAutofilling?: boolean;
}

/** Render per-question verdicts grouped by category. */
function EvaluationBreakdown({ evaluation }: { evaluation: AnswerEvaluation }) {
  const pq = evaluation.per_question ?? [];
  const ok = pq.filter(q => q.verdict === "clear");
  const missing = pq.filter(q => q.verdict === "not_answered");
  const vague = pq.filter(q => q.verdict === "vague");
  const contradictory = pq.filter(q => q.verdict === "contradictory");
  const needsRefinement = pq.filter(q => q.verdict === "needs_refinement");

  return (
    <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5" data-testid="question-breakdown">
      {ok.length > 0 && (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-3" style={{ color: "var(--color-seafoam)" }} />
          <span style={{ color: "var(--color-seafoam)" }} className="font-medium">OK:</span>
          <span className="text-muted-foreground">{ok.length} questions</span>
        </div>
      )}
      {missing.length > 0 && (
        <div className="flex items-start gap-2">
          <Circle className="size-3 mt-0.5 text-destructive" />
          <span className="text-destructive font-medium">Missing:</span>
          <span className="text-muted-foreground">{missing.map(q => q.question_id).join(", ")}</span>
        </div>
      )}
      {vague.length > 0 && (
        <div className="flex items-start gap-2">
          <AlertCircle className="size-3 mt-0.5 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-600 dark:text-amber-400 font-medium">Vague:</span>
          <span className="text-muted-foreground">{vague.map(q => q.question_id).join(", ")}</span>
        </div>
      )}
      {contradictory.length > 0 && (
        <div className="flex items-start gap-2">
          <XCircle className="size-3 mt-0.5 text-destructive" />
          <span className="text-destructive font-medium">Contradictory:</span>
          <span className="text-muted-foreground">
            {contradictory.map(q => `${q.question_id}${q.contradicts ? ` (conflicts with ${q.contradicts})` : ""}`).join(", ")}
          </span>
        </div>
      )}
      {needsRefinement.length > 0 && (
        <div className="flex items-start gap-2">
          <Info className="size-3 mt-0.5" style={{ color: "var(--color-pacific)" }} />
          <span style={{ color: "var(--color-pacific)" }} className="font-medium">Needs refinement:</span>
          <span className="text-muted-foreground">{needsRefinement.map(q => q.question_id).join(", ")}</span>
        </div>
      )}
    </div>
  );
}

export function TransitionGateDialog({
  open,
  verdict,
  evaluation,
  context = "clarifications",
  onSkip,
  onResearch,
  onAutofillAndSkip,
  onAutofillAndResearch,
  onLetMeAnswer,
  isAutofilling = false,
}: TransitionGateDialogProps) {
  if (!verdict) return null;

  const isRefinements = context === "refinements";

  // Check if the only issues are needs_refinement (no missing/vague/contradictory)
  const pq = evaluation?.per_question ?? [];
  const hasMissing = pq.some(q => q.verdict === "not_answered");
  const hasVague = pq.some(q => q.verdict === "vague");
  const hasContradictory = pq.some(q => q.verdict === "contradictory");
  const onlyNeedsRefinement = !hasMissing && !hasVague && !hasContradictory
    && pq.some(q => q.verdict === "needs_refinement");

  // Sufficient: all answers are detailed
  if (verdict === "sufficient") {
    if (isRefinements) {
      return (
        <Dialog open={open} onOpenChange={(o) => { if (!o) onResearch(); }}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Refinement Answers Complete</DialogTitle>
              <DialogDescription>
                Your refinement answers look good. Continue to the decision analysis phase.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={onLetMeAnswer}>
                Back to Review
              </Button>
              <Button onClick={onResearch}>Continue to Decisions</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      );
    }

    // Gate 1 (clarifications): offer to skip research
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onResearch(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Skip Detailed Research?</DialogTitle>
            <DialogDescription>
              Your clarification answers are detailed and complete. You can skip
              the detailed research phase and go straight to confirming decisions,
              or run research anyway for additional depth.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onResearch}>
              Run Research Anyway
            </Button>
            <Button onClick={onSkip}>Skip to Decisions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mixed with only needs_refinement (gate 1): detailed research will handle these
  if (verdict === "mixed" && onlyNeedsRefinement && !isRefinements) {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onResearch(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Some Answers Need Deeper Research</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  Your answers are substantive but some introduce parameters that need
                  pinning down. The detailed research step will generate follow-up
                  questions for these:
                </p>
                {evaluation && <EvaluationBreakdown evaluation={evaluation} />}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onLetMeAnswer}>
              Let Me Revise
            </Button>
            <Button onClick={onResearch}>Continue to Research</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Mixed: some answers missing or vague
  if (verdict === "mixed") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onLetMeAnswer(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {isRefinements ? "Some Refinements Unanswered" : "Review Answer Quality"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  {isRefinements
                    ? "Some refinement answers are missing or need attention. Auto-fill with recommendations, or go back to answer them yourself."
                    : "The evaluator found issues with some answers:"}
                </p>
                {evaluation && <EvaluationBreakdown evaluation={evaluation} />}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onLetMeAnswer}>
              Let Me Answer
            </Button>
            <Button onClick={isRefinements ? onAutofillAndSkip : onAutofillAndResearch} disabled={isAutofilling}>
              {isAutofilling && <Loader2 className="mr-2 size-4 animate-spin" />}
              {isRefinements ? "Auto-fill & Continue" : "Auto-fill & Research"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Insufficient: no answers at all
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onLetMeAnswer(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>
            {isRefinements ? "Refinements Need Attention" : "Review Answer Quality"}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              <p>
                {isRefinements
                  ? "Most refinement questions haven't been answered. Auto-fill with recommendations, or go back to answer them."
                  : "The evaluator found issues with most answers:"}
              </p>
              {evaluation && <EvaluationBreakdown evaluation={evaluation} />}
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onLetMeAnswer}>
            Let Me Answer
          </Button>
          <Button onClick={onAutofillAndSkip} disabled={isAutofilling}>
            {isAutofilling && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isRefinements ? "Auto-fill & Continue" : "Auto-fill & Skip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
