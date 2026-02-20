import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  TooltipProvider,
} from "@/components/ui/tooltip"
import {
  Download,
  Lock,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  SquarePen,
  Trash2,
  Upload,
} from "lucide-react"
import type { SkillSummary, SkillType } from "@/lib/types"
import { SKILL_TYPE_LABELS, SKILL_TYPE_COLORS } from "@/lib/types"
import {
  IconAction,
  isWorkflowComplete,
  parseStepProgress,
  getPushDisabledReason,
} from "@/components/skill-card"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface SkillListRowProps {
  skill: SkillSummary
  isLocked?: boolean
  onContinue: (skill: SkillSummary) => void
  onDelete: (skill: SkillSummary) => void
  onDownload?: (skill: SkillSummary) => void
  onEdit?: (skill: SkillSummary) => void
  onEditWorkflow?: (skill: SkillSummary) => void
  onRefine?: (skill: SkillSummary) => void
  onPushToRemote?: (skill: SkillSummary) => void
  remoteConfigured?: boolean
  isGitHubLoggedIn?: boolean
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
  onPushToRemote,
  remoteConfigured,
  isGitHubLoggedIn,
}: SkillListRowProps) {
  const progress = parseStepProgress(skill.current_step, skill.status)
  const canDownload = isWorkflowComplete(skill)
  const pushDisabledReason = getPushDisabledReason(isGitHubLoggedIn, remoteConfigured)

  const row = (
    <div
      role="button"
      tabIndex={isLocked ? -1 : 0}
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
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
      {isLocked && <Lock className="size-3.5 shrink-0 text-muted-foreground" />}
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {skill.name}
      </span>

      {skill.domain && (
        <Badge variant="outline" className="hidden shrink-0 text-xs sm:inline-flex max-w-[120px]">
          <span className="truncate">{skill.domain}</span>
        </Badge>
      )}

      {skill.skill_type && (
        <Badge className={cn("hidden shrink-0 text-xs sm:inline-flex max-w-[120px]", SKILL_TYPE_COLORS[skill.skill_type as SkillType])}>
          <span className="truncate">
            {SKILL_TYPE_LABELS[skill.skill_type as SkillType] || skill.skill_type}
          </span>
        </Badge>
      )}

      <div className="flex shrink-0 items-center gap-1">
        <Progress value={progress} className="w-20" />
        <span className="w-8 text-right text-xs text-muted-foreground">{progress}%</span>
      </div>

      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div className="flex shrink-0 items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        <TooltipProvider>
          <IconAction
            icon={<Pencil className="size-3" />}
            label="Edit workflow"
            tooltip="Edit workflow"
            onClick={() => onEditWorkflow?.(skill)}
          />
          {canDownload && onRefine && (
            <IconAction
              icon={<MessageSquare className="size-3" />}
              label="Refine skill"
              tooltip="Refine"
              onClick={() => onRefine(skill)}
            />
          )}
          {canDownload && onPushToRemote && (
            <IconAction
              icon={<Upload className="size-3" />}
              label="Push to remote"
              tooltip={pushDisabledReason ?? "Push to remote"}
              disabled={!remoteConfigured || !isGitHubLoggedIn}
              onClick={() => remoteConfigured && isGitHubLoggedIn && onPushToRemote(skill)}
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
        </TooltipProvider>

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

  return row
}
