# Phase 4B-0 Investor Shield SOP Scope Lock

## Purpose
This document locks the implementation scope for Investor Shield™ / Due Diligence Lock™ before coding begins.

It defines the safe Phase 4B delivery boundary from the controlling SOP so implementation can proceed in small, auditable steps without altering existing runtime behavior prematurely.

## Source SOP
The controlling SOP for this work is `Brik_by_Brik_Investor_Shield_Evidence_Gates_SOP_Karlo_v1_1.docx`.

SOP v1.1 supersedes v1.0 for Phase 4B planning because it adds:
- refurbishment media evidence protocol
- `REFURB_CERTAINTY` sub-gates
- builder proposal/contract gate
- advisory-only AI/image/video handling

## Non-Negotiable Rule
Investor Shield can increase caution, downgrade confidence, create tasks, or block progression.

It must never soften deterministic capital-protection rules.

## Current Phase 4A Baseline
Current implemented Phase 4A surface:
- saved deals
- reopen/view saved deals
- guarded pipeline movement
- offers/counter-offers
- tasks/blockers
- Operator Command summary
- `brik_by_brik_engine` schema
- `saved_deals`, `deal_offers`, `deal_tasks` tables

Baseline safety context:
- `saved_deals.id` is currently `TEXT`
- `deal_offers.deal_id` already references `saved_deals(id)` as `TEXT`
- `deal_tasks.deal_id` already references `saved_deals(id)` as `TEXT`
- deterministic engine logic remains separate from Phase 4A persistence

## Phase 4B Scope
Phase 4B is limited to:
- database schema
- TypeScript contracts/enums
- default gate definitions
- repository helpers
- saved-deal default gate creation

Phase 4B explicitly excludes:
- runtime enforcement
- UI panels
- PDF/investor pack
- evidence upload
- AI/image/video review
- scraping
- CRM expansion beyond existing task model
- automation
- dashboards
- multi-user roles

## Phase 4B Substeps
### 4B-1 Type contracts only
Goal:
- define TypeScript contracts and enum surfaces for Investor Shield entities and gate states without altering runtime wiring

Files likely touched:
- `types/`
- `lib/` contract files if the existing structure requires colocated types
- `docs/phase4/` if type decisions need a companion boundary note

Explicit exclusions:
- no migration SQL
- no repository writes
- no API routes
- no UI usage
- no evaluator/runtime enforcement

Acceptance criteria:
- all Investor Shield entities needed for Phase 4B are represented as stable TypeScript contracts
- gate names and states are encoded consistently
- no runtime behavior changes are introduced

### 4B-2 Migration draft only
Goal:
- draft the raw SQL migration package for future Investor Shield tables without applying any migration

Files likely touched:
- `db/migrations/`
- `docs/phase4/` if migration assumptions or warnings need to be recorded

Explicit exclusions:
- no migration execution
- no seed data
- no runtime integration
- no table use from application code

Acceptance criteria:
- migration draft covers all required Phase 4B tables
- all `deal_id` foreign key types align with the real `saved_deals.id` type
- migration remains unapplied and documentation records that status

### 4B-3 Migration consistency tests only
Goal:
- add tests that verify schema names, table names, and foreign-key type alignment for the drafted migration files

Files likely touched:
- `__tests__/`
- `tests/`

Explicit exclusions:
- no runtime evaluator logic
- no repository behavior change
- no database execution
- no UI

Acceptance criteria:
- tests assert `brik_by_brik_engine` namespace usage
- tests assert all new `deal_id` foreign keys follow the real `saved_deals.id` type
- tests pass locally or any blocker is documented clearly

### 4B-4 Default gate definitions only
Goal:
- define the default Investor Shield gate set and sub-gate constants from SOP v1.1

Files likely touched:
- `lib/`
- `types/`
- `docs/phase4/` if gate mapping needs a companion note

Explicit exclusions:
- no runtime scoring or enforcement
- no task generation logic
- no UI rendering
- no AI/media processing

Acceptance criteria:
- every required default gate is represented
- `REFURB_CERTAINTY` sub-gates are represented
- definitions are reusable by later repository and runtime phases

### 4B-5 Repository helpers only
Goal:
- add repository helpers for Investor Shield records using the Phase 4B schema surface only

Files likely touched:
- `lib/operator-command/`
- `lib/` repository helpers
- repository tests if already patterned for adjacent modules

Explicit exclusions:
- no route handlers
- no UI
- no evaluator/runtime enforcement
- no automatic task generation

Acceptance criteria:
- repository helpers cover create/read/update operations required for Phase 4B storage preparation
- helpers remain schema-qualified to `brik_by_brik_engine`
- no existing Phase 4A repository behavior regresses

### 4B-6 Saved deal default gate creation only
Goal:
- create default Investor Shield gate records when a saved deal is created, without introducing runtime enforcement

Files likely touched:
- `lib/operator-command/saved-deals-repository.ts`
- adjacent repository helpers
- tests covering saved-deal persistence side effects

Explicit exclusions:
- no gate evaluation logic
- no pipeline blocking logic
- no UI panels
- no PDF/investor summary generation

Acceptance criteria:
- saving a new deal creates the default gate set deterministically
- the default gate set matches SOP v1.1 gate definitions
- existing saved-deal creation remains stable apart from the intended default gate persistence

### 4B-7 Staging DB migration and proof only
Goal:
- apply the drafted Investor Shield migration to staging only and capture proof that the schema matches expectations

Files likely touched:
- `docs/phase4/`
- optional SQL verification notes or proof artifacts

Explicit exclusions:
- no production rollout
- no runtime enforcement
- no UI expansion
- no Phase 4C/4D/4E/5 work

Acceptance criteria:
- staging-only migration execution is documented
- proof confirms expected tables, foreign keys, and namespace placement
- production remains untouched until separately approved

## Required Tables From SOP v1.1
Future Phase 4B tables:
- `investor_shield_checks`
- `evidence_items`
- `risk_flags`
- `manual_overrides`
- `builder_proposals`
- `builder_contract_checks`

Warning:
- existing `saved_deals.id` type must be inspected before writing migration SQL
- current Phase 4A baseline shows `saved_deals.id` is `TEXT`
- all new `deal_id` foreign keys must therefore be `TEXT`, even if an SOP sample uses `UUID`

## Required Default Gates
Required default gates:
- `SOLD_COMPS`
- `TITLE`
- `LEASEHOLD`
- `PLANNING_BUILDING_CONTROL`
- `REFURB_CERTAINTY`
- `BUILDER_PROPOSAL_CONTRACT`
- `DAMP_STRUCTURAL`
- `LENDER_CRITERIA`
- `RENTAL_DEMAND`
- `SOLICITOR_FEEDBACK`

Required `REFURB_CERTAINTY` sub-gates:
- `MEDIA_EVIDENCE_PACK`
- `ROOM_MEASUREMENT_SCHEDULE`
- `AI_VISUAL_REVIEW_ADVISORY`
- `BUILDER_QUOTE_EVIDENCE`
- `SPECIALIST_SURVEY_EVIDENCE`

## Future Phase Boundaries
Later phases are defined as:
- Phase 4C = runtime enforcement/evaluator/task generation from weak gates
- Phase 4D = Investor Shield UI panels
- Phase 4E = investor summary/PDF evidence section
- Phase 5 = evidence upload + AI advisory review

## Safety Confirmations
Phase 4B-0 confirms:
- no code added
- no migration added
- no DB changes applied
- no UI change
- no runtime behavior change
- deterministic engine untouched
