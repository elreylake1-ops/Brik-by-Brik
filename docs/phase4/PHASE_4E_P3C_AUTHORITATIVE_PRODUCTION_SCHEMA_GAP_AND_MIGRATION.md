# Phase 4E-P3C Authoritative Production Schema Gap and Migration

## Purpose

Record the reviewed production schema repair, the live read-route recovery, and the confirmed no-initialization decision for the controlled production deal.

## Authorization Record

Explicit authoritative production schema migration authorization: APPROVED

Approved migration files:

- `db/migrations/20260524_phase4b_investor_shield_tables.sql`
- `db/migrations/20260622_phase4e_deal_evidence_table.sql`

Approved production target:

- Supabase project: `jagjbwxodnbgbhhojuzo`
- Vercel domain: `https://brik-by-brik-engine-chi.vercel.app`
- Database: `postgres`

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `3e956925163d89bc270bc75a7cd8ab3ce75d2c23` |
| `origin/main` | `3e956925163d89bc270bc75a7cd8ab3ce75d2c23` |
| Latest commit | `docs: reconcile production database target` |
| Dirty state before this document | only the pre-existing unstaged `.gitignore` modification |

## Authoritative Production Target

| Item | Value |
| --- | --- |
| Vercel domain | `https://brik-by-brik-engine-chi.vercel.app` |
| Supabase project | `jagjbwxodnbgbhhojuzo` |
| Database | `postgres` |

## Pre-Migration Route Failure Baseline

Before the reviewed schema repair was applied, the live read routes were failing with the missing-schema error class.

Observed baseline:

- Investor Shield: `500 / 42P01`
- Investor Summary: `500 / 42P01`
- Evidence Lite: `500 / 42P01`

The failure class was the missing production schema surface required by the read-only routes.

## Pre-Migration Production Object Inventory

Before the repair, production contained only:

- `saved_deals`
- `deal_tasks`
- `deal_offers`

The missing dependent schema objects were the gap that prevented the live read routes from completing.

## Saved-Deal Identity Compatibility

Confirmed compatibility facts:

- `saved_deals.id` is `text`
- all dependent foreign keys use compatible `text` references
- the controlled saved-deal row remained the canonical production deal id

Controlled production deal:

- Deal ID: `4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863`
- Address: `QA Controlled Production Verification Deal - Keep For Live Evidence Lite`
- Classification: `CONDITIONAL`
- Governance state: `MANUAL_REVIEW_REQUIRED`
- Capital-protection state: `PROTECTED`
- Pipeline state: `UNDER_ANALYSIS`

## Applied Migration Files

The reviewed additive migrations were applied successfully:

- `db/migrations/20260524_phase4b_investor_shield_tables.sql`
- `db/migrations/20260622_phase4e_deal_evidence_table.sql`

## Migration Execution Result

The production schema was restored successfully.

Result:

- required tables now exist
- no conflicting schema was encountered
- no second saved deal was created
- no Evidence Lite record was created
- the controlled deal row remained unchanged

## Tables Created

The repair added the missing tables required by the live application path:

- `investor_shield_checks`
- `evidence_items`
- `risk_flags`
- `manual_overrides`
- `builder_proposals`
- `builder_contract_checks`
- `deal_evidence`

Confirmed total post-repair table surface includes the existing saved-deal, task, offer, and the newly restored dependent tables.

## Constraint and Index Verification

Verified:

- primary keys exist
- foreign keys target `brik_by_brik_engine.saved_deals(id)`
- `ON DELETE CASCADE` is present where required
- reviewed check constraints are present
- reviewed indexes are present
- all newly created tables were initially empty

## Controlled Deal Protection

The controlled saved-deal row and its count remained unchanged throughout the repair.

Confirmed:

- saved-deal row count remained `1`
- controlled deal fields were unchanged
- pipeline state remained `UNDER_ANALYSIS`
- classification remained `CONDITIONAL`
- governance remained `MANUAL_REVIEW_REQUIRED`
- capital protection remained `PROTECTED`

## Post-Migration Route Recovery

All required live GET routes now return `200`:

| Route | Result |
| --- | --- |
| `GET /api/saved-deals` | `200` |
| `GET /api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863` | `200` |
| `GET /api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/investor-shield-ui` | `200` |
| `GET /api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/investor-summary` | `200` |
| `GET /api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/tasks` | `200` |
| `GET /api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/offers` | `200` |
| `GET /api/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/evidence` | `200` |

Observed live counts:

- tasks: `0`
- offers: `0`
- Evidence Lite records: `0`
- no `42P01`
- no `28P01`
- no unexpected `500`

## Investor Shield Empty-State Behavior

The controlled deal has zero persisted Shield-check rows, yet the canonical live read model still returns the complete 10-gate default state.

Confirmed behavior:

- `investor_shield_checks`: `0`
- gate count: `10`
- all gate summaries are `NOT_STARTED`
- all gate evidence counts are `0`
- all gate timestamps are `null`
- progression remains `BLOCKED`
- no initialization or backfill is required
- no gate is accidentally satisfied
- no tasks, offers, waivers, or pipeline movement occur

This is the correct empty/default contract for the existing deal.

## Evidence Lite Empty-State Confirmation

Evidence Lite now responds safely in the empty state:

- GET returns `200`
- record count is `0`

## Before/After No-Side-Effect Matrix

| Surface | Before | After | Changed |
| --- | --- | --- | --- |
| Saved-deal count | `1` | `1` | No |
| Controlled deal fields | stable QA fixture | stable QA fixture | No |
| Pipeline | `UNDER_ANALYSIS` | `UNDER_ANALYSIS` | No |
| Classification | `CONDITIONAL` | `CONDITIONAL` | No |
| Governance | `MANUAL_REVIEW_REQUIRED` | `MANUAL_REVIEW_REQUIRED` | No |
| Capital protection | `PROTECTED` | `PROTECTED` | No |
| Tasks | `0` | `0` | No |
| Offers | `0` | `0` | No |
| Evidence Lite rows | `0` | `0` | No |
| Persisted Shield rows | `0` | `0` | No |
| Waiver/override rows | `0` | `0` | No |

## Rollback Decision

Not required

## Explicit Non-Implementation

Confirmed no:

- Evidence Lite write
- second saved deal
- saved-deal update
- manual Shield-state mutation
- task/offer/waiver/pipeline mutation
- environment change
- redeployment
- UI activation
- browser review page
- PDF generation
- AI/OCR/upload/scraping
- formula/classification change

## Result

`PHASE 4E-P3C PRODUCTION SCHEMA RESTORED — LIVE READ ROUTES VERIFIED`

## Recommended Next Step

`Close the Phase 4E-P3B production test-deal baseline, then execute Phase 4E-P3 controlled Evidence Lite persistence proof.`
