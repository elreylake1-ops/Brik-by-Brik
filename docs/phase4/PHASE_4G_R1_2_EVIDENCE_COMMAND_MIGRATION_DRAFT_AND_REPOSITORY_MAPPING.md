# Phase 4G-R1-2 Evidence Command Migration Draft and Repository Mapping

## Purpose

Draft the local database shape needed for Evidence Command persistence and align the Evidence Lite repository with that shape without executing the migration or widening scope into routes, UI, or production rollout work.

## Files Changed

- `db/migrations/20260706_phase4g_evidence_command_deal_evidence_extension.sql`
- `lib/evidence-lite/evidence-lite-repository.ts`
- `__tests__/evidence-lite-repository.test.ts`
- `docs/phase4/PHASE_4G_R1_2_EVIDENCE_COMMAND_MIGRATION_DRAFT_AND_REPOSITORY_MAPPING.md`

## Migration Draft

The draft migration extends `brik_by_brik_engine.deal_evidence` with nullable text columns for the command model:

- `linked_investor_shield_gate`
- `evidence_command_type`
- `evidence_summary`
- `evidence_status`
- `evidence_strength`
- `review_state`
- `blocker_impact`
- `linked_professional_gate`
- `recommended_next_action`
- `expiry_or_update_date`
- `source`
- `mobile_capture_note`

The migration is file-only. It was not executed by the test suite.

## Repository Mapping

- Create and update paths now mirror legacy Evidence Lite fields and Evidence Command fields together.
- Read paths derive command fields from legacy rows when the new columns are null.
- `linkedInvestorShieldGate` round-trips through `linked_investor_shield_gate`, including the `SOLICITOR_FEEDBACK` to `SOLICITOR_REVIEW` legacy alias.
- `evidenceStatus` round-trips through `evidence_status`, with legacy status kept compatible for existing consumers.
- `evidenceSummary` mirrors the legacy note text when command summary data is absent.
- `evidenceStrength`, `reviewState`, `blockerImpact`, and `linkedProfessionalGate` default to safe command values when the stored row has no command data.

## Backward Compatibility

- Legacy rows still read successfully.
- Legacy create/update input still writes the legacy columns and now mirrors the command columns.
- Photo and video command evidence types persist as structured command types while keeping the legacy evidence type fallback compatible.
- No runtime code outside the Evidence Lite repository mapping was intentionally changed in this step.

## Mocked Test Coverage

- Shared Postgres adapter usage, without a second pool.
- Legacy read mapping with derived command defaults.
- Safe defaults when command columns are null.
- Structured video evidence read mapping.
- Legacy create mapping with mirrored command columns.
- Photo evidence create mapping with mirrored legacy fallback.
- Legacy update mapping with mirrored command columns.
- Command update mapping with mirrored legacy values.
- Invalid stored legacy and command values fail loudly.
- Repository SQL stays away from tasks, offers, Investor Shield mutation tables, and pool wiring.
- Migration draft presence is validated as a file read only.

## Boundary

- Do not treat this as Evidence Command feature completion.
- Do not execute the migration in tests.
- Do not modify API routes, UI, `.gitignore`, or production assets in this step.
- Do not deploy or create a release tag.

## Result

PHASE 4G-R1-2 EVIDENCE COMMAND MIGRATION DRAFT AND REPOSITORY MAPPING COMPLETE — READY FOR 4G-R1-3 API ROUTE SUPPORT AND MOCKED TESTS
