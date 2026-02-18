import { useCallback, useEffect, useRef, useState } from "react";

interface ResizableSplitPaneProps {
  left: React.ReactNode;
  right: React.ReactNode;
  defaultLeftPercent?: number;
}

export function ResizableSplitPane({
  left,
  right,
  defaultLeftPercent = 50,
}: ResizableSplitPaneProps) {
  const [leftPercent, setLeftPercent] = useState(defaultLeftPercent);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(() => {
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (e: MouseEvent) => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftPercent(Math.min(80, Math.max(20, percent)));
    };

    const onMouseUp = () => {
      setDragging(false);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, [dragging]);

  return (
    <div
      ref={containerRef}
      className={`flex h-full w-full overflow-hidden ${dragging ? "select-none" : ""}`}
    >
      <div className="min-w-0 overflow-hidden" style={{ width: `${leftPercent}%` }}>
        {left}
      </div>
      <div
        className="w-1 flex-shrink-0 cursor-col-resize bg-border hover:bg-primary/30"
        onMouseDown={onMouseDown}
      />
      <div className="min-w-0 flex-1 overflow-hidden">
        {right}
      </div>
    </div>
  );
}
