# Phase 5E-14C: QA Baseline and Append-Only Cleanup Repair

## 1. Repository and contaminated state

- Branch/HEAD: `feat/viewing-assessment-ui-polish` / `2b121796bb13e0e96d0fd11df8220fa2cbd27cfd`.
- Initial contaminated counts: `43 | 4 | 64 | 86 | 0 | 0`.
- Only `brik-viewing-qa-e2e-runtime` and its dedicated `brik-viewing-qa-e2e-data` volume were recreated. The stopped original QA container and the recovery rehearsal container were not touched.

## 2. Baseline recovery

The verified 127,565-byte backup had SHA-256 `27D1C306184BE583FBC62A35F903332D6E56AD8C9C092C96145A73141EF3BD25`.

The endpoint was recreated with its dedicated bridge network, loopback port `127.0.0.1:54339`, canonical role/database settings, and read-only backup mount. PostgreSQL readiness, loopback reachability, and canonical host authentication all passed twice before one restore using `--no-owner --no-privileges --exit-on-error`.

After restore, canonical host authentication reports `brik_viewing_qa_local | brik_qa | PostgreSQL 16.15`; Phase 2D remains absent. Restored counts were `42 | 3 | 63 | 81 | 0 | 0`.

## 3. Append-only failure and ownership

The former teardown directly deleted `viewing_proposals`. The migration deliberately rejects direct deletes; referential cascades only apply for permitted parent deletion paths. The upload test genuinely creates an unreviewed proposal when it attaches frame F00, and promotes that frame to reviewed evidence. Video job/frame foreign keys are `RESTRICT`, while retention and reviewed-evidence triggers prevent per-row deletion of that lineage.

The direct-delete cleanup was therefore incompatible with the production-safety contract, not a transient database failure.

## 4. Selected strategy and repair

Selected strategy: **D — recreate/reset the disposable endpoint-compatible QA database after the test**.

Changed files:

- `e2e/local-video-upload-acceptance.spec.ts`
- `__tests__/e2e-harness-isolation.test.ts`
- this evidence document

The local upload test no longer directly deletes `viewing_proposals`, video frames, video jobs, assessments, or its saved deal. It closes the app, pool, and simulated identity provider, removes only its random test-owned local media directory, and emits an explicit message that isolated QA baseline recovery is required. The test retains Phase 5E-14A runtime diagnostics.

The source-contract regression test now rejects direct `DELETE` statements against append-only proposal/video-frame tables and requires the explicit recovery contract. It also preserves the no-silent-cleanup-failure guard.

## 5. Validation

- Focused harness test: `npx vitest run __tests__/e2e-harness-isolation.test.ts` — 1 file, 3 tests passed, 1.23s.
- Targeted ESLint: zero errors; one pre-existing unused `isQaEnvironment` warning in the upload spec.
- One Chromium-only upload run was executed with fixture AI, live AI disabled, local storage, and the QA endpoint. Its outer command did not return before the 120-second host bound, but read-only database evidence showed the new job reached `ready_for_review`, had five frames, one reviewed frame, and associated proposal evidence. No upload 404 was reproduced and no append-only direct-delete error occurred.
- The approved post-test restore then returned the QA endpoint exactly to `42 | 3 | 63 | 81 | 0 | 0`.

## 6. Decision

The append-only invariant remains enforced; no trigger, schema, role, or production upload behavior changed. The original upload-route 404 is reclassified as **NO REPRODUCIBLE UPLOAD ROUTE DEFECT — PRIOR FAILURE WAS HARNESS/TEARDOWN RELATED**.

Task 11E remains `TEST EXPECTATION STALE` and untouched. Phase 5E-15 may address that expectation. Full Phase 5E-10 remains blocked until Task 11E is aligned and a clean-baseline acceptance retry is separately approved.
