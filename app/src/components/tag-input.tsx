import { useState, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"

interface TagInputProps {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  disabled?: boolean
  placeholder?: string
}

function normalizeTag(tag: string): string {
  return tag.trim().toLowerCase()
}

export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  disabled = false,
  placeholder = "Add tag...",
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("")
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag])
    }
    setInputValue("")
    setShowSuggestions(false)
  }

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      if (inputValue.trim()) {
        addTag(inputValue)
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    // If user types a comma, treat text before it as a tag
    if (value.includes(",")) {
      const parts = value.split(",")
      for (const part of parts.slice(0, -1)) {
        if (part.trim()) addTag(part)
      }
      setInputValue(parts[parts.length - 1])
    } else {
      setInputValue(value)
    }
    setShowSuggestions(true)
  }

  const filteredSuggestions = suggestions.filter(
    (s) =>
      !tags.includes(s) &&
      s.includes(normalizeTag(inputValue)) &&
      inputValue.trim().length > 0
  )

  return (
    <div className="relative">
      <div
        className="border-input flex min-h-9 flex-wrap items-center gap-1 rounded-md border px-2 py-1 focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  removeTag(tag)
                }}
                className="hover:text-destructive ml-0.5"
                aria-label={`Remove ${tag}`}
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="min-w-[80px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => {
            // Delay to allow suggestion click
            setTimeout(() => setShowSuggestions(false), 150)
          }}
          disabled={disabled}
          placeholder={tags.length === 0 ? placeholder : ""}
          aria-label="Tag input"
        />
      </div>
      {showSuggestions && filteredSuggestions.length > 0 && (
        <div className="border-border bg-popover absolute z-10 mt-1 w-full rounded-md border py-1 shadow-md">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              className="hover:bg-accent w-full px-3 py-1.5 text-left text-sm"
              onMouseDown={(e) => {
                e.preventDefault()
                addTag(s)
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
