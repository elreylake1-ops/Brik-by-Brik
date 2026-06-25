# Phase 4D-G Code Pack Batch 2 Evidence Lite Compatibility Audit

## Purpose
Audit James's Phase 4E Evidence Lite scaffold against the current repository contracts so the later implementation can be adapted safely without copying incompatible code directly into runtime paths.

## Phase 4E Files Reviewed
- `db/migrations/202606_phase4e_deal_evidence.sql`
- `src/lib/evidence/evidence.ts`
- `src/app/api/saved-deals/[dealId]/evidence/route.ts`
- `src/components/evidence/EvidenceLitePanel.tsx`

Supporting repo files reviewed:
- `lib/db/postgres.ts`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/operator-command/deal-offers-repository.ts`
- `lib/operator-command/deal-tasks-repository.ts`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `db/migrations/20260522_phase4a_saved_deals_table.sql`
- `db/migrations/20260522_phase4a_deal_offers_table.sql`
- `db/migrations/20260522_phase4a_deal_tasks_table.sql`
- `db/migrations/20260524_phase4b_investor_shield_tables.sql`
- `types/investor-shield.ts`
- `types/investor-shield-ui.ts`
- `docs/phase4/PHASE_4_COMPLETION_BLOCK_2A_EVIDENCE_LITE_SCHEMA_PERSISTENCE_PLAN.md`
- `docs/phase4/PHASE_4_COMPLETION_BLOCK_2A1_SOLICITOR_GATE_CONTRACT_RECONCILIATION.md`
- `docs/phase4/PHASE_4_COMPLETION_CODE_PACK_BATCH_1_INVENTORY_MAPPING.md`

## Existing Repository Conventions
- `saved_deals.id` is `TEXT PRIMARY KEY`.
- Child tables in Phase 4 use `deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE`.
- `deal_offers` and `deal_tasks` also use `deal_id`, not `saved_deal_id`.
- Timestamps use `created_at` and, when mutation tracking is needed, `updated_at`.
- `lib/db/postgres.ts` is the only allowed Postgres adapter and requires `DATABASE_URL`.
- Current API routes use `app/api/saved-deals/[id]/...`, not `src/app/...`.
- Existing route files commonly keep `GET` and `POST` in the same file for collection-style endpoints.
- Current solicitor contract is split across layers, with `SOLICITOR_REVIEW` as the human-facing key and `SOLICITOR_FEEDBACK` remaining a legacy compatibility alias in lower-level contracts.
- Evidence Lite must stay text/note-only, with no upload, OCR, AI, photo evidence, or PDF generation.

## Migration Findings

### Primary-Key Decision
- Use `TEXT PRIMARY KEY`.
- Do not use `uuid primary key default gen_random_uuid()` for Evidence Lite rows.
- If automatic ids are needed later, generate text ids in the application layer or use the repo's existing text-id conventions.

### Foreign-Key Column/Type Decision
- Use `deal_id TEXT NOT NULL REFERENCES brik_by_brik_engine.saved_deals(id) ON DELETE CASCADE`.
- Reject `saved_deal_id uuid` from the scaffold.

### Status Decision
- Allowed Evidence Lite statuses remain:
  - `MISSING`
  - `RECORDED`
  - `REVIEWED`
  - `VERIFIED`
  - `REJECTED`
- Reject scaffold statuses that mix evidence state with gate state:
  - `REQUESTED`
  - `RECEIVED`
  - `SATISFIED`
  - `WEAK`
  - `FAILED`
  - `WAIVED`
- `status` is evidence metadata, not an Investor Shield gate result.

### Linked-Gate Decision
- Canonical stored gate key: `SOLICITOR_REVIEW`.
- Legacy compatibility alias: `SOLICITOR_FEEDBACK`, normalized only at the input boundary.
- Reject `GENERAL` and arbitrary gate strings.

### Required / Nullable Decision
- Required: `title`, `note`, `evidence_type`, `linked_gate`, `status`, `reviewed`.
- `reviewed` should default to `false`.
- `reviewer_note` should not be introduced as a separate Phase 4 field; use the existing note field for review context if needed.

### Index and Constraint Decision
- Add an index on `deal_id`.
- Add an optional composite index on `deal_id, linked_gate` if query patterns need it.
- Do not add a uniqueness rule that would block multiple notes per gate unless a later product rule explicitly requires it.
- Keep constraints focused on accepted enums/normalized values and the foreign key cascade.

### Trigger and Rollback Concerns
- The scaffold's custom `set_updated_at` trigger/function is not a repo convention and should not be copied directly.
- If updated-at tracking is needed, keep it consistent with the repo's broader migration style or handle it in application code.
- Rollback should drop the Evidence Lite indexes first, then the table, and leave existing Investor Shield tables untouched.

## Evidence Repository Findings
- The scaffold helper creates its own `pg.Pool` instead of using `lib/db/postgres.ts`.
- It does not check whether the saved deal exists before creating evidence.
- It accepts raw gate/type/status strings without normalization.
- It defaults status to `RECEIVED`, which is not an allowed Phase 4 Evidence Lite status.
- It exposes `reviewerNote`, which is broader than the current Phase 4 note-only scope.
- It does not enforce the no-side-effects rule explicitly, so a future implementation must keep evidence persistence isolated from task creation, pipeline movement, and gate satisfaction.
- Recommended future repository path: `lib/evidence-lite/evidence-lite-repository.ts`.
- Future repository requirements:
  - reuse `lib/db/postgres.ts`
  - validate and normalize all inputs before SQL
  - verify deal existence before insert/update
  - map timestamps explicitly
  - return safe errors without hidden side effects
  - never auto-create tasks or move pipeline state

## API Route Findings
- The scaffold route path should be adapted from `src/app/api/saved-deals/[dealId]/evidence/route.ts` to `app/api/saved-deals/[id]/evidence/route.ts`.
- `GET` and `POST` in the same route match current project conventions for collection endpoints.
- The scaffold's `[dealId]` param does not match the repo's `[id]` convention.
- The future route should:
  - trim and validate the route param
  - return safe `400` for bad ids or invalid input
  - return safe `404` when the saved deal does not exist
  - return safe `500` on unexpected errors
  - normalize `SOLICITOR_FEEDBACK` to `SOLICITOR_REVIEW`
  - reject `GENERAL`, `RECEIVED`, and other invalid scaffold values
  - keep response shape consistent with the repo's `success`/`error` style
- The current scaffold is too loose for direct copy because it skips route diagnostics, deal existence checks, and validation depth.

## Evidence Lite UI Findings
- The scaffold panel should move from `src/components/evidence/EvidenceLitePanel.tsx` to `components/evidence-lite/EvidenceLitePanel.tsx`.
- The current UI is a useful concept but not ready for direct copy.
- Missing or weak points:
  - no explicit loading state
  - no explicit error state
  - minimal duplicate-submit protection
  - no refresh-after-save strategy beyond local append
  - no robust accessibility labeling for all controls
  - no clear normalization of invalid gate values
  - no clear separation between evidence recording and gate satisfaction
- The future UI must explicitly state:
  - recording evidence does not satisfy a gate
  - `RECORDED` is not `VERIFIED`
  - Investor Shield remains authoritative
- Remove upload/photo/AI/OCR implications from any future copy.
- Remove `GENERAL` and `RECEIVED` from the user-facing flow.

## Authoritative Contract Decision
The repo-approved Evidence Lite contract remains authoritative.

The code pack is scaffolding only.

Evidence status is not gate status.

No automatic gate satisfaction is allowed.

## Reviewer Note Decision
Use the existing `note` field for review context in Phase 4.

Defer a separate `reviewer_note` field to a later phase if it is still needed after the Phase 4 scope is complete.

## File-by-File Final Decision Matrix

| scaffold file | final decision | future repo path | required adaptation | implementation phase | production dependency |
|---|---|---|---|---|---|
| `db/migrations/202606_phase4e_deal_evidence.sql` | `REJECT — CONTRACT CONFLICT` | `db/migrations/20260622_phase4e_deal_evidence_table.sql` | Change PK/FK shape to repo conventions, remove gate-state statuses, remove `GENERAL`, remove `reviewer_note`, remove custom trigger, keep note-only scope | `4E-2` | Production connection required before any live execution or proof |
| `src/lib/evidence/evidence.ts` | `ADAPT — DO NOT COPY DIRECTLY` | `lib/evidence-lite/evidence-lite-repository.ts` | Reuse `lib/db/postgres.ts`, normalize inputs, validate deal existence, remove side effects, align ids/statuses/gates to repo contract | `4E-3` | Production connection required for live persistence proof only |
| `src/app/api/saved-deals/[dealId]/evidence/route.ts` | `ADAPT — DO NOT COPY DIRECTLY` | `app/api/saved-deals/[id]/evidence/route.ts` | Switch to `[id]`, add safe `400`/`404`, normalize solicitor alias, reject invalid scaffold values, preserve `GET` + `POST` route style | `4E-4` | Production connection required for live endpoint verification only |
| `src/components/evidence/EvidenceLitePanel.tsx` | `ADAPT — DO NOT COPY DIRECTLY` | `components/evidence-lite/EvidenceLitePanel.tsx` | Add loading/error states, accessibility, duplicate-submit protection, refresh after save, and explicit non-satisfaction copy | `4E-5` | Production connection required for browser proof only |

## Work Allowed Before Production Connection
- Finalize the Evidence Lite contract in pure types and validation.
- Draft the local-only migration shape for review.
- Build the repository layer with mocked tests only.
- Align the API route contract and test cases locally.
- Refine the UI copy and accessibility locally.
- Keep all work read-only with respect to production.

## Work Blocked Until Production Connection
- Any live production query or mutation.
- Migration execution.
- Runtime proof against the James-owned production deployment.
- Persistence proof using the production Supabase connection.
- Any follow-up that depends on a verified `DATABASE_URL`.

## Controlled Phase 4E Implementation Order
1. 4E-1 contracts and pure validation
2. 4E-2 migration file locally only
3. 4E-3 repository layer and mocked tests
4. 4E-4 API route and tests
5. 4E-5 minimal UI locally
6. production connection verification
7. full production runtime retest
8. reviewed migration execution
9. production persistence proof

## Deterministic Safety Confirmation
- True MAO unchanged.
- Finance calculations unchanged.
- Capital protection unchanged.
- Deal classification unchanged.
- Governance thresholds unchanged.
- Deterministic NO-GO unchanged.
- Investor Shield hard-gate dominance unchanged.

## Explicit Non-Implementation
- No scaffold copied into runtime code.
- No migration created or executed.
- No repository/API/UI implementation performed.
- No production access or mutation performed.
- No secrets exposed.
- `.gitignore` untouched.

## Result
`PHASE 4E CODE PACK AUDITED — CONTROLLED ADAPTATION REQUIRED`

## Recommended Next Step
`Phase 4E-1 Evidence Lite Contracts and Pure Validation Only`

Production execution remains blocked until:
- the exact Vercel key `DATABASE_URL` exists
- the new deployment is ready
- `/api/saved-deals` returns `200`
- missing routes return safe `404`
- no `500`
- no environment or authentication errors
