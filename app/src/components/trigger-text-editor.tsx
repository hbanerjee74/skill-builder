import { useState } from "react"
import { Loader2, Pencil, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { updateTriggerText, regenerateClaudeMd, generateTriggerText } from "@/lib/tauri"
import type { ImportedSkill } from "@/lib/types"

interface TriggerTextEditorProps {
  skill: ImportedSkill
  onSaved?: () => void
  readOnly?: boolean
}

export default function TriggerTextEditor({ skill, onSaved, readOnly }: TriggerTextEditorProps) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(skill.trigger_text ?? "")
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)

  const handleEdit = async () => {
    setEditing(true)
    // If no trigger text yet, generate via haiku
    if (!text) {
      setGenerating(true)
      try {
        const generated = await generateTriggerText(skill.skill_name)
        setText(generated)
      } catch {
        // Silently fail — user can type manually
      } finally {
        setGenerating(false)
      }
    }
  }

  const handleSave = async () => {
    if (!text.trim()) return
    setSaving(true)
    try {
      await updateTriggerText(skill.skill_name, text.trim())
      await regenerateClaudeMd()
      setText(text.trim())
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
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground italic">
          {text || (readOnly ? "No trigger text" : "No trigger text set. Click Edit to add one.")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-muted-foreground">Trigger</span>
      {generating ? (
        <div className="flex items-center gap-2 min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Generating trigger text...
        </div>
      ) : (
        <textarea
          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Describe when Claude should use this skill..."
        />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleCancel} disabled={saving || generating}>
          <X className="size-3.5" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving || generating || !text.trim()}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </div>
    </div>
  )
}
