# Phase 4A Operator Command Scope Lock

## Purpose
Phase 4A begins the transition from governed analysis into a usable single-operator acquisition command MVP.

## Phase 4A Objective
Create a practical operator command system for live deal tracking, offer management, task/blocker execution, and command visibility while preserving deterministic governance.

## Allowed Scope
- basic saved deals
- simple pipeline states
- offer history and counter-offers
- task and blocker tracking
- investor/operator command view
- light evidence placeholders
- minimal audit logging
- basic export/summary output if already trivial later

## Explicitly Not Allowed
- AI decisioning or AI summaries
- scraping or live market integrations
- complex CRM
- multi-user permissions or teams
- public SaaS workflows
- advanced automation
- heavy UI expansion
- changes to True MAO, finance logic, thresholds, classifications, or capital protection

## Governance Hierarchy Preservation
Deterministic governance > capital protection > deal classification > workflow state > advisory/evidence layer > UI presentation

- workflow state cannot override governance state
- offer state cannot override deterministic classification
- evidence notes cannot reduce deterministic risk
- command view must show governance before execution state

## Single-User Constraint
- James/operator first
- no multi-user roles
- no team permissions
- no public SaaS patterns

## Build Boundary
Phase 4A should be built in small implementation steps:
1. Minimal data model plan
2. Saved deals persistence
3. Pipeline state guards
4. Offer tracking
5. Tasks/blockers
6. Light evidence placeholders
7. Operator command view
8. Live deal testing and closure

## Acceptance Boundary
- saved deal can be created and reopened
- deterministic engine snapshot is preserved
- pipeline state can change only when governance permits
- REJECT/FATAL cannot move to offer-ready states
- offer amount/rationale/response can be tracked
- tasks can be created and completed
- command view shows governance, offer, task, risk, and next action
- no prohibited systems added
- deterministic logic unchanged

## Recommended Next Step
Phase 4A Step 2 - Minimal Data Model Plan.

Status note: Phase 4A Step 2A minimal data model boundary created. No schema, persistence, API, or UI added.
