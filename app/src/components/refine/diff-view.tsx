import { ScrollArea } from "@/components/ui/scroll-area";
import { computeLineDiff } from "@/lib/skill-diff";

interface DiffViewProps {
  before: string;
  after: string;
}

export function DiffView({ before, after }: DiffViewProps) {
  const lines = computeLineDiff(before, after);

  return (
    <ScrollArea className="h-full">
      <pre className="font-mono text-sm">
        {lines.map((line, i) => {
          let lineClass = "text-muted-foreground";
          let prefix = "  ";

          if (line.type === "added") {
            lineClass = "bg-green-500/10 text-green-700 dark:text-green-400";
            prefix = "+ ";
          } else if (line.type === "removed") {
            lineClass = "bg-red-500/10 text-red-700 dark:text-red-400";
            prefix = "- ";
          }

          return (
            <div key={i} className={`flex ${lineClass}`}>
              <span className="w-10 shrink-0 select-none pr-2 text-right text-muted-foreground/50">
                {i + 1}
              </span>
              <span className="whitespace-pre-wrap break-all">
                {prefix}
                {line.content}
              </span>
            </div>
          );
        })}
      </pre>
    </ScrollArea>
  );
}
