## Skill Best Practices

Used by generate and validate agents.

### Naming and Description

- Gerund names, lowercase+hyphens, max 64 chars (e.g., `processing-pdfs`)
- Description follows the trigger pattern: `[What it does]. Use when [triggers]. [How it works]. Also use when [more triggers].` Max 1024 chars.

### SKILL.md Structure

- Under 500 lines — concise enough to answer simple questions without loading references
- If a section grows past a few paragraphs, extract to a reference file
- Reference files one level deep. TOC for files over 100 lines.
- **Required sections:** Metadata (name, description) | Overview (scope, audience, key concepts) | When to use (triggers, intent patterns) | Quick reference (top guidance) | Pointers to references (what each file covers, when to read it)

### Quality Dimensions (scored 1-5)

- **Actionability** — could an engineer follow this?
- **Specificity** — concrete details vs generic boilerplate
- **Domain Depth** — hard-to-find knowledge vs surface-level
- **Self-Containment** — WHAT and WHY without external lookups

### Content Rules

- No time-sensitive info. Consistent terminology.
- Use templates for output format, examples for quality-dependent output.
- Match specificity to fragility — be most precise where mistakes are costliest.

### Anti-patterns

- Windows paths
- Too many options without a clear default
- Nested reference files
- Vague descriptions
- Over-explaining what Claude already knows
