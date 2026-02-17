```markdown
## Platform Entities & Relationships

### Q1: How should platform resource dependencies be modeled?
The platform manages resources that depend on each other in complex ways. How should the skill represent resource relationships?

**Choices:**
a) **Flat resource list** — No explicit dependency tracking. Simple but misses ordering and lifecycle constraints.
b) **Directed acyclic graph (DAG)** — Resources declare their dependencies; changes propagate in topological order.
c) **Hierarchical namespaces** — Resources are nested within parent resources (e.g., project > cluster > namespace > pod).
d) **Other (please specify)**

**Recommendation:** Option (b) — DAG-based dependency modeling is the most general approach and matches how most platform tools (Terraform, Kubernetes) already think about resources.

**Answer:**
```
