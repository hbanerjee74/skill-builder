#!/usr/bin/env bash
# fixtures.sh — Create test fixture directories for state detection and agent tests

# ---------- Core helpers ----------

_write_session_json() {
  local dir="$1" skill_name="$2" phase="$3"
  mkdir -p "$dir/.vibedata/$skill_name"
  cat > "$dir/.vibedata/$skill_name/session.json" << EOF
{
  "skill_name": "$skill_name",
  "skill_type": "domain",
  "domain": "Pet Store Analytics",
  "skill_dir": "./$skill_name/",
  "created_at": "2026-01-01T00:00:00Z",
  "last_activity": "2026-01-01T01:00:00Z",
  "current_phase": "$phase",
  "phases_completed": [],
  "mode": "guided",
  "research_dimensions_used": ["entities", "metrics"],
  "clarification_status": { "total_questions": 6, "answered": 0 },
  "auto_filled": false
}
EOF
}

_make_skill_dirs() {
  local dir="$1" skill_name="$2"
  mkdir -p "$dir/$skill_name/context"
  mkdir -p "$dir/$skill_name/references"
}

# ---------- State fixtures (T3) ----------

# fresh: empty workspace — no session.json, no artifacts
create_fixture_fresh() {
  local dir="$1"
  : # Nothing to create
}

# scoping: session.json only, context/ dirs exist but no artifact files
create_fixture_scoping() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "scoping"
  _make_skill_dirs "$dir" "$skill_name"
}

# research: session.json + clarifications.md with ALL answers empty
create_fixture_research() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "research"
  _make_skill_dirs "$dir" "$skill_name"
  cat > "$dir/$skill_name/context/clarifications.md" << 'EOF'
## Core Entities

### Q1: Primary entities
What are the primary business entities in pet store analytics?
A. Products, Customers, Transactions
B. Products, Customers, Transactions, Inventory
C. Other (please specify)
**Recommendation:** B
**Answer:**

### Q2: Customer segmentation
How do you segment customers?
A. By purchase frequency (one-time, repeat, loyal)
B. By pet type (dog, cat, exotic, multi-pet)
C. Both dimensions
**Recommendation:** C
**Answer:**

## Business Patterns

### Q3: Seasonal patterns
Does the business have strong seasonal patterns?
A. Yes, holiday-driven (Christmas, adoption events)
B. Yes, weather-driven (flea/tick season)
C. Both
**Recommendation:** C
**Answer:**

### Q4: Return policy
What is the return model for different product types?
A. Full refund within 30 days for all products
B. Exchange-only for live animals, refund for products
C. Custom policy by category
**Recommendation:** B
**Answer:**

## Data Modeling

### Q5: Source systems
What are the primary source systems?
A. Single POS system
B. POS + inventory management
C. POS + inventory + e-commerce
**Recommendation:** B
**Answer:**

### Q6: Multi-location
Is this single store or multi-location?
A. Single location
B. 2-5 locations
C. 5+ locations
**Recommendation:** B
**Answer:**
EOF
}

# clarification: session.json + clarifications.md with SOME answers filled
create_fixture_clarification() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "clarification"
  _make_skill_dirs "$dir" "$skill_name"
  cat > "$dir/$skill_name/context/clarifications.md" << 'EOF'
## Core Entities

### Q1: Primary entities
What are the primary business entities in pet store analytics?
A. Products, Customers, Transactions
B. Products, Customers, Transactions, Inventory
C. Other (please specify)
**Recommendation:** B
**Answer:** B — We track all four: Products, Customers, Transactions, Inventory

### Q2: Customer segmentation
How do you segment customers?
A. By purchase frequency (one-time, repeat, loyal)
B. By pet type (dog, cat, exotic, multi-pet)
C. Both dimensions
**Recommendation:** C
**Answer:** C — Both purchase frequency and pet type are important

## Business Patterns

### Q3: Seasonal patterns
Does the business have strong seasonal patterns?
A. Yes, holiday-driven (Christmas, adoption events)
B. Yes, weather-driven (flea/tick season)
C. Both
**Recommendation:** C
**Answer:** C — Both holiday and seasonal patterns apply

### Q4: Return policy
What is the return model for different product types?
A. Full refund within 30 days for all products
B. Exchange-only for live animals, refund for products
C. Custom policy by category
**Recommendation:** B
**Answer:**

## Data Modeling

### Q5: Source systems
What are the primary source systems?
A. Single POS system
B. POS + inventory management
C. POS + inventory + e-commerce
**Recommendation:** B
**Answer:**

### Q6: Multi-location
Is this single store or multi-location?
A. Single location
B. 2-5 locations
C. 5+ locations
**Recommendation:** B
**Answer:**
EOF
}

# refinement_pending: session.json + clarifications.md with unanswered #### Refinements section
create_fixture_refinement_pending() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "refinement_pending"
  _make_skill_dirs "$dir" "$skill_name"
  cat > "$dir/$skill_name/context/clarifications.md" << 'EOF'
## Core Entities

### Q1: Primary entities
What are the primary business entities in pet store analytics?
A. Products, Customers, Transactions
B. Products, Customers, Transactions, Inventory
C. Other (please specify)
**Recommendation:** B
**Answer:** B — We track all four

### Q2: Customer segmentation
How do you segment customers?
A. By purchase frequency
B. By pet type
C. Both dimensions
**Recommendation:** C
**Answer:** C — Both dimensions

#### Refinements

### R1: Inventory tracking granularity
How granular is inventory tracking?
A. SKU level only
B. SKU + location level
C. SKU + location + batch level
**Recommendation:** B
**Answer:**

### R2: Customer merge strategy
How are duplicate customer records handled across locations?
A. Each location maintains separate customer records
B. Customers are merged by email
C. Customers are merged by loyalty card number
**Recommendation:** B
**Answer:**
EOF
}

# refinement: session.json + clarifications.md with answered #### Refinements section
create_fixture_refinement() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "refinement"
  _make_skill_dirs "$dir" "$skill_name"
  cat > "$dir/$skill_name/context/clarifications.md" << 'EOF'
## Core Entities

### Q1: Primary entities
What are the primary business entities in pet store analytics?
A. Products, Customers, Transactions
B. Products, Customers, Transactions, Inventory
C. Other (please specify)
**Recommendation:** B
**Answer:** B — We track all four

### Q2: Customer segmentation
How do you segment customers?
A. By purchase frequency
B. By pet type
C. Both dimensions
**Recommendation:** C
**Answer:** C — Both dimensions

#### Refinements

### R1: Inventory tracking granularity
How granular is inventory tracking?
A. SKU level only
B. SKU + location level
C. SKU + location + batch level
**Recommendation:** B
**Answer:** B — SKU + location level is sufficient

### R2: Customer merge strategy
How are duplicate customer records handled across locations?
A. Each location maintains separate customer records
B. Customers are merged by email
C. Customers are merged by loyalty card number
**Recommendation:** B
**Answer:** B — Merge by email with loyalty card as fallback
EOF
}

# decisions: session.json + decisions.md present
create_fixture_decisions() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "decisions"
  _make_skill_dirs "$dir" "$skill_name"
  cat > "$dir/$skill_name/context/decisions.md" << 'EOF'
# Decisions: Pet Store Analytics

### D1: Entity scope
- **Question**: What are the primary business entities?
- **Decision**: Products, Customers, Transactions, Inventory
- **Implication**: Build four core dimension tables plus a fct_sales table

### D2: Customer segmentation
- **Question**: How do you segment customers?
- **Decision**: Both purchase frequency and pet type dimensions
- **Implication**: dim_customers needs frequency_tier and pet_type_primary fields

### D3: Seasonal handling
- **Question**: Does the business have strong seasonal patterns?
- **Decision**: Both holiday and weather-driven seasonality
- **Implication**: Date spine should include is_holiday_week and season flags

### D4: Return policy
- **Question**: What is the return model?
- **Decision**: Exchange-only for live animals, refund for products
- **Implication**: fct_transactions needs product_return_type to distinguish subtypes
EOF
}

# generation: session.json + skill-dir/SKILL.md exists
create_fixture_generation() {
  local dir="$1" skill_name="$2"
  create_fixture_decisions "$dir" "$skill_name"
  _write_session_json "$dir" "$skill_name" "generation"
  cat > "$dir/$skill_name/SKILL.md" << 'EOF'
---
name: Pet Store Analytics
description: Guides Claude to build silver and gold layer dbt models for pet store analytics
skill_type: domain
---

# Pet Store Analytics

This skill guides data engineers in building dbt models for pet store analytics domains.

## Core Entities
- dim_products — product hierarchy (department, category, SKU)
- dim_customers — customer profiles with segmentation
- dim_dates — date spine with seasonality flags
- fct_transactions — transaction facts with return_type

## Reference Files
- `references/entities.md` — entity definitions and grain
- `references/metrics.md` — KPI definitions and calculation rules
EOF
}

# validation: session.json + agent-validation-log.md + test-skill.md
create_fixture_validation() {
  local dir="$1" skill_name="$2"
  create_fixture_generation "$dir" "$skill_name"
  _write_session_json "$dir" "$skill_name" "validation"
  cat > "$dir/$skill_name/context/agent-validation-log.md" << 'EOF'
# Validation Log: Pet Store Analytics

## Quality Check Results

**Overall Score**: 82/100

### Passing
- [x] Frontmatter complete
- [x] Entity definitions clear
- [x] Metric formulas present

### Failing
- [ ] Missing grain documentation for fct_transactions
- [ ] No example SQL for date spine flags
EOF
  cat > "$dir/$skill_name/context/test-skill.md" << 'EOF'
# Test Skill Results: Pet Store Analytics

## Test Run Summary
**Status**: PARTIAL PASS
**Tests run**: 5
**Tests passed**: 4
**Tests failed**: 1

### Failed Test
- T3: grain documentation — skill mentions fct_transactions but does not specify grain
EOF
}

# ---------- T4 agent fixtures ----------

# T4.1: research-orchestrator — empty context dir for agent to populate
# Same state as scoping (session.json + dirs, no artifacts)
create_fixture_t4_research() {
  create_fixture_scoping "$1" "$2"
}

# T4.2: answer-evaluator — clarifications.md with some answers + workspace dir
create_fixture_t4_answer_evaluator() {
  create_fixture_clarification "$1" "$2"
}

# T4.3: confirm-decisions — fully answered clarifications for decisions agent
create_fixture_t4_workspace() {
  local dir="$1" skill_name="$2"
  _write_session_json "$dir" "$skill_name" "clarification"
  _make_skill_dirs "$dir" "$skill_name"
  cat > "$dir/$skill_name/context/clarifications.md" << 'EOF'
## Core Entities

### Q1: Primary entities
What are the primary business entities in pet store analytics?
A. Products, Customers, Transactions
B. Products, Customers, Transactions, Inventory
C. Other (please specify)
**Recommendation:** B
**Answer:** B — We track all four: Products, Customers, Transactions, and Inventory

### Q2: Customer segmentation
How do you segment customers?
A. By purchase frequency (one-time, repeat, loyal)
B. By pet type (dog, cat, exotic, multi-pet)
C. Both dimensions
**Recommendation:** C
**Answer:** C — Both purchase frequency and pet type are important segmentation dimensions

### Q3: Product hierarchy
How deep is the product hierarchy?
A. Two levels (category, product)
B. Three levels (department, category, product)
C. Four+ levels (department, category, subcategory, product)
**Recommendation:** B
**Answer:** B — Department > Category > Product (e.g., Dog Food > Dry Food > Brand X Adult)

## Business Patterns

### Q4: Seasonal patterns
Does the business have strong seasonal patterns?
A. Yes, holiday-driven (Christmas, adoption events)
B. Yes, weather-driven (flea/tick season, winter supplies)
C. Both holiday and weather seasonality
D. Minimal seasonality
**Recommendation:** C
**Answer:** C — Both holiday gifting peaks and seasonal health/weather product cycles

### Q5: Return and exchange policy
What is the return model for different product types?
A. Full refund within 30 days for all products
B. Exchange-only for live animals, refund for products
C. Custom policy by category
**Recommendation:** B
**Answer:** B — Live animals are exchange-only with health guarantee; products have 30-day returns

### Q6: Loyalty program structure
What does the loyalty program look like?
A. Points-based (earn per dollar, redeem for discounts)
B. Tier-based (bronze, silver, gold with escalating benefits)
C. Subscription model (monthly delivery with discounts)
D. No formal loyalty program
**Recommendation:** A
**Answer:** A — Points-based: 1 point per dollar, 100 points = $5 discount
EOF
}
