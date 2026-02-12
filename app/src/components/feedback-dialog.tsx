import { useEffect, useState } from "react"
import { toast } from "sonner"
import { getVersion } from "@tauri-apps/api/app"
import { Loader2, MessageSquarePlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { startAgent, getWorkspacePath } from "@/lib/tauri"
import { useAgentStore } from "@/stores/agent-store"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichedIssue {
  type: "bug" | "feature"
  title: string
  description: string
  priority: number   // 0-4
  effort: number     // 1-5
  labels: string[]
  reproducibleSteps: string
  version: string
}

type DialogStep = "input" | "enriching" | "review" | "submitting"

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

export function buildEnrichmentPrompt(
  title: string,
  description: string,
  version: string,
): string {
  return `You are an issue enrichment assistant for the Skill Builder desktop app (version ${version}).

Analyze the following user feedback and enrich it for a Linear issue.

User's title: ${title}
User's description:
${description}

Classify this as either a "bug" or "feature". Then enrich the issue with:
- A refined title (concise, actionable)
- An enriched description with more detail and context
- Priority: 0=None, 1=Urgent, 2=High, 3=Normal, 4=Low
- Effort estimate: 1=XS, 2=S, 3=M, 4=L, 5=XL
- Suggested labels (comma-separated, e.g. "area:ui, ux, performance")
- For bugs: reproducible steps (inferred from the description)

You may use Read, Glob, and Grep tools to look at the codebase if it helps you understand the context of the feedback. The app is a Tauri v2 desktop application with React frontend in src/ and Rust backend in src-tauri/.

Respond with ONLY a JSON object (no markdown fencing, no explanation):
{
  "type": "bug" or "feature",
  "title": "refined title",
  "description": "enriched description",
  "priority": number (0-4),
  "effort": number (1-5),
  "labels": "comma, separated, labels",
  "reproducibleSteps": "steps if bug, empty string if feature"
}`
}

export function buildSubmissionPrompt(data: EnrichedIssue): string {
  let description: string
  if (data.type === "bug") {
    description = `${data.description}

## Reproducible Steps
${data.reproducibleSteps}

## Environment
- App Version: ${data.version}`
  } else {
    description = `${data.description}

## Environment
- App Version: ${data.version}`
  }

  const labelsList = data.labels.map((l) => `"${l}"`).join(", ")

  return `Create a Linear issue using the linear-server create_issue tool with these exact parameters:

- team: "Vibedata"
- project: "skill-builder-015beb3f1e0d"
- title: "${data.title}"
- description: "${description}"
- priority: ${data.priority}
- estimate: ${data.effort}
- labels: [${labelsList}]

After creating the issue, respond with ONLY the issue identifier (e.g. "VD-500") as plain text.`
}

// ---------------------------------------------------------------------------
// Response parser
// ---------------------------------------------------------------------------

export function parseEnrichmentResponse(content: string): EnrichedIssue | null {
  try {
    // Try to extract JSON from the content (agent might wrap it in markdown)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    return {
      type: parsed.type === "feature" ? "feature" : "bug",
      title: String(parsed.title || ""),
      description: String(parsed.description || ""),
      priority: Number(parsed.priority) || 3,
      effort: Number(parsed.effort) || 2,
      labels:
        typeof parsed.labels === "string"
          ? parsed.labels
              .split(",")
              .map((l: string) => l.trim())
              .filter(Boolean)
          : Array.isArray(parsed.labels)
            ? (parsed.labels as string[])
            : [],
      reproducibleSteps: String(parsed.reproducibleSteps || ""),
      version: "", // filled by component
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FeedbackDialog() {
  // --- App version ---
  const [appVersion, setAppVersion] = useState("unknown")
  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("unknown"))
  }, [])

  // --- Dialog & step state ---
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<DialogStep>("input")

  // --- Input fields ---
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")

  // --- Enrichment result ---
  const [enriched, setEnriched] = useState<EnrichedIssue | null>(null)

  // --- Agent tracking ---
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null)

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setEnriched(null)
    setStep("input")
    setPendingAgentId(null)
  }

  // -----------------------------------------------------------------------
  // Agent completion watcher
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!pendingAgentId) return

    const unsubscribe = useAgentStore.subscribe((state) => {
      const run = state.runs[pendingAgentId]
      if (!run) return

      if (run.status !== "completed" && run.status !== "error") return

      if (step === "enriching") {
        if (run.status === "completed") {
          const resultMsg = run.messages.find((m) => m.type === "result")
          const content =
            resultMsg?.content ??
            run.messages.filter((m) => m.type === "text").pop()?.content ??
            ""
          const parsed = parseEnrichmentResponse(content)
          if (parsed) {
            parsed.version = appVersion
            setEnriched(parsed)
            setStep("review")
          } else {
            toast.error("Failed to parse enrichment response")
            setStep("input")
          }
        } else {
          toast.error("Failed to analyze feedback", { duration: 5000 })
          setStep("input")
        }
        setPendingAgentId(null)
      } else if (step === "submitting") {
        if (run.status === "completed") {
          const resultMsg = run.messages.find((m) => m.type === "result")
          const issueId =
            resultMsg?.content?.trim() ??
            run.messages
              .filter((m) => m.type === "text")
              .pop()
              ?.content?.trim() ??
            "Unknown"
          toast.success(`Feedback submitted (${issueId})`)
          resetForm()
          setOpen(false)
        } else {
          toast.error("Failed to submit feedback", { duration: 5000 })
          setStep("review")
        }
        setPendingAgentId(null)
      }
    })

    return unsubscribe
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAgentId, step, appVersion])

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  const handleAnalyze = async () => {
    if (!title.trim()) return
    setStep("enriching")

    const agentId = `feedback-enrich-${Date.now()}`
    const prompt = buildEnrichmentPrompt(title, description, appVersion)

    try {
      const cwd = await getWorkspacePath()
      await startAgent(
        agentId,
        prompt,
        "sonnet",
        cwd,
        undefined,
        10,
        undefined,
        "_feedback",
        "Enrich Feedback",
        undefined,
      )
      setPendingAgentId(agentId)
    } catch (err) {
      toast.error(
        `Failed to analyze feedback: ${err instanceof Error ? err.message : String(err)}`,
        { duration: 5000 },
      )
      setStep("input")
    }
  }

  const handleSubmit = async () => {
    if (!enriched) return
    setStep("submitting")

    const agentId = `feedback-submit-${Date.now()}`
    const prompt = buildSubmissionPrompt(enriched)

    try {
      await startAgent(
        agentId,
        prompt,
        "haiku",
        ".",
        undefined,
        5,
        undefined,
        "_feedback",
        "Submit Feedback",
        undefined,
      )
      setPendingAgentId(agentId)
    } catch (err) {
      toast.error(
        `Failed to submit feedback: ${err instanceof Error ? err.message : String(err)}`,
        { duration: 5000 },
      )
      setStep("review")
    }
  }

  const handleBack = () => {
    setStep("input")
    // Keep original title and description — do NOT reset them
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm()
    }
    setOpen(next)
  }

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------

  const renderInputStep = () => (
    <>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="feedback-title">Title</Label>
          <Input
            id="feedback-title"
            placeholder="Brief summary of the issue or idea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="feedback-description">Description</Label>
          <Textarea
            id="feedback-description"
            placeholder="Provide additional details, steps to reproduce, or expected behavior"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={() => handleOpenChange(false)}>
          Cancel
        </Button>
        <Button onClick={handleAnalyze} disabled={!title.trim()}>
          Analyze
        </Button>
      </DialogFooter>
    </>
  )

  const renderLoadingStep = (message: string) => (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )

  const renderReviewStep = () => {
    if (!enriched) return null

    return (
      <>
        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-4 py-2 pr-4">
            {/* Type */}
            <div className="grid gap-2">
              <Label>Type</Label>
              <RadioGroup
                value={enriched.type}
                onValueChange={(v) =>
                  setEnriched({ ...enriched, type: v as "bug" | "feature" })
                }
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="bug" id="review-type-bug" />
                  <Label htmlFor="review-type-bug" className="font-normal">
                    Bug
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="feature" id="review-type-feature" />
                  <Label htmlFor="review-type-feature" className="font-normal">
                    Feature
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="review-title">Title</Label>
              <Input
                id="review-title"
                value={enriched.title}
                onChange={(e) =>
                  setEnriched({ ...enriched, title: e.target.value })
                }
              />
            </div>

            {/* Description */}
            <div className="grid gap-2">
              <Label htmlFor="review-description">Description</Label>
              <Textarea
                id="review-description"
                value={enriched.description}
                onChange={(e) =>
                  setEnriched({ ...enriched, description: e.target.value })
                }
                rows={4}
              />
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="review-priority">Priority</Label>
              <select
                id="review-priority"
                value={enriched.priority}
                onChange={(e) =>
                  setEnriched({
                    ...enriched,
                    priority: Number(e.target.value),
                  })
                }
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value={0}>None</option>
                <option value={1}>Urgent</option>
                <option value={2}>High</option>
                <option value={3}>Normal</option>
                <option value={4}>Low</option>
              </select>
            </div>

            {/* Effort */}
            <div className="grid gap-2">
              <Label htmlFor="review-effort">Effort</Label>
              <select
                id="review-effort"
                value={enriched.effort}
                onChange={(e) =>
                  setEnriched({
                    ...enriched,
                    effort: Number(e.target.value),
                  })
                }
                className="rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value={1}>XS (1)</option>
                <option value={2}>S (2)</option>
                <option value={3}>M (3)</option>
                <option value={4}>L (4)</option>
                <option value={5}>XL (5)</option>
              </select>
            </div>

            {/* Labels */}
            <div className="grid gap-2">
              <Label htmlFor="review-labels">Labels</Label>
              <Input
                id="review-labels"
                value={enriched.labels.join(", ")}
                onChange={(e) =>
                  setEnriched({
                    ...enriched,
                    labels: e.target.value
                      .split(",")
                      .map((l) => l.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="comma, separated, labels"
              />
            </div>

            {/* Reproducible Steps (bugs only) */}
            {enriched.type === "bug" && (
              <div className="grid gap-2">
                <Label htmlFor="review-repro">Reproducible Steps</Label>
                <Textarea
                  id="review-repro"
                  value={enriched.reproducibleSteps}
                  onChange={(e) =>
                    setEnriched({
                      ...enriched,
                      reproducibleSteps: e.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
            )}

            {/* App Version (read-only) */}
            <div className="grid gap-2">
              <Label>App Version</Label>
              <p className="text-sm text-muted-foreground">{enriched.version}</p>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={handleBack}>
            Back
          </Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </DialogFooter>
      </>
    )
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Send feedback">
          <MessageSquarePlus className="size-4" />
          <span className="sr-only">Send feedback</span>
        </Button>
      </DialogTrigger>

      <DialogContent className={step === "review" ? "max-w-2xl" : undefined}>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Report a bug or request a feature. Your feedback will be analyzed
            and submitted to our issue tracker.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && renderInputStep()}
        {step === "enriching" && renderLoadingStep("Analyzing your feedback...")}
        {step === "review" && renderReviewStep()}
        {step === "submitting" && renderLoadingStep("Creating issue...")}
      </DialogContent>
    </Dialog>
  )
}
