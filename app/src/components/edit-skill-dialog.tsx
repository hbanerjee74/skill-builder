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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import TagInput from "@/components/tag-input"
import { renameSkill, updateSkillMetadata } from "@/lib/tauri"
import { useSettingsStore } from "@/stores/settings-store"
import { isValidKebab, toKebabChars, buildIntakeJson } from "@/lib/utils"
import type { SkillSummary } from "@/lib/types"
import { SKILL_TYPES, SKILL_TYPE_LABELS, INTAKE_PLACEHOLDERS } from "@/lib/types"

interface EditSkillDialogProps {
  skill: SkillSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  availableTags: string[]
}

const EMPTY_INTAKE = { audience: "", challenges: "", scope: "", unique_setup: "", claude_mistakes: "" }

function parseIntake(json: string | null | undefined): typeof EMPTY_INTAKE {
  if (!json) return EMPTY_INTAKE
  try {
    const obj = JSON.parse(json)
    return {
      audience: obj.audience || "",
      challenges: obj.challenges || "",
      scope: obj.scope || "",
      unique_setup: obj.unique_setup || "",
      claude_mistakes: obj.claude_mistakes || "",
    }
  } catch {
    return EMPTY_INTAKE
  }
}

export default function EditSkillDialog({
  skill,
  open,
  onOpenChange,
  onSaved,
  availableTags,
}: EditSkillDialogProps) {
  const { workspacePath } = useSettingsStore()
  const [skillName, setSkillName] = useState("")
  const [domain, setDomain] = useState("")
  const [skillType, setSkillType] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [audience, setAudience] = useState("")
  const [challenges, setChallenges] = useState("")
  const [scope, setScope] = useState("")
  const [uniqueSetup, setUniqueSetup] = useState("")
  const [claudeMistakes, setClaudeMistakes] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open && skill) {
      setSkillName(skill.name)
      setDomain(skill.domain || "")
      setSkillType(skill.skill_type || "domain")
      setTags([...skill.tags])
      const intake = parseIntake(skill.intake_json)
      setAudience(intake.audience)
      setChallenges(intake.challenges)
      setScope(intake.scope)
      setUniqueSetup(intake.unique_setup)
      setClaudeMistakes(intake.claude_mistakes)
    } else if (!open) {
      setSkillName("")
      setDomain("")
      setSkillType("")
      setTags([])
      setAudience("")
      setChallenges("")
      setScope("")
      setUniqueSetup("")
      setClaudeMistakes("")
      setSaving(false)
    }
  }, [open, skill])

  const placeholders = INTAKE_PLACEHOLDERS[skillType] || INTAKE_PLACEHOLDERS.domain

  const nameChanged = skill ? skillName !== skill.name : false
  const nameValid = isValidKebab(skillName)

  const handleSave = async () => {
    if (!skill) return
    if (!nameValid) {
      toast.error("Skill name must be kebab-case (e.g., sales-pipeline)")
      return
    }

    setSaving(true)
    try {
      // Rename first if name changed
      if (nameChanged && workspacePath) {
        await renameSkill(skill.name, skillName, workspacePath)
      }

      await updateSkillMetadata(
        nameChanged ? skillName : skill.name,
        domain.trim() || null,
        skillType || null,
        tags,
        buildIntakeJson({
          audience, challenges, scope,
          unique_setup: uniqueSetup, claude_mistakes: claudeMistakes,
        }),
      )
      toast.success("Skill updated")
      onOpenChange(false)
      onSaved()
    } catch (err) {
      console.error("[edit-skill] Failed to update skill:", err)
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
            <Label htmlFor="edit-skill-name">Skill Name</Label>
            <Input
              id="edit-skill-name"
              placeholder="kebab-case-name"
              value={skillName}
              onChange={(e) => setSkillName(toKebabChars(e.target.value))}
              disabled={saving}
            />
            {skillName && !nameValid && (
              <p className="text-xs text-destructive">
                Must be kebab-case (e.g., sales-pipeline)
              </p>
            )}
            {nameChanged && nameValid && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Renaming will move the skill directory
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-domain">Domain</Label>
            <Input
              id="edit-domain"
              placeholder="What does this skill cover?"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              disabled={saving}
            />
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
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-audience">Target Audience</Label>
            <Textarea
              id="edit-audience"
              placeholder={placeholders.audience}
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              disabled={saving}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-challenges">Key Challenges</Label>
            <Textarea
              id="edit-challenges"
              placeholder={placeholders.challenges}
              value={challenges}
              onChange={(e) => setChallenges(e.target.value)}
              disabled={saving}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-scope">Scope</Label>
            <Textarea
              id="edit-scope"
              placeholder={placeholders.scope}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={saving}
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Helps agents focus research on what matters most
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-unique-setup">What makes your setup unique?</Label>
            <Textarea
              id="edit-unique-setup"
              placeholder={placeholders.unique_setup}
              value={uniqueSetup}
              onChange={(e) => setUniqueSetup(e.target.value)}
              disabled={saving}
              rows={2}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-claude-mistakes">What does Claude get wrong?</Label>
            <Textarea
              id="edit-claude-mistakes"
              placeholder={placeholders.claude_mistakes}
              value={claudeMistakes}
              onChange={(e) => setClaudeMistakes(e.target.value)}
              disabled={saving}
              rows={2}
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
          <Button onClick={handleSave} disabled={saving || !nameValid}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
