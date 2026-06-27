# Phase 4F-0B Code Pack Compatibility Audit

## Purpose
Audit James's Phase 4F scaffold assumptions against the current repository structure, adapter patterns, canonical schema, and deterministic outputs before any Investor Summary implementation work.

This document is inspection-only. It does not create contracts, routes, components, fixtures, or migrations.

## Repository Baseline

| Item | Value |
|---|---|
| Repo root | `repo root` |
| Branch | `main` |
| `HEAD` | `ba11b9b9d9240cfe785249c359567ff04d9e7b62` |
| `origin/main` | `ba11b9b9d9240cfe785249c359567ff04d9e7b62` |
| `origin` | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state | Only the pre-existing unstaged `.gitignore` modification remains |

## Scaffold Evidence Available

The exact scaffold files were not present locally at the supplied paths.

Authoritative scaffold assumptions came from:

- `docs/phase4/PHASE_4F_0A_EXISTING_REPOSITORY_AND_SCHEMA_INVENTORY.md`
- `docs/phase4/PHASE_4_COMPLETION_CODE_PACK_BATCH_1_INVENTORY_MAPPING.md`

Relevant Phase 4D / 4E closure and audit docs were also read for current UI, Evidence Lite, and saved-deal conventions.

## Path Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Summary helper path | `src/lib/investor-summary/summary.ts` | Closest existing composition logic is `lib/engine/intelligence/investor-summary-engine.ts` | `ADAPT PATH` | Create the helper under repo conventions or reuse the existing helper at the root `lib` path |
| Summary component path | `src/components/investor-summary/InvestorSummaryView.tsx` | Current UI lives at root `components/` and `app/page.tsx` | `ADAPT PATH` | Use root `components/` or route the view through the current saved-deal page layout |
| Summary API path | `src/app/api/saved-deals/[dealId]/summary/route.ts` | Current API routes live under root `app/api/...` and use `[id]` | `ADAPT PATH` | Move to `app/api/saved-deals/[id]/summary/route.ts` if implemented |
| Phase 4G checklist path | `docs/qa/phase4g_acceptance_checklist.md` | Current docs live under `docs/phase4/` | `ADAPT PATH` | Place the checklist under `docs/phase4/` or adjust docs routing consistently |
| Route param naming | `[dealId]` | Existing repo convention uses `[id]` | `ADAPT PATH` | Normalize to `[id]` across the route tree to match the repository |
| Test location | Scaffold-specific tests under `src/__tests__` implied by the pack pattern | Repo tests live at root `__tests__/` | `ADAPT PATH` | Keep tests under root `__tests__/` to match repo conventions |

## Database Adapter Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Postgres access | Summary code may need database access | Shared singleton adapter exists in `lib/db/postgres.ts` using one `pg.Pool` | `REUSE AS-IS` for the shared adapter, `UNRESOLVED` for scaffold internals | Reuse `query()` from `lib/db/postgres.ts`; do not create another pool |
| Repository boundary | Route/helper may read data directly | Existing code consistently routes DB access through repository modules | `ADAPT DESIGN` | Keep summary route thin and delegate to repositories/read-model helpers |
| Initialization failure handling | Must map failures safely | Existing routes use safe error diagnostics and non-disclosing 4xx/5xx envelopes | `ADAPT DESIGN` | Match current safe error mapping and avoid direct pool wiring |

## Saved-Deal Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Table name | `saved_deals` | Canonical table is `brik_by_brik_engine.saved_deals` | `MATCH` | Use schema-qualified name if querying directly through repositories |
| Primary key | `id` | Saved-deal ID is `id` | `MATCH` | None |
| ID type | likely text/string | `id` is text-compatible and used as string in TypeScript | `MATCH` | None |
| Address | `address` | `saved_deals.address` exists and is shown in `app/page.tsx` | `MATCH` | None |
| Purchase price | `purchase_price` | `saved_deals.purchase_price` exists | `MATCH` | None |
| GDV | `gdv` / `gdv_range` expectations are likely | Current row stores `gdv_realistic`; GDV range only appears inside engine-result JSON | `NOT AVAILABLE DIRECTLY` | Use the engine-result JSON or a future read-model binding rather than a new column |
| Classification | `classification` | `saved_deals.classification` exists | `MATCH` | None |
| Governance state | `governance_state` | `saved_deals.governance_state` exists | `MATCH` | None |
| Capital protection | `capital_protection_state` | `saved_deals.capital_protection_state` exists | `MATCH` | None |
| Pipeline state | `pipeline_state` | `saved_deals.pipeline_state` exists | `MATCH` | None |
| Engine result JSON | `engine_result_json` | `saved_deals.engine_result_json` exists and persists the engine output blob | `MATCH` | None |
| Risk summary JSON | `risk_summary_json` | `saved_deals.risk_summary_json` exists | `MATCH` | None |
| Next action | `next_action` | `saved_deals.next_action` exists | `MATCH` | None |
| Timestamp fields | `created_at`, `updated_at`, `archived_at` | All are present on `saved_deals` | `MATCH` | None |

## Task Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Table name | likely `tasks` / saved-deal-scoped task storage | Canonical table is `brik_by_brik_engine.deal_tasks` | `ADAPT FIELD` | Use the canonical schema-qualified task table |
| Deal-link field | `saved_deal_id` likely from scaffold naming | Current field is `deal_id` | `ADAPT FIELD` | Normalize to `deal_id` to match repo and migration |
| Deal-link type | string/text | `deal_id` is text-compatible | `MATCH` | None |
| Title field | `title` / `task_title` | Canonical field is `task_title` | `ADAPT FIELD` | Use `task_title` |
| Task type | `task_type` | Canonical field is `task_type` | `MATCH` | None |
| Task status | `status` vs `task_status` is the common scaffold risk | Canonical field is `task_status` | `ADAPT FIELD` | Map any scaffold `status` field to `task_status` |
| Priority | `priority` | Canonical field is `priority` | `MATCH` | None |
| Blocker reason | `blocker_reason` | Canonical field is `blocker_reason` | `MATCH` | None |
| Due date | `due_date` | Canonical field is `due_date` | `MATCH` | None |
| Created/completed timestamps | `created_at`, `completed_at` | Canonical fields are `created_at`, `completed_at` | `MATCH` | None |
| Active-task behavior | scaffold may define a new active rule | Current active-like behavior is already encoded in `persistInvestorShieldTaskDrafts()` | `REJECT` for any new rule, otherwise `ADAPT DESIGN` | Reuse the current open-like convention; do not redefine active-task semantics |
| Ordering behavior | likely latest-first list expectation | `listTasksForDeal()` orders by `created_at DESC` | `MATCH` | None |

## Offer Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Table name | likely `offers` / saved-deal-scoped offers storage | Canonical table is `brik_by_brik_engine.deal_offers` | `ADAPT FIELD` | Use the canonical schema-qualified offer table |
| Deal-link field | `saved_deal_id` likely from scaffold naming | Current field is `deal_id` | `ADAPT FIELD` | Normalize to `deal_id` |
| Deal-link type | string/text | `deal_id` is text-compatible | `MATCH` | None |
| Amount | `amount` | Canonical field is `offer_amount` | `ADAPT FIELD` | Use `offer_amount` |
| Offer type | `offer_type` | Canonical field is `offer_type` | `MATCH` | None |
| Offer status | `status` vs `offer_status` is the common scaffold risk | Canonical field is `offer_status` | `ADAPT FIELD` | Map any scaffold `status` field to `offer_status` |
| Rationale | `offer_rationale` | Canonical field is `offer_rationale` | `MATCH` | None |
| Seller response | `seller_response` | Canonical field is `seller_response` | `MATCH` | None |
| Created timestamp | `created_at` | Canonical field is `created_at` | `MATCH` | None |
| Latest-offer ordering | likely latest-first | `listOffersForDeal()` orders by `created_at DESC` and the page uses the first record as latest | `MATCH` | None |

## Investor Shield Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Overall status | may need a summary status | Canonical overall status already exists in `InvestorShieldEnforcementResult.overallStatus` and `InvestorShieldUiModel.overallStatus` | `REUSE AS-IS` | Consume canonical results, do not invent a second status system |
| Required/advisory split | may need a split by gate type | Canonical gate metadata already marks required/advisory in `default-gates.ts` and UI mapping | `REUSE AS-IS` | Reuse current gate metadata |
| Blocked gates | may need a list | Canonical blocking gates already come from `evaluateInvestorShield()` and the UI adapter | `REUSE AS-IS` | Consume existing blocking gate keys |
| Blocker reasons | may need reasons | Canonical blocking reasons already exist in enforcement output | `REUSE AS-IS` | Consume enforcement output, do not recalculate |
| Waived gates | may need display | Canonical waiver visibility already comes from `manual_overrides` and UI mapping | `REUSE AS-IS` | Reuse the current waiver display path |
| Missing evidence requirements | may need summary | Current gate summaries already expose missing evidence summaries | `REUSE AS-IS` | Reuse current missing-evidence summaries |
| Recommended tasks | may need task recommendations | Canonical task recommendations already come from enforcement output and adapter mapping | `REUSE AS-IS` | Reuse current recommendation data |
| Gate ordering | may need ordering | Current UI already sorts by gate definitions and display priority | `REUSE AS-IS` | Keep the existing order semantics |
| Independent re-derivation | scaffold may try to recompute status independently | That would duplicate canonical governance logic | `REJECT` | Consume `loadAndEvaluateInvestorShield()` or `InvestorShieldUiModel` only |

## Evidence Lite Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Table name | `deal_evidence` | Canonical table is `brik_by_brik_engine.deal_evidence` | `MATCH` | None |
| Deal-link field | `saved_deal_id` likely from scaffold naming | Current field is `deal_id` | `ADAPT TO CURRENT CANONICAL CONTRACT` | Normalize to `deal_id` |
| Deal-ID type | UUID | Current repository uses text-compatible deal IDs and the migration stores `deal_id TEXT` | `ADAPT TO CURRENT CANONICAL CONTRACT` | Keep text deal IDs for current repo compatibility |
| Linked-gate values | `GENERAL`, `GENERAL_NOTE`, `PHOTO_NOTE` may appear in the scaffold pattern | Canonical gates are the Investor Shield gate keys such as `SOLD_COMPS`, `TITLE`, `SOLICITOR_REVIEW` | `REJECT` for unsupported legacy values | Normalize to canonical gate keys only |
| Evidence-type values | `RECEIVED` / generic note labels may appear in the scaffold pattern | Canonical types are `TITLE_REVIEW`, `BUILDER_QUOTE`, `SOLICITOR_REVIEW`, etc. | `ADAPT TO CURRENT CANONICAL CONTRACT` | Map scaffold values to the current contract or reject them during validation |
| Status values | `RECEIVED` may appear in the scaffold pattern | Canonical statuses are `MISSING`, `RECORDED`, `REVIEWED`, `VERIFIED`, `REJECTED` | `REJECT` | Do not introduce non-canonical statuses |
| Reviewed field | `reviewed` / maybe reviewer note semantics | `reviewed: boolean` exists | `MATCH` | None |
| Reviewer note field | `reviewer_note` | No reviewer-note field exists in the current canonical record | `PRODUCT DECISION REQUIRED` | Decide whether a separate note field is needed later; do not invent it now |
| Timestamps | `created_at`, `updated_at` | Canonical timestamps are present | `MATCH` | None |
| Repository functions | list/read/create/update expected | Current repository already provides list/read/create/update | `REUSE AS-IS` | Reuse current repository helpers |
| Aggregation/count support | scaffold may expect counts | No standalone count helper exists yet | `PRODUCT DECISION REQUIRED` | If needed, derive counts in a read model or add a helper in a later phase |

## Deterministic Output Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| True MAO | may recalculate or present it | True MAO is produced by `lib/engine/analyze-deal-with-refurb.ts` and persisted inside `engine_result_json` | `REJECT` for recalculation, `ADAPT DESIGN` for read-only display | Read from persisted engine output; do not add a second formula path |
| GDV range | may reconstruct the range | GDV range is produced by `lib/engine/due-diligence-engine.ts` and persisted only inside engine-result JSON | `NOT AVAILABLE DIRECTLY` | Consume persisted engine output or a dedicated read-model binding later |
| Capital protection | may reconstruct | Current canonical value is already produced in the engine and persisted on the saved-deal row | `REUSE AS-IS` | Read from saved deal / engine output, do not recompute |
| Classification | may reconstruct | Current canonical classification is already produced in the engine and persisted on the saved-deal row | `REJECT` for duplicate logic, `REUSE AS-IS` for read-only exposure | Do not re-derive classification in summary code |
| Recommended next action | may reconstruct | Current saved-deal row has `next_action`, and Investor Shield can supply task recommendations | `ADAPT DESIGN` | Choose a read-only precedence later, but do not introduce a new engine here |
| Blocked / NO-GO meaning | may soften or reinterpret deterministic outcomes | Existing engine and governance docs preserve deterministic authority | `REJECT` | Never soften blocked/no-go semantics |

## API Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Path structure | `src/app/api/saved-deals/[dealId]/summary/route.ts` | Root `app/api/...` convention is used | `ADAPT PATH` | Use root `app/api/saved-deals/[id]/summary/route.ts` if implemented |
| Route parameter | `[dealId]` | Repo uses `[id]` | `ADAPT PATH` | Normalize to `[id]` |
| Response envelope | likely summary payload | Existing routes use `{ success: true, ... }` / safe error envelopes | `ADAPT DESIGN` | Match current safe JSON envelope patterns |
| Missing-deal behavior | likely 404 | Current detail/evidence routes return safe 404s | `REUSE AS-IS` | Mirror the same safe 404 behavior |
| HTTP method | read-only `GET` | Read-only summary route is the only acceptable pattern | `REUSE AS-IS` | Keep it GET-only |
| Validation | likely minimal route param/body validation | Existing routes trim IDs and fail safe | `REUSE AS-IS` | Keep parameter validation simple and safe |
| Repository separation | may bypass repositories | Current repo keeps route logic thin and delegates to repositories/read models | `ADAPT DESIGN` | Keep data access in repositories/read-model helpers |
| Logging/error handling | likely safe route diagnostics | Existing routes use `createSafeRouteErrorDiagnostic()` and avoid leaking secrets | `REUSE AS-IS` | Match the same safe error mapping |

## UI Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Client/server ownership | may be client-rendered or route-fetched | Current detail page is a client page and owns fetch state | `ADAPT DESIGN` | Integrate summary in the current client data-flow or a compatible read-only component |
| Data-fetching ownership | may fetch in component | Existing page fetches saved deals, investor-shield UI, offers, tasks, pipeline, and evidence | `REUSE AS-IS` | Reuse existing page fetch/state patterns where possible |
| Loading state | expected | Current page and panels have explicit loading text | `REUSE AS-IS` | Use the same visible loading-state pattern |
| Error state | expected | Current page and panels use safe read errors | `REUSE AS-IS` | Preserve safe error messaging |
| Empty state | expected | Current page and panels show explicit empty states | `REUSE AS-IS` | Preserve empty-state copy and layout |
| Responsive layout | expected | Existing page uses responsive cards, grids, and tables | `REUSE AS-IS` | Fit the summary into the same layout system |
| Saved-deal selection | expected | Current page already tracks selected saved-deal detail | `REUSE AS-IS` | Insert summary near the existing selected deal detail |
| Placement near Investor Shield / Evidence Lite | expected adjacent summary area | Current page already renders Investor Shield and dev-only Evidence Lite inside the detail surface | `REUSE AS-IS` | Place Investor Summary next to the existing read-only detail blocks |
| Development-only versus production | summary should not depend on dev-only boundaries | Evidence Lite is dev-only; Investor Summary should not inherit that guard | `ADAPT DESIGN` | Keep Investor Summary production-safe and separate from dev-only Evidence Lite behavior |
| Status-label safety | should not soften deterministic states | Current UI keeps deterministic and shield states explicit | `REJECT` for any softening, otherwise `REUSE AS-IS` | Preserve explicit status language |

## Test and Documentation Compatibility

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Test location | `src/__tests__` implied by scaffold structure | Repo tests live under root `__tests__/` | `ADAPT PATH` | Place any future tests under root `__tests__/` |
| Test strategy | scaffold-specific coverage expected | Repo already uses contract, route, repository, and UI tests | `REUSE AS-IS` | Follow current test style and safe mocking patterns |
| Documentation path | `docs/qa/phase4g_acceptance_checklist.md` | Repo docs live in `docs/phase4/` | `ADAPT PATH` | Keep QA/checklist docs in `docs/phase4/` |
| Reference docs | batch inventory and prior phase closure docs | Both are present and usable | `REUSE AS-IS` | Reuse existing phase docs for traceability |

## Full Compatibility Matrix

| Scaffold Area | Scaffold Assumption | Current Repository Reality | Classification | Future Adaptation Needed |
|---|---|---|---|---|
| Summary helper path | `src/lib/investor-summary/summary.ts` | Root `lib/engine/intelligence/investor-summary-engine.ts` is the closest helper | `ADAPT PATH` | Decide whether to reuse the existing helper or create a root-path equivalent |
| Summary component path | `src/components/investor-summary/InvestorSummaryView.tsx` | Root `components/` and `app/page.tsx` are the active UI locations | `ADAPT PATH` | Place the component under repo conventions |
| Summary API path | `src/app/api/saved-deals/[dealId]/summary/route.ts` | Root `app/api/` conventions and `[id]` are canonical | `ADAPT PATH` | Use repo route conventions |
| Database adapter | independent DB access assumed by scaffold is unknown | Shared adapter exists and should be reused | `REUSE AS-IS` for adapter, `UNRESOLVED` for scaffold internals | Reuse `lib/db/postgres.ts` only |
| Saved-deal ID/type | text `id` / maybe `dealId` in scaffold | Canonical saved-deal ID is text `id` | `ADAPT FIELD` | Normalize to `id` and route `[id]` |
| Saved-deal fields | address, purchase, classification, governance, capital protection, pipeline, engine JSON, risk summary, next action | All exist in `saved_deals`; GDV range is only in engine JSON | `MATCH` for most fields, `NOT AVAILABLE DIRECTLY` for GDV range | Read from current row/engine JSON |
| Task fields | task title/type/status/priority/blocker/due date/timestamps | Current task schema uses `deal_id`, `task_title`, `task_status`, etc. | `ADAPT FIELD` | Map scaffold names to canonical task columns |
| Offer fields | amount/type/status/rationale/seller response/timestamp | Current offer schema uses `deal_id`, `offer_amount`, `offer_status`, etc. | `ADAPT FIELD` | Map scaffold names to canonical offer columns |
| Investor Shield status | independent status may be recalculated | Canonical evaluation already exists | `REJECT` | Consume canonical shield output only |
| Missing evidence | scaffold may try to rebuild evidence logic | Current gate summaries already carry missing evidence data | `REUSE AS-IS` | Reuse current missing-evidence summaries |
| Evidence Lite contract | legacy values may appear | Canonical contract rejects several legacy values | `ADAPT TO CURRENT CANONICAL CONTRACT` | Normalize to current enum set |
| True MAO | may recalculate | Engine output already provides it and it is persisted in JSON | `REJECT` for recalculation | Read persisted engine output |
| GDV range | may be reconstructed | Only available through engine output JSON today | `NOT AVAILABLE DIRECTLY` | Bind from engine JSON later |
| Recommended next action | may create a new engine | Current row already stores `next_action`; shield recommends tasks | `ADAPT DESIGN` | Use a read-only precedence later, not a second engine |
| API conventions | safe read-only route expected | Existing route conventions are thin, safe, read-only, and repository-backed | `REUSE AS-IS` | Mirror current conventions |
| UI integration | summary should sit near existing read-only detail blocks | `app/page.tsx` already hosts detail, shield, evidence, offers, tasks | `REUSE AS-IS` | Place the summary in that existing detail surface |
| Tests | repo uses root `__tests__` with route/repo/UI coverage | Existing patterns are strong and reusable | `REUSE AS-IS` | Add any future tests under root `__tests__/` |
| Phase 4G checklist location | scaffold points to `docs/qa/` | Current repo uses `docs/phase4/` | `ADAPT PATH` | Store checklist in `docs/phase4/` |

## Reusable Without Change

- `lib/db/postgres.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/investor-shield/load-investor-shield-ui-model.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/investor-shield/investor-shield-ui-adapter.ts`
- `components/SavedDealInvestorShieldPanel.tsx`
- `components/InvestorShieldPanel.tsx`
- `app/page.tsx` as the current saved-deal integration surface

## Must Be Adapted

- `src/` scaffold paths must be adapted to root `app/`, `components/`, `lib/`, `types/`, and `docs/phase4/`
- `[dealId]` must be adapted to `[id]`
- `saved_deal_id`-style assumptions must be adapted to `deal_id` where task/offer/evidence tables are involved
- Scaffold status fields must be adapted to current canonical names such as `task_status` and `offer_status`
- Evidence Lite legacy enum values must be adapted to the current canonical contract

## Must Be Rejected

- Any second `pg.Pool`
- Any direct route-level database access that bypasses shared repositories/read models when the repo already has a reusable pattern
- Any independent Investor Shield evaluator or status re-derivation
- Any True MAO recalculation
- Any duplicate classification or capital-protection logic
- Any softening of blocked / no-go / governance outcomes
- Any legacy Evidence Lite values that the current validator rejects, including `GENERAL`, `GENERAL_NOTE`, `PHOTO_NOTE`, and `RECEIVED`

## Unresolved Items for Phase 4F-0C

- Exact source-of-truth field mapping for the summary read model
- Exact precedence for the future recommended-next-action field
- Whether GDV range should be read from engine JSON only or surfaced through a dedicated read-model shape
- Whether any Evidence Lite aggregation should be shown in summary once 4F-0C starts
- Whether the summary route should live as a dedicated route helper or be folded into a shared read-model layer
- Whether the existing `lib/engine/intelligence/investor-summary-engine.ts` helper should be reused directly or wrapped

## Explicit Non-Implementation

- No runtime code changed.
- No tests changed.
- No migration changed or executed.
- No SQL ran.
- No database mutation occurred.
- No environment changed.
- No redeploy occurred.
- No production route was called.
- Deterministic engine remained untouched.

## Verdict

`PHASE 4F-0B PARTIALLY COMPLETE - SCAFFOLD EVIDENCE GAP`

## Recommended Next Step

`Phase 4F-0C - Canonical Summary Field Mapping`
