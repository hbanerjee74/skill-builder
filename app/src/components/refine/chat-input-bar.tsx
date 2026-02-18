import { useCallback, useRef, useState } from "react";
import { SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ChatInputBarProps {
  onSend: (text: string, targetFiles?: string[]) => void;
  isRunning: boolean;
  availableFiles: string[];
}

export function ChatInputBar({ onSend, isRunning, availableFiles }: ChatInputBarProps) {
  const [text, setText] = useState("");
  const [targetFiles, setTargetFiles] = useState<string[]>([]);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, targetFiles.length > 0 ? targetFiles : undefined);
    setText("");
    setTargetFiles([]);
  }, [text, targetFiles, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "@" && availableFiles.length > 0) {
        setShowFilePicker(true);
      }
    },
    [handleSend, availableFiles.length],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    // Close file picker if user deletes the @ trigger
    if (!val.includes("@")) {
      setShowFilePicker(false);
    }
  }, []);

  const selectFile = useCallback((filename: string) => {
    setTargetFiles((prev) =>
      prev.includes(filename) ? prev : [...prev, filename],
    );
    setText((prev) => {
      const atIdx = prev.lastIndexOf("@");
      if (atIdx >= 0) {
        return prev.slice(0, atIdx) + `@${filename} `;
      }
      return prev + `@${filename} `;
    });
    setShowFilePicker(false);
    textareaRef.current?.focus();
  }, []);

  const removeFile = useCallback((filename: string) => {
    setTargetFiles((prev) => prev.filter((f) => f !== filename));
  }, []);

  return (
    <div className="flex flex-col gap-2 border-t p-3">
      {targetFiles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {targetFiles.map((f) => (
            <Badge key={f} variant="secondary" className="gap-1 text-xs">
              @{f}
              <button
                type="button"
                onClick={() => removeFile(f)}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2">
        <Popover open={showFilePicker} onOpenChange={setShowFilePicker}>
          <PopoverAnchor asChild>
            <Textarea
              ref={textareaRef}
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder="Describe what to change..."
              disabled={isRunning}
              className="min-h-10 resize-none"
              rows={1}
            />
          </PopoverAnchor>
          <PopoverContent className="w-56 p-0" align="start" side="top">
            <Command>
              <CommandList>
                <CommandEmpty>No files available</CommandEmpty>
                <CommandGroup>
                  {availableFiles.map((f) => (
                    <CommandItem key={f} value={f} onSelect={() => selectFile(f)}>
                      {f}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          size="icon"
          onClick={handleSend}
          disabled={isRunning || !text.trim()}
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
