import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "@tanstack/react-router"
import { invoke } from "@tauri-apps/api/core"
import { open } from "@tauri-apps/plugin-dialog"
import { toast } from "sonner"
import { Upload, Package, Github } from "lucide-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import SkillCard from "@/components/skill-card"
import DeleteSkillDialog from "@/components/delete-skill-dialog"
import { useImportedSkillsStore } from "@/stores/imported-skills-store"
import { useSettingsStore } from "@/stores/settings-store"
import { useWorkflowStore } from "@/stores/workflow-store"
import GitHubImportDialog from "@/components/github-import-dialog"
import type { SkillSummary, AppSettings } from "@/lib/types"

export function SkillsLibraryTab() {
  const [skills, setSkills] = useState<SkillSummary[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [workspacePath, setWorkspacePath] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<SkillSummary | null>(null)
  const [showGitHubImport, setShowGitHubImport] = useState(false)
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

  const handleContinue = useCallback((skill: SkillSummary) => {
    if (skill.skill_source === 'marketplace') {
      navigate({ to: "/refine", search: { skill: skill.name } })
      return
    }
    useWorkflowStore.getState().setReviewMode(true)
    navigate({ to: "/skill/$skillName", params: { skillName: skill.name } })
  }, [navigate])

  const handleRefine = useCallback((skill: SkillSummary) => {
    navigate({ to: "/refine", search: { skill: skill.name } })
  }, [navigate])

  return (
    <div className="space-y-6">
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

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : skills.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Package className="size-6 text-muted-foreground" />
            </div>
            <CardTitle>No skills yet</CardTitle>
            <CardDescription>
              Upload a .skill package or browse the marketplace to add skills to your library.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard
              key={skill.name}
              skill={skill}
              onContinue={handleContinue}
              onDelete={setDeleteTarget}
              onRefine={handleRefine}
            />
          ))}
        </div>
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
