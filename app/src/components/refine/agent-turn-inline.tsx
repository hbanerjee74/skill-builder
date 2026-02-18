import { Fragment, useMemo } from "react";
import { useAgentStore } from "@/stores/agent-store";
import { AgentStatusHeader } from "@/components/agent-status-header";
import {
  computeMessageGroups,
  computeToolCallGroups,
  spacingClasses,
  TurnMarker,
  ToolCallGroup,
  MessageItem,
} from "@/components/agent-output-panel";

interface AgentTurnInlineProps {
  agentId: string;
}

export function AgentTurnInline({ agentId }: AgentTurnInlineProps) {
  const run = useAgentStore((s) => s.runs[agentId]);

  const turnMap = useMemo(() => {
    if (!run) return new Map<number, number>();
    const map = new Map<number, number>();
    let turn = 0;
    for (let i = 0; i < run.messages.length; i++) {
      if (run.messages[i].type === "assistant") {
        turn++;
        map.set(i, turn);
      }
    }
    return map;
  }, [run?.messages]);

  const messageGroups = useMemo(
    () => (run ? computeMessageGroups(run.messages, turnMap) : []),
    [run?.messages, turnMap],
  );

  const toolCallGroupMap = useMemo(
    () => (run ? computeToolCallGroups(run.messages) : { groups: new Map(), memberOf: new Map() }),
    [run?.messages],
  );

  if (!run) return null;

  return (
    <div className="flex flex-col">
      <AgentStatusHeader agentId={agentId} />
      {run.messages.map((msg, i) => {
        const turn = turnMap.get(i) ?? 0;
        const spacing = spacingClasses[messageGroups[i]];

        // Skip group members (rendered by group leader)
        if (toolCallGroupMap.memberOf.has(i) && toolCallGroupMap.memberOf.get(i) !== i) {
          return null;
        }

        const groupIndices = toolCallGroupMap.groups.get(i);
        const content = groupIndices ? (
          <ToolCallGroup messages={groupIndices.map((idx) => run.messages[idx])} />
        ) : (
          <MessageItem message={msg} />
        );

        return (
          <Fragment key={`${msg.timestamp}-${i}`}>
            {turn > 0 && <TurnMarker turn={turn} />}
            <div className={spacing}>{content}</div>
          </Fragment>
        );
      })}
    </div>
  );
}
