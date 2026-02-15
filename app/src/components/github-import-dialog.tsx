import { useState, useCallback } from "react"
import { Loader2, Github, ArrowLeft, Check, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { parseGitHubUrl, listGitHubSkills, importGitHubSkills, updateTriggerText, regenerateClaudeMd } from "@/lib/tauri"
import type { AvailableSkill, GitHubRepoInfo, ImportedSkill } from "@/lib/types"

type Step = "url" | "select" | "importing" | "review" | "done"

interface GitHubImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImported: () => Promise<void>
}

export default function GitHubImportDialog({
  open,
  onOpenChange,
  onImported,
}: GitHubImportDialogProps) {
  const [step, setStep] = useState<Step>("url")
  const [url, setUrl] = useState("")
  const [repoInfo, setRepoInfo] = useState<GitHubRepoInfo | null>(null)
  const [skills, setSkills] = useState<AvailableSkill[]>([])
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [importedSkillsList, setImportedSkillsList] = useState<ImportedSkill[]>([])
  const [triggerTexts, setTriggerTexts] = useState<Record<string, string>>({})

  const reset = useCallback(() => {
    setStep("url")
    setUrl("")
    setRepoInfo(null)
    setSkills([])
    setSelectedPaths(new Set())
    setLoading(false)
    setError(null)
    setImportedCount(0)
    setImportedSkillsList([])
    setTriggerTexts({})
  }, [])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) reset()
      onOpenChange(open)
    },
    [onOpenChange, reset]
  )

  const handleBrowse = useCallback(async () => {
    setError(null)
    setLoading(true)
    try {
      const info = await parseGitHubUrl(url.trim())
      setRepoInfo(info)
      const available = await listGitHubSkills(
        info.owner,
        info.repo,
        info.branch,
        info.subpath ?? undefined
      )
      if (available.length === 0) {
        setError("No skills found in this repository.")
        setLoading(false)
        return
      }
      setSkills(available)
      setSelectedPaths(new Set(available.map((s) => s.path)))
      setStep("select")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [url])

  const handleTogglePath = useCallback((path: string) => {
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

  const handleToggleAll = useCallback(() => {
    setSelectedPaths((prev) => {
      if (prev.size === skills.length) {
        return new Set()
      }
      return new Set(skills.map((s) => s.path))
    })
  }, [skills])

  const handleImport = useCallback(async () => {
    if (!repoInfo || selectedPaths.size === 0) return
    setStep("importing")
    try {
      const imported = await importGitHubSkills(
        repoInfo.owner,
        repoInfo.repo,
        repoInfo.branch,
        Array.from(selectedPaths)
      )
      setImportedSkillsList(imported)
      setImportedCount(imported.length)

      // Generate default trigger text from frontmatter for each skill
      const texts: Record<string, string> = {}
      for (const skill of imported) {
        const name = skill.skill_name
        const desc = skill.description || "this skill"
        texts[name] = `This skill should be used when the user wants to "${desc}", read and follow the skill at \`.claude/skills/${name}/SKILL.md\`.`
      }
      setTriggerTexts(texts)
      setStep("review")

      await onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep("select")
    }
  }, [repoInfo, selectedPaths, onImported])

  const handleSaveTriggers = useCallback(async () => {
    setLoading(true)
    try {
      for (const [skillName, text] of Object.entries(triggerTexts)) {
        if (text.trim()) {
          await updateTriggerText(skillName, text.trim())
        }
      }
      await regenerateClaudeMd()
      setStep("done")
      const requested = selectedPaths.size
      if (importedCount < requested) {
        toast.warning(
          `Imported ${importedCount} of ${requested} skills. ${requested - importedCount} skipped (may already exist).`
        )
      } else {
        toast.success(`Imported ${importedCount} skill${importedCount !== 1 ? "s" : ""} and activated triggers`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [triggerTexts, importedCount, selectedPaths.size])

  const allSelected = selectedPaths.size === skills.length && skills.length > 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={step === "review" ? "sm:max-w-xl" : "sm:max-w-lg"}>
        {step === "url" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Github className="size-5" />
                Import from GitHub
              </DialogTitle>
              <DialogDescription>
                Paste a public GitHub repository URL to browse available skills.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <Input
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) handleBrowse()
                }}
              />
              {error && (
                <p className="flex items-center gap-1.5 text-sm text-destructive">
                  <AlertCircle className="size-4 shrink-0" />
                  {error}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={handleBrowse} disabled={!url.trim() || loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Browse Skills
              </Button>
            </div>
          </>
        )}

        {step === "select" && repoInfo && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <button
                  onClick={() => { setStep("url"); setError(null) }}
                  className="rounded-sm p-0.5 hover:bg-accent"
                >
                  <ArrowLeft className="size-4" />
                </button>
                Select Skills from {repoInfo.owner}/{repoInfo.repo}
              </DialogTitle>
              <DialogDescription>
                {skills.length} skill{skills.length !== 1 ? "s" : ""} found.
                Select the ones you'd like to import.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleToggleAll}
                />
                Select all
              </label>
              <ScrollArea className="max-h-64">
                <div className="flex flex-col gap-1">
                  {skills.map((skill) => (
                    <label
                      key={skill.path}
                      className="flex items-start gap-2 rounded-md px-2 py-2 hover:bg-accent cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedPaths.has(skill.path)}
                        onCheckedChange={() => handleTogglePath(skill.path)}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {skill.name}
                          </span>
                          {skill.domain && (
                            <Badge variant="secondary" className="text-xs shrink-0">
                              {skill.domain}
                            </Badge>
                          )}
                        </div>
                        {skill.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {skill.description}
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleImport}
                disabled={selectedPaths.size === 0}
              >
                Import Selected ({selectedPaths.size})
              </Button>
            </div>
          </>
        )}

        {step === "importing" && (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Importing {selectedPaths.size} skill{selectedPaths.size !== 1 ? "s" : ""}...
            </p>
          </div>
        )}

        {step === "review" && (
          <>
            <DialogHeader>
              <DialogTitle>Review Skill Triggers</DialogTitle>
              <DialogDescription>
                Review and edit the trigger text for each imported skill. This tells Claude when to use each skill.
              </DialogDescription>
            </DialogHeader>
            {error && (
              <p className="flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </p>
            )}
            <ScrollArea className="max-h-80">
              <div className="flex flex-col gap-4">
                {importedSkillsList.map((skill) => (
                  <div key={skill.skill_name} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{skill.skill_name}</span>
                      {skill.domain && (
                        <Badge variant="secondary" className="text-xs">
                          {skill.domain}
                        </Badge>
                      )}
                    </div>
                    <textarea
                      className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={triggerTexts[skill.skill_name] || ""}
                      onChange={(e) =>
                        setTriggerTexts((prev) => ({
                          ...prev,
                          [skill.skill_name]: e.target.value,
                        }))
                      }
                      placeholder="Describe when Claude should use this skill..."
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("done")
                  toast.success(`Imported ${importedCount} skill${importedCount !== 1 ? "s" : ""}`)
                }}
              >
                Skip
              </Button>
              <Button onClick={handleSaveTriggers} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                Save Triggers
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Check className="size-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <DialogTitle className="text-center">Import Complete</DialogTitle>
              <DialogDescription className="text-center">
                Successfully imported {importedCount} skill{importedCount !== 1 ? "s" : ""}.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end">
              <Button onClick={() => handleOpenChange(false)}>Done</Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
