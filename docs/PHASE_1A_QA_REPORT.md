# Phase 1A QA Report

## Scope completed

Phase 1A Step 6 completed for MVP QA:
- Acceptance test coverage finalized (including mandatory sample pipeline and manual fallback path)
- QA report documented
- README finalized with explicit Phase 1A status and out-of-scope boundaries
- AGENTS.md updated to mark Step 6 complete and Phase 1A finalized for review

## Files changed across Phase 1A

Core engine and type files introduced/updated across Steps 1-6:
- `types/refurb.ts`
- `types/scope.ts`
- `lib/data/trade-rates.ts`
- `lib/data/material-baselines.ts`
- `lib/data/task-cost-library.ts`
- `lib/engine/scope-to-tasks.ts`
- `lib/engine/refurb-cost-engine.ts`
- `lib/engine/timeline-engine.ts`
- `lib/engine/analyze-deal-with-refurb.ts`
- `app/page.tsx`
- `components/CalculatorForm.tsx`
- `components/RefurbScopeForm.tsx`
- `components/RefurbBreakdownSummary.tsx`
- `README.md`
- `AGENTS.md`

Phase 1A test coverage files:
- `__tests__/scope-to-tasks.test.ts`
- `__tests__/refurb-cost-engine.test.ts`
- `__tests__/timeline-engine.test.ts`
- `__tests__/analyze-deal-with-refurb.test.ts`
- `__tests__/phase-1a-acceptance.test.ts`

## Acceptance criteria checklist

- AC1 bedroom x3 scaling: PASS
- AC2 bathroom x2 scaling: PASS
- AC3 flooring sqm path: PASS
- AC4 flooring fallback warning path: PASS
- AC5 kitchen size modifiers (small/medium/large): PASS
- AC6 rewire path: PASS
- AC7 boiler path: PASS
- AC8 roof placeholder warning path: PASS
- AC9 refurb cost fields (total/labour/material/room/trade/task/warnings): PASS
- AC10 timeline fields (phases, contingency, days, weeks, assumptions, warnings): PASS
- AC11 generated refurb cost used by orchestrator: PASS
- AC12 manual refurb fallback behavior: PASS
- AC13 manual calculator behavior intact: PASS
- AC14 no business logic in UI components: PASS (code review item, non-automated)

## Mandatory sample scope tested

Sample scope executed in acceptance tests:
- property profile: 3-bed terrace baseline scenario
- bedrooms: 3
- bathrooms: 1
- kitchen: `full_replace`, `medium`
- bathroom: `full_replace`
- bedroom: `cosmetic_refresh`
- flooring: whole property replacement
- floorAreaSqm: 80
- majorWorks: `rewire=true`, `boiler=false`, `roof=false`

## Sample output summary (actual generated values)

From current engine and passing acceptance assertions:
- task count: 20
- labour cost: 8815
- material cost: 9360
- total refurb cost: 18175
- kitchen full_replace medium total: 6100
- bathroom full_replace x1 total: 3075
- bedroom cosmetic_refresh x3 total: 1680
- flooring replacement (80 sqm): 1920
- rewire total: 5400

Timeline summary:
- phase 1 max labourer days: 2.5
- phase 2 max electrician days: 7.5
- phase 3 max decorator days: 4.5
- base total working days: 14.5
- contingency factor: 1.2
- adjusted days (ceil): 18
- estimated calendar weeks (5 working days/week): 4

## Tests run

Executed on May 5, 2026:
- `npm run test`
  - Result: PASS
  - Output: 5 test files passed, 58 tests passed

## Build result

Executed on May 5, 2026:
- `npm run build`
  - Result: PASS
  - Next.js production build completed successfully

## Known assumptions

- Flooring sqm path uses configured default rates in `scope-to-tasks.ts`:
  - material: 18 per sqm
  - labour: 0.5 carpenter-day per 40 sqm (0.0125 day/sqm)
- Flooring fallback (when `floorAreaSqm` missing) uses room-count estimate:
  - bedrooms + bathrooms + 2 additional rooms
- Timeline assumes:
  - sequential phase execution (1 -> 2 -> 3)
  - parallel trades inside each phase
  - phase duration = longest trade in phase
  - 20% contingency and 5 working days/week
- Rewire baseline assumes a 3-bed property template

## Known limitations

- Some scope options remain placeholder/unsupported in Phase 1A and are surfaced via warnings or zero-cost stubs
- Roof costs are placeholder estimates and require live quotes
- Data/rates are local config baselines, not live market feeds
- No persistence or historical audit trail for runs

## Not included in this phase

- PDF export
- Saved deals
- CRM
- AI features
- Live scraping
- Dashboard expansion
- Phase 2 features

## Ready for next phase / client review

Phase 1A is finalized for MVP QA and client review. Next implementation phase should only start after explicit client confirmation.
