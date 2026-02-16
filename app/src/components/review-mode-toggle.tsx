import { Button } from "@/components/ui/button";
import { useWorkflowStore } from "@/stores/workflow-store";

export function ReviewModeToggle() {
  const reviewMode = useWorkflowStore((s) => s.reviewMode);
  const setReviewMode = useWorkflowStore((s) => s.setReviewMode);

  return (
    <div className="flex gap-1 rounded-md border p-0.5">
      <Button
        size="sm"
        variant={reviewMode ? "default" : "ghost"}
        onClick={() => setReviewMode(true)}
        className="h-7 px-3 text-xs"
      >
        Review
      </Button>
      <Button
        size="sm"
        variant={!reviewMode ? "default" : "ghost"}
        onClick={() => setReviewMode(false)}
        className="h-7 px-3 text-xs"
      >
        Update
      </Button>
    </div>
  );
}
