```markdown
## Domain Entities & Relationships

### Q1: How should customer hierarchy be modeled?
The domain involves multiple levels of customer relationships. How should the skill represent these?

**Choices:**
a) **Flat customer list** — Single entity, no hierarchy. Simpler but loses parent-child relationships.
b) **Two-level hierarchy (parent/child)** — Covers most B2B scenarios (corporate HQ + subsidiaries).
c) **Unlimited hierarchy depth** — Full recursive tree. Required for complex orgs but harder to model.
d) **Other (please specify)**

**Recommendation:** Option (b) — two-level hierarchy covers 80% of real-world needs without recursive complexity.

**Answer:**
```
