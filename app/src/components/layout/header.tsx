import { useRouterState } from "@tanstack/react-router";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ReviewModeToggle } from "@/components/review-mode-toggle";

export function Header() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isWorkflow = currentPath.startsWith("/skill/");

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">Skill Builder</h1>
      </div>
      <div className="flex items-center gap-2">
        {isWorkflow && <ReviewModeToggle />}
        <FeedbackDialog />
      </div>
    </header>
  );
}
