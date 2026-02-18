---
skill_name: mock-skill
skill_type: domain
companions:
  - name: Salesforce Extraction
    slug: salesforce-extraction
    type: source
    dimension: field-semantics
    dimension_score: 3
    priority: high
    reason: "Field semantics scored 3 — Salesforce field overrides and custom objects need extraction-grade knowledge that Claude's parametric knowledge doesn't cover well"
    trigger_description: "Source system knowledge for Salesforce data extraction. Use when building ETL pipelines from Salesforce, mapping custom objects, or handling field-level security and sharing rules."
    template_match: null
  - name: dbt on Fabric
    slug: dbt-on-fabric
    type: platform
    dimension: config-patterns
    dimension_score: 2
    priority: medium
    reason: "Config patterns scored 2 — dbt adapter-specific behaviors on Fabric (CU economics, Direct Lake compatibility) are non-obvious"
    trigger_description: "Implementation decisions for running dbt projects on Microsoft Fabric. Use when configuring materializations, choosing incremental strategies, or optimizing CU consumption."
    template_match: null
  - name: Revenue Recognition Patterns
    slug: revenue-recognition-patterns
    type: data-engineering
    dimension: historization
    dimension_score: 3
    priority: low
    reason: "Historization scored 3 — SCD patterns for revenue recognition periods are somewhat standard but have domain-specific nuances"
    trigger_description: "Data engineering patterns for revenue recognition temporal modeling. Use when implementing SCD Type 2 for contract changes, deferred revenue tracking, or multi-element arrangements."
    template_match: null
---

# Companion Skill Recommendations

Based on the research planner's dimension scores and the current skill's scope, these companion skills would fill knowledge gaps left by skipped dimensions.

## 1. Salesforce Extraction (source skill)

**Priority**: High | **Dimension**: field-semantics (score: 3)

**Why**: The field-semantics dimension scored 3 during research planning — Salesforce field overrides and custom objects need extraction-grade knowledge that Claude's parametric knowledge doesn't cover well. This companion would provide the source system context that the current domain skill references but doesn't deeply cover.

**Suggested trigger**: Source system knowledge for Salesforce data extraction. Use when building ETL pipelines from Salesforce, mapping custom objects, or handling field-level security and sharing rules.

**Template match**: No matching template found

## 2. dbt on Fabric (platform skill)

**Priority**: Medium | **Dimension**: config-patterns (score: 2)

**Why**: The config-patterns dimension scored 2 — dbt adapter-specific behaviors on Fabric (CU economics, Direct Lake compatibility) are non-obvious. While the current skill covers domain logic, platform-specific implementation decisions would benefit from dedicated guidance.

**Suggested trigger**: Implementation decisions for running dbt projects on Microsoft Fabric. Use when configuring materializations, choosing incremental strategies, or optimizing CU consumption.

**Template match**: No matching template found

## 3. Revenue Recognition Patterns (data-engineering skill)

**Priority**: Low | **Dimension**: historization (score: 3)

**Why**: The historization dimension scored 3 — SCD patterns for revenue recognition periods are somewhat standard but have domain-specific nuances. Claude covers the basics well, but the intersection of revenue recognition business rules with temporal modeling patterns has enough delta to warrant a companion.

**Suggested trigger**: Data engineering patterns for revenue recognition temporal modeling. Use when implementing SCD Type 2 for contract changes, deferred revenue tracking, or multi-element arrangements.

**Template match**: No matching template found
