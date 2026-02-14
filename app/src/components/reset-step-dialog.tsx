import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { previewStepReset, resetWorkflowStep, type StepResetPreview } from "@/lib/tauri"

interface ResetStepDialogProps {
  targetStep: number | null
  workspacePath: string
  skillName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onReset: () => void
}

export default function ResetStepDialog({
  targetStep,
  workspacePath,
  skillName,
  open,
  onOpenChange,
  onReset,
}: ResetStepDialogProps) {
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<StepResetPreview[] | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    if (!open || targetStep === null) {
      setPreview(null)
      return
    }
    setLoadingPreview(true)
    previewStepReset(workspacePath, skillName, targetStep)
      .then(setPreview)
      .catch(() => setPreview([]))
      .finally(() => setLoadingPreview(false))
  }, [open, targetStep, workspacePath, skillName])

  const handleReset = async () => {
    if (targetStep === null) return
    setLoading(true)
    try {
      await resetWorkflowStep(workspacePath, skillName, targetStep)
      toast.success("Workflow reset successfully")
      onOpenChange(false)
      onReset()
    } catch (err) {
      toast.error(
        `Failed to reset: ${err instanceof Error ? err.message : String(err)}`,
        { duration: Infinity },
      )
    } finally {
      setLoading(false)
    }
  }

  const totalFiles = preview?.reduce((sum, s) => sum + s.files.length, 0) ?? 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset to Earlier Step</DialogTitle>
          <DialogDescription>
            Going back will delete all artifacts from step {(targetStep ?? 0) + 1} onward and reset their statuses.
          </DialogDescription>
        </DialogHeader>

        {loadingPreview ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : preview && preview.length > 0 ? (
          <div className="max-h-60 overflow-y-auto space-y-3 text-sm">
            {preview.map((step) => (
              <div key={step.step_id}>
                <p className="font-medium text-foreground">
                  {step.step_name}
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {step.files.map((file) => (
                    <li key={file} className="font-mono text-xs pl-3">
                      {file}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : preview && preview.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">
            No files to delete. Step statuses will be reset.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={loading || loadingPreview}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {totalFiles > 0 ? `Delete ${totalFiles} file${totalFiles !== 1 ? "s" : ""} & Reset` : "Reset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
