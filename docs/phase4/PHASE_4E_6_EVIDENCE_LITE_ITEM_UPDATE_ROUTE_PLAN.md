# Phase 4E-6 Evidence Lite Item Update Route Plan

## Purpose
Plan a future item-level Evidence Lite update API boundary without implementing it.

## Current Baseline
- collection GET/POST route exists
- repository update helper already exists
- local-only panel currently supports list/create only
- migration remains unexecuted
- no live persistence proof exists
- production UI remains inactive

## Proposed Future Route
Plan exactly:

`PATCH /api/saved-deals/[id]/evidence/[evidenceId]`

Identity rules:
- `[id]` is the authoritative saved-deal identity
- `[evidenceId]` is the authoritative evidence identity
- neither identity may be supplied or overridden by the request body

Do not recommend `PUT`.

Do not plan `DELETE` in this phase.

## Mutable Fields
The existing update contract supports these mutable fields:
- `title`
- `evidenceType`
- `linkedGate`
- `note`
- `reviewed`
- `status`

For this phase, the planned PATCH selects the following mutable fields:
- `title`
- `evidenceType`
- `linkedGate`
- `note`
- `reviewed`

`status` remains a valid repository mutation field, but the update route plan intentionally defers it to avoid widening the route surface beyond the selected patch scope unless a later contract review explicitly requires it.

## Immutable Fields
At minimum, immutable fields are:
- evidence record ID
- saved-deal ID / `dealId`
- created timestamp
- database ownership identity

Additional immutable fields from the current contract:
- `updatedAt` is managed by the database/update layer
- any unknown fields
- any body-supplied identity fields
- any fields outside the selected mutable subset

## Patch Semantics
- omitted fields remain unchanged
- explicitly supplied nullable fields follow the existing contract
- unknown fields are rejected
- blank updates with no mutable fields are rejected
- textual fields are trimmed
- canonical values are required
- `SOLICITOR_FEEDBACK` handling must follow the existing validation policy
- `GENERAL` remains invalid
- `RECEIVED` remains invalid

## Parent and Record Existence Checks
Safe lookup order:
1. Validate and trim saved-deal route ID.
2. Validate and trim evidence route ID.
3. Confirm saved deal exists.
4. Confirm the evidence record exists under that saved deal.
5. Reject cross-deal access.
6. Apply only validated normalized updates.

Protection plan:
- an evidence record belonging to another saved deal must not be readable or mutable through this route
- missing and cross-deal records should follow safe non-disclosing behavior
- following the current repository shape, a missing parent or missing/cross-deal evidence record should both be treated as safe `404` outcomes unless future repository review establishes a stricter distinction

## Reviewed-State Meaning
- `reviewed` means only that the Evidence Lite record was reviewed
- `reviewed` does not mean the linked Investor Shield gate is satisfied
- `reviewed` does not waive evidence requirements
- `reviewed` does not alter gate status
- `reviewed` does not trigger tasks, offers, or pipeline movement

## Safe Error Contract
- malformed JSON -> `400`
- invalid route identity -> safe client error following project convention
- validation failure -> `400`
- missing saved deal -> `404`
- missing or cross-deal evidence record -> safe `404`
- unexpected repository failure -> `500`

Recommended stable safe error code:

`EVIDENCE_LITE_UPDATE_FAILED`

Do not expose:
- SQL
- stack traces
- connection strings
- environment variables
- raw Postgres errors
- Supabase host or project references

## Future Mocked Route Test Matrix
Plan tests for:
- valid partial title update
- valid note update
- valid reviewed update
- canonical linked-gate update
- omitted fields remain omitted
- normalized input reaches repository
- body `dealId` rejected
- body evidence ID rejected
- unknown fields rejected
- empty update rejected
- `GENERAL` rejected
- `RECEIVED` rejected
- malformed JSON returns `400`
- missing saved deal returns `404`
- missing deal stops evidence lookup/update
- missing evidence returns `404`
- cross-deal evidence update is blocked
- repository failure returns safe `500`
- response does not leak internal error details
- no Investor Shield evaluation occurs
- no task creation occurs
- no offer mutation occurs
- no pipeline movement occurs
- no waiver or saved-deal mutation occurs

## Future UI Boundary
Edit controls are not part of Phase 4E-6.

A future UI step may add:
- explicit Edit action
- small inline or controlled form
- Save and Cancel actions
- no optimistic canonical record mutation
- safe error handling
- development-only visibility until production activation is approved

Do not plan modal-heavy or dashboard-level UI.

## Explicit Non-Implementation
This step adds:
- no route
- no TypeScript contract
- no repository change
- no validation change
- no tests
- no UI
- no migration change
- no database access
- no production behavior

## Production Execution Block
Future implementation and activation remain blocked until:
- exact Vercel Production `DATABASE_URL` is verified
- deployment is `READY`
- existing production read routes pass
- Phase 4E migration is approved and executed
- collection GET/POST routes pass post-migration verification
- item PATCH implementation passes mocked tests
- production UI activation is separately approved

## Result
PHASE 4E-6 EVIDENCE LITE ITEM UPDATE ROUTE PLAN COMPLETE â€” NO IMPLEMENTATION

## Recommended Next Step
Phase 4E-7 â€” Evidence Lite Item PATCH Validation and Route Locally Only

Phase 4E-7 should still use mocked route tests and must not execute the migration.
