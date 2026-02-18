import { useCallback, useRef, useState } from "react";
import { RefreshCw, SendHorizontal, ShieldCheck, X } from "lucide-react";
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
import type { RefineCommand } from "@/stores/refine-store";

const COMMANDS: { value: RefineCommand; label: string; icon: typeof RefreshCw }[] = [
  { value: "rewrite", label: "Rewrite skill", icon: RefreshCw },
  { value: "validate", label: "Validate skill", icon: ShieldCheck },
];

interface ChatInputBarProps {
  onSend: (text: string, targetFiles?: string[], command?: RefineCommand) => void;
  isRunning: boolean;
  availableFiles: string[];
}

export function ChatInputBar({ onSend, isRunning, availableFiles }: ChatInputBarProps) {
  const [text, setText] = useState("");
  const [targetFiles, setTargetFiles] = useState<string[]>([]);
  const [activeCommand, setActiveCommand] = useState<RefineCommand | undefined>();
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [showCommandPicker, setShowCommandPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed && !activeCommand) return;
    onSend(
      trimmed,
      targetFiles.length > 0 ? targetFiles : undefined,
      activeCommand,
    );
    setText("");
    setTargetFiles([]);
    setActiveCommand(undefined);
  }, [text, targetFiles, activeCommand, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // If a picker is open, Escape closes it — let Enter also close it
      if (e.key === "Enter" && !e.shiftKey && (showFilePicker || showCommandPicker)) {
        e.preventDefault();
        setShowFilePicker(false);
        setShowCommandPicker(false);
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      if (e.key === "@" && availableFiles.length > 0) {
        setShowFilePicker(true);
      }
      if (e.key === "/" && !activeCommand) {
        setShowCommandPicker(true);
      }
    },
    [handleSend, availableFiles.length, activeCommand, showFilePicker, showCommandPicker],
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    // Close file picker if user deletes the @ trigger
    if (!val.includes("@")) {
      setShowFilePicker(false);
    }
    // Close command picker if user deletes the / trigger
    if (!val.includes("/")) {
      setShowCommandPicker(false);
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

  const selectCommand = useCallback((command: RefineCommand) => {
    setActiveCommand(command);
    // Remove the / trigger from text
    setText((prev) => {
      const slashIdx = prev.lastIndexOf("/");
      if (slashIdx >= 0) {
        return prev.slice(0, slashIdx) + prev.slice(slashIdx + 1);
      }
      return prev;
    });
    setShowCommandPicker(false);
    textareaRef.current?.focus();
  }, []);

  const removeFile = useCallback((filename: string) => {
    setTargetFiles((prev) => prev.filter((f) => f !== filename));
  }, []);

  const removeCommand = useCallback(() => {
    setActiveCommand(undefined);
  }, []);

  const hasBadges = targetFiles.length > 0 || activeCommand;

  return (
    <div className="flex flex-col gap-2 border-t p-3">
      {hasBadges && (
        <div className="flex flex-wrap gap-1">
          {activeCommand && (
            <Badge data-testid="refine-command-badge" variant="default" className="gap-1 text-xs">
              /{activeCommand}
              <button
                type="button"
                onClick={removeCommand}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </Badge>
          )}
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
        <Popover
          open={showFilePicker || showCommandPicker}
          onOpenChange={(open) => {
            if (!open) {
              setShowFilePicker(false);
              setShowCommandPicker(false);
            }
          }}
        >
          <PopoverAnchor asChild>
            <Textarea
              ref={textareaRef}
              data-testid="refine-chat-input"
              value={text}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              placeholder={activeCommand ? `Describe what to ${activeCommand}...` : "Describe what to change..."}
              disabled={isRunning}
              className="min-h-10 resize-none"
              rows={1}
            />
          </PopoverAnchor>
          <PopoverContent className="w-56 p-0" align="start" side="top">
            <Command>
              <CommandList>
                {showCommandPicker && (
                  <CommandGroup heading="Commands">
                    {COMMANDS.map((cmd) => (
                      <CommandItem
                        key={cmd.value}
                        value={cmd.value}
                        onSelect={() => selectCommand(cmd.value)}
                      >
                        <cmd.icon className="mr-2 size-3.5" />
                        {cmd.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {showFilePicker && (
                  <CommandGroup heading="Files">
                    <CommandEmpty>No files available</CommandEmpty>
                    {availableFiles.map((f) => (
                      <CommandItem key={f} value={f} onSelect={() => selectFile(f)}>
                        {f}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        <Button
          data-testid="refine-send-button"
          size="icon"
          onClick={handleSend}
          disabled={isRunning || (!text.trim() && !activeCommand)}
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
    </div>
  );
}
