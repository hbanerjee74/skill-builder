import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSettingsStore } from "@/stores/settings-store";
import { useRefineStore } from "@/stores/refine-store";
import type { RefineCommand, RefineMessage, SkillFile } from "@/stores/refine-store";
import { useAgentStore } from "@/stores/agent-store";
import {
  listRefinableSkills,
  getSkillContentForRefine,
  startAgent,
} from "@/lib/tauri";
import type { SkillSummary } from "@/lib/types";
import { ResizableSplitPane } from "@/components/refine/resizable-split-pane";
import { SkillPicker } from "@/components/refine/skill-picker";
import { ChatPanel } from "@/components/refine/chat-panel";
import { PreviewPanel } from "@/components/refine/preview-panel";

// Ensure agent-stream listeners are registered
import "@/hooks/use-agent-stream";

/** Map a refine command to the corresponding sidecar agent name. */
function resolveAgentName(command?: RefineCommand): string {
  if (command === "rewrite") return "rewrite-skill";
  if (command === "validate") return "validate-skill";
  return "refine-skill";
}

/** Build the prompt sent to the sidecar agent. */
function buildPrompt(
  text: string,
  conversationContext: string,
  fileConstraint: string,
  command?: RefineCommand,
): string {
  if (command === "rewrite") {
    return `You are rewriting a completed skill. The skill files are in the current working directory.

Read ALL existing skill files (SKILL.md and everything in references/), then rewrite them to improve structure, clarity, and adherence to Claude skill best practices.

${text ? `Additional instructions: ${text}` : ""}${fileConstraint}

Focus on: clear progressive disclosure, actionable guidance, proper frontmatter, well-organized reference files. Preserve domain expertise but improve presentation.

Briefly describe what you rewrote and why.`;
  }

  if (command === "validate") {
    return `You are validating a completed skill. The skill files are in the current working directory.

Read ALL existing skill files (SKILL.md and everything in references/), then evaluate:
- Coverage: Do files address all aspects from the skill description?
- Structure: Is progressive disclosure used well? Sections logically organized?
- Actionability: Are instructions specific enough to follow?
- Quality: Are code examples correct? References properly linked?

Fix any issues you find. Provide a brief validation report: what you checked, what you fixed.

${text ? `Additional instructions: ${text}` : ""}${fileConstraint}`;
  }

  // Default refine prompt
  return `You are refining a skill. The skill files are in the current working directory.

${conversationContext ? `Previous conversation:\n${conversationContext}\n\n` : ""}Current request: ${text}${fileConstraint}

Read the relevant files, make the requested changes, and briefly describe what you changed.`;
}

/**
 * Build a text summary of previous chat messages for inclusion in the agent prompt.
 * Excludes the trailing agent turn (the one about to be sent).
 */
function buildConversationContext(
  messages: RefineMessage[],
  runs: Record<string, { messages: { type: string; content?: string }[] }>,
): string {
  return messages
    .slice(0, -1)
    .map((msg) => {
      if (msg.role === "user") {
        return `User: ${msg.userText}`;
      }
      if (msg.role === "agent" && msg.agentId) {
        const agentRun = runs[msg.agentId];
        if (agentRun) {
          const lastText = agentRun.messages
            .filter((m) => m.type === "assistant" && m.content)
            .map((m) => m.content)
            .pop();
          return lastText ? `Assistant: ${lastText}` : null;
        }
      }
      return null;
    })
    .filter(Boolean)
    .join("\n\n");
}

export default function RefinePage() {
  const { skill: skillParam } = useSearch({ from: "/refine" });

  const workspacePath = useSettingsStore((s) => s.workspacePath);
  const skillsPath = useSettingsStore((s) => s.skillsPath);
  const preferredModel = useSettingsStore((s) => s.preferredModel);

  const selectedSkill = useRefineStore((s) => s.selectedSkill);
  const refinableSkills = useRefineStore((s) => s.refinableSkills);
  const isLoadingSkills = useRefineStore((s) => s.isLoadingSkills);
  const skillFiles = useRefineStore((s) => s.skillFiles);
  const isRunning = useRefineStore((s) => s.isRunning);
  const activeAgentId = useRefineStore((s) => s.activeAgentId);

  // Subscribe only to the active run's status — NOT the entire runs object.
  // Subscribing to `s.runs` causes the whole page to re-render on every agent message flush.
  const activeRunStatus = useAgentStore((s) =>
    activeAgentId ? s.runs[activeAgentId]?.status : undefined,
  );

  const [pendingSwitchSkill, setPendingSwitchSkill] = useState<SkillSummary | null>(null);
  const autoSelectedRef = useRef(false);

  // Resolve the effective skills path (skillsPath for completed skills, fallback to workspacePath)
  const effectiveSkillsPath = skillsPath ?? workspacePath;

  // Available filenames for @file autocomplete
  const availableFiles = useMemo(
    () => skillFiles.map((f) => f.filename),
    [skillFiles],
  );

  // --- Load refinable skills on mount ---
  useEffect(() => {
    if (!workspacePath) return;

    const store = useRefineStore.getState();
    store.setLoadingSkills(true);

    listRefinableSkills(workspacePath)
      .then((skills) => {
        store.setRefinableSkills(skills);
        store.setLoadingSkills(false);
      })
      .catch((err) => {
        console.error("[refine] Failed to load skills:", err);
        store.setLoadingSkills(false);
        toast.error("Failed to load skills", { duration: Infinity });
      });
  }, [workspacePath]);

  // --- Auto-select skill from search param ---
  useEffect(() => {
    if (!skillParam || autoSelectedRef.current || refinableSkills.length === 0) return;

    const match = refinableSkills.find((s) => s.name === skillParam);
    if (match) {
      autoSelectedRef.current = true;
      handleSelectSkill(match);
    }
  }, [skillParam, refinableSkills]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Watch agent completion (only re-runs when status changes, not every message) ---
  useEffect(() => {
    if (!activeAgentId || !activeRunStatus) return;

    const isTerminal = ["completed", "error", "shutdown"].includes(activeRunStatus);
    if (!isTerminal) return;

    console.log("[refine] agent %s finished: status=%s", activeAgentId, activeRunStatus);

    if (activeRunStatus === "error" || activeRunStatus === "shutdown") {
      toast.error("Agent failed — check the chat for details", { duration: Infinity });
    }

    // Re-read skill files to capture any changes the agent made
    const store = useRefineStore.getState();
    if (effectiveSkillsPath && selectedSkill) {
      loadSkillFiles(effectiveSkillsPath, selectedSkill.name).then((files) => {
        if (files) store.updateSkillFiles(files);
      });
    }

    store.setRunning(false);
    store.setActiveAgentId(null);
  }, [activeAgentId, activeRunStatus, effectiveSkillsPath, selectedSkill]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      const store = useRefineStore.getState();
      if (store.isRunning && store.activeAgentId) {
        store.setRunning(false);
        store.setActiveAgentId(null);
      }
    };
  }, []);

  // --- Load skill files from disk ---
  async function loadSkillFiles(basePath: string, skillName: string): Promise<SkillFile[] | null> {
    try {
      const contents = await getSkillContentForRefine(skillName, basePath);
      return contents
        .map((c): SkillFile => ({ filename: c.path, content: c.content }))
        .sort((a, b) => {
          // Ensure SKILL.md is first
          if (a.filename === "SKILL.md") return -1;
          if (b.filename === "SKILL.md") return 1;
          return a.filename.localeCompare(b.filename);
        });
    } catch (err) {
      console.error("[refine] Failed to load skill files:", err);
      return null;
    }
  }

  // --- Select a skill ---
  const handleSelectSkill = useCallback(
    async (skill: SkillSummary) => {
      if (isRunning) {
        setPendingSwitchSkill(skill);
        return;
      }

      console.log("[refine] selectSkill: %s", skill.name);
      const store = useRefineStore.getState();
      store.selectSkill(skill);
      store.setLoadingFiles(true);

      if (effectiveSkillsPath) {
        const files = await loadSkillFiles(effectiveSkillsPath, skill.name);
        if (files) {
          store.setSkillFiles(files);
          if (files.length > 0) {
            store.setActiveFileTab(files[0].filename);
          }
        } else {
          store.setLoadingFiles(false);
          toast.error("Could not load skill files");
        }
      } else {
        store.setLoadingFiles(false);
      }
    },
    [isRunning, effectiveSkillsPath],
  );

  // --- Confirm switch skill while running ---
  const handleConfirmSwitch = useCallback(() => {
    if (!pendingSwitchSkill) return;
    const store = useRefineStore.getState();
    store.setRunning(false);
    store.setActiveAgentId(null);
    setPendingSwitchSkill(null);
    handleSelectSkill(pendingSwitchSkill);
  }, [pendingSwitchSkill, handleSelectSkill]);

  // --- Send a message ---
  const handleSend = useCallback(
    async (text: string, targetFiles?: string[], command?: RefineCommand) => {
      if (!selectedSkill || !effectiveSkillsPath) return;

      console.log("[refine] send: skill=%s command=%s files=%s", selectedSkill.name, command ?? "refine", targetFiles?.join(",") ?? "all");

      const store = useRefineStore.getState();

      // Snapshot baseline for diff
      store.snapshotBaseline();

      // Add user message
      store.addUserMessage(text, targetFiles, command);

      // Generate agent ID and session ID
      const agentId = crypto.randomUUID();
      let currentSessionId = store.sessionId;
      if (!currentSessionId) {
        currentSessionId = crypto.randomUUID();
        useRefineStore.setState({ sessionId: currentSessionId });
      }

      // Register run in agent store (without setting global activeAgentId)
      useAgentStore.getState().registerRun(agentId, preferredModel ?? "sonnet");

      // Add agent turn to chat
      store.addAgentTurn(agentId);
      store.setActiveAgentId(agentId);
      store.setRunning(true);

      // Build prompt
      const fileConstraint =
        targetFiles && targetFiles.length > 0
          ? `\n\nIMPORTANT: Only edit these files: ${targetFiles.join(", ")}. Do not modify any other files.`
          : "";

      // Build conversation context from previous messages (read fresh from stores)
      const conversationContext = buildConversationContext(
        useRefineStore.getState().messages,
        useAgentStore.getState().runs,
      );

      const prompt = buildPrompt(text, conversationContext, fileConstraint, command);
      const agentName = resolveAgentName(command);
      const stepLabel = command ?? "refine";
      const cwd = `${effectiveSkillsPath}/${selectedSkill.name}`;

      try {
        await startAgent(
          agentId,
          prompt,
          preferredModel ?? "sonnet",
          cwd,
          undefined, // allowedTools
          undefined, // maxTurns
          currentSessionId,
          selectedSkill.name,
          stepLabel,
          agentName,
        );
      } catch (err) {
        console.error("[refine] Failed to start agent:", err);
        store.setRunning(false);
        store.setActiveAgentId(null);
        toast.error("Failed to start agent");
      }
    },
    [selectedSkill, effectiveSkillsPath, preferredModel],
  );

  return (
    <div className="-m-6 flex h-[calc(100%+3rem)] flex-col">
      {/* Top bar with skill picker */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <SkillPicker
          skills={refinableSkills}
          selected={selectedSkill}
          isLoading={isLoadingSkills}
          onSelect={handleSelectSkill}
        />
      </div>

      {/* Main split pane */}
      <div className="min-h-0 flex-1">
        <ResizableSplitPane
          left={
            <ChatPanel
              onSend={handleSend}
              isRunning={isRunning}
              hasSkill={!!selectedSkill}
              availableFiles={availableFiles}
            />
          }
          right={<PreviewPanel />}
        />
      </div>

      {/* Confirm switch skill dialog */}
      <Dialog
        open={!!pendingSwitchSkill}
        onOpenChange={(open) => !open && setPendingSwitchSkill(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Switch skill?</DialogTitle>
            <DialogDescription>
              An agent is currently running. Switching skills will stop it and
              clear the chat history.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingSwitchSkill(null)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmSwitch}>Switch</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
