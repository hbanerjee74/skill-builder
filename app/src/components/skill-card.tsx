import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Download, Lock, MessageSquare, Pencil, Trash2, Upload } from "lucide-react"
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
  const canDownload = isWorkflowComplete(skill)

  const pushDisabledReason = !isGitHubLoggedIn
    ? "Sign in with GitHub in Settings"
    : !remoteConfigured
      ? "Configure remote repository in Settings"
      : undefined

  const cardContent = (
    <Card
      className={cn(
        "flex flex-col min-w-0 overflow-hidden transition-colors",
        isLocked ? "opacity-50 pointer-events-none" : "cursor-pointer hover:border-primary/50",
      )}
      onClick={() => !isLocked && onContinue(skill)}
    >
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
      <CardFooter className="mt-auto flex flex-col gap-2">
        <div className="flex w-full items-center gap-2">
          <Progress value={progress} className="flex-1" />
          <span className="shrink-0 text-xs text-muted-foreground">{progress}%</span>
        </div>
        {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
        <div className="flex w-full items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="text-muted-foreground"
                  aria-label="Edit skill"
                  onClick={() => onEdit?.(skill)}
                >
                  <Pencil className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
            {canDownload && onRefine && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    aria-label="Refine skill"
                    onClick={() => onRefine(skill)}
                  >
                    <MessageSquare className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Refine</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            {canDownload && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    disabled={!remoteConfigured || !isGitHubLoggedIn}
                    aria-label="Push to remote"
                    onClick={() => remoteConfigured && isGitHubLoggedIn && onPushToRemote?.(skill)}
                  >
                    <Upload className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{pushDisabledReason ?? "Push to remote"}</TooltipContent>
              </Tooltip>
            )}
            {canDownload && onDownload && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="text-muted-foreground"
                    aria-label="Download skill"
                    onClick={() => onDownload(skill)}
                  >
                    <Download className="size-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download .skill</TooltipContent>
              </Tooltip>
            )}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                className="ml-auto text-muted-foreground hover:text-destructive"
                aria-label="Delete skill"
                onClick={() => onDelete(skill)}
              >
                <Trash2 className="size-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
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
    <TooltipProvider>
      {cardContent}
    </TooltipProvider>
  )
}
