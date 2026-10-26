# Phase 5E-14K: Validation Path Decision and Harness Freeze

## Decision

Freeze additional launcher lifecycle work. The remaining spawn/readiness/shutdown injection is experimental and disproportionate to the demonstrated issue: the external executor ends active Playwright work near 114–120 seconds.

## Verified evidence

Prior isolated runs reached upload intent/confirmation, `ready_for_review`, five frames, and reviewed-frame/proposal attachment; no reproducible `VIDEO_JOB_NOT_FOUND` remains. The append-only direct-delete teardown defect was removed, and disposable endpoint restoration returns the canonical baseline.

## Harness inventory

| Change | Classification |
|---|---|
| 14A upload diagnostics and bounded waits | KEEP — diagnostic only |
| 14C append-only recovery contract | KEEP — useful and verified |
| 14D lifecycle markers | KEEP — diagnostic only |
| 14F–14H external-server/identity work | UNFINISHED / DO NOT EXTEND |
| 14J-1B pure launcher contracts | KEEP — useful and verified |
| lifecycle/spawn/readiness/shutdown injection | FROZEN — candidate for later cleanup |

## Selected path

Use the existing self-managed harness in a local terminal or execution environment that permits natural completion beyond its 120-second external wrapper. Before running, require `42 | 3 | 63 | 81 | 0 | 0`, fixture AI, disabled live AI, and the canonical local QA database.

Run exactly:

```powershell
$env:VIEWING_QA_CONFIRM_ISOLATED='I_CONFIRM_THIS_IS_NOT_PRODUCTION'
$env:VIEWING_AI_PROVIDER='fixture'
$env:VIEWING_AI_ENABLED='false'
npx playwright test e2e/local-video-upload-acceptance.spec.ts --project=chromium --grep "Genuine Chrome video upload"
```

PASS requires Playwright's own terminal pass plus confirmation success, no `VIDEO_JOB_NOT_FOUND`, `ready_for_review`, five frames, reviewed/proposal attachment, no append-only delete error, and normal process return. Restore the disposable endpoint afterward—never manually delete immutable lineage—to exactly `42 | 3 | 63 | 81 | 0 | 0`.

## Treatment of exploratory work

14G/14H/14I remain `EXPERIMENTAL / INCOMPLETE — NOT REQUIRED FOR CURRENT VALIDATION PATH`; do not mark them passed merely because another path succeeds.

## Next step

GO for one longer-duration isolated validation. Task 11E and full Phase 5E-10 remain blocked until that terminal result and recovery are recorded.
