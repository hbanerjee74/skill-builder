# Stage 1: Source Skill Research Dimensions

> Divergent research output for the Source skill type.
> Identifies all research dimensions needed when building a source skill,
> evaluated against the delta principle and template section mapping.

---

## Source Skill Context

**Skill type**: Source (source-system-specific -- e.g., Salesforce, Stripe, QuickBooks, SAP, Oracle ERP)

**What source skills contain**: Source system object models, API extraction patterns, authentication flows, schema mapping rules, data quality gotchas, change detection strategies.

**Known template sections** (from synthesis Section 6.2):

1. Field Semantics and Overrides
2. Data Extraction Gotchas
3. Reconciliation Rules
4. State Machine and Lifecycle
5. System Workarounds
6. API/Integration Behaviors

**Key insight from synthesis**: Source skills are more seedable than domain skills because extraction patterns are procedural and less judgment-dependent. The genuine delta is in the procedural traps and platform-specific gotchas that produce silently wrong data -- not in object model descriptions or API syntax that Claude already knows.

**Bundle interaction relevance**: When source + domain skills operate together, research dimensions should surface knowledge relevant to the bundle contract's four dimensions: field-to-metric mapping, semantic translation rules, data quality contract, and refresh/timing alignment.

---

## Existing Catalog (Starting Point)

The current design in `dynamic-research-dimensions.md` assigns 5 dimensions to source skills:

| # | Slug | Name | Focus |
|---|------|------|-------|
| 1 | `entities` | Entity & Relationship Research | Source system objects, API resource hierarchies, data extraction entities, relationship mapping to warehouse targets |
| 2 | `extraction` | Data Extraction Research | Extraction patterns (bulk vs incremental vs streaming), API rate limit handling, webhook vs polling trade-offs, data delivery edge cases |
| 3 | `authentication` | Authentication & Access Research | Authentication mechanisms (OAuth 2.0, API keys, SAML), token refresh strategies, credential rotation, permission/scope management |
| 4 | `schema-mapping` | Schema Mapping Research | Source-to-target field mapping, data type coercion rules, schema evolution handling, source-specific data quality gotchas |
| 5 | `data-quality` | Data Quality Research | Source data quality assessment, extraction validation, schema conformance checks, handling missing or inconsistent source data |

---

## Evaluation of Existing Dimensions

### Dimension: `entities` -- RETAIN with Refined Focus

**Current focus**: "Source system objects, API resource hierarchies, data extraction entities, and relationship mapping to warehouse targets"

**Delta assessment**: Claude knows standard object models well (Salesforce Opportunity/Account/Contact, Oracle PO_HEADERS_ALL/PO_LINES_ALL). The synthesis explicitly lists "Salesforce standard object model" and "Oracle Purchasing table names and standard join relationships" as content Claude already knows and should NOT be included in skills.

However, Claude does NOT know:
- Which managed packages have injected custom objects that override or extend the standard model (Beta: Steelbrick CPQ, Clari, Gong each inject objects)
- Which custom objects are authoritative vs. derived (Beta: SBQQ__Quote__c.SBQQ__NetTotal__c is the real Amount, not Opportunity.Amount)
- How RecordTypes subdivide standard objects into semantically different entities (Beta: same Opportunity object represents New Business, Renewal, and Expansion with different lifecycle rules)
- Customer-specific object hierarchies with custom lookup relationships

**Verdict**: Retain, but the focus must steer away from standard model enumeration and toward discovering what departs from the standard model. The current focus line is too broad -- "source system objects" invites restating what Claude already knows.

**Refined focus**: "Focus on custom objects, managed package objects, record type subdivisions, and non-standard field overrides that depart from the platform's standard object model. Do NOT enumerate standard objects Claude already knows."

**Template sections informed**: Field Semantics and Overrides, State Machine and Lifecycle

**Example questions (Salesforce)**:
- "Which managed packages (CPQ, engagement scoring, forecasting tools) are installed, and which standard objects/fields do they override or extend?"
- "How many Opportunity record types exist, and what business meaning does each represent? Do they share the same stage progression?"
- "Are there custom objects that serve as the authoritative source for data that also exists on standard objects (e.g., a CPQ quote object that overrides Opportunity.Amount)?"

---

### Dimension: `extraction` -- RETAIN with Significant Refinement

**Current focus**: "Extraction patterns (bulk vs incremental vs streaming), API rate limit handling, webhook vs polling trade-offs, and data delivery edge cases"

**Delta assessment**: This is the highest-delta dimension for source skills. The synthesis identified multiple concrete failure modes where Claude's extraction guidance is unreliable:

- SystemModstamp vs. LastModifiedDate for CDC (~inconsistent Claude recommendations)
- queryAll() required for soft deletes (standard query() silently excludes IsDeleted records)
- ORG_ID filtering on PO_HEADERS_ALL (~4/10 Claude responses miss this)
- WHO column CDC limitation (parent timestamps miss child-record changes)
- Interface tables (*_INTERFACE) contain uncommitted transactions

However, the current focus mixes high-delta procedural traps with low-delta generic patterns. "Bulk vs incremental vs streaming" and "webhook vs polling trade-offs" are patterns Claude knows well from training data. The delta is in the platform-specific gotchas within each pattern, not the pattern selection itself.

**Verdict**: Retain, but refocus on platform-specific extraction traps rather than generic extraction pattern selection.

**Refined focus**: "Focus on platform-specific extraction traps that produce silently wrong data: CDC field selection (which timestamp field captures all changes), soft delete handling (API calls that miss deleted records), multi-tenant/multi-org filtering (queries that silently return cross-boundary data), and parent-child change propagation gaps. Do NOT research generic extraction patterns (bulk vs incremental) that Claude already knows."

**Template sections informed**: Data Extraction Gotchas, API/Integration Behaviors

**Example questions (Salesforce)**:
- "For incremental extraction, which timestamp field should be used: LastModifiedDate, SystemModstamp, or CreatedDate? Does your org have system-initiated changes (workflow rules, process builder, managed package writes) that update SystemModstamp but not LastModifiedDate?"
- "How does your org handle record deletion? Are soft deletes used? If so, is queryAll() configured in your extraction pipeline, or does standard query() silently exclude deleted records?"
- "Does your extraction pipeline need to capture records across all sharing contexts, or only records visible to a specific integration user? Are there governor limit concerns at your data volume?"

---

### Dimension: `authentication` -- REMOVE (Fails Delta Test)

**Current focus**: "Authentication mechanisms (OAuth 2.0, API keys, SAML), token refresh strategies, credential rotation, and permission/scope management"

**Delta assessment**: Claude has comprehensive knowledge of OAuth 2.0 flows, API key management, SAML, token refresh, and credential rotation patterns. This is well-documented, highly standardized content.

**Why it fails the delta test**:
1. **Claude already knows this**: OAuth 2.0 grant types, token refresh strategies, API key management, and credential rotation are extensively covered in Claude's training data. Asking "Does Salesforce use OAuth 2.0 or API keys?" produces a correct, detailed answer from Claude without any skill loaded.
2. **Questions are generic**: The same authentication questions apply identically to every Salesforce skill instance, every Stripe skill instance, etc. "What auth method does [platform] support?" has a single correct answer that Claude already knows.
3. **Answers don't change skill design**: Whether a platform uses OAuth 2.0 or API keys doesn't change the field semantics, extraction gotchas, reconciliation rules, state machines, workarounds, or API behaviors that the source skill template encodes. Authentication is operational infrastructure, not skill content.
4. **No template section mapping**: Authentication does not map to any of the 6 source template sections identified in the synthesis. It is not Field Semantics, Extraction Gotchas, Reconciliation, State Machine, Workarounds, or API Behaviors (the "API" section is about extraction method specifics and operational constraints, not auth flows).

**What goes wrong if included**: The dimension produces 5-8 questions about authentication that Claude can already answer correctly. These questions consume research bandwidth, add noise to the clarifications file, and risk knowledge suppression if the answers restate standard patterns. The consolidation agent must process and cross-reference authentication findings that contribute nothing to the skill's actual content sections.

**Counter-argument considered**: Permission/scope management (which API scopes are needed, which objects are accessible) could affect extraction completeness. However, this is better surfaced by the extraction dimension ("Does your integration user have visibility into all records you need to extract?") than by a dedicated authentication dimension. The permission question is about data access, not authentication mechanisms.

**Verdict**: Remove. Fold the one useful sub-question (permission/scope affecting data completeness) into the extraction dimension.

---

### Dimension: `schema-mapping` -- RESTRUCTURE into `field-semantics`

**Current focus**: "Source-to-target field mapping, data type coercion rules, schema evolution handling, and source-specific data quality gotchas"

**Delta assessment**: This dimension conflates two different things:

1. **Field semantic overrides** (high delta): Where standard fields mean something non-standard -- Beta's Opportunity.Amount being overridden by CPQ, Alpha's ATTRIBUTE7 meaning commodity code, ForecastCategory being independently editable from StageName. Claude cannot produce this from parametric knowledge because it's org-specific.

2. **Technical schema mapping** (low delta): Data type coercion (Salesforce Picklist to VARCHAR, Oracle DATE to TIMESTAMP), schema evolution handling (new fields appearing after API version changes). Claude knows standard type coercion rules and schema evolution patterns well.

The synthesis explicitly calls out field semantic overrides as a dedicated template section ("Field Semantics and Overrides") and lists concrete failure modes:
- CPQ overrides Opportunity.Amount
- ForecastCategory and StageName independently editable
- Flex field ATTRIBUTE columns with org-specific meanings
- RecordTypeId filtering affecting which records are included

**Verdict**: Rename and refocus to `field-semantics`. The high-delta content is about discovering where fields don't mean what they appear to mean. The low-delta technical mapping (type coercion, schema evolution) is either Claude parametric knowledge or is better handled by the extraction dimension.

**Refined focus**: "Focus on fields whose standard meaning is overridden or misleading in the customer's org: managed package field overrides, custom field authoritative sources, independently editable field pairs that appear synchronized, multi-valued fields (picklists, flex fields) with org-specific meanings, and record type subdivisions that change field semantics."

**Template sections informed**: Field Semantics and Overrides (primary), Reconciliation Rules (field disagreements surface reconciliation needs)

**Example questions (Salesforce)**:
- "For Opportunity.Amount: is this the authoritative deal value, or does a CPQ/quoting tool write the real amount to a different field? If so, which field is truth?"
- "Which fields are written by managed packages (CPQ, forecasting tools, engagement platforms) and may contain values different from what a user manually entered?"
- "Are ForecastCategory and StageName synchronized by automation, or can sales reps edit them independently? If independent, which is authoritative for pipeline reporting vs. forecast reporting?"
- "Do you use Person Accounts? If so, which fields on the hybrid Account/Contact record are authoritative for contact-level data?"

---

### Dimension: `data-quality` -- RETAIN with Sharpened Focus

**Current focus**: "Source data quality assessment, extraction validation, schema conformance checks, and handling missing or inconsistent source data"

**Delta assessment**: Generic data quality concepts (null checking, range validation, uniqueness constraints) are well-known to Claude. The delta for source skills is in:

1. **Platform-specific data quality traps**: Interface tables containing uncommitted transactions (Oracle), governor limits causing partial extraction (Salesforce), API pagination edge cases that silently drop records.
2. **Org-specific quality patterns**: Which fields are reliably populated vs. commonly null, which validation rules force incorrect data entry (workarounds that create quality problems), known data quality issues the customer compensates for.
3. **Cross-system reconciliation**: Where source system numbers disagree with downstream systems, and which is truth.

However, items 1 and 3 overlap significantly with the extraction and reconciliation-focused content of other dimensions. The unique contribution of data-quality is surfacing the customer's known quality issues and their compensating controls.

**Verdict**: Retain, but sharpen focus to avoid overlap with extraction (which covers extraction-specific traps) and the proposed reconciliation dimension.

**Refined focus**: "Focus on known data quality issues in the customer's source system: fields that are commonly null or unreliable, validation rules that force incorrect data entry, data cleanup jobs or compensating controls, and the customer's data quality expectations for downstream consumers."

**Template sections informed**: Data Extraction Gotchas (quality issues affecting extraction), System Workarounds (compensating controls)

**Example questions (Salesforce)**:
- "Which standard fields are unreliable in your org (commonly null, populated with placeholder values, or overwritten by automation)?"
- "Are there validation rules that force reps to enter data in a specific way that doesn't reflect reality (e.g., requiring a close date even for deals that are really TBD)?"
- "Does your org run scheduled data quality jobs (deduplication, field standardization, record merging)? How do these affect extraction timing?"
- "What null rate is acceptable for key fields (Amount, CloseDate, StageName) before downstream analysis should be flagged as unreliable?"

---

## New Dimensions Proposed

### Dimension: `change-detection` -- NEW

**Slug**: `change-detection`

**What it researches**: Surfaces the specific mechanisms for detecting what changed in the source system since the last extraction. This is distinct from extraction patterns (how to pull data) -- it's about which records have changed and how to detect that reliably. Different source systems have fundamentally different CDC mechanisms, and Claude's guidance is inconsistent on the correct one to use.

**Delta justification**: The synthesis identified this as a primary failure mode:
- **SystemModstamp vs. LastModifiedDate** -- Claude inconsistently recommends the correct timestamp field for Salesforce CDC. Tutorials commonly use LastModifiedDate, which misses system-initiated changes.
- **WHO column CDC limitation** -- Oracle's parent-table timestamps miss child-record changes. Claude knows WHO columns exist but doesn't reliably surface this limitation.
- **Soft delete detection** -- queryAll() vs. query() in Salesforce. Standard query() silently excludes deleted records, causing phantom record accumulation in the warehouse.
- **Multi-table change propagation** -- When a child record changes, does the parent record's timestamp update? (Often no.) This creates CDC blind spots.

These are NOT generic CDC concepts (Claude knows what CDC is). These are platform-specific gotchas where the "obvious" approach silently misses changes.

**Template sections informed**: Data Extraction Gotchas (primary), API/Integration Behaviors

**What goes wrong if skipped**: The extraction pipeline misses changes. Specifically:
- Using LastModifiedDate instead of SystemModstamp misses workflow-triggered updates, managed package writes, and admin mass updates.
- Using query() instead of queryAll() causes deleted records to persist as phantom records in the warehouse indefinitely.
- Relying on parent timestamps for CDC misses child-record changes (Oracle WHO column limitation), causing stale child data.
- These failures are completely silent -- no errors, no warnings, just quietly incomplete data.

**Example questions (Salesforce)**:
- "For incremental/CDC extraction: which timestamp field captures ALL changes including system-initiated ones? Is SystemModstamp or LastModifiedDate correct for your use case?"
- "How are record deletions handled? Does your extraction use queryAll() to capture soft deletes, or does it use standard query() (which silently excludes IsDeleted=true records)?"
- "For objects with parent-child relationships (e.g., Opportunity and OpportunityLineItem): when a child record changes, does the parent's SystemModstamp update? If not, how do you detect child-level changes?"
- "Are there automated processes (workflow rules, process builder flows, managed package background jobs) that modify records without updating LastModifiedDate?"

**Why this is a separate dimension from `extraction`**: Extraction covers *how* to pull data (bulk API, REST, direct DB, rate limits, pagination). Change detection covers *what* to pull -- specifically, which records have changed. These produce fundamentally different questions. An extraction dimension asking about Bulk API 2.0 vs. REST is a pattern selection question. A change detection dimension asking about SystemModstamp vs. LastModifiedDate is a correctness question where the wrong answer produces silently incomplete data.

---

### Dimension: `lifecycle-and-state` -- NEW

**Slug**: `lifecycle-and-state`

**What it researches**: Surfaces the record lifecycle patterns in the source system -- how records move through states, which state transitions are valid, where the customer has customized standard lifecycles, and what happens to records at lifecycle boundaries (archival, deletion, status changes).

**Delta justification**: The synthesis identified this as template section 4 ("State Machine and Lifecycle") but the existing dimension catalog has no dimension that directly researches it. The `entities` dimension covers what objects exist and their relationships, but not how records within those objects progress through states.

Concrete failure modes:
- **RecordTypeId filtering** -- Omitting RecordTypeId in Salesforce silently mixes deal types (New Business, Renewal, Expansion) that have different stage progressions. Claude doesn't consistently warn about this in multi-record-type orgs.
- **ForecastCategory/StageName independence** -- These fields appear to be synchronized but are independently editable. Pipeline reports using one and forecast reports using the other produce discrepant numbers. This is a lifecycle behavior (stage progression) that Claude doesn't reliably flag.
- **Custom stage progressions** -- Customers add, remove, or reorder stages. A skill that assumes standard stage names or progression order produces wrong pipeline analysis.
- **Soft delete vs. hard delete lifecycle** -- Some orgs use IsDeleted for soft deletes; others use custom Status fields. The lifecycle boundary behavior varies.

**Template sections informed**: State Machine and Lifecycle (primary), Field Semantics and Overrides (state fields that behave non-obviously), Reconciliation Rules (state disagreements between systems)

**What goes wrong if skipped**: The skill has no knowledge of how records actually progress through the system, leading to:
- Pipeline stage analysis that assumes a linear progression when the customer allows skipping or regression
- Reports that mix record types with different lifecycle rules into a single funnel
- Incorrect handling of "closed" records that can reopen
- Misunderstanding of what "deleted" means in the customer's org

**Example questions (Salesforce)**:
- "What are your Opportunity stages, in order? Can deals skip stages or regress to earlier stages? Is this behavior the same across all record types?"
- "How many record types exist for your key objects (Opportunity, Case, Lead)? Do different record types follow different stage progressions?"
- "When an Opportunity is 'Closed Won' or 'Closed Lost,' can it reopen? What triggers reopening?"
- "Does your org use soft deletes (IsDeleted), archive records, or move records to a 'dead' status? What should the extraction pipeline do with records at end-of-lifecycle?"

---

### Dimension: `managed-packages-and-customizations` -- NEW (Source-Specific)

**Slug**: `customizations`

**What it researches**: Surfaces the installed managed packages, ISV integrations, and org-specific customizations that extend or override the standard platform schema. This is the "managed package entropy" problem identified in the synthesis -- the unpredictable schema surface created by third-party packages.

**Delta justification**: This is the single highest-impact gap for source skills in heavily customized orgs. The synthesis identifies this explicitly:

- **Steelbrick CPQ** overrides Opportunity.Amount -- the "standard" field is wrong. SBQQ__Quote__c.SBQQ__NetTotal__c is the real deal value.
- **Clari** writes forecast values nightly to custom fields, overriding what reps entered.
- **Gong** injects activity data model objects.
- **Oracle custom concurrent programs** predate Fusion and have custom output formats.
- **Flex field repurposing** (ATTRIBUTE1-15 with org-specific meanings).

Claude knows that these platforms support customizations. Claude does NOT know which specific customizations a customer has installed, which standard fields they've overridden, or what the interaction effects between multiple managed packages are.

Agent D's analysis flags "managed package entropy" as a maintenance multiplier -- managed packages change on their vendor's release cadence, creating a second maintenance surface invisible to the skill author.

**Template sections informed**: Field Semantics and Overrides (primary -- managed packages override standard fields), System Workarounds (compensating for package behaviors), Data Extraction Gotchas (packages create non-standard extraction requirements)

**What goes wrong if skipped**: The skill assumes the standard object model when the customer's actual schema is substantially different:
- "Use Opportunity.Amount for deal value" is wrong when CPQ overrides it
- "ForecastCategory reflects the forecast" is wrong when Clari overwrites it nightly
- Extraction queries miss objects created by managed packages
- Schema assumptions break when managed packages update and change field structures

**Example questions (Salesforce)**:
- "Which managed packages are installed (CPQ, forecasting, engagement, territory management, data enrichment)? For each, which standard objects or fields does it override or extend?"
- "For your CPQ/quoting tool: which field contains the authoritative deal value? Is Opportunity.Amount still meaningful, or is it derived/overridden?"
- "Do any managed packages write to standard fields on a scheduled basis (e.g., a forecasting tool overwriting ForecastCategory nightly)?"
- "Have you created custom objects that replicate or extend standard object functionality (e.g., a custom Pipeline_Snapshot__c object alongside standard Opportunity)?"
- "When managed packages update, do you have a process for validating that extraction pipelines still work? Have package updates broken extraction in the past?"

---

### Dimension: `reconciliation` -- NEW

**Slug**: `reconciliation`

**What it researches**: Surfaces the cross-table, cross-module, and cross-system reconciliation points where data should agree but often doesn't. This directly populates template section 3 ("Reconciliation Rules").

**Delta justification**: No existing dimension directly addresses reconciliation. The synthesis calls it out as a template section, and the guided prompts include reconciliation-specific questions:
- "PO_DISTRIBUTIONS vs AP_INVOICE_DISTRIBUTIONS: which is truth?" (Oracle)
- "Where do SFDC pipeline numbers disagree with finance? Source of truth for bookings?" (Salesforce)

Claude knows about data reconciliation as a concept. Claude does NOT know:
- Which specific tables/objects in a customer's source system should agree but don't
- Which system is the source of truth when numbers disagree
- What tolerance levels are acceptable for reconciliation differences
- Where managed packages or custom integrations create reconciliation gaps

This dimension is particularly important for the bundle interaction contract. The "Data Quality Contract" dimension of the bundle requires knowing what the source system promises about data consistency -- this is exactly what reconciliation research surfaces.

**Template sections informed**: Reconciliation Rules (primary), Data Extraction Gotchas (reconciliation failures that affect extraction strategy)

**What goes wrong if skipped**: The skill has no guidance on which numbers to trust when they disagree:
- Pipeline totals from Salesforce don't match finance system totals -- the skill provides no guidance on resolution
- PO amounts from one Oracle table don't match invoice amounts from another -- the skill can't explain which is truth and why
- The bundle interaction contract's "Data Quality Contract" is empty -- the domain skill has no way to know what data quality the source guarantees

**Example questions (Salesforce)**:
- "Where do Salesforce pipeline numbers disagree with your finance system (ERP, billing tool)? Which is the source of truth for booked revenue?"
- "If Opportunity.Amount disagrees with the CPQ quote total, which number should downstream systems use?"
- "At what tolerance level should pipeline total discrepancies be flagged (e.g., within 1%, within $10K)?"
- "Are there known reconciliation gaps between Salesforce and other systems (marketing automation, customer success, support) that affect downstream analysis?"

---

## Dimensions Considered but Rejected

### `api-rate-limits` -- Rejected (Overlaps Extraction, Low Delta)

API rate limiting is well-documented for all major platforms. Claude knows Salesforce governor limits, Oracle API throttling, and Stripe rate limits. The platform-specific limits are in the documentation. The only delta is the customer's specific API allocation and whether they're near limits -- this is a single question within the extraction dimension, not a separate dimension.

### `data-freshness-and-timing` -- Rejected (Better Surfaced by Extraction + Bundle)

Data freshness SLAs and extraction timing are important but split across two concerns:
1. How fresh is the data in the source system? (surfaced by extraction: "What is the lag between a business event and the record appearing in the source?")
2. How does source extraction timing align with domain reporting periods? (surfaced by the bundle interaction contract's "Refresh and Timing Alignment")

A dedicated dimension would produce questions that either duplicate extraction or duplicate the bundle contract.

### `historical-data-and-archival` -- Rejected (Narrow, Single Question)

"Does your org archive or purge historical records? How far back does data go?" is a single question, not a dimension. It belongs within the extraction dimension's coverage of data completeness.

### `security-and-compliance` -- Rejected (Fails Delta Test)

Data security, field-level security, and compliance requirements (GDPR, SOX) are either:
- Standard platform capabilities Claude knows well (Salesforce field-level security, Oracle MOAC)
- Org-specific policies that are a single question ("Are there fields we cannot extract due to compliance?")
- Not skill content (operational infrastructure, not content that changes the skill's design)

---

## Proposed Source Dimension Catalog

### Final Dimension List

| # | Slug | Name | New/Retained | Key Change |
|---|------|------|--------------|------------|
| 1 | `entities` | Entity & Relationship Research | Retained | Refined focus: custom objects and departures from standard model, not standard model enumeration |
| 2 | `extraction` | Data Extraction Research | Retained | Narrowed: platform-specific extraction traps, not generic pattern selection |
| 3 | `field-semantics` | Field Semantic Override Research | Restructured (from `schema-mapping`) | Renamed, refocused on where fields don't mean what they appear to mean |
| 4 | `change-detection` | Change Detection Research | NEW | Platform-specific CDC mechanisms and their gotchas |
| 5 | `lifecycle-and-state` | Record Lifecycle & State Research | NEW | Record state machines, custom stage progressions, lifecycle boundaries |
| 6 | `customizations` | Managed Packages & Customizations Research | NEW | Installed packages, schema extensions, field overrides |
| 7 | `reconciliation` | Cross-System Reconciliation Research | NEW | Where numbers should agree but don't, source of truth resolution |
| 8 | `data-quality` | Source Data Quality Research | Retained | Sharpened: known quality issues and compensating controls |

### Dimensions Removed

| Slug | Name | Reason |
|------|------|--------|
| `authentication` | Authentication & Access Research | Fails delta test -- Claude knows auth patterns; questions are generic; answers don't change skill design; no template section mapping |
| `schema-mapping` | Schema Mapping Research | Restructured into `field-semantics` -- high-delta content (field overrides) separated from low-delta content (type coercion, schema evolution) |

---

## Detailed Dimension Specifications

### 1. `entities` -- Entity & Relationship Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-entities.md` |
| Role | Surface custom objects, managed package objects, record type subdivisions, and non-standard field overrides that depart from the platform's standard object model |
| Focus (source override) | Focus on custom objects, managed package objects, record type subdivisions, and non-standard relationships that depart from the platform's standard object model. Do NOT enumerate standard objects Claude already knows -- focus on what is different or non-obvious. |
| Output | Questions about which objects exist beyond the standard model, how record types subdivide standard objects, and which custom relationships affect extraction |
| Template sections | Field Semantics and Overrides, State Machine and Lifecycle |
| Used by | all types (focus varies per type) |

### 2. `extraction` -- Data Extraction Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-extraction.md` |
| Role | Surface platform-specific extraction traps that produce silently wrong data, not generic extraction pattern selection |
| Focus (source override) | Focus on platform-specific extraction traps: multi-tenant filtering (queries returning cross-boundary data), API pagination edge cases, governor limits at scale, partial extraction failures, and extraction method constraints (e.g., Bulk API limitations for certain object types). Fold in permission/scope concerns: does the integration user have visibility into all required records? |
| Output | Questions about extraction method constraints, known extraction traps, and data completeness risks |
| Template sections | Data Extraction Gotchas, API/Integration Behaviors |
| Used by | source only |

### 3. `field-semantics` -- Field Semantic Override Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-field-semantics.md` |
| Role | Surface fields whose standard meaning is overridden or misleading in the customer's org |
| Focus | Focus on managed package field overrides, custom field authoritative sources, independently editable field pairs that appear synchronized, multi-valued fields (picklists, flex fields) with org-specific meanings, and record type subdivisions that change field semantics. |
| Output | Questions about which standard fields have been overridden, which custom fields are authoritative, and where field meanings are non-obvious |
| Template sections | Field Semantics and Overrides (primary), Reconciliation Rules |
| Used by | source only |

### 4. `change-detection` -- Change Detection Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-change-detection.md` |
| Role | Surface the correct CDC/change detection mechanisms for the source platform and identify platform-specific gotchas where the obvious approach silently misses changes |
| Focus | Focus on platform-specific CDC mechanisms: which timestamp/version field captures ALL changes (including system-initiated), soft delete detection (API calls that miss deleted records), parent-child change propagation gaps, and automated processes that modify records without updating standard change tracking fields. |
| Output | Questions about CDC field selection, soft delete handling, change propagation completeness, and automated modification detection |
| Template sections | Data Extraction Gotchas (primary), API/Integration Behaviors |
| Used by | source only |

### 5. `lifecycle-and-state` -- Record Lifecycle & State Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-lifecycle-state.md` |
| Role | Surface record lifecycle patterns including state machines, custom stage progressions, lifecycle boundary behaviors, and record type-specific lifecycle variations |
| Focus | Focus on record state progressions (standard and custom stages), record type-specific lifecycle variations, stage skip/regression rules, lifecycle boundary behaviors (can closed records reopen? what does "deleted" mean?), and status field relationships (are stage and category synchronized or independent?). |
| Output | Questions about custom stage progressions, record type lifecycle differences, reopening rules, and end-of-lifecycle handling |
| Template sections | State Machine and Lifecycle (primary), Field Semantics and Overrides |
| Used by | source only |

### 6. `customizations` -- Managed Packages & Customizations Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-customizations.md` |
| Role | Surface installed managed packages, ISV integrations, and org-specific customizations that extend or override the standard platform schema |
| Focus | Focus on installed managed packages and their schema impact: which standard objects/fields do they override, what new objects do they create, do they write to standard fields on a schedule, and what happens when packages update. Also cover org-specific customizations: custom objects, custom fields on standard objects, and automation (workflow rules, flows, triggers) that modify data. |
| Output | Questions about installed packages, their field overrides, custom objects, and automation that affects data |
| Template sections | Field Semantics and Overrides, System Workarounds, Data Extraction Gotchas |
| Used by | source only |

### 7. `reconciliation` -- Cross-System Reconciliation Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-reconciliation.md` |
| Role | Surface cross-table, cross-module, and cross-system reconciliation points where data should agree but often doesn't |
| Focus | Focus on known data disagreements between tables/modules within the source system and between the source system and external systems. Identify which system/table is the source of truth for each data point, tolerance levels for reconciliation differences, and known gaps that downstream consumers must understand. |
| Output | Questions about which numbers disagree, source of truth resolution, tolerance levels, and known reconciliation gaps |
| Template sections | Reconciliation Rules (primary), Data Extraction Gotchas |
| Used by | source only |

### 8. `data-quality` -- Source Data Quality Research

| Field | Value |
|-------|-------|
| Agent file | `agents/shared/research-data-quality.md` |
| Role | Surface known data quality issues in the customer's source system and their compensating controls |
| Focus (source override) | Focus on known data quality issues: fields that are commonly null or unreliable, validation rules that force incorrect data entry, data cleanup jobs or compensating controls, and the customer's data quality expectations for downstream consumers. Do NOT research generic data quality concepts Claude already knows. |
| Output | Questions about known quality issues, compensating controls, and quality expectations |
| Template sections | Data Extraction Gotchas, System Workarounds |
| Used by | data-engineering, source (focus varies per type) |

---

## Overlap and Interaction Analysis

### Potential Overlaps

| Dimension Pair | Overlap Risk | Resolution |
|---------------|--------------|------------|
| `entities` + `customizations` | Both ask about custom objects | `entities` focuses on object relationships and record type subdivisions; `customizations` focuses on managed package impact and schema surface. The consolidation agent merges these. |
| `field-semantics` + `customizations` | Both surface field overrides | `field-semantics` asks "what does this field actually mean?"; `customizations` asks "which packages/automations modify this field?" Different angles on the same problem. |
| `extraction` + `change-detection` | Both relate to data extraction | `extraction` covers HOW to pull data (API method, rate limits, pagination); `change-detection` covers WHAT to pull (which records changed). Distinct questions. |
| `data-quality` + `reconciliation` | Both surface data issues | `data-quality` covers individual field reliability; `reconciliation` covers cross-table/cross-system consistency. Complementary, not overlapping. |

### Consolidation Agent's Role

The opus consolidation agent with extended thinking is where cross-dimensional synthesis happens. Expected cross-references:
- `customizations` findings inform `field-semantics` questions (which fields are overridden by packages)
- `lifecycle-and-state` findings inform `change-detection` questions (state transitions that don't update timestamps)
- `reconciliation` findings inform `data-quality` expectations (known disagreements set quality baselines)
- `entities` findings inform `extraction` scope (which objects need to be extracted)

---

## Bundle Interaction Relevance

For source + domain skill bundles, the following dimensions surface knowledge relevant to each bundle contract dimension:

| Bundle Contract Dimension | Source Dimensions Contributing |
|--------------------------|-------------------------------|
| **Field-to-Metric Mapping** | `field-semantics` (which source field actually contains the value the domain metric needs), `customizations` (managed package fields that override standard ones) |
| **Semantic Translation Rules** | `field-semantics` (where field meaning diverges from domain expectations), `entities` (custom objects with different semantics than standard ones) |
| **Data Quality Contract** | `data-quality` (known quality issues), `reconciliation` (which numbers to trust), `change-detection` (completeness guarantees) |
| **Refresh and Timing Alignment** | `extraction` (extraction cadence and freshness), `change-detection` (CDC lag and propagation timing) |

---

## Template Section Mapping Summary

| Dimension | Field Semantics | Extraction Gotchas | Reconciliation Rules | State Machine | System Workarounds | API/Integration |
|-----------|:-:|:-:|:-:|:-:|:-:|:-:|
| `entities` | P | - | - | S | - | - |
| `extraction` | - | P | - | - | - | S |
| `field-semantics` | P | - | S | - | - | - |
| `change-detection` | - | P | - | - | - | S |
| `lifecycle-and-state` | S | - | - | P | - | - |
| `customizations` | P | S | - | - | S | - |
| `reconciliation` | - | S | P | - | - | - |
| `data-quality` | - | S | - | - | S | - |

P = Primary mapping, S = Secondary mapping

---

## Comparison to Existing Catalog

| Change | Details | Justification |
|--------|---------|---------------|
| **Removed `authentication`** | Auth dimension eliminated entirely | Fails delta test: Claude knows auth patterns, questions are generic, answers don't change skill design, no template section mapping |
| **Restructured `schema-mapping` to `field-semantics`** | Renamed, refocused on field meaning overrides | High-delta content (field overrides) separated from low-delta content (type coercion). Directly maps to template section 1. |
| **Added `change-detection`** | New dimension for CDC mechanisms and gotchas | Synthesis failure modes (SystemModstamp, queryAll, WHO columns) all relate to change detection. Highest delta for source skills. |
| **Added `lifecycle-and-state`** | New dimension for record state machines | Template section 4 had no researching dimension. RecordTypeId filtering and ForecastCategory/StageName independence are lifecycle issues. |
| **Added `customizations`** | New dimension for managed package entropy | Synthesis repeatedly flags managed packages as the primary source of schema unpredictability. No existing dimension addresses this. |
| **Added `reconciliation`** | New dimension for cross-system data agreement | Template section 3 had no researching dimension. Critical for bundle interaction contract (Data Quality Contract). |
| **Refined `entities` focus** | Shifted from standard model to departures from standard model | Prevents restating knowledge Claude already has (suppression risk) |
| **Refined `extraction` focus** | Shifted from generic patterns to platform-specific traps | Prevents producing questions Claude can answer from parametric knowledge |
| **Refined `data-quality` focus** | Shifted from generic quality concepts to org-specific quality issues | Prevents overlap with Claude's existing knowledge of data quality frameworks |
| **Net change: 5 dimensions to 8 dimensions** | +4 new, -1 removed, -1 restructured | Each new dimension maps to a template section that previously had no researching dimension, or surfaces a concrete failure mode from the synthesis |

---

## Agent Count Impact

Current: 5 source dimensions (entities, extraction, authentication, schema-mapping, data-quality)
Proposed: 8 source dimensions (entities, extraction, field-semantics, change-detection, lifecycle-and-state, customizations, reconciliation, data-quality)

Net impact on shared agents:
- Remove: `research-authentication.md` (if no other type uses it -- currently source-only)
- Remove: `research-schema-mapping.md` (if no other type uses it -- currently source-only)
- Add: `research-field-semantics.md`
- Add: `research-change-detection.md`
- Add: `research-lifecycle-state.md`
- Add: `research-customizations.md`
- Add: `research-reconciliation.md`

Net new shared agents: +3 (5 added, 2 removed)

Total shared agent count: 14 (current) + 3 = 17

This keeps the agent count manageable while ensuring every template section has at least one dimension researching it and every concrete failure mode from the synthesis is covered by a dedicated dimension.
