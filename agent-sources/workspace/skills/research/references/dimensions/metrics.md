# Metrics & KPI

## Focus
Captures which metrics to support, their exact calculation formulas, parameter definitions, and where "approximately correct" defaults produce wrong analysis. Matters for skill quality because textbook formulas diverge from customer reality at the level of denominators, exclusions, thresholds, and custom modifiers.

## Research Approach
Identify the key business metrics for the domain and drill into the precise calculation logic for each. For every metric, investigate what the denominator is, which records are included or excluded, whether thresholds vary by segment, and whether custom modifiers or adjustments apply. Focus on where "approximately correct" becomes "meaningfully wrong."

## Delta Principle
Claude knows textbook formulas (coverage = open/quota, win rate = won/(won+lost)). The delta is every parameter: coverage denominator (quota vs. forecast vs. target), segmented targets (4.5x/2x), win rate exclusions ($25K floor, 14-day minimum), custom modifiers (discount impact factor). Without these specifics the skill produces plausible-but-wrong results.

## Success Criteria
Questions cover which metrics to support, formula parameters, aggregation granularity, and metric presentation. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. What are the primary business metrics for this domain, and which have calculation definitions that diverge from industry standards?
2. For each key metric, what is the exact denominator — and does it vary by segment, time period, or record type?
3. Which records are excluded from metric calculations, and what are the threshold values and conditions for those exclusions?
4. Do any metrics use segmented targets or benchmarks (e.g., different coverage ratios by deal size or segment), and what are the exact breakpoints?
5. Are there custom modifiers or adjustment factors applied to any metric calculations, and what drives those adjustments?
6. At what grain should each metric be aggregated (individual, team, region, company), and does the grain affect the formula?
7. How should metrics be presented — are there rounding conventions, display formats, or comparison baselines that the skill must respect?
8. Which metrics are calculated in the source system vs. derived in the data layer, and does that origin affect how the skill should handle them?
