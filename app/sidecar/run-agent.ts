import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SidecarConfig } from "./config.js";
import { buildQueryOptions } from "./options.js";
import { createAbortState } from "./shutdown.js";

/**
 * Run a single agent request using the SDK.
 *
 * Streams each SDK message to the provided `onMessage` callback.
 * The callback receives raw SDK message objects (the caller is responsible
 * for any wrapping, e.g., adding `request_id`).
 *
 * @param config     The sidecar config for this request
 * @param onMessage  Called for each message from the SDK conversation
 */
export async function runAgentRequest(
  config: SidecarConfig,
  onMessage: (message: Record<string, unknown>) => void,
): Promise<void> {
  if (config.apiKey) {
    process.env.ANTHROPIC_API_KEY = config.apiKey;
  }

  const state = createAbortState();
  const options = buildQueryOptions(config, state.abortController);

  const conversation = query({
    prompt: config.prompt,
    options,
  });

  for await (const message of conversation) {
    if (state.aborted) break;
    onMessage(message as Record<string, unknown>);
  }
}
