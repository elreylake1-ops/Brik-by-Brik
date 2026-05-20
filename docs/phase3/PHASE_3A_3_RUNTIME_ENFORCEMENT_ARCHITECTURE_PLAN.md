# Phase 3A-3 Runtime Enforcement Architecture Plan

## Executive Summary

Phase 3A-3 designs the runtime enforcement architecture for the Phase 3A-2 authority doctrine.

No enforcement is implemented in this step. This is an architecture planning document only.

Phase 3A-3 prepares the enforcement design so that future implementation is controlled, tested, and does not introduce governance weakening through rushed wiring.

## Purpose

This phase exists to prevent orchestration, advisory, workflow, UI, AI, or integration layers from weakening deterministic governance authority at runtime.

Phase 3A-2 defined the constitutional rules. Phase 3A-3 defines how those rules will be enforced in code — as planned enforcement systems, not yet implemented.

Current risk without enforcement: any future phase could silently violate the authority hierarchy through advisory outputs that soften fatal states, escalation routes that downgrade governance severity, or UI rendering that obscures capital protection signals.

## Source SOP Summary

The Phase 3A-3 SOP (Brik_By_Brik_Phase_3A_3_Runtime_Enforcement_SOP.docx) governs this phase:

- enforce governance authority at all system boundaries
- preserve deterministic integrity against advisory contamination
- prevent advisory outputs from softening deterministic risk signals
- enforce escalation hierarchy with no downgrade permitted
- protect orchestration boundaries from advisory bypass
- avoid AI workflows, CRM systems, persistence expansion, scraping, automation scaling, and business expansion

## Core Enforcement Doctrine

> **"Advisory outputs may increase review burden, but they may not reduce deterministic risk."**

> **"IF UNCERTAIN → BLOCK, DOWNGRADE OR ESCALATE."**

These are permanent rules. They govern all runtime enforcement decisions. When enforcement is uncertain, the safe-fail action is to preserve deterministic outputs, increase review burden, and escalate.

## Runtime Authority Hierarchy

```
deterministic_governance
→ capital_protection
→ deal_classification
→ workflow_orchestration
→ evidence_advisory
→ ui_presentation
```

Future AI assistance sits below `ui_presentation` and may not acquire authority above any layer.

Enforcement must prevent authority inversion. Authority inversion occurs when:

- advisory outputs modify authoritative outputs
- workflow overrides governance
- UI softens fatal classifications
- evidence reduces review burden
- AI commentary implies approval

Any inversion is a violation and must trigger safe-fail action.

## Enforcement Architecture Map

Seven planned enforcement systems. None are implemented yet.

### 1. Authority Enforcement Engine

**Planned location:** `lib/engine/phase3-authority-enforcement.ts`

Responsibilities:

- validate authority hierarchy on each output transition
- block illegal overrides at enforcement boundaries
- reject governance bypass attempts from orchestration/advisory/UI layers
- validate escalation ownership against `Phase3StateOwnershipRule` contracts
- preserve deterministic dominance when conflict exists

Illegal override examples:

- advisory output overriding a governance escalation route
- workflow routing overriding `capital_protection` signal
- UI rendering softening a `NO_DEAL` or `BLOCKED` fatal classification
- orchestration bypassing `decision_gate` authority
- evidence hint reducing `reviewRequired` flag already set by governance

### 2. State Hierarchy Enforcement

**Planned location:** within `lib/engine/phase3-authority-enforcement.ts` or dedicated `lib/engine/phase3-state-hierarchy-enforcement.ts`

Responsibilities:

- detect contradictory states across layers
- detect invalid progression paths (e.g., `no_deal` → `proceed_candidate` without governance re-evaluation)
- detect escalation conflicts between advisory and deterministic routes
- prevent workflow state from outranking governance state

### 3. Escalation Priority Engine

**Planned location:** within authority enforcement or escalation layer

Responsibilities:

- preserve highest-severity escalation route when multiple routes present
- block downgrade of active escalation route by advisory input
- increase review burden on escalation conflict rather than reducing it
- produce conflict log for audit layer

### 4. Advisory Containment Engine

**Planned location:** within `lib/engine/phase3-authority-enforcement.ts`

Responsibilities:

- isolate advisory outputs from authoritative output fields
- prevent advisory outputs from mutating deterministic state
- prevent optimistic reinterpretation of advisory signals
- preserve deterministic classifications under all advisory inputs

### 5. Orchestration Guardrails

**Planned integration:** validation layer on `buildPhase3Orchestration()` and `mergeOrchestrationWithEvidenceHints()` outputs

Responsibilities:

- validate that workflow authority has not been inverted
- prevent orchestration from bypassing governance-set decision gates
- protect deterministic outputs from task-generation side effects
- prevent any generated task from implying deal approval

### 6. UI Governance Enforcement

**Planned integration:** display contract validation before rendering on `/phase-3-dev-review` and future review surfaces

Responsibilities:

- protect governance visibility — deterministic decision must render before advisory sections
- enforce advisory labeling on all non-deterministic outputs
- prevent visual softening of `fatal`, `capital_protection`, `no_deal`, or `blocked` outcomes
- ensure warnings remain prominent and cannot be collapsed or hidden

### 7. Violation Audit Layer

**Planned location:** `lib/engine/phase3-violation-audit.ts` (types and contracts only, no persistence yet)

Responsibilities:

- record authority override attempts
- record escalation conflict events
- record orchestration bypass attempts
- record advisory contamination attempts
- surface violations as advisory output for review, not as automatic blocking

## Runtime Enforcement Flow

Planned flow (not implemented):

```
deterministic_output
→ authority_doctrine_validation       [Phase3A-2 contract check]
→ orchestration_output                [buildPhase3Orchestration()]
→ evidence_advisory_output            [mapEvidenceBundleToOrchestrationHints()]
→ merge_output                        [mergeOrchestrationWithEvidenceHints()]
→ enforcement_validation              [future: phase3-authority-enforcement.ts]
→ violation_report                    [future: phase3-violation-audit.ts]
→ safe_fail_action                    [preserve / escalate / block_advisory_upgrade]
→ ui_review_surface                   [phase-3-dev-review or future review surfaces]
```

This flow is planning only. Enforcement validation and violation report steps do not exist yet.

## Violation Matrix

| Violation Type | Example | Detection Layer | Required Safe-Fail Action | Severity |
| --- | --- | --- | --- | --- |
| Advisory overriding governance | Evidence hint changes `finalClassification` | Authority Enforcement Engine | `block_advisory_upgrade` + `preserve_deterministic_result` | FATAL |
| Workflow overriding capital protection | Orchestrator sets `globalDealState: proceed_candidate` on `NO_DEAL` result | State Hierarchy Enforcement | `preserve_deterministic_result` + `require_manual_review` | FATAL |
| UI softening fatal classification | No-deal verdict rendered without capital protection warning | UI Governance Enforcement | Show warning prominently; block advisory confidence rendering | HIGH |
| Orchestration bypassing decision gates | Task generated with `status: completed` on blocked governance state | Orchestration Guardrails | `preserve_deterministic_result` + `increase_review_burden` | HIGH |
| Evidence reducing review burden | Accepted evidence hint sets `reviewRequired: false` when governance set it `true` | Advisory Containment Engine | `block_advisory_upgrade` + `increase_review_burden` | HIGH |
| AI commentary implying approval | Future AI summary says "strong buy opportunity" on `NO_DEAL` result | Advisory Containment Engine + UI Governance Enforcement | `block_advisory_upgrade` + require manual review label | HIGH |
| Merged output downgrading escalation route | Merge selects `valuation_review` over existing `capital_protection` route | Escalation Priority Engine | Restore `capital_protection`; log conflict | FATAL |
| Task generation implying approval | Merged task summary says "deal cleared" when governance blocked | Orchestration Guardrails + UI Governance Enforcement | Remove implication; add advisory label | HIGH |
| Hidden warning / suppressed fatal risk | Merge output drops `fatalRisk: true` from display | Advisory Containment Engine + UI Governance Enforcement | `preserve_deterministic_result`; surface warning | FATAL |
| Confidence inflation from weak evidence | Weak comparable evidence used to label GDV confidence as high | Advisory Containment Engine | `downgrade_confidence`; add `review_required` warning | MEDIUM |
| Invalid progression from no-deal to proceed | Global deal state moves from `no_deal` to `proceed_candidate` without deterministic re-evaluation | State Hierarchy Enforcement | `preserve_deterministic_result` + `require_manual_review` | FATAL |
| Advisory route replacing capital protection | Evidence hint route `valuation_review` replaces `capital_protection` in merged output | Escalation Priority Engine | Restore `capital_protection`; append evidence route as secondary | FATAL |

## Escalation Enforcement Model

### State Severity Hierarchy

```
FATAL
→ REJECT / NO_DEAL / BLOCKED
→ MANUAL_REVIEW_REQUIRED / REVIEW_REQUIRED
→ CONDITIONAL
→ STRONG_OPPORTUNITY / PROCEED_CANDIDATE
```

A state at lower severity must not override or replace a state at higher severity. Enforcement must block downgrade.

### Route Priority Hierarchy

```
capital_protection           (highest)
→ structural_risk
→ legal_review
→ lender_review
→ valuation_review
→ evidence_gap / manual_review   (secondary, coexist)
→ none                           (only when all signals clean)
```

Enforcement rules:

- no lower-priority route may replace a higher-priority route
- evidence, advisory, and UI layers may not downgrade escalation routes
- when conflict exists, preserve highest severity
- uncertainty increases review burden — never reduces it
- contradictions must not be silently ignored; they must be surfaced as violations

## Authority Ownership Model

| Layer | Runtime Authority | Can Do | Cannot Do |
| --- | --- | --- | --- |
| Governance Engine | Authoritative | Set `finalClassification`, `fatalRisk`, `capital_protection`, governance thresholds, deal classification | None — this is the highest authority |
| Authority Enforcement Engine | Authoritative (enforcement) | Validate authority hierarchy, block violations, trigger safe-fail | Change deterministic outputs; approve deals; modify governance thresholds |
| Escalation Engine | Authoritative (routing) | Select primary escalation route by priority; preserve highest severity | Override `capital_protection`; downgrade governance routes; approve deals |
| Orchestrator | Advisory (with authority bounds) | Route workflow, generate tasks, select escalation route from deterministic output | Override governance, bypass decision gates, suppress fatal risk, approve deals |
| Advisory Layer | Advisory | Add review tasks, add warnings, flag evidence gaps, suggest routes | Remove risk, suppress warnings, upgrade deal state, alter deterministic outputs |
| Evidence Layer | Advisory | Surface evidence quality, signal missing/weak/conflicting evidence, request review | Alter final classification, change `reviewRequired` set by governance, reduce risk |
| UI Layer | Presentation | Render deterministic state, render advisory labels, show warnings | Soften governance, hide warnings, inflate confidence, present advisory output as authoritative |
| Future AI Layer | Advisory (lowest) | Summarize, assist review, extract candidate evidence | Classify deals, override governance, bypass escalation, weaken capital protection |

## Runtime Safe-Fail Rules

When enforcement encounters uncertainty or conflict, the following rules apply in order:

1. If uncertain about authority hierarchy → preserve deterministic result
2. If contradictory states detected → escalate review burden; do not silently proceed
3. If authority conflict exists → preserve deterministic governance; block advisory upgrade
4. If advisory conflict exists → add review burden; do not reduce it
5. If UI conflict exists → show stronger warning; do not soften
6. If AI/integration conflict detected (future) → require manual review; do not imply approval
7. Never silently ignore contradictions → always surface as violation or warning
8. Never allow advisory outputs to reduce deterministic risk under any path

These rules apply to all layers. They are not overridable by any advisory, workflow, or UI input.

## Orchestration Guardrail Proposal

The orchestrator (`buildPhase3Orchestration()` and future `mergeOrchestrationWithEvidenceHints()`) operates within bounded authority.

**The orchestrator may:**

- sequence execution path
- generate advisory tasks
- route workflow state
- select escalation route from deterministic input
- surface accepted limitations
- escalate review burden

**The orchestrator may not:**

- redefine deal classifications
- bypass governance decision gates
- suppress fatal conditions
- convert advisory evidence into approval
- downgrade `capital_protection` escalation to any lower route
- suppress deterministic risk flags from governance output
- generate tasks that imply deal completion or investor approval

Enforcement guardrail: any orchestration output that contradicts the above must trigger `preserve_deterministic_result` and `block_advisory_upgrade` safe-fail actions.

## Advisory Containment Proposal

Advisory outputs produced by evidence hints, merge layer, and future AI must remain contained.

**Advisory outputs may:**

- add review tasks
- add warnings
- flag evidence gaps
- request manual review
- summarize deterministic outputs (without modifying them)
- suggest secondary escalation routes

**Advisory outputs may not:**

- remove risk signals
- suppress deterministic warnings
- upgrade deal state
- imply approval or investor confidence
- alter deterministic outputs in any form
- reduce `reviewRequired` when governance set it `true`
- replace `capital_protection` with any lower-priority route

Containment enforcement: any advisory output that violates containment rules must be flagged as a violation and discarded before reaching review surfaces or UI.

## UI Governance Enforcement Proposal

The review surface and any future UI layer must enforce governance visibility.

**UI must:**

- render deterministic decision section before all advisory sections
- show `capital_protection` signal prominently, always visible
- label all advisory content clearly as advisory
- keep warnings visible at all times — no collapsing, hiding, or de-emphasizing
- distinguish deterministic outputs from advisory outputs with explicit labeling
- refuse to render approval actions (approve/send-offer/automations) from advisory outputs

**UI must not:**

- visually soften governance signals (e.g., green styling on `NO_DEAL`)
- hide or minimize warnings
- inflate confidence labels
- present advisory output as the primary investment decision
- make `no_deal` look negotiable through advisory framing
- present merged advisory confidence as final investment approval

UI enforcement should be validated at display contract level before any future UI rendering reaches end users.

## Future AI Authority Limitations

Future AI assistance may be integrated in later phases under strict authority limits.

**AI may:**

- summarize deterministic and advisory outputs for human reviewers
- assist manual review workflow
- extract candidate evidence for human validation

**AI may not:**

- classify deals
- override deterministic governance
- bypass escalation hierarchy
- weaken capital protection
- convert candidate evidence into authoritative truth without explicit manual and deterministic validation

All AI output must carry `advisoryOnly: true` and must be surfaced below deterministic governance in every display context.

## Violation Audit Layer Proposal

Planning-level audit fields only. No persistence or logging is approved in this step.

Future `Phase3ViolationRecord` fields:

- `violationId` — stable unique identifier
- `violationType` — category from violation matrix
- `detectedLayer` — which enforcement system detected the violation
- `attemptedOverride` — what advisory or orchestration output attempted to override
- `protectedAuthority` — which authoritative output was protected
- `safeFailAction` — which safe-fail rule was applied
- `severity` — violation severity from hierarchy (FATAL, HIGH, MEDIUM)
- `advisoryOnly` — always `true`; violations are surfaced as advisory audit, not runtime blocks yet

**Not approved in this step:**

- no persistence or audit database
- no logging infrastructure
- no real-time violation streaming
- no external monitoring integration
- violation records remain in-memory advisory output only

## Current Architecture Readiness Audit

| Layer | Ready for Future Enforcement? | Enforcement Risk | Required Future Guardrail |
| --- | --- | --- | --- |
| Phase 3A-2 authority doctrine (`types/phase3-authority.ts`, `lib/engine/phase3-authority-contract.ts`) | Yes — contracts define hierarchy, ownership, escalation, safe-fail | Doctrine is not yet enforced at runtime; violations can currently go undetected | Wire enforcement engine to validate against doctrine on each orchestration transition |
| Phase 3A-0 orchestration (`lib/engine/phase3-orchestrator.ts`) | Yes — pure function, stable task IDs, advisory-only outputs | `buildPhase3Orchestration()` generates tasks but does not currently validate authority ownership | Add post-output authority validation before output leaves orchestrator |
| Phase 3A-1 adapter bridge (`lib/engine/phase3-adapter.ts`) | Yes — deterministic bridge only, no advisory contamination | Bridge maps deterministic output without enforcement checks | Add snapshot validation to confirm bridge output preserves governance state |
| Phase 3B-0 evidence contracts (`lib/engine/phase3-evidence-contract.ts`) | Yes — advisory-only, `advisoryOnly: true` enforced | Evidence validation does not currently block advisory upgrade attempts | Add containment check to confirm evidence validation output cannot modify governance fields |
| Phase 3B-1 advisory hints (`lib/engine/phase3-evidence-orchestration-adapter.ts`) | Yes — pure function, no deterministic modification | Hint adapter has no guardrail preventing future misuse if called with governance outputs | Add output containment validation to confirm hints never appear in authoritative fields |
| Phase 3C-0 merge layer (`lib/engine/phase3-orchestration-merge.ts`) | Partial — route priority and deduplication logic exists | Merge layer currently selects primary route from priority list, but has no authority enforcement validation step | Add authority enforcement validation after merge to confirm `capital_protection` is never displaced |
| Phase 3D-0 dev review surface (`app/phase-3-dev-review/page.tsx`, `types/phase3-review-surface.ts`) | Partial — display contract defined, governance-first section order enforced in contracts | Review surface renders advisory content and deterministic content but has no runtime enforcement label validation | Add display contract enforcement to confirm governance sections always render before advisory sections |

## What Is Not Approved Yet

- no runtime enforcement implementation
- no enforcement engine wiring
- no UI enforcement behavior changes
- no persistence or audit database
- no AI enforcement
- no scraping or integration enforcement
- no CRM or workflow expansion
- no automation scaling
- no public workflow expansion
- no heavy UI expansion
- no changes to existing deterministic engine behavior
- no changes to existing orchestrator behavior

## Step 2 — Runtime Enforcement Type Contracts

**Status: Complete**

Delivered in `types/phase3-enforcement.ts` and `__tests__/phase3-enforcement-contract.test.ts`.

### Contracts Delivered

- `PHASE3_ENFORCEMENT_SYSTEMS` — 7 planned enforcement system identifiers (const array + union type)
- `PHASE3_VIOLATION_TYPES` — 12 violation categories from violation matrix (const array + union type)
- `PHASE3_ENFORCEMENT_SEVERITIES` — fatal, high, medium, low (const array + union type)
- `PHASE3_RUNTIME_SAFE_FAIL_ACTIONS` — 7 safe-fail actions (const array + union type)
- `PHASE3_ENFORCEMENT_OUTCOMES` — 5 enforcement outcomes (const array + union type)
- `Phase3AuthorityViolation` — enforcement audit record, `advisoryOnly: true`
- `Phase3EnforcementResult` — safe-fail decision output, `advisoryOnly: true`
- `Phase3EscalationEnforcementRule` — escalation downgrade rule, `advisoryOnly: true`
- `Phase3OrchestrationGuardrail` — orchestration boundary descriptor, `advisoryOnly: true`
- `Phase3UIGovernanceRule` — UI presentation constraint, `advisoryOnly: true`

### Boundaries Confirmed

- No enforcement functions
- No engine wiring
- No UI changes
- No persistence
- No runtime behavior
- All exported values are readonly const arrays or type definitions only

### What Remains

- Enforcement engine implementation (`lib/engine/phase3-authority-enforcement.ts`) — not approved
- Violation audit persistence — not approved
- UI enforcement behavior — not approved
- Any enforcement wiring to orchestrator, merge layer, or review surface — not approved

---

## Recommended Next Step

Recommended next implementation step:

**Phase 3A-3 Step 2 — Runtime Enforcement Type Contracts Only**

Step 2 should define type contracts and tests only, with no runtime wiring.

Step 2 scope:

- `Phase3ViolationType` union — all violation categories from violation matrix
- `Phase3ViolationSeverity` union — FATAL, HIGH, MEDIUM
- `Phase3ViolationRecord` type — enforcement audit record (no persistence)
- `Phase3EnforcementResult` type — safe-fail decision output
- `Phase3EscalationConflict` type — detected conflict between governance and advisory routes
- `Phase3AdvisoryContainmentResult` type — advisory containment check output
- guardrail comments on all new types
- `advisoryOnly: true` on all enforcement output types
- type-level tests confirming contract shape and enforcement field invariants

No enforcement functions, no engine wiring, no UI changes, and no persistence should be added in Step 2.
