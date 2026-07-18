# Phase 5A-4B — Visible Professional Evidence Gateway Proof Scope Proposal

## Purpose

This is a scope proposal only.

Phase 5A-4B is not started yet. This document requests James's approval for one controlled visible proof route. No implementation is included in this commit.

Phase 5A-4A provided the helper/adapter layer only. It accepted already-loaded Evidence Command / `deal_evidence`-shaped records and mapped them into the Professional Evidence Gateway read-model. It did not attach the helper to an existing saved-deal loading path and did not show visible proof on-screen.

If approved later, Phase 5A-4B would connect the Phase 5A-4A helper to one agreed visible proof path while preserving all locked boundaries.

Accepted Phase 5A-4A record:

- PR #2 merged into `main`
- pre-merge PR head: `8ee73b3e2a70711a8dde8fb1ac63251e94effcef`
- merge commit: `5f3fb114b9d36c91dea2507e7cdcd61bcc21c240`
- `phase4-final-approved` remains untouched at `5d13f0cfdf4484f9bfe5be4626ac554d0c74680e`
- Phase 5A-4A is accepted only as the helper/adapter layer
- Phase 5A-4A does not yet count as visible proof or full server-side integration

## Recommended Route

Recommended route:

```text
Read-only dev/demo page showing Professional Evidence Gateway output from real or seeded saved-deal evidence.
```

This is the lowest-risk route because it:

- is lower risk than modifying the existing Investor Review page first
- keeps visible proof isolated
- avoids changing Investor Shield authority
- avoids implying professional gates clear deal gates
- allows James to inspect mapped evidence before any customer-facing or main review page integration
- can later inform a controlled Investor Review page section if approved

## Alternative Route

Alternative route only:

```text
Controlled section on the existing Investor Review page showing mapped professional evidence gates.
```

This is higher risk because it touches the existing review experience. It should only be chosen if James prefers proof inside the live review flow.

Only one route should be selected before implementation.

## Proposed Visible Proof Requirements

If approved later, Phase 5A-4B implementation should show:

- solicitor/title evidence
- sold comparable evidence
- `RIGHTMOVE_SOLD_DATA` visible but non-confirming
- qualifying source evidence confirming where appropriate
- Professional Evidence Gateway readiness/decision-lock status
- Investor Shield remaining unchanged
- no Investor Shield gate-clearing
- no pipeline mutation
- no True MAO/scoring changes

## Locked Rightmove Rule

```text
RIGHTMOVE_SOLD_DATA remains visible sold-comparable / portal evidence and can support valuation, Market Value Position, negotiation context and operator review, but it does not professionally confirm SOLD_COMPARABLE_REVIEW by itself.
```

Qualifying confirmation for `SOLD_COMPARABLE_REVIEW` remains limited to `SURVEYOR`, `SOLICITOR`, and `LAND_REGISTRY`.

## Proposed Implementation Boundaries

Phase 5A-4B may include, only after approval:

- a read-only dev/demo route or isolated proof page
- read-only use of existing saved deal evidence or seeded proof fixture
- use of the Phase 5A-4A helper/adapter
- display of Professional Evidence Gateway mapped gates
- tests proving read-only behavior and non-authoritative behavior
- documentation of visible proof

Phase 5A-4B must exclude:

- writes
- migrations
- database persistence changes
- repository persistence changes
- API mutation changes
- production data mutation
- Investor Shield authority changes
- Investor Shield gate-clearing
- pipeline mutation
- True MAO changes
- scoring changes
- Phase 5B
- Market History
- AI/OCR/scraping/CRM/upload/PDF work
- production-risk changes

## Proposed Files To Inspect

Likely files to inspect during implementation only after approval:

```text
app/saved-deals/[id]/review/page.tsx
app/phase-3-dev-review/page.tsx
components/evidence-lite/EvidenceLitePanel.tsx
lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts
lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts
lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility.ts
types/professional-evidence-gateway.ts
__tests__/professional-evidence-gateway-readonly-integration.test.ts
```

Phase 5B and Market History materials should not be inspected for Phase 5A-4B.

## Proposed Files That May Change Later Only After Approval

For the recommended dev/demo route, possible files:

```text
app/phase-5a-professional-gateway-proof/page.tsx
components/professional-evidence-gateway/ProfessionalEvidenceGatewayProofPanel.tsx
__tests__/professional-evidence-gateway-visible-proof.test.tsx
docs/phase5/PHASE_5A_4B_VISIBLE_PROOF_IMPLEMENTATION.md
```

For the alternative Investor Review route, possible files:

```text
app/saved-deals/[id]/review/page.tsx
components/professional-evidence-gateway/ProfessionalEvidenceGatewayReviewPanel.tsx
__tests__/professional-evidence-gateway-review-visible-proof.test.tsx
docs/phase5/PHASE_5A_4B_INVESTOR_REVIEW_VISIBLE_PROOF.md
```

Only one route should be selected before implementation.

## Proposed Test Plan

If approved later, tests should prove:

- solicitor/title evidence is visible in the Professional Evidence Gateway proof output
- sold comparable evidence is visible
- `RIGHTMOVE_SOLD_DATA` is visible but non-confirming by itself
- `SURVEYOR`, `SOLICITOR`, or `LAND_REGISTRY` can qualify confirmation for `SOLD_COMPARABLE_REVIEW`
- Investor Shield status remains unchanged
- no gate-clearing occurs
- no pipeline mutation occurs
- no writes or persistence functions are called
- no True MAO/scoring values change
- page renders read-only proof output
- unavailable/empty evidence states render safely

Proposed focused visible proof test path:

```text
`__tests__/professional-evidence-gateway-visible-proof.test.tsx`
```

## Validation Plan

Proposed later validation commands:

```powershell
npx vitest run __tests__/professional-evidence-gateway-readonly-integration.test.ts
npx vitest run __tests__/professional-evidence-gateway-visible-proof.test.tsx
npm run lint
npm run build
npm test -- --testTimeout 60000
```

## Approval Gate

```text
Phase 5A-4B must not begin until James approves one visible proof route.
```

```text
PHASE 5A-4B VISIBLE PROOF SCOPE PROPOSAL READY FOR JAMES REVIEW ONLY
```
