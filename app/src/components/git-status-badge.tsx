import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type GitStatus =
  | "new"
  | "modified"
  | "deleted"
  | "renamed"
  | "untracked"
  | "clean";

const statusConfig: Record<GitStatus, { label: string; className: string }> = {
  new: {
    label: "N",
    className:
      "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30",
  },
  modified: {
    label: "M",
    className:
      "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  },
  deleted: {
    label: "D",
    className:
      "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  renamed: {
    label: "R",
    className:
      "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
  },
  untracked: {
    label: "U",
    className:
      "bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/30",
  },
  clean: { label: "", className: "" },
};

interface GitStatusBadgeProps {
  status: string;
  className?: string;
}

export function GitStatusBadge({ status, className }: GitStatusBadgeProps) {
  const config = statusConfig[status as GitStatus];
  if (!config || status === "clean") return null;

  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 px-1.5 text-[10px] font-mono",
        config.className,
        className,
      )}
    >
      {config.label}
    </Badge>
  );
}
