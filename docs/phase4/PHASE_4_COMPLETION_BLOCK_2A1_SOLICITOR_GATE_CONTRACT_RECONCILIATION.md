# Phase 4 Completion Block 2A1 Solicitor Gate Contract Reconciliation

## Purpose
Record the canonical solicitor/legal review gate name for Phase 4 Evidence Lite planning, reconcile the current repository's legacy naming, and define a safe compatibility strategy before any implementation begins.

## Accepted Business Contract
James and the sprint SOP use `SOLICITOR_REVIEW` as the intended business-facing solicitor/legal review gate key.

## Repository Findings
- Type contract:
  - `types/investor-shield-ui.ts` uses `SOLICITOR_REVIEW` in the UI gate list.
  - `types/investor-shield.ts` still uses `SOLICITOR_FEEDBACK` in the core Investor Shield gate-key contract.
  - `types/investor-shield-enforcement.ts` still uses `SOLICITOR_FEEDBACK` in enforcement contract definitions.
- Stored database value:
  - `lib/investor-shield/investor-shield-repository.ts` stores `gate_key` as plain text with no SQL enum or check constraint visible in the repository.
  - `db/migrations/20260524_phase4b_investor_shield_tables.sql` defines `gate_key TEXT NOT NULL` and `evidence_type TEXT NOT NULL`, so the repository does not enforce a fixed solicitor key at the database layer.
- Default gate definition:
  - `lib/investor-shield/default-gates.ts` uses `SOLICITOR_FEEDBACK` and builds the review task as solicitor feedback review.
- Mapper/UI value:
  - `lib/investor-shield/map-investor-shield-ui-view-model.ts` maps the UI task/action for `SOLICITOR_REVIEW`.
  - `types/investor-shield-ui.ts` displays `SOLICITOR_REVIEW`.
- Fixture/test value:
  - `__tests__/investor-shield-evaluator.test.ts` uses `SOLICITOR_FEEDBACK`.
  - `__tests__/investor-shield-repository.test.ts` uses `SOLICITOR_FEEDBACK`.
  - `__tests__/investor-shield-ui-adapter.test.ts` and other UI-facing tests use `SOLICITOR_REVIEW`.
  - `lib/investor-shield/evaluate-investor-shield.ts` still contains `SOLICITOR_FEEDBACK` for task recommendation logic.
- Documentation-only value:
  - The Evidence Lite plan doc currently notes the mismatch and treats `SOLICITOR_REVIEW` as the user-facing term.
  - Existing Phase 4 completion docs reference the same mismatch contextually.
- API input/output value:
  - The UI view model and read-only route surface are aligned to `SOLICITOR_REVIEW`.
  - Core enforcement/repository inputs still accept and emit `SOLICITOR_FEEDBACK` in the legacy path.

## Persistence Risk
Either value may already be stored conceptually because the repository uses free-text `TEXT` columns and does not show a DB enum or check constraint for solicitor gate names.

What still needs verification after production access is restored:
- whether any existing production rows use `SOLICITOR_FEEDBACK`
- whether any newly created rows from current runtime paths still emit `SOLICITOR_FEEDBACK`
- whether the Phase 4 data model needs a one-time normalization pass for legacy rows

The repository permits arbitrary text values for `gate_key`, so persistence risk is compatibility, not schema enforcement.

## Canonical Gate Decision
Canonical business/API/UI key: `SOLICITOR_REVIEW`

Canonical stored/runtime strategy:
- treat `SOLICITOR_REVIEW` as the canonical human-facing gate key
- keep `SOLICITOR_FEEDBACK` only as a legacy compatibility key at a narrow input boundary
- avoid introducing a second user-visible solicitor gate

## Legacy Compatibility Rule
- Accept `SOLICITOR_FEEDBACK` only at a single normalization boundary.
- Normalize it to `SOLICITOR_REVIEW` before Evidence Lite records are created or displayed.
- Do not display both values in UI or docs for the same active gate.
- Do not create separate task streams or evidence groups for the legacy alias.
- Do not silently reinterpret unrelated values.

## Evidence Lite Impact
- `linked_gate` should store the canonical value `SOLICITOR_REVIEW`.
- Legacy input `SOLICITOR_FEEDBACK` may be accepted only before persistence, then normalized to `SOLICITOR_REVIEW`.
- Validation should reject unknown gate names.
- Duplicate prevention should treat `SOLICITOR_REVIEW` and `SOLICITOR_FEEDBACK` as the same logical solicitor gate.
- Reporting/UI should render only `SOLICITOR_REVIEW`.

## Investor Shield Impact
- Default gate list should be aligned to `SOLICITOR_REVIEW` in future cleanup work.
- Enforcement logic should continue to behave deterministically and not weaken hard gates.
- Task keys should point to one solicitor review task only.
- UI mapping should present one solicitor review gate only.
- Fixtures/tests should eventually use the canonical key in business-facing cases, with legacy coverage only where compatibility is explicitly tested.
- Saved records may still need a compatibility read path if any legacy rows are discovered after production inspection.

## Migration Decision
DATA CHECK REQUIRED BEFORE MIGRATION DECISION

## Safety Rules
- No duplicate solicitor gates.
- No duplicate tasks.
- No duplicate evidence group.
- No weakening of hard-gate enforcement.
- No deterministic logic change.

## Explicit Non-Implementation
- No code changed.
- No schema changed.
- No migration created or run.
- No production query or mutation occurred.
- No runtime behavior changed.

## Result
SOLICITOR GATE CONTRACT DECISION READY

## Recommended Next Step
If the contract can be finalized without production inspection:
Block 2B1 — Evidence Lite Contracts and Validation Only

If a production data check is needed:
Perform it as part of Block 1B after the database connection is restored, before Evidence Lite contracts are implemented.
