import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Columns2, Rows2 } from "lucide-react";
import { useTheme } from "next-themes";

interface GitDiffViewerProps {
  oldValue: string;
  newValue: string;
  fileName?: string;
  splitView?: boolean;
}

export function GitDiffViewer({
  oldValue,
  newValue,
  fileName,
  splitView: initialSplit = true,
}: GitDiffViewerProps) {
  const [splitView, setSplitView] = useState(initialSplit);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium">
          {fileName || "Diff"}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSplitView(!splitView)}
        >
          {splitView ? (
            <Rows2 className="mr-1 size-4" />
          ) : (
            <Columns2 className="mr-1 size-4" />
          )}
          {splitView ? "Unified" : "Split"}
        </Button>
      </CardHeader>
      <CardContent className="overflow-auto p-0">
        <ReactDiffViewer
          oldValue={oldValue}
          newValue={newValue}
          splitView={splitView}
          useDarkTheme={isDark}
          compareMethod={DiffMethod.WORDS}
        />
      </CardContent>
    </Card>
  );
}
