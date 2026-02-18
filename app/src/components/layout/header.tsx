import { useRouterState } from "@tanstack/react-router";
import { FeedbackDialog } from "@/components/feedback-dialog";
import { ReviewModeToggle } from "@/components/review-mode-toggle";

function getPageTitle(path: string): string {
  if (path === "/") return "Dashboard";
  if (path === "/settings") return "Settings";
  if (path === "/prompts") return "Prompts";
  if (path === "/usage") return "Usage";
  if (path === "/refine") return "Refine";
  if (path.startsWith("/skill/")) return decodeURIComponent(path.slice("/skill/".length));
  return "Skill Builder";
}

export function Header() {
  const currentPath = useRouterState({ select: (s) => s.location.pathname });
  const isWorkflow = currentPath.startsWith("/skill/");

  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-lg font-semibold">{getPageTitle(currentPath)}</h1>
      </div>
      <div className="flex items-center gap-2">
        {isWorkflow && <ReviewModeToggle />}
        <FeedbackDialog />
      </div>
    </header>
  );
}
