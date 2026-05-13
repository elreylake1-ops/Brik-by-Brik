# Phase 3A-1 Adapter Output Examples

## Purpose

This document locks representative output examples for the Phase 2 -> Phase 3 snapshot adapter.

These fixtures protect the adapter bridge contract from accidental drift as future Phase 3 modules are added.

## Fixture List

Fixture path:

- `__tests__/fixtures/phase3-adapter/`

Locked scenarios:

- `phase2-no-deal-snapshot.json`
- `phase2-review-required-evidence-gap-snapshot.json`
- `phase2-clean-proceed-snapshot.json`
- `phase2-missing-optionals-snapshot.json`

## Adapter Input/Output Boundary

Input:

- full `Phase2AnalysisOutput` object (not saved summary JSON)

Output:

- `Phase3DeterministicSnapshot` only:
- `governanceState`
- `finalClassification`
- `fatalRisk`
- `reviewRequired`
- `missingCriticalEvidence`
- `blockedBy`
- `riskFlags`

No orchestration output fields are included in adapter fixtures.

## Mapping Summary

- governance and classification map directly from `output.governance`
- fatal/review flags map directly from `output.governance`
- evidence gaps map from `output.evidenceStatus.missingCriticalEvidence`
- blocked reasons map from `output.governance.blockedBy`

## Accepted Limitations Handling

Adapter output does not include accepted limitations.

No limitation codes are inferred or invented from Phase 2 `limitations` output because no safe exact code mapping exists in the current contracts.

## Risk Flag Flattening Rule

Risk flags are flattened deterministically from `output.riskRadar.riskFlags` in stable order:

- prefer `code` when present
- fallback to `label` when `code` is missing or empty
- do not create new risk meanings

## Runtime Wiring Status

No runtime UI or app wiring exists for this adapter step:

- not wired to `app/page.tsx`
- not wired to `/phase-2-review`
- not wired to `/phase-2-live-review`

## Deterministic Source-of-Truth Confirmation

The deterministic engine remains the source of truth for calculations, governance outcomes, and final deal classification.

The adapter is a pure conversion layer only.
