```markdown
# Skill Test Report

## Summary
- **Total tests**: 10
- **Passed**: 7
- **Partial**: 2
- **Failed**: 1

## Test Results

### Test 1: What are the core entities in the Stripe data model?
- **Category**: basic concepts
- **Result**: PASS
- **Skill coverage**: SKILL.md overview lists charges, subscriptions, invoices, and events. references/event-schemas.md provides detailed object relationships.
- **Gap**: None

### Test 2: What silver layer tables do I need for subscription lifecycle tracking?
- **Category**: silver layer
- **Result**: PARTIAL
- **Skill coverage**: references/event-schemas.md describes subscription entity but doesn't specify recommended grain for tracking state transitions
- **Gap**: Missing guidance on whether to use event-level or snapshot grain for subscription status changes

### Test 8: How do I handle Stripe webhook delivery failures and out-of-order events?
- **Category**: edge case
- **Result**: FAIL
- **Skill coverage**: No content found addressing webhook retry semantics or event ordering guarantees
- **Gap**: Content gap — need a section on webhook reliability patterns in webhook-events.md

## Skill Content Issues
- Webhook reliability and idempotency is the biggest gap (affects Tests 8, 9)
- Silver layer guidance lacks specificity on handling Stripe's eventual consistency
- API extraction patterns are strong for charges but missing for Connect and Issuing

## Suggested PM Prompts
1. **Multi-account consolidation** — "How should I merge data from multiple Stripe accounts into a unified model?"
2. **Currency normalization** — "How do I handle multi-currency amounts and exchange rate snapshots?"
3. **Dispute lifecycle tracking** — "How should I model the full dispute resolution workflow from Stripe data?"
```
