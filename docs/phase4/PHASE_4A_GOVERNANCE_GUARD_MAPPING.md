# Phase 4A Governance Guard Mapping

## Purpose
This document maps deterministic governance outcomes to allowed Phase 4A operator workflow behavior before implementation.

## Guard Mapping Rules
- deterministic governance remains dominant
- workflow state cannot override governance state
- offer state cannot override deterministic classification
- evidence notes cannot reduce deterministic risk
- command view must show governance before execution state
- unknown conflicts fail closed

## Pipeline States Covered
- UNDER_ANALYSIS
- READY_FOR_OFFER
- OFFER_SENT
- NEGOTIATING
- DUE_DILIGENCE
- FINANCE_REVIEW
- COMPLETED
- REJECTED
- ARCHIVED

## Governance Guard Matrix

### REJECT or FATAL
Allowed:
- UNDER_ANALYSIS
- REJECTED
- ARCHIVED

Blocked:
- READY_FOR_OFFER
- OFFER_SENT
- NEGOTIATING
- DUE_DILIGENCE

Required behavior:
- block unsafe progression
- record blocked pipeline event later
- create or require manual review/reject pathway later

### MANUAL_REVIEW_REQUIRED
Allowed:
- UNDER_ANALYSIS
- DUE_DILIGENCE only if manual review task exists
- FINANCE_REVIEW if finance risk is the blocker
- REJECTED
- ARCHIVED

Blocked:
- READY_FOR_OFFER unless review blockers are resolved later
- OFFER_SENT
- NEGOTIATING

Required behavior:
- allow saved deal
- require manual review task before progression
- command view must not show clean offer-ready state

### CONDITIONAL
Allowed:
- UNDER_ANALYSIS
- READY_FOR_OFFER only if blockers are explicitly tracked
- DUE_DILIGENCE
- FINANCE_REVIEW
- REJECTED
- ARCHIVED

Blocked:
- OFFER_SENT unless offer rationale exists later
- NEGOTIATING unless offer/counter context exists later

Required behavior:
- show blockers and evidence gaps
- require rationale before offer movement

### STRONG_OPPORTUNITY
Allowed:
- UNDER_ANALYSIS
- READY_FOR_OFFER
- OFFER_SENT if offer record exists later
- NEGOTIATING if response/counter notes exist later
- DUE_DILIGENCE
- FINANCE_REVIEW
- COMPLETED
- REJECTED
- ARCHIVED

Required behavior:
- still show governance first
- do not hide missing critical evidence
- do not bypass MAO discipline

### Unknown or Conflicting Governance State
Allowed:
- UNDER_ANALYSIS
- REJECTED
- ARCHIVED

Blocked:
- READY_FOR_OFFER
- OFFER_SENT
- NEGOTIATING
- COMPLETED

Required behavior:
- fail closed
- require manual review task later
- record block reason later

## Offer Guard Notes
- offer above MAO requires rationale later
- REJECT/FATAL blocks offer action
- manual review required allows draft only later, not clean offer-ready
- missing evidence should create evidence review task later
- offer history cannot rewrite deterministic engine snapshot

## Task Guard Notes
- manual review task required for unknown conflict
- due diligence task required for MANUAL_REVIEW_REQUIRED progression
- evidence task required for missing evidence
- blocker tasks must be visible in command view

## Command View Guard Notes
- governance and capital protection appear first
- execution state cannot appear more optimistic than governance state
- next best action must respect governance status
- risk flags and blockers must remain visible

## Explicit Non-Goals
- no implementation
- no TypeScript guard functions
- no schema or migration
- no API route
- no UI
- no persistence
- no tests unless required by AGENTS.md
- no AI/scraping/integrations
- no changes to deterministic engine

## Recommended Next Step
Phase 4A Step 3A - Operator Command Data Contracts.

Status note: Phase 4A Step 3A operator command data contracts created. No schema, migration, persistence, API, UI, or guard implementation added.

Status note: Phase 4A Step 3B operator command contract fixtures created. No schema, migration, persistence, API, UI, or guard implementation added.
