import { useCallback, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

interface GhostFieldProps {
  suggestion: string | null
  value: string
  onChange: (value: string) => void
  onAccept?: (suggestion: string) => void
}

type GhostInputProps = GhostFieldProps &
  Omit<React.ComponentProps<"input">, "value" | "onChange">

type GhostTextareaProps = GhostFieldProps &
  Omit<React.ComponentProps<"textarea">, "value" | "onChange">

function shouldShowGhost(value: string, suggestion: string | null): boolean {
  return value === "" && suggestion != null && suggestion !== ""
}

export function GhostInput({
  suggestion,
  value,
  onChange,
  onAccept,
  className,
  ...inputProps
}: GhostInputProps) {
  const showGhost = shouldShowGhost(value, suggestion)
  const onKeyDownRef = useRef(inputProps.onKeyDown)
  onKeyDownRef.current = inputProps.onKeyDown

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && showGhost && suggestion) {
        e.preventDefault()
        onAccept?.(suggestion)
      }
      onKeyDownRef.current?.(e)
    },
    [showGhost, suggestion, onAccept],
  )

  return (
    <div className="relative">
      {showGhost && (
        <div className="absolute inset-0 px-3 py-2 text-sm text-muted-foreground/50 italic pointer-events-none truncate">
          {suggestion}
        </div>
      )}
      <Input
        {...inputProps}
        className={cn(showGhost && "placeholder:text-transparent", className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}

export function GhostTextarea({
  suggestion,
  value,
  onChange,
  onAccept,
  className,
  ...textareaProps
}: GhostTextareaProps) {
  const showGhost = shouldShowGhost(value, suggestion)
  const onKeyDownRef = useRef(textareaProps.onKeyDown)
  onKeyDownRef.current = textareaProps.onKeyDown

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab" && showGhost && suggestion) {
        e.preventDefault()
        onAccept?.(suggestion)
      }
      onKeyDownRef.current?.(e)
    },
    [showGhost, suggestion, onAccept],
  )

  return (
    <div className="relative">
      {showGhost && (
        <div className="absolute inset-0 px-3 py-2 text-sm text-muted-foreground/50 italic pointer-events-none whitespace-pre-wrap overflow-hidden">
          {suggestion}
        </div>
      )}
      <Textarea
        {...textareaProps}
        className={cn(showGhost && "placeholder:text-transparent", className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  )
}
