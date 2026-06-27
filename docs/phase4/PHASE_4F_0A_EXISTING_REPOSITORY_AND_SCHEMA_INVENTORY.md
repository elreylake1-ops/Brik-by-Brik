# Phase 4F-0A Existing Repository and Schema Inventory

## Purpose
Inventory the current repository sources for saved deals, Investor Shield, Evidence Lite, tasks, offers, and deterministic deal outputs before any Phase 4F implementation work.

This document is inspection-only. It does not add runtime behavior, tests, schema changes, or summary mapping.

## Repository Baseline

| Item | Value |
|---|---|
| Repo root | `C:\Users\user\Documents\Lake Views Property\deal-analyzer` |
| Branch | `main` |
| `HEAD` | `55c512bb23351f7d8246fb647ec84a0abf4fc4ab` |
| `origin/main` | `55c512bb23351f7d8246fb647ec84a0abf4fc4ab` |
| `origin` | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state | Only the pre-existing unstaged `.gitignore` modification remains |

## Saved Deals Inventory

| Path | Purpose | Exports / key types | Canonical | Phase 4F reuse |
|---|---|---|---|---|
| `lib/operator-command/saved-deals-repository.ts` | Saved-deal persistence layer for create/read/list/update/archive/pipeline state | `SavedDealRecord`, `CreateSavedDealInput`, `ListSavedDealsOptions`, `UpdateSavedDealPatch`, `createSavedDeal`, `getSavedDealById`, `listSavedDeals`, `updateSavedDeal`, `archiveSavedDeal`, `updateSavedDealPipelineState` | Yes | Yes |
| `app/api/saved-deals/route.ts` | List/create saved-deal API | `GET`, `POST` | Yes | Yes |
| `app/api/saved-deals/[id]/route.ts` | Read single saved-deal API | `GET` | Yes | Yes |
| `app/api/saved-deals/[id]/pipeline/route.ts` | Pipeline transition API; also loads Investor Shield guard data | `POST` | Yes | Yes, but not for new decision logic |
| `app/page.tsx` | Saved-deal list + detail integration UI | Local `SavedDealListItem`, `SavedDealDetail`, `DealOfferListItem`, `DealTaskListItem` | Yes as integration surface | Yes |
| `db/migrations/20260521_phase4a_minimal_schema.sql` | Legacy baseline schema; includes early `deals`, `tasks`, `offers`, `evidence_items` tables | N/A | Historical, not canonical for current saved-deals path | Limited reference only |
| `db/migrations/20260522_phase4a_saved_deals_table.sql` | Canonical `brik_by_brik_engine.saved_deals` table | N/A | Yes | Yes |
| `__tests__/saved-deals-repository.test.ts` | Repository behavior and safety checks | N/A | Yes | Yes |
| `__tests__/saved-deals-api-route.test.ts` | List/create route behavior | N/A | Yes | Yes |
| `__tests__/saved-deals-api-detail-route.test.ts` | Detail route behavior | N/A | Yes | Yes |
| `__tests__/saved-deals-pipeline-route.test.ts` | Pipeline route + guard wiring behavior | N/A | Yes | Yes |
| `__tests__/phase4a-migration-consistency.test.ts` | Schema contract consistency checks | N/A | Yes | Yes |

## Investor Shield Inventory

| Path | Purpose | Exports / key types | Canonical | Phase 4F reuse |
|---|---|---|---|---|
| `types/investor-shield.ts` | Core Investor Shield contracts | `InvestorShieldGateKey`, `InvestorShieldStatus`, `InvestorShieldSeverity`, `InvestorShieldConfidence`, `InvestorShieldEvidenceType`, `InvestorShieldGateDefinition`, `InvestorShieldCheck`, `EvidenceItem`, `RiskFlag`, `ManualOverride`, `BuilderProposal`, `BuilderContractCheck` | Yes | Yes |
| `types/investor-shield-enforcement.ts` | Enforcement result contracts | `InvestorShieldOverallStatus`, `InvestorShieldProgressionDecision`, `InvestorShieldBlockingReason`, `InvestorShieldTaskRecommendationType`, `InvestorShieldEvaluationInput`, `InvestorShieldTaskRecommendation`, `InvestorShieldEnforcementResult` | Yes | Yes |
| `types/investor-shield-ui.ts` | Read-only UI view-model contracts | `InvestorShieldUiViewModel`, `InvestorShieldGateDisplay`, `InvestorShieldUiSummaryDisplay`, `ProtectedMovementDisplay`, `TaskRecommendationDisplay`, `WaiverDisplay`, `ManualReviewDisplay`, `DeterministicGovernanceDisplay` | Yes | Yes |
| `lib/investor-shield/default-gates.ts` | Canonical gate definitions, required/advisory split, evidence types | `INVESTOR_SHIELD_DEFAULT_GATES`, `getInvestorShieldGateDefinition`, `getInvestorShieldRequiredGateKeys`, `getInvestorShieldRefurbSubGateKeys` | Yes | Yes |
| `lib/investor-shield/default-checks.ts` | Default required check seed generation | `buildDefaultInvestorShieldChecks` | Yes | Yes |
| `lib/investor-shield/investor-shield-repository.ts` | Persistence for checks, evidence items, risk flags, overrides, builder proposals, builder contract checks | `listInvestorShieldChecksByDealId`, `insertInvestorShieldChecks`, `listEvidenceItemsByDealId`, `insertEvidenceItem`, `listRiskFlagsByDealId`, `insertRiskFlag`, `listManualOverridesByDealId`, `insertManualOverride`, `listBuilderProposalsByDealId`, `insertBuilderProposal`, `listBuilderContractChecksByDealId`, `insertBuilderContractCheck` | Yes | Yes |
| `lib/investor-shield/evaluate-investor-shield.ts` | Canonical enforcement evaluation | `evaluateInvestorShield` | Yes | Yes |
| `lib/investor-shield/investor-shield-read-model.ts` | Read-model loader for checks/evidence/overrides/risk flags | `loadInvestorShieldEvaluationInput`, `loadAndEvaluateInvestorShield` | Yes | Yes |
| `lib/investor-shield/load-investor-shield-ui-model.ts` | UI model loader | `loadInvestorShieldUiModelForDeal` | Yes | Yes |
| `lib/investor-shield/map-investor-shield-ui-view-model.ts` | View-model mapper from enforcement output + deal context | `mapInvestorShieldUiViewModel` | Yes | Yes |
| `lib/investor-shield/investor-shield-ui-adapter.ts` | UI adapter that builds gate summaries, advisory signals, movement, waivers, and task recommendations | `buildInvestorShieldUiModel` | Yes | Yes |
| `lib/investor-shield/guard-investor-shield-pipeline-movement.ts` | Protected-stage pipeline guard | `guardInvestorShieldPipelineMovement`, `isInvestorShieldProtectedStage` | Yes | Yes |
| `app/api/saved-deals/[id]/investor-shield-ui/route.ts` | Read-only Investor Shield API | `GET` | Yes | Yes |
| `components/InvestorShieldPanel.tsx` | Main read-only panel | `InvestorShieldPanel` | Yes | Yes |
| `components/SavedDealInvestorShieldPanel.tsx` | Saved-deal binding wrapper for the panel | `SavedDealInvestorShieldPanel` | Yes | Yes |
| `components/InvestorShieldGateSummaryPanel.tsx` | Read-only gate-summary presentation | `InvestorShieldGateSummaryPanel` | Yes | Yes |
| `components/InvestorShieldGateRow.tsx`, `components/InvestorShieldGateList.tsx`, `components/InvestorShieldProtectedMovement.tsx`, `components/InvestorShieldTaskRecommendationList.tsx`, `components/InvestorShieldWaiverDisplay.tsx`, `components/InvestorShieldAdvisoryList.tsx` | Support components for the read-only panel | Various local component exports | Yes | Yes |
| `__tests__/investor-shield-*.test.ts*` | Contracts, evaluator, adapter, UI, enforcement, protected movement, waiver, and route tests | N/A | Yes | Yes |

### Investor Shield source notes

- Gate status comes from `types/investor-shield.ts` definitions plus `evaluateInvestorShield()` and then the UI adapter mapping in `lib/investor-shield/investor-shield-ui-adapter.ts`.
- Required/advisory classification comes from `lib/investor-shield/default-gates.ts` and is surfaced by the UI adapter and `types/investor-shield-ui.ts`.
- Blocking state comes from `lib/investor-shield/evaluate-investor-shield.ts` and the pipeline guard in `lib/investor-shield/guard-investor-shield-pipeline-movement.ts`.
- Evidence requirements come from gate `evidenceTypes` in `default-gates.ts`, default check seed data in `default-checks.ts`, and evidence items loaded by `investor-shield-repository.ts`.
- Waiver information comes from `manual_overrides` via `investor-shield-repository.ts` and is displayed in the UI mapper/adapter.
- A canonical overall Shield status already exists: `InvestorShieldEnforcementResult.overallStatus` and the UI-level `InvestorShieldUiModel.overallStatus`.

## Evidence Lite Inventory

| Path | Purpose | Exports / key types | Canonical | Phase 4F reuse |
|---|---|---|---|---|
| `types/evidence-lite.ts` | Evidence Lite contracts | `EvidenceLiteStatus`, `EvidenceLiteGateKey`, `EvidenceLiteEvidenceType`, `EvidenceLiteRecord`, `CreateEvidenceLiteInput`, `NormalizedCreateEvidenceLiteInput`, `UpdateEvidenceLiteInput`, `NormalizedUpdateEvidenceLiteInput`, `EvidenceLiteValidationResult` | Yes | Yes |
| `lib/evidence-lite/evidence-lite-validation.ts` | Input validation and canonical gate alias normalization | `normalizeEvidenceLiteGateKey`, `validateCreateEvidenceLiteInput`, `validateUpdateEvidenceLiteInput`, `normalizeEvidenceLiteEvidenceType`, `normalizeEvidenceLiteStatus` | Yes | Yes |
| `lib/evidence-lite/evidence-lite-repository.ts` | Evidence Lite persistence and mapping | `listEvidenceLiteForDeal`, `getEvidenceLiteById`, `createEvidenceLite`, `updateEvidenceLite`, `mapEvidenceLiteRow` | Yes | Yes |
| `app/api/saved-deals/[id]/evidence/route.ts` | Evidence Lite list/create API | `GET`, `POST` | Yes | Yes |
| `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts` | Evidence Lite item update API | `PATCH` | Yes | Yes |
| `components/evidence-lite/EvidenceLitePanel.tsx` | Development-only Evidence Lite panel | `loadEvidenceLiteRecords`, `submitEvidenceLiteRecord`, `updateEvidenceLiteRecord`, default component export | Yes | Yes, but only as a dev-only panel |
| `db/migrations/20260622_phase4e_deal_evidence_table.sql` | Canonical Evidence Lite table | N/A | Yes | Yes |
| `__tests__/evidence-lite-validation.test.ts` | Validation contract tests | N/A | Yes | Yes |
| `__tests__/evidence-lite-repository.test.ts` | Repository behavior tests | N/A | Yes | Yes |
| `__tests__/evidence-lite-api-route.test.ts` | List/create API tests | N/A | Yes | Yes |
| `__tests__/evidence-lite-item-api-route.test.ts` | Item update API tests | N/A | Yes | Yes |
| `__tests__/evidence-lite-panel.test.tsx` | Panel UX and route helper tests | N/A | Yes | Yes |

### Evidence Lite source notes

- Canonical evidence record type: `EvidenceLiteRecord`.
- Canonical evidence statuses: `MISSING`, `RECORDED`, `REVIEWED`, `VERIFIED`, `REJECTED`.
- Canonical evidence types: `SOLD_COMP`, `TITLE_REVIEW`, `LEASEHOLD_REVIEW`, `PLANNING_BUILDING_CONTROL`, `REFURB_NOTE`, `BUILDER_QUOTE`, `SURVEY_NOTE`, `LENDER_NOTE`, `RENTAL_DEMAND`, `SOLICITOR_REVIEW`, `OTHER`.
- Canonical linked gates: `SOLD_COMPS`, `TITLE`, `LEASEHOLD`, `PLANNING_BUILDING_CONTROL`, `REFURB_CERTAINTY`, `BUILDER_PROPOSAL_CONTRACT`, `DAMP_STRUCTURAL`, `LENDER_CRITERIA`, `RENTAL_DEMAND`, `SOLICITOR_REVIEW`.
- Reviewed state is the `reviewed: boolean` field in `EvidenceLiteRecord`.
- No standalone evidence aggregation/count helper exists yet; counts are currently derived from `listEvidenceLiteForDeal()` results.

## Deal Tasks Inventory

| Path | Purpose | Exports / key types | Canonical | Phase 4F reuse |
|---|---|---|---|---|
| `lib/operator-command/deal-tasks-repository.ts` | Task persistence helpers | `DealTaskRecord`, `CreateTaskInput`, `createTask`, `listTasksForDeal`, `updateTaskStatus`, `markTaskBlocked`, `completeTask` | Yes | Yes |
| `app/api/saved-deals/[id]/tasks/route.ts` | Task list/create API | `GET`, `POST` | Yes | Yes |
| `lib/investor-shield/persist-investor-shield-task-drafts.ts` | Converts Investor Shield task drafts into persisted tasks and dedupes them | `PersistInvestorShieldTaskDraftsResult`, `persistInvestorShieldTaskDrafts` | Yes | Yes |
| `lib/investor-shield/build-investor-shield-task-drafts.ts` | Builds deterministic task drafts from enforcement output | `InvestorShieldTaskDraft`, `buildInvestorShieldTaskDrafts` | Yes | Yes |
| `__tests__/deal-tasks-repository.test.ts` | Repository behavior tests | N/A | Yes | Yes |
| `__tests__/deal-tasks-api-route.test.ts` | Task API tests | N/A | Yes | Yes |
| `__tests__/persist-investor-shield-task-drafts.test.ts` | Draft persistence tests | N/A | Yes | Yes |
| `__tests__/investor-shield-task-drafts.test.ts` | Draft builder tests | N/A | Yes | Yes |

### Deal task source notes

- Table name: `brik_by_brik_engine.deal_tasks`.
- Primary key type: `UUID` in the database; exposed as `string` in TypeScript.
- Deal foreign key: `deal_id`.
- Task title field: `task_title`.
- Task type field: `task_type`.
- Task status field: `task_status`.
- Priority field: `priority`.
- Due date field: `due_date`.
- Blocker reason field: `blocker_reason`.
- Created/completed timestamps: `created_at`, `completed_at`.
- Existing canonical active-task rule: `persistInvestorShieldTaskDrafts()` treats tasks as open-like unless `task_status` is `COMPLETE` or `CANCELLED`.

## Deal Offers Inventory

| Path | Purpose | Exports / key types | Canonical | Phase 4F reuse |
|---|---|---|---|---|
| `lib/operator-command/deal-offers-repository.ts` | Offer persistence helpers | `DealOfferRecord`, `CreateOfferInput`, `createOffer`, `listOffersForDeal`, `updateOfferStatus`, `updateSellerResponse` | Yes | Yes |
| `app/api/saved-deals/[id]/offers/route.ts` | Offer list/create API | `GET`, `POST` | Yes | Yes |
| `__tests__/deal-offers-repository.test.ts` | Repository behavior tests | N/A | Yes | Yes |
| `__tests__/deal-offers-api-route.test.ts` | Offer API tests | N/A | Yes | Yes |

### Deal offer source notes

- Table name: `brik_by_brik_engine.deal_offers`.
- Primary key type: `UUID` in the database; exposed as `string` in TypeScript.
- Deal foreign key: `deal_id`.
- Amount field: `offer_amount`.
- Offer type field: `offer_type`.
- Offer status field: `offer_status`.
- Rationale field: `offer_rationale`.
- Seller response field: `seller_response`.
- Timestamp field: `created_at`.
- Existing canonical latest-offer ordering: `listOffersForDeal()` orders by `created_at DESC`, and `app/page.tsx` treats the first record as the latest offer.

## Deterministic Deal Outputs Inventory

| Value | Source file | Stored column / JSON path | Canonical type | Persisted or derived | Mapper exposure |
|---|---|---|---|---|---|
| True MAO | `lib/engine/analyze-deal-with-refurb.ts` via `types/deal.ts` | `saved_deals.engine_result_json.deal.trueMao` when saved from `app/page.tsx` | `TrueMaoBreakdown` | Derived by the engine, then persisted inside engine result JSON | Yes, surfaced through `engine_result_json` and UI detail cards |
| GDV range | `lib/engine/due-diligence-engine.ts` via `types/due-diligence.ts` | `saved_deals.engine_result_json.dueDiligence.gdvRange` when due diligence exists | `GDVRange` | Derived by the engine, then stored only inside engine result JSON | Partially exposed through the stored JSON; no dedicated saved-deal column |
| Capital protection state | `app/page.tsx` save flow + `lib/engine/due-diligence-engine.ts` | `saved_deals.capital_protection_state` | `CapitalProtectionStatus` / saved-deal string | Derived, then persisted in saved deal row | Yes |
| Classification | `app/page.tsx` save flow + `lib/engine/due-diligence-engine.ts` | `saved_deals.classification` | `DealClassification` or operator verdict string | Derived, then persisted in saved deal row | Yes |
| Governance state | `app/page.tsx` save flow + operator guard context | `saved_deals.governance_state` | Operator governance state string | Derived, then persisted in saved deal row | Yes |
| Pipeline state | `app/page.tsx` save flow and pipeline route | `saved_deals.pipeline_state` | `PipelineState` | Persisted deal state | Yes |
| Recommended next action | `app/page.tsx` save flow and read-only detail UI | `saved_deals.next_action` | string | Persisted free-text field; not auto-derived by a summary helper | Yes |
| Engine result JSON | `app/page.tsx` save flow | `saved_deals.engine_result_json` | `DealWithRefurbResult` | Persisted engine output blob | Yes, via detail UI and future summary consumers |
| Risk summary JSON | `app/page.tsx` save flow | `saved_deals.risk_summary_json` | `{ riskFlags: string[]; warnings: string[] }` | Persisted derived blob | Yes, via stored JSON only |

## Saved-Deal Page Integration Points

| Path | Role | Notes |
|---|---|---|
| `app/page.tsx` | Main saved-deal list and read-only detail surface | Fetches `/api/saved-deals`, `/api/saved-deals/[id]`, `/api/saved-deals/[id]/offers`, `/api/saved-deals/[id]/tasks`, `/api/saved-deals/[id]/pipeline`, `/api/saved-deals/[id]/investor-shield-ui`, and `/api/saved-deals/[id]/evidence` |
| `components/SavedDealInvestorShieldPanel.tsx` | Investor Shield detail block inside the saved-deal view | Wraps `InvestorShieldPanel` with saved-deal context |
| `components/evidence-lite/EvidenceLitePanel.tsx` | Development-only Evidence Lite block inside the saved-deal view | Rendered only when `NODE_ENV !== "production"` |
| `app/page.tsx` saved-deal detail section | Future insertion point for Investor Summary | The current detail area already renders the high-level deal card, Investor Shield, Evidence Lite, engine snapshot, operator command, pipeline update, offers, and tasks |
| Loading/error/empty conventions | UI pattern | Uses explicit loading text, safe error text, and empty-state text for list and detail panels |
| Development-only boundary | Evidence Lite panel | `showEvidenceLitePanel = process.env.NODE_ENV !== "production"` |

## James Code-Pack Files Located

The following supplied Phase 4F scaffold filenames are identifiable from the code-pack mapping doc, but no exact runtime equivalents exist at those paths in this repository:

| Supplied file | Intended purpose | Expected imports / references | Equivalent repo file | Status |
|---|---|---|---|---|
| `src/lib/investor-summary/summary.ts` | Investor Summary composition helper | Saved deals repository, deterministic engine output, Investor Shield model, tasks, offers, future Evidence Lite data | `lib/engine/intelligence/investor-summary-engine.ts` | No exact path; closest helper only |
| `src/app/api/saved-deals/[dealId]/summary/route.ts` | Read-only Investor Summary API route | Summary helper plus saved-deal lookup | `app/api/saved-deals/[id]/route.ts` | No exact route exists |
| `src/components/investor-summary/InvestorSummaryView.tsx` | Read-only Investor Summary component | Summary view-model/helper output | None exact; closest UI is `app/page.tsx` detail surface and `components/InvestorShieldPanel.tsx` | No exact component exists |
| `docs/qa/phase4g_acceptance_checklist.md` | Final Phase 4G acceptance checklist | Documentation only | `docs/phase4/PHASE_4D_4B_MANUAL_BROWSER_QA.md`, `docs/phase4/PHASE_4D_FINAL_READ_ONLY_INVESTOR_SHIELD_UI_CLOSEOUT.md` | No exact checklist file exists |

## Candidate Reusable Components

- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/investor-shield/load-investor-shield-ui-model.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/investor-shield/investor-shield-ui-adapter.ts`
- `lib/engine/intelligence/investor-summary-engine.ts`
- `components/SavedDealInvestorShieldPanel.tsx`
- `components/InvestorShieldPanel.tsx`
- `components/evidence-lite/EvidenceLitePanel.tsx`
- `app/page.tsx` saved-deal detail section

## Missing or Unresolved Sources

- No exact in-repo file was found for the supplied Investor Summary helper path `src/lib/investor-summary/summary.ts`.
- No exact in-repo file was found for the supplied Investor Summary API route path `src/app/api/saved-deals/[dealId]/summary/route.ts`.
- No exact in-repo file was found for the supplied Investor Summary component path `src/components/investor-summary/InvestorSummaryView.tsx`.
- No exact in-repo file was found for `docs/qa/phase4g_acceptance_checklist.md`.
- Evidence Lite currently has no standalone aggregation/count helper; counts are derived from list results.
- GDV range is derived in the deterministic engine and appears only inside engine-result JSON, not as a saved-deal column.

## Explicit Non-Implementation

- No runtime code changed.
- No tests changed.
- No migration changed.
- No migration was executed.
- No SQL ran.
- No database mutation occurred.
- No production route was called.
- No environment changed.
- No redeploy occurred.
- The deterministic engine remained untouched.

## Verdict

`PHASE 4F-0A COMPLETE - READY FOR PHASE 4F-0B`

## Recommended Next Step

`Phase 4F-0B - Code-Pack Compatibility Audit`
