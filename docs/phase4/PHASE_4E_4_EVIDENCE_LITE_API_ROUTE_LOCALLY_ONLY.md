# Phase 4E-4 Evidence Lite API Route Locally Only

## Purpose
Add a narrow Evidence Lite collection API boundary under a saved deal, using the completed validation and repository layers without touching production or other runtime behavior.

## Files Added or Changed
- `app/api/saved-deals/[id]/evidence/route.ts`
- `__tests__/evidence-lite-api-route.test.ts`
- `docs/phase4/PHASE_4E_4_EVIDENCE_LITE_API_ROUTE_LOCALLY_ONLY.md`

## Route Shape
- `GET /api/saved-deals/[id]/evidence`
- `POST /api/saved-deals/[id]/evidence`
- no `PATCH`
- no `PUT`
- no `DELETE`

## Shared Repository Boundary
- `getSavedDealById` is used to verify the parent deal exists
- `listEvidenceLiteForDeal` is used only after existence is confirmed
- `createEvidenceLite` is used only after validation is successful

## Response Contract
- GET success: `{ success: true, evidence: [...] }`
- POST success: `{ success: true, evidence: {...} }`
- malformed JSON: safe `400`
- validation failure: safe `400` with structured validation details
- missing saved deal: safe `404`
- unexpected failure: safe `500` with a stable error code and safe diagnostic metadata

## Validation and Identity Boundary
- the route trims the path `id`
- body-supplied `dealId` is rejected as an immutable identity field
- the route injects the path `id` as the authoritative `dealId`
- `SOLICITOR_FEEDBACK` may reach the validator boundary but is normalized before repository insertion
- `GENERAL`, `RECEIVED`, and arbitrary values are rejected through validation

## Error Safety
- no SQL text is exposed
- no connection strings are exposed
- no stack traces are exposed
- no environment variables are exposed
- no Supabase host/reference is exposed

## Side-Effect Prohibition
Confirmed the route does not:
- create tasks
- mutate offers
- move pipeline state
- mutate saved deals
- mutate waivers
- trigger Investor Shield evaluation

## Mocked Test Coverage
- GET returns evidence for an existing deal
- GET returns empty evidence successfully
- GET rejects blank ids
- GET returns 404 when the saved deal is missing
- GET returns a safe 500 on repository failure
- POST returns 201 for a valid canonical create
- POST rejects body-supplied `dealId`
- POST returns structured validation details
- POST rejects malformed JSON
- POST returns 404 when the saved deal is missing
- POST returns a safe 500 on repository failure

## Production Execution Block
The route exists locally but has not been verified against a live database.

Live verification remains prohibited until:
- exact Production `DATABASE_URL` exists
- a deployment containing it is `READY`
- existing read routes pass
- full production runtime retest passes
- migration execution is reviewed and approved
- the migration is applied successfully

## Deterministic Safety Confirmation
No changes were made to:
- True MAO
- finance calculations
- capital protection
- classification logic
- governance thresholds
- deterministic NO-GO
- Investor Shield hard-gate dominance

## Explicit Non-Implementation
- no migration execution
- no UI
- no production access or mutation
- no Investor Summary implementation

## Result
PHASE 4E-4 EVIDENCE LITE API ROUTE COMPLETE — ROUTE TESTS ONLY

## Recommended Next Step
Phase 4E-5 — Evidence Lite Minimal UI Locally Only
