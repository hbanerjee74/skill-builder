import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { GitCompare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { useRefineStore } from "@/stores/refine-store";
import { DiffView } from "./diff-view";

export function PreviewPanel() {
  const skillFiles = useRefineStore((s) => s.skillFiles);
  const activeFileTab = useRefineStore((s) => s.activeFileTab);
  const diffMode = useRefineStore((s) => s.diffMode);
  const baselineFiles = useRefineStore((s) => s.baselineFiles);
  const isLoadingFiles = useRefineStore((s) => s.isLoadingFiles);
  const setActiveFileTab = useRefineStore((s) => s.setActiveFileTab);
  const setDiffMode = useRefineStore((s) => s.setDiffMode);

  if (skillFiles.length === 0 && !isLoadingFiles) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a skill to preview its files
      </div>
    );
  }

  if (isLoadingFiles) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const activeFile = skillFiles.find((f) => f.filename === activeFileTab);
  const baselineFile = baselineFiles.find((f) => f.filename === activeFileTab);
  const hasBaseline = baselineFiles.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <Tabs value={activeFileTab} onValueChange={setActiveFileTab}>
          <TabsList>
            {skillFiles.map((f) => (
              <TabsTrigger key={f.filename} value={f.filename}>
                {f.filename}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasBaseline}
          onClick={() => setDiffMode(!diffMode)}
          className="ml-2 gap-1.5"
        >
          <GitCompare className="size-3.5" />
          {diffMode ? "Preview" : "Diff"}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        {diffMode && baselineFile ? (
          <DiffView
            before={baselineFile.content}
            after={activeFile?.content ?? ""}
          />
        ) : (
          <ScrollArea className="h-full">
            <div className="prose dark:prose-invert max-w-none p-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {activeFile?.content ?? ""}
              </ReactMarkdown>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
