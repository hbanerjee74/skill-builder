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
 * Parse the sidecar config from a CLI argument array (process.argv-like).
 * Expects argv[2] to be a JSON-encoded SidecarConfig string.
 */
export function parseConfig(argv: string[]): SidecarConfig {
  const configArg = argv[2];
  if (!configArg) {
    throw new Error("Missing config argument");
  }

  try {
    return JSON.parse(configArg) as SidecarConfig;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to parse config: ${message}`);
  }
}
