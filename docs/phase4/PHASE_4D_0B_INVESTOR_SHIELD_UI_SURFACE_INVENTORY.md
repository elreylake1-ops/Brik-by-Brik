# Phase 4D-0B Investor Shield UI Surface Inventory

## Purpose
This document identifies candidate UI surfaces for Investor Shield visibility, but adds no UI code.

## Candidate UI Surfaces
1. Saved Deal Detail / Saved Deal View
2. Operator Command summary area
3. Pipeline movement blocked/review message area
4. Deal Tasks / follow-up task list
5. Future Investor Summary / Evidence Pack area

## Surface 1: Saved Deal Detail
- likely purpose: become the main read surface for deal-specific Investor Shield status
- what it should eventually show at a high level: top-level gate status, required vs advisory visibility, missing evidence summary, review/block state, and task follow-up context
- why this is probably the primary Investor Shield surface: the existing saved-deal detail view already centralizes classification, governance state, capital protection state, pipeline state, financial snapshot, offers, and tasks without requiring new dashboard expansion

## Surface 2: Operator Command Summary
- likely purpose: surface Investor Shield status alongside governance and execution context for operator decisions
- how Investor Shield status can support operator decisions: provide due diligence visibility before progression without replacing the existing governance and capital-protection summary
- keep deterministic governance dominant

## Surface 3: Pipeline Movement Message
- likely purpose: explain why movement is blocked or needs review when a protected stage change is attempted
- shows why movement is blocked or needs review
- no response redesign planned yet

## Surface 4: Task List
- likely purpose: show Investor Shield-generated follow-up tasks if already persisted
- show Investor Shield-generated follow-up tasks if already persisted
- no new task creation from UI in this phase

## Surface 5: Future Investor Summary / Evidence Pack
- future-only surface
- not part of Phase 4D initial UI unless separately approved
- PDF/investor pack remains excluded for now

## Recommended Primary Surface
Saved Deal Detail / Saved Deal View

Reason:
It is the clearest place to show gate status without changing pipeline behavior or adding heavy dashboard expansion.

## Recommended Next Step
Phase 4D-0C — Gate Display Model Only.
