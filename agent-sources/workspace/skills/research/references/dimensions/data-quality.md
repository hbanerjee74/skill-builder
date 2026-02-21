# Data Quality

## Focus
Captures validation rules, quality gate thresholds, known quality issues, and pipeline failure response patterns specific to the domain. Matters for skill quality because generic data quality concepts miss pattern-specific checks and org-specific known issues that constrain what the skill can safely recommend.

## Research Approach
Investigate where generic quality patterns break down for this specific domain. Look for pattern-specific checks that go beyond textbook data quality — per-layer validation rules, cross-layer reconciliation that must account for row multiplication, quality gate thresholds that determine halt vs. quarantine vs. continue behavior. Also probe for org-specific known quality issues: fields that are commonly null or unreliable, validation rules that force incorrect data entry, and data cleanup jobs or compensating controls that downstream consumers depend on.

## Delta Principle
Claude knows generic data quality concepts (null checks, uniqueness, referential integrity). The delta is pattern-specific checks (e.g., row multiplication accounting after MERGE into Type 2) and org-specific issues (e.g., fields commonly null due to validation rule workarounds). Without this knowledge the skill generates quality checks that pass but miss real problems.

## Success Criteria
Questions cover validation rules, quality gate thresholds, known quality issues, and pipeline failure response. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Which validation rules are required at each pipeline layer (bronze, silver, gold), and what triggers a halt vs. quarantine vs. continue decision?
2. For pattern-specific operations like Type 2 MERGE, what additional quality checks are needed to detect row multiplication or duplicate current records?
3. Which fields in this domain are commonly null, unreliable, or populated incorrectly due to validation rule workarounds, and how should downstream consumers handle them?
4. Are there cross-layer reconciliation checks that must account for legitimate row count changes (e.g., fan-out joins, deduplication)?
5. What data cleanup jobs or compensating controls exist, and which downstream consumers depend on them running before they query the data?
6. What are the acceptable thresholds for common quality checks (null rates, uniqueness violations, referential integrity gaps) before a pipeline run should fail?
7. How should pipeline failures be handled — retry, quarantine, alert, or manual intervention — and do different failure types require different responses?
