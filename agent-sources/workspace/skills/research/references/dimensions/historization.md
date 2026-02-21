# Historization & Temporal Design

## Focus
Captures SCD type selection rationale per entity, effective date conventions, snapshot vs. row-versioning trade-offs, bitemporal modeling triggers, and history retention policies. Matters for skill quality because the right historization approach is determined by entity-specific scale and change-rate thresholds that standard Type 2 recommendations do not account for.

## Research Approach
For each major entity in the domain, assess three factors: which columns change and how frequently, expected row volume growth over time, and whether regulatory or audit requirements demand bitemporal modeling. Use these factors to identify where the standard Type 2 recommendation breaks down — for example, high-change-rate entities where snapshot-based approaches are more practical, or wide tables where row-versioning creates storage and query performance problems.

## Delta Principle
Claude knows SCD Types 1/2/3/4/6. The delta is threshold decisions: when Type 2 breaks down at scale (>10M rows with 10% daily changes), when snapshots outperform row-versioning (wide tables with many changing columns), when bitemporal modeling is required vs. overkill. Without these thresholds the skill recommends Type 2 universally, producing pipelines that degrade at scale.

## Success Criteria
Questions address SCD type selection rationale for specific entity types in the domain. Questions cover snapshot vs. row-versioning trade-offs at realistic scale thresholds. Questions identify when bitemporal modeling is required vs. unnecessary overhead. Questions include history retention policies and their downstream impact. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. For each primary entity in this domain, which columns change, how frequently do they change, and how does that rate affect SCD type selection?
2. At what row volume and change rate does Type 2 row-versioning become impractical for the main entities, and what alternative approach is appropriate at that scale?
3. Are there wide tables with many changing columns where snapshot-based historization outperforms row-versioning, and what drives that threshold?
4. Are there regulatory, audit, or compliance requirements that mandate bitemporal modeling (tracking both transaction time and valid time), or is single-axis temporal design sufficient?
5. What effective date conventions are used — is the effective date the system modification timestamp, a business-effective date, or a processing date?
6. What history retention policies apply to each entity, and what downstream query patterns would break if history were truncated?
7. For entities that use periodic snapshots, what snapshot cadence is required, and how are gaps in the snapshot series handled in downstream queries?
