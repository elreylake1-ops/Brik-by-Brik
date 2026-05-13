# Phase 3A-0 Orchestration Output Examples

## Purpose

This document locks representative Phase 3A-0 orchestration output examples as contract references.

These examples are used to detect accidental contract drift during later Phase 3 module work.

## Locked Fixture Scenarios

- `intake-missing-deterministic.json`
- `no-deal-capital-protection.json`
- `review-required-evidence-gap.json`
- `valuation-review-gap.json`
- `accepted-limitations-awareness.json`

Fixture location:

- `__tests__/fixtures/phase3-orchestration/`

## Contract Reference Scope

These examples are internal contract references only.

They are not client-facing product outputs and are not a substitute for deterministic governance outputs.

Only fields currently produced by `buildPhase3Orchestration()` are included.

## Boundary Confirmation

The locked examples include no AI fields, no scraping fields, no persistence fields, and no CRM fields.

The deterministic core remains the source of truth for MAO, finance calculations, governance state, and final deal classification.
