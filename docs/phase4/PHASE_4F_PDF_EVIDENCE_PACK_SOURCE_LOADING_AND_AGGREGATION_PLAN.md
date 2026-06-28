# Phase 4F PDF Evidence Pack Source Loading and Aggregation Boundary Plan

## Purpose

Define the read-only source-loading boundary for the PDF Evidence Pack so the future aggregation step can assemble canonical deal data, Shield state, tasks, offers, and Evidence Lite metadata without adding route, renderer, storage, or PDF behavior.

This phase is inspection-only. No runtime implementation, tests, route, renderer, storage, or database schema change is added.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `f9e404891231dcc2564bce43558bdbc87b9549eb` |
| `origin/main` | `f9e404891231dcc2564bce43558bdbc87b9549eb` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SCOPE_LOCK_AND_ARCHITECTURE_READINESS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_AND_TESTS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_PURE_COMPOSER_PLAN.md`
- `docs/phase4/PHASE_4F_3A_1_SAVED_DEAL_AND_ENGINE_RESULT_EXTRACTION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2A_CANONICAL_INVESTOR_SHIELD_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_1_CANONICAL_DEAL_TASK_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_2B_2_CANONICAL_DEAL_OFFER_LOADING_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3A_INVESTOR_SUMMARY_REPOSITORY_AGGREGATION_CONTRACT.md`
- `docs/phase4/PHASE_4F_3A_3B_1_SAVED_DEAL_EXISTENCE_GATE_AND_DEPENDENCY_SEQUENCE.md`
- `docs/phase4/PHASE_4F_3A_3B_2_POST_GATE_CONCURRENCY_AND_READ_CONSISTENCY.md`
- `docs/phase4/PHASE_4F_3A_3D_1_INVESTOR_SUMMARY_REPOSITORY_AND_MOCKED_TESTS.md`
- `docs/phase4/PHASE_4F_3A_3F_1_INVESTOR_SUMMARY_LOCAL_END_TO_END_READ_ONLY_VALIDATION_PLAN.md`
- `docs/phase4/PHASE_4F_3A_3G_1_INVESTOR_SUMMARY_LOCAL_CLOSURE_AND_PRODUCTION_VERIFICATION_READINESS_REVIEW.md`
- `docs/phase4/PHASE_4F_ROADMAP_REVIEW_AFTER_INVESTOR_SUMMARY.md`
- `lib/db/postgres.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `types/evidence-lite.ts`
- `types/investor-summary.ts`
- `types/investor-shield-enforcement.ts`

## Current Contract and Composer Boundary

The committed PDF Evidence Pack contract is already locked in `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`.

Current top-level pack shape:

```ts
type PdfEvidencePack = {
  meta: PdfEvidencePackMeta
  identity: PdfEvidencePackIdentity
  investorSummary: InvestorSummaryViewModel
  investorShield: InvestorShieldEnforcementResult
  evidenceIndex: readonly PdfEvidencePackEvidenceItem[]
  disclaimers: readonly PdfEvidencePackDisclaimer[]
}
```

Current evidence-item contract:

```ts
type PdfEvidencePackEvidenceItem = {
  evidenceId: string
  evidenceType: EvidenceLiteEvidenceType
  title: string
  description: string | null
  provenanceLabel: string | null
  capturedAt: string | null
  reviewedAt: string | null
  reviewStatus: EvidenceLiteStatus
  relatedGateIds: readonly EvidenceLiteGateKey[]
  controlledReferenceState: PdfEvidencePackReferenceState
  controlledReferenceLabel: string | null
}
```

Current boundary decision:

- the pack composer remains pure
- the composer receives already-loaded canonical values
- the composer must not fetch data or touch the database
- the composer must not receive raw repository rows

## Source Authority Matrix

| Source | Owns | Does not own |
| --- | --- | --- |
| `getSavedDealById(dealId)` | saved-deal existence, canonical persisted deal row | Shield evaluation, tasks, offers, Evidence Lite, PDF assembly |
| `loadAndEvaluateInvestorShield(dealId)` | canonical Shield result | route behavior, PDF rendering, summary composition |
| `listTasksForDeal(dealId)` | canonical persisted task rows | active-task filtering, PDF formatting |
| `listOffersForDeal(dealId)` | canonical persisted offer rows | latest-offer selection, PDF formatting |
| `listEvidenceLiteForDeal(dealId)` | canonical Evidence Lite rows | pack-safe projection, controlled-reference metadata |
| `composeInvestorSummaryViewModel(...)` | Investor Summary read model | Evidence Lite projection, pack metadata, disclaimers |
| `composePdfEvidencePack(...)` | final PDF pack assembly | any repository access, any loader access |

## Selected Loading Architecture

Chosen architecture:

`direct canonical loaders + pure projection helper + pure pack composer`

Why:

- `getInvestorSummaryForDeal(dealId)` already loads Shield, tasks, and offers for the summary read model, so using it again as the pack source would duplicate those reads
- the pack needs its own Evidence Lite index, which is not part of the Investor Summary repository contract
- the pack loader should keep one saved-deal gate and one read-only aggregation pass
- each source should keep one authority boundary

Selected post-gate read set:

- `loadAndEvaluateInvestorShield(dealId)`
- `listTasksForDeal(dealId)`
- `listOffersForDeal(dealId)`
- `listEvidenceLiteForDeal(dealId)`

The saved-deal existence check remains the first gate.

## Read-Only Route-To-Panel Path

Future read-only path:

```text
saved-deal id
-> future GET /api/saved-deals/[id]/pdf-evidence-pack
-> loadPdfEvidencePackForDeal(...)
-> canonical summary and Shield composition
-> Evidence Lite projection helper
-> pure PDF Evidence Pack composer
-> future read-only panel or download response
```

This path is planned only. It is not implemented in this phase.

## Saved-Deal Existence Gate

Required sequence:

```text
dealId
-> getSavedDealById(dealId)
-> stop if missing
-> then begin dependent reads
```

No dependent read may begin before the saved deal exists.

This gate preserves:

- canonical not-found behavior
- no partial pack
- no partial summary
- no Evidence Lite read for a missing deal
- no Shield read for a missing deal

## Post-Gate Dependency Sequence

The pack loader should treat the post-gate reads as independent:

1. load canonical Shield result
2. load canonical task rows
3. load canonical offer rows
4. load canonical Evidence Lite rows
5. derive Investor Summary from the canonical summary composition path
6. project Evidence Lite rows into pack-safe evidence items
7. assemble the final PDF pack

The loader should not reuse `getInvestorSummaryForDeal(dealId)` as a nested source, because that would repeat the Shield/task/offer reads already owned by the pack boundary.

## Evidence Lite Projection Boundary

The Evidence Lite repository returns raw rows:

- `id`
- `dealId`
- `evidenceType`
- `linkedGate`
- `title`
- `note`
- `status`
- `reviewed`
- `createdAt`
- `updatedAt`

The PDF pack contract requires a narrower pack-safe shape.

That means a separate pure helper is required between the repository and the pack:

```text
EvidenceLiteRecord
-> pure projection helper
-> PdfEvidencePackEvidenceItem
```

Reasoning:

- the repository rows do not carry the pack's `controlledReferenceState` or `controlledReferenceLabel`
- those fields must not be invented inside the pack composer
- the projection helper keeps repository concerns separate from pack formatting
- the helper can be tested independently from the loader and the composer

The projection helper must not:

- query the database
- mutate repository rows
- fetch Shield, tasks, or offers
- render a document
- invent a second repository

## Generation Metadata Ownership

Pack metadata should remain split by authority:

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

The loader must not call `new Date()` inside pure functions.

## Disclaimer Ownership

Disclaimers should be pack-owned constants, not repository output.

Rules:

- no disclaimer text from the database
- no disclaimer text from Evidence Lite
- no disclaimer text from tasks or offers
- no legal-opinion claim
- no valuation claim
- no lending-certification claim

The future loader may pass disclaimer constants through to the composer, but it must not calculate or infer them.

## Proposed Aggregation Input

Recommended future pack-loader input:

```ts
type LoadPdfEvidencePackInput = {
  dealId: string
  generatedAt: string
  confidentialityLabel: string
}
```

Recommended future aggregation output:

```ts
type PdfEvidencePack = {
  meta: PdfEvidencePackMeta
  identity: PdfEvidencePackIdentity
  investorSummary: InvestorSummaryViewModel
  investorShield: InvestorShieldEnforcementResult
  evidenceIndex: readonly PdfEvidencePackEvidenceItem[]
  disclaimers: readonly PdfEvidencePackDisclaimer[]
}
```

The loader should prepare the input data, then call the pure composer.

## Proposed Function Signature

Recommended future loader signature:

```ts
export async function loadPdfEvidencePackForDeal(
  input: LoadPdfEvidencePackInput
): Promise<PdfEvidencePack>
```

The loader should:

- stop on missing saved deal
- stop on any dependency failure
- return no partial pack
- preserve canonical order from the source repositories

## Validation Infrastructure Matrix

| Infrastructure | Used for | Why it is needed | Why it is not enough alone |
| --- | --- | --- | --- |
| `npm run build` | type and compile validation | proves the new plan does not break the repo build | does not prove boundary behavior |
| `npm run lint` | static correctness | catches style and dependency mistakes | does not prove runtime semantics |
| `npm test` | mocked unit validation | proves loader and projection boundaries through tests | does not prove production availability |
| focused loader tests | existence gate, concurrency, projection, failure propagation | validates the exact source-loading contract | does not replace global repo checks |
| focused projection tests | Evidence Lite row to pack item mapping | validates the narrow helper boundary | does not replace loader tests |

## Selected Validation Model

Selected model:

`build + lint + mocked unit tests`

Why:

- the work is read-only and boundary-driven
- the important failures are contract failures, not UI failures
- the new helper and loader should be validated with deterministic mocks
- production verification belongs to a later closure phase

What is intentionally excluded from this subphase:

- browser automation
- PDF rendering verification
- production smoke verification
- database schema change verification
- route or panel verification

## Validation Scenarios

The future tests should cover:

- blank deal id returns the safe empty/not-found result before any downstream read
- missing saved deal stops all dependent reads
- post-gate Shield, task, offer, and Evidence Lite reads run only after the existence gate
- dependency failure stops aggregation
- no tasks remains a valid empty state
- no offers remains a valid empty state
- empty Evidence Lite remains a valid empty state
- Evidence Lite projection preserves order and preserves existing review status
- pack assembly preserves canonical summary and Shield inputs
- sensitive values do not leak into the pack metadata
- the loader does not call the Investor Summary repository as a nested source

## Layer Assertion Matrix

| Layer | Assertions |
| --- | --- |
| Saved-deal gate | missing deal stops all dependent reads; no partial result |
| Post-gate loader | Shield, tasks, offers, and Evidence Lite are loaded read-only and independently |
| Evidence Lite projection helper | raw rows become pack-safe evidence items; no DB access; no mutation |
| Summary composition | canonical summary is assembled from lower-level canonical inputs |
| Pack composer | pack assembly is pure and deterministic |
| Tests | each layer is mocked at its own boundary and does not hide another layer's failure |

## Database-Independence Boundary

The future PDF Evidence Pack path must keep database access in the repositories only.

Required rules:

- no `query(...)` call outside repository code
- no `process.env.DATABASE_URL` access outside the db adapter
- no second pool for pack work
- no DB client passed into the composer
- no DB client passed into the projection helper
- no raw SQL inside the loader or composer

The loader may coordinate existing repositories, but it must not become a database abstraction layer.

## Sensitive-Data Checks

The future pack loader and tests must ensure the following do not appear in outputs:

- secrets
- connection strings
- `DATABASE_URL`
- raw SQL
- stack traces
- internal trace IDs
- private filesystem paths
- environment variables
- database credentials
- provider-specific runtime details

The pack may contain canonical deal facts and controlled evidence metadata only.

## Fixture Ownership

Fixture ownership for the next phase should stay local to the PDF Evidence Pack area.

Recommended ownership:

- pack-level fixtures in `__tests__/fixtures/pdf-evidence-pack-fixtures.ts`
- projection fixtures in a small helper fixture file next to the projection tests
- no reuse of mutation-side fixtures for pack assembly

Fixture requirements:

- canonical saved-deal success
- missing saved-deal case
- empty tasks/offers/evidence case
- blocked Shield case
- sensitive-data denial case
- Evidence Lite rows with review-state variety

## Planned Phase 3F-2 Files

Planned future implementation files for the next subphase:

- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/project-evidence-lite-record-to-pdf-evidence-item.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-assembly.ts`
- `__tests__/load-pdf-evidence-pack.test.ts`
- `__tests__/project-evidence-lite-record-to-pdf-evidence-item.test.ts`
- `__tests__/fixtures/pdf-evidence-pack-fixtures.ts`

If the implementation is split differently, the same responsibilities must still exist.

## Acceptance Criteria

This plan is ready to advance only when all of the following remain true:

- the saved-deal gate is first
- the pack loader uses canonical low-level loaders directly
- the Investor Summary repository is not reused as a nested loader
- Evidence Lite rows are projected by a separate pure helper
- the composer stays pure
- build, lint, and tests validate the new boundary
- no runtime code is changed in this planning step
- `.gitignore` remains untouched
- no production verification is attempted in this subphase

## Separate Production-Verification Boundary

Production verification must remain separate from this planning step.

If a later implementation phase is added, production verification should:

- prove only the final read-only pack path
- stay read-only
- avoid creating production fixtures
- avoid schema changes for verification alone
- avoid mutation

This planning document does not authorize production verification work.

## Explicit Non-Implementation

Confirmed not added in this step:

- source loader implementation
- repository implementation
- Evidence Lite projection implementation
- route implementation
- renderer implementation
- PDF generation implementation
- storage implementation
- database migration
- UI component
- browser automation
- production access
- `.gitignore` modification

## Verdict

`PHASE 4F PDF EVIDENCE PACK SOURCE-LOADING PLAN COMPLETE - READY FOR CONTROLLED AGGREGATION SUBPHASES`

## Exact Recommended Next Step

`Implement the pure Evidence Lite-to-PDF Evidence Item projection helper and focused tests.`
