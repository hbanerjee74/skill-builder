import { query } from "@anthropic-ai/claude-agent-sdk";
import { parseConfig } from "./config.js";
import { buildQueryOptions } from "./options.js";
import { createAbortState, handleShutdown } from "./shutdown.js";

const state = createAbortState();

process.on("SIGTERM", () => handleShutdown(state));
process.on("SIGINT", () => handleShutdown(state));

async function main() {
  let config;
  try {
    config = parseConfig(process.argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stdout.write(
      JSON.stringify({ type: "error", error: message }) + "\n"
    );
    process.exit(1);
  }

  try {
    if (config.apiKey) {
      process.env.ANTHROPIC_API_KEY = config.apiKey;
    }

    const options = buildQueryOptions(config, state.abortController);

    const conversation = query({
      prompt: config.prompt,
      options,
    });

    for await (const message of conversation) {
      if (state.aborted) break;
      process.stdout.write(JSON.stringify(message) + "\n");
    }

    process.exit(0);
  } catch (err) {
    if (state.aborted) {
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

main();
