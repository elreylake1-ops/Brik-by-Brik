# Phase 4E-7 Evidence Lite Item Patch Local Only

## Purpose
Add a narrow, local-only Evidence Lite item update boundary for an existing saved-deal record without enabling production behavior or live database access.

## Files Added or Changed
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `lib/evidence-lite/evidence-lite-validation.ts`
- `__tests__/evidence-lite-item-api-route.test.ts`
- `__tests__/evidence-lite-validation.test.ts`
- `docs/phase4/PHASE_4E_7_EVIDENCE_LITE_ITEM_PATCH_LOCAL_ONLY.md`

## Route
`PATCH /api/saved-deals/[id]/evidence/[evidenceId]`

## Mutable Fields
- `title`
- `evidenceType`
- `linkedGate`
- `note`
- `reviewed`

`status` is intentionally excluded from the patch surface.

## Immutable Identity Protection
- URL deal ID is authoritative
- URL evidence ID is authoritative
- body identities are rejected

## Partial Update Semantics
- omitted fields remain unchanged
- no defaults are injected for omitted fields
- empty updates fail
- unknown fields fail

## Saved-Deal and Cross-Deal Protection
- the saved deal is checked first after body validation succeeds
- evidence is looked up only under the route deal ID
- a missing saved deal returns a safe `404`
- a missing or cross-deal evidence record returns a safe `404`
- the route never performs a global evidence lookup

## Validation and Normalization
- existing Evidence Lite enums are reused
- canonical values are passed to the repository
- `SOLICITOR_FEEDBACK` behavior follows the existing validator and normalizes to `SOLICITOR_REVIEW`
- `GENERAL` and `RECEIVED` are rejected
- title and note are trimmed before update
- title and note length caps from the Evidence Lite contract are enforced in the update validator
- body `dealId`, `id`, `evidenceId`, `createdAt`, `updatedAt`, and unsupported fields are rejected

## Reviewed-State Meaning
`reviewed` marks only the Evidence Lite record as reviewed. It does not satisfy, approve, or waive an Investor Shield gate.

## Response Shape
- success: `{ success: true, evidence: {...} }`
- the route returns the canonical repository record, not the submitted body
- successful updates return HTTP `200`

## Safe Error Contract
- malformed JSON -> `400`
- validation failure -> `400`
- invalid saved-deal id -> `400`
- invalid evidence id -> `400`
- missing saved deal -> `404`
- missing or cross-deal evidence -> `404`
- repository failure -> `500`
- stable unexpected failure code: `EVIDENCE_LITE_UPDATE_FAILED`
- no SQL, stack traces, connection strings, environment variables, raw Postgres errors, or Supabase references are exposed

## Side-Effect Prohibition
The PATCH route does not call or trigger:
- Investor Shield evaluation
- gate satisfaction
- gate waiver
- task creation
- offer creation or mutation
- pipeline movement
- saved-deal mutation
- due-diligence state mutation
- upload processing
- OCR
- AI
- image or video analysis
- PDF generation

## Mocked Test Coverage
- partial title update returns `200`
- partial note update returns `200`
- partial reviewed update returns `200`
- evidence type update returns `200`
- canonical linked-gate update returns `200`
- `SOLICITOR_FEEDBACK` normalization follows the existing validator
- normalized partial input is passed to the repository
- omitted fields remain omitted
- route deal ID is passed to the repository
- route evidence ID is passed to the repository
- canonical repository record is returned in the expected envelope
- malformed JSON returns `400`
- empty object returns `400`
- body `dealId` returns `400`
- body `id` returns `400`
- body `evidenceId` returns `400`
- created timestamp field returns `400`
- updated timestamp field returns `400`
- unknown field returns `400`
- `status` returns `400`
- blank title returns `400`
- invalid note returns `400`
- invalid evidence type returns `400`
- `GENERAL` returns `400`
- `RECEIVED` returns `400`
- arbitrary linked gate returns `400`
- missing saved deal returns `404`
- missing saved deal does not call evidence lookup
- missing saved deal does not call update repository
- missing evidence returns `404`
- missing evidence does not call update repository
- cross-deal evidence is treated as missing
- cross-deal evidence does not call update repository
- saved-deal repository failure returns safe `500`
- evidence lookup failure returns safe `500`
- update repository failure returns safe `500`
- response uses `EVIDENCE_LITE_UPDATE_FAILED` where appropriate
- response does not expose internal error details, SQL, stack data, or connection details
- route exports no `PUT` or `DELETE`
- route contains no raw SQL
- route creates no `pg.Pool`
- route contains no migration execution
- route contains no upload, OCR, AI, image, video, PDF, or automation behavior
- successful PATCH calls no task, offer, pipeline, waiver, saved-deal update, or Investor Shield functions

## Production Execution Block
Confirmed:
- the migration remains unexecuted
- the route was not tested against a live database
- the API was not called against production
- no live persistence proof was performed
- production UI remains inactive

Production activation remains blocked until:
- exact Vercel Production `DATABASE_URL` is verified
- deployment is `READY`
- production baseline read routes pass
- Phase 4E migration is approved and executed
- collection GET/POST post-migration proof passes
- item PATCH post-migration proof is authorized and passes
- production UI activation is separately approved

## Explicit Non-Implementation
This step adds:
- no item GET
- no PUT
- no DELETE
- no edit UI
- no upload
- no OCR
- no AI
- no image/video analysis
- no PDF
- no Investor Summary
- no production activation

## Result
PHASE 4E-7 EVIDENCE LITE ITEM PATCH COMPLETE — LOCAL MOCKED TESTS ONLY

## Recommended Next Step
Phase 4E-8 — Minimal Evidence Lite Edit UI Development-Only
