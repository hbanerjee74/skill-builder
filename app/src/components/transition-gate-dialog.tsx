import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { PerQuestionVerdict } from "@/lib/tauri";

export type GateVerdict = "sufficient" | "mixed" | "insufficient";

interface TransitionGateDialogProps {
  open: boolean;
  verdict: GateVerdict | null;
  totalCount?: number;
  unansweredCount?: number;
  /** Per-question verdicts from answer-evaluation.json. */
  perQuestion?: PerQuestionVerdict[];
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

/** Render grouped per-question IDs for non-clear verdicts. */
function QuestionBreakdown({ perQuestion }: { perQuestion?: PerQuestionVerdict[] }) {
  if (!perQuestion?.length) return null;

  const unanswered = perQuestion
    .filter((q) => q.verdict === "not_answered")
    .map((q) => q.question_id);
  const vague = perQuestion
    .filter((q) => q.verdict === "vague")
    .map((q) => q.question_id);

  if (unanswered.length === 0 && vague.length === 0) return null;

  return (
    <div className="mt-3 max-h-28 overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-sm" data-testid="question-breakdown">
      {unanswered.length > 0 && (
        <p>
          <span className="font-medium">Unanswered:</span>{" "}
          {unanswered.join(", ")}
        </p>
      )}
      {vague.length > 0 && (
        <p className={unanswered.length > 0 ? "mt-1" : ""}>
          <span className="font-medium">Vague:</span>{" "}
          {vague.join(", ")}
        </p>
      )}
    </div>
  );
}

export function TransitionGateDialog({
  open,
  verdict,
  totalCount,
  unansweredCount,
  perQuestion,
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

  const countText =
    unansweredCount != null && totalCount != null
      ? `${unansweredCount} of ${totalCount}`
      : "Some";

  // Mixed: some answers present, some missing
  if (verdict === "mixed") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onLetMeAnswer(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {isRefinements ? "Some Refinements Unanswered" : "Auto-fill Missing Answers?"}
            </DialogTitle>
            <DialogDescription asChild>
              <div>
                <p>
                  {isRefinements
                    ? `${countText} refinement answers are missing or vague. Auto-fill with recommendations, or go back to answer them yourself.`
                    : `${countText} clarification questions don't have answers yet. The research agent provided recommendations for each — you can apply them and continue to detailed research, or go back to fill in your own answers.`}
                </p>
                <QuestionBreakdown perQuestion={perQuestion} />
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
            {isRefinements ? "Refinements Need Attention" : "Use Recommended Answers?"}
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              <p>
                {isRefinements
                  ? `Most refinement questions haven't been answered. Auto-fill with recommendations, or go back to answer them.`
                  : `You didn't answer ${countText} clarification questions. The research agent provided recommendations for each — you can apply them and skip to confirming decisions, or go back to fill in your own answers.`}
              </p>
              <QuestionBreakdown perQuestion={perQuestion} />
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
