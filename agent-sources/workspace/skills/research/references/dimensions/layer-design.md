# Silver/Gold Layer Design

## Focus
Captures layer boundary decisions, conformed dimension governance, fact table granularity, materialization strategy, and aggregate table design. Matters for skill quality because where the silver/gold boundary falls and whether conformed dimensions are physically or logically materialized have significant downstream implications for lineage, query performance, and pattern correctness.

## Research Approach
Examine the domain's data flow from source to consumption to identify where the silver/gold boundary should fall — whether silver should be source-conformed or business-conformed, and what that choice implies for data lineage and debugging. Evaluate whether conformed dimensions should be physically materialized tables or logical views, considering the domain's pattern choices (e.g., Type 2 dimensions make views expensive due to point-in-time filtering). Identify which aggregate tables the domain's primary query patterns require.

## Delta Principle
Claude knows medallion architecture and star schema. The delta is where to draw the silver/gold boundary, physical vs. logical conformance, and materialization trade-offs specific to pattern choices. A skill that misplaces the silver/gold boundary produces a layer structure where business logic leaks into silver or raw complexity is exposed in gold, degrading both debuggability and usability.

## Success Criteria
Questions address where to draw the silver/gold layer boundary and its implications. Questions cover physical vs. logical conformed dimension governance. Questions include materialization strategy trade-offs tied to specific pattern choices. Questions identify aggregate table needs for the domain's query patterns. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Where should the silver/gold boundary fall for this domain — should silver be source-conformed (structural cleaning only) or business-conformed (includes business logic), and what drives that choice?
2. Which conformed dimensions should be physically materialized tables vs. logical views, and how do the domain's historization pattern choices affect that decision?
3. For Type 2 dimensions specifically, what are the materialization implications of view-based conformance at the query volumes this domain generates?
4. Which fact tables require pre-aggregated summary tables or materialized rollups to support the primary query workload, and at what grain?
5. How should cross-domain conformed dimensions be governed — who owns them, how are schema changes coordinated, and how are conflicts between domain-specific needs resolved?
6. What lineage and debugging requirements constrain the layer design — are there compliance or incident-resolution needs that require preserving intermediate states?
7. Are there aggregate patterns (e.g., period-over-period rollups, running totals, cohort aggregates) that cannot be efficiently computed at query time and require pre-materialization?
