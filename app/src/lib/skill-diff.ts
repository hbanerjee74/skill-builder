import { diffLines, type Change } from "diff";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  content: string;
}

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const changes: Change[] = diffLines(before, after);
  const result: DiffLine[] = [];

  for (const change of changes) {
    const lines = change.value.split("\n");
    // diffLines includes trailing empty string for final newline
    const trimmed = lines[lines.length - 1] === "" ? lines.slice(0, -1) : lines;

    for (const line of trimmed) {
      if (change.added) {
        result.push({ type: "added", content: line });
      } else if (change.removed) {
        result.push({ type: "removed", content: line });
      } else {
        result.push({ type: "unchanged", content: line });
      }
    }
  }

  return result;
}
