# Phase 4 Completion Block 2A2 Investor Summary Data Contract Audit

## Purpose
Define an implementation-ready, read-only Investor Summary contract that composes existing authoritative deal, deterministic engine, Operator Command, Investor Shield, offers, tasks, and future Evidence Lite state without introducing a second decision system.

## Summary Is Not a New Decision Engine
Investor Summary must be a read-only roll-up of authoritative existing state.
It must not persist its own decision, must not replace the deterministic engine, and must not soften Investor Shield or governance outcomes.

## Existing Data Sources
- Saved deal
  - Source: `lib/operator-command/saved-deals-repository.ts`
  - Exposed through: `app/api/saved-deals/[id]/route.ts`
  - Current fields include address, purchase price, GDV realistic, refurb cost, classification, governance state, capital protection state, pipeline state, next action, and archived state.
- Deterministic engine
  - Source: `lib/engine/analyze-deal-with-refurb.ts`
  - Inputs/outputs: `types/deal.ts`, `types/due-diligence.ts`
  - Current outputs include total cost, finance cost, profit, profit margin, True MAO, verdict, confidence, and due diligence when inputs permit.
- Operator Command
  - Sources: `lib/operator-command/evaluate-operator-guard.ts`, `lib/operator-command/deal-offers-repository.ts`, `lib/operator-command/deal-tasks-repository.ts`
  - Current UI exposure: `app/page.tsx`, `SavedDealInvestorShieldPanel`
  - Includes current operational state, next action, task state, offer state, and pipeline state.
- Investor Shield
  - Sources: `lib/investor-shield/investor-shield-repository.ts`, `lib/investor-shield/evaluate-investor-shield.ts`, `lib/investor-shield/map-investor-shield-ui-view-model.ts`, `types/investor-shield.ts`, `types/investor-shield-enforcement.ts`, `types/investor-shield-ui.ts`
  - Current UI exposure: `components/InvestorShieldPanel.tsx`, `components/SavedDealInvestorShieldPanel.tsx`
  - Includes gate status, blocking/caution gates, advisories, protected movement state, task recommendations, waivers, and deterministic dominance presentation.
- Tasks
  - Source: `lib/operator-command/deal-tasks-repository.ts`
  - Current API route: `app/api/saved-deals/[id]/tasks/route.ts`
  - Includes task count, blocker state, task status, and related gate/context fields.
- Offers
  - Source: `lib/operator-command/deal-offers-repository.ts`
  - Current API route: `app/api/saved-deals/[id]/offers/route.ts`
  - Includes latest offer and offer history state.
- Future Evidence Lite
  - Planned source: `brik_by_brik_engine.deal_evidence`
  - Not implemented yet.
  - Must be read into the summary later without becoming a separate decision engine.

## Field Availability Matrix
| Summary Field | Source | Current Availability | Missing Dependency |
|---|---|---|---|
| saved deal ID | saved-deal repository / detail route | available | none |
| property address | saved-deal repository / detail route | available | none |
| purchase price | saved-deal repository / detail route, engine input | available | none |
| GDV or GDV range | saved-deal repository + engine result | partially available | GDV range needs engine result shape exposure in summary contract |
| deal status | saved-deal `classification` and `pipeline_state` | available | none |
| pipeline state | saved-deal repository / detail route | available | none |
| archive state | `archived_at` on saved deal | available | none |
| True MAO | deterministic engine (`types/deal.ts`) | available from engine result | summary contract needs to select it from existing result |
| purchase-price vs True MAO comparison | deterministic engine result | derivable | none |
| profit result | deterministic engine result | available | none |
| capital protection result | saved deal + deterministic governance context | available in current UI/source state | summary contract needs direct inclusion of the deterministic/capital state fields |
| deal classification | saved deal / deterministic engine context | available | none |
| deterministic NO-GO status | deterministic engine verdict / governance fields | available | none |
| governance warnings | deterministic engine + operator guard + Investor Shield | partially available | may need a small read-model composition layer |
| current operational state | saved deal + Operator Command guard | available | none |
| next action | saved deal `next_action` and task recommendations | available | none |
| blocker state | Operator Command guard + tasks | available | none |
| offer state | offer repository | available | none |
| task state | task repository | available | none |
| overall gate status | Investor Shield UI model | available | none |
| required gate counts | Investor Shield UI model | available | none |
| missing gates | Investor Shield UI model | available | none |
| weak gates | Investor Shield UI model | available | none |
| failed gates | Investor Shield UI model | available | none |
| waived gates | Investor Shield UI model | available | none |
| advisory signals | Investor Shield UI model | available | none |
| protected movement state | Investor Shield UI model | available | none |
| blocking gate keys | Investor Shield UI model | available | none |
| pipeline mutation prevented flag | Investor Shield UI model / protected movement | available | none |
| active task count | task repository | derivable | none |
| blocker count | task repository + task status | derivable | may need a small read-model addition |
| linked gate | future Evidence Lite / Investor Shield gate model | future-only | Evidence Lite required for first-class summary binding |
| task status | task repository | available | none |
| recommended actions | Investor Shield task recommendations + operator command | available | none |
| latest offer | offer repository | derivable | none |
| latest counter-offer | offer repository | derivable if offer status history exists | may need a small read-model addition |
| offer status | offer repository | available | none |
| offer history summary | offer repository | derivable | may need a small read-model addition |
| evidence count | future Evidence Lite | missing | Evidence Lite required |
| evidence by linked gate | future Evidence Lite | missing | Evidence Lite required |
| recorded/reviewed/verified/rejected counts | future Evidence Lite | missing | Evidence Lite required |
| missing-evidence summary | Investor Shield current UI model; future Evidence Lite can sharpen it | partially available | Evidence Lite required for full binding |

## Proposed Investor Summary Contract
Suggested top-level view model: `InvestorSummaryViewModel`

Suggested sections:
- `deal`
  - saved deal ID
  - address
  - purchase price
  - GDV or GDV range
  - deal status
  - pipeline state
  - archive state
- `deterministicDecision`
  - True MAO
  - profit
  - capital protection result
  - classification
  - deterministic NO-GO status
  - governance warnings
- `operatorCommand`
  - current operational state
  - next action
  - blocker state
  - task state summary
  - offer state summary
- `investorShield`
  - overall gate status
  - required gate counts
  - missing, weak, failed, and waived gates
  - advisory signals
  - protected movement state
  - blocking gate keys
  - pipeline mutation prevented flag
- `evidence`
  - evidence count
  - evidence by linked gate
  - recorded/reviewed/verified/rejected counts
  - missing-evidence summary
- `tasks`
  - active task count
  - blocker count
  - task status breakdown
  - linked gate references
  - recommended actions
- `offers`
  - latest offer
  - latest counter-offer
  - offer status
  - offer history summary
- `recommendedNextAction`
  - single precedence-driven label
  - supporting rationale
- `dataCompleteness`
  - which sections are fully loaded
  - which dependencies are missing
  - whether the summary is partial or complete

## Recommended Next-Action Precedence
1. Deterministic NO-GO / capital protection failure -> `DO_NOT_PROCEED`
2. Failed required Investor Shield gate -> `BLOCKED`
3. Missing or weak required evidence -> `REQUEST_EVIDENCE`
4. Manual-review state -> `MANUAL_REVIEW_REQUIRED`
5. Gates sufficiently clear but operational tasks remain -> `CONTINUE_REVIEW`
6. Protected progression allowed -> `READY_FOR_NEXT_CONTROLLED_STEP`

The summary must not invent approval language or imply guaranteed deal quality.

## Allowed Next-Action Labels
- `DO_NOT_PROCEED`
- `BLOCKED`
- `REQUEST_EVIDENCE`
- `MANUAL_REVIEW_REQUIRED`
- `CONTINUE_REVIEW`
- `READY_FOR_NEXT_CONTROLLED_STEP`

## Deterministic Dominance Rules
- Deterministic NO-GO overrides all optimistic operational or advisory state.
- True MAO failure cannot be softened.
- Capital protection failure cannot be softened.
- Classifications remain authoritative.
- Investor Shield cannot convert deterministic failure into approval.
- Advisory signals cannot satisfy hard gates.
- Task completion alone does not satisfy evidence requirements.
- Evidence notes alone do not satisfy a gate.
- Waiver remains visually and semantically distinct from satisfaction.

## Investor Shield and Evidence Rules
- Investor Shield remains the gate/guard authority for protected movement and status.
- Evidence Lite, when added, must be read as supporting state only.
- Evidence Lite cannot create a second decision engine.
- Evidence counts should be informational unless the existing Investor Shield evaluator consumes them.
- Missing-evidence summaries should continue to be derived from the authoritative gate model.

## Solicitor Gate Compatibility Rule
- Canonical key: `SOLICITOR_REVIEW`
- Legacy alias: `SOLICITOR_FEEDBACK`
- Investor Summary must display only one solicitor gate.
- Legacy records must normalize before summary grouping.
- No duplicate gate count, task count, or evidence group.

## Empty and Incomplete States
- No saved deal selected: show a safe empty state.
- Saved deal exists but Investor Shield model absent: show partial data and mark Investor Shield incomplete.
- No offers: show empty offer state.
- No tasks: show empty task state.
- No evidence: show empty evidence state once Evidence Lite exists.
- Partial deterministic data: show incomplete deterministic state, not approval.
- Unavailable optional GDV range: hide the range and mark the section incomplete.
- Loading failure: fail safely and avoid false readiness.

## Persistence Decision
- No Investor Summary table.
- No duplicate decision persistence.
- Compose from existing source state.
- Future Evidence Lite should be read and incorporated, not copied.

## Controlled Implementation Subphases
- Block 2C1 — Investor Summary contracts only
- Block 2C2 — Pure summary mapper only
- Block 2C3 — Fixtures and mapper tests only
- Block 2C4 — Static summary component only
- Block 2C5 — Bind existing read-only deal state
- Block 2C6 — Bind Evidence Lite summary after Evidence Lite exists
- Block 2C7 — Browser QA and production proof

## Production Preconditions
Runtime implementation/proof remains blocked until:
- Supabase ownership is confirmed
- James Vercel database connection works
- Block 1B passes
- Evidence Lite migration plan is approved before evidence-dependent binding

## Explicit Non-Implementation
- No types/components/routes added.
- No runtime behavior changed.
- No schema or migration added.
- No production mutation occurred.
- No deterministic logic changed.

## Result
INVESTOR SUMMARY DATA CONTRACT PLAN READY

## Recommended Next Step
Resume James Vercel database connection verification once James confirms Supabase ownership and updates the pooled `DATABASE_URL`.

Do not implement Investor Summary runtime yet.
