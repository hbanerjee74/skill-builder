import { useState, useCallback, useEffect } from "react"
import { Loader2, AlertCircle, Download, PencilLine, CheckCircle2, CheckCheck } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { parseGitHubUrl, listGitHubSkills, importGitHubSkills, importMarketplaceToLibrary, listWorkspaceSkills, getDashboardSkillNames, listSkills } from "@/lib/tauri"
import type { WorkspaceSkillImportRequest } from "@/lib/tauri"
import type { AvailableSkill, GitHubRepoInfo, SkillMetadataOverride, WorkspaceSkill } from "@/lib/types"
import { SKILL_TYPES, PURPOSE_OPTIONS } from "@/lib/types"
import { useSettingsStore } from "@/stores/settings-store"

const FALLBACK_MODEL_OPTIONS = [
  { id: "haiku",  displayName: "Haiku — fastest, lowest cost" },
  { id: "sonnet", displayName: "Sonnet — balanced (default)" },
  { id: "opus",   displayName: "Opus — most capable" },
]

interface GitHubImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => Promise<void>
  /** The marketplace repository URL (from settings). Required — dialog auto-browses on open. */
  url: string
  /**
   * When set, only skills whose skill_type is in this list are shown (skill-library mode only).
   * In settings-skills mode this filter is ignored — all skills with a name are shown.
   */
  typeFilter?: string[]
  /**
   * 'skill-library': calls importMarketplaceToLibrary (creates workflow_runs rows with source='marketplace')
   * 'settings-skills': calls importGitHubSkills (creates imported_skills rows)
   * Defaults to 'settings-skills' for backward compatibility.
   */
  mode?: 'skill-library' | 'settings-skills'
  /** Workspace path — required for skill-library mode to look up installed skill metadata. */
  workspacePath?: string
}

type SkillState = "idle" | "importing" | "imported" | "exists" | "same-version" | "upgrade"

/** Sentinel used in the model <Select> to represent "no override — use app default". */
const APP_DEFAULT_MODEL = "__app_default__"

interface EditFormState {
  name: string
  description: string
  domain: string
  skill_type: string
  version: string
  model: string
  argument_hint: string
  user_invocable: boolean
  disable_model_invocation: boolean
}


export default function GitHubImportDialog({
  open,
  onOpenChange,
  onImported,
  url,
  typeFilter,
  mode = 'settings-skills',
  workspacePath,
}: GitHubImportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null)
  const [skills, setSkills] = useState<AvailableSkill[]>([])
  const [error, setError] = useState<string | null>(null)
  const [skillStates, setSkillStates] = useState<Map<string, SkillState>>(new Map())
  const availableModels = useSettingsStore((s) => s.availableModels)

  // Edit form state for both skill-library and settings-skills modes
  const [editingSkill, setEditingSkill] = useState<AvailableSkill | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)
  // Per-skill edit overrides accumulated in settings-skills mode (path -> override)
  const [editOverrides, setEditOverrides] = useState<Record<string, SkillMetadataOverride>>({})

  // Multi-select state for settings-skills mode
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  // Purpose assignment step
  const [showPurposeStep, setShowPurposeStep] = useState(false)
  const [purposeMap, setPurposeMap] = useState<Record<string, string | null>>({})

  // Workspace skills for version comparison and conflict detection
  const [workspaceSkills, setWorkspaceSkills] = useState<WorkspaceSkill[]>([])

  function setSkillState(path: string, state: SkillState): void {
    setSkillStates((prev) => new Map(prev).set(path, state))
  }

  function closeEditForm(): void {
    setEditingSkill(null)
    setEditForm(null)
  }

  function updateField<K extends keyof EditFormState>(key: K, value: EditFormState[K]): void {
    setEditForm((f) => f ? { ...f, [key]: value } : f)
  }

  const reset = useCallback(() => {
    setLoading(false)
    setRepoInfo(null)
    setSkills([])
    setError(null)
    setSkillStates(new Map())
    closeEditForm()
    setEditOverrides({})
    setSelectedPaths(new Set())
    setShowPurposeStep(false)
    setPurposeMap({})
    setWorkspaceSkills([])
  }, [])

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset()
      onOpenChange(isOpen)
    },
    [onOpenChange, reset]
  )

  const browse = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const info = await parseGitHubUrl(url.trim())
      setRepoInfo(info)
      let available = await listGitHubSkills(
        info.owner,
        info.repo,
        info.branch,
        info.subpath ?? undefined,
      )
      // Apply typeFilter only for skill-library mode
      if (mode === 'skill-library' && typeFilter && typeFilter.length > 0) {
        available = available.filter(
          (s) => s.skill_type != null && typeFilter.includes(s.skill_type)
        )
      }
      // For settings-skills mode: show all skills that have a name
      if (mode === 'settings-skills') {
        available = available.filter((s) => !!s.name)
      }
      if (available.length === 0) {
        setError("No skills found in this repository.")
        return
      }

      const preStates = new Map<string, SkillState>()

      if (mode === 'skill-library') {
        // skill-library: check the skills master table (covers both skill-builder and marketplace skills)
        const dashboardNames = await getDashboardSkillNames()
        const dashboardSet = new Set(dashboardNames)
        // Also fetch full metadata for version comparison and edit form pre-population
        const wp = workspacePath ?? ''
        const summaries = wp ? await listSkills(wp) : []
        const newSummaryMap = new Map(summaries.map((s) => [s.name, s]))
        for (const skill of available) {
          if (dashboardSet.has(skill.name)) {
            const installedSummary = newSummaryMap.get(skill.name)
            const sameVersion = installedSummary?.version === skill.version
            preStates.set(skill.path, sameVersion ? "same-version" : "upgrade")
          }
        }
      } else {
        // settings-skills: check workspace_skills table
        const installedSkills = await listWorkspaceSkills()
        setWorkspaceSkills(installedSkills)
        const installedSet = new Set(installedSkills.map((s) => s.skill_name))
        const installedVersionMap = new Map(installedSkills.map((s) => [s.skill_name, s.version]))
        for (const skill of available) {
          if (installedSet.has(skill.name)) {
            const installedVersion = installedVersionMap.get(skill.name)
            const sameVersion = installedVersion === skill.version  // covers both null/undefined
            preStates.set(skill.path, sameVersion ? "same-version" : "upgrade")
          }
        }
      }

      setSkillStates(preStates)
      setSkills(available)
    } catch (err) {
      console.error("[github-import] Failed to browse skills:", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [url, typeFilter, workspacePath])

  useEffect(() => {
    if (open) browse()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const openEditForm = useCallback((skill: AvailableSkill) => {
    setEditingSkill(skill)
    // Priority: in-session edits → remote skill frontmatter → existing installed version (for upgrade/exists)
    const existing = editOverrides[skill.path]
    const state = skillStates.get(skill.path)
    const ws = (state === 'upgrade' || state === 'exists')
      ? workspaceSkills.find((w) => w.skill_name === skill.name)
      : undefined
    const isSettingsMode = mode === 'settings-skills'
    setEditForm({
      name: existing?.name ?? skill.name ?? ws?.skill_name ?? '',
      description: existing?.description ?? skill.description ?? ws?.description ?? '',
      domain: existing?.domain ?? skill.domain ?? ws?.domain ?? '',
      skill_type: isSettingsMode ? 'skill-builder' : (existing?.skill_type ?? skill.skill_type ?? ws?.skill_type ?? ''),
      version: existing?.version ?? skill.version ?? ws?.version ?? '1.0.0',
      model: existing?.model ?? skill.model ?? ws?.model ?? '',
      argument_hint: existing?.argument_hint ?? skill.argument_hint ?? ws?.argument_hint ?? '',
      user_invocable: (existing?.user_invocable ?? skill.user_invocable ?? ws?.user_invocable) ?? false,
      disable_model_invocation: (existing?.disable_model_invocation ?? skill.disable_model_invocation ?? ws?.disable_model_invocation) ?? false,
    })
  }, [editOverrides, mode, skillStates, workspaceSkills])

  /** Handle marketplace import result, returning true if the import succeeded. */
  function handleMarketplaceResult(path: string, results: { success: boolean; error: string | null }[]): boolean {
    const result = results[0]
    if (result?.success) return true
    const errMsg = result?.error ?? "Import failed"
    // "already exists on disk" is an expected duplicate -- show "In library".
    // Any other error (DB failure, network, etc.) is surfaced as a toast.
    if (errMsg.toLowerCase().includes("already exists")) {
      setSkillState(path, "exists")
    } else {
      console.error("[github-import] Import failed:", errMsg)
      setSkillState(path, "idle")
      toast.error(errMsg)
    }
    return false
  }

  const handleImportWithMetadata = useCallback(async (skill: AvailableSkill, form: EditFormState) => {
    setSkillState(skill.path, "importing")
    closeEditForm()
    try {
      const metadataOverride: SkillMetadataOverride = {
        name: form.name,
        description: form.description,
        domain: form.domain,
        skill_type: form.skill_type,
        version: form.version || null,
        model: form.model === APP_DEFAULT_MODEL ? "" : form.model,  // "" signals "App default" → clear model from frontmatter
        argument_hint: form.argument_hint || null,
        user_invocable: form.user_invocable,
        disable_model_invocation: form.disable_model_invocation,
      }
      const results = await importMarketplaceToLibrary([skill.path], { [skill.path]: metadataOverride })
      if (!handleMarketplaceResult(skill.path, results)) return
      setSkillState(skill.path, "imported")
      toast.success(`Imported "${form.name || skill.name}"`)
      await onImported()
    } catch (err) {
      console.error("[github-import] Import failed:", err)
      setSkillState(skill.path, "idle")
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }, [onImported])

  /** Save edit form overrides for settings-skills mode (no immediate import) */
  const handleSaveEditOverride = useCallback(() => {
    if (!editingSkill || !editForm) return
    const metadataOverride: SkillMetadataOverride = {
      name: editForm.name,
      description: editForm.description,
      domain: editForm.domain,
      skill_type: editForm.skill_type,
      version: editForm.version || null,
      model: editForm.model || null,
      argument_hint: editForm.argument_hint || null,
      user_invocable: editForm.user_invocable,
      disable_model_invocation: editForm.disable_model_invocation,
    }
    setEditOverrides((prev) => ({ ...prev, [editingSkill.path]: metadataOverride }))
    closeEditForm()
  }, [editingSkill, editForm])

  const handleImport = useCallback(async (skill: AvailableSkill) => {
    if (!repoInfo) return
    setSkillState(skill.path, "importing")
    try {
      if (mode === 'skill-library') {
        const results = await importMarketplaceToLibrary([skill.path])
        if (!handleMarketplaceResult(skill.path, results)) return
      } else {
        const requests: WorkspaceSkillImportRequest[] = [{
          path: skill.path,
          purpose: null,
          metadata_override: editOverrides[skill.path] ?? null,
        }]
        await importGitHubSkills(repoInfo.owner, repoInfo.repo, repoInfo.branch, requests)
      }
      setSkillState(skill.path, "imported")
      toast.success(`Imported "${skill.name}"`)
      await onImported()
    } catch (err) {
      console.error("[github-import] Import failed:", err)
      setSkillState(skill.path, "idle")
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }, [repoInfo, onImported, mode, editOverrides])

  /** Toggle selection of a skill in settings-skills multi-select mode */
  const toggleSkillSelected = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  /** Proceed to purpose assignment step */
  const handleProceedToPurpose = useCallback(() => {
    // Initialize purposeMap with null for all selected skills,
    // pre-populating existing purpose for upgrade re-imports
    const initial: Record<string, string | null> = {}
    for (const path of selectedPaths) {
      const skillName = skills.find((s) => s.path === path)?.name ?? null
      const existingWs = skillName ? workspaceSkills.find((w) => w.skill_name === skillName) : null
      initial[path] = purposeMap[path] ?? existingWs?.purpose ?? null
    }
    setPurposeMap(initial)
    setShowPurposeStep(true)
  }, [selectedPaths, purposeMap, skills, workspaceSkills])

  /** Execute the final import with purpose assignments */
  const handleConfirmImport = useCallback(async () => {
    if (!repoInfo) return
    const pathsToImport = Array.from(selectedPaths)

    // Mark all as importing
    for (const path of pathsToImport) {
      setSkillState(path, "importing")
    }
    setShowPurposeStep(false)

    try {
      const requests: WorkspaceSkillImportRequest[] = pathsToImport.map((path) => ({
        path,
        purpose: purposeMap[path] ?? null,
        metadata_override: editOverrides[path] ?? null,
      }))
      await importGitHubSkills(repoInfo.owner, repoInfo.repo, repoInfo.branch, requests)
      for (const path of pathsToImport) {
        setSkillState(path, "imported")
      }
      setSelectedPaths(new Set())
      toast.success(`Imported ${pathsToImport.length} skill${pathsToImport.length !== 1 ? 's' : ''}`)
      await onImported()
    } catch (err) {
      console.error("[github-import] Bulk import failed:", err)
      for (const path of pathsToImport) {
        setSkillState(path, "idle")
      }
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }, [repoInfo, selectedPaths, purposeMap, editOverrides, onImported])

  /** Check if a purpose is already occupied by an active workspace skill (excluding the skill being imported by name) */
  function getPurposeConflict(purpose: string | null, excludeSkillName?: string | null): WorkspaceSkill | null {
    if (!purpose) return null
    return workspaceSkills.find(
      (w) => w.is_active && w.purpose === purpose && w.skill_name !== excludeSkillName
    ) ?? null
  }

  /** Determine if the confirm button should be disabled in purpose step */
  const purposeConflicts = showPurposeStep
    ? Array.from(selectedPaths)
        .map((path) => {
          const purpose = purposeMap[path] ?? null
          const skillName = skills.find((s) => s.path === path)?.name ?? null
          const conflict = getPurposeConflict(purpose, skillName)
          return conflict ? { path, conflict, purpose } : null
        })
        .filter(Boolean)
    : []
  const hasPurposeConflict = purposeConflicts.length > 0

  const isMandatoryMissing = editForm
    ? !editForm.name.trim() || !editForm.description.trim() || !editForm.domain.trim() || (mode !== 'settings-skills' && !editForm.skill_type.trim())
    : false

  const isSkillLibraryEditMode = mode === 'skill-library'

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading skills...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button variant="outline" onClick={browse}>Retry</Button>
            </div>
          )}

          {!loading && skills.length > 0 && repoInfo && !showPurposeStep && (
            <>
              <DialogHeader>
                <DialogTitle>Browse Marketplace</DialogTitle>
                <DialogDescription>
                  {skills.length} skill{skills.length !== 1 ? "s" : ""} in {repoInfo.owner}/{repoInfo.repo}
                  {mode === 'settings-skills' && (
                    <span className="ml-1">— select skills to import</span>
                  )}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-96">
                <div className="flex flex-col gap-1 pr-3">
                  {skills.map((skill) => {
                    const state = skillStates.get(skill.path) ?? "idle"
                    const isImporting = state === "importing"
                    const isSameVersion = state === "same-version"
                    const isUpgrade = state === "upgrade"
                    const isExists = state === "exists"
                    const isDimmed = isExists || isSameVersion
                    const isDisabled = isExists || isSameVersion
                    const isSelected = selectedPaths.has(skill.path)
                    const hasOverride = !!editOverrides[skill.path]

                    return (
                      <div
                        key={skill.path}
                        className={`flex items-start gap-3 rounded-md px-2 py-2.5 ${isDimmed ? "bg-muted" : ""} ${mode === 'settings-skills' && !isDisabled ? "cursor-pointer hover:bg-muted/50" : ""}`}
                        onClick={mode === 'settings-skills' && !isDisabled && !isImporting ? () => toggleSkillSelected(skill.path) : undefined}
                      >
                        {mode === 'settings-skills' && (
                          <div className="pt-0.5 shrink-0">
                            <Checkbox
                              checked={isSelected}
                              disabled={isDisabled || isImporting}
                              onCheckedChange={() => {
                                if (!isDisabled && !isImporting) toggleSkillSelected(skill.path)
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium truncate ${isDimmed ? "text-muted-foreground" : ""}`}>{skill.name}</span>
                            {skill.domain && (
                              <Badge variant="secondary" className={`text-xs shrink-0 ${isDimmed ? "text-muted-foreground" : ""}`}>
                                {skill.domain}
                              </Badge>
                            )}
                            {isExists && (
                              <Badge variant="outline" className="text-xs shrink-0 text-muted-foreground">
                                Already installed
                              </Badge>
                            )}
                            {isSameVersion && (
                              <Badge variant="secondary" className="text-xs shrink-0 text-muted-foreground">
                                Up to date
                              </Badge>
                            )}
                            {isUpgrade && (
                              <Badge variant="outline" className="text-xs shrink-0 text-amber-600 border-amber-300">
                                Update available
                              </Badge>
                            )}
                            {hasOverride && mode === 'settings-skills' && (
                              <Badge variant="outline" className="text-xs shrink-0 text-amber-600 border-amber-300">
                                Edited
                              </Badge>
                            )}
                            {mode === 'skill-library' && !skill.skill_type && !isSameVersion && (
                              <Badge variant="outline" className="text-xs shrink-0 text-amber-600 border-amber-300">
                                Missing type
                              </Badge>
                            )}
                          </div>
                          {skill.description && (
                            <span className="text-xs text-muted-foreground line-clamp-2">
                              {skill.description}
                            </span>
                          )}
                          {mode === 'skill-library' && !skill.description && !isSameVersion && (
                            <span className="text-xs text-amber-600">No description</span>
                          )}
                        </div>
                        <div className="shrink-0 pt-0.5 flex items-center gap-1">
                          {state === "imported" ? (
                            <div className="flex size-7 items-center justify-center rounded-md border">
                              <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                          ) : isExists || isSameVersion ? (
                            <div className="flex size-7 items-center justify-center rounded-md border bg-muted">
                              <CheckCheck className="size-3.5 text-muted-foreground" />
                            </div>
                          ) : mode === 'settings-skills' ? (
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-7"
                              disabled={isImporting}
                              title="Edit metadata"
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditForm(skill)
                              }}
                            >
                              {isImporting ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <PencilLine className="size-3.5" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              size="icon"
                              variant="outline"
                              className="size-7"
                              disabled={isImporting}
                              onClick={() => {
                                if (mode === 'skill-library') {
                                  openEditForm(skill)
                                } else {
                                  handleImport(skill)
                                }
                              }}
                            >
                              {isImporting ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : isSkillLibraryEditMode ? (
                                <PencilLine className="size-3.5" />
                              ) : (
                                <Download className="size-3.5" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
              {mode === 'settings-skills' && (
                <DialogFooter>
                  <Button
                    disabled={selectedPaths.size === 0}
                    onClick={handleProceedToPurpose}
                  >
                    Next: Assign Purpose ({selectedPaths.size} selected)
                  </Button>
                </DialogFooter>
              )}
            </>
          )}

          {/* Purpose assignment step — settings-skills mode only */}
          {!loading && showPurposeStep && repoInfo && (
            <>
              <DialogHeader>
                <DialogTitle>Assign Purpose (Optional)</DialogTitle>
                <DialogDescription>
                  Optionally assign a purpose to each skill before importing. Only one active skill per purpose is allowed.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-96">
                <div className="flex flex-col gap-3 pr-3">
                  {Array.from(selectedPaths).map((path) => {
                    const skill = skills.find((s) => s.path === path)
                    if (!skill) return null
                    const selectedPurpose = purposeMap[path] ?? null
                    const conflict = getPurposeConflict(selectedPurpose, skill.name)
                    return (
                      <div key={path} className="flex flex-col gap-1.5 rounded-md border px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate">{skill.name}</span>
                          <Select
                            value={selectedPurpose ?? "__none__"}
                            onValueChange={(v) => {
                              setPurposeMap((prev) => ({ ...prev, [path]: v === "__none__" ? null : v }))
                            }}
                          >
                            <SelectTrigger className="w-44 h-7 text-xs">
                              <SelectValue placeholder="No purpose" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">No purpose</SelectItem>
                              {PURPOSE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {conflict && (
                          <p className="text-xs text-destructive">
                            Purpose occupied by &ldquo;{conflict.skill_name}&rdquo;
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowPurposeStep(false)}>
                  Back
                </Button>
                <Button
                  disabled={hasPurposeConflict}
                  onClick={handleConfirmImport}
                >
                  Import {selectedPaths.size} skill{selectedPaths.size !== 1 ? 's' : ''}
                </Button>
              </DialogFooter>
            </>
          )}

          {!loading && !error && skills.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">No skills found in this repository.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Metadata edit dialog — shown on top when editing a skill */}
      <Dialog open={editingSkill !== null} onOpenChange={(isOpen) => { if (!isOpen) closeEditForm() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit &amp; Import Skill</DialogTitle>
            <DialogDescription>
              Review and edit the skill metadata before importing. Mandatory fields are required.
            </DialogDescription>
          </DialogHeader>
          {editForm && (
            <ScrollArea className="max-h-[60vh]">
              <div className="flex flex-col gap-4 pr-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-name"
                    value={editForm.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    className={!editForm.name.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    placeholder="Skill name"
                  />
                  {!editForm.name.trim() && (
                    <p className="text-xs text-destructive">Name is required</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-description">
                    Description <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="edit-description"
                    value={editForm.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    className={!editForm.description.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    placeholder="Describe what this skill does"
                    rows={3}
                  />
                  {!editForm.description.trim() && (
                    <p className="text-xs text-destructive">Description is required</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-domain">
                    Domain <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-domain"
                    value={editForm.domain}
                    onChange={(e) => updateField("domain", e.target.value)}
                    className={!editForm.domain.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    placeholder="e.g. finance, analytics"
                  />
                  {!editForm.domain.trim() && (
                    <p className="text-xs text-destructive">Domain is required</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  {mode === 'settings-skills' ? (
                    <>
                      <Label>Skill Type</Label>
                      <div className="flex h-9 items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
                        skill-builder
                      </div>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="edit-skill-type">
                        Skill Type <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={editForm.skill_type}
                        onValueChange={(v) => updateField("skill_type", v)}
                      >
                        <SelectTrigger
                          id="edit-skill-type"
                          className={!editForm.skill_type.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                        >
                          <SelectValue placeholder="Select skill type" />
                        </SelectTrigger>
                        <SelectContent>
                          {SKILL_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ')}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!editForm.skill_type.trim() && (
                        <p className="text-xs text-destructive">Skill type is required</p>
                      )}
                    </>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-version">Version <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="edit-version"
                    value={editForm.version}
                    onChange={(e) => updateField("version", e.target.value)}
                    placeholder="e.g. 1.0.0"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-model">Model <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Select
                    value={editForm.model}
                    onValueChange={(v) => updateField("model", v)}
                  >
                    <SelectTrigger id="edit-model">
                      <SelectValue placeholder="App default" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={APP_DEFAULT_MODEL}>App default</SelectItem>
                      {(availableModels.length > 0 ? availableModels : FALLBACK_MODEL_OPTIONS).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-argument-hint">Argument Hint <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="edit-argument-hint"
                    value={editForm.argument_hint}
                    onChange={(e) => updateField("argument_hint", e.target.value)}
                    placeholder="Hint shown to users when invoking"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-user-invocable"
                      checked={editForm.user_invocable}
                      onCheckedChange={(checked) => updateField("user_invocable", !!checked)}
                    />
                    <Label htmlFor="edit-user-invocable" className="cursor-pointer">
                      User Invocable <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-disable-model-invocation"
                      checked={editForm.disable_model_invocation}
                      onCheckedChange={(checked) => updateField("disable_model_invocation", !!checked)}
                    />
                    <Label htmlFor="edit-disable-model-invocation" className="cursor-pointer">
                      Disable Model Invocation <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={closeEditForm}
            >
              Cancel
            </Button>
            {mode === 'settings-skills' ? (
              <Button
                disabled={isMandatoryMissing || editForm === null}
                onClick={handleSaveEditOverride}
              >
                Save Edits
              </Button>
            ) : (
              <Button
                disabled={isMandatoryMissing || editForm === null}
                onClick={() => {
                  if (editingSkill && editForm) {
                    handleImportWithMetadata(editingSkill, editForm)
                  }
                }}
              >
                Confirm Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
