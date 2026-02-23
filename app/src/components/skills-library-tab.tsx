import { useState, useEffect, useCallback, useMemo } from "react"
import { useNavigate } from "@tanstack/react-router"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import {
  Upload,
  Package,
  Github,
  Pencil,
  MessageSquare,
  FlaskConical,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TooltipProvider,
} from "@/components/ui/tooltip"
import { IconAction, isWorkflowComplete } from "@/components/skill-card"
import { SkillSourceBadge, SOURCE_DISPLAY_LABELS } from "@/components/skill-source-badge"
import DeleteSkillDialog from "@/components/delete-skill-dialog"
import { useImportedSkillsStore } from "@/stores/imported-skills-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useWorkflowStore } from "@/stores/workflow-store"
import GitHubImportDialog from "@/components/github-import-dialog"
import type { SkillSummary, AppSettings } from "@/lib/types"

type SortColumn = "name" | "source" | "domain" | "status"
type SortDir = "asc" | "desc"
type StatusFilter = "all" | "completed" | "in-progress"

function isComplete(s: SkillSummary): boolean {
  return s.skill_source === "marketplace" || s.skill_source === "imported" || isWorkflowComplete(s)
}

function getStepLabel(skill: SkillSummary): string {
  if (isComplete(skill)) return "Completed"
  const match = skill.current_step?.match(/step\s*(\d+)/i)
  if (match) return `Step ${match[1]}/5`
  return "In Progress"
}

interface SortHeaderProps {
  label: string
  column: SortColumn
  sortBy: SortColumn
  sortDir: SortDir
  onSort: (col: SortColumn) => void
  className?: string
}

function SortHeader({ label, column, sortBy, sortDir, onSort, className }: SortHeaderProps) {
  const isActive = sortBy === column
  return (
    <button
      type="button"
      className={`flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors ${className ?? ""}`}
      onClick={() => onSort(column)}
    >
      {label}
      {isActive ? (
        sortDir === "asc" ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )
      ) : null}
    </button>
  )
}

export function SkillsLibraryTab() {
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [workspacePath, setWorkspacePath] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)
  const [showGitHubImport, setShowGitHubImport] = useState(false)

  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortBy, setSortBy] = useState<SortColumn>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const navigate = useNavigate()

  const marketplaceUrl = useSettingsStore((s) => s.marketplaceUrl)

  // Still need upload from imported-skills store for .skill/.zip imports
  const { uploadSkill } = useImportedSkillsStore()

  const loadSettings = useCallback(async () => {
    try {
      const settings = await invoke<AppSettings>("get_settings")
      setWorkspacePath(settings.workspace_path || "")
    } catch {
      // Settings may not exist yet
    }
  }, [])

  const loadSkills = useCallback(async () => {
    if (!workspacePath) {
      setSkills([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    try {
      const result = await invoke<SkillSummary[]>("list_skills", {
        workspacePath,
      })
      console.log("[skills-library] loaded %d skills", result.length)
      setSkills(result)
    } catch (err) {
      console.error("[skills-library] Failed to load skills:", err)
      setSkills([])
    } finally {
      setIsLoading(false)
    }
  }, [workspacePath])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  const handleUpload = useCallback(async () => {
    const filePath = await open({
      title: "Import Skill Package",
      filters: [{ name: "Skill Package", extensions: ["skill", "zip"] }],
    })
    if (!filePath) return

    const toastId = toast.loading("Importing skill...")
    try {
      const skill = await uploadSkill(filePath)
      toast.success(`Imported "${skill.skill_name}"`, { id: toastId })
      loadSkills()
    } catch (err) {
      console.error("[skills-library] upload failed:", err)
      const message = err instanceof Error ? err.message : String(err)
      const missingPrefix = "missing_mandatory_fields:"
      if (message.startsWith(missingPrefix)) {
        const fields = message.slice(missingPrefix.length).split(",").filter(Boolean)
        toast.error(
          `Import failed: SKILL.md is missing required fields: ${fields.join(", ")}. Add them to the frontmatter and try again.`,
          { id: toastId, duration: Infinity }
        )
      } else {
        toast.error(
          `Import failed: ${message}`,
          { id: toastId, duration: Infinity }
        )
      }
    }
  }, [uploadSkill, loadSkills])

  const handleEditWorkflow = useCallback((skill: SkillSummary) => {
    useWorkflowStore.getState().setReviewMode(true)
    navigate({ to: "/skill/$skillName", params: { skillName: skill.name } })
  }, [navigate])

  const handleRefine = useCallback((skill: SkillSummary) => {
    navigate({ to: "/refine", search: { skill: skill.name } })
  }, [navigate])

  const handleTest = useCallback((skill: SkillSummary) => {
    navigate({ to: "/test", search: { skill: skill.name } })
  }, [navigate])

  const handleSort = useCallback((column: SortColumn) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"))
        return prev
      }
      setSortDir("asc")
      return column
    })
  }, [])

  const filtered = useMemo(() => {
    return skills.filter((s) => {
      if (sourceFilter && s.skill_source !== sourceFilter) return false
      if (statusFilter === "completed" && !isComplete(s)) return false
      if (statusFilter === "in-progress" && isComplete(s)) return false
      return true
    })
  }, [skills, sourceFilter, statusFilter])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "source":
          cmp = (a.skill_source || "").localeCompare(b.skill_source || "")
          break
        case "domain":
          cmp = (a.domain || "").localeCompare(b.domain || "")
          break
        case "status":
          cmp = Number(isComplete(a)) - Number(isComplete(b))
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortBy, sortDir])

  return (
    <div className="space-y-4">
      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="w-36"
          onClick={() => setShowGitHubImport(true)}
          disabled={!marketplaceUrl}
          title={!marketplaceUrl ? "Configure marketplace URL in Settings \u2192 GitHub" : undefined}
        >
          <Github className="size-4" />
          Marketplace
        </Button>
        <Button className="w-36" onClick={handleUpload}>
          <Upload className="size-4" />
          Upload Skill
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Select
          value={sourceFilter ?? "__all__"}
          onValueChange={(v) => setSourceFilter(v === "__all__" ? null : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Sources</SelectItem>
            {Object.entries(SOURCE_DISPLAY_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as StatusFilter)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-md border px-4 py-3">
              <Skeleton className="h-4 w-40 flex-1" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Package className="size-6 text-muted-foreground" />
            </div>
            <CardTitle>No skills yet</CardTitle>
            <CardDescription>
              {skills.length > 0
                ? "No skills match the current filters."
                : "Upload a .skill package or browse the marketplace to add skills to your library."}
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <TooltipProvider>
          <div className="rounded-md border">
            {/* Header row */}
            <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-2">
              <SortHeader label="Name" column="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="flex-1 min-w-0" />
              <SortHeader label="Source" column="source" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-32 shrink-0" />
              <SortHeader label="Domain" column="domain" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-40 shrink-0" />
              <SortHeader label="Status" column="status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className="w-28 shrink-0" />
              <div className="w-32 shrink-0 text-xs font-medium text-muted-foreground">Actions</div>
            </div>

            {/* Data rows */}
            {sorted.map((skill) => {
              const complete = isComplete(skill)
              const isSkillBuilder = skill.skill_source === "skill-builder"

              return (
                <div
                  key={skill.name}
                  className="flex items-center gap-4 border-b last:border-b-0 px-4 py-2 hover:bg-muted/30 transition-colors"
                >
                  {/* Name */}
                  <div className="flex-1 min-w-0 truncate text-sm font-medium">
                    {skill.name}
                  </div>

                  {/* Source */}
                  <div className="w-32 shrink-0">
                    <SkillSourceBadge skillSource={skill.skill_source} />
                  </div>

                  {/* Domain */}
                  <div className="w-40 shrink-0 truncate text-sm text-muted-foreground">
                    {skill.domain || "\u2014"}
                  </div>

                  {/* Status */}
                  <div className="w-28 shrink-0">
                    {complete ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Completed
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-muted-foreground">
                        {getStepLabel(skill)}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="w-32 shrink-0 flex items-center gap-0.5">
                    {isSkillBuilder && (
                      <IconAction
                        icon={<Pencil className="size-3" />}
                        label="Edit workflow"
                        tooltip="Edit workflow"
                        onClick={() => handleEditWorkflow(skill)}
                      />
                    )}
                    {complete && (
                      <IconAction
                        icon={<MessageSquare className="size-3" />}
                        label="Refine skill"
                        tooltip="Refine"
                        onClick={() => handleRefine(skill)}
                      />
                    )}
                    {complete && (
                      <IconAction
                        icon={<FlaskConical className="size-3" />}
                        label="Test skill"
                        tooltip="Test"
                        onClick={() => handleTest(skill)}
                      />
                    )}
                    <IconAction
                      icon={<Trash2 className="size-3" />}
                      label="Delete skill"
                      tooltip="Delete"
                      className="ml-auto hover:text-destructive"
                      onClick={() => setDeleteTarget(skill)}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </TooltipProvider>
      )}

      <DeleteSkillDialog
        skill={deleteTarget}
        workspacePath={workspacePath}
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onDeleted={loadSkills}
      />

      <GitHubImportDialog
        open={showGitHubImport}
        onOpenChange={setShowGitHubImport}
        onImported={loadSkills}
        mode="settings-skills"
        url={marketplaceUrl ?? ""}
        typeFilter={["skill-builder"]}
      />
    </div>
  )
}
