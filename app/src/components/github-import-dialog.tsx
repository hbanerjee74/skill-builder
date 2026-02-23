import { useState, useCallback, useEffect } from "react"
import { Loader2, AlertCircle, Download, CheckCircle2 } from "lucide-react"
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
import { parseGitHubUrl, listGitHubSkills, importGitHubSkills, importMarketplaceToLibrary, getInstalledSkillNames } from "@/lib/tauri"
import type { AvailableSkill, GitHubRepoInfo, SkillMetadataOverride } from "@/lib/types"

interface GitHubImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => Promise<void>
  /** The marketplace repository URL (from settings). Required — dialog auto-browses on open. */
  url: string
  /**
   * When set, only skills whose skill_type is in this list are shown.
   * Defaults to showing all skills.
   */
  typeFilter?: string[]
  /**
   * 'skill-library': calls importMarketplaceToLibrary (creates workflow_runs rows with source='marketplace')
   * 'settings-skills': calls importGitHubSkills (creates imported_skills rows)
   * Defaults to 'settings-skills' for backward compatibility.
   */
  mode?: 'skill-library' | 'settings-skills'
}

type SkillState = "idle" | "importing" | "imported" | "exists"

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
}: GitHubImportDialogProps) {
  const [loading, setLoading] = useState(false)
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null)
  const [skills, setSkills] = useState<AvailableSkill[]>([])
  const [error, setError] = useState<string | null>(null)
  const [skillStates, setSkillStates] = useState<Map<string, SkillState>>(new Map())

  // Edit form state for skill-library mode
  const [editingSkill, setEditingSkill] = useState<AvailableSkill | null>(null)
  const [editForm, setEditForm] = useState<EditFormState | null>(null)

  const reset = useCallback(() => {
    setLoading(false)
    setRepoInfo(null)
    setSkills([])
    setError(null)
    setSkillStates(new Map())
    setEditingSkill(null)
    setEditForm(null)
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset()
      onOpenChange(open)
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
        mode === 'skill-library'
      )
      if (typeFilter && typeFilter.length > 0) {
        available = available.filter(
          (s) => s.skill_type != null && typeFilter.includes(s.skill_type)
        )
      }
      if (available.length === 0) {
        setError("No skills found in this repository.")
        return
      }
      // Pre-mark skills that are already installed
      const installedNames = await getInstalledSkillNames()
      const installedSet = new Set(installedNames)
      const preStates = new Map<string, SkillState>()
      for (const skill of available) {
        if (installedSet.has(skill.name)) {
          preStates.set(skill.path, "exists")
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
  }, [url, typeFilter, mode])

  useEffect(() => {
    if (open) browse()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const openEditForm = useCallback((skill: AvailableSkill) => {
    setEditingSkill(skill)
    setEditForm({
      name: skill.name ?? '',
      description: skill.description ?? '',
      domain: skill.domain ?? '',
      skill_type: skill.skill_type ?? '',
      version: skill.version ?? '',
      model: skill.model ?? '',
      argument_hint: skill.argument_hint ?? '',
      user_invocable: skill.user_invocable ?? false,
      disable_model_invocation: skill.disable_model_invocation ?? false,
    })
  }, [])

  const handleImportWithMetadata = useCallback(async (skill: AvailableSkill, form: EditFormState) => {
    setSkillStates((prev) => new Map(prev).set(skill.path, "importing"))
    setEditingSkill(null)
    setEditForm(null)
    try {
      const override: SkillMetadataOverride = {
        name: form.name,
        description: form.description,
        domain: form.domain,
        skill_type: form.skill_type,
        version: form.version || null,
        model: form.model || null,
        argument_hint: form.argument_hint || null,
        user_invocable: form.user_invocable,
        disable_model_invocation: form.disable_model_invocation,
      }
      const results = await importMarketplaceToLibrary([skill.path], { [skill.path]: override })
      const result = results[0]
      if (!result?.success) {
        const errMsg = result?.error ?? "Import failed"
        if (errMsg.toLowerCase().includes("already exists")) {
          setSkillStates((prev) => new Map(prev).set(skill.path, "exists"))
        } else {
          console.error("[github-import] Import failed:", errMsg)
          setSkillStates((prev) => new Map(prev).set(skill.path, "idle"))
          toast.error(errMsg)
        }
        return
      }
      setSkillStates((prev) => new Map(prev).set(skill.path, "imported"))
      toast.success(`Imported "${form.name || skill.name}"`)
      await onImported()
    } catch (err) {
      console.error("[github-import] Import failed:", err)
      setSkillStates((prev) => new Map(prev).set(skill.path, "idle"))
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }, [onImported])

  const handleImport = useCallback(async (skill: AvailableSkill) => {
    if (!repoInfo) return
    setSkillStates((prev) => new Map(prev).set(skill.path, "importing"))
    try {
      if (mode === 'skill-library') {
        const results = await importMarketplaceToLibrary([skill.path])
        const result = results[0]
        if (!result?.success) {
          const errMsg = result?.error ?? "Import failed"
          // "already exists on disk" is an expected duplicate — show "In library".
          // Any other error (DB failure, network, etc.) is surfaced as a toast.
          if (errMsg.toLowerCase().includes("already exists")) {
            setSkillStates((prev) => new Map(prev).set(skill.path, "exists"))
          } else {
            console.error("[github-import] Import failed:", errMsg)
            setSkillStates((prev) => new Map(prev).set(skill.path, "idle"))
            toast.error(errMsg)
          }
          return
        }
      } else {
        await importGitHubSkills(repoInfo.owner, repoInfo.repo, repoInfo.branch, [skill.path])
      }
      setSkillStates((prev) => new Map(prev).set(skill.path, "imported"))
      toast.success(`Imported "${skill.name}"`)
      await onImported()
    } catch (err) {
      console.error("[github-import] Import failed:", err)
      setSkillStates((prev) => new Map(prev).set(skill.path, "idle"))
      toast.error(err instanceof Error ? err.message : String(err))
    }
  }, [repoInfo, onImported, mode])

  const isMandatoryMissing = editForm
    ? !editForm.name.trim() || !editForm.description.trim() || !editForm.domain.trim() || !editForm.skill_type.trim()
    : false

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
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

          {!loading && skills.length > 0 && repoInfo && (
            <>
              <DialogHeader>
                <DialogTitle>Browse Marketplace</DialogTitle>
                <DialogDescription>
                  {skills.length} skill{skills.length !== 1 ? "s" : ""} in {repoInfo.owner}/{repoInfo.repo}
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-96">
                <div className="flex flex-col gap-1">
                  {skills.map((skill) => {
                    const state = skillStates.get(skill.path) ?? "idle"
                    return (
                      <div
                        key={skill.path}
                        className="flex items-start gap-3 rounded-md px-2 py-2.5"
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{skill.name}</span>
                            {skill.domain && (
                              <Badge variant="secondary" className="text-xs shrink-0">
                                {skill.domain}
                              </Badge>
                            )}
                            {mode === 'skill-library' && !skill.skill_type && (
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
                          {mode === 'skill-library' && !skill.description && (
                            <span className="text-xs text-amber-600">No description</span>
                          )}
                          {state === "exists" && (
                            <span className="text-xs text-muted-foreground">Already in your library</span>
                          )}
                        </div>
                        <div className="shrink-0 pt-0.5">
                          {state === "imported" ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="size-4" />
                              Imported
                            </span>
                          ) : state === "exists" ? (
                            <span className="text-xs text-muted-foreground">In library</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={state === "importing"}
                              onClick={() => mode === 'skill-library' ? openEditForm(skill) : handleImport(skill)}
                            >
                              {state === "importing" ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <Download className="size-3.5" />
                              )}
                              {state === "importing" ? "Importing…" : mode === 'skill-library' ? "Edit & Import" : "Import"}
                            </Button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {!loading && !error && skills.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-sm text-muted-foreground">No skills found in this repository.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Metadata edit dialog — shown on top when editing a skill in skill-library mode */}
      <Dialog open={editingSkill !== null} onOpenChange={(open) => { if (!open) { setEditingSkill(null); setEditForm(null); } }}>
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
                    onChange={(e) => setEditForm((f) => f ? { ...f, name: e.target.value } : f)}
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
                    onChange={(e) => setEditForm((f) => f ? { ...f, description: e.target.value } : f)}
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
                    onChange={(e) => setEditForm((f) => f ? { ...f, domain: e.target.value } : f)}
                    className={!editForm.domain.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    placeholder="e.g. finance, analytics"
                  />
                  {!editForm.domain.trim() && (
                    <p className="text-xs text-destructive">Domain is required</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-skill-type">
                    Skill Type <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-skill-type"
                    value={editForm.skill_type}
                    onChange={(e) => setEditForm((f) => f ? { ...f, skill_type: e.target.value } : f)}
                    className={!editForm.skill_type.trim() ? "border-destructive focus-visible:ring-destructive" : ""}
                    placeholder="domain, platform, source, or data-engineering"
                  />
                  {!editForm.skill_type.trim() && (
                    <p className="text-xs text-destructive">Skill type is required</p>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-version">Version <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="edit-version"
                    value={editForm.version}
                    onChange={(e) => setEditForm((f) => f ? { ...f, version: e.target.value } : f)}
                    placeholder="e.g. 1.0.0"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-model">Model <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="edit-model"
                    value={editForm.model}
                    onChange={(e) => setEditForm((f) => f ? { ...f, model: e.target.value } : f)}
                    placeholder="e.g. claude-sonnet-4-5"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-argument-hint">Argument Hint <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <Input
                    id="edit-argument-hint"
                    value={editForm.argument_hint}
                    onChange={(e) => setEditForm((f) => f ? { ...f, argument_hint: e.target.value } : f)}
                    placeholder="Hint shown to users when invoking"
                  />
                </div>

                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-user-invocable"
                      checked={editForm.user_invocable}
                      onCheckedChange={(checked) => setEditForm((f) => f ? { ...f, user_invocable: !!checked } : f)}
                    />
                    <Label htmlFor="edit-user-invocable" className="cursor-pointer">
                      User Invocable <span className="text-muted-foreground text-xs">(optional)</span>
                    </Label>
                  </div>

                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="edit-disable-model-invocation"
                      checked={editForm.disable_model_invocation}
                      onCheckedChange={(checked) => setEditForm((f) => f ? { ...f, disable_model_invocation: !!checked } : f)}
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
              onClick={() => { setEditingSkill(null); setEditForm(null); }}
            >
              Cancel
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
