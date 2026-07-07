# Phase 4G-R1-7A Controlled Migration and Live Vercel Proof Plan

## Purpose
This is the pre-execution plan for controlled migration, deployment, and live Vercel proof. It defines the exact runbook for the next execution phase without touching production.

## Current Status
- 4G-R1-0 through 4G-R1-6 are complete
- local validation is green
- the migration draft exists
- the migration has not been applied
- production has not been touched
- live Vercel proof is still pending
- the release tag remains blocked

## Baseline
- branch: `main`
- `HEAD` equals `origin/main`
- latest commit: `b7bfc4a14137ddb553b150ca098bcac0a7613b36`
- only `.gitignore` is dirty

## Migration Readiness
- migration filename: `db/migrations/20260706_phase4g_evidence_command_deal_evidence_extension.sql`
- table affected: `brik_by_brik_engine.deal_evidence`
- columns added:
  - `linked_investor_shield_gate`
  - `evidence_command_type`
  - `evidence_summary`
  - `evidence_status`
  - `evidence_strength`
  - `review_state`
  - `blocker_impact`
  - `linked_professional_gate`
  - `recommended_next_action`
  - `expiry_or_update_date`
  - `source`
  - `mobile_capture_note`
- non-destructive nature: additive `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` only
- existing records preserved: yes
- no drop, rename, or destructive rewrite: yes
- migration must be reviewed before execution: yes

## Required Pre-Migration Checks
- confirm the correct Supabase project
- confirm the database backup/restore path
- confirm restore authority
- confirm owner approval
- confirm the production URL
- confirm current `HEAD` / `origin/main`
- confirm build, lint, and test are green
- confirm `.gitignore` remains unstaged

## Controlled Execution Plan
Do not execute these steps in this phase.

1. final local validation
2. backup/export confirmation
3. apply migration
4. verify schema columns exist
5. deploy to Vercel
6. verify live URL loads
7. create live evidence record
8. refresh and prove persistence
9. link evidence to Investor Shield gate
10. verify status, strength, review state, and blocker impact
11. verify recommended next action
12. capture mobile screenshot
13. verify Investor Review shows structured evidence
14. prove hard gates are not auto-satisfied
15. prove blocked movement remains blocked
16. run post-deploy validation
17. prepare final R1 acceptance pack

## Live Proof Checklist
- live Vercel URL
- evidence record creation proof
- evidence persistence after refresh
- evidence linked to Investor Shield gate proof
- evidence status / strength / review-state proof
- blocker impact proof
- recommended next action proof
- mobile screenshot of evidence capture/display
- Investor Review page showing structured evidence
- proof Evidence Command does not automatically satisfy hard gates
- proof blocked movement remains blocked
- build/lint/test confirmation
- deterministic engine untouched confirmation

## Rollback / Safety Plan
- migration rollback must be approved before use
- no destructive rollback without written approval
- if migration fails, stop and report
- if deploy fails, stop and report
- if live proof fails, do not patch production ad hoc
- no release tag until James accepts R1

## Governance Boundary
This execution plan must not introduce:
- AI
- OCR
- uploads
- automatic image/video analysis
- PDF generation
- scraping
- automation
- CRM expansion
- formula changes
- classification changes
- True MAO changes
- capital-protection changes
- deterministic governance changes
- automatic hard-gate satisfaction
- automatic waiver
- automatic progression approval
- pipeline mutation

## Open Approval Required
Before executing 4G-R1-7B, Karlo/James must approve:
- production migration
- production deployment
- live proof fixture creation if needed
- screenshot/proof collection plan

## Explicit Non-Implementation
- no production access
- no migration execution
- no deployment
- no runtime change
- no release tag
- no PDF work
- no Phase 5 work

## Result
PHASE 4G-R1-7A CONTROLLED MIGRATION AND LIVE VERCEL PROOF PLAN COMPLETE — READY FOR APPROVAL BEFORE 4G-R1-7B PRODUCTION MIGRATION AND DEPLOYMENT
