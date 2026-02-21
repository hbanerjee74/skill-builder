# Configuration Patterns

## Focus
Captures dangerous configuration combinations, version-dependent configuration constraints, and multi-axis compatibility requirements across core, adapter, and runtime versions. Matters for skill quality because Claude generates syntactically valid configurations from documentation but cannot reason about which configurations produce unexpected runtime behavior.

## Research Approach
Investigate configuration options that are syntactically valid but produce wrong runtime behavior, focusing on multi-axis compatibility (core version x adapter version x runtime version). Look for settings with non-obvious defaults that cause silent failures, version boundaries where configuration options change meaning or become invalid, and configuration combinations where individually correct settings interact to produce unexpected behavior.

## Delta Principle
Claude generates syntactically valid configurations from documentation. It cannot reason about which configurations produce unexpected runtime behavior. The expanded scope includes version-dependent configuration interactions (e.g., adapter v1.6+ required for incremental materialization, which changes available config options). Without this knowledge the skill generates configurations that pass syntax validation but fail in production.

## Success Criteria
Questions identify dangerous configuration combinations that are syntactically valid but semantically wrong. Questions cover version-dependent constraints where valid configs change across version boundaries. Questions surface multi-axis compatibility requirements across core, adapter, and runtime versions. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Which configuration combinations are syntactically valid but produce wrong runtime behavior — settings that look correct but interact unexpectedly?
2. What are the version constraints across core, adapter, and runtime — which version combinations are required for specific configuration options to work correctly?
3. Which configuration options have non-obvious defaults that cause silent failures when left unset?
4. At which version boundaries do configuration options change meaning, become deprecated, or require migration to a new syntax?
5. Are there adapter-specific configuration requirements that override or conflict with core platform defaults?
6. Which configuration options interact with each other such that individually valid settings produce unexpected behavior in combination?
7. What configuration anti-patterns are commonly used in the community but known to fail in specific environments or at scale?
