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

// --- Cache key helper ---

function makeCacheKey(group: string, params: Record<string, string | null | undefined>): string {
  return JSON.stringify({ group, ...params })
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
  existingNames?: string[]
}

interface SkillDialogEditProps {
  mode: "edit"
  skill: SkillSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  tagSuggestions?: string[]
  existingNames?: string[]
}

export type SkillDialogProps = SkillDialogCreateProps | SkillDialogEditProps

const STEP_DESCRIPTIONS = {
  create: {
    1: "Name your skill, choose its type, and add tags.",
    2: "Describe the domain and scope.",
    3: "Add optional details to guide research.",
  },
  edit: {
    1: "Update name, type, and tags.",
    2: "Update domain and scope.",
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
  const existingNames = props.existingNames ?? []

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

  // Ghost suggestion state — one per cascading group
  const [domainSuggestion, setDomainSuggestion] = useState<string | null>(null)
  const [scopeSuggestion, setScopeSuggestion] = useState<string | null>(null)
  const [audienceSuggestion, setAudienceSuggestion] = useState<string | null>(null)
  const [challengesSuggestion, setChallengesSuggestion] = useState<string | null>(null)
  const [uniqueSetupSuggestion, setUniqueSetupSuggestion] = useState<string | null>(null)
  const [claudeMistakesSuggestion, setClaudeMistakesSuggestion] = useState<string | null>(null)

  // Version refs and debounce timers for each group
  const domainVersionRef = useRef(0)
  const scopeVersionRef = useRef(0)
  const group3VersionRef = useRef(0)
  const group4VersionRef = useRef(0)
  const domainDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scopeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const group3DebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const group4DebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionCache = useRef<Map<string, FieldSuggestions>>(new Map())

  // Derived state
  const placeholders = INTAKE_PLACEHOLDERS[skillType] || INTAKE_PLACEHOLDERS.domain
  const originalName = editSkill?.name ?? ""
  const nameChanged = isEdit && skillName !== originalName
  const nameValid = isValidKebab(skillName)
  const nameExists = skillName !== "" && skillName !== originalName && existingNames.includes(skillName)
  const canAdvanceStep1 = skillName.trim() !== "" && nameValid && !nameExists && skillType !== ""
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
    setDomainSuggestion(null)
    setScopeSuggestion(null)
    setAudienceSuggestion(null)
    setChallengesSuggestion(null)
    setUniqueSetupSuggestion(null)
    setClaudeMistakesSuggestion(null)
    setError(null)
    setSubmitting(false)
    domainVersionRef.current++
    scopeVersionRef.current++
    group3VersionRef.current++
    group4VersionRef.current++
    suggestionCache.current.clear()
    if (domainDebounceRef.current) clearTimeout(domainDebounceRef.current)
    if (scopeDebounceRef.current) clearTimeout(scopeDebounceRef.current)
    if (group3DebounceRef.current) clearTimeout(group3DebounceRef.current)
    if (group4DebounceRef.current) clearTimeout(group4DebounceRef.current)
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
  }, [editOnOpenChange])

  // --- Cascading ghost suggestions ---
  // Group 1: domain ← name, industry, function
  // Group 2: scope ← name, industry, function, domain
  // Group 3: audience + challenges ← name, industry, function, domain, scope
  // Group 4: unique_setup + claude_mistakes ← name, industry, function, domain, audience, challenges

  // Generic fetch helper: debounce → cache check → API call → set state
  const fetchGroup = useCallback(
    (opts: {
      group: string
      fields: string[]
      params: Record<string, string | null | undefined>
      apiOpts: Parameters<typeof generateSuggestions>[2]
      versionRef: React.MutableRefObject<number>
      debounceRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>
      debounceMs: number
      onResult: (result: FieldSuggestions) => void
    }) => {
      if (opts.debounceRef.current) clearTimeout(opts.debounceRef.current)
      if (!skillName || !skillType) return

      const version = ++opts.versionRef.current
      opts.debounceRef.current = setTimeout(async () => {
        try {
          const key = makeCacheKey(opts.group, opts.params)
          const cached = suggestionCache.current.get(key)
          if (cached) {
            if (version === opts.versionRef.current) opts.onResult(cached)
            return
          }
          const result = await generateSuggestions(skillName, skillType, {
            ...opts.apiOpts,
            fields: opts.fields,
          })
          if (version === opts.versionRef.current) {
            suggestionCache.current.set(key, result)
            opts.onResult(result)
          }
        } catch (err) {
          console.error(`[skill-dialog] ${opts.group} suggestion fetch failed:`, err)
        }
      }, opts.debounceMs)
    },
    [skillName, skillType],
  )

  // Group 1: fetch domain when name + type are set (skip in edit mode — fields are pre-populated)
  useEffect(() => {
    if (isEdit || !skillName || !skillType) { setDomainSuggestion(null); return }
    const params = { name: skillName, skillType, industry, functionRole }
    fetchGroup({
      group: "domain", fields: ["domain"], params,
      apiOpts: { industry, functionRole },
      versionRef: domainVersionRef, debounceRef: domainDebounceRef,
      debounceMs: 800,
      onResult: (r) => setDomainSuggestion(r.domain || null),
    })
    return () => { if (domainDebounceRef.current) clearTimeout(domainDebounceRef.current) }
  }, [isEdit, skillName, skillType, industry, functionRole, fetchGroup])

  // Group 2: fetch scope when domain is available
  const effectiveDomain = domain || domainSuggestion
  useEffect(() => {
    if (isEdit || !effectiveDomain) { setScopeSuggestion(null); return }
    const params = { name: skillName, skillType, industry, functionRole, domain: effectiveDomain }
    fetchGroup({
      group: "scope", fields: ["scope"], params,
      apiOpts: { industry, functionRole, domain: effectiveDomain },
      versionRef: scopeVersionRef, debounceRef: scopeDebounceRef,
      debounceMs: 800,
      onResult: (r) => setScopeSuggestion(r.scope || null),
    })
    return () => { if (scopeDebounceRef.current) clearTimeout(scopeDebounceRef.current) }
  }, [isEdit, skillName, skillType, industry, functionRole, effectiveDomain, fetchGroup])

  // Group 3: fetch audience + challenges when scope is available
  const effectiveScope = scope || scopeSuggestion
  useEffect(() => {
    if (isEdit || !effectiveDomain || !effectiveScope) {
      setAudienceSuggestion(null); setChallengesSuggestion(null); return
    }
    const params = { name: skillName, skillType, industry, functionRole, domain: effectiveDomain, scope: effectiveScope }
    fetchGroup({
      group: "audience+challenges", fields: ["audience", "challenges"], params,
      apiOpts: { industry, functionRole, domain: effectiveDomain, scope: effectiveScope },
      versionRef: group3VersionRef, debounceRef: group3DebounceRef,
      debounceMs: 800,
      onResult: (r) => {
        setAudienceSuggestion(r.audience || null)
        setChallengesSuggestion(r.challenges || null)
      },
    })
    return () => { if (group3DebounceRef.current) clearTimeout(group3DebounceRef.current) }
  }, [isEdit, skillName, skillType, industry, functionRole, effectiveDomain, effectiveScope, fetchGroup])

  // Group 4: fetch unique_setup + claude_mistakes when audience + challenges are available
  const effectiveAudience = audience || audienceSuggestion
  const effectiveChallenges = challenges || challengesSuggestion
  useEffect(() => {
    if (isEdit || !effectiveDomain || !effectiveAudience || !effectiveChallenges) {
      setUniqueSetupSuggestion(null); setClaudeMistakesSuggestion(null); return
    }
    const params = { name: skillName, skillType, industry, functionRole, domain: effectiveDomain, audience: effectiveAudience, challenges: effectiveChallenges }
    fetchGroup({
      group: "unique_setup+claude_mistakes", fields: ["unique_setup", "claude_mistakes"], params,
      apiOpts: { industry, functionRole, domain: effectiveDomain, audience: effectiveAudience, challenges: effectiveChallenges },
      versionRef: group4VersionRef, debounceRef: group4DebounceRef,
      debounceMs: 800,
      onResult: (r) => {
        setUniqueSetupSuggestion(r.unique_setup || null)
        setClaudeMistakesSuggestion(r.claude_mistakes || null)
      },
    })
    return () => { if (group4DebounceRef.current) clearTimeout(group4DebounceRef.current) }
  }, [isEdit, skillName, skillType, industry, functionRole, effectiveDomain, effectiveAudience, effectiveChallenges, fetchGroup])

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
          domain.trim() || null,
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
      <DialogContent className="sm:max-w-2xl">
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
            {/* Step 1: Name + Type + Tags */}
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
                  {nameExists && (
                    <p className="text-xs text-destructive">
                      A skill with this name already exists
                    </p>
                  )}
                  {nameChanged && nameValid && !nameExists && (
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
              </>
            )}

            {/* Step 2: Domain + Scope */}
            {step === 2 && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="domain">Domain</Label>
                  <GhostInput
                    id="domain"
                    placeholder="What does this skill cover?"
                    value={domain}
                    onChange={setDomain}
                    suggestion={domainSuggestion}
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
                    suggestion={scopeSuggestion}
                    onAccept={setScope}
                    disabled={submitting}
                  />
                  <p className="text-xs text-muted-foreground">
                    Helps agents focus research on what matters most
                  </p>
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
                    suggestion={audienceSuggestion}
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
                    suggestion={challengesSuggestion}
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
                    suggestion={uniqueSetupSuggestion}
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
                    suggestion={claudeMistakesSuggestion}
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
                  onClick={() => setStep(3)}
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
