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

export type GateVerdict = "sufficient" | "mixed" | "insufficient";

interface TransitionGateDialogProps {
  open: boolean;
  verdict: GateVerdict | null;
  totalCount?: number;
  unansweredCount?: number;
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

export function TransitionGateDialog({
  open,
  verdict,
  totalCount,
  unansweredCount,
  onSkip,
  onResearch,
  onAutofillAndSkip,
  onAutofillAndResearch,
  onLetMeAnswer,
  isAutofilling = false,
}: TransitionGateDialogProps) {
  if (!verdict) return null;

  // Sufficient: all answers are detailed — offer to skip research
  if (verdict === "sufficient") {
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

  // Mixed: some answers present, some missing — auto-fill gaps then research
  if (verdict === "mixed") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onLetMeAnswer(); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Auto-fill Missing Answers?</DialogTitle>
            <DialogDescription>
              {countText} clarification questions don't have answers yet. The
              research agent provided recommendations for each — you can apply
              them and continue to detailed research, or go back to fill in your
              own answers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={onLetMeAnswer}>
              Let Me Answer
            </Button>
            <Button onClick={onAutofillAndResearch} disabled={isAutofilling}>
              {isAutofilling && <Loader2 className="mr-2 size-4 animate-spin" />}
              Auto-fill & Research
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Insufficient: no answers at all — auto-fill everything and skip research
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onLetMeAnswer(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Use Recommended Answers?</DialogTitle>
          <DialogDescription>
            You didn't answer {countText} clarification questions. The research
            agent provided recommendations for each — you can apply them and
            skip to confirming decisions, or go back to fill in your own answers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onLetMeAnswer}>
            Let Me Answer
          </Button>
          <Button onClick={onAutofillAndSkip} disabled={isAutofilling}>
            {isAutofilling && <Loader2 className="mr-2 size-4 animate-spin" />}
            Auto-fill & Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
