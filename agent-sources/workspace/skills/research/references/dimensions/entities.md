# Entity & Relationship

## Focus
Captures which entities to model, their relationships, cardinality patterns, and entity classification decisions specific to the customer's environment. Matters for skill quality because custom objects, managed package extensions, and non-obvious relationships determine what the skill must understand to produce correct output.

## Research Approach
Start from the domain and map out the full entity landscape. Probe for custom objects, managed package extensions, and non-obvious relationships that deviate from the standard model. Investigate entity classification decisions (dimension vs. fact, reference vs. transactional), grain choices at each entity level, and cross-entity join patterns.

## Delta Principle
Claude knows standard entity models (Salesforce objects, Kimball star schema, dbt resources). The delta is the customer's specific entity landscape: custom objects, managed package extensions, entity classifications (dimension vs. fact), grain decisions, and non-obvious relationships that do not appear in standard documentation.

## Success Criteria
Questions cover which entities to model, relationship depth, key cardinality decisions, and departures from textbook models. Each question has 2-4 specific, differentiated choices. Recommendations include clear reasoning tied to the domain context. Output contains 5-8 questions focused on decisions that change skill content.

## Questions to Research
1. Which entities in this domain require custom objects or managed package extensions beyond the standard model, and what relationships do they introduce?
2. How are entities classified — which are dimensions, which are facts, and which are reference vs. transactional — and do any entities serve dual roles?
3. What is the grain decision for each primary entity, and how do grain choices affect cross-entity join patterns?
4. Which entity relationships have non-obvious cardinality (many-to-many, polymorphic, or context-dependent cardinality)?
5. Are there entities that appear in the domain but should not be modeled as independent tables (e.g., should be attributes on another entity)?
6. Which cross-entity join patterns does the skill need to support, and do any require intermediate bridging entities?
7. What departures from the textbook model exist — which standard entities are missing, renamed, or replaced by custom equivalents?
