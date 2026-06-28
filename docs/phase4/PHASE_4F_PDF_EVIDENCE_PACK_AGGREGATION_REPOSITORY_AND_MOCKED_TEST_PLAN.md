# PDF Evidence Pack Aggregation Repository and Mocked Test Plan

## Purpose

Define the read-only PDF Evidence Pack aggregation boundary so the future implementation can assemble canonical saved-deal, Investor Summary, Investor Shield, and Evidence Lite data without adding route, renderer, storage, PDF, or database-schema behavior.

This plan is inspection and orchestration design only.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `6bed5e051bddf2fb13d66ca390568902f034d226` |
| `origin/main` | `6bed5e051bddf2fb13d66ca390568902f034d226` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |
| Current validated baseline | focused projection test: 1 file / 9 tests; build passed; lint passed; full suite: 107 files / 1046 tests |

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SOURCE_LOADING_AND_AGGREGATION_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_PURE_COMPOSER_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_PURE_COMPOSER_COMPLETION.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_AND_TESTS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_EVIDENCE_LITE_PROJECTION_HELPER_AND_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3A_INVESTOR_SUMMARY_REPOSITORY_AGGREGATION_CONTRACT.md`
- `docs/phase4/PHASE_4F_3A_3B_1_SAVED_DEAL_EXISTENCE_GATE_AND_DEPENDENCY_SEQUENCE.md`
- `docs/phase4/PHASE_4F_3A_3B_2_POST_GATE_CONCURRENCY_AND_READ_CONSISTENCY.md`
- `docs/phase4/PHASE_4F_3A_3C_INVESTOR_SUMMARY_REPOSITORY_FUNCTION_AND_MOCKED_TEST_DESIGN.md`
- `docs/phase4/PHASE_4F_3A_3D_1_INVESTOR_SUMMARY_REPOSITORY_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3F_1_INVESTOR_SUMMARY_LOCAL_END_TO_END_READ_ONLY_VALIDATION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3G_1_INVESTOR_SUMMARY_LOCAL_CLOSURE_AND_PRODUCTION_VERIFICATION_READINESS_REVIEW.md`
- `lib/db/postgres.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item.ts`
- `types/evidence-lite.ts`
- `types/investor-shield-enforcement.ts`
- `types/investor-summary.ts`
- `__tests__/pdf-evidence-pack-contract.test.ts`
- `__tests__/pdf-evidence-pack-composer.test.ts`
- `__tests__/project-evidence-lite-record-to-pdf-evidence-item.test.ts`
- `__tests__/investor-summary-repository.test.ts`
- `__tests__/investor-summary-composition.test.ts`
- `__tests__/investor-summary-active-task-selector.test.ts`
- `__tests__/investor-summary-latest-offer-selector.test.ts`
- `__tests__/investor-shield-read-model.test.ts`
- `__tests__/evidence-lite-repository.test.ts`
- `__tests__/saved-deals-repository.test.ts`
- `__tests__/deal-tasks-repository.test.ts`
- `__tests__/deal-offers-repository.test.ts`

## Existing Verified Boundaries

- `composePdfEvidencePack(...)` is pure and only accepts `generatedAt`, `confidentialityLabel`, `investorSummary`, `investorShield`, `evidenceIndex`, and `disclaimers`.
- `projectEvidenceLiteRecordToPdfEvidenceItem(...)` is the required boundary between raw Evidence Lite rows and pack-safe evidence items.
- Evidence Lite projections are now conservative: `controlledReferenceState` stays `MISSING`, `reviewedAt` stays `null`, and `relatedGateIds` uses only the canonical `linkedGate`.
- `composePdfEvidencePack(...)` must receive already-loaded canonical values and must not fetch data or touch the database.
- The canonical Investor Summary behavior already exists in `composeInvestorSummaryViewModel(...)`, `selectActiveInvestorSummaryTasks(...)`, and `selectLatestInvestorSummaryOffer(...)`.
- The canonical Shield enforcement behavior already exists in `loadAndEvaluateInvestorShield(...)`.
- The canonical Evidence Lite source behavior already exists in `listEvidenceLiteForDeal(...)`.

## Required Canonical Sources

- `getSavedDealById(dealId)` for the saved-deal existence gate.
- `loadAndEvaluateInvestorShield(dealId)` for the canonical `InvestorShieldEnforcementResult`.
- `listTasksForDeal(dealId)` for the canonical task rows that feed Investor Summary composition.
- `listOffersForDeal(dealId)` for the canonical offer rows that feed Investor Summary composition.
- `listEvidenceLiteForDeal(dealId)` for the canonical Evidence Lite rows.
- `composeInvestorSummaryViewModel(...)` for the canonical Investor Summary assembly boundary.
- `projectEvidenceLiteRecordToPdfEvidenceItem(...)` for the Evidence Lite projection boundary.
- `composePdfEvidencePack(...)` for the final pack assembly boundary.

## Canonical Loader Matrix

| Required Pack Input | Existing Loader | Return Type | Reusable Directly | Risk of Duplicate Loading |
| --- | --- | --- | ---: | ---: |
| Saved-deal existence | `getSavedDealById(dealId)` | `Promise<SavedDealRecord \| null>` | Yes | None, this is the first gate |
| Investor Summary | `composeInvestorSummaryViewModel(...)` fed by canonical saved-deal extraction, Shield input, task rows, and offer rows | `InvestorSummaryViewModel` | Yes | None if the pack loader composes from raw canonical inputs; high only if `getInvestorSummaryForDeal(...)` is used instead |
| Investor Shield | `loadAndEvaluateInvestorShield(dealId)` | `Promise<InvestorShieldEnforcementResult>` | Yes | None if the single evaluated result is reused for both pack and summary-adapter needs |
| Task rows | `listTasksForDeal(dealId)` | `Promise<DealTaskRecord[]>` | Yes | None |
| Offer rows | `listOffersForDeal(dealId)` | `Promise<DealOfferRecord[]>` | Yes | None |
| Evidence Lite records | `listEvidenceLiteForDeal(dealId)` | `Promise<EvidenceLiteRecord[]>` | Yes | None |
| Generated timestamp | caller-owned input, not a loader | `string` | Yes | None |
| Confidentiality label | caller-owned input, not a loader | `string` | Yes | None |
| Disclaimers | module-owned constant list, not a repository load | `readonly PdfEvidencePackDisclaimer[]` | Yes | None |

## Selected Investor Summary Loader

Selected boundary: reuse the existing pure summary composer, `composeInvestorSummaryViewModel(...)`, rather than calling `getInvestorSummaryForDeal(...)`.

Why this is the smallest safe option:

- the pack boundary already owns the saved-deal existence gate and the raw post-gate reads
- `composeInvestorSummaryViewModel(...)` already preserves canonical task filtering, offer selection, blocker wiring, warning construction, and ordering
- the pack loader can pass the canonical saved-deal extraction, Shield input, task rows, and offer rows into the existing composer without creating a second Investor Summary repository path

Behavioral notes:

- the summary composer itself performs no database reads
- it does not perform its own saved-deal existence check
- it avoids the duplicate Shield/task/offer reads that would occur if `getInvestorSummaryForDeal(...)` were nested inside the pack boundary
- a narrow pure extractor for the loaded saved-deal row is acceptable inside the future pack loader because it does not create a second repository or a second summary implementation

## Selected Investor Shield Loader

Selected source of truth: `loadAndEvaluateInvestorShield(dealId)`.

Why:

- it returns the canonical `InvestorShieldEnforcementResult`
- it avoids reconstructing enforcement from UI models or from Investor Summary summary-only fields
- it is already the same canonical loader used by the existing Investor Summary repository
- the future pack loader can reuse the single evaluated result for both the pack top-level Shield section and the summary-adapter input

Not selected:

- `loadInvestorShieldEvaluationInput(...)` because it only returns raw evaluation input
- `loadInvestorShieldUiModelForDeal(...)` because it returns a UI model, not the canonical enforcement result

## Saved-Deal Existence Gate

Required sequence:

```text
dealId
-> getSavedDealById(dealId)
-> null / missing: stop immediately
-> found: begin dependent reads
```

Ownership:

- `getSavedDealById(dealId)` owns the saved-deal existence gate
- no dependent read may begin before that gate succeeds

Missing-deal behavior:

- no Shield load
- no task load
- no offer load
- no Evidence Lite load
- no projection
- no summary composition
- no pack composition

## Post-Gate Dependency Sequence

After the saved deal exists, the future loader can run the raw canonical reads together:

```text
loadAndEvaluateInvestorShield(dealId)
listTasksForDeal(dealId)
listOffersForDeal(dealId)
listEvidenceLiteForDeal(dealId)
```

Then:

```text
extract saved-deal canonical values
-> composeInvestorSummaryViewModel(...)
-> project Evidence Lite records
-> composePdfEvidencePack(...)
```

## Concurrency Decision

Selected model:

`Promise.all` for the post-gate raw repository reads

Rationale:

- the Shield, task, offer, and Evidence Lite reads are independent after the saved-deal gate
- no raw read depends on another raw read's output
- the summary composer runs after those reads resolve
- the final pack composer remains pure and serial
- this keeps the first implementation read-only and avoids a transaction unless a real conflict appears later

## Generation Metadata Ownership

Owned by the caller:

- `generatedAt`
- `confidentialityLabel`

Owned by pack constants:

- `schemaVersion`
- `audience`
- `purpose`
- `generationMode`

Derived from canonical inputs:

- `savedDealId`
- `identity`

Rules:

- the aggregation boundary must not call `new Date()` when a deterministic timestamp can be supplied by the future route
- no conflicting `savedDealId` or identity input is permitted because those values are already derived from the loaded canonical data

## Disclaimer Ownership

Approved runtime disclaimer constants do not yet exist as module code.

Smallest correct approach:

- add one exported constant list in the PDF Evidence Pack module, such as `PDF_EVIDENCE_PACK_DISCLAIMERS`
- pass that module-owned list directly to `composePdfEvidencePack(...)`
- keep the loader input small and read-only

Rejected approaches:

- disclaimer database table
- disclaimer repository
- remote disclaimer loading
- caller-supplied disclaimer variants
- legal-review state machine
- partner-specific disclaimer branching

## Proposed Aggregation Input

```ts
type LoadPdfEvidencePackInput = {
  dealId: string
  generatedAt: string
  confidentialityLabel: string
}
```

Notes:

- no `savedDealId` input
- no `investorSummary` input
- no `investorShield` input
- no `evidenceIndex` input
- no `disclaimers` input
- those are derived internally from canonical loaders and module-owned constants

## Proposed Function Signature

```ts
export async function loadPdfEvidencePackForDeal(
  input: LoadPdfEvidencePackInput
): Promise<PdfEvidencePack | null>
```

Return contract:

- `null` for a missing saved deal
- a full `PdfEvidencePack` for success
- thrown error for dependency failure
- no partial pack

## Exact Orchestration Steps

1. Normalize `dealId` using the same trim-and-blank check style used by the existing read-only repository and route helpers.
2. Call `getSavedDealById(normalizedDealId)`.
3. Return `null` immediately if the saved deal is missing.
4. Start the independent post-gate raw reads with `Promise.all`.
5. Extract the saved-deal values needed for Investor Summary composition from the loaded saved-deal row.
6. Build the canonical Shield summary input from the single loaded `InvestorShieldEnforcementResult`.
7. Call `composeInvestorSummaryViewModel(...)` with the extracted saved-deal values, Shield summary input, task rows, and offer rows.
8. Project each Evidence Lite record through `projectEvidenceLiteRecordToPdfEvidenceItem(...)`.
9. Supply the module-owned disclaimer constant list.
10. Call `composePdfEvidencePack(...)`.
11. Return the completed pack.

## Missing-Deal Semantics

Blank deal ID:

- follow existing repository conventions
- normalize to the safe empty case
- return `null`
- do not begin dependent reads

Missing saved deal:

- return `null`
- do not project evidence
- do not compose a pack
- future route may translate the null into `404`

## Dependency-Failure Semantics

- Shield failure propagates
- task failure propagates
- offer failure propagates
- Evidence Lite failure propagates
- saved-deal extraction failure propagates if the loaded row is malformed
- projection helper failure propagates
- summary composer failure propagates
- pack composer failure propagates

No failure should be converted into:

- an empty pack
- a partial pack
- a fallback summary
- a fabricated Shield result
- fabricated evidence availability

## Empty-State Semantics

Valid empty states:

- no tasks
- no offers
- empty Evidence Lite result
- empty `evidenceIndex`

Valid non-empty-but-safe states:

- nullable summary fields
- blocked Shield state
- advisory Shield state

Invalid as a normal pack input:

- an empty disclaimer list supplied by the loader

The loader should always use the approved module-owned disclaimer constant list.

## Read-Consistency Decision

Selected first-implementation model:

`normal read-committed repository reads`

Why:

- the pack is read-only
- the canonical repositories already use the shared Postgres adapter
- no current contract requires a cross-table snapshot for the first implementation
- a transaction would require broader plumbing without a proven correctness gain

Accepted risk:

- small drift between independent reads if the underlying deal changes during pack generation

Unaccepted responses to drift:

- fallback values
- hidden retries
- partial packs
- invented evidence or Shield state

## Validation

### Validation Infrastructure Matrix

| Infrastructure | Used for | Why it is needed | Why it is not enough alone |
| --- | --- | --- | --- |
| `npm run build` | type and compile validation | proves the new orchestration shape still builds | does not prove runtime behavior |
| `npm run lint` | static correctness | catches dependency and style mistakes | does not prove call order |
| `npm test` | mocked unit validation | proves the loader boundaries and failure behavior | does not prove production availability |
| focused orchestration tests | gate, concurrency, propagation, and call order | validates the pack boundary directly | does not replace repo-level coverage |

### Selected Validation Model

`build + lint + mocked unit tests`

Why:

- the work is read-only and boundary-driven
- the critical regressions are contract and orchestration regressions
- browser, PDF, and production verification belong to later workstreams

## Mocking and Dependency-Injection Approach

Selected approach:

`module mocking with Vitest`

Why:

- the codebase already uses `vi.mock` and `vi.hoisted` heavily for repository and orchestration boundaries
- it keeps the production API narrow
- it avoids introducing a service container or broad dependency object just for one pack loader

Future test wiring should mock:

- `getSavedDealById`
- `loadAndEvaluateInvestorShield`
- `listTasksForDeal`
- `listOffersForDeal`
- `listEvidenceLiteForDeal`
- `composeInvestorSummaryViewModel`
- `projectEvidenceLiteRecordToPdfEvidenceItem`
- `composePdfEvidencePack`

## Focused Mocked-Test Plan

Future tests should prove only aggregation behavior:

1. Missing deal stops before every dependent loader.
2. Successful load calls the approved canonical loaders.
3. Post-gate raw loaders are started concurrently.
4. Evidence records pass through the corrected projection helper.
5. Evidence order is preserved.
6. Empty Evidence Lite becomes `[]`.
7. Canonical Investor Summary passes through unchanged.
8. Canonical Shield result passes through unchanged.
9. Generated timestamp and confidentiality label reach the composer unchanged.
10. One dependency rejection prevents composition.
11. No partial pack is returned.
12. No write repository or mutation method is called.
13. No live database, Supabase, Vercel, or production route is required.

Do not duplicate tests for:

- Investor Summary calculations
- Shield evaluation
- Evidence projection semantics
- composer field mapping
- PDF contract serialization

Those lower-level boundaries are already proven.

## Existing Proof Reused

- `__tests__/pdf-evidence-pack-contract.test.ts` proves the pack contract shape and JSON-safety.
- `__tests__/pdf-evidence-pack-composer.test.ts` proves the pure composer behavior.
- `__tests__/project-evidence-lite-record-to-pdf-evidence-item.test.ts` proves the corrected Evidence Lite projection semantics.
- `__tests__/investor-summary-composition.test.ts`, `__tests__/investor-summary-active-task-selector.test.ts`, and `__tests__/investor-summary-latest-offer-selector.test.ts` prove the canonical summary composition behavior that the pack loader will reuse.
- `__tests__/investor-summary-repository.test.ts` proves the existing summary repository behavior and its gate sequencing.
- `__tests__/investor-shield-read-model.test.ts` proves the canonical Shield read-model behavior.
- `__tests__/evidence-lite-repository.test.ts`, `__tests__/saved-deals-repository.test.ts`, `__tests__/deal-tasks-repository.test.ts`, and `__tests__/deal-offers-repository.test.ts` prove the canonical repository boundaries.

## Minimal Future File Set

| Future File | Purpose | Required | Notes |
| --- | --- | ---: | --- |
| `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts` | read-only orchestration, saved-deal gate, raw loads, summary assembly, projection, and final pack composition | Yes | Can hold a tiny pure saved-deal extractor and the module-owned disclaimer constant list if kept compact |
| `__tests__/load-pdf-evidence-pack.test.ts` | focused mocked orchestration tests | Yes | Use module mocking only; no live database |
| `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_AGGREGATION_REPOSITORY_AND_MOCKED_TESTS.md` | later completion note | Yes | Keep planning and completion boundaries separate |
| `lib/pdf-evidence-pack/pdf-evidence-pack-disclaimers.ts` | optional disclaimer constant module | Only if required | Not needed if the approved disclaimer list stays small enough for the loader module |

## Assembly-File Necessity Decision

`lib/pdf-evidence-pack/pdf-evidence-pack-assembly.ts` is not necessary.

Why:

- the future loader can call the pure composer directly
- the loader already owns the orchestration boundary
- a second assembly layer would duplicate orchestration without adding a new authority boundary
- fewer files means easier mocking and less risk of split ownership

## Deferred Work

- API/download route
- HTTP response envelope
- browser-rendered pack page
- print stylesheet
- PDF output
- PDF library evaluation
- generation button
- storage
- persistent snapshots
- signed URLs
- attachment embedding
- external sharing
- background jobs
- bulk export
- production execution

## Explicit Non-Implementation

Confirmed not added in this step:

- aggregation implementation
- mocked tests
- composer change
- projection-helper change
- contract change
- repository query change
- route
- renderer
- UI
- PDF dependency
- database/schema change
- transaction infrastructure
- storage
- production access
- deployment
- migration
- environment change
- `.gitignore` modification

## Verdict

`PDF EVIDENCE PACK AGGREGATION PLAN COMPLETE — READY FOR READ-ONLY ORCHESTRATION IMPLEMENTATION`

## Recommended Next Step

`Implement the read-only PDF Evidence Pack aggregation function and focused mocked orchestration tests.`
