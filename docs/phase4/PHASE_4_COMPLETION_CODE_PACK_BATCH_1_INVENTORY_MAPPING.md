# Phase 4D-G Code Pack Batch 1 Inventory and Mapping

## Purpose
Inventory James's Phase 4D-G code pack and map each supplied file to the closest existing repository equivalent before any detailed compatibility audit.

This is a mapping-only pass. It does not copy code-pack files into the repo, does not change runtime behavior, and does not decide reuse or rejection yet.

## Code Pack Inventory

| supplied file | purpose | existing equivalent | initial classification | detailed-audit batch |
|---|---|---|---|---|
| `README.md` | Pack overview, scope, assumptions, and hard rules for Phase 4D through 4G | `docs/phase4/PHASE_4_COMPLETION_BLOCK_2A_EVIDENCE_LITE_SCHEMA_PERSISTENCE_PLAN.md` and `docs/phase4/PHASE_4_COMPLETION_BLOCK_2A2_INVESTOR_SUMMARY_DATA_CONTRACT_AUDIT.md` as the closest planning-doc cluster | `DOCUMENTATION/CHECKLIST ONLY` | Batch 4 |
| `db/migrations/202606_phase4e_deal_evidence.sql` | Add Evidence Lite persistence schema | `db/migrations/20260524_phase4b_investor_shield_tables.sql` | `LIKELY CONTRACT CONFLICT` | Batch 2 |
| `docs/qa/phase4g_acceptance_checklist.md` | Final acceptance checklist for Phase 4G | `docs/phase4/PHASE_4D_4B_MANUAL_BROWSER_QA.md` and `docs/phase4/PHASE_4D_FINAL_READ_ONLY_INVESTOR_SHIELD_UI_CLOSEOUT.md` | `DOCUMENTATION/CHECKLIST ONLY` | Batch 4 |
| `src/app/api/saved-deals/[dealId]/evidence/route.ts` | Evidence Lite API route for saved-deal evidence | No exact route exists; closest is `app/api/saved-deals/[id]/route.ts` plus the existing Investor Shield route at `app/api/saved-deals/[id]/investor-shield-ui/route.ts` | `NEW SCAFFOLD - REQUIRES DETAILED AUDIT` | Batch 2 |
| `src/app/api/saved-deals/[dealId]/summary/route.ts` | Investor Summary API route for saved-deal summary | No exact route exists; closest is `app/api/saved-deals/[id]/route.ts` and the current summary composition in `lib/engine/intelligence/investor-summary-engine.ts` | `NEW SCAFFOLD - REQUIRES DETAILED AUDIT` | Batch 3 |
| `src/components/evidence/EvidenceLitePanel.tsx` | Evidence Lite UI panel | No exact component exists; closest planning and adjacent UI are `components/InvestorShieldPanel.tsx` and the Evidence Lite planning doc | `NEW SCAFFOLD - REQUIRES DETAILED AUDIT` | Batch 2 |
| `src/components/investor-shield/InvestorShieldPanel.tsx` | Investor Shield visible UI panel | `components/InvestorShieldPanel.tsx` | `EXISTING IMPLEMENTATION ALREADY PRESENT` | Batch 1 only |
| `src/components/investor-summary/InvestorSummaryView.tsx` | Read-only Investor Summary view | No exact component exists; closest summary logic is `lib/engine/intelligence/investor-summary-engine.ts` | `NEW SCAFFOLD - REQUIRES DETAILED AUDIT` | Batch 3 |
| `src/lib/evidence/evidence.ts` | Evidence Lite helper layer | Closest evidence-related repo code is `lib/engine/phase3-evidence-contract.ts`, `lib/engine/phase3-evidence-orchestration-adapter.ts`, and `types/phase3-evidence.ts` | `NEW SCAFFOLD - REQUIRES DETAILED AUDIT` | Batch 2 |
| `src/lib/investor-shield/types.ts` | Investor Shield type definitions | `types/investor-shield.ts` and `types/investor-shield-ui.ts` | `PATH/STRUCTURE MISMATCH` | Batch 1 only |
| `src/lib/investor-summary/summary.ts` | Investor Summary composition helper | `lib/engine/intelligence/investor-summary-engine.ts` | `PATH/STRUCTURE MISMATCH` | Batch 3 |

## Existing Phase 4D Work
The existing Investor Shield implementation is already present in the repo and must not be replaced during this audit.

Current Phase 4D baseline includes:
- `components/InvestorShieldPanel.tsx`
- `components/SavedDealInvestorShieldPanel.tsx`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `lib/investor-shield/load-investor-shield-ui-model.ts`
- `lib/investor-shield/map-investor-shield-ui-view-model.ts`
- `lib/investor-shield/investor-shield-ui-adapter.ts`
- `lib/investor-shield/investor-shield-read-model.ts`
- `lib/investor-shield/evaluate-investor-shield.ts`
- `lib/investor-shield/default-gates.ts`
- `lib/investor-shield/default-checks.ts`
- `lib/investor-shield/guard-investor-shield-pipeline-movement.ts`
- `types/investor-shield.ts`
- `types/investor-shield-ui.ts`

## Path and Structure Findings
- The code pack is organized under `src/`, but the repo uses `app/`, `components/`, `lib/`, and `types/` at the repository root.
- The saved-deal API paths in the pack use `[dealId]`, while the repo uses `[id]`.
- The pack introduces new Evidence Lite and Investor Summary files that do not currently exist at matching paths.
- The pack's database migration name suggests a new Phase 4E table, but the repo already has Phase 4A/4B migrations and a different evidence-related baseline.
- The pack README confirms the pack expects import adaptation to existing structure rather than a literal path copy.
- No generated or cache directories are part of the supplied pack inventory.

## Items Requiring Phase 4E Audit
- `db/migrations/202606_phase4e_deal_evidence.sql`
- `src/app/api/saved-deals/[dealId]/evidence/route.ts`
- `src/components/evidence/EvidenceLitePanel.tsx`
- `src/lib/evidence/evidence.ts`

## Items Requiring Phase 4F Audit
- `src/app/api/saved-deals/[dealId]/summary/route.ts`
- `src/components/investor-summary/InvestorSummaryView.tsx`
- `src/lib/investor-summary/summary.ts`

## Phase 4G Checklist Items
- `README.md`
- `docs/qa/phase4g_acceptance_checklist.md`

## Explicit Non-Implementation
- No scaffold was copied into runtime code.
- No code, schema, API, or UI changes were made.
- No production access was used.
- No deterministic engine behavior was changed.
- No formulas, True MAO logic, finance logic, classifications, capital protection, governance thresholds, deterministic NO-GO, or Investor Shield enforcement were changed.
- `.gitignore` was not touched.

## Result
`CODE PACK INVENTORY COMPLETE - DETAILED AUDIT REQUIRED`

## Recommended Next Step
`Batch 2 - Phase 4E Evidence Lite Compatibility Audit`
