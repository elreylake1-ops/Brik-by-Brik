# Phase 5B-1A Deal Formulation Canonical Source Audit

## Purpose

Lock the existing canonical sources for a future pure Deal Formulation composer before any implementation begins.

This audit is documentation-only. It does not add a composer, UI, route, database access, or runtime types.

## Repository Baseline

- repository: `Brik-by-Brik`
- branch: `phase5b-1a-deal-formulation-source-audit`
- `HEAD`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- `origin/main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- origin: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- working tree at audit start: clean
- note: `.code-review-graph/graph.db` is absent, so graph-first audit fell back to direct source inspection

## Frozen Phase 5A Branches

- `phase5a-4c-investor-review-professional-gateway`
  - frozen remote commit: `c945e3e11771ce6ee33e0457da966e1f58815fd8`
- `phase5a-5b-professional-readiness-investor-review`
  - frozen remote commit: `5ade84138727a489390a6eab958e3f399af95f0f`

Both branches remained read-only during this audit.

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `README.md`
- `docs/validation/phase2-validation-plan.md`
- `docs/phase4/PHASE_4_COMPLETION_BLOCK_2A2_INVESTOR_SUMMARY_DATA_CONTRACT_AUDIT.md`
- `docs/phase4/PHASE_4F_2A_PURE_CANONICAL_INVESTOR_SUMMARY_MAPPER.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `types/deal.ts`
- `types/due-diligence.ts`
- `types/investor-summary.ts`
- `types/operator-command.ts`
- `types/phase2.ts`
- `types/phase2-governance.ts`
- `types/phase3-authority.ts`
- `lib/calculations.ts`
- `lib/engine/analyze-deal-with-refurb.ts`
- `lib/engine/due-diligence-engine.ts`
- `lib/engine/governance/apply-governance.ts`
- `lib/engine/intelligence/build-phase2-analysis.ts`
- `lib/engine/intelligence/investor-summary-engine.ts`
- `lib/engine/intelligence/negotiation-position-engine.ts`
- `lib/engine/intelligence/next-action-priority-engine.ts`
- `lib/engine/intelligence/strategy-match-engine.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/evaluate-operator-guard.ts`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `app/page.tsx`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `app/api/saved-deals/[id]/pipeline/route.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/investor-summary-repository.test.ts`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/investor-summary-panel.test.tsx`

## Locked Formula and Authority Boundaries

- `lib/calculations.ts` is canonical source for:
  - finance cost
  - total cost
  - profit
  - profit margin
  - True MAO band calculations
- `lib/engine/analyze-deal-with-refurb.ts` is canonical source for persisted saved-deal `engine_result_json` shape:
  - `deal`
  - `dueDiligence`
  - `verdict`
  - `confidence`
  - refurb/timeline/warnings metadata
- `lib/engine/due-diligence-engine.ts` is canonical source for:
  - GDV range
  - capital protection status
  - due-diligence deal classification
  - due-diligence strategy recommendation
  - due-diligence scenario-level profit and margin
- `lib/engine/intelligence/build-phase2-analysis.ts` is canonical source for Phase 2:
  - raw scoring
  - governance output
  - phase-2 strategy match
  - phase-2 next actions
  - phase-2 investor summary text
- current saved-deal persistence on `main` does not store `Phase2AnalysisOutput`; it stores `DealWithRefurbResult`
- `types/phase3-authority.ts` locks constitutional precedence:
  - `deterministic_governance`
  - `capital_protection`
  - `deal_classification`
  - `workflow_orchestration`
  - `evidence_advisory`
  - `ui_presentation`
- permanent doctrine remains:

`Advisory outputs may increase review burden, but they may not reduce deterministic risk.`

Locked Phase 5B boundaries:

- no finance recalculation
- no profit recalculation
- no True MAO recalculation
- no ROI invention
- no offer-ladder invention
- no classification replacement from advisory state
- no Investor Shield override of deterministic financial outputs
- no readiness or Evidence Lite influence on financial outputs

## Canonical Saved-Deal Fields

Canonical persisted record comes from `SavedDealRecord` in `lib/operator-command/saved-deals-repository.ts`.

### Top-level persisted fields

| Field | Exact Path | Source File | Notes |
| --- | --- | --- | --- |
| deal id | `SavedDealRecord.id` | `lib/operator-command/saved-deals-repository.ts` | canonical saved-deal identity |
| address | `SavedDealRecord.address` | `lib/operator-command/saved-deals-repository.ts` | canonical property label source |
| purchase price | `SavedDealRecord.purchase_price` | `lib/operator-command/saved-deals-repository.ts` | canonical persisted scalar |
| GDV realistic | `SavedDealRecord.gdv_realistic` | `lib/operator-command/saved-deals-repository.ts` | canonical persisted scalar |
| refurb cost | `SavedDealRecord.refurb_cost` | `lib/operator-command/saved-deals-repository.ts` | canonical persisted scalar |
| classification | `SavedDealRecord.classification` | `lib/operator-command/saved-deals-repository.ts` | persisted field, but currently overloaded by save flow |
| governance | `SavedDealRecord.governance_state` | `lib/operator-command/saved-deals-repository.ts` | current persisted workflow-governance label |
| capital protection | `SavedDealRecord.capital_protection_state` | `lib/operator-command/saved-deals-repository.ts` | persisted scalar |
| pipeline | `SavedDealRecord.pipeline_state` | `lib/operator-command/saved-deals-repository.ts` | canonical workflow state |
| engine payload | `SavedDealRecord.engine_result_json` | `lib/operator-command/saved-deals-repository.ts` | canonical nested deterministic payload |
| risk payload | `SavedDealRecord.risk_summary_json` | `lib/operator-command/saved-deals-repository.ts` | warnings/risk summary only |
| next action | `SavedDealRecord.next_action` | `lib/operator-command/saved-deals-repository.ts` | persisted text, nullable |

### Nested deterministic fields already available inside `engine_result_json`

| Output Area | Exact Path | Canonical Status |
| --- | --- | --- |
| finance cost | `engine_result_json.deal.financeCost.totalFinanceCost` | confirmed |
| finance breakdown | `engine_result_json.deal.financeCost.{interest,arrangementFee,exitFee}` | confirmed |
| total investment | `engine_result_json.deal.totalCost` | confirmed |
| projected profit | `engine_result_json.deal.profit` | confirmed |
| profit margin | `engine_result_json.deal.profitMargin` | confirmed |
| True MAO bands | `engine_result_json.deal.trueMao.{fifteenPercent,twentyPercent,twentyFivePercent}` | confirmed |
| verdict | `engine_result_json.verdict.{status,reason,checks}` | confirmed |
| GDV range | `engine_result_json.dueDiligence.gdvRange.{downside,realistic,strong}` | confirmed when due diligence exists |
| capital protection | `engine_result_json.dueDiligence.decision.capitalProtectionStatus` | confirmed when due diligence exists |
| due-diligence classification | `engine_result_json.dueDiligence.decision.dealClassification` | confirmed when due diligence exists |
| strategy | `engine_result_json.dueDiligence.decision.strategyRecommendation` | confirmed when due diligence exists |
| risk flags | `engine_result_json.dueDiligence.decision.riskFlags` | confirmed when due diligence exists |
| due-diligence inputs | `engine_result_json.dueDiligence.inputs.{stampDuty,legalCosts,saleCosts,bridgeTermMonths,purchasePrice,gdvRealistic,refurbCost}` | confirmed when due diligence exists |
| due-diligence profit scenarios | `engine_result_json.dueDiligence.dealSummary.{profitDownside,profitRealistic,profitStrong,profitMarginDownside,profitMarginRealistic,profitMarginStrong,totalCost}` | confirmed when due diligence exists |

### Save-flow provenance

`app/page.tsx` currently persists:

- `classification = result.dueDiligence?.decision.dealClassification ?? result.verdict.status`
- `governance_state = result.verdict.status`
- `capital_protection_state = result.dueDiligence?.decision.capitalProtectionStatus ?? "UNKNOWN"`
- `engine_result_json = result`
- `next_action = saveNextAction.trim() || null`

This means:

- core financial payload is persisted from `DealWithRefurbResult`
- `classification` currently mixes due-diligence classification labels and verdict-status labels
- `next_action` is persisted operator text, not derived from Phase 2 next-action helpers

## Deterministic Engine Output Inventory

| Output | Canonical Source | Exact Field or Helper | Stored or Derived | Nullable | May Phase 5B Recalculate |
| --- | --- | --- | --- | ---: | ---: |
| purchase price | saved-deal record | `SavedDealRecord.purchase_price` | stored | Yes | No |
| GDV | Investor Summary reusable normalized field, sourced from saved engine payload | `investorSummary.gdvRange.realistic` <- `engine_result_json.dueDiligence.gdvRange.realistic` | derived from stored payload | Yes | No |
| refurbishment cost | saved-deal record | `SavedDealRecord.refurb_cost` | stored | Yes | No |
| finance cost | saved engine payload | `engine_result_json.deal.financeCost.totalFinanceCost` | stored | Yes when payload/path missing | No |
| fees / acquisition cost components | saved engine payload | `engine_result_json.dueDiligence.inputs.{stampDuty,legalCosts,saleCosts}` | stored | Yes when due diligence missing | No |
| acquisition costs aggregate | no canonical aggregate field exists today | none | unavailable without derivation | Yes | No |
| total investment | saved engine payload | `engine_result_json.deal.totalCost` | stored | Yes when payload/path missing | No |
| projected profit | saved engine payload | `engine_result_json.deal.profit` | stored | Yes when payload/path missing | No |
| ROI | no canonical engine output exists | none | unavailable | Yes | No |
| profit margin | saved engine payload | `engine_result_json.deal.profitMargin` | stored | Yes when payload/path missing | No |
| True MAO 15% | saved engine payload | `engine_result_json.deal.trueMao.fifteenPercent` | stored | Yes when payload/path missing | No |
| True MAO 20% | saved engine payload | `engine_result_json.deal.trueMao.twentyPercent` | stored | Yes when payload/path missing | No |
| True MAO 25% | saved engine payload | `engine_result_json.deal.trueMao.twentyFivePercent` | stored | Yes when payload/path missing | No |
| verdict | saved engine payload | `engine_result_json.verdict.status` | stored | Yes when payload/path missing | No |
| classification | persisted saved-deal field, with nested due-diligence provenance | `SavedDealRecord.classification`; more precise nested source: `engine_result_json.dueDiligence.decision.dealClassification` | stored | No top-level; nested source nullable | No |
| capital-protection result | persisted saved-deal field, with nested due-diligence provenance | `SavedDealRecord.capital_protection_state`; nested provenance: `engine_result_json.dueDiligence.decision.capitalProtectionStatus` | stored | No top-level; nested source nullable | No |
| strategy | saved engine payload | `engine_result_json.dueDiligence.decision.strategyRecommendation` | stored | Yes when due diligence missing | No |
| recommended next action | canonical Investor Summary reuse when available; raw persisted fallback exists | `investorSummary.recommendedNextAction.actionText`; raw persisted field `SavedDealRecord.next_action` | derived from stored + shield fallback / or stored raw | Yes | No |

Key audit outcome:

- core deterministic financial outputs are already persisted
- ROI is not implemented anywhere in the repository
- acquisition-cost aggregate is not stored as one canonical figure
- a future Phase 5B composer may expose fee components separately, but must not aggregate them unless a canonical helper already exists

## True MAO Source Audit

- exact type: `TrueMaoBreakdown`
- exact file path: `types/deal.ts`
- exact persisted field: `engine_result_json.deal.trueMao`
- exact calculation helper: `calculateTrueMao(...)`
- calculated in: `lib/calculations.ts`
- stored through: `analyzeDeal(...)` -> `DealResult.trueMao` -> `analyzeDealWithRefurb(...)` -> persisted `engine_result_json`
- missing or malformed representation:
  - repository extraction helpers already treat malformed nested values as `null`
  - `InvestorSummaryViewModel.trueMao.{fifteenPercent,twentyPercent,twentyFivePercent}` is `number | null`
- multiple MAO bands exist:
  - `fifteenPercent`
  - `twentyPercent`
  - `twentyFivePercent`
- investor-facing usage today:
  - `components/investor-summary/InvestorSummaryPanel.tsx` displays all three bands
  - `lib/investor-review/map-pdf-evidence-pack-to-investor-review.ts` maps all three bands
  - `lib/engine/analyze-deal-with-refurb.ts` uses `twentyPercent` and `fifteenPercent` in verdict checks
- no current singular canonical `trueMao.amount` field exists
- no current canonical `max_safe_offer` is derived from True MAO in saved-deal runtime
- `app/api/saved-deals/[id]/pipeline/route.ts` passes `max_safe_offer: null` into guard evaluation

Authority classification:

`CANONICAL SOURCE PARTIALLY CONFIRMED`

Reason:

- source path and formula are fully proven
- but no single investor-facing authoritative MAO band is locked today
- existing investor-facing surfaces expose three bands, while verdict logic gives operational significance to the 20% and 15% bands

Phase 5B implication:

- do not collapse True MAO into one amount unless Phase 5B explicitly documents which existing band is being reused
- safest repo-compatible output is a three-band `trueMao` object, not a new singular value

## Offer and Negotiation Source Audit

### Existing persisted offer information

- offer repository:
  - `lib/operator-command/deal-offers-repository.ts`
- offer route:
  - `app/api/saved-deals/[id]/offers/route.ts`
- exact persisted fields on `DealOfferRecord`:
  - `id`
  - `deal_id`
  - `offer_amount`
  - `offer_type`
  - `offer_status`
  - `offer_rationale`
  - `seller_response`
  - `created_at`
- canonical latest-offer selector:
  - `selectLatestInvestorSummaryOffer(...)` in `lib/investor-summary/select-latest-investor-summary-offer.ts`
- latest-offer rule:
  - selector returns `offers[0]`
  - repository orders `listOffersForDeal(...)` by `created_at DESC`
  - first row is canonical latest offer

### Existing deterministic recommended offer information

- none for offer amounts
- no canonical opening-offer helper exists
- no canonical target-offer helper exists
- no canonical final-offer helper exists
- no canonical walk-away amount helper exists
- no canonical walk-away threshold helper exists
- no canonical offer ladder helper exists
- `evaluateNegotiationPosition(...)` in `lib/engine/intelligence/negotiation-position-engine.ts` is qualitative only:
  - motivation signals
  - urgency support
  - heat modifier
  - no monetary output
- `matchStrategy(...)` and `buildNextActions(...)` drive qualitative strategy and action, not offer amounts
- `evaluateOperatorGuard(...)` can compare `offer_amount` to `max_safe_offer`, but current pipeline route passes `max_safe_offer: null`

### Not currently implemented

- opening offer
- target offer
- final offer
- walk-away offer
- walk-away threshold
- deterministic negotiation bands
- canonical negotiation strategy amount ladder

Offer-source result:

- latest recorded offer: canonical and reusable
- latest offer amount/status/rationale/seller response: canonical and reusable
- offer ladder / walk-away outputs: not currently implemented and must remain unavailable

## Strategy, Verdict, and Next-Action Source Audit

### Verdict

- canonical source: `engine_result_json.verdict.status`
- type source: `DealVerdictStatus` in `lib/engine/analyze-deal-with-refurb.ts`
- labels:
  - `GO`
  - `CONDITIONAL`
  - `NO-GO`
  - `ANALYSIS ONLY`

### Deal classification

- persisted saved-deal source: `SavedDealRecord.classification`
- nested deterministic source when due diligence exists:
  - `engine_result_json.dueDiligence.decision.dealClassification`
- current save-flow mixes:
  - due-diligence classification when available
  - verdict status fallback when due diligence absent

Authority conflict:

- `SavedDealRecord.classification` is canonical persisted read-model source today
- but it is not semantically locked to one enum family
- it may contain `STRONG_DEAL` / `MARGINAL` / `NO_DEAL`
- or `GO` / `CONDITIONAL` / `NO-GO` / `ANALYSIS ONLY`

### Capital protection

- persisted source: `SavedDealRecord.capital_protection_state`
- nested deterministic provenance:
  - `engine_result_json.dueDiligence.decision.capitalProtectionStatus`

### Strategy

- current saved-deal engine payload source:
  - `engine_result_json.dueDiligence.decision.strategyRecommendation`
- values from `types/due-diligence.ts`:
  - `BRRR_OR_FLIP`
  - `FLIP_ONLY_OR_RENEGOTIATE`
  - `NO_DEAL`
- separate Phase 2 strategy source exists:
  - `Phase2AnalysisOutput.strategyMatch.recommendedStrategy`
- but Phase 2 strategy is not currently persisted in saved deals on `main`

### Recommended next action

- raw persisted source:
  - `SavedDealRecord.next_action`
- canonical normalized reuse source:
  - `InvestorSummaryViewModel.recommendedNextAction.actionText`
- precedence already implemented in `mapInvestorSummaryViewModel(...)`:
  1. persisted next action
  2. Investor Shield fallback recommended task title
  3. unavailable

### Investor Shield progression recommendation

- progression authority source:
  - `loadAndEvaluateInvestorShield(...)`
  - `guardInvestorShieldPipelineMovement(...)`
- this is workflow/progression authority only
- it must not replace deterministic financial verdict, True MAO, or strategy

Strategy / verdict / next-action result:

- verdict: confirmed
- strategy: confirmed for current saved-deal engine payload via due diligence
- next action: confirmed only through persisted `next_action` and canonical Investor Summary precedence
- classification: partially confirmed because persisted field is overloaded

## Investor Summary Reuse Matrix

| Deal Formulation Output | Already in Investor Summary | Exact Path | Suitable for Direct Reuse | Gap |
| --- | ---: | --- | ---: | --- |
| dealId | Yes | `investorSummary.deal.dealId` | Yes | none |
| propertyLabel | Yes | `investorSummary.deal.address` | Yes | none |
| purchasePrice | Yes | `investorSummary.purchasePrice` | Yes | none |
| gdvRealistic | Yes | `investorSummary.gdvRange.realistic` | Yes | summary already owns null-safe normalized field |
| gdvDownside | Yes | `investorSummary.gdvRange.downside` | Yes | none |
| gdvStrong | Yes | `investorSummary.gdvRange.strong` | Yes | none |
| refurbCost | No | none | No | use `SavedDealRecord.refurb_cost` |
| financeCost | No | none | No | use `engine_result_json.deal.financeCost.totalFinanceCost` |
| acquisitionCosts | No | none | No | no canonical aggregate exists |
| totalInvestment | No | none | No | use `engine_result_json.deal.totalCost` |
| projectedProfit | No | none | No | use `engine_result_json.deal.profit` |
| ROI | No | none | No | unsupported in repo |
| profitMargin | No | none | No | use `engine_result_json.deal.profitMargin` |
| True MAO 15% | Yes | `investorSummary.trueMao.fifteenPercent` | Yes | none |
| True MAO 20% | Yes | `investorSummary.trueMao.twentyPercent` | Yes | none |
| True MAO 25% | Yes | `investorSummary.trueMao.twentyFivePercent` | Yes | none |
| classification | Yes | `investorSummary.classification` | Partially | summary reuses overloaded persisted field |
| capitalProtection | Yes | `investorSummary.capitalProtectionState` | Yes | none |
| latestRecordedOffer | Yes | `investorSummary.latestOffer` | Yes | none |
| recommendedNextAction | Yes | `investorSummary.recommendedNextAction` | Yes | prefer this over raw task titles |
| openingOffer | No | none | No | not implemented |
| targetOffer | No | none | No | not implemented |
| finalOffer | No | none | No | not implemented |
| walkAwayAmount | No | none | No | not implemented |
| verdict | No | none | No | use `engine_result_json.verdict.status` |
| strategy | No | none | No | use `engine_result_json.dueDiligence.decision.strategyRecommendation` |

Reuse decision:

- reuse Investor Summary directly for:
  - identity
  - normalized GDV
  - normalized True MAO bands
  - capital protection
  - latest offer
  - recommended next action
- do not create a competing path for those same fields
- do not depend on Investor Summary for fields it does not own

## Proposed Future Composer Input Contract

Preferred boundary:

```text
canonical SavedDealRecord
+ canonical engine_result_json extraction
+ canonical Investor Summary values where already normalized
+ canonical latest offer selection already resolved by existing selector
-> pure Deal Formulation composer
```

Smallest practical input groups for Phase 5B-1B:

- `savedDeal`
  - `id`
  - `address`
  - `purchase_price`
  - `gdv_realistic`
  - `refurb_cost`
  - `classification`
  - `governance_state`
  - `capital_protection_state`
  - `pipeline_state`
  - `next_action`
- `engineResult`
  - `deal.totalCost`
  - `deal.financeCost.totalFinanceCost`
  - `deal.profit`
  - `deal.profitMargin`
  - `deal.trueMao.{fifteenPercent,twentyPercent,twentyFivePercent}`
  - `verdict.status`
  - `dueDiligence.gdvRange.*`
  - `dueDiligence.decision.{capitalProtectionStatus,dealClassification,strategyRecommendation}`
  - `dueDiligence.inputs.{stampDuty,legalCosts,saleCosts}`
- `investorSummaryReuse`
  - `purchasePrice`
  - `gdvRange`
  - `trueMao`
  - `capitalProtectionState`
  - `classification`
  - `latestOffer`
  - `recommendedNextAction`
- `latestOffer`
  - already selected by `selectLatestInvestorSummaryOffer(...)`, or reused from `investorSummary.latestOffer`

Composer non-responsibilities:

- no database access
- no API route calls
- no Shield evaluation
- no True MAO recalculation
- no finance recalculation
- no profit recalculation
- no latest-offer reselection
- no task or offer mutation
- no pipeline movement

## Proposed Deal Formulation Output Contract

Use repo-compatible field names, not invented runtime types.

```text
DealFormulationViewModel

identity
- dealId
- address

financialSummary
- purchasePrice
- gdvRealistic
- gdvDownside
- gdvStrong
- refurbCost
- stampDuty
- legalCosts
- saleCosts
- acquisitionCosts
- financeCost
- totalCost
- projectedProfit
- profitMargin
- roi

trueMao
- fifteenPercent
- twentyPercent
- twentyFivePercent
- sourceLabel

offerPosition
- latestRecordedOffer
- openingOffer
- targetOffer
- finalOffer
- walkAwayAmount
- unavailableReasons

decision
- verdictStatus
- classification
- capitalProtectionState
- strategyRecommendation
- recommendedNextAction

warnings
- canonicalWarnings
- unavailableFields
```

Output-contract notes:

- `gdvRealistic`, `gdvDownside`, and `gdvStrong` should align with existing Investor Summary naming
- `totalCost` is repo-compatible existing naming; do not rename to a new canonical total-investment term internally
- `projectedProfit` can be presentation label, but source should remain `deal.profit`
- `roi` should remain `null` until a canonical source exists
- `acquisitionCosts` should remain `null` until a canonical aggregate source exists; component fields may still be shown
- `classification` should preserve current persisted value, even though it is semantically mixed
- `recommendedNextAction` should preferably reuse `InvestorSummary.recommendedNextAction.actionText`

## Missing and Unavailable Value Rules

- missing purchase price:
  - preserve `null`
  - display `Not available`
  - do not use offer amount as fallback
- missing GDV:
  - preserve `null`
  - display `Not available`
  - do not infer from downside/strong unless the specific canonical field exists
- missing engine-result payload:
  - preserve nested engine-derived fields as `null`
  - do not throw if saved deal still exists
- malformed stored monetary value:
  - preserve as unavailable
  - do not coerce numeric strings
  - do not convert to `0`
- missing True MAO:
  - preserve all missing bands as `null`
  - do not substitute from another band
- no persisted offers:
  - `latestRecordedOffer = null`
  - `openingOffer = null`
  - `targetOffer = null`
  - `finalOffer = null`
  - `walkAwayAmount = null`
- missing ROI:
  - preserve `null`
  - unavailable reason: canonical ROI output not implemented in repository
- missing strategy:
  - preserve `null`
  - do not substitute offer rationale, task title, or readiness state
- missing recommended next action:
  - use canonical Investor Summary precedence
  - if still unavailable, preserve `null`

General rule:

- preserve `null`
- presentation may render `Not available`
- never turn missing numeric values into `$0`
- never derive a fallback unless a pre-existing canonical fallback already exists and is documented
- stop only for true dependency failures such as missing saved deal, repository error, or structural caller misuse

## Authority and Precedence Rules

Lock future Phase 5B precedence as:

```text
deterministic engine calculations
-> True MAO and capital protection
-> deterministic deal classification
-> Investor Shield progression authority
-> canonical saved-deal workflow state
-> persisted offers
-> advisory professional readiness and evidence
-> UI presentation
```

Clarifications:

- deterministic financial outputs remain first-class source of money values
- True MAO and capital protection cannot be softened by workflow state
- persisted saved-deal workflow state is operational context, not a financial source
- Investor Shield may block progression but must not rewrite deterministic financial outputs
- latest persisted offer does not change True MAO
- professional readiness may increase review burden but must not alter verdict, classification source, or offer amounts
- Evidence Lite is informational only
- UI labels are never calculation inputs

## Future Focused Test Expectations

Planned Phase 5B-1B tests should prove:

1. All financial figures come from canonical stored fields.
2. True MAO bands are reused and not recalculated.
3. Missing True MAO stays unavailable.
4. Missing money does not become zero.
5. Malformed safe-nullable money becomes unavailable.
6. Existing latest-offer selector remains authoritative.
7. No-offer remains valid empty state.
8. Persisted offer amount does not alter True MAO.
9. Investor Shield progression does not alter deterministic financial outputs.
10. Professional readiness does not alter verdict or offer values.
11. Evidence Lite does not influence financial results.
12. Repeated composition is deterministic.
13. Input objects are not mutated.
14. No database, API, Supabase, Vercel, or environment access is required.
15. No write repository function is called.
16. No duplicate MAO, finance, profit, ROI, or classification logic is introduced.

## Minimal Phase 5B-1B Implementation File Set

Smallest likely Phase 5B-1B file set:

- `types/deal-formulation.ts` only if a dedicated pure contract file is needed
- `lib/deal-formulation/compose-deal-formulation-view-model.ts`
- `__tests__/deal-formulation-composer.test.ts`
- `docs/phase5/PHASE_5B_1B_DEAL_FORMULATION_COMPOSER_COMPLETION.md`

Conditional only if extraction logic cannot stay in the test/input-preparation layer:

- `lib/deal-formulation/extract-deal-formulation-canonical-input.ts`

Do not plan UI in Phase 5B-1B.

## Explicit Non-Implementation

Confirmed no:

- composer implementation
- runtime type implementation
- UI
- Investor Review wiring
- database access
- API route
- database write
- migration
- offer creation
- task creation
- pipeline movement
- formula change
- True MAO change
- finance change
- classification change
- Investor Shield change
- readiness change
- Evidence Lite change
- production access
- deployment
- AI, OCR, scraping, PDF, CRM, upload, or automation

## Verdict

`PHASE 5B-1A PARTIALLY COMPLETE — OPTIONAL OUTPUTS MUST REMAIN UNAVAILABLE`

Reason:

- core financial authority is proven
- canonical latest-offer selection is proven
- canonical strategy / verdict / next-action sources are usable
- but ROI, acquisition-cost aggregate, offer ladder, walk-away amount, and a singular investor-facing True MAO band are not canonically implemented today

## Recommended Next Step

`Phase 5B-1B — Implement the pure Deal Formulation composer and focused mocked tests using only the audited canonical sources.`
