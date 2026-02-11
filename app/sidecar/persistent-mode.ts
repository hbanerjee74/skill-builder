import { createInterface, type Interface } from "node:readline";
import { type SidecarConfig } from "./config.js";
import { runAgentRequest } from "./run-agent.js";

/** Incoming request envelope: run an agent. */
export interface AgentRequest {
  type: "agent_request";
  request_id: string;
  config: SidecarConfig;
}

/** Incoming shutdown envelope. */
export interface ShutdownRequest {
  type: "shutdown";
}

/** Union of all valid incoming messages. */
export type IncomingMessage = AgentRequest | ShutdownRequest;

/**
 * Write a single JSON line to stdout.
 */
function writeLine(obj: Record<string, unknown>): void {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

/**
 * Parse and validate an incoming JSON line.
 * Returns the parsed message or null if invalid.
 */
export function parseIncomingMessage(line: string): IncomingMessage | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  if (obj.type === "shutdown") {
    return { type: "shutdown" };
  }

  if (obj.type === "agent_request") {
    if (typeof obj.request_id !== "string" || !obj.request_id) return null;
    if (typeof obj.config !== "object" || obj.config === null) return null;
    return {
      type: "agent_request",
      request_id: obj.request_id,
      config: obj.config as SidecarConfig,
    };
  }

  return null;
}

/**
 * Wrap an SDK message with a request_id prefix.
 */
export function wrapWithRequestId(
  requestId: string,
  message: Record<string, unknown>,
): Record<string, unknown> {
  return { request_id: requestId, ...message };
}

/**
 * Run the sidecar in persistent mode.
 *
 * - Emits `{"type":"sidecar_ready"}` on startup
 * - Reads stdin line-by-line for `agent_request` and `shutdown` messages
 * - Each `agent_request` runs the SDK and streams responses with `request_id` prefix
 * - `shutdown` causes a clean exit
 * - stdin close (pipe broken) causes a clean exit
 *
 * @param input   Readable stream (defaults to process.stdin)
 * @param exitFn  Exit function (defaults to process.exit)
 */
export async function runPersistent(
  input: NodeJS.ReadableStream = process.stdin,
  exitFn: (code: number) => void = (code) => process.exit(code),
): Promise<void> {
  // Signal readiness
  writeLine({ type: "sidecar_ready" });

  const rl: Interface = createInterface({
    input,
    crlfDelay: Infinity,
  });

  // Track in-flight requests so we can wait for them before shutdown
  const inFlight = new Set<Promise<void>>();

  for await (const line of rl) {
    const message = parseIncomingMessage(line);

    if (!message) {
      // Unrecognized input — emit an error line (no request_id since we couldn't parse one)
      writeLine({
        type: "error",
        message: `Unrecognized input: ${line.trim().substring(0, 200)}`,
      });
      continue;
    }

    if (message.type === "shutdown") {
      // Wait for any in-flight requests to finish
      if (inFlight.size > 0) {
        await Promise.allSettled(inFlight);
      }
      rl.close();
      exitFn(0);
      return;
    }

    if (message.type === "agent_request") {
      const { request_id, config } = message;

      // Run the agent request, streaming wrapped messages
      const requestPromise = (async () => {
        try {
          await runAgentRequest(config, (msg) => {
            writeLine(wrapWithRequestId(request_id, msg));
          });
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : String(err);
          writeLine(
            wrapWithRequestId(request_id, {
              type: "error",
              message: errorMessage,
            }),
          );
        }
      })();

      inFlight.add(requestPromise);
      requestPromise.finally(() => inFlight.delete(requestPromise));

      // Wait for this request to finish before accepting the next one.
      // The protocol is sequential: one request at a time.
      await requestPromise;
    }
  }

  // stdin closed (pipe broken) — exit gracefully
  if (inFlight.size > 0) {
    await Promise.allSettled(inFlight);
  }
  exitFn(0);
}
