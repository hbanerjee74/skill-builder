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
  onSkip: () => void;
  onAutofillAndSkip: () => void;
  onContinue: () => void;
  isAutofilling?: boolean;
}

export function TransitionGateDialog({
  open,
  verdict,
  onSkip,
  onAutofillAndSkip,
  onContinue,
  isAutofilling = false,
}: TransitionGateDialogProps) {
  if (!verdict || verdict === "insufficient") return null;

  if (verdict === "sufficient") {
    return (
      <Dialog open={open} onOpenChange={(o) => { if (!o) onContinue(); }}>
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
            <Button variant="outline" onClick={onContinue}>
              Run Research Anyway
            </Button>
            <Button onClick={onSkip}>Skip to Decisions</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // mixed verdict
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onContinue(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Auto-fill Missing Answers?</DialogTitle>
          <DialogDescription>
            Some clarification questions don't have answers yet. The research
            agent provided recommendations for each — you can apply them
            automatically and skip detailed research, or go back to fill in
            your own answers.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onContinue}>
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
