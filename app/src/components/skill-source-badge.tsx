import { Hammer, Store, Upload } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const SOURCE_CONFIG: Record<string, {
  icon: typeof Hammer
  label: string
  colors: string
}> = {
  "skill-builder": {
    icon: Hammer,
    label: "Skill Builder",
    colors: "bg-muted text-muted-foreground",
  },
  marketplace: {
    icon: Store,
    label: "Marketplace",
    colors: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  imported: {
    icon: Upload,
    label: "Imported",
    colors: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
}

export const SOURCE_DISPLAY_LABELS: Record<string, string> = {
  "skill-builder": "Skill Builder",
  "marketplace": "Marketplace",
  "imported": "Imported",
}

interface SkillSourceBadgeProps {
  skillSource: string | null | undefined
  className?: string
}

export function SkillSourceBadge({ skillSource, className }: SkillSourceBadgeProps) {
  if (!skillSource) return null

  const config = SOURCE_CONFIG[skillSource]
  if (!config) return null

  const Icon = config.icon

  return (
    <Badge className={cn("px-1.5 py-0 text-[10px] gap-1", config.colors, className)}>
      <Icon className="size-3" />
      {config.label}
    </Badge>
  )
}
