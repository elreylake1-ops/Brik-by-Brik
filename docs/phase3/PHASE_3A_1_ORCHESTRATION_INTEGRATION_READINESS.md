# Phase 3A-1 Orchestration Integration Readiness

## Purpose

This document is an audit-only readiness step.

It prepares a safe integration path between deterministic Phase 2 outputs and Phase 3A-0 orchestration contracts without changing runtime behavior.

Primary audit question:

Can current Phase 2 deterministic output be safely converted into `Phase3DeterministicSnapshot` for later `buildPhase3Orchestration()` usage?

## Current Source Outputs

Current deterministic Phase 2 outputs come from:

- `buildPhase2Analysis(input)` in `lib/engine/intelligence/build-phase2-analysis.ts`, returning `Phase2AnalysisOutput`
- `runPhase2Validation(fixtures)` in `lib/validation/run-phase2-validation.ts`, where each scenario includes:
- `actualOutput` (`Phase2AnalysisOutput`) for live runtime route usage
- `actual` summary fields for reporting and display

Current route usage:

- `/phase-2-live-review` executes `runPhase2Validation()` live and has access to full `actualOutput`
- `/phase-2-review` reads saved `docs/validation/phase2-stress-test-results.json` summary output (no full `actualOutput` payload)
- `/` main calculator uses `analyzeDealWithRefurb()` and is not currently wired to Phase 2 intelligence output contracts

## Required Snapshot Mapping

Target snapshot contract: `Phase3DeterministicSnapshot` in `types/phase3-orchestration.ts`.

| Phase 2 field/source | Phase3DeterministicSnapshot field | Mapping status | Notes / risks |
| --- | --- | --- | --- |
| `output.governance.state` | `governanceState` | direct | Enum names already align: `PASS`, `REVIEW_REQUIRED`, `BLOCKED`. |
| `output.governance.finalClassification` | `finalClassification` | direct | Enum names already align: `HOT`, `WARM`, `MARGINAL`, `NO_DEAL`, `REVIEW_REQUIRED`. |
| `output.governance.fatalRisk` | `fatalRisk` | direct | No transform needed. |
| `output.governance.reviewRequired` | `reviewRequired` | direct | No transform needed. |
| `output.evidenceStatus.missingCriticalEvidence` | `missingCriticalEvidence` | direct | Already `string[]` and deterministic. |
| `output.governance.blockedBy` | `blockedBy` | direct | Already `string[]`; supports capital-protection routing checks. |
| `output.riskRadar.riskFlags` (`RiskFlagOutput[]`) | `riskFlags` (`string[]`) | derived | Needs deterministic flattening strategy (`code`, `label`, or combined). Current Phase 3 routing uses keyword checks on strings; brittle if label wording drifts. |
| `output.limitations` (`KnownLimitationOutput[]`) | `acceptedLimitations` (`Phase3AcceptedLimitation[]`) | missing | Codes in `Phase2AnalysisOutput.limitations` (`PHASE2D_*`) do not match Phase 3 accepted-limitation union; requires normalization table from accepted operational limitations, not blind mapping. |
| `output.strategyMatch.recommendedStrategy` | not needed yet | not needed yet | Useful for future advisory tasks but not required for current Phase 3 snapshot contract. |
| `output.investorSummary.*` | not needed yet | not needed yet | Useful for future composer modules; outside Phase 3A-1 integration boundary. |

## Integration Risks

- risk flag flattening mismatch:
- Phase 2 uses structured risk flags (`code`, `label`, `severity`, `source`)
- Phase 3 snapshot currently expects `string[]`, which may lose signal clarity and create keyword-fragile routing
- accepted limitations mismatch:
- Phase 2 `limitations` output uses engine limitation codes (`PHASE2D_*`)
- Phase 3 accepted limitation union expects operational limitation codes (manual comparables, no automated sold-price validation, etc.)
- saved-report payload gap:
- `/phase-2-review` JSON uses summary fields only and does not provide full fields required for snapshot mapping
- wording drift risk:
- classification/governance internal enums are aligned, but client-facing summary strings are not suitable as integration source of truth
- text-first risk routing:
- if `riskFlags` is flattened to labels only, routing can drift with copy updates

## Recommended Adapter Boundary

Recommended future boundary:

- `mapPhase2OutputToPhase3Snapshot(output: Phase2AnalysisOutput): Phase3DeterministicSnapshot`

Adapter requirements:

- pure function
- deterministic behavior only
- no side effects
- no runtime external calls
- strict enum-preserving mapping for governance and final classification
- explicit deterministic transform for risk flags (prefer stable code-first mapping)
- dedicated tests for direct, derived, and fallback mapping behavior

Recommended input source priority for adapter usage:

1. `Phase2AnalysisOutput` from live engine execution
2. not `/phase-2-review` summary JSON

## What Not To Do Yet

- no UI wiring yet
- no Phase 3 output rendering in calculator
- no AI integration
- no new evidence model
- no persistence expansion
- no external integrations or scraping
- no classification or governance logic changes

## Recommended Next Step

Recommended smallest next implementation step:

**Phase 3A-1 Step 2 - create a pure adapter for Phase 2 output to `Phase3DeterministicSnapshot`**.

This should proceed only with deterministic field mapping and tests, and still without runtime wiring to `app/page.tsx` or Phase 3 UI exposure.

## Step 2 - Pure Adapter Implemented

Adapter path:

- `lib/engine/phase3-adapter.ts`
- export: `mapPhase2OutputToPhase3Snapshot(output: Phase2AnalysisOutput): Phase3DeterministicSnapshot`

Summary:

- direct mapping is implemented for governance state, final classification, fatal risk, reviewRequired, missingCriticalEvidence, and blockedBy
- risk flags are flattened deterministically in stable order using a code-first rule (fallback to label only when code is absent)
- accepted limitations are not inferred from Phase 2 `limitations` output because no safe exact code mapping exists in current contracts
- no UI wiring or runtime route integration has been added in this step

## Step 3 - Adapter Fixture Locking

Phase 3A-1 Step 3 adds locked adapter output fixtures and exact comparison tests.

Summary:

- representative adapter snapshot fixtures are added under `__tests__/fixtures/phase3-adapter/`
- exact JSON comparison tests are added to protect adapter output contract stability
- bridge stability is protected for no-deal, review-required evidence-gap, clean proceed, and missing-optionals cases
- no UI/runtime wiring is added in this step
