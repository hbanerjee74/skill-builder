import { query } from "@anthropic-ai/claude-agent-sdk";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface SidecarConfig {
  prompt: string;
  model?: string;
  agentName?: string;
  apiKey: string;
  cwd: string;
  allowedTools?: string[];
  maxTurns?: number;
  permissionMode?: string;
  sessionId?: string;
  betas?: string[];
  pathToClaudeCodeExecutable?: string;
}

/**
 * Build the SDK query options from a SidecarConfig.
 *
 * Agent / model resolution:
 *  - agentName only  → agent + settingSources (front-matter model used)
 *  - model only      → model
 *  - both            → agent + settingSources + model (model overrides front-matter)
 */
export function buildQueryOptions(config: SidecarConfig) {
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

let aborted = false;
const abortController = new AbortController();

function handleShutdown() {
  aborted = true;
  abortController.abort();
  // Force exit after 3s if SDK doesn't respond to abort
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on("SIGTERM", handleShutdown);
process.on("SIGINT", handleShutdown);

async function main() {
  // Config is passed as a CLI argument (JSON string)
  const configArg = process.argv[2];
  if (!configArg) {
    process.stdout.write(
      JSON.stringify({ type: "error", error: "Missing config argument" }) + "\n"
    );
    process.exit(1);
  }

  let config: SidecarConfig;
  try {
    config = JSON.parse(configArg) as SidecarConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({ type: "error", error: `Failed to parse config: ${message}` }) + "\n"
    );
    process.exit(1);
  }

  try {
    if (config.apiKey) {
      process.env.ANTHROPIC_API_KEY = config.apiKey;
    }

    const conversation = query({
      prompt: config.prompt,
      options: {
        ...buildQueryOptions(config),
        abortController,
      },
    });

    for await (const message of conversation) {
      if (aborted) break;
      process.stdout.write(JSON.stringify(message) + "\n");
    }

    process.exit(0);
  } catch (err) {
    if (aborted) {
      process.stderr.write("Agent cancelled via signal\n");
      process.exit(0);
    }
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({ type: "error", error: message }) + "\n"
    );
    process.exit(1);
  }
}

// Only run when executed directly (not when imported for testing).
// In ESM we check if the resolved argv[1] matches this module's file URL.
const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main();
}
