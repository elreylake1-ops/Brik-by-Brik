# Phase 4F PDF Evidence Pack Pure Composer Plan

## Purpose

Define the narrow pure composer boundary for the PDF Evidence Pack so the next implementation step can assemble already-loaded canonical data into one deterministic pack without adding loading, rendering, storage, or PDF behavior.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `5b690d55b18d1abc0239b431c3f391214ca6eff2` |
| `origin/main` | `5b690d55b18d1abc0239b431c3f391214ca6eff2` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `AGENTS.md`
- `LEAN-CTX.md`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `__tests__/fixtures/pdf-evidence-pack-fixtures.ts`
- `__tests__/pdf-evidence-pack-contract.test.ts`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_SCOPE_LOCK_AND_ARCHITECTURE_READINESS.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_CANONICAL_TYPE_CONTRACT_AND_TESTS.md`
- `types/investor-summary.ts`
- `types/investor-shield-enforcement.ts`
- `types/evidence-lite.ts`
- `lib/investor-summary/compose-investor-summary-view-model.ts`
- `lib/investor-summary/map-investor-summary-view-model.ts`
- `lib/investor-summary/fetch-investor-summary.ts`
- `lib/investor-summary/select-active-investor-summary-tasks.ts`
- `lib/investor-summary/select-latest-investor-summary-offer.ts`
- `lib/investor-summary/investor-summary-repository.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `lib/operator-command/saved-deals-repository.ts`

## Current Canonical Contract

The committed pack contract is:

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

The identity alias is intentional:

```ts
type PdfEvidencePackIdentity = InvestorSummaryViewModel["deal"]
```

That means `identity` is not a separate DTO. It is the canonical deal identity type already owned by Investor Summary.

## Composer Objective

The future composer should be a pure function that:

- accepts plain already-loaded canonical values
- returns one deterministic `PdfEvidencePack`
- performs no I/O
- performs no fetching
- performs no repository access
- performs no database access
- performs no rendering
- performs no PDF generation
- performs no mutation

Conceptual boundary:

```text
Already-loaded canonical read models
→ pure PDF Evidence Pack composer
→ PdfEvidencePack
```

The composer must not own source loading.

## Proposed Composer Input

Use a narrow input that only contains values the composer cannot safely fix itself.

Recommended shape:

```ts
type ComposePdfEvidencePackInput = {
  generatedAt: string
  confidentialityLabel: string
  investorSummary: InvestorSummaryViewModel
  investorShield: InvestorShieldEnforcementResult
  evidenceIndex: readonly PdfEvidencePackEvidenceItem[]
  disclaimers: readonly PdfEvidencePackDisclaimer[]
}
```

Notes:

- `generatedAt` stays caller-supplied and deterministic.
- `confidentialityLabel` stays caller-supplied because it is presentation policy, not business inference.
- `schemaVersion`, `audience`, `purpose`, and `generationMode` should be fixed literals inside the composer module.
- `identity` should not be passed separately.
- `savedDealId` should be derived from `investorSummary.deal.dealId`.

## Proposed Function Signature

Recommended signature:

```ts
export function composePdfEvidencePack(
  input: ComposePdfEvidencePackInput
): PdfEvidencePack
```

Result behavior:

- return the direct `PdfEvidencePack` value
- do not use a success/error union
- do not add runtime validation branching for impossible states

## Identity Ownership

Use one canonical authority only:

- `identity` is copied directly from `investorSummary.deal`
- `meta.savedDealId` is derived from the same canonical deal identity
- the composer must not accept a second independent identity input

This keeps the deal identity single-sourced and avoids conflicts between pack identity and summary identity.

## Metadata Ownership

Fixed literals inside the composer:

- `schemaVersion`
- `audience`
- `purpose`
- `generationMode`

Caller-supplied values:

- `generatedAt`
- `confidentialityLabel`

Derived from canonical input:

- `savedDealId` from `investorSummary.deal.dealId`

The composer should not call `new Date()`.

## Evidence Projection Ownership

Smallest safe boundary:

- the composer should receive already-projected `PdfEvidencePackEvidenceItem[]`
- it should not receive raw Evidence Lite database rows
- it should not receive `EvidenceLiteRecord`

Reasoning:

- the pack contract already defines the safe pack-specific evidence shape
- raw Evidence Lite rows contain implementation-specific fields such as note text and storage-like details that must not leak by accident
- keeping projection outside the composer makes the composer smaller and easier to test

If the future aggregation layer starts from raw Evidence Lite records, a separate narrow pure projection helper can be added upstream later. That helper is not part of this composer step.

## Exact Mapping Matrix

| Output Field | Input Authority | Mapping Rule | Nullable/Empty Rule | Inference Allowed |
| --- | --- | --- | --- | ---: |
| `meta.schemaVersion` | Composer literal | Fixed literal | Never null | No |
| `meta.generatedAt` | `generatedAt` input | Copy as-is | Must remain ISO string | No |
| `meta.savedDealId` | `investorSummary.deal.dealId` | Copy as-is | Must be present | No |
| `meta.audience` | Composer literal | Fixed literal | Never null | No |
| `meta.purpose` | Composer literal | Fixed literal | Never null | No |
| `meta.generationMode` | Composer literal | Fixed literal | Never null | No |
| `meta.confidentialityLabel` | `confidentialityLabel` input | Copy as-is | Must remain a string | No |
| `identity` | `investorSummary.deal` | Copy canonical deal identity directly | No extra fallback | No |
| `investorSummary` | `investorSummary` input | Pass through unchanged | Preserve nulls and arrays | No |
| `investorShield` | `investorShield` input | Pass through unchanged | Preserve nulls and arrays | No |
| `evidenceIndex` | Pre-projected pack evidence input | Preserve input order and fields | Empty array remains empty | No |
| `disclaimers` | Pre-approved disclaimer input | Preserve input order and fields | Empty array remains empty only if caller intentionally supplies none | No |
| `evidenceIndex[].evidenceId` | Pre-projected evidence item | Copy as-is | Required string | No |
| `evidenceIndex[].evidenceType` | Pre-projected evidence item | Copy as-is | Required canonical type | No |
| `evidenceIndex[].title` | Pre-projected evidence item | Copy as-is | Required string | No |
| `evidenceIndex[].description` | Pre-projected evidence item | Copy as-is | `null` stays `null` | No |
| `evidenceIndex[].provenanceLabel` | Pre-projected evidence item | Copy as-is | `null` stays `null` | No |
| `evidenceIndex[].capturedAt` | Pre-projected evidence item | Copy as-is | `null` stays `null` | No |
| `evidenceIndex[].reviewedAt` | Pre-projected evidence item | Copy as-is | `null` stays `null` | No |
| `evidenceIndex[].reviewStatus` | Pre-projected evidence item | Copy as-is | Required canonical status | No |
| `evidenceIndex[].relatedGateIds` | Pre-projected evidence item | Preserve exact array order | Empty array allowed | No |
| `evidenceIndex[].controlledReferenceState` | Pre-projected evidence item | Copy as-is | Required string union | No |
| `evidenceIndex[].controlledReferenceLabel` | Pre-projected evidence item | Copy as-is | `null` stays `null` | No |
| `disclaimers[].code` | Pre-approved disclaimer item | Copy as-is | Required string | No |
| `disclaimers[].title` | Pre-approved disclaimer item | Copy as-is | Required string | No |
| `disclaimers[].body` | Pre-approved disclaimer item | Copy as-is | Required string | No |
| `disclaimers[].required` | Pre-approved disclaimer item | Copy as-is | Required boolean | No |

## Deterministic Authority Boundary

The composer must not:

- recalculate True MAO
- recalculate profit, ROI, yield, margin, or capital exposure
- infer deal classification
- infer Investor Shield status
- infer gate satisfaction
- infer gate failure from evidence status
- generate recommendations from tasks
- select the latest offer
- reorder offers
- rewrite warnings
- soften blocked risk
- convert `null` to zero
- fabricate missing evidence
- generate narrative text
- use AI

The composer only assembles canonical outputs that were already decided upstream.

## Ordering Ownership

Ordering should be owned by the caller and preserved by the composer.

Rules:

- preserve `evidenceIndex` order exactly as provided
- preserve `disclaimers` order exactly as provided
- do not sort by title, amount, status, or timestamp
- do not mutate nested arrays from `investorSummary` or `investorShield`

For nested canonical sections, the composer should keep the existing order already present in the input objects.

## Unavailable and Empty-State Behavior

Plan exact behavior:

- `null` financial values remain `null`
- canonical zero remains zero
- no evidence remains an empty array
- no tasks remain an empty array in the supplied canonical models
- no offer remains `null` in the supplied canonical models
- unavailable Shield data remains `null` or empty only if the canonical input already expresses it that way
- unavailable controlled references remain `null`
- empty disclaimer input remains an empty array only if the caller intentionally supplies it

Missing required disclaimers:

- should be prevented by typed input and focused tests
- should remain caller responsibility rather than a runtime result union
- should not introduce a general validation framework

## Composer Result Behavior

Recommended signature:

- direct `PdfEvidencePack` return

Not recommended:

- `ok/error` result unions
- runtime validation objects
- error envelopes for impossible states

If the composer receives typed canonical input, composition should be total and deterministic.

## Privacy Enforcement

Privacy should be enforced by a combination of type design, projection, and targeted tests.

Exclusions to enforce:

- personal names
- phone numbers
- email addresses
- authentication identifiers
- broker contact details
- internal notes
- raw database metadata
- `DATABASE_URL`
- SQL
- stack traces
- trace IDs
- Supabase identifiers
- storage bucket names
- private object paths
- raw signed URLs
- local file paths
- repository implementation details

Mechanisms:

- exclusion by type design: the composer input does not accept raw rows or db objects
- exclusion by projection: evidence arrives already projected into pack-safe fields
- exclusion by focused tests: serialize fixtures and assert forbidden fragments are absent

No runtime scanning of arbitrary strings is required.

## Fixture Reuse

Reuse the already-committed pack fixtures:

- `__tests__/fixtures/pdf-evidence-pack-fixtures.ts`
- `__tests__/fixtures/investor-summary-fixtures.ts`

Recommended composer test setup:

- one base composer input fixture
- small derived variants for blocked, null-versus-zero, empty, and privacy-minimized cases
- no duplicate large fixture tree

## Focused Composer-Test Plan

Planned minimum tests:

1. Complete canonical input composes the expected pack.
2. Fixed metadata literals are applied correctly.
3. Identity comes from one canonical authority.
4. Blocked Shield state remains unchanged.
5. `null` remains unavailable and zero remains zero.
6. Empty evidence tasks or offer states remain empty or null as supplied by canonical input.
7. Evidence metadata projection excludes unsafe fields, if a separate projection helper is later added.
8. Input ordering is preserved.
9. Output is JSON-serializable.
10. No calculations or business inference occur.

Avoid full-object snapshots unless they provide better signal than targeted assertions.

## Helper Assessment

Current recommendation:

- do not add a helper in the composer step itself
- keep the composer consuming already-projected `PdfEvidencePackEvidenceItem[]`

Conditional future helper:

- `mapEvidenceLiteToPdfEvidenceItem(...)`

Justified only if:

- future aggregation begins from raw Evidence Lite records
- the helper is pure
- privacy filtering is explicit
- the helper prevents raw repository data from entering the pack

No additional helpers are justified for metadata, identity, disclaimers, or canonical nested model copying.

## Planned Future Files

Likely next files:

| Future File | Purpose | Required | Why |
| --- | --- | ---: | --- |
| `lib/pdf-evidence-pack/compose-pdf-evidence-pack.ts` | Pure composer | Yes | Main implementation boundary |
| `__tests__/pdf-evidence-pack-composer.test.ts` | Focused composer tests | Yes | Verify deterministic mapping |
| `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_PURE_COMPOSER_COMPLETION.md` | Completion note | Yes | Closure and handoff |
| `lib/pdf-evidence-pack/map-evidence-lite-to-pdf-evidence-item.ts` | Optional projection helper | No, unless needed later | Only if raw Evidence Lite records become the input source |

Do not create:

- repository files
- routes
- UI components
- renderer files
- print files
- storage files
- database files

## Deferred Work

Explicitly defer:

- source loading and repository aggregation
- API/download route
- browser-rendered pack page
- print stylesheet
- PDF output
- PDF library evaluation
- generation button
- storage
- persistence
- signed URL resolution
- attachment embedding
- background jobs
- bulk export
- external sharing
- production implementation

## Explicit Non-Implementation

Confirmed:

- no composer implemented
- no helper implemented
- no test created
- no contract changed
- no repository
- no route
- no renderer
- no UI
- no PDF library
- no storage
- no database access
- no migration
- no production access
- no deployment
- no environment change
- `.gitignore` untouched

## Verdict

`PDF EVIDENCE PACK PURE COMPOSER PLAN COMPLETE — READY FOR LEAN COMPOSER IMPLEMENTATION`

## Recommended Next Step

Implement the pure PDF Evidence Pack composer and focused mocked tests only.
