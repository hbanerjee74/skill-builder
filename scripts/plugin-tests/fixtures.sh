#!/usr/bin/env bash
# fixtures.sh — Create test fixture directories for mode detection and agent tests

# Mode A: Resume (context/ output files exist)
create_fixture_mode_a() {
  local dir="$1" skill_name="$2"
  mkdir -p "$dir/context"
  mkdir -p "$dir/$skill_name/references"

  cat > "$dir/context/research-entities.md" << 'EOF'
## Core Entities

### Q1: Primary entities
What are the primary business entities in pet store analytics?
A. Products, Customers, Transactions
B. Products, Customers, Transactions, Inventory
C. Other (please specify)
**Recommendation:** B
**Answer:** B — We track all four plus suppliers
EOF
}

# Mode B: Modify (skill exists, no workflow-state)
create_fixture_mode_b() {
  local dir="$1" skill_name="$2"
  mkdir -p "$dir/$skill_name/references"

  cat > "$dir/$skill_name/SKILL.md" << 'EOF'
# Pet Store Analytics

This skill helps data engineers build silver and gold layer models for pet store analytics domains.

## Key Entities
- Products (inventory items, categories, brands)
- Customers (profiles, loyalty, segments)
- Transactions (sales, returns, exchanges)
- Inventory (stock levels, reorder points, supplier lead times)

## Reference Files
- `references/entities.md` — Entity definitions and relationships
- `references/metrics.md` — KPI definitions and calculation logic
EOF

  cat > "$dir/$skill_name/references/entities.md" << 'EOF'
# Entities

## Products
Products are inventory items sold in pet stores. Key attributes include SKU, category, brand, species target, and price tier.

## Customers
Customer profiles track purchase history, pet ownership, and loyalty program membership.
EOF

  cat > "$dir/$skill_name/references/metrics.md" << 'EOF'
# Metrics

## Revenue Metrics
- Gross Revenue: Total sales before returns
- Net Revenue: Gross Revenue minus returns and discounts
- Average Transaction Value: Net Revenue / Transaction Count
EOF
}

# T4 fixture: Pre-populated workspace with answered clarifications for agent smoke tests
create_fixture_t4_workspace() {
  local dir="$1" skill_name="$2"

  mkdir -p "$dir/context"
  mkdir -p "$dir/$skill_name/references"

  # Answered concepts (Step 2 complete)
  cat > "$dir/context/research-entities.md" << 'EOF'
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
EOF

  # Merged clarifications (Steps 3-4 complete, answered in Step 5)
  cat > "$dir/context/clarifications.md" << 'EOF'
## Business Patterns

### Q1: Seasonal patterns
Does the business have strong seasonal patterns?
A. Yes, holiday-driven (Christmas, adoption events)
B. Yes, weather-driven (flea/tick season, winter supplies)
C. Both holiday and weather seasonality
D. Minimal seasonality
**Recommendation:** C
**Answer:** C — Both holiday gifting peaks and seasonal health/weather product cycles

### Q2: Return and exchange policy
What is the return model for different product types?
A. Full refund within 30 days for all products
B. Exchange-only for live animals, refund for products
C. Custom policy by category
**Recommendation:** B
**Answer:** B — Live animals are exchange-only with health guarantee; products have 30-day returns

### Q3: Loyalty program structure
What does the loyalty program look like?
A. Points-based (earn per dollar, redeem for discounts)
B. Tier-based (bronze, silver, gold with escalating benefits)
C. Subscription model (monthly delivery with discounts)
D. No formal loyalty program
**Recommendation:** A
**Answer:** A — Points-based: 1 point per dollar, 100 points = $5 discount

## Data Modeling

### Q4: Source systems
What are the primary source systems?
A. Single POS system
B. POS + separate inventory management system
C. POS + inventory + e-commerce platform
**Recommendation:** C
**Answer:** B — POS system (Lightspeed) plus inventory management (proprietary), no e-commerce yet

### Q5: Historical data depth
How far back does historical transaction data go?
A. Less than 1 year
B. 1-3 years
C. 3+ years
**Recommendation:** C
**Answer:** C — 5 years of transaction history available

### Q6: Multi-location
Is this a single store or multi-location?
A. Single location
B. 2-5 locations (small chain)
C. 5+ locations (regional chain)
**Recommendation:** B
**Answer:** B — 3 locations in the metro area, each with slightly different product mix
EOF
}

# T4 fixture: Four research files for consolidate-research agent testing
create_fixture_t4_consolidate() {
  local dir="$1"
  mkdir -p "$dir/context"

  cat > "$dir/context/research-entities.md" << 'EOF'
## Entity Research

### Q1: Seasonal patterns
Does the business have strong seasonal patterns?
A. Yes, holiday-driven (Christmas, adoption events)
B. Yes, weather-driven (flea/tick season, winter supplies)
C. Both
**Recommendation:** C
**Answer:**

### Q2: Return policy
What is the return model?
A. Full refund within 30 days
B. Exchange-only for live animals, refund for products
C. Custom policy
**Recommendation:** B
**Answer:**
EOF

  cat > "$dir/context/research-metrics.md" << 'EOF'
## Metrics Research

### Q1: Loyalty program
What does the loyalty program look like?
A. Points-based
B. Tier-based
C. Subscription model
D. No formal program
**Recommendation:** A
**Answer:**
EOF

  cat > "$dir/context/clarifications-practices.md" << 'EOF'
## Practice Research

### Q1: Source systems
What are the primary source systems?
A. Single POS
B. POS + inventory management
C. POS + inventory + e-commerce
**Recommendation:** C
**Answer:**

### Q2: Seasonal patterns
Are there seasonal trends in the data?
A. Yes, holiday-driven
B. Yes, weather-driven
C. Both
**Recommendation:** C
**Answer:**
EOF

  cat > "$dir/context/clarifications-implementation.md" << 'EOF'
## Implementation Research

### Q1: Historical data
How far back does data go?
A. Less than 1 year
B. 1-3 years
C. 3+ years
**Recommendation:** C
**Answer:**
EOF
}
