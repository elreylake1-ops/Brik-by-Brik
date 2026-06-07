# Phase 4D-3A Gate Detail Rows / Missing Evidence Display Plan

## Purpose
This document plans read-only gate detail row improvements and missing evidence display, but makes no code or runtime changes.

## Current Panel Baseline
- The panel renders in Saved Deal Detail.
- The panel is read-only.
- The model loads through the read-only API and fetch helper.
- Gate rows already show summary-level fields.
- No upload, edit, task, or pipeline controls exist.

## Proposed Gate Detail Row Enhancements
Plan only:
- clearer gate label
- required/advisory label
- status
- severity
- confidence
- evidence count
- missing evidence summary
- short explanation
- recommended next action

## Missing Evidence Display Rules
Plan:
- show a compact missing evidence summary per gate
- avoid scare-copy unless severity is `BLOCKER` or `FATAL`
- advisory evidence must not appear as hard proof
- `REFURB_CERTAINTY` must clearly distinguish advisory AI review from builder/professional/document/measurement evidence

## Read-Only Boundaries
Future implementation must not add:
- upload controls
- edit controls
- waiver controls
- task creation controls
- pipeline actions
- AI/image/video review
- PDF pack actions

## UI Placement
- Keep enhancements inside the existing Investor Shield panel.
- Do not move the panel location.
- Do not redesign Saved Deal Detail.
- Do not expand dashboard or global layout.

## Future Test Expectations
Future implementation should test:
- gate rows render missing evidence text
- advisory-only evidence remains labeled advisory
- `REFURB_CERTAINTY` sub-gate messaging is clear
- no upload, edit, or task controls render
- existing panel loading, error, and empty behavior remains intact

## Recommended Next Step
Phase 4D-3B — Gate Detail Row Display Only.

This should modify only the isolated panel component if possible, not `app/page.tsx`.
