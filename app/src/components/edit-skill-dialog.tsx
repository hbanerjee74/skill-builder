import { useState, useEffect } from "react"
import { invoke } from "@tauri-apps/api/core"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import TagInput from "@/components/tag-input"
import type { SkillSummary } from "@/lib/types"
import { SKILL_TYPES, SKILL_TYPE_LABELS } from "@/lib/types"

interface EditSkillDialogProps {
  skill: SkillSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  availableTags: string[]
}

export default function EditSkillDialog({
  skill,
  open,
  onOpenChange,
  onSaved,
  availableTags,
}: EditSkillDialogProps) {
  const [displayName, setDisplayName] = useState("")
  const [skillType, setSkillType] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && skill) {
      setDisplayName(skill.display_name || "")
      setSkillType(skill.skill_type || "domain")
      setTags([...skill.tags])
    } else if (!open) {
      setDisplayName("")
      setSkillType("")
      setTags([])
      setSaving(false)
    }
  }, [open, skill])

  const handleSave = async () => {
    if (!skill) return
    setSaving(true)
    try {
      await invoke("update_skill_metadata", {
        skillName: skill.name,
        displayName: displayName.trim() || null,
        skillType: skillType || null,
        tags,
        intakeJson: null, // intake not editable from here yet
      })
      toast.success("Skill updated")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(
        `Failed to update skill: ${err instanceof Error ? err.message : String(err)}`,
        { duration: Infinity },
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Skill</DialogTitle>
          <DialogDescription>
            Update metadata for{" "}
            <span className="font-medium text-foreground">
              {skill?.name}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-display-name">Display Name</Label>
            <Input
              id="edit-display-name"
              placeholder="Optional friendly name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              Shown on skill cards instead of the kebab-case identifier
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Skill Type</Label>
            <RadioGroup
              value={skillType}
              onValueChange={setSkillType}
              className="grid grid-cols-2 gap-2"
              disabled={saving}
            >
              {SKILL_TYPES.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-accent [&:has([data-state=checked])]:border-primary"
                >
                  <RadioGroupItem value={type} id={`edit-type-${type}`} />
                  <span className="text-sm">{SKILL_TYPE_LABELS[type]}</span>
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Tags</Label>
            <TagInput
              tags={tags}
              onChange={setTags}
              suggestions={availableTags}
              disabled={saving}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
