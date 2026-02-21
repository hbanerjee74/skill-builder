# Business Rules

## Focus
Captures conditional business logic, regulatory requirements, exception handling rules, and attribution models that constrain data modeling. Matters for skill quality because engineers without domain expertise commonly implement plausible-but-wrong defaults when the actual rules have thresholds, exceptions, and segment-specific variations.

## Research Approach
Investigate the business rules landscape for the domain, focusing on rules with exceptions, conditional logic, and thresholds that vary by segment or context. Look for attribution models with competing approaches, regulatory requirements that override natural modeling choices, and rules that engineers without domain expertise commonly get wrong. Probe for the precise threshold values, exception conditions, and edge cases that distinguish correct implementation from plausible-but-wrong defaults.

## Delta Principle
Claude knows standard business rules at textbook level. The delta is the customer's actual rule logic: pushed deals treated differently by deal type, maverick spend with a $5K threshold plus sole-source exception, co-sold deal attribution models. Without the specific thresholds and exception conditions, the skill implements the general rule instead of the correct one.

## Success Criteria
Questions cover conditional business logic, regulatory requirements, and exception handling rules. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Which business rules in this domain have exceptions, conditional logic, or threshold values that vary by segment, deal type, or context?
2. What attribution models are used (e.g., for revenue, pipeline credit, or cost allocation), and where do competing approaches exist that the org has resolved in a specific direction?
3. Are there regulatory requirements that override natural modeling choices, and what do they mandate concretely?
4. Which rules are engineers without domain expertise most likely to implement incorrectly, and what is the correct version?
5. What exception conditions exist — rules that apply generally but have named carve-outs with specific criteria?
6. Are there organizational policies (e.g., approval thresholds, spend limits, escalation rules) that affect how records should be classified or routed in the data model?
7. Which business rules change frequently, and how should the data model accommodate rule evolution without requiring schema changes?
