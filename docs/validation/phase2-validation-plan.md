# Phase 2 Validation Plan

Phase 2A is only the validation harness for Brik Engine. This step adds fixture structure, scenario coverage, and tests so expected outputs are defined before any governance engine changes are implemented.

The actual governance and control-layer engines still come next. This includes review gating, evidence checks, structural-risk blocking, and later override behavior that can supersede numeric scoring.

Expected outputs are being locked now to prevent scoring drift while Phase 2 evolves. The current stress suite uses the existing numeric due-diligence engine only where it already supports deterministic checks such as classification, strategy recommendation, and current risk-flag thresholds.

Governance must override scoring in later Phase 2C. That means a numerically strong deal may still move to `MANUAL_REVIEW` or `BLOCK` once evidence quality, structural issues, or control failures are evaluated.

## Phase 2B

Phase 2A created the scenario fixtures and stress-test harness.

Phase 2B locks the structured output contracts for deal heat, risk radar, strategy match, governance, investor summary, decision gates, evidence status, data confidence, next actions, assumptions, overrides, metadata, and known limitations.

Phase 2C will implement governance execution using these contracts.

Governance must override scoring. A high score must still be able to end as `NO_DEAL` or `REVIEW_REQUIRED` when the control layer requires it.

No AI, scraping, UI, or Phase 3 work has been added in Phase 2B.

## Phase 2C

Governance execution layer is now implemented.

Governance runs above scoring. Fatal risks and hard gates can override raw `HOT` or `WARM` classifications and force `NO_DEAL` or `REVIEW_REQUIRED`.

Phase 2D will later implement full intelligence and scoring modules.

No AI, scraping, UI, or Phase 3 work has been added in Phase 2C.

## Phase 2D

Deterministic intelligence engines are now added for raw deal heat scoring, risk radar, strategy match, investor summary, next actions, negotiation position, and time risk.

Raw scoring is explainable and non-final. Governance remains final authority and can still override raw `HOT`, `WARM`, or `MARGINAL` outputs.

No AI, scraping, UI, or Phase 3 work has been added in Phase 2D.

Phase 2E will calibrate all 15 fixtures and produce the final pass/fail matrix.

## Phase 2E

Full stress-suite calibration is now added.

All 15 Phase 2 fixtures run through `buildPhase2Analysis()`, and expected-versus-actual comparison output is generated as a report package.

Consistency testing now re-runs identical fixture inputs to prove deterministic stability.

Governance override proof is now included so raw attractive scores can still end as `REVIEW_REQUIRED` or `NO_DEAL`.

Known limitations are documented explicitly.

Phase 3 remains blocked until the client reviews and accepts this validation package.
