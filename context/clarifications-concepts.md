# Clarifications — Domain Concepts: Funds Transfer Pricing

## FTP Methodology Selection

### Q1: Primary FTP methodology
**Question**: Which FTP methodology does your institution primarily use (or plan to use) for allocating interest rate risk and measuring product profitability?
**Choices**:
  a) Matched-maturity FTP — each asset/liability gets a unique transfer rate based on its specific cash-flow profile and repricing characteristics, matched to a corresponding point on the funding curve
  b) Pool-rate (single-pool) FTP — all funds are priced at a single blended rate derived from the institution's average cost of funds
  c) Multiple-pool FTP — funds are grouped into pools by tenor bucket or product type, each pool has its own transfer rate
  d) Co-terminous FTP — transfer rate is locked at origination based on the instrument's contractual maturity, regardless of behavioral repricing
  e) Other / hybrid (please specify)
**Recommendation**: a) — Matched-maturity is the industry best practice endorsed by regulators and provides the most granular profitability measurement. It correctly separates interest rate risk from credit/liquidity risk at the instrument level.
**Answer**:

### Q2: Single-curve vs. multi-curve framework
**Question**: Does your FTP framework use a single yield curve or multiple curves for different purposes (e.g., separate curves for secured vs. unsecured funding, different currencies)?
**Choices**:
  a) Single curve — one base funding curve (e.g., treasury curve or swap curve) used for all transfer pricing
  b) Multi-curve — separate curves for secured funding, unsecured wholesale, retail deposits, multi-currency, etc.
  c) Not sure / still designing
**Recommendation**: b) — Post-2008 best practice uses multi-curve frameworks. A single curve conflates secured/unsecured funding costs and cannot properly price liquidity differences across funding sources.
**Answer**:

### Q3: Curve construction methodology
**Question**: What is your preferred base curve for FTP rate construction, and how are curve points interpolated?
**Choices**:
  a) Government bond curve (risk-free rate) with spreads layered on top
  b) Interest rate swap curve (SOFR/ESTR-based) as the base
  c) Institution's own cost-of-funds curve derived from actual funding transactions
  d) Blended approach — swap curve for longer tenors, money market rates for short end
  e) Other (please specify)
**Recommendation**: b) — Swap curves (now SOFR/ESTR-based post-LIBOR transition) are the most common base because they reflect market-observable term structure, are liquid across tenors, and cleanly separate the base rate from institution-specific spreads.
**Answer**:

## Transfer Rate Components & Spread Decomposition

### Q4: FTP spread components
**Question**: Which spread components does your FTP framework decompose beyond the base rate? Select all that should be modeled as distinct layers in the skill.
**Choices**:
  a) Base rate only (no decomposition) — single all-in transfer rate
  b) Base rate + liquidity premium + credit spread
  c) Base rate + liquidity premium + credit spread + optionality cost (prepayment/extension) + capital charge
  d) Full decomposition: base rate + liquidity premium (term + contingent) + credit spread + option cost + capital charge + operational cost allocation
  e) Other combination (please specify)
**Recommendation**: c) — This provides meaningful profitability attribution without over-engineering. It separates the four main economic components: interest rate risk (base rate), liquidity risk (premium), credit risk (spread), and behavioral risk (option cost), plus regulatory capital cost.
**Answer**:

### Q5: Liquidity premium methodology
**Question**: How should the liquidity premium component of the FTP rate be determined?
**Choices**:
  a) Term liquidity premium only — based on tenor of the instrument, derived from the spread between secured and unsecured funding curves
  b) Term + contingent liquidity premium — term premium for funded positions plus a charge for contingent liquidity obligations (credit lines, commitments)
  c) Regulatory-driven — liquidity premium calibrated to meet LCR/NSFR requirements, essentially pricing the cost of holding HQLA buffers
  d) Market-implied — derived from CDS-OIS basis or FRA-OIS spreads
  e) Other (please specify)
**Recommendation**: b) — Both term and contingent liquidity premiums are essential. Term premium prices the cost of stable funding; contingent premium prices the risk of drawdowns on commitments. Omitting either leads to mispriced products.
**Answer**:

### Q6: Optionality / behavioral adjustment treatment
**Question**: How should embedded options and behavioral adjustments (e.g., prepayment, early withdrawal, pipeline risk) be handled in the FTP framework?
**Choices**:
  a) Ignore — treat all instruments as if they run to contractual maturity
  b) Static behavioral assumptions — apply fixed prepayment/withdrawal rates based on historical averages
  c) Dynamic option-adjusted approach — use option-pricing models (e.g., Monte Carlo simulation) to price the cost of embedded optionality, adjusting FTP rates accordingly
  d) Blended — dynamic for material portfolios (mortgages, callable bonds), static for everything else
  e) Other (please specify)
**Recommendation**: d) — Full option-adjusted pricing for every product is prohibitively complex. Focus dynamic modeling on portfolios where optionality materially affects economics (mortgages, callable debt, lines of credit). Use static assumptions for products with low behavioral variance.
**Answer**:

## Product & Business Line Coverage

### Q7: Product scope
**Question**: Which product categories should the FTP skill cover in depth? Select the most important for your institution.
**Choices**:
  a) Traditional banking book only — loans (fixed/variable), deposits (term/demand/savings), interbank lending
  b) Banking book + treasury/investment portfolio — adds bond portfolios, repo/reverse-repo, derivatives used for hedging
  c) Full balance sheet — banking book + trading book + off-balance-sheet items (commitments, guarantees, derivatives)
  d) Focused on specific products (please specify which)
**Recommendation**: b) — Most FTP implementations focus on the banking book plus the investment portfolio, which captures the majority of NII-sensitive positions. Trading book items are typically managed separately under market risk frameworks.
**Answer**:

### Q8: Non-maturity deposit (NMD) modeling
**Question**: Non-maturity deposits (checking, savings, money market accounts) have no contractual maturity. How should they be modeled for FTP purposes?
**Choices**:
  a) Replicating portfolio approach — model NMDs as a portfolio of fixed-term instruments with a decay profile that replicates observed balance behavior
  b) Core/non-core split — separate stable "core" balances (long-duration, low rate sensitivity) from volatile "non-core" balances (short-duration, rate-sensitive)
  c) Regression-based behavioral model — use statistical models to estimate effective duration and rate sensitivity of deposit balances
  d) Simple assumption — assign a single weighted-average duration to all NMDs
  e) Other (please specify)
**Recommendation**: a) — Replicating portfolio is the most widely adopted approach because it transforms the ambiguous NMD profile into a concrete set of maturities that can be matched-maturity priced. It also aligns with regulatory expectations for IRRBB stress testing.
**Answer**:

### Q9: Profitability attribution granularity
**Question**: At what level of granularity should FTP-based profitability be measured and reported?
**Choices**:
  a) Business unit / division level only
  b) Product level within business units
  c) Account / instrument level (full allocation down to individual deals)
  d) Multi-dimensional — account level as the base, with roll-up capabilities by product, business unit, channel, geography, customer segment
  e) Other (please specify)
**Recommendation**: d) — Account-level FTP allocation with multi-dimensional roll-up provides maximum flexibility. It supports both granular product economics analysis and management reporting at any aggregation level.
**Answer**:

## ALM Integration & Risk Management

### Q10: ALM and FTP integration
**Question**: How tightly should the FTP framework integrate with Asset-Liability Management (ALM) processes?
**Choices**:
  a) Loosely coupled — FTP is primarily a profitability tool; ALM uses separate models for interest rate risk
  b) Shared curve infrastructure — FTP and ALM use the same yield curves and behavioral assumptions, but run in separate systems
  c) Fully integrated — FTP rates are derived directly from the ALM system's cash-flow engine, ensuring consistency between profitability measurement and risk management
  d) Other (please specify)
**Recommendation**: c) — Full integration ensures that the transfer rates used for profitability measurement are consistent with the rates used for risk management. Discrepancies between ALM and FTP curves are a common source of P&L attribution noise and management confusion.
**Answer**:

### Q11: Interest rate risk metrics
**Question**: Which interest rate risk metrics should the skill help users understand in the context of FTP?
**Choices**:
  a) NII sensitivity (earnings perspective) only — how NII changes under rate shocks
  b) EVE sensitivity (economic value perspective) only — how the present value of equity changes under rate shocks
  c) Both NII and EVE — dual perspective as required by IRRBB regulations
  d) Full suite — NII, EVE, duration of equity, basis point value, key rate durations, earnings-at-risk
  e) Other (please specify)
**Recommendation**: c) — Basel IRRBB standards require both NII and EVE perspectives. The skill should explain how FTP connects to both: NII sensitivity shows short-term earnings impact, while EVE shows long-term economic value impact.
**Answer**:

## Regulatory & Governance Considerations

### Q12: Regulatory framework alignment
**Question**: Which regulatory frameworks should the FTP skill address in terms of compliance requirements and best practices?
**Choices**:
  a) Basel III/IV IRRBB guidelines only
  b) Basel III/IV + local regulator requirements (e.g., Fed SR 10-1, EBA IRRBB guidelines, PRA expectations)
  c) Comprehensive — Basel + local regulators + accounting standards impact (IFRS 9 / CECL implications for FTP)
  d) Minimal — mention regulatory context but focus on business economics
  e) Other (please specify)
**Recommendation**: b) — The skill should cover Basel IRRBB as the universal baseline plus note where local regulators add requirements. This helps data engineers understand why certain fields and calculations exist in their FTP systems.
**Answer**:

### Q13: FTP governance and rate-setting process
**Question**: Should the skill cover FTP governance — i.e., the organizational process for setting, approving, and updating transfer rates?
**Choices**:
  a) Yes — include guidance on ALCO oversight, rate-setting frequency, exception processes, and governance data requirements
  b) Briefly — mention that governance exists and what data supports it, but don't elaborate on organizational structure
  c) No — focus purely on the quantitative/data aspects
**Recommendation**: b) — Data engineers need to understand that transfer rates go through an approval process (which affects data freshness, versioning, and audit trail requirements) but don't need detailed organizational design guidance.
**Answer**:

## Data Modeling Scope for FTP

### Q14: Key entities for FTP data modeling
**Question**: Which of the following do you consider the core entities that a data engineer building FTP models must understand?
**Choices**:
  a) Minimal set: instruments/accounts, transfer rates, yield curves, business units
  b) Standard set: instruments/accounts, transfer rates, yield curves, business units, products, customers, repricing schedules
  c) Comprehensive: all of (b) plus cash-flow schedules, behavioral assumptions, liquidity buckets, capital allocations, scenario definitions, curve histories
  d) Other (please specify)
**Recommendation**: c) — FTP is inherently multi-dimensional. Data engineers need to understand the full entity landscape even if not all entities exist in their implementation. Missing any of these can lead to incomplete or incorrect profitability models.
**Answer**:

### Q15: Historical vs. point-in-time FTP
**Question**: Should the skill cover historical/time-series FTP analysis, or focus only on current (point-in-time) transfer rates?
**Choices**:
  a) Point-in-time only — current transfer rates and current profitability
  b) Historical emphasis — track how transfer rates and profitability evolve over time, including vintage analysis
  c) Both with equal weight — current state for operational use, historical for trend analysis and model validation
  d) Other (please specify)
**Recommendation**: c) — Both perspectives are essential. Point-in-time supports daily operations and pricing decisions. Historical analysis supports performance trending, model backtesting, and regulatory reporting (many regulators require historical rate justification).
**Answer**:
