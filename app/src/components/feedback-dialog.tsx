import { useState } from "react"
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
import { submitFeedback, type FeedbackType } from "@/lib/tauri"

export function FeedbackDialog() {
  const [open, setOpen] = useState(false)
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [loading, setLoading] = useState(false)

  const resetForm = () => {
    setFeedbackType("bug")
    setTitle("")
    setDescription("")
  }

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title")
      return
    }

    setLoading(true)
    try {
      const identifier = await submitFeedback(feedbackType, title, description)
      toast.success(`Feedback submitted (${identifier})`)
      resetForm()
      setOpen(false)
    } catch (err) {
      toast.error(
        `Failed to submit feedback: ${err instanceof Error ? err.message : String(err)}`,
        { duration: 5000 },
      )
    } finally {
      setLoading(false)
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
              disabled={loading}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="feedback-description">Description</Label>
            <Textarea
              id="feedback-description"
              placeholder="Provide additional details, steps to reproduce, or expected behavior"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={loading}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
