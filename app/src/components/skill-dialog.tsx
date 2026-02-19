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
import { renameSkill, updateSkillMetadata, generateSuggestions, type FieldSuggestions } from "@/lib/tauri"
import { isValidKebab, toKebabChars, buildIntakeJson } from "@/lib/utils"
import type { SkillSummary } from "@/lib/types"
import { SKILL_TYPES, SKILL_TYPE_LABELS, SKILL_TYPE_DESCRIPTIONS, INTAKE_PLACEHOLDERS } from "@/lib/types"

// --- Cache key helpers ---

interface CacheKeyParams {
  name: string
  skillType: string
  industry?: string | null
  functionRole?: string | null
  domain?: string
  scope?: string
}

function makeCacheKey(params: CacheKeyParams): string {
  return JSON.stringify({
    name: params.name,
    skillType: params.skillType,
    industry: params.industry ?? "",
    functionRole: params.functionRole ?? "",
    domain: params.domain ?? "",
    scope: params.scope ?? "",
  })
}

// --- Intake JSON parsing ---

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

// --- Props ---

interface SkillDialogCreateProps {
  mode: "create"
  workspacePath: string
  onCreated: () => Promise<void>
  tagSuggestions?: string[]
}

interface SkillDialogEditProps {
  mode: "edit"
  skill: SkillSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  tagSuggestions?: string[]
}

export type SkillDialogProps = SkillDialogCreateProps | SkillDialogEditProps

const STEP_DESCRIPTIONS = {
  create: {
    1: "Name your skill and choose its type.",
    2: "Describe the domain, scope, and tags.",
    3: "Add optional details to guide research.",
  },
  edit: {
    1: "Update name and type.",
    2: "Update domain, scope, and tags.",
    3: "Update optional details.",
  },
} as const

export default function SkillDialog(props: SkillDialogProps) {
  const isEdit = props.mode === "edit"
  const navigate = useNavigate()
  const { workspacePath: storeWorkspacePath, skillsPath, industry, functionRole } = useSettingsStore()

  // Extract mode-specific props
  const editSkill = isEdit ? (props as SkillDialogEditProps).skill : null
  const editOnOpenChange = isEdit ? (props as SkillDialogEditProps).onOpenChange : undefined
  const editOnSaved = isEdit ? (props as SkillDialogEditProps).onSaved : undefined
  const createWorkspacePath = !isEdit ? (props as SkillDialogCreateProps).workspacePath : ""
  const createOnCreated = !isEdit ? (props as SkillDialogCreateProps).onCreated : undefined
  const tagSuggestions = props.tagSuggestions ?? []

  // Dialog open state — edit is controlled, create is internal
  const [internalOpen, setInternalOpen] = useState(false)
  const dialogOpen = isEdit ? (props as SkillDialogEditProps).open : internalOpen

  // Form state
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [skillName, setSkillName] = useState("")
  const [skillType, setSkillType] = useState("")
  const [domain, setDomain] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [audience, setAudience] = useState("")
  const [challenges, setChallenges] = useState("")
  const [scope, setScope] = useState("")
  const [uniqueSetup, setUniqueSetup] = useState("")
  const [claudeMistakes, setClaudeMistakes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Ghost suggestion state
  const [suggestions, setSuggestions] = useState<FieldSuggestions | null>(null)
  const [step3Suggestions, setStep3Suggestions] = useState<FieldSuggestions | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fetchVersionRef = useRef(0)
  const step3VersionRef = useRef(0)
  const suggestionCache = useRef<Map<string, FieldSuggestions>>(new Map())
  const step3PrefetchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Derived state
  const placeholders = INTAKE_PLACEHOLDERS[skillType] || INTAKE_PLACEHOLDERS.domain
  const originalName = editSkill?.name ?? ""
  const nameChanged = isEdit && skillName !== originalName
  const nameValid = isValidKebab(skillName)
  const canAdvanceStep1 = skillName.trim() !== "" && nameValid && skillType !== ""
  const submitLabel = isEdit ? "Save" : "Create"
  const stepDescriptions = STEP_DESCRIPTIONS[props.mode]

  // --- Form population and reset ---

  const resetForm = useCallback(() => {
    setStep(1)
    setSkillName("")
    setSkillType("")
    setDomain("")
    setTags([])
    setAudience("")
    setChallenges("")
    setScope("")
    setUniqueSetup("")
    setClaudeMistakes("")
    setSuggestions(null)
    setStep3Suggestions(null)
    setError(null)
    setSubmitting(false)
    fetchVersionRef.current++
    step3VersionRef.current++
    suggestionCache.current.clear()
    if (step3PrefetchRef.current) clearTimeout(step3PrefetchRef.current)
  }, [])

  // Populate form in edit mode when dialog opens; reset on close for both modes
  useEffect(() => {
    if (isEdit && dialogOpen && editSkill) {
      setSkillName(editSkill.name)
      setDomain(editSkill.domain || "")
      setSkillType(editSkill.skill_type || "domain")
      setTags([...editSkill.tags])
      const intake = parseIntake(editSkill.intake_json)
      setAudience(intake.audience)
      setChallenges(intake.challenges)
      setScope(intake.scope)
      setUniqueSetup(intake.unique_setup)
      setClaudeMistakes(intake.claude_mistakes)
    } else if (!dialogOpen) {
      resetForm()
    }
  }, [dialogOpen, isEdit, editSkill, resetForm])

  const handleOpenChange = useCallback((open: boolean) => {
    if (editOnOpenChange) {
      editOnOpenChange(open)
    } else {
      setInternalOpen(open)
    }
    if (!open) resetForm()
  }, [editOnOpenChange, resetForm])

  // --- Ghost suggestions ---

  // Step 2 suggestions: triggered by name + type
  const fetchSuggestions = useCallback(
    (name: string, type: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!name || !type) {
        setSuggestions(null)
        return
      }
      const version = ++fetchVersionRef.current
      debounceRef.current = setTimeout(async () => {
        try {
          const key = makeCacheKey({ name, skillType: type, industry, functionRole })
          const cached = suggestionCache.current.get(key)
          if (cached) {
            if (version === fetchVersionRef.current) setSuggestions(cached)
            return
          }
          const result = await generateSuggestions(name, type, {
            industry, functionRole,
          })
          if (version === fetchVersionRef.current) {
            suggestionCache.current.set(key, result)
            setSuggestions(result)
          }
        } catch (err) {
          console.error("[skill-dialog] Ghost suggestion fetch failed:", err)
        }
      }, 800)
    },
    [industry, functionRole],
  )

  // Build cache key and API params for step 3 suggestions
  function buildStep3Params(): { key: string; opts: Parameters<typeof generateSuggestions>[2] } {
    const effectiveDomain = domain || suggestions?.domain
    const effectiveScope = scope || suggestions?.scope
    const opts = {
      industry, functionRole,
      domain: effectiveDomain, scope: effectiveScope,
    }
    const key = makeCacheKey({
      name: skillName, skillType, industry, functionRole,
      domain: effectiveDomain ?? "",
      scope: effectiveScope ?? "",
    })
    return { key, opts }
  }

  // Step 3 suggestions: triggered when entering step 3
  const fetchStep3Suggestions = useCallback(() => {
    if (!skillName || !skillType) return
    const { key, opts } = buildStep3Params()

    const cached = suggestionCache.current.get(key)
    if (cached) {
      setStep3Suggestions(cached)
      return
    }

    const version = ++step3VersionRef.current
    ;(async () => {
      try {
        const result = await generateSuggestions(skillName, skillType, opts)
        if (version === step3VersionRef.current) {
          suggestionCache.current.set(key, result)
          setStep3Suggestions(result)
        }
      } catch (err) {
        console.error("[skill-dialog] Step 3 suggestion fetch failed:", err)
      }
    })()
  }, [skillName, skillType, industry, functionRole, domain, scope, suggestions?.domain, suggestions?.scope])

  // Trigger step 2 suggestion fetch when name or type changes
  useEffect(() => {
    if (skillName && skillType) {
      fetchSuggestions(skillName, skillType)
    } else {
      setSuggestions(null)
    }
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [skillName, skillType, fetchSuggestions])

  // Pre-fetch step 3 suggestions while user is on step 2
  useEffect(() => {
    if (step !== 2) return
    if (!skillName || !skillType || !(domain || suggestions?.domain)) return

    if (step3PrefetchRef.current) clearTimeout(step3PrefetchRef.current)
    const version = ++step3VersionRef.current
    step3PrefetchRef.current = setTimeout(async () => {
      const { key, opts } = buildStep3Params()
      if (suggestionCache.current.has(key)) return
      try {
        const result = await generateSuggestions(skillName, skillType, opts)
        if (version === step3VersionRef.current) {
          suggestionCache.current.set(key, result)
          console.debug("[skill-dialog] Pre-fetched step 3 suggestions")
        }
      } catch (err) {
        console.error("[skill-dialog] Step 3 pre-fetch failed:", err)
      }
    }, 1500)

    return () => {
      if (step3PrefetchRef.current) clearTimeout(step3PrefetchRef.current)
    }
  }, [step, domain, scope, skillName, skillType, industry, functionRole, suggestions?.domain, suggestions?.scope])

  // --- Submit ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canAdvanceStep1) return

    setSubmitting(true)
    setError(null)

    try {
      if (isEdit) {
        if (!editSkill) return
        if (nameChanged && storeWorkspacePath) {
          await renameSkill(editSkill.name, skillName, storeWorkspacePath)
        }
        await updateSkillMetadata(
          nameChanged ? skillName : editSkill.name,
          domain.trim(),
          skillType || null,
          tags,
          buildIntakeJson({
            audience, challenges, scope,
            unique_setup: uniqueSetup, claude_mistakes: claudeMistakes,
          }),
        )
        toast.success("Skill updated")
        handleOpenChange(false)
        editOnSaved?.()
      } else {
        await invoke("create_skill", {
          workspacePath: createWorkspacePath,
          name: skillName.trim(),
          domain: domain.trim() || skillName.replace(/-/g, " "),
          tags: tags.length > 0 ? tags : null,
          skillType: skillType || null,
          intakeJson: buildIntakeJson({
            audience, challenges, scope,
            unique_setup: uniqueSetup, claude_mistakes: claudeMistakes,
          }),
        })
        console.log(`[skill] Created skill "${skillName}"`)
        toast.success(`Skill "${skillName}" created`)
        const createdName = skillName.trim()
        await createOnCreated?.()
        navigate({ to: "/skill/$skillName", params: { skillName: createdName } })
        handleOpenChange(false)
      }
    } catch (err) {
      console.error(`[skill-dialog] Failed to ${isEdit ? "update" : "create"} skill:`, err)
      const msg = err instanceof Error ? err.message : String(err)
      if (isEdit) {
        toast.error(`Failed to update skill: ${msg}`, { duration: Infinity })
      } else {
        setError(msg)
        toast.error("Failed to create skill", { duration: Infinity })
      }
    } finally {
      setSubmitting(false)
    }
  }

  // --- Helpers ---

  const handleNameChange = (value: string) => {
    setSkillName(toKebabChars(value))
    setError(null)
  }

  function stepDotColor(s: number): string {
    if (s === step) return "bg-primary"
    if (s < step) return "bg-primary/40"
    return "bg-muted-foreground/20"
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      {!isEdit && (
        <DialogTrigger asChild>
          <Button>
            <Plus className="size-4" />
            New Skill
          </Button>
        </DialogTrigger>
      )}
      <DialogContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Skill" : "Create New Skill"}</DialogTitle>
            <DialogDescription>
              {stepDescriptions[step]}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicators */}
          <div className="flex items-center justify-center gap-2 py-3">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`size-2 rounded-full transition-colors ${stepDotColor(s)}`}
              />
            ))}
            <span className="ml-2 text-xs text-muted-foreground">
              Step {step} of 3
            </span>
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-4 py-2 overflow-y-auto pr-1">
            {/* Step 1: Name + Type */}
            {step === 1 && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="skill-name">Skill Name</Label>
                  <Input
                    id="skill-name"
                    placeholder={isEdit ? "kebab-case-name" : "e.g., sales-pipeline"}
                    value={skillName}
                    onChange={(e) => handleNameChange(e.target.value)}
                    disabled={submitting}
                    autoFocus={!isEdit}
                  />
                  {!isEdit && (
                    <p className="text-xs text-muted-foreground">
                      Kebab-case identifier (lowercase, hyphens)
                      {skillName && !nameValid && (
                        <span className="text-destructive ml-1">— invalid format</span>
                      )}
                    </p>
                  )}
                  {isEdit && skillName && !nameValid && (
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
                  <Label>Skill Type</Label>
                  <RadioGroup
                    value={skillType}
                    onValueChange={setSkillType}
                    className="grid grid-cols-2 gap-2"
                    disabled={submitting}
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

            {/* Step 2: Domain + Scope + Tags */}
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
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Brief description of the skill&apos;s domain
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="scope">Scope</Label>
                  <GhostTextarea
                    id="scope"
                    placeholder={placeholders.scope}
                    value={scope}
                    onChange={setScope}
                    suggestion={suggestions?.scope ?? null}
                    onAccept={setScope}
                    disabled={submitting}
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
                    disabled={submitting}
                    placeholder="e.g., salesforce, analytics"
                  />
                </div>

                {/* Skills output location (create mode only) */}
                {!isEdit && skillsPath && skillName && (
                  <p className="text-xs text-muted-foreground">
                    Output: <code className="text-xs">{skillsPath}/{skillName}/</code>
                  </p>
                )}
              </>
            )}

            {/* Step 3: Optional detail fields */}
            {step === 3 && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="audience">Target Audience</Label>
                  <GhostTextarea
                    id="audience"
                    placeholder={placeholders.audience}
                    value={audience}
                    onChange={setAudience}
                    suggestion={step3Suggestions?.audience ?? null}
                    onAccept={setAudience}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="challenges">Key Challenges</Label>
                  <GhostTextarea
                    id="challenges"
                    placeholder={placeholders.challenges}
                    value={challenges}
                    onChange={setChallenges}
                    suggestion={step3Suggestions?.challenges ?? null}
                    onAccept={setChallenges}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="unique-setup">What makes your setup unique?</Label>
                  <GhostTextarea
                    id="unique-setup"
                    placeholder={placeholders.unique_setup}
                    value={uniqueSetup}
                    onChange={setUniqueSetup}
                    suggestion={step3Suggestions?.unique_setup ?? null}
                    onAccept={setUniqueSetup}
                    disabled={submitting}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="claude-mistakes">What does Claude get wrong?</Label>
                  <GhostTextarea
                    id="claude-mistakes"
                    placeholder={placeholders.claude_mistakes}
                    value={claudeMistakes}
                    onChange={setClaudeMistakes}
                    suggestion={step3Suggestions?.claude_mistakes ?? null}
                    onAccept={setClaudeMistakes}
                    disabled={submitting}
                  />
                </div>
              </>
            )}

            {!isEdit && error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {step === 1 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
                  disabled={submitting}
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
                  disabled={submitting}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setStep(3); fetchStep3Suggestions(); }}
                  disabled={submitting}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !canAdvanceStep1}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitLabel}
                </Button>
              </>
            )}
            {step === 3 && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(2)}
                  disabled={submitting}
                >
                  <ChevronLeft className="size-4" />
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={submitting || !canAdvanceStep1}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitLabel}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
