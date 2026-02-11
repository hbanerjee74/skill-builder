import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseConfig } from "./config.js";
import { runAgentRequest } from "./run-agent.js";
import { createAbortState, handleShutdown } from "./shutdown.js";
import { runPersistent } from "./persistent-mode.js";

const state = createAbortState();

process.on("SIGTERM", () => handleShutdown(state));
process.on("SIGINT", () => handleShutdown(state));

/**
 * One-shot mode: parse config from argv[2], run the agent, exit.
 * This is the original behavior, preserved for backward compatibility.
 */
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
    await runAgentRequest(config, (message) => {
      if (state.aborted) return;
      process.stdout.write(JSON.stringify(message) + "\n");
    });

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

// Only run when executed directly (not when imported for testing).
// In ESM we check if the resolved argv[1] matches this module's file URL.
const isDirectRun =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  if (process.argv.includes("--persistent")) {
    runPersistent();
  } else {
    main();
  }
}
