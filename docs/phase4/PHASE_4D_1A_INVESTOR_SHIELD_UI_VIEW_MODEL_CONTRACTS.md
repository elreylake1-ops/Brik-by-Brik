# Phase 4D-1A Investor Shield UI View Model Contracts

## Purpose
This phase defines display-only contracts for the future Investor Shield UI.

## Files Added / Changed
- `types/investor-shield-ui.ts`
- `__tests__/investor-shield-ui-contracts.test.ts`
- `docs/phase4/PHASE_4D_1A_INVESTOR_SHIELD_UI_VIEW_MODEL_CONTRACTS.md`

## Contract Summary
- `InvestorShieldUiViewModel` captures the future read-only display model.
- `InvestorShieldUiSummaryDisplay` carries the top-line summary state.
- `DeterministicGovernanceDisplay` keeps classification, governance, and capital protection visually dominant.
- `InvestorShieldGateDisplay` models each gate with status, evidence, waiver, and helper text.
- `AdvisorySignalDisplay` keeps advisory content separate from hard gates.
- `ProtectedMovementDisplay` records blocked movement and pipeline mutation prevention.
- `TaskRecommendationDisplay` models read-only task recommendations.
- `WaiverDisplay` keeps waiver state traceable and distinct from satisfied evidence.
- `ManualReviewDisplay` captures manual review without clearing a gate.
- `InvestorShieldUiMetadataDisplay` captures source and read-only metadata.

## Safety Rules Captured In Contracts
- advisory signals are explicitly advisory-only
- advisory signals cannot satisfy hard gates
- deterministic governance is marked dominant
- waiver is distinct from satisfied evidence
- manual review does not clear a gate
- protected blocked movement records `pipelineMutationPrevented`

## Explicit Non-Implementation
- no UI components
- no mapper
- no route changes
- no API changes
- no schema changes
- no production data changes
- no runtime behavior changes

## Recommended Next Step
Phase 4D-1B — Investor Shield UI Fixture Examples Only

## Result
CONTRACTS ONLY
