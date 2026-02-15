import { useState } from "react"
import { Loader2, Pencil, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { updateTriggerText, regenerateClaudeMd } from "@/lib/tauri"
import type { ImportedSkill } from "@/lib/types"

interface TriggerTextEditorProps {
  skill: ImportedSkill
  onSaved?: () => void
}

export default function TriggerTextEditor({ skill, onSaved }: TriggerTextEditorProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(skill.trigger_text ?? "")
  const [saving, setSaving] = useState(false)

  const defaultText = `This skill should be used when the user wants to "${skill.description || "use this skill"}", read and follow the skill at \`.claude/skills/${skill.skill_name}/SKILL.md\`.`

  const handleSave = async () => {
    setSaving(true)
    try {
      const finalText = text.trim() || defaultText
      await updateTriggerText(skill.skill_name, finalText)
      await regenerateClaudeMd()
      setText(finalText)
      setEditing(false)
      toast.success("Trigger text updated")
      onSaved?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setText(skill.trigger_text ?? "")
    setEditing(false)
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Trigger</span>
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-3.5" />
            Edit
          </Button>
        </div>
        <p className="text-sm text-muted-foreground italic">
          {text || "No trigger text set. Click Edit to add one."}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">Trigger</span>
      <textarea
        className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={defaultText}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </div>
    </div>
  )
}
