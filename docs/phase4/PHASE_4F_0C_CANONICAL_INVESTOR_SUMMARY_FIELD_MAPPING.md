# Phase 4F-0C Canonical Investor Summary Field Mapping

## Purpose
Document the authoritative source and safe fallback for each future Investor Summary field without adding runtime behavior, contracts, tests, or data mutations.

This phase is inspection-only. It locks the mapping decisions needed for the later pure mapper work.

## Repository Baseline

| Item | Value |
|---|---|
| Repo root | `repo root` |
| Branch | `main` |
| `HEAD` | `8b6f5bf0653152d13d883930608d0874858327f3` |
| `origin/main` | `8b6f5bf0653152d13d883930608d0874858327f3` |
| `origin` | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state | Only the pre-existing unstaged `.gitignore` modification remains |

### Sources inspected

- `lib/operator-command/saved-deals-repository.ts`
- `db/migrations/20260522_phase4a_saved_deals_table.sql`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/pipeline/route.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `app/api/saved-deals/[id]/tasks/route.ts`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/page.tsx`
- `lib/engine/analyze-deal-with-refurb.ts`
- `types/deal.ts`
- `lib/engine/due-diligence-engine.ts`
- `types/due-diligence.ts`
- `lib/engine/intelligence/investor-summary-engine.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/investor-shield/load-investor-shield-ui-model.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/investor-shield/investor-shield-ui-adapter.ts`
- `lib/investor-shield/guard-investor-shield-pipeline-movement.ts`
- `lib/investor-shield/default-gates.ts`
- `lib/investor-shield/persist-investor-shield-task-drafts.ts`
- `lib/investor-shield/build-investor-shield-task-drafts.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `types/evidence-lite.ts`
- `lib/evidence-lite/evidence-lite-validation.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/saved-deals-api-route.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/saved-deals-pipeline-route.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`
- `__tests__/investor-shield-read-model.test.ts`
- `__tests__/investor-shield-ui-adapter.test.ts`
- `__tests__/investor-shield-evaluator.test.ts`
- `__tests__/due-diligence-engine.test.ts`
- `__tests__/analyze-deal-with-refurb.test.ts`
- `__tests__/persist-investor-shield-task-drafts.test.ts`
- `__tests__/investor-shield-task-drafts.test.ts`

## Mapping Principles

- Persisted canonical values first.
- No deterministic recalculation in the summary layer.
- No duplicate Investor Shield evaluator.
- No governance softening.
- Explicit missing states only.
- Read-only summary behavior.
- Persisted engine JSON is authoritative when a field is only stored there.
- Do not derive offer-based or task-based substitutes for canonical deal fields.

## Saved-Deal Column Contract

| Column | TypeScript representation | Nullability | Serialization behavior | Canonical or cached/display |
|---|---|---|---|---|
| `address` | `string` | Not null in schema and create route | Stored as plain text, returned as-is | Canonical |
| `purchase_price` | `number \| null` | Nullable | JSON numeric or `null` | Canonical |
| `classification` | `string` | Not null in schema and create route | Stored as plain text, returned as-is | Canonical persisted decision |
| `governance_state` | `string` | Not null in schema and create route | Stored as plain text, returned as-is | Canonical persisted decision |
| `capital_protection_state` | `string` | Not null in schema and create route | Stored as plain text, returned as-is | Canonical persisted decision |
| `pipeline_state` | `string` | Not null in schema and create route | Stored as plain text, returned as-is | Canonical persisted state |
| `engine_result_json` | `Record<string, unknown>` | Not null in schema and create route | Stored as JSONB and passed through unchanged | Canonical persisted engine output |
| `risk_summary_json` | `Record<string, unknown>` | Not null in create flow, JSON object or `{}` | Stored as JSONB and passed through unchanged | Derived cached summary blob |
| `next_action` | `string \| null` | Nullable | Stored as plain text or `null` | Canonical persisted operator note |

## Address Mapping

- Authoritative source: `saved_deals.address`.
- Exact field: `SavedDealRecord.address` from `lib/operator-command/saved-deals-repository.ts`.
- Fallback: none.
- Empty/null behavior: schema and create route require a non-empty string, so missing address is invalid at write time; the summary should show an explicit unavailable state only if legacy data is missing.
- Do not reconstruct the address from listing data or other objects.

## Purchase Price Mapping

- Authoritative source: `saved_deals.purchase_price`.
- Exact field: `SavedDealRecord.purchase_price`.
- Numeric representation: `number` in TypeScript, nullable in the database and API.
- Fallback: none.
- Null behavior: render an explicit unavailable state such as `N/A` rather than deriving from offers.
- Display-state requirement: keep the value visibly absent when missing; do not substitute offer amounts or purchase-related engine values.

## GDV Range Mapping

- Authoritative source: persisted engine JSON only.
- Proven path: `saved_deals.engine_result_json.dueDiligence.gdvRange.downside`
- Proven path: `saved_deals.engine_result_json.dueDiligence.gdvRange.realistic`
- Proven path: `saved_deals.engine_result_json.dueDiligence.gdvRange.strong`
- Supporting types: `types/due-diligence.ts` and `lib/engine/due-diligence-engine.ts`.
- Save flow: `app/page.tsx` persists the full `analyzeDealWithRefurb()` result unchanged in `engine_result_json`.
- Classification: `CANONICAL RANGE AVAILABLE`
- Fallback: none.
- Missing-state behavior: if `dueDiligence` is absent, the range is unavailable and must not be synthesized from `gdv_realistic`.
- Safety note: do not calculate a new range and do not infer low/high values from one realistic value.

## True MAO Mapping

- Authoritative source: persisted engine JSON only.
- Preferred path: `saved_deals.engine_result_json.deal.trueMao.fifteenPercent`
- Preferred path: `saved_deals.engine_result_json.deal.trueMao.twentyPercent`
- Preferred path: `saved_deals.engine_result_json.deal.trueMao.twentyFivePercent`
- Secondary persisted copy when due diligence exists: `saved_deals.engine_result_json.dueDiligence.trueMAO.at15Percent`, `at20Percent`, `at25Percent`
- Numeric type: `number`
- Saved-deal column duplicate: none.
- Classification: `AVAILABLE ONLY IN ENGINE JSON`
- Fallback: none.
- Missing-state behavior: unavailable if the persisted engine JSON is missing or malformed; do not recalculate and do not use purchase price or offer amount.

## Classification Mapping

- Authoritative source: `saved_deals.classification`.
- Exact field: `SavedDealRecord.classification`.
- Canonical or cached/display: canonical persisted decision.
- Fallback: explicit unavailable state only if the legacy row is missing or blank.
- Safety note: do not recompute classification from engine JSON.

## Capital Protection Mapping

- Authoritative source: `saved_deals.capital_protection_state`.
- Exact field: `SavedDealRecord.capital_protection_state`.
- Canonical or cached/display: canonical persisted decision.
- Fallback: explicit unavailable state only if the legacy row is missing or blank.
- Safety note: do not infer capital protection from classification alone and do not soften blocked or no-go semantics.

## Investor Shield Status Mapping

- Authoritative source layer: `CANONICAL SHIELD READ MODEL`
- Exact source property: `InvestorShieldEnforcementResult.overallStatus`
- Loader path: `loadInvestorShieldEvaluationInput()` -> `evaluateInvestorShield()` -> `loadAndEvaluateInvestorShield()`
- Allowed status values: `CLEAR`, `CAUTION`, `BLOCKED`
- Required vs advisory handling: required/advisory split is already encoded in gate definitions and enforcement output; the summary must not re-evaluate gates.
- Null/unavailable behavior: if the read model cannot be loaded, the summary must show an explicit unavailable state and keep the deal read-only.
- Why this layer: it is the direct canonical enforcement result, before display decoration in the UI model.
- Safety note: Evidence Lite records alone must never mark the shield safe, and reviewed evidence alone must never waive or approve a gate.

## Blocked Gates Mapping

- Exact source property: `InvestorShieldEnforcementResult.blockingGateKeys`
- Ordering: preserved from the evaluator's canonical gate iteration order.
- Allowed contents: required gates only, not advisory-only warnings.
- Blocker-reason source: `InvestorShieldEnforcementResult.blockingReasons`
- Waiver treatment: waived gates remain blocked or cautionary according to canonical shield behavior; do not treat waived as satisfied.
- Empty-state meaning: no currently blocked gates.
- Safety note: do not derive blockers from Evidence Lite status and do not create a separate blocked-gate calculation.

## Missing Evidence Count Mapping

- Canonical source: `InvestorShieldEnforcementResult.missingEvidenceGateKeys`
- Filtering rule: gate-key count, not raw evidence-record count.
- Required/advisory treatment: current enforcement output counts gates with unresolved evidence requirements; advisory-only evidence warnings remain separate and do not create a raw evidence count.
- Duplicate handling: deduplicated by the evaluator through unique gate keys.
- Zero-state meaning: no missing gate-level evidence.
- Unavailable-state meaning: if shield evaluation fails, show unavailable rather than inventing a count.
- Decision: the current contracts support a gate-based missing-evidence count, so no new helper is needed in this phase.

## Active Tasks Mapping

- Exact source repository/list: `listTasksForDeal(dealId)` from `lib/operator-command/deal-tasks-repository.ts`
- Ordering: `created_at DESC`
- Current status values present in the repo: `OPEN`, `IN_PROGRESS`, `BLOCKED`, `COMPLETE`, `CANCELLED`
- Existing active-like semantics:
  - `app/page.tsx` uses a looser open-task count that excludes `COMPLETE` and `BLOCKED`
  - `persistInvestorShieldTaskDrafts()` treats tasks as open-like unless `task_status` is `COMPLETE` or `CANCELLED`
- Blocker tasks: no special repository-level active selector, but blocked tasks are still separate operational state.
- Maximum summary display behavior: not defined.
- Decision: a later pure selector is still needed because active-task semantics are currently split across consumers.

## Latest Offer Mapping

- Exact source repository/list: `listOffersForDeal(dealId)` from `lib/operator-command/deal-offers-repository.ts`
- Ordering rule: `created_at DESC`
- Exact latest-offer selection: first row in the ordered result
- Stable tie behavior: not separately defined beyond the SQL ordering
- Output fields required by Phase 4F: `offer_amount`, `offer_type`, `offer_status`, `offer_rationale`, `seller_response`, `created_at`
- No-offer behavior: explicit unavailable state
- Safety note: do not pick the highest offer instead of the latest offer and do not derive status from seller response.

## Recommended Next Action Precedence

1. Persisted canonical `saved_deals.next_action`, when non-empty and valid.
2. Existing canonical Shield recommendation only when the persisted next action is absent and the shield model provides a safe fallback.
3. Otherwise, explicit unavailable or none state.

Why this preserves governance:

- It keeps the operator-authored or persisted action in front.
- It avoids manufacturing a recommendation from raw evidence or offer data.
- It does not let advisory content override a required blocker.

## Existing Investor Summary Engine Decision

- Classification: `REUSE PARTIALLY`
- File: `lib/engine/intelligence/investor-summary-engine.ts`
- Why not direct reuse:
  - It is a Phase 2 summary helper, not a saved-deal read-model mapper.
  - It consumes governance, heat score, risk radar, strategy match, evidence status, and next actions rather than persisted saved-deal rows, offers, tasks, and shield output.
  - It does not expose the full Phase 4F field set.
- What can be reused later:
  - Text phrasing patterns and high-level summary structure only.
- Safety note: do not use it as the authoritative investor summary field mapper.

## Canonical Field Mapping Matrix

| Summary Field | Authoritative Source | Exact Field/Path | Derivation Allowed | Fallback | Missing-State Behavior | Safety Notes |
| --- | --- | --- | ---: | --- | --- | --- |
| Property address | Saved-deal row | `saved_deals.address` | No | None | Explicit unavailable only for legacy missing rows | Do not reconstruct from listing or engine data |
| Purchase price | Saved-deal row | `saved_deals.purchase_price` | No | None | `N/A` or explicit unavailable | Do not derive from offers |
| GDV range | Persisted engine JSON | `saved_deals.engine_result_json.dueDiligence.gdvRange.{downside,realistic,strong}` | No | None | Unavailable if `dueDiligence` absent or malformed | Do not synthesize endpoints |
| True MAO | Persisted engine JSON | `saved_deals.engine_result_json.deal.trueMao.{fifteenPercent,twentyPercent,twentyFivePercent}` | No | None | Unavailable if engine JSON missing or invalid | Do not recalculate |
| Capital protection status | Saved-deal row | `saved_deals.capital_protection_state` | No | None | Explicit unavailable only for legacy missing rows | Do not infer from classification |
| Deal classification | Saved-deal row | `saved_deals.classification` | No | None | Explicit unavailable only for legacy missing rows | Do not recompute from engine JSON |
| Investor Shield status | Canonical shield read model | `InvestorShieldEnforcementResult.overallStatus` | No | None | Unavailable if shield load/evaluation fails | Do not re-evaluate gates |
| Missing evidence count | Canonical shield read model | `InvestorShieldEnforcementResult.missingEvidenceGateKeys.length` | No | None | Unavailable if shield load/evaluation fails | Gate count only, not raw evidence count |
| Blocked gates | Canonical shield read model | `InvestorShieldEnforcementResult.blockingGateKeys` | No | None | Unavailable if shield load/evaluation fails | Advisory gates must not appear here |
| Active tasks | Task repository list | `listTasksForDeal(dealId)` | Yes, with later selector | None | Empty list or explicit unavailable | Current semantics are split; later pure selector needed |
| Latest offer status | Offer repository list | `listOffersForDeal(dealId)[0].offer_status` | No | None | Unavailable if there are no offers | Must remain latest-by-created-at |
| Recommended next action | Saved-deal row, then shield fallback | `saved_deals.next_action` then shield task recommendation title | Limited, only safe fallback | Shield recommendation title | Explicit unavailable or none | Do not concatenate conflicting actions |

## Future Mapper Input Boundaries

A future pure mapper will need only these canonical input groups:

- Saved-deal row/read model
- Parsed persisted engine result
- Canonical Investor Shield read model
- Safe evidence aggregation input or evidence records
- Task records
- Offer records

No repository SQL or direct persistence logic belongs in the mapper boundary.

## Remaining Decisions

- Active-task summary selector still needs a single pure helper because current semantics are split between the page, shield task drafting, and persistence dedupe.
- GDV range becomes unavailable when the persisted due-diligence section is missing; no fallback path should be added in this phase.
- True MAO has two persisted JSON copies; the summary should prefer `deal.trueMao` and treat the due-diligence copy as secondary supporting data only.
- If product later wants separate required-versus-advisory missing counts, that should be added in a later phase rather than inferred here.

## Explicit Non-Implementation

- No runtime code changed.
- No tests changed.
- No contract file created.
- No mapper created.
- No repository query created.
- No API route created.
- No UI created.
- No migration changed or executed.
- No SQL ran.
- No database mutation occurred.
- No environment changed.
- No redeploy occurred.
- Deterministic engine remained untouched.

## Verdict

`PHASE 4F-0C COMPLETE - READY FOR PHASE 4F-1A`

## Recommended Next Step

`Phase 4F-1A - Canonical Investor Summary Type Contracts`
