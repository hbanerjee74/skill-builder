import type { SidecarConfig } from "./config.js";

/**
 * Build the options object to pass to the SDK query() function.
 *
 * Agent / model resolution:
 *  - agentName only  → agent + settingSources (front-matter model used)
 *  - model only      → model
 *  - both            → agent + settingSources + model (model overrides front-matter)
 */
export function buildQueryOptions(config: SidecarConfig, abortController: AbortController) {
  // --- agent / model resolution ---
  const agentFields = config.agentName
    ? { agent: config.agentName, settingSources: ['project' as const] }
    : {};

  // When model is set, always pass it — whether it's the sole identifier
  // (model-only) or overriding the agent's front-matter model (both).
  const modelField = config.model ? { model: config.model } : {};

  return {
    ...agentFields,
    ...modelField,
    cwd: config.cwd,
    allowedTools: config.allowedTools,
    maxTurns: config.maxTurns ?? 50,
    permissionMode: (config.permissionMode || "bypassPermissions") as
      | "default"
      | "acceptEdits"
      | "bypassPermissions"
      | "plan",
    abortController,
    // Use the same Node binary that's running this sidecar process,
    // so the SDK spawns cli.js with a compatible Node version.
    executable: process.execPath,
    ...(config.pathToClaudeCodeExecutable
      ? { pathToClaudeCodeExecutable: config.pathToClaudeCodeExecutable }
      : {}),
    ...(config.sessionId ? { resume: config.sessionId } : {}),
    ...(config.betas ? { betas: config.betas } : {}),
  };
}
