# Phase 4H-0 - Final Handover Scope Lock and Evidence Inventory

## Purpose

This document locks the handover scope before the detailed Phase 4 handover documentation is written. It inventories the existing evidence, identifies what still needs to be documented, and keeps the later handover work sequenced into controlled subphases.

## James's Requested Deliverables

- architecture diagram
- database schema documentation
- environment-variable inventory without secrets
- Vercel and database deployment/recovery instructions
- README and operational setup
- ownership and access confirmation
- Investor Review SOP
- Evidence Lite SOP
- Investor Shield SOP
- admin/operator procedures
- limitations and technical debt
- future recommendations
- release freeze and rollback plan

## Controlled Subphases

- `4H-1` - Architecture and database documentation
- `4H-2` - Environment, deployment, recovery, and ownership documentation
- `4H-3` - Operational workflows and SOPs
- `4H-4` - README and handover index
- `4H-5` - Final validation and handover submission
- `4H-6` - Release tag and freeze after James's formal approval

## Evidence Inventory

| Deliverable | Existing Source | New Documentation Needed | Unverified Items |
|---|---|---|---|
| Architecture diagram | `app/page.tsx`, `components/investor-review/InvestorReviewDocument.tsx`, `components/evidence-lite/EvidenceLitePanel.tsx`, `app/api/saved-deals/[id]/investor-shield-ui/route.ts`, `lib/investor-review/load-investor-review-page-model.ts` | Yes, a concise handover diagram and data-flow summary | None for the current read-only browser review surface; later handover text still needs to explain the full structure clearly |
| Database schema documentation | `db/migrations/20260521_phase4a_minimal_schema.sql`, `db/migrations/20260522_phase4a_saved_deals_table.sql`, `db/migrations/20260522_phase4a_deal_tasks_table.sql`, `db/migrations/20260522_phase4a_deal_offers_table.sql`, `db/migrations/20260524_phase4b_investor_shield_tables.sql`, `db/migrations/20260622_phase4e_deal_evidence_table.sql` | Yes, schema summary and migration index | Exact production schema drift beyond committed migrations is not re-audited in this task |
| Environment-variable inventory without secrets | `lib/db/postgres.ts`, `docs/phase4/PHASE_4E_P0_PRODUCTION_ENVIRONMENT_AND_DEPLOYMENT_VERIFICATION.md`, `docs/phase4/PHASE_4A_R9_SUPABASE_ENV_COMPLETENESS_RESOLUTION.md` | Yes, a no-secrets env inventory and runtime requirement list | Full current production env state must be stated carefully; do not expose values |
| Vercel and database deployment/recovery instructions | `docs/phase4/PHASE_4E_P0_PRODUCTION_ENVIRONMENT_AND_DEPLOYMENT_VERIFICATION.md`, `docs/phase4/PHASE_4E_P1A_PRODUCTION_BACKUP_AND_RECOVERY_READINESS_VERIFICATION.md`, `docs/phase4/PHASE_4E_P4A_PRODUCTION_EVIDENCE_LITE_UI_ACTIVATION_AND_BROWSER_PROOF.md` | Yes, deployment and recovery runbook | Recovery capability, ownership, and current operator permissions remain only partially verified in repository evidence |
| README and operational setup | `README.md`, `AGENTS.md` | Yes, concise handover setup guidance | README must not be changed in 4H-0 |
| Ownership and access confirmation | `docs/phase4/PHASE_4E_P0_PRODUCTION_ENVIRONMENT_AND_DEPLOYMENT_VERIFICATION.md`, `docs/phase4/PHASE_4E_P1A_PRODUCTION_BACKUP_AND_RECOVERY_READINESS_VERIFICATION.md`, `docs/phase4/PHASE_4F_R3_CONTROLLED_PRODUCTION_BROWSER_PROOF.md`, `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md` | Yes, ownership and access summary | No new proof of permission breadth, recovery authority, or operator role assignment is created here |
| Investor Review SOP | `app/saved-deals/[id]/review/page.tsx`, `lib/investor-review/load-investor-review-page-model.ts`, `components/investor-review/InvestorReviewDocument.tsx`, `docs/phase4/PHASE_4F_R3_CONTROLLED_PRODUCTION_BROWSER_PROOF.md` | Yes, a concise operator SOP | No runtime behavior changes are made |
| Evidence Lite SOP | `components/evidence-lite/EvidenceLitePanel.tsx`, `app/api/saved-deals/[id]/evidence/route.ts`, `docs/phase4/PHASE_4E_P4A_PRODUCTION_EVIDENCE_LITE_UI_ACTIVATION_AND_BROWSER_PROOF.md`, `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md` | Yes, a read-only SOP | The pack should preserve that Evidence Lite remains informational only |
| Investor Shield SOP | `app/api/saved-deals/[id]/investor-shield-ui/route.ts`, `lib/investor-shield/load-investor-shield-ui-model.ts`, `docs/phase4/PHASE_4F_R3_CONTROLLED_PRODUCTION_BROWSER_PROOF.md`, `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md` | Yes, a read-only Shield SOP | Separate existing-deal / missing-Shield-record 404 behavior is not currently proven and must be described honestly |
| Admin/operator procedures | `lib/operator-command/saved-deals-repository.ts`, `app/api/saved-deals/[id]/pipeline/route.ts`, `app/api/saved-deals/[id]/tasks/route.ts`, `app/api/saved-deals/[id]/offers/route.ts` | Yes, operational procedure notes | Mutation boundaries should be documented as read-only for handover scope unless later approved otherwise |
| Limitations and technical debt | `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md`, `docs/phase4/PHASE_4F_R3_CONTROLLED_PRODUCTION_BROWSER_PROOF.md`, `docs/phase4/PHASE_4E_P1A_PRODUCTION_BACKUP_AND_RECOVERY_READINESS_VERIFICATION.md` | Yes, a limitations register | Ownership/access, recovery, and some route-derived evidence remain partial or test-based |
| Future recommendations | Existing phase 4 documents and acceptance packs | Yes, a short recommendation section | Recommendations must not imply unproven production capability |
| Release freeze and rollback plan | `docs/phase4/PHASE_4E_P1A_PRODUCTION_BACKUP_AND_RECOVERY_READINESS_VERIFICATION.md`, `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md` | Yes, a freeze/rollback summary | Release tagging and freeze are not authorized in 4H-0 |

## Current Architecture

The current handover scope is centered on the read-only browser review surface and its supporting data flow:

- the saved-deal review page is server-rendered
- Investor Review data is assembled from saved-deal data, canonical investor-summary data, canonical Shield data, and Evidence Lite data
- Evidence Lite is informational only
- Investor Shield remains the authoritative gate display
- the workflow is read-only for the production review and evidence surfaces in this phase

Existing evidence source points:

- `docs/phase4/PHASE_4F_R3_CONTROLLED_PRODUCTION_BROWSER_PROOF.md`
- `docs/phase4/PHASE_4G_FINAL_PHASE_4_ACCEPTANCE_PACK.md`
- `docs/phase4/PHASE_4F_BROWSER_RENDERED_INVESTOR_SUMMARY_AND_EVIDENCE_PACK_REVIEW_SURFACE_PLAN.md`

## Database, Environment, and Deployment Evidence

The repository already contains documentation for:

- migration files under `db/migrations/`
- production environment checks and env-variable presence
- Vercel deployment identity and production alias verification
- backup and recovery readiness review

The later handover docs should reuse those sources rather than restating them from memory.

## Ownership and Access Evidence

Repository evidence confirms production verification and controlled read-only access paths, but it does not fully establish any broader ownership or recovery authority beyond the documented inspections.

Keep this distinction explicit in the later handover:

- verified: controlled production read paths and safe browser review proof
- unverified: broad operator permissions, restore authority, and any undocumented access assumptions

## Strict Boundaries

- no runtime code changes
- no database changes
- no production access
- no secret values
- no README changes
- no release tag
- no Phase 5 work
- no PDF generation
- no AI, OCR, uploads, scraping, automation, or CRM expansion

## Result

`PHASE 4H-0 HANDOVER SCOPE LOCKED - READY FOR PHASE 4H-1 ARCHITECTURE AND DATABASE DOCUMENTATION`