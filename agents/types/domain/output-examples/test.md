```markdown
# Skill Test Report

## Summary
- **Total tests**: 10
- **Passed**: 7
- **Partial**: 2
- **Failed**: 1

## Test Results

### Test 1: What are the core entities in sales pipeline analytics?
- **Category**: basic concepts
- **Result**: PASS
- **Skill coverage**: SKILL.md overview lists opportunity, account, contact, and pipeline stage. references/entity-model.md provides cardinality and relationship details.
- **Gap**: None

### Test 2: What silver layer tables do I need for opportunity tracking?
- **Category**: silver layer
- **Result**: PARTIAL
- **Skill coverage**: references/entity-model.md describes opportunity entity but doesn't specify recommended table grain
- **Gap**: Missing guidance on whether to use event-level or snapshot grain for opportunity state changes

### Test 8: How do I handle backdated opportunity stage changes?
- **Category**: edge case
- **Result**: FAIL
- **Skill coverage**: No content found addressing backdated or retroactive changes
- **Gap**: Content gap — need a section on temporal edge cases in stage-modeling.md

## Skill Content Issues
- Temporal/historical modeling is the biggest gap (affects Tests 8, 9)
- Silver layer guidance lacks specificity on table grain decisions
- Source field coverage is strong for Salesforce but missing for HubSpot

## Suggested PM Prompts
1. **Historical state reconstruction** — "How should I rebuild pipeline state as of a past date?"
2. **Multi-CRM consolidation** — "How do I merge pipeline data from multiple CRM systems?"
3. **Forecast accuracy tracking** — "How should I model forecast vs. actuals over time?"
```
