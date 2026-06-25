# Phase 4 Completion Legacy Branding Guard Timeout Repair

## Purpose
Repair the legacy branding guard so it completes reliably in the full `npm test` suite without weakening the scan or changing product/runtime behavior.

## Root Cause
The branding guard was already scanning efficiently, but it depended on Vitest's default per-test timeout while doing a full-repository content pass in the shared test worker. Under full-suite load, that budget was too tight for reliable completion.

The guard also carried a broad phase-4 path-fragment exclusion that was wider than necessary for the intended coverage model. This was narrowed to explicit intentional-artifact files so active docs and source remain scanned.

## Changes Applied
- Added `.vercel` to the excluded generated directories.
- Removed the broad `docs/phase4` and `docs/client-return` path-fragment exclusion.
- Replaced broad docs exclusion with explicit file exclusions for the intentional legacy-branding audit and verification artifacts.
- Preserved the repository-wide scan of active source, docs, migrations, tests, fixtures, and configuration.
- Added a small helper to make forbidden-brand detection explicit in unit assertions.
- Added focused assertions that:
  - canonical `Brik by Brik Engine` branding is allowed
  - a forbidden active legacy variant is still detected
  - active source and docs remain in scan coverage
- Increased only the full-scan test's timeout to 15 seconds, with the scan still completing far below that budget.

## Guard Coverage Preserved
The guard still scans active repository content, including:
- `app`
- `components`
- `lib`
- `types`
- `docs`
- `db/migrations`
- tests and fixtures
- configuration and package metadata

The guard still rejects the superseded site identity strings and matching legacy deployment domain.

## Exclusions
Generated or irrelevant directories excluded from the scan:
- `.git` - repository metadata, not product content
- `node_modules` - dependency tree, not source content
- `.next` - generated Next.js build output
- `.vercel` - local Vercel metadata/cache, not product content
- `coverage` - generated test output
- `dist` - build output
- `build` - build output
- `.turbo` - generated task cache
- `.cache` - generated cache data

Explicit intentional-artifact file exclusions:
- `db/audits/phase4_legacy_branding_audit.sql` - constructed audit SQL contains the old branding terms by design
- `db/audits/phase4_legacy_branding_cleanup_PROPOSED.sql` - proposed cleanup SQL intentionally references the old branding terms
- `docs/phase4/PHASE_4_COMPLETION_REPOSITORY_BRANDING_CLEANUP.md` - historical cleanup note with intentional legacy references
- `docs/phase4/PHASE_4_COMPLETION_JAMES_PRODUCTION_CONNECTION_REVERIFICATION.md` - production verification note with intentional legacy references
- `docs/phase4/PHASE_4_COMPLETION_NEW_JAMES_VERCEL_PROJECT_VERIFICATION.md` - production target note with intentional superseded-target references
- `__tests__/legacy-branding-guard.test.ts` - the guard test must not self-report on its own source
- `__tests__/phase4a-migration-consistency.test.ts` - existing intentional test fixture exclusion

## Safety Confirmation
- The guard was not weakened.
- Active source and docs remain scanned.
- No production work was performed.
- No runtime behavior changed.
- Deterministic engine behavior was untouched.
- `.gitignore` was untouched.

## Validation Result
- Focused test: passed
- `npm run build`: passed
- `npm run lint`: passed
- `npm test`: passed, `87` test files and `854` tests

## Result
LEGACY BRANDING GUARD FULL-SUITE TIMEOUT FIXED
