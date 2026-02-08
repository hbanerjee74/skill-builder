import { AgentOutputPanel } from "@/components/agent-output-panel";

interface ParallelAgentPanelProps {
  agentIdA: string;
  agentIdB: string;
}

export function ParallelAgentPanel({
  agentIdA,
  agentIdB,
}: ParallelAgentPanelProps) {
  return (
    <div className="flex flex-1 gap-4 overflow-hidden">
      <div className="flex flex-1 flex-col overflow-hidden">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Patterns Research
        </h3>
        <AgentOutputPanel agentId={agentIdA} />
      </div>
      <div className="flex flex-1 flex-col overflow-hidden">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Data Modeling Research
        </h3>
        <AgentOutputPanel agentId={agentIdB} />
      </div>
    </div>
  );
}
