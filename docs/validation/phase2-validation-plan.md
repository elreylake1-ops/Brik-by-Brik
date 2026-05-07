# Phase 2 Validation Plan

Phase 2A is only the validation harness for Brik Engine. This step adds fixture structure, scenario coverage, and tests so expected outputs are defined before any governance engine changes are implemented.

The actual governance and control-layer engines still come next. This includes review gating, evidence checks, structural-risk blocking, and later override behavior that can supersede numeric scoring.

Expected outputs are being locked now to prevent scoring drift while Phase 2 evolves. The current stress suite uses the existing numeric due-diligence engine only where it already supports deterministic checks such as classification, strategy recommendation, and current risk-flag thresholds.

Governance must override scoring in later Phase 2C. That means a numerically strong deal may still move to `MANUAL_REVIEW` or `BLOCK` once evidence quality, structural issues, or control failures are evaluated.
