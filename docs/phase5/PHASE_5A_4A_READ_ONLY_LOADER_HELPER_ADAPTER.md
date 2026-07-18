# Phase 5A-4A - Read-Only Loader Helper / Adapter

## Purpose

This is Phase 5A-4A only.

This PR adds a read-only loader/helper adapter that accepts already-loaded Evidence Command / `deal_evidence`-shaped records and maps those records into the accepted Phase 5A-3 Professional Evidence Gateway read-model.

Full Phase 5A-4 integration is not being claimed.

This PR does not yet attach the Professional Evidence Gateway view model to an existing server-side saved-deal loader, and it does not yet show visible proof on a deal page.

Phase 5A-4B must be separately scoped and approved before connecting this helper to an agreed server-side loading path or visible proof route.

## James Approval Boundary

James approved this as a controlled Phase 5A-4A helper/adapter on a feature branch / PR first.

Approved Phase 5A-4A scope:

- Add a read-only loader/helper adapter for the accepted Phase 5A-3 Professional Evidence Gateway read-model.
- Accept already-loaded Evidence Command / `deal_evidence`-shaped evidence as the source surface.
- Map those records into Professional Evidence Gateway evidence inputs.
- Add focused tests proving read-only and non-authoritative behavior.
- Add Phase 5A-4A documentation.
- Open PR #2 for review.

Explicitly excluded:

- No writes.
- No migrations.
- No UI changes.
- No API route changes.
- No API mutation changes.
- No database persistence changes.
- No repository persistence changes.
- No Investor Shield authority changes.
- No gate-clearing.
- No pipeline mutation.
- No True MAO changes.
- No scoring changes.
- No Phase 5A-4B implementation.
- No Phase 5B work.
- No Market History work.
- No AI, OCR, scraping, CRM, upload, or PDF work.

## Files Changed

- `lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts`
- `__tests__/professional-evidence-gateway-readonly-integration.test.ts`
- `docs/phase5/PHASE_5A_4A_READ_ONLY_LOADER_HELPER_ADAPTER.md`

No existing server-side loader was changed. Attaching the new model to existing Investor Review, Investor Summary, API, UI, or PDF contracts would change downstream behavior and is outside this controlled Phase 5A-4A helper/adapter.

## Adapter Summary

The new helper:

- accepts already-loaded evidence/deal data
- maps Evidence Command / `deal_evidence`-shaped records into Phase 5A-3 evidence inputs
- calls `buildProfessionalEvidenceGatewayViewModel`
- returns a `ProfessionalEvidenceGatewayViewModel`
- filters unmappable evidence rather than forcing a gate
- remains side-effect free
- has no database, repository, API, UI, or production imports

## Data Flow Summary

```text
already-loaded Evidence Command / deal_evidence-shaped records
-> mapLoadedEvidenceToProfessionalGatewayEvidenceInput
-> buildProfessionalEvidenceGatewayViewModel
-> ProfessionalEvidenceGatewayViewModel
```

The helper is designed for server-side loading paths to call after evidence has already been loaded. It does not load records itself.

## Locked RIGHTMOVE_SOLD_DATA Rule

The locked rule is preserved:

```text
RIGHTMOVE_SOLD_DATA remains visible sold-comparable / portal evidence and can support valuation, Market Value Position, negotiation context and operator review, but it does not professionally confirm SOLD_COMPARABLE_REVIEW by itself.
```

`RIGHTMOVE_SOLD_DATA` is mapped as visible evidence for `SOLD_COMPARABLE_REVIEW`, but the Phase 5A-3 mapper downgrades it to non-confirming unless the source is compatible and qualifying.

Qualifying sources for `SOLD_COMPARABLE_REVIEW` remain:

```text
SURVEYOR
SOLICITOR
LAND_REGISTRY
```

## Read-Only Proof

The helper:

- exports no create, update, delete, insert, save, or persist function
- imports no database adapter
- imports no evidence repository
- performs no query
- performs no insert, update, or delete
- accepts already-loaded records only
- returns a new view model
- does not mutate input objects

## Non-Authoritative Proof

The helper:

- does not import Investor Shield authority modules
- does not clear Investor Shield gates
- does not change pipeline state
- does not change True MAO
- does not change scoring
- keeps decision lock data display-only through the existing Phase 5A-3 mapper

## Phase 5A-4B Deferred Scope Note

James requested a separate scope proposal for connecting this helper to one agreed server-side loading path and producing visible proof.

Future Phase 5A-4B options only:

- read-only dev/demo page showing Professional Evidence Gateway output from real or seeded saved-deal evidence
- controlled section on the existing Investor Review page showing mapped professional evidence gates

Neither option is implemented by this PR.

## Boundary Confirmations

Confirmed:

- No writes.
- No migrations.
- No API changes.
- No UI changes.
- No database persistence changes.
- No repository persistence changes.
- No Investor Shield authority changes.
- No gate-clearing.
- No pipeline mutation.
- No True MAO changes.
- No scoring changes.
- No Phase 5A-4B implementation started.
- No Phase 5B work.
- No Market History work.
- No AI, OCR, scraping, CRM, upload, or PDF work.
- No manual deployment.
- No merge.
- No production access.

## Tests

Focused tests:

- `__tests__/professional-evidence-gateway-source-compatibility.test.ts`
- `__tests__/professional-evidence-gateway-read-model.test.ts`
- `__tests__/professional-evidence-gateway-readonly-integration.test.ts`

The read-only helper test proves:

- existing loaded evidence can be mapped into a Professional Evidence Gateway view model
- `RIGHTMOVE_SOLD_DATA` remains visible but non-confirming by itself
- `RIGHTMOVE_SOLD_DATA` plus compatible qualifying source can support confirmation
- portal / agent / operator evidence remains visible but non-confirming
- no Investor Shield gate is cleared
- no pipeline state is mutated
- no input objects are mutated
- the helper has no write function or persistence mutation surface
- the helper does not require migrations or new tables
- the helper does not change True MAO or scoring

## Validation Proof

```text
npx vitest run __tests__/professional-evidence-gateway-readonly-integration.test.ts
PASS

npx vitest run __tests__/professional-evidence-gateway-source-compatibility.test.ts
PASS

npx vitest run __tests__/professional-evidence-gateway-read-model.test.ts
PASS

npm run lint
PASS

npm run build
PASS

npm test -- --testTimeout 60000
PASS
```

## PR Link

```text
PR link: https://github.com/elreylake1-ops/Brik-by-Brik/pull/2
```

## Result

PHASE 5A-4A READ-ONLY LOADER HELPER / ADAPTER READY FOR REVIEW ONLY
