import {
  Download,
  FlaskConical,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  SquarePen,
  Trash2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  IconAction,
  isWorkflowComplete,
} from "@/components/skill-card"
import { SkillSourceBadge } from "@/components/skill-source-badge"
import type { SkillSummary, SkillType } from "@/lib/types"
import { SKILL_TYPE_LABELS } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Shared 5-column grid — used by both the row and the table header in dashboard.tsx */
export const LIST_ROW_GRID = "grid-cols-[1fr_auto] sm:grid-cols-[1fr_8rem_7rem_6rem_auto]"

function getStatusLabel(skill: SkillSummary): string {
  if (skill.skill_source === "marketplace" || skill.skill_source === "imported" || isWorkflowComplete(skill)) {
    return "Completed"
  }
  const match = skill.current_step?.match(/step\s*(\d+)/i)
  if (match) return `Step ${match[1]}/5`
  return "In Progress"
}

interface SkillListRowProps {
  skill: SkillSummary
  isLocked?: boolean
  onContinue: (skill: SkillSummary) => void
  onDelete: (skill: SkillSummary) => void
  onDownload?: (skill: SkillSummary) => void
  onEdit?: (skill: SkillSummary) => void
  onEditWorkflow?: (skill: SkillSummary) => void
  onRefine?: (skill: SkillSummary) => void
  onTest?: (skill: SkillSummary) => void
}

export default function SkillListRow({
  skill,
  isLocked,
  onContinue,
  onDelete,
  onDownload,
  onEdit,
  onEditWorkflow,
  onRefine,
  onTest,
}: SkillListRowProps) {
  const isMarketplace = skill.skill_source === 'marketplace'
  const canDownload = isMarketplace || isWorkflowComplete(skill)
  const statusLabel = getStatusLabel(skill)
  const isComplete = statusLabel === "Completed"

  const row = (
    <div
      role="button"
      tabIndex={isLocked ? -1 : 0}
      className={cn(
        "grid items-center gap-x-4 rounded-md border px-4 py-2.5 transition-colors",
        LIST_ROW_GRID,
        isLocked
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:bg-accent/50",
      )}
      onClick={() => !isLocked && onContinue(skill)}
      onKeyDown={(e) => {
        if (!isLocked && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          onContinue(skill)
        }
      }}
    >
      {/* Col 1: Name + Type subtitle */}
      <div className={cn("min-w-0", isLocked && "flex items-center gap-1.5")}>
        {isLocked && <Lock className="size-3.5 shrink-0 text-muted-foreground" />}
        <div className="truncate text-sm font-medium">{skill.name}</div>
        <div className="hidden sm:block truncate text-xs text-muted-foreground">
          {skill.skill_type ? (SKILL_TYPE_LABELS[skill.skill_type as SkillType] || skill.skill_type) : ""}
        </div>
      </div>

      {/* Col 2: Source */}
      <div className="hidden sm:block">
        <SkillSourceBadge skillSource={skill.skill_source} />
      </div>

      {/* Col 3: Status */}
      <div className="hidden sm:block">
        {isComplete ? (
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0">
            Completed
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {statusLabel}
          </Badge>
        )}
      </div>

      {/* Mobile: status text */}
      <div className="sm:hidden text-xs text-muted-foreground">
        {statusLabel}
      </div>

      {/* Col 4: Actions */}
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="flex shrink-0 items-center gap-0.5 justify-self-end" onClick={(e) => e.stopPropagation()}>
        {skill.skill_source === 'skill-builder' && (
          <IconAction
            icon={<Pencil className="size-3" />}
            label="Edit workflow"
            tooltip="Edit workflow"
            onClick={() => onEditWorkflow?.(skill)}
          />
        )}
        {canDownload && onRefine && (
          <IconAction
            icon={<MessageSquare className="size-3" />}
            label="Refine skill"
            tooltip="Refine"
            onClick={() => onRefine(skill)}
          />
        )}
        {canDownload && (
          <IconAction
            icon={<FlaskConical className="size-3" />}
            label="Test skill"
            tooltip="Test"
            onClick={() => onTest?.(skill)}
          />
        )}
        {canDownload && onDownload && (
          <IconAction
            icon={<Download className="size-3" />}
            label="Download skill"
            tooltip="Download .skill"
            onClick={() => onDownload(skill)}
          />
        )}
        <IconAction
          icon={<Trash2 className="size-3" />}
          label="Delete skill"
          tooltip="Delete"
          className="hover:text-destructive"
          onClick={() => onDelete(skill)}
        />

        {skill.skill_source === 'skill-builder' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="text-muted-foreground"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit?.(skill)}>
                <SquarePen className="size-4" />
                Edit details
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  )

  if (isLocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{row}</TooltipTrigger>
          <TooltipContent>
            <p>This skill is being edited in another window</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return <TooltipProvider>{row}</TooltipProvider>
}
