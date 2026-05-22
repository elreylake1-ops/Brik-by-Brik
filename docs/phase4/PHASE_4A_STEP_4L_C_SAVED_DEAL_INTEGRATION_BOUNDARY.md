# Phase 4A Step 4L-C Saved Deal Integration Boundary

## Purpose
This document identifies the safest next wiring path from saved_deals repository helpers into saved-deal runtime behavior.

## Current App Surface Findings
- main calculator entry point: `app/page.tsx` (`Home`)
- current form/result component surface: `CalculatorForm`, `ResultsDisplay`, `RefurbScopeForm`, `RefurbBreakdownSummary`, `EngineAnalysisPanel`
- current API/server action status: no `app/api` routes found and no saved-deal server action found
- deterministic engine result is produced by `analyzeDealWithRefurb` in `lib/engine/analyze-deal-with-refurb.ts`, called in `app/page.tsx`
- future saved-deal attachment point: after `result` is produced in `app/page.tsx`, via a server-only boundary

## Repository Readiness
- saved deal repository exists: `lib/operator-command/saved-deals-repository.ts`
- DB adapter exists: `lib/db/postgres.ts`
- saved_deals migration exists: `db/migrations/20260522_phase4a_saved_deals_table.sql`
- live DB execution requires `DATABASE_URL` and applied migration(s)
- tests currently mock DB behavior rather than requiring live Supabase credentials

## Recommended Wiring Path
1. Add a server-only save action or API route.
2. Accept current analysed deal output as input.
3. Call `createSavedDeal` only.
4. Do not add reopen UI yet.
5. Add a minimal save button only after server action/API passes tests.
6. Reopen/list view comes after save works.

## Boundaries
- no command view yet
- no pipeline movement yet
- no offers/tasks/notes yet
- no evidence/audit helpers yet
- no recalculation of deterministic result
- saved `engine_result_json` must be passed through exactly as provided

## Recommended Next Step
Phase 4A Step 4L-D - Saved Deal Server Action/API Boundary.

Status note: Phase 4A Step 4L-D saved-deal server boundary created. No API route, server action, UI, command view, pipeline, offers, tasks, or notes behavior added.
