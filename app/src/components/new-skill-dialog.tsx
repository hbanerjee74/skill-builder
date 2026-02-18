import { useState, useEffect, useRef, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Plus, Loader2, ChevronLeft, ChevronRight } from "lucide-react"
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
import TagInput from "@/components/tag-input"
import { GhostInput, GhostTextarea } from "@/components/ghost-input"
import { useSettingsStore } from "@/stores/settings-store"
import { generateSuggestions, type FieldSuggestions } from "@/lib/tauri"
import { isValidKebab, toKebabChars } from "@/lib/utils"
import { SKILL_TYPES, SKILL_TYPE_LABELS, INTAKE_PLACEHOLDERS } from "@/lib/types"

const SKILL_TYPE_DESCRIPTIONS: Record<string, string> = {
  platform: "Tools and platform-specific skills (dbt, Fabric, Databricks)",
  domain: "Business domain knowledge (Finance, Marketing, HR)",
  source: "Source system extraction patterns (Salesforce, SAP, Workday)",
  "data-engineering": "Technical patterns and practices (SCD, Incremental Loads)",
}

interface NewSkillDialogProps {
  workspacePath: string
  onCreated: () => Promise<void>
  tagSuggestions?: string[]
}

export default function NewSkillDialog({
  workspacePath,
  onCreated,
  tagSuggestions = [],
}: NewSkillDialogProps) {
  const navigate = useNavigate()
  const { skillsPath, industry, functionRole } = useSettingsStore()
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState("")
  const [skillType, setSkillType] = useState<string>("")
  const [domain, setDomain] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [audience, setAudience] = useState("")
  const [challenges, setChallenges] = useState("")
  const [scope, setScope] = useState("")
  const [uniqueSetup, setUniqueSetup] = useState("")
  const [claudeMistakes, setClaudeMistakes] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<FieldSuggestions | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const placeholders = INTAKE_PLACEHOLDERS[skillType] || INTAKE_PLACEHOLDERS.domain

  // Fetch AI suggestions when name + type are set
  const fetchSuggestions = useCallback(
    (skillName: string, type: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!skillName || !type) {
        setSuggestions(null)
        return
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const result = await generateSuggestions(skillName, type, industry, functionRole)
          setSuggestions(result)
        } catch {
          // Silently fail — ghost text is optional
        }
      }, 800)
    },
    [industry, functionRole],
  )

  // Trigger suggestion fetch when name or type changes
  useEffect(() => {
    if (name && skillType) {
      fetchSuggestions(name, skillType)
    } else {
      setSuggestions(null)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [name, skillType, fetchSuggestions])

  const handleNameChange = (value: string) => {
    setName(toKebabChars(value))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !skillType) return
    if (!isValidKebab(name.trim())) {
      setError("Skill name must be kebab-case (e.g., sales-pipeline)")
      return
    }

    setLoading(true)
    setError(null)
    try {
      const intakeData: Record<string, string> = {}
      if (audience.trim()) intakeData.audience = audience.trim()
      if (challenges.trim()) intakeData.challenges = challenges.trim()
      if (scope.trim()) intakeData.scope = scope.trim()
      if (uniqueSetup.trim()) intakeData.unique_setup = uniqueSetup.trim()
      if (claudeMistakes.trim()) intakeData.claude_mistakes = claudeMistakes.trim()

      await invoke("create_skill", {
        workspacePath,
        name: name.trim(),
        domain: domain.trim() || name.replace(/-/g, " "),
        tags: tags.length > 0 ? tags : null,
        skillType: skillType || null,
        intakeJson: Object.keys(intakeData).length > 0 ? JSON.stringify(intakeData) : null,
      })
      console.log(`[skill] Created skill "${name}"`)
      toast.success(`Skill "${name}" created`)
      const skillName = name.trim()
      await onCreated()
      navigate({ to: "/skill/$skillName", params: { skillName } })
      setOpen(false)
      resetForm()
    } catch (err) {
      console.error("[new-skill] Failed to create skill:", err)
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error("Failed to create skill", { duration: Infinity })
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setStep(1)
    setName("")
    setSkillType("")
    setDomain("")
    setTags([])
    setAudience("")
    setChallenges("")
    setScope("")
    setUniqueSetup("")
    setClaudeMistakes("")
    setSuggestions(null)
    setError(null)
  }

  const canAdvanceStep1 = name.trim() !== "" && isValidKebab(name.trim()) && skillType !== ""

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Skill
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Skill</DialogTitle>
            <DialogDescription>
              {step === 1 && "Name your skill and choose its type."}
              {step === 2 && "Describe the domain this skill covers."}
              {step === 3 && "Add optional details to guide research."}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 py-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`size-2 rounded-full transition-colors ${
                  s === step
                    ? "bg-primary"
                    : s < step
                      ? "bg-primary/40"
                      : "bg-muted-foreground/20"
                }`}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              Step {step} of 3
            </span>
          </div>

          <div className="flex flex-col gap-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {/* Step 1: Name + Type */}
            {step === 1 && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="skill-name">Skill Name</Label>
                  <Input
                    id="skill-name"
                    placeholder="e.g., sales-pipeline"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={loading}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    Kebab-case identifier (lowercase, hyphens)
                    {name && !isValidKebab(name) && (
                      <span className="text-destructive ml-1">— invalid format</span>
                    )}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Skill Type</Label>
                  <RadioGroup
                    value={skillType}
                    onValueChange={setSkillType}
                    className="grid grid-cols-2 gap-2"
                  >
                    {SKILL_TYPES.map((type) => (
                      <label
                        key={type}
                        className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent [&:has([data-state=checked])]:border-primary"
                      >
                        <RadioGroupItem value={type} id={`type-${type}`} className="mt-0.5" />
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">{SKILL_TYPE_LABELS[type]}</span>
                          <span className="text-xs text-muted-foreground">
                            {SKILL_TYPE_DESCRIPTIONS[type]}
                          </span>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                </div>
              </>
            )}

            {/* Step 2: Domain */}
            {step === 2 && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="domain">Domain</Label>
                  <GhostInput
                    id="domain"
                    placeholder="What does this skill cover?"
                    value={domain}
                    onChange={setDomain}
                    suggestion={suggestions?.domain ?? null}
                    onAccept={setDomain}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Brief description of the skill&apos;s domain
                  </p>
                </div>

                {/* Skills output location */}
                {skillsPath && name && (
                  <p className="text-xs text-muted-foreground">
                    Output: <code className="text-xs">{skillsPath}/{name}/</code>
                  </p>
                )}
              </>
            )}

            {/* Step 3: Optional detail fields */}
            {step === 3 && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="scope">Scope</Label>
                  <GhostTextarea
                    id="scope"
                    placeholder={placeholders.scope}
                    value={scope}
                    onChange={setScope}
                    suggestion={suggestions?.scope ?? null}
                    onAccept={setScope}
                    disabled={loading}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Helps agents focus research on what matters most
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="tags">Tags</Label>
                  <TagInput
                    tags={tags}
                    onChange={setTags}
                    suggestions={tagSuggestions}
                    disabled={loading}
                    placeholder="e.g., salesforce, analytics"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="audience">Target Audience</Label>
                  <GhostTextarea
                    id="audience"
                    placeholder={placeholders.audience}
                    value={audience}
                    onChange={setAudience}
                    suggestion={suggestions?.audience ?? null}
                    onAccept={setAudience}
                    disabled={loading}
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="challenges">Key Challenges</Label>
                  <GhostTextarea
                    id="challenges"
                    placeholder={placeholders.challenges}
                    value={challenges}
                    onChange={setChallenges}
                    suggestion={suggestions?.challenges ?? null}
                    onAccept={setChallenges}
                    disabled={loading}
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="unique-setup">What makes your setup unique?</Label>
                  <GhostTextarea
                    id="unique-setup"
                    placeholder={placeholders.unique_setup}
                    value={uniqueSetup}
                    onChange={setUniqueSetup}
                    suggestion={suggestions?.unique_setup ?? null}
                    onAccept={setUniqueSetup}
                    disabled={loading}
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="claude-mistakes">What does Claude get wrong?</Label>
                  <GhostTextarea
                    id="claude-mistakes"
                    placeholder={placeholders.claude_mistakes}
                    value={claudeMistakes}
                    onChange={setClaudeMistakes}
                    suggestion={suggestions?.claude_mistakes ?? null}
                    onAccept={setClaudeMistakes}
                    disabled={loading}
                    rows={2}
                  />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            {step === 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={!canAdvanceStep1}
                  onClick={() => setStep(2)}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </>
            )}
            {step === 2 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(1)}
                  disabled={loading}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(3)}
                  disabled={loading}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !canAdvanceStep1}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Create
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={loading}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !canAdvanceStep1}
                >
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  Create
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
