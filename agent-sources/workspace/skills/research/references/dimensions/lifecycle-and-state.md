# Record Lifecycle & State

## Focus
Captures state machine behaviors, custom stage progressions, lifecycle boundary conditions, record type-specific lifecycle variations, and independently editable state fields. Matters for skill quality because lifecycle behaviors like RecordTypeId filtering, ForecastCategory/StageName independence, and custom stage progressions are not reliably flagged by Claude without explicit research.

## Research Approach
Investigate the domain's record lifecycle by mapping out which objects follow defined state machines and what the valid transitions are. Look for lifecycle boundary violations (regression, stage skipping, reopening closed records), record type-specific lifecycle paths that diverge from the default, and state fields that should be correlated but can be independently edited. Ask about how the actual lifecycle in production deviates from the designed lifecycle.

## Delta Principle
The "State Machine and Lifecycle" template section previously had zero researching dimensions assigned to it. RecordTypeId filtering, ForecastCategory/StageName independence, and custom stage progressions are lifecycle behaviors Claude does not reliably flag. Without explicit lifecycle research, the skill omits state-dependent filtering logic and mismodels transitions.

## Success Criteria
Questions surface state machine behaviors and custom stage progressions. Questions cover lifecycle boundary conditions including regression and stage skipping. Questions identify record type-specific lifecycle variations and independently editable state fields. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Which objects in this domain follow defined state machines, and what are the valid state transitions — including which transitions are reversible?
2. Can records regress to earlier stages, skip stages, or be reopened after reaching a terminal state — and how frequently does this happen in production?
3. Which record types have lifecycle paths that diverge from the default lifecycle, and how do RecordTypeId-specific filters affect which records should be included in each stage?
4. Which state fields appear to be correlated but can actually be independently edited (e.g., stage and forecast category can diverge), and which value takes precedence for each use case?
5. What custom stage progressions exist beyond the platform's standard stages, and how should they be mapped to standard reporting categories?
6. Are there automated state transitions (triggers, workflows, process builders) that can move records without user action, and how do they affect CDC change detection?
7. How does the actual lifecycle in production deviate from the documented or designed lifecycle — which edge cases are common enough to require handling in the data model?
