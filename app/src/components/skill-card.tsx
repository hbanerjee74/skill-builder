import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Progress } from "@/components/ui/progress"
import { Download, Lock, MessageSquare, Play, Tag, Trash2, Upload } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { SkillSummary, SkillType } from "@/lib/types"
import { SKILL_TYPE_LABELS, SKILL_TYPE_COLORS } from "@/lib/types"
import { cn } from "@/lib/utils"

interface SkillCardProps {
  skill: SkillSummary
  isLocked?: boolean
  onContinue: (skill: SkillSummary) => void
  onDelete: (skill: SkillSummary) => void
  onDownload?: (skill: SkillSummary) => void
  onEdit?: (skill: SkillSummary) => void
  onRefine?: (skill: SkillSummary) => void
  onPushToRemote?: (skill: SkillSummary) => void
  remoteConfigured?: boolean
  isGitHubLoggedIn?: boolean
}

function parseStepProgress(currentStep: string | null, status: string | null): number {
  if (status === "completed") return 100
  if (!currentStep) return 0
  const match = currentStep.match(/step\s*(\d+)/i)
  if (match) {
    const stepIndex = Number(match[1])
    // Steps are 0-6 (7 total). Use (stepIndex + 1) / 7 so step 6 = 100%.
    return Math.min(Math.round(((stepIndex + 1) / 7) * 100), 100)
  }
  if (/completed/i.test(currentStep)) return 100
  if (/initialization/i.test(currentStep)) return 0
  return 0
}

/**
 * Returns true only when all 8 workflow steps are complete.
 * Download should be gated on full completion -- partial progress
 * (e.g. past the Build step) is not enough.
 *
 * A skill's workflow is 100% complete when:
 * - status is "completed", OR
 * - current_step text matches "completed", OR
 * - current_step parses to step 6 (the last step, 0-indexed)
 */
export function isWorkflowComplete(skill: SkillSummary): boolean {
  if (skill.status === "completed") return true
  if (!skill.current_step) return false
  if (/completed/i.test(skill.current_step)) return true
  const match = skill.current_step.match(/step\s*(\d+)/i)
  if (match) {
    return Number(match[1]) >= 6
  }
  return false
}

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return ""
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / 60000)

    if (diffMinutes < 1) return "just now"
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return ""
  }
}


export default function SkillCard({
  skill,
  isLocked,
  onContinue,
  onDelete,
  onDownload,
  onEdit,
  onRefine,
  onPushToRemote,
  remoteConfigured,
  isGitHubLoggedIn,
}: SkillCardProps) {
  const progress = parseStepProgress(skill.current_step, skill.status)
  const relativeTime = formatRelativeTime(skill.last_modified)
  const canDownload = isWorkflowComplete(skill)

  const cardContent = (
    <Card className={cn("flex flex-col min-w-0 overflow-hidden", isLocked && "opacity-50 pointer-events-none")}>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 truncate text-base">
            {skill.name}
          </CardTitle>
          {isLocked && <Lock className="size-3.5 text-muted-foreground shrink-0" />}
        </div>
        {skill.domain && (
          <Badge variant="outline" className="max-w-full min-w-0 text-xs">
            <span className="truncate">{skill.domain}</span>
          </Badge>
        )}
        {skill.skill_type && (
          <Badge className={cn("w-fit max-w-full text-xs", SKILL_TYPE_COLORS[skill.skill_type as SkillType])}>
            <span className="truncate">{SKILL_TYPE_LABELS[skill.skill_type as SkillType] || skill.skill_type}</span>
          </Badge>
        )}
        {skill.tags && skill.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {skill.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs max-w-[120px]">
                <span className="truncate">{tag}</span>
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="mt-auto flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate min-w-0">{skill.current_step || "Not started"}</span>
          <span className="shrink-0">{progress}%</span>
        </div>
        <Progress value={progress} />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <Button size="sm" onClick={() => onContinue(skill)}>
            <Play className="size-3" />
            Continue
          </Button>
          {canDownload && onRefine && (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onRefine(skill);
              }}
            >
              <MessageSquare className="size-3" />
              Refine
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete skill"
            onClick={() => onDelete(skill)}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {skill.author_login && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1">
                    {skill.author_avatar ? (
                      <img
                        src={skill.author_avatar}
                        alt={skill.author_login}
                        className="size-4 rounded-full"
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground max-w-[80px] truncate">{skill.author_login}</span>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{skill.author_login}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {relativeTime && (
            <span className="text-xs text-muted-foreground">{relativeTime}</span>
          )}
        </div>
      </CardFooter>
    </Card>
  )

  if (isLocked) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="cursor-not-allowed">
              {cardContent}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>This skill is being edited in another window</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {cardContent}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={() => onEdit?.(skill)}>
          <Tag className="size-4" />
          Edit
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!canDownload}
          onSelect={() => canDownload && onDownload?.(skill)}
        >
          <Download className="size-4" />
          <span className="flex flex-col">
            <span>Download .skill</span>
            {!canDownload && (
              <span className="text-xs text-muted-foreground">
                Complete all workflow steps to download
              </span>
            )}
          </span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          disabled={!canDownload || !remoteConfigured || !isGitHubLoggedIn}
          onSelect={() => canDownload && remoteConfigured && isGitHubLoggedIn && onPushToRemote?.(skill)}
        >
          <Upload className="size-4" />
          <span className="flex flex-col">
            <span>Push to remote</span>
            {!canDownload && (
              <span className="text-xs text-muted-foreground">
                Complete all workflow steps first
              </span>
            )}
            {canDownload && !isGitHubLoggedIn && (
              <span className="text-xs text-muted-foreground">
                Sign in with GitHub in Settings
              </span>
            )}
            {canDownload && isGitHubLoggedIn && !remoteConfigured && (
              <span className="text-xs text-muted-foreground">
                Configure remote repository in Settings
              </span>
            )}
          </span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
