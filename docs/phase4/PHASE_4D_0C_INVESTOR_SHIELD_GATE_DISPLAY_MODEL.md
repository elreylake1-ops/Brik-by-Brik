# Phase 4D-0C Investor Shield Gate Display Model

## Purpose
This document defines the future display model for Investor Shield gates, but adds no UI code.

## Gate Display Fields
Each gate should eventually show:
- gate label
- gate key
- required/advisory label
- status
- severity
- confidence
- evidence count
- missing evidence summary
- last updated if available
- short explanation
- recommended next action if available

## Required vs Advisory Label Rules
- all top-level Investor Shield gates are currently required
- `AI_VISUAL_REVIEW_ADVISORY` is advisory-only
- advisory evidence may support review but cannot satisfy hard evidence alone
- required gates must visibly show whether evidence is missing, weak, satisfied, failed, or waived

## Status Display Model
- `NOT_STARTED` — gate exists but work has not begun
- `REQUIRED` — gate is active and evidence or review is still required
- `IN_PROGRESS` — gate review has started but is not yet complete
- `SATISFIED` — required evidence and review are currently sufficient
- `WEAK` — evidence exists but is not strong enough for confidence
- `FAILED` — gate has an identified failure or blocking issue
- `WAIVED` — gate has been manually waived and should remain visibly traceable

## Severity Display Model
- `INFO` — informational only, low operational concern
- `CAUTION` — cautionary concern that may require review
- `BLOCKER` — progression blocker unless cleared or formally waived
- `FATAL` — critical risk state that should display as strongest severity

## Confidence Display Model
- `HIGH` — evidence is strong and confidence is high
- `MEDIUM` — evidence is present with moderate confidence
- `LOW` — evidence is weak, incomplete, or uncertain
- `UNKNOWN` — confidence is not established yet

## REFURB_CERTAINTY Display Model
Sub-gates:
- `MEDIA_EVIDENCE_PACK`
- `ROOM_MEASUREMENT_SCHEDULE`
- `AI_VISUAL_REVIEW_ADVISORY`
- `BUILDER_QUOTE_EVIDENCE`
- `SPECIALIST_SURVEY_EVIDENCE`

Rules:
- AI visual review must display as advisory/supporting only
- builder/professional/document/measurement evidence remains required for hard confidence

## Recommended Next Step
Phase 4D-0D — Warning and Blocked Movement Copy Only.
