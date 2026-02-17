import { useState } from "react";
import { Clock, DollarSign, Activity, Zap, Database, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatModelName, formatTokenCount } from "@/stores/agent-store";
import type { AgentRunRecord } from "@/lib/types";

interface AgentStatsBarProps {
  runs: AgentRunRecord[];
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatCost(amount: number): string {
  if (amount >= 1) return `$${amount.toFixed(2)}`;
  return `$${amount.toFixed(4)}`;
}

function Stat({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <Icon className="size-3.5 text-muted-foreground" />
      {children}
    </span>
  );
}

function SingleRunStats({ run }: { run: AgentRunRecord }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const cacheHitRate =
    run.cache_read_tokens > 0
      ? (run.cache_read_tokens / (run.cache_read_tokens + run.input_tokens)) * 100
      : 0;

  const throughput =
    run.duration_ms > 0 ? run.output_tokens / (run.duration_ms / 1000) : 0;

  const apiOverhead =
    run.duration_api_ms != null && run.duration_ms > 0
      ? (run.duration_api_ms / run.duration_ms) * 100
      : null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-4 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors text-sm cursor-pointer"
      >
        <Stat icon={Clock}>{formatDuration(run.duration_ms)}</Stat>
        <Stat icon={DollarSign}>{formatCost(run.total_cost)}</Stat>
        <span className="text-muted-foreground">
          {formatTokenCount(run.input_tokens)} in
        </span>
        <span className="text-muted-foreground">
          {formatTokenCount(run.output_tokens)} out
        </span>
        <Badge variant="outline" className="ml-auto text-xs">
          {formatModelName(run.model)}
        </Badge>
        {isExpanded ? (
          <ChevronDown className="size-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3 py-2 bg-muted/10 border-t text-xs space-y-1.5">
          <div className="flex items-center gap-4 flex-wrap">
            <Stat icon={Activity}>{run.num_turns} turns</Stat>
            <Stat icon={Zap}>{run.tool_use_count} tool calls</Stat>
            <Stat icon={Database}>{cacheHitRate.toFixed(0)}% cache hit</Stat>
          </div>
          <div className="flex items-center gap-4 flex-wrap text-muted-foreground">
            <span>{throughput.toFixed(1)} tok/s</span>
            {apiOverhead !== null && <span>{apiOverhead.toFixed(0)}% API time</span>}
            <span>{run.compaction_count} compactions</span>
            {run.stop_reason && (
              <span>
                Stop: <span className="font-mono">{run.stop_reason}</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentStatsBar({ runs }: AgentStatsBarProps) {
  if (runs.length === 0) return null;

  // Single agent run — show directly
  if (runs.length === 1) {
    return <SingleRunStats run={runs[0]} />;
  }

  // Multiple parallel agents (e.g. research step) — show aggregate + individual
  const totals = runs.reduce(
    (acc, r) => ({
      cost: acc.cost + r.total_cost,
      input: acc.input + r.input_tokens,
      output: acc.output + r.output_tokens,
      duration: Math.max(acc.duration, r.duration_ms), // wall-clock = max
    }),
    { cost: 0, input: 0, output: 0, duration: 0 },
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 px-3 py-2 bg-muted/30 rounded-lg text-sm">
        <span className="text-xs font-medium text-muted-foreground">{runs.length} agents</span>
        <Stat icon={Clock}>{formatDuration(totals.duration)}</Stat>
        <Stat icon={DollarSign}>{formatCost(totals.cost)}</Stat>
        <span className="text-muted-foreground">
          {formatTokenCount(totals.input)} in
        </span>
        <span className="text-muted-foreground">
          {formatTokenCount(totals.output)} out
        </span>
      </div>
      {runs.map((run) => (
        <SingleRunStats key={run.agent_id} run={run} />
      ))}
    </div>
  );
}
