# Phase 4D-0C Investor Shield UI Architecture Readiness Audit

## Purpose
This audit identifies current architecture and safe insertion points before Investor Shield UI implementation.

## Current Baseline
- Phase 4C accepted
- 4D-0A and 4D-0B complete
- production read-only MVP runtime verified
- deterministic engine untouched
- no UI implementation yet

## Existing Read-Only Data Surface
- Investor Shield UI API route: `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
  - Responsibility: load a saved deal, then load the read-only Investor Shield UI model.
  - Repository/helper chain: `getSavedDealById` -> `loadInvestorShieldUiModelForDeal` -> `loadInvestorShieldEvaluationInput` -> domain repository reads -> evaluator -> UI adapter.
  - Read-only: yes.
  - Safe behavior: production proof already confirmed `200` on a valid proof fixture, with no `500`, and safe blocking/incomplete behavior when underlying Investor Shield data is missing.

- Saved-deal detail API route: `app/api/saved-deals/[id]/route.ts`
  - Responsibility: return a single saved deal.
  - Repository/helper chain: `getSavedDealById`.
  - Read-only: yes.
  - Safe behavior: production proof already confirmed `200` for a valid detail row and `404` for missing rows.

- Saved-deals list API route: `app/api/saved-deals/route.ts`
  - Responsibility: list saved deals and create saved deals.
  - Repository/helper chain: `listSavedDeals` for `GET`, `createSavedDeal` for `POST`.
  - Read-only: `GET` is read-only; `POST` is not read-only.
  - Safe behavior: the list route has been used safely for read access in production proof; creation is outside this audit's UI scope.

- Saved-deals repository: `lib/operator-command/saved-deals-repository.ts`
  - Responsibility: central saved-deal storage helper for create, list, read, update, archive, and pipeline-state mutation.
  - Repository/helper chain: direct database query helpers plus default Investor Shield check creation on `createSavedDeal`.
  - Read-only: `getSavedDealById` and `listSavedDeals` are read-only; `createSavedDeal`, `updateSavedDeal`, `archiveSavedDeal`, and `updateSavedDealPipelineState` are mutating.
  - Safe behavior: production proof confirmed safe read paths and controlled proof-only behavior; default check creation remains a best-effort side effect on create.

## Existing Investor Shield Domain Surface
- Gate definitions: `lib/investor-shield/default-gates.ts`
  - Defines the required gates, their labels, default severities, evidence types, and the advisory-only refurb sub-gate.

- Gate statuses and required/advisory types: `types/investor-shield.ts`
  - Defines `NOT_STARTED`, `REQUIRED`, `IN_PROGRESS`, `SATISFIED`, `WEAK`, `FAILED`, and `WAIVED`.
  - Defines the advisory-only sub-gate `AI_VISUAL_REVIEW_ADVISORY`.

- Evaluator behavior: `lib/investor-shield/evaluate-investor-shield.ts`
  - Produces overall status, progression decision, blocking/caution/missing gates, advisory warnings, deterministic dominance notes, and task recommendations.
  - Advisory evidence cannot satisfy hard evidence alone.
  - Deterministic rejection dominates Investor Shield output.

- Task recommendation behavior: `lib/investor-shield/build-investor-shield-task-drafts.ts`
  - Converts evaluator recommendations into task drafts.
  - Uses idempotency keys and read-only draft creation logic.

- Duplicate task protection: `lib/investor-shield/persist-investor-shield-task-drafts.ts`
  - Dedupe logic prevents repeated task creation for the same gate recommendation.
  - Uses blocker-reason markers and existing task checks to avoid duplication.

- Pipeline guard behavior: `lib/investor-shield/guard-investor-shield-pipeline-movement.ts`
  - Existing guard path blocks protected movement when Investor Shield is not clear.
  - The current runtime proof showed blocked movement remains blocked until controlled clear-state conditions are met.

- Waiver behavior: `lib/investor-shield/investor-shield-ui-adapter.ts` and `types/investor-shield.ts`
  - Waiver is represented through `WAIVED` status and `ManualOverride` records.
  - Waiver reason is visible in the UI adapter when a manual override reason exists.
  - Waiver remains a traceable risk state, not equivalent to satisfied evidence.

## Existing UI Surface
- Root saved-deal page: `app/page.tsx`
  - Current responsibility: list saved deals, show a saved-deal detail panel, show operator command summary, and render the read-only Investor Shield summary panel.
  - Data available today: saved deal detail, saved-deals list, offers, tasks, pipeline state, and Investor Shield model/error/loading state.
  - Already fetches saved-deal detail: yes, via `handleViewSavedDeal` and the detail route.
  - Can safely host a read-only panel later: yes.
  - Risk level: low.

- Investor Shield summary panel: `components/InvestorShieldGateSummaryPanel.tsx`
  - Current responsibility: render the read-only Investor Shield gate summary, counts, task recommendations, sub-gate details, and waiver-related text.
  - Data available today: an `InvestorShieldUiModel`.
  - Already fetches saved-deal detail: no, it is presentation-only.
  - Can safely host a read-only panel later: yes, but it is already the primary read-only presentation component.
  - Risk level: low.

- Engine analysis panel: `components/EngineAnalysisPanel.tsx`
  - Current responsibility: show core deal math, due diligence output, and confidence diagnostics.
  - Data available today: live analysis result, including due diligence and deterministic verdicts.
  - Already fetches saved-deal detail: no.
  - Can safely host a read-only panel later: yes, but it is not the best primary Investor Shield insertion point because it is centered on calculator output.
  - Risk level: medium.

- Investor Shield fetch helper: `lib/investor-shield/fetch-investor-shield-ui-model.ts`
  - Current responsibility: client-side fetch wrapper for the Investor Shield UI model route.
  - Data available today: success/failure and the UI model payload.
  - Already fetches saved-deal detail: no, it fetches Investor Shield status after a deal is selected.
  - Can safely host a read-only panel later: yes, as a data bridge only.
  - Risk level: low.

- Investor Shield UI route loader: `lib/investor-shield/load-investor-shield-ui-model.ts`
  - Current responsibility: server-side loading of the live Investor Shield UI model.
  - Data available today: checks, evidence, risk flags, manual overrides, and enforcement output.
  - Already fetches saved-deal detail: indirectly through the UI route path.
  - Can safely host a read-only panel later: yes, as a loader boundary only.
  - Risk level: low.

## Recommended Future Insertion Point
Recommended insertion point: the saved-deal detail area in `app/page.tsx`, centered on the existing `Investor Shield` read-only section inside the `Saved Deal Detail` panel.

Why this is safest:
- it already displays a saved deal
- it already fetches saved-deal detail
- it already fetches and renders the Investor Shield model
- it keeps deterministic governance and capital protection visible near the saved-deal record
- it avoids introducing a new page, route, or dashboard surface

## Data Gap Analysis
- missing dedicated view model contracts for future smaller UI slices if the panel is split further
- missing static UI examples for required-gate, blocked-movement, waiver, and advisory-separation states
- missing explicit warning-copy examples for all blocked/review permutations
- missing a documented, fixture-backed panel shell for future visual verification
- missing separate display examples for waiver reason versus satisfied evidence
- missing separate display examples for task recommendations versus gate satisfaction

## Visual Risk Analysis
- advisory items appearing authoritative
- waiver appearing identical to satisfied evidence
- blocked movement looking like a soft warning
- deterministic NO-GO visually hidden below advisory optimism
- task recommendation appearing as gate satisfaction
- manual review appearing as approval

## Architecture Readiness Decision
READY FOR 4D-1A VIEW MODEL CONTRACTS

Reason:
- the read-only data route exists
- a likely UI insertion point is already identified
- no schema blocker is present
- no runtime blocker is present
- no implementation is required before contracts

## Safety Confirmation
- audit only
- no UI code added
- no runtime behavior changed
- no schema changes
- no production data mutation
- deterministic engine untouched

## Recommended Next Step
Phase 4D-1A — Investor Shield UI View Model Contracts Only

## Result
AUDIT ONLY
