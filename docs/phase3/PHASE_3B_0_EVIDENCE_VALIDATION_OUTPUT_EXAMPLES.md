# Phase 3B-0 Evidence Validation Output Examples

## Purpose

This document locks representative evidence-bundle validation outputs for contract stability.

It is reference material for tests and contract behavior only.

## Evidence Fixtures

Source evidence fixtures under `__tests__/fixtures/phase3-evidence/`:

- `weak-comparable-evidence.json`
- `conflicting-legal-evidence.json`
- `accepted-operator-note.json`
- `missing-lender-evidence.json`

## Validation Output Fixtures

Expected validation outputs under `__tests__/fixtures/phase3-evidence-validation/`:

- `weak-comparable-evidence-validation.json`
- `conflicting-legal-evidence-validation.json`
- `accepted-operator-note-validation.json`
- `missing-lender-evidence-validation.json`

## Validation Behavior Summary

`validatePhase3EvidenceBundle()` returns only:

- `valid`
- `errors`
- `warnings`
- `requiresReview`

Contract behavior captured by the locked fixtures and exact tests:

- weak, conflicting, and missing evidence remain review-oriented
- accepted evidence remains advisory and non-decisioning
- reserved source labels (`future_ai_extracted`, `future_integration`) are warning-only
- deterministic output shape and warning text remain stable

## Scope Confirmation

- validation is advisory and contract-level only
- validation does not perform governance decisioning
- no runtime calculator or review-route wiring exists in this step
