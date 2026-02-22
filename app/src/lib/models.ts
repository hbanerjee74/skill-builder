/** Maps a model alias or full ID to the canonical dateless model ID.
 *  Mirrors resolve_model_id() in commands/workflow.rs. */
export function resolveModelId(model: string): string {
  switch (model) {
    case "sonnet": return "claude-sonnet-4-6";
    case "haiku":  return "claude-haiku-4-5";
    case "opus":   return "claude-opus-4-6";
    default:       return model;
  }
}
