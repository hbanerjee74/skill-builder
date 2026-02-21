import { useState, useCallback, useEffect } from "react"
import { Loader2, AlertCircle, Download, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { parseGitHubUrl, listGitHubSkills, importGitHubSkills, importMarketplaceToLibrary } from "@/lib/tauri"
import type { AvailableSkill, GitHubRepoInfo } from "@/lib/types"

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

  const reset = useCallback(() => {
    setLoading(false)
    setRepoInfo(null)
    setSkills([])
    setError(null)
    setSkillStates(new Map())
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
        info.subpath ?? undefined
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
      setSkills(available)
    } catch (err) {
      console.error("[github-import] Failed to browse skills:", err)
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [url, typeFilter])

  useEffect(() => {
    if (open) browse()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleImport = useCallback(async (skill: AvailableSkill) => {
    if (!repoInfo) return
    setSkillStates((prev) => new Map(prev).set(skill.path, "importing"))
    try {
      if (mode === 'skill-library') {
        const results = await importMarketplaceToLibrary([skill.path])
        const result = results[0]
        if (!result?.success) {
          setSkillStates((prev) => new Map(prev).set(skill.path, "exists"))
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-8">
            {error ? (
              <>
                <AlertCircle className="size-8 text-destructive" />
                <p className="text-sm text-destructive text-center">{error}</p>
                <Button variant="outline" onClick={browse}>Retry</Button>
              </>
            ) : (
              <>
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading skills...</p>
              </>
            )}
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
                        </div>
                        {skill.description && (
                          <span className="text-xs text-muted-foreground line-clamp-2">
                            {skill.description}
                          </span>
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
                            onClick={() => handleImport(skill)}
                          >
                            {state === "importing" ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Download className="size-3.5" />
                            )}
                            {state === "importing" ? "Importing…" : "Import"}
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
  )
}
