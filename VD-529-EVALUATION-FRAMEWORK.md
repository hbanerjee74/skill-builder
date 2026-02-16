# Skill Evaluation Framework for Data Engineering Skills

## Implementation Status: Complete

All phases have been implemented in `scripts/eval/eval-skill-quality.sh`. Only live end-to-end testing against real skills remains (VD-534).

## Context

The Skill Builder generates domain-specific skills for data engineers building silver and gold models:

- **Domain skills**: Business process logic (allocation rules, assignment rules, filters)
- **Source skills**: Extraction patterns (join conditions, gotchas, API quirks)
- **Platform skills**: Standards and conventions (dbt, Fabric, testing)
- **Data Engineering skills**: DQ, testing, and engineering standards

## Evaluation Dimensions

### 1. Quality Metrics (LLM-as-Judge) -- IMPLEMENTED

**4 quality dimensions** (aligned with Skill Builder's validate agents):
- **Actionability** (1-5): Can an engineer implement this in a real system?
- **Specificity** (1-5): Concrete details vs generic boilerplate
- **Domain Depth** (1-5): Hard-to-find rules, edge cases, non-obvious relationships
- **Self-Containment** (1-5): Provides WHAT/WHY context, not just HOW

**3 Claude practices dimensions** (based on Anthropic's official guidelines):
- **Progressive Disclosure** (1-5): Is content organized for efficient loading?
- **Structure & Organization** (1-5): Well-organized like an onboarding guide?
- **Claude-Centric Design** (1-5): Written from Claude's perspective?

**Total Quality Score**: 35 points (7 dimensions x 5 points)

### 2. Cost Metrics (Instrumented) -- IMPLEMENTED

Track actual resource consumption:
- **Token Usage**: Input tokens, output tokens, skill tokens, total tokens per task
- **API Costs**: Estimated cost per task (based on configurable model pricing)
- **Cost Efficiency**: Cost per quality point ratio

### 3. Performance Metrics (Instrumented) -- IMPLEMENTED

Track execution characteristics:
- **Latency**: Total response time, time to first token, tokens per second
- **Success Rate**: Task completion rate, retry count
- **Skill Discovery**: Discovery time, progressive disclosure levels loaded

## Evaluation Modes -- IMPLEMENTED

### Mode 1: Quality-Focused
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective quality
```

### Mode 2: Cost-Focused
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective cost
```

### Mode 3: Performance-Focused
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective performance
```

### Mode 4: Comprehensive (All Metrics)
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective all
```

## JSON Output Schema -- IMPLEMENTED

See the full schema documentation in the header of `scripts/eval/eval-skill-quality.sh`. Key top-level fields:
- `metadata` -- mode, perspective, models, pricing, skill token counts
- `prompts[]` -- per-prompt scores with variant_a/variant_b quality, cost, and performance data
- `averages` -- aggregate scores across all prompts
- `verdict` -- overall winner determination
- `recommendations` -- per-perspective improvement suggestions
- `production_readiness` -- pass/fail assessment against production criteria

## Implementation Phases -- ALL COMPLETE

### Phase 1: Foundation (VD-530, VD-531, VD-532, VD-533) -- DONE
- Script improvements (retry logic, JSON output, Claude Code skill loading)
- Test prompts for all 4 skill types

### Phase 2: Quality Enhancement (VD-535) -- DONE
- Claude best practices judge with 3 additional dimensions
- 7-dimensional quality scoring
- Updated judge prompts

### Phase 3: Cost & Performance (VD-536, VD-537) -- DONE
- Token counting and API cost estimation
- Latency, throughput, and success rate tracking
- Skill discovery and progressive disclosure metrics

### Phase 4: Multi-Perspective Reporting (VD-538) -- DONE
- Perspective-based filtering (quality, cost, performance, all)
- Recommendations engine
- Production readiness assessment

### Phase 5: Testing & Validation (VD-534) -- IN PROGRESS
- Test suite with 19 tests (syntax, validation, dry-run, API)
- Live testing against real skills pending

## Success Criteria

A skill is considered "production-ready" if:
- **Quality**: Total score >= 28/35 (80%)
- **Claude Best Practices**: All 3 dimensions >= 4/5
- **Cost**: Cost per quality point <= $0.003
- **Performance**: Success rate >= 95%, latency <= 5s

## Validation Against Research

This framework aligns with industry best practices:
- Multi-dimensional quality (Confident AI, Braintrust)
- Cost tracking (Azure Databricks, Salesforce)
- Performance metrics (Galileo AI, CodeAnt)
- LLM-as-judge (Anthropic, OpenAI)
- Domain-specific validation (Alation SQL agents)
- Progressive disclosure (Anthropic Agent Skills)

## Next Steps

1. Complete VD-534: Run live end-to-end tests against real skills
2. Calibrate production readiness thresholds with real data
3. Iterate on judge prompts based on live test results
