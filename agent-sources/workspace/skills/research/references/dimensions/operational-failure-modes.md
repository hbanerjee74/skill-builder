# Operational Failure Modes

## Focus
Captures production failure patterns, undocumented timeout behaviors, concurrency issues, environment-specific error behaviors, and debugging procedures that only come from operational experience. Matters for skill quality because Claude describes happy paths; this dimension surfaces the failure paths that engineers encounter after deploying to production.

## Research Approach
Investigate failure modes that engineers discover only after deploying to production, focusing on what breaks under load, during concurrent operations, and at scale boundaries. Look for undocumented timeout behaviors, metadata lock contention patterns, error message formats that differ across environments, and the debugging procedures that experienced operators use for rapid incident resolution but that are never written down in official documentation.

## Delta Principle
Claude describes happy paths; this dimension surfaces failure paths. Production-incident knowledge (Fabric's unconfigurable 30-minute query timeout, metadata lock contention from concurrent dbt runs, environment-specific test error format differences) comes exclusively from operational experience. Without this knowledge the skill generates code that works in development but fails in production under realistic conditions.

## Success Criteria
Questions surface production failure patterns including timeout and concurrency issues. Questions identify undocumented debugging procedures essential for incident resolution. Questions cover environment-specific error behaviors and performance pitfalls at scale. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. What are the most common production failure patterns for this platform — which operations fail most frequently and under what conditions?
2. Are there undocumented timeout behaviors — operations that silently time out or are killed without a clear error message at production data volumes?
3. Which concurrent operations cause metadata lock contention or resource conflicts, and what are the symptoms and mitigations?
4. How do error messages differ across environments (dev, staging, prod), and which environment-specific error formats require different debugging approaches?
5. What debugging procedures do experienced operators use for rapid incident resolution that are not documented anywhere?
6. At what scale thresholds (row counts, query complexity, concurrency level) do specific operations degrade or fail?
7. Which failure modes produce wrong results silently (no error raised) vs. which produce explicit failures, and how are the silent ones detected?
