import { useRefineStore } from "@/stores/refine-store";
import { ChatMessageList } from "./chat-message-list";
import { ChatInputBar } from "./chat-input-bar";

interface ChatPanelProps {
  onSend: (text: string, targetFiles?: string[]) => void;
  isRunning: boolean;
  hasSkill: boolean;
  availableFiles: string[];
}

export function ChatPanel({ onSend, isRunning, hasSkill, availableFiles }: ChatPanelProps) {
  const messages = useRefineStore((s) => s.messages);

  if (!hasSkill) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a skill to start refining
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <ChatMessageList messages={messages} />
      <ChatInputBar
        onSend={onSend}
        isRunning={isRunning}
        disabled={!hasSkill}
        availableFiles={availableFiles}
      />
    </div>
  );
}
