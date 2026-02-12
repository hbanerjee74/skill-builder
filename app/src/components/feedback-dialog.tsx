import { useEffect, useState } from "react"
import { toast } from "sonner"
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
import { Textarea } from "@/components/ui/textarea"
import { startAgent } from "@/lib/tauri"
import { useAgentStore } from "@/stores/agent-store"

type FeedbackType = "bug" | "feature"

/** Build the agent prompt that instructs the sidecar to create a Linear issue. */
export function buildFeedbackPrompt(
  type: FeedbackType,
  title: string,
  description: string,
): string {
  const label = type === "bug" ? "Bug" : "Feature"
  return `Create a Linear issue with the following details using the linear-server create_issue tool.

Team: Vibedata
Project: Skill Builder
Title: ${title}
Description:
${description}

Apply the "${label}" label to the issue.

After creating the issue, respond with ONLY the issue identifier (e.g. "VD-500") as plain text. Nothing else.`
}

export function FeedbackDialog() {
  const [open, setOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null)

  const resetForm = () => {
    setFeedbackType("bug")
    setTitle("")
    setDescription("")
  }

  // Watch for agent completion
  useEffect(() => {
    if (!pendingAgentId) return

    const unsubscribe = useAgentStore.subscribe((state) => {
      const run = state.runs[pendingAgentId]
      if (!run) return

      if (run.status === "completed" || run.status === "error") {
        if (run.status === "completed") {
          // Extract the issue identifier from the result message
          const resultMsg = run.messages.find((m) => m.type === "result")
          const issueId = resultMsg?.content?.trim() || "Unknown"
          toast.success(`Feedback submitted (${issueId})`)
          resetForm()
          setOpen(false)
        } else {
          toast.error("Failed to submit feedback", { duration: 5000 })
        }
        setIsSubmitting(false)
        setPendingAgentId(null)
      }
    })

    return unsubscribe
  }, [pendingAgentId])

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title")
      return
    }

    setIsSubmitting(true)

    const agentId = `feedback-${Date.now()}`
    const prompt = buildFeedbackPrompt(feedbackType, title, description)

    try {
      await startAgent(
        agentId,
        prompt,
        "haiku",
        ".",
        undefined, // Allow all tools (agent needs Linear MCP)
        5,         // Max 5 turns (should complete in 1-2)
        undefined, // No session resume
        "_feedback",
        "Submit Feedback",
        undefined, // No named agent
      )
      setPendingAgentId(agentId)
    } catch (err) {
      toast.error(
        `Failed to submit feedback: ${err instanceof Error ? err.message : String(err)}`,
        { duration: 5000 },
      )
      setIsSubmitting(false)
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      resetForm()
    }
    setOpen(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Send feedback">
          <MessageSquarePlus className="size-4" />
          <span className="sr-only">Send feedback</span>
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
          <DialogDescription>
            Report a bug or request a feature. Your feedback will be submitted
            to our issue tracker.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Type</Label>
            <RadioGroup
              value={feedbackType}
              onValueChange={(v) => setFeedbackType(v as FeedbackType)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="bug" id="feedback-bug" />
                <Label htmlFor="feedback-bug" className="font-normal">
                  Bug
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="feature" id="feedback-feature" />
                <Label htmlFor="feedback-feature" className="font-normal">
                  Feature Request
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-title">Title</Label>
            <Input
              id="feedback-title"
              placeholder="Brief summary of the issue or idea"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-description">Description</Label>
            <Textarea
              id="feedback-description"
              placeholder="Provide additional details, steps to reproduce, or expected behavior"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
