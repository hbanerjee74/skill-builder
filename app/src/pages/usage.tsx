import { useEffect, useState } from "react"
import { Loader2, DollarSign, Activity, TrendingUp, RotateCcw, ChevronDown, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useUsageStore } from "@/stores/usage-store"

const STEP_NAMES: Record<number, string> = {
  0: "Init",
  1: "Research Concepts",
  2: "Concepts Review",
  3: "Research Patterns",
  4: "Human Review",
  5: "Reasoning",
  6: "Build",
  7: "Validate",
  8: "Package/Refine",
  [-1]: "Chat",
}

const STEP_COLORS: Record<number, string> = {
  0: "bg-gray-400",
  1: "bg-blue-400",
  2: "bg-blue-300",
  3: "bg-indigo-400",
  4: "bg-indigo-300",
  5: "bg-purple-500",
  6: "bg-green-500",
  7: "bg-amber-500",
  8: "bg-emerald-500",
  [-1]: "bg-teal-400",
}

const MODEL_COLORS: Record<string, string> = {
  sonnet: "bg-blue-500",
  haiku: "bg-green-500",
  opus: "bg-purple-500",
}

function getStepName(stepId: number): string {
  return STEP_NAMES[stepId] ?? `Step ${stepId}`
}

function getStepColor(stepId: number): string {
  return STEP_COLORS[stepId] ?? "bg-gray-400"
}

function getModelColor(model: string): string {
  const key = model.toLowerCase()
  if (key.includes("haiku")) return MODEL_COLORS.haiku
  if (key.includes("opus")) return MODEL_COLORS.opus
  if (key.includes("sonnet")) return MODEL_COLORS.sonnet
  return "bg-gray-400"
}

function formatCost(amount: number): string {
  return `$${amount.toFixed(4)}`
}

function formatTokens(count: number): string {
  return count.toLocaleString()
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return `${seconds}s ago`

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function UsagePage() {
  const { summary, recentRuns, byStep, byModel, loading, error, fetchUsage, resetCounter } = useUsageStore()
  const [resetting, setResetting] = useState(false)
  const [expandedRuns, setExpandedRuns] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetCounter()
      toast.success("Usage data reset")
    } catch (err) {
      toast.error(`Failed to reset usage: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setResetting(false)
    }
  }

  const toggleExpanded = (index: number) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <h1 className="text-2xl font-semibold">Usage</h1>
        <p className="text-destructive">Failed to load usage data: {error}</p>
      </div>
    )
  }

  const isEmpty = !summary || (summary.total_runs === 0 && recentRuns.length === 0)

  if (isEmpty) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Usage</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <DollarSign className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground text-lg">No usage data yet.</p>
          <p className="text-muted-foreground text-sm mt-1">Run an agent to start tracking costs.</p>
        </div>
      </div>
    )
  }

  const maxStepCost = Math.max(...byStep.map((s) => s.total_cost), 0.0001)
  const maxModelCost = Math.max(...byModel.map((m) => m.total_cost), 0.0001)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Usage</h1>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
              <RotateCcw className="size-4" />
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset Usage Data</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all usage tracking data, including cost history and run records. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction variant="destructive" onClick={handleReset} disabled={resetting}>
                {resetting && <Loader2 className="size-4 animate-spin" />}
                Reset All Data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="size-4" />
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="total-cost">
              ${(summary?.total_cost ?? 0).toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="size-4" />
              Total Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="total-runs">
              {summary?.total_runs ?? 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="size-4" />
              Avg Cost/Run
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold" data-testid="avg-cost">
              {formatCost(summary?.avg_cost_per_run ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Breakdowns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cost by Step */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Step</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {byStep.length === 0 ? (
              <p className="text-sm text-muted-foreground">No step data available.</p>
            ) : (
              byStep.map((step) => (
                <div key={step.step_id} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{step.step_name || getStepName(step.step_id)}</span>
                    <span className="text-muted-foreground">
                      {formatCost(step.total_cost)} ({step.run_count} runs)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getStepColor(step.step_id)}`}
                      style={{ width: `${Math.max((step.total_cost / maxStepCost) * 100, 1)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Cost by Model */}
        <Card>
          <CardHeader>
            <CardTitle>Cost by Model</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {byModel.length === 0 ? (
              <p className="text-sm text-muted-foreground">No model data available.</p>
            ) : (
              byModel.map((m) => (
                <div key={m.model} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{m.model}</span>
                    <span className="text-muted-foreground">
                      {formatCost(m.total_cost)} ({m.run_count} runs)
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${getModelColor(m.model)}`}
                      style={{ width: `${Math.max((m.total_cost / maxModelCost) * 100, 1)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recent runs.</p>
          ) : (
            <div className="flex flex-col divide-y">
              {recentRuns.map((run, index) => {
                const isExpanded = expandedRuns.has(index)
                return (
                  <div key={`${run.agent_id}-${run.started_at}`} className="py-2">
                    <button
                      onClick={() => toggleExpanded(index)}
                      className="flex w-full items-center gap-3 text-sm hover:bg-muted/50 rounded-md px-2 py-1 transition-colors"
                      aria-expanded={isExpanded}
                      aria-label={`Toggle details for ${run.skill_name} ${getStepName(run.step_id)} run`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="font-medium truncate">{run.skill_name}</span>
                      <Badge variant="secondary" className="text-xs shrink-0">
                        {getStepName(run.step_id)}
                      </Badge>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {run.model}
                      </Badge>
                      <span className="ml-auto shrink-0 font-mono">{formatCost(run.total_cost)}</span>
                      <span className="text-muted-foreground shrink-0 w-16 text-right">
                        {formatRelativeTime(run.started_at)}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="ml-9 mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-muted-foreground pb-2" data-testid={`run-details-${index}`}>
                        <div>Input tokens: <span className="text-foreground font-mono">{formatTokens(run.input_tokens)}</span></div>
                        <div>Output tokens: <span className="text-foreground font-mono">{formatTokens(run.output_tokens)}</span></div>
                        <div>Cache read: <span className="text-foreground font-mono">{formatTokens(run.cache_read_tokens)}</span></div>
                        <div>Cache write: <span className="text-foreground font-mono">{formatTokens(run.cache_write_tokens)}</span></div>
                        <div>Duration: <span className="text-foreground font-mono">{formatDuration(run.duration_ms)}</span></div>
                        <div>Status: <span className="text-foreground">{run.status}</span></div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
