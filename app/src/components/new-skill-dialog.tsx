import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
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
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import TagInput from "@/components/tag-input"
import { SKILL_TYPES, SKILL_TYPE_LABELS } from "@/lib/types"

const SKILL_TYPE_DESCRIPTIONS: Record<string, string> = {
  platform: "Tools and platform-specific skills (dbt, Fabric, Databricks)",
  domain: "Business domain knowledge (Finance, Marketing, HR)",
  source: "Source system extraction patterns (Salesforce, SAP, Workday)",
  "data-engineering": "Technical patterns and practices (SCD, Incremental Loads)",
}

const INTAKE_PLACEHOLDERS: Record<string, { audience: string; challenges: string; scope: string }> = {
  platform: {
    audience: "e.g., Data engineers building ELT pipelines, platform admins managing environments",
    challenges: "e.g., Complex dependency management, environment promotion, cost optimization",
    scope: "e.g., Focus on development workflow and CI/CD, exclude administration and security",
  },
  domain: {
    audience: "e.g., Business analysts in finance, data scientists building forecasting models",
    challenges: "e.g., Data quality issues in revenue recognition, reconciliation across systems",
    scope: "e.g., Focus on revenue analytics and reporting, exclude operational finance",
  },
  source: {
    audience: "e.g., Integration engineers connecting Salesforce to data warehouse",
    challenges: "e.g., API rate limits, incremental extraction, schema drift handling",
    scope: "e.g., Focus on Sales Cloud objects and custom objects, exclude Marketing Cloud",
  },
  "data-engineering": {
    audience: "e.g., Analytics engineers implementing SCD patterns, data platform teams",
    challenges: "e.g., Late-arriving dimensions, retroactive corrections, audit trail requirements",
    scope: "e.g., Focus on Type 2 SCD with effectivity dates, exclude Type 6 hybrid patterns",
  },
}

interface NewSkillDialogProps {
  workspacePath: string
  onCreated: () => Promise<void>
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
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [skillType, setSkillType] = useState<string>("")
  const [domain, setDomain] = useState("")
  const [name, setName] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [displayName, setDisplayName] = useState("")
  const [audience, setAudience] = useState("")
  const [challenges, setChallenges] = useState("")
  const [scope, setScope] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDomainChange = (value: string) => {
    setDomain(value)
    setName(toKebabCase(value))
    setError(null)
  }

  const placeholders = INTAKE_PLACEHOLDERS[skillType] || INTAKE_PLACEHOLDERS.domain

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!domain.trim() || !name.trim()) return

    setLoading(true)
    setError(null)
    try {
      const intakeData: Record<string, string> = {}
      if (audience.trim()) intakeData.audience = audience.trim()
      if (challenges.trim()) intakeData.challenges = challenges.trim()
      if (scope.trim()) intakeData.scope = scope.trim()

      await invoke("create_skill", {
        workspacePath,
        name: name.trim(),
        domain: domain.trim(),
        tags: tags.length > 0 ? tags : null,
        skillType: skillType || null,
        displayName: displayName.trim() || null,
        intakeJson: Object.keys(intakeData).length > 0 ? JSON.stringify(intakeData) : null,
      })
      console.log(`[skill] Created skill "${name}"`)
      toast.success(`Skill "${name}" created`)
      const skillName = name.trim()
      await onCreated()
      navigate({ to: "/skill/$skillName", params: { skillName } })
      setOpen(false)
      setSkillType("")
      setDomain("")
      setName("")
      setTags([])
      setDisplayName("")
      setAudience("")
      setChallenges("")
      setScope("")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg)
      toast.error("Failed to create skill", { duration: Infinity })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSkillType(""); }}>
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
          <div className="flex flex-col gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col gap-2">
              <Label>Skill Type</Label>
              <RadioGroup
                value={skillType}
                onValueChange={setSkillType}
                className="grid grid-cols-2 gap-2"
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
            {skillType && (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="display-name">Display Name</Label>
                  <Input
                    id="display-name"
                    placeholder="e.g., Sales Pipeline Analytics"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional friendly name shown on skill cards
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="audience">Target Audience</Label>
                  <Textarea
                    id="audience"
                    placeholder={placeholders.audience}
                    value={audience}
                    onChange={(e) => setAudience(e.target.value)}
                    disabled={loading}
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="challenges">Key Challenges</Label>
                  <Textarea
                    id="challenges"
                    placeholder={placeholders.challenges}
                    value={challenges}
                    onChange={(e) => setChallenges(e.target.value)}
                    disabled={loading}
                    rows={2}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="scope">Scope</Label>
                  <Textarea
                    id="scope"
                    placeholder={placeholders.scope}
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    disabled={loading}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Optional — helps agents focus research on what matters most
                  </p>
                </div>
              </>
            )}
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
              disabled={loading || !skillType || !domain.trim() || !name.trim()}
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
