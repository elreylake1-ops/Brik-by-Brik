# Phase 4H-3B Evidence Lite Workflow SOP

## Purpose

Evidence Lite is informational only and does not by itself satisfy, waive, approve, or override Investor Shield requirements.

This SOP documents the current Evidence Lite workflow so the final handover can explain how the existing read and write paths behave without implying any governance authority beyond what the repository proves.

## Workflow Boundary

Evidence Lite is a deal-linked note surface for review and follow-up.

It is visible through the saved-deal detail experience and is backed by the current Evidence Lite route handlers, repository, validation helpers, and panel component.

Current source evidence:

- `components/evidence-lite/EvidenceLitePanel.tsx`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `lib/evidence-lite/evidence-lite-validation.ts`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `types/evidence-lite.ts`
- `__tests__/evidence-lite-panel.test.tsx`
- `__tests__/evidence-lite-api-route.test.ts`
- `__tests__/evidence-lite-item-api-route.test.ts`
- `__tests__/evidence-lite-validation.test.ts`
- `__tests__/evidence-lite-repository.test.ts`
- `docs/phase4/PHASE_4E_P4A_PRODUCTION_EVIDENCE_LITE_UI_ACTIVATION_AND_BROWSER_PROOF.md`
- `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md`
- `docs/handover/PHASE_4H_1A_CURRENT_SYSTEM_ARCHITECTURE.md`
- `docs/handover/PHASE_4H_3A_INVESTOR_REVIEW_WORKFLOW_SOP.md`

## When to Use Evidence Lite

Use Evidence Lite when the operator needs to:

- view deal-linked evidence notes
- add a new note record for an existing saved deal
- update an existing note record for the same saved deal
- confirm what is recorded, reviewed, missing, or rejected
- review the linked gate and evidence type for a record

Use the current Evidence Lite panel as an informational aid only.

## When Not to Use Evidence Lite

Do not use Evidence Lite to:

- satisfy Investor Shield requirements
- waive a required gate
- approve a deal
- override blocked or cautionary Shield logic
- replace due diligence, legal review, or lending checks
- infer that a missing record is complete
- infer that a recorded note is sufficient evidence

## Read Workflow

The panel loads records through:

```text
GET /api/saved-deals/{deal-id}/evidence
```

Read behavior:

1. The saved-deal id is trimmed before use.
2. Missing or blank ids return a safe 400.
3. The route confirms the saved deal exists before listing evidence.
4. Evidence is returned in reverse chronological order from the repository.
5. The panel renders a read-only card list.
6. The empty state shows:
   `No Evidence Lite records have been added for this deal.`
7. Load failure shows:
   `Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged.`

The read path is safe to repeat and does not require mutation.

## Create Workflow

New records are created through the collection route:

```text
POST /api/saved-deals/{deal-id}/evidence
```

Creation rules:

1. The route owns the `dealId`.
2. The request body must not include `dealId`.
3. The body must be a plain JSON object.
4. Validation runs before repository insertion.
5. Unknown fields are rejected.
6. Canonical values must match the Evidence Lite enums in `types/evidence-lite.ts`.
7. Legacy `SOLICITOR_FEEDBACK` input is normalized to `SOLICITOR_REVIEW`.
8. A valid create request inserts one row and returns `201`.

Creation does not change Investor Shield status or any other governance state.

## Update Workflow

Existing records are updated through the item route:

```text
PATCH /api/saved-deals/{deal-id}/evidence/{evidence-id}
```

Update rules:

1. Both ids are trimmed before use.
2. Missing or blank ids return safe 400 responses.
3. The body must be a plain JSON object.
4. Immutable identity fields are rejected.
5. Only mutable fields are accepted.
6. Empty updates are rejected.
7. Validation normalizes trimmed text fields and canonical gate aliases.
8. The repository updates only the supplied allowed fields and always sets `updated_at`.

Update does not mutate unrelated records and does not create a new deal-level authority.

## Status Interpretation

Current Evidence Lite statuses are:

- `MISSING`
- `RECORDED`
- `REVIEWED`
- `VERIFIED`
- `REJECTED`

Operational meaning:

- `MISSING` means the record is absent or explicitly unresolved.
- `RECORDED` means the note exists and has been stored.
- `REVIEWED` means a human review step has occurred.
- `VERIFIED` means the note has been checked more strongly than a basic review.
- `REJECTED` means the note was rejected and should not be treated as satisfactory.

The UI renders these statuses as labels only. They are not Investor Shield approvals.

## Gate Linkage Rules

Evidence Lite records carry a linked gate and an evidence type.

Rules:

- the linked gate must be one of the canonical Evidence Lite gate keys
- the evidence type must be one of the canonical Evidence Lite evidence types
- `SOLICITOR_FEEDBACK` is treated as a legacy alias for `SOLICITOR_REVIEW`
- `GENERAL` is not a valid Evidence Lite gate value
- Evidence Lite gate linkage is descriptive, not authoritative

The current panel wording is explicit that Evidence Lite does not replace required Investor Shield evidence.

## Refresh and Persistence

The panel reloads records from the server-backed API.

Operational behavior:

- refresh reflects the current repository state
- the page is not a historical snapshot
- repeated reads should return the same canonical data until a mutation occurs
- failed reads must show the safe error state rather than raw route diagnostics

## Error Handling

Safe error handling is required.

Expected behavior:

- malformed JSON returns a safe 400
- invalid ids return a safe 400
- a missing saved deal returns a safe 404
- a missing evidence record returns a safe 404 on item updates
- repository failures return a safe 500 envelope
- raw SQL, credentials, or stack text must not be surfaced in the panel

## Privacy and Data Handling

Evidence Lite is deal-linked operational metadata.

Handle it as read support, not as authority:

- do not expose secret values
- do not expose connection strings
- do not infer production permissions from application reads
- do not treat the presence of a note as proof of due diligence completion

## Operational Review Order

When the operator is checking a deal, review Evidence Lite after the primary deal context is known.

Recommended sequence:

1. confirm saved deal identity
2. load the Evidence Lite list
3. confirm the linked gate and evidence type
4. review the status
5. review the note and reviewer note
6. confirm whether the record is empty, recorded, reviewed, verified, or rejected
7. check whether the record changes anything in Investor Shield

The answer should always be no for authority questions.

## Known Limitations

- Evidence Lite remains informational only
- no Evidence Lite record can satisfy Investor Shield by itself
- the panel is not a due-diligence engine
- the current workflow does not prove broad account administration or ownership
- the current workflow does not add delete semantics
- the workflow depends on the existing saved-deal and database backing already documented elsewhere

## Explicit Non-Implementation

This SOP does not:

- change runtime code
- change database data
- change routes
- change environment variables
- update README
- create a release tag
- begin Phase 5 work
- generate a PDF
- add AI, OCR, upload, scraping, automation, or CRM expansion

## Result

`PHASE 4H-3B EVIDENCE LITE WORKFLOW SOP COMPLETE — READY FOR PHASE 4H-3C INVESTOR SHIELD GOVERNANCE SOP`
