import type { SidecarConfig } from "./config.js";

/**
 * Build the options object to pass to the SDK query() function.
 */
export function buildQueryOptions(config: SidecarConfig, abortController: AbortController) {
  return {
    ...(config.agentName
      ? {
          agent: config.agentName,
          settingSources: ['project' as const],
        }
      : { model: config.model }),
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
