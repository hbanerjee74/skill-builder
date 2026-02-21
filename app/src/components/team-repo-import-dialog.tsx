import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { CheckCircle2, Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { listTeamRepoSkills, importTeamRepoSkill } from "@/lib/tauri"
import type { TeamRepoSkill } from "@/lib/types"
import { SKILL_TYPE_COLORS } from "@/lib/types"
import { cn } from "@/lib/utils"

interface TeamRepoImportDialogProps {
  onImported: () => Promise<void>
  marketplaceConfigured: boolean
  isLoggedIn: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

type SkillState = "idle" | "importing" | "imported" | "exists" | "overwriting"

export default function TeamRepoImportDialog({
  onImported,
  marketplaceConfigured,
  isLoggedIn,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: TeamRepoImportDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const onOpenChange = externalOnOpenChange !== undefined ? externalOnOpenChange : setInternalOpen

  const [loading, setLoading] = useState(false)
  const [skills, setSkills] = useState<TeamRepoSkill[]>([])
  const [skillStates, setSkillStates] = useState<Map<string, SkillState>>(new Map())

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSkillStates(new Map())
    listTeamRepoSkills()
      .then(result => {
        setSkills(result)
      })
      .catch(err => {
        toast.error(`Failed to load skills: ${err instanceof Error ? err.message : String(err)}`)
        onOpenChange(false)
      })
      .finally(() => setLoading(false))
  }, [open])

  const doImport = useCallback(async (skill: TeamRepoSkill, force = false) => {
    setSkillStates(prev => new Map(prev).set(skill.path, force ? "overwriting" : "importing"))
    try {
      await importTeamRepoSkill(skill.path, skill.name, force)
      setSkillStates(prev => new Map(prev).set(skill.path, "imported"))
      toast.success(`Imported "${skill.name}"`)
      await onImported()
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes("already exists")) {
        setSkillStates(prev => new Map(prev).set(skill.path, "exists"))
      } else {
        console.error("[team-repo-import] Import failed:", err)
        setSkillStates(prev => new Map(prev).set(skill.path, "idle"))
        toast.error(`Import failed: ${message}`)
      }
    }
  }, [onImported])

  let buttonTitle = "Import skills from team repository"
  if (!marketplaceConfigured) buttonTitle = "Configure marketplace URL in Settings"
  else if (!isLoggedIn) buttonTitle = "Sign in to GitHub in Settings"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          disabled={!marketplaceConfigured || !isLoggedIn}
          title={buttonTitle}
        >
          <Download className="size-4" />
          Marketplace
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from Team Repository</DialogTitle>
          {!loading && skills.length > 0 && (
            <DialogDescription>
              {skills.length} skill{skills.length !== 1 ? "s" : ""} available
            </DialogDescription>
          )}
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && skills.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No skills found in the team repository.
          </p>
        )}

        {!loading && skills.length > 0 && (
          <ScrollArea className="max-h-96">
            <div className="flex flex-col gap-1">
              {skills.map(skill => {
                const state = skillStates.get(skill.path) ?? "idle"
                return (
                  <div key={skill.path} className="flex items-start gap-3 rounded-md px-2 py-2.5">
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{skill.name}</span>
                        {skill.domain && (
                          <Badge
                            variant="secondary"
                            className={cn("text-xs shrink-0", SKILL_TYPE_COLORS[skill.domain as keyof typeof SKILL_TYPE_COLORS])}
                          >
                            {skill.domain}
                          </Badge>
                        )}
                      </div>
                      {skill.description && (
                        <span className="text-xs text-muted-foreground line-clamp-2">{skill.description}</span>
                      )}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {skill.creator && <span>by {skill.creator}</span>}
                        {skill.created_at && <span>{new Date(skill.created_at).toLocaleDateString()}</span>}
                      </div>
                      {state === "exists" && (
                        <span className="text-xs text-muted-foreground">Already exists locally — overwrite?</span>
                      )}
                    </div>
                    <div className="shrink-0 pt-0.5">
                      {state === "imported" ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-4" />
                          Imported
                        </span>
                      ) : state === "exists" ? (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => doImport(skill, true)}
                        >
                          Overwrite
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={state === "importing" || state === "overwriting"}
                          onClick={() => doImport(skill)}
                        >
                          {state === "importing" || state === "overwriting" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Download className="size-3.5" />
                          )}
                          {state === "importing" || state === "overwriting" ? "Importing…" : "Import"}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
