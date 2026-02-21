# Segmentation & Period Handling

## Focus
Captures segment definitions with exact breakpoints, fiscal calendar structure, snapshot timing, and cross-period rules that constrain metric calculations. Matters for skill quality because even correct formulas produce wrong answers when applied across the wrong segment boundaries or time periods.

## Research Approach
Investigate the concrete segmentation dimensions and breakpoints the organization uses — not just that segmentation exists, but the exact thresholds and compound criteria that define each segment. For period handling, determine the fiscal calendar structure (standard, 4-4-5, non-January start), how periods map to natural calendar boundaries, snapshot cadence and timing, and rules for records that span period boundaries (prorating, point-in-time attribution, period-end snapshotting).

## Delta Principle
Claude knows generic segmentation patterns and standard fiscal calendars. The delta is specific breakpoints (enterprise = 500+ employees AND $1M+ ACV), the customer's fiscal calendar (4-4-5? non-January fiscal year?), snapshot timing, and cross-period rules. Without knowing the segmentation, even correct formulas produce wrong answers.

## Success Criteria
Questions cover segment definitions, fiscal calendar, period handling, and snapshot cadence. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. What are the segmentation dimensions used in this domain (e.g., company size, ACV, geography, product line), and what are the exact breakpoint values for each?
2. Are segment definitions compound (e.g., must meet multiple criteria simultaneously), and which criteria take precedence when a record qualifies for more than one segment?
3. What is the fiscal calendar structure — standard calendar year, 4-4-5, non-January start — and how do fiscal periods map to natural calendar boundaries?
4. What is the snapshot cadence (daily, weekly, monthly, quarterly), and at what time of day or day of period are snapshots taken?
5. How are records that span period boundaries handled — prorated, attributed to open period, attributed to close period, or point-in-time snapshotted?
6. Are there cross-period rules that affect metric calculations (e.g., quota resets, carryover logic, period-close adjustments)?
7. Which segment and period definitions have changed over time, and how does the data model handle historical period logic that has since been updated?
