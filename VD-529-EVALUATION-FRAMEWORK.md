# Skill Evaluation Framework for Data Engineering Skills

## Context

The Skill Builder generates domain-specific skills for data engineers building silver and gold models:

- **Domain skills**: Business process logic (allocation rules, assignment rules, filters)
- **Source skills**: Extraction patterns (join conditions, gotchas, API quirks)
- **Platform skills**: Standards and conventions (dbt, Fabric, testing)
- **Data Engineering skills**: DQ, testing, and engineering standards

## Evaluation Dimensions

### 1. Quality Metrics (LLM-as-Judge)

**Current Implementation** (4 dimensions aligned with Skill Builder's validate agents):
- **Actionability** (1-5): Can an engineer implement this in a real system?
- **Specificity** (1-5): Concrete details vs generic boilerplate
- **Domain Depth** (1-5): Hard-to-find rules, edge cases, non-obvious relationships
- **Self-Containment** (1-5): Provides WHAT/WHY context, not just HOW

**Add: Claude Skill Best Practices Compliance** (new dimension):
Based on Anthropic's official guidelines:
- **Progressive Disclosure** (1-5): Is content organized for efficient loading?
  - Clear name and description for skill discovery
  - Core instructions in SKILL.md
  - Deep details in reference files
  - Code as executable tools vs documentation
- **Structure & Organization** (1-5): Well-organized like an onboarding guide?
  - Logical flow from overview to specifics
  - Clear separation of concerns
  - Appropriate use of reference files
  - Code bundled appropriately
- **Claude-Centric Design** (1-5): Written from Claude's perspective?
  - Clear when to trigger the skill
  - Unambiguous instructions
  - Handles common failure modes
  - Self-contained enough to avoid confusion

**Total Quality Score**: 35 points (7 dimensions × 5 points)

### 2. Cost Metrics (Instrumented)

Track actual resource consumption:
- **Token Usage**:
  - Input tokens (skill content + prompt)
  - Output tokens (response)
  - Total tokens per task
- **API Costs**:
  - Cost per task (based on model pricing)
  - Cost per successful completion
  - Cost efficiency ratio (quality points / dollar)
- **Context Efficiency**:
  - Skill size (tokens in SKILL.md + references)
  - Skill loading frequency (how often triggered)
  - Unused context (loaded but not referenced)

### 3. Performance Metrics (Instrumented)

Track execution characteristics:
- **Latency**:
  - Time to first token
  - Total response time
  - Tokens per second
- **Success Rate**:
  - Task completion rate
  - Retry rate
  - Error rate
- **Skill Discovery**:
  - Time to skill trigger (from user message)
  - Skill selection accuracy (correct skill chosen)
  - Progressive disclosure efficiency (levels loaded)

### 4. Data Engineering Specificity (Domain-Specific)

Evaluate against data engineering best practices:
- **Silver/Gold Model Quality**:
  - Proper dimensional modeling
  - SCD handling
  - Incremental logic
  - Data quality tests
- **Source Integration Quality**:
  - API extraction patterns
  - Join logic correctness
  - Error handling
  - Idempotency
- **Platform Standards Compliance**:
  - dbt best practices
  - Testing coverage
  - Data contracts
  - CI/CD integration

## Evaluation Modes

### Mode 1: Quality-Focused (Current + Enhanced)
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective quality \
  --include-claude-best-practices
```

**Output**:
- 7-dimensional quality scores
- Claude best practices compliance
- Per-prompt quality breakdown
- Recommendations for improvement

### Mode 2: Cost-Focused (New)
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective cost
```

**Output**:
- Token usage per task
- Cost per task
- Cost efficiency (quality/cost ratio)
- Skill size analysis
- Context loading patterns

### Mode 3: Performance-Focused (New)
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective performance
```

**Output**:
- Latency metrics
- Success/retry rates
- Skill discovery time
- Progressive disclosure efficiency

### Mode 4: Comprehensive (All Metrics)
```bash
./scripts/eval/eval-skill-quality.sh \
  --baseline agents/data-engineering/generate-skill.md \
  --prompts scripts/eval/prompts/data-engineering.txt \
  --perspective all
```

**Output**: Combined report with all dimensions

## Enhanced JSON Schema

```json
{
  "metadata": {
    "mode": "baseline|compare",
    "perspective": "quality|cost|performance|all",
    "timestamp": "ISO-8601",
    "skill_type": "domain|source|platform|data-engineering",
    "judge_model": "sonnet",
    "response_model": "sonnet"
  },
  "prompts": [
    {
      "index": 1,
      "label": "Design SCD Type 2 implementation...",
      "variant_a": {
        "quality": {
          "actionability": 4,
          "specificity": 5,
          "domain_depth": 4,
          "self_containment": 5,
          "progressive_disclosure": 4,
          "structure_organization": 5,
          "claude_centric_design": 4,
          "total": 31
        },
        "cost": {
          "input_tokens": 1250,
          "output_tokens": 850,
          "total_tokens": 2100,
          "skill_tokens": 450,
          "estimated_cost_usd": 0.042,
          "cost_per_quality_point": 0.00135
        },
        "performance": {
          "latency_ms": 3450,
          "time_to_first_token_ms": 890,
          "tokens_per_second": 24.6,
          "success": true,
          "retries": 0,
          "skill_discovery_ms": 120,
          "progressive_levels_loaded": 2
        },
        "data_engineering": {
          "dimensional_modeling": "correct",
          "scd_handling": "type2_implemented",
          "incremental_logic": "idempotent",
          "data_quality_tests": "comprehensive"
        }
      },
      "variant_b": { /* same structure */ }
    }
  ],
  "comparison": {
    "quality": {
      "delta": 2.4,
      "winner": "A",
      "dimensions": {
        "actionability": {"a": 4.2, "b": 3.8, "delta": 0.4},
        "progressive_disclosure": {"a": 4.0, "b": 2.5, "delta": 1.5}
      }
    },
    "cost": {
      "token_delta_pct": -15.3,
      "cost_delta_pct": -15.3,
      "efficiency_improvement": "18.2%",
      "winner": "A"
    },
    "performance": {
      "latency_delta_ms": -450,
      "success_rate_delta_pct": 5.0,
      "winner": "A"
    }
  },
  "recommendations": {
    "quality": [
      "Improve progressive disclosure by moving detailed examples to reference files",
      "Add more domain-specific edge cases for SCD handling"
    ],
    "cost": [
      "Skill size is optimal at 450 tokens",
      "Consider caching frequently-used patterns"
    ],
    "performance": [
      "Skill discovery time is excellent (<200ms)",
      "Progressive disclosure working well (2 levels loaded)"
    ]
  }
}
```

## Claude Best Practices Judge Prompt

Add a second judge specifically for Claude skill best practices:

```markdown
You are an expert evaluator assessing Claude Agent Skills against Anthropic's official best practices.

## Skill Content
{skill_content}

## Response Generated Using This Skill
{response}

## Evaluation Rubric

Score on these dimensions (1-5 scale):

1. **Progressive Disclosure** (1-5):
   - Does the skill have clear name/description for discovery?
   - Is core content in SKILL.md with details in references?
   - Is content organized for efficient loading?
   - 1=monolithic, 5=perfectly layered

2. **Structure & Organization** (1-5):
   - Is it organized like an onboarding guide?
   - Clear flow from overview to specifics?
   - Appropriate separation of concerns?
   - 1=chaotic, 5=exemplary structure

3. **Claude-Centric Design** (1-5):
   - Clear when to trigger the skill?
   - Unambiguous instructions?
   - Handles common failure modes?
   - Written from Claude's perspective?
   - 1=confusing, 5=perfectly clear

## Required Output Format

Return ONLY a JSON object:
{
  "progressive_disclosure": <int>,
  "structure_organization": <int>,
  "claude_centric_design": <int>,
  "explanation": "<2-3 sentences on compliance with Claude best practices>"
}
```

## Implementation Plan

### Phase 1: Enhanced Quality Evaluation (VD-535)
- Add Claude best practices judge
- Expand quality scoring to 7 dimensions
- Update judge prompts
- Test with all 4 skill types

### Phase 2: Cost Tracking (VD-536)
- Instrument token counting
- Calculate API costs
- Track skill size and loading
- Add cost efficiency metrics

### Phase 3: Performance Tracking (VD-537)
- Add latency measurement
- Track success/retry rates
- Measure skill discovery time
- Analyze progressive disclosure

### Phase 4: Multi-Perspective Reporting (VD-538)
- Implement perspective filtering
- Create comparison dashboards
- Add recommendations engine
- Document tradeoff analysis

## Success Criteria

A skill is considered "production-ready" if:
- **Quality**: Total score ≥ 28/35 (80%)
- **Claude Best Practices**: All 3 dimensions ≥ 4/5
- **Cost**: Cost per quality point ≤ $0.003
- **Performance**: Success rate ≥ 95%, latency ≤ 5s
- **Data Engineering**: All checks pass

## Validation Against Research

This framework aligns with industry best practices:
- ✅ Multi-dimensional quality (Confident AI, Braintrust)
- ✅ Cost tracking (Azure Databricks, Salesforce)
- ✅ Performance metrics (Galileo AI, CodeAnt)
- ✅ LLM-as-judge (Anthropic, OpenAI)
- ✅ Domain-specific validation (Alation SQL agents)
- ✅ Progressive disclosure (Anthropic Agent Skills)

## Next Steps

1. Review this framework with stakeholders
2. Prioritize which perspectives to implement first
3. Create Linear issues for each phase
4. Update VD-529 with expanded scope
