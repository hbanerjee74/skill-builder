import { useState, useEffect, useCallback } from "react"
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
import ImportedSkillCard from "@/components/imported-skill-card"
import SkillPreviewDialog from "@/components/skill-preview-dialog"
import { useImportedSkillsStore } from "@/stores/imported-skills-store"
import type { ImportedSkill } from "@/stores/imported-skills-store"
import { useSettingsStore } from "@/stores/settings-store"
import GitHubImportDialog from "@/components/github-import-dialog"

export function SkillsLibraryTab() {
  const {
    skills,
    isLoading,
    fetchSkills,
    uploadSkill,
    toggleActive,
    deleteSkill,
  } = useImportedSkillsStore()

  const marketplaceUrl = useSettingsStore((s) => s.marketplaceUrl)
  const [previewSkillName, setPreviewSkillName] = useState<string | null>(null)
  const [showGitHubImport, setShowGitHubImport] = useState(false)

  useEffect(() => {
    fetchSkills()
  }, [fetchSkills])

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
  }, [uploadSkill])

  const handleToggleActive = useCallback(
    async (skillName: string, active: boolean) => {
      try {
        await toggleActive(skillName, active)
        toast.success(
          active ? `"${skillName}" activated` : `"${skillName}" deactivated`,
          { duration: 1500 }
        )
      } catch (err) {
        console.error("[skills-library] toggle active failed:", err)
        toast.error(
          `Failed to toggle: ${err instanceof Error ? err.message : String(err)}`,
          { duration: Infinity }
        )
      }
    },
    [toggleActive]
  )

  const handleDelete = useCallback(
    async (skill: ImportedSkill) => {
      const toastId = toast.loading(`Deleting "${skill.skill_name}"...`)
      try {
        await deleteSkill(skill.skill_name)
        toast.success(`Deleted "${skill.skill_name}"`, { id: toastId })
      } catch (err) {
        console.error("[skills-library] delete failed:", err)
        toast.error(
          `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
          { id: toastId, duration: Infinity }
        )
      }
    },
    [deleteSkill]
  )

  const displayedSkills = skills.filter((s) => s.skill_type === "skill-builder")

  const previewSkill = previewSkillName
    ? displayedSkills.find((s) => s.skill_name === previewSkillName) ?? null
    : null

  const handlePreview = useCallback((skill: ImportedSkill) => {
    setPreviewSkillName(skill.skill_name)
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="w-36"
          onClick={() => setShowGitHubImport(true)}
          disabled={!marketplaceUrl}
          title={!marketplaceUrl ? "Configure marketplace URL in Settings → GitHub" : undefined}
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
      ) : displayedSkills.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Package className="size-6 text-muted-foreground" />
            </div>
            <CardTitle>No imported skills</CardTitle>
            <CardDescription>
              Upload a .skill package or browse the marketplace to add skills to your library.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayedSkills.map((skill) => (
            <ImportedSkillCard
              key={skill.skill_id}
              skill={skill}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              onPreview={handlePreview}
            />
          ))}
        </div>
      )}

      <SkillPreviewDialog
        skill={previewSkill}
        open={previewSkill !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewSkillName(null)
        }}
      />

      <GitHubImportDialog
        open={showGitHubImport}
        onOpenChange={setShowGitHubImport}
        onImported={fetchSkills}
        mode="settings-skills"
        url={marketplaceUrl ?? ""}
        typeFilter={["skill-builder"]}
      />
    </div>
  )
}
