import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Loader2, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { SkillSummary } from "@/lib/types"

interface DeleteSkillDialogProps {
  skill: SkillSummary | null
  workspacePath: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
  isLocked?: boolean
}

export default function DeleteSkillDialog({
  skill,
  workspacePath,
  open,
  onOpenChange,
  onDeleted,
  isLocked,
}: DeleteSkillDialogProps) {
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!skill) return
    setLoading(true)
    try {
      await invoke("delete_skill", {
        workspacePath,
        name: skill.name,
      })
      console.log(`[skill] Deleted skill "${skill.name}"`)
      toast.success(`Skill "${skill.name}" deleted`)
      onOpenChange(false)
      onDeleted()
    } catch (err) {
      toast.error(
        `Failed to delete skill: ${err instanceof Error ? err.message : String(err)}`,
        { duration: Infinity },
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Skill</DialogTitle>
          <DialogDescription>
            {isLocked ? (
              <>
                <span className="font-medium text-foreground">{skill?.name}</span>
                {" "}is being edited in another window and cannot be deleted.
              </>
            ) : (
              <>
                Are you sure you want to delete{" "}
                <span className="font-medium text-foreground">
                  {skill?.name}
                </span>
                ? This will permanently remove all files for this skill.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {isLocked && (
          <div className="flex items-center gap-2 rounded-md border border-amber-500/50 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
            <Lock className="size-4 shrink-0" />
            This skill is being edited in another window and cannot be deleted
          </div>
        )}
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
            onClick={handleDelete}
            disabled={loading || isLocked}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
