import { useState } from "react"
import { invoke } from "@tauri-apps/api/core"
import { toast } from "sonner"
import { Plus, Loader2 } from "lucide-react"
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
import TagInput from "@/components/tag-input"

interface NewSkillDialogProps {
  workspacePath: string
  onCreated: () => void
  tagSuggestions?: string[]
}

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export default function NewSkillDialog({
  workspacePath,
  onCreated,
  tagSuggestions = [],
}: NewSkillDialogProps) {
  const [open, setOpen] = useState(false)
  const [domain, setDomain] = useState("")
  const [name, setName] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDomainChange = (value: string) => {
    setDomain(value)
    setName(toKebabCase(value))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim() || !name.trim()) return

    setLoading(true)
    setError(null)
    try {
      await invoke("create_skill", {
        workspacePath,
        name: name.trim(),
        domain: domain.trim(),
        tags: tags.length > 0 ? tags : null,
      })
      toast.success(`Skill "${name}" created`)
      setOpen(false)
      setDomain("")
      setName("")
      setTags([])
      onCreated()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error("Failed to create skill")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Skill
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Skill</DialogTitle>
            <DialogDescription>
              Define the functional domain for your new skill.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Input
                id="domain"
                placeholder="e.g., sales pipeline, HR analytics"
                value={domain}
                onChange={(e) => handleDomainChange(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="skill-name">Skill Name</Label>
              <Input
                id="skill-name"
                placeholder="auto-derived-from-domain"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Kebab-case identifier for this skill
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="tags">Tags</Label>
              <TagInput
                tags={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
                disabled={loading}
                placeholder="e.g., salesforce, analytics"
              />
              <p className="text-xs text-muted-foreground">
                Optional tags for categorization
              </p>
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !domain.trim() || !name.trim()}
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
