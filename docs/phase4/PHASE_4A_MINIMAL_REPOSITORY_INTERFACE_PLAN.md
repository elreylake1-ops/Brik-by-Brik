# Phase 4A Minimal Repository Interface Plan

## Purpose
This document defines the minimal repository/helper surface needed before saved-deal behavior is implemented.

## Repository Design Rules
- small helper surface only
- saved deals first
- no broad ORM abstraction
- no generic CRM repository
- no API routes yet
- no UI wiring yet
- no command view yet
- no automation
- preserve deterministic snapshot immutability
- pipeline/offer changes must not rewrite snapshots
- guard logic remains pure and separate

## First Repository Surface
- createOperatorDeal
- getOperatorDealById
- updateOperatorDealMetadata
- archiveOperatorDeal
- createDealSnapshot
- getLatestDealSnapshot
- recordPipelineEvent

## Later Repository Surface
- createOfferRecord
- updateOfferRecord
- createOperatorTask
- updateOperatorTask
- createEvidenceItem
- createAuditEvent

## Helper Boundaries
- helpers should use existing project data-access conventions if any
- helpers should not call UI modules
- helpers should not call AI/scraping/integrations
- helpers should not recalculate deterministic engine outputs
- helpers should store snapshots exactly as provided
- helpers should not mutate saved snapshots during pipeline/offer updates

## Migration Tooling Note
- migration file exists at `db/migrations/20260521_phase4a_minimal_schema.sql`
- migration execution workflow/tooling still needs confirmation before repository helpers rely on tables

## Explicit Non-Goals
- no repository implementation in this step
- no API route
- no UI
- no saved deal behavior
- no broad persistence abstraction
- no offer/task/evidence implementation
- no AI/scraping/integrations
- no deterministic engine changes

## Recommended Next Step
Phase 4A Step 4E - Minimal Repository Helpers for Saved Deals Only.

Status note: Phase 4A Step 4E repository adapter boundary check created. No repository implementation, DB calls, API, UI, or saved-deal behavior added.
