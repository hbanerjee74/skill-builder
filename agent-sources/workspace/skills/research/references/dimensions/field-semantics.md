# Field Semantics

## Focus
Captures fields whose standard meaning is overridden or misleading, including managed package field overrides, independently editable field pairs, and ISV field interactions. Matters for skill quality because Claude knows standard field semantics but cannot know which fields have been overridden in the customer's org by packages or automation.

## Research Approach
Investigate the domain's field landscape by identifying installed managed packages and automation that override standard field values. Look for field pairs that appear correlated but can be independently edited, fields whose picklist values or meanings have been customized beyond the platform default, and ISV integrations that write to standard fields on a schedule. Ask about which fields are trusted as the canonical value versus which are stale or overwritten by external processes.

## Delta Principle
High-delta content (CPQ overriding Amount, ForecastCategory/StageName independence, Clari overwriting forecast fields nightly) requires explicit research. Claude knows standard field semantics but cannot know which fields have been overridden in the customer's org. Without this knowledge the skill treats overridden fields as having their standard meaning, producing incorrect calculations and joins.

## Success Criteria
Questions surface fields whose standard semantics have been overridden by packages or automation. Questions cover managed package modification schedules and ISV field interactions. Questions identify independently editable field pairs that appear correlated. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Which standard fields have their values overridden or populated by managed packages, ISV integrations, or automation — and on what schedule does each override run?
2. Which field pairs appear to be correlated (e.g., stage and forecast category) but can actually be independently edited, producing combinations the standard model does not anticipate?
3. Which picklist fields have custom values or extended meanings that deviate from the platform's standard picklist options?
4. Which fields are written to by ISV tools (e.g., revenue intelligence platforms, CPQ systems) that change their meaning relative to the standard field definition?
5. For fields that are overridden by external processes, which value is canonical — the original source value or the overridden value — and does the answer differ by use case?
6. Are there fields that were meaningful historically but are now stale or no longer populated due to process changes?
7. Which fields appear in standard documentation as reliable join keys but have been repurposed or contain non-unique values in the customer's org?
