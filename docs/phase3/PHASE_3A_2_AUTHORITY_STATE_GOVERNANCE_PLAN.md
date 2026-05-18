# Phase 3A-2 Authority and State Governance Plan

## Purpose

Phase 3A-2 introduces a constitutional authority and state governance layer before Phase 3 expands further.

This step is planning and architecture audit only. It does not implement runtime governance enforcement, deterministic engine changes, or UI behavior changes.

## Client Doctrine

“Advisory outputs may increase review burden, but they may not reduce deterministic risk.”

This doctrine is now permanent architecture law for Phase 3 and all future extensions.

## Platform Law

Deterministic governance remains the authoritative source of truth.

All advisory, orchestration, workflow, evidence, AI, and presentation layers remain subordinate to governance and capital protection.

## Authority Hierarchy

1. deterministic governance
2. capital protection
3. deal classification
4. workflow orchestration
5. evidence/advisory layers
6. UI presentation

Authority must never flow upward from advisory or UI layers into deterministic layers.

## Authoritative Outputs

Authoritative outputs are:

- True MAO
- finance calculations
- capital protection
- governance thresholds
- deal classifications
- decision gates
- fatal risk detection
- deterministic final deal result

## Advisory Outputs

Advisory outputs are:

- evidence hints
- review suggestions
- workflow routing
- advisory tasks
- investor summaries
- AI commentary
- evidence confidence indicators
- merged advisory outputs
- developer review surface output

## State Ownership Map

| State / Output | Owning Layer | Authority Level | May Be Modified By | May Not Be Modified By |
| --- | --- | --- | --- | --- |
| True MAO | Deterministic governance engine | Authoritative | Deterministic formula/config updates only (explicit approved deterministic phases) | Orchestrator, evidence adapters, merge layer, advisory UI, AI, external integrations |
| finance result | Deterministic governance engine | Authoritative | Deterministic finance logic/config updates only (explicit approved deterministic phases) | Orchestrator, evidence adapters, merge layer, advisory UI, AI, external integrations |
| governance state | Deterministic governance engine | Authoritative | Deterministic governance logic only | Orchestrator, evidence adapters, merge layer, advisory UI, AI, external integrations |
| final classification | Deterministic governance engine | Authoritative | Deterministic governance/classification logic only | Orchestrator, evidence adapters, merge layer, advisory UI, AI, external integrations |
| fatal risk | Deterministic governance engine | Authoritative | Deterministic risk detection logic only | Orchestrator, evidence adapters, merge layer, advisory UI, AI, external integrations |
| capital protection route | Deterministic governance engine | Authoritative | Deterministic governance route selection only | Orchestrator, evidence adapters, merge layer, advisory UI, AI, external integrations |
| global deal state | Orchestration layer (derived from deterministic state) | Subordinate deterministic-derived | Orchestrator mapping rules that preserve deterministic dominance | Evidence hints, merge hints, UI presentation, AI commentary |
| workflow state | Orchestration layer | Advisory/operational | Orchestrator workflow mapping rules | Evidence hints, merge hints, UI presentation, AI commentary |
| evidence status | Evidence contract layer | Advisory | Evidence contract validation flow and manual evidence operations | Deterministic engine outputs, UI-only transforms, AI auto-approval |
| evidence confidence | Evidence contract layer | Advisory | Evidence contract validation flow and manual review outcomes | Deterministic decision outputs, UI-only transforms, AI auto-verification |
| advisory task status | Orchestration/advisory layers | Advisory | Orchestrator/advisory task logic and manual reviewer actions | Deterministic authoritative outputs, UI-only transforms, AI auto-approval |
| merged advisory output | Merge layer | Advisory | Merge contract logic only | Deterministic authoritative outputs, UI-only transforms, AI auto-approval |
| UI display state | UI presentation layer | Presentation only | UI render/view composition | Deterministic authoritative outputs, evidence validation truth, orchestration contracts |

## Escalation Priority Rules

Escalation hierarchy:

- FATAL
- REJECT / NO_DEAL / BLOCKED
- MANUAL_REVIEW_REQUIRED / REVIEW_REQUIRED
- CONDITIONAL
- STRONG_OPPORTUNITY / PROCEED_CANDIDATE

Current route priority:

- capital_protection
- structural_risk
- legal_review
- lender_review
- valuation_review
- evidence_gap / manual_review
- none

Lower-priority advisory routes may coexist, but may not override higher-priority deterministic routes.

## Safe-Fail Downgrade Doctrine

- uncertainty must downgrade confidence or increase review burden
- uncertainty must never upgrade opportunity quality
- missing evidence must remain visible
- conflicting evidence must trigger review
- AI or future integrations must never convert unknown into verified without deterministic or manual validation

## Advisory Restrictions

Advisory layers may:

- add warnings
- add review tasks
- add evidence gaps
- increase review burden
- recommend manual review
- summarize deterministic outputs

Advisory layers may not:

- reduce risk
- suppress warnings
- remove fatal risk
- change MAO
- change finance outputs
- change classifications
- bypass governance gates
- imply approval

## Orchestration Governance Rules

The orchestrator may:

- sequence workflow
- generate tasks
- route review
- expose advisory state

The orchestrator may not:

- alter deterministic governance
- modify classifications
- bypass decision gates
- suppress fatal risks
- turn advisory evidence into approval

## Evidence Governance Rules

Evidence may:

- influence confidence
- trigger review
- create advisory tasks
- surface gaps/conflicts

Evidence may not:

- directly alter deterministic classifications
- auto-approve deals
- hide missing data
- convert weak data into clean opportunity status

## UI Governance Rules

UI may:

- present deterministic and advisory outputs
- make warnings visible
- support manual review

UI may not:

- visually weaken governance outcomes
- show advisory output as final decision
- hide fatal/capital-protection states
- provide approve/send-offer CTAs from advisory output

## AI Authority Limitations

AI may:

- summarize
- extract candidate evidence
- assist review
- draft advisory commentary

AI may not:

- independently classify deals
- override governance
- alter capital protection
- bypass deterministic logic
- convert evidence into authoritative truth without review

## Current Architecture Alignment Audit

### Phase 3A-0 Orchestration

- aligned: deterministic snapshot remains source, no formula/classification override paths, capital_protection dominance preserved
- needs future guardrail: explicit type-level authority ownership tags per state field
- risk to monitor: future orchestration enhancements drifting from deterministic-first mapping order

### Phase 3A-1 Adapter Bridge

- aligned: adapter copies deterministic governance/classification/risk signals and remains non-mutating
- needs future guardrail: strict prohibition types for writing back into Phase 2 output objects
- risk to monitor: future convenience mappings that infer approval from non-authoritative signals

### Phase 3B-0 Evidence Contracts

- aligned: advisoryOnly evidence contract discipline, validation warnings for accepted/reserved source labels
- needs future guardrail: stronger type contracts separating evidence confidence from decision confidence
- risk to monitor: misinterpretation of accepted evidence as accepted deal

### Phase 3B-1 Evidence Hints

- aligned: hints are advisory only, no deterministic decision fields, reserved source paths force review
- needs future guardrail: deterministic route dominance contract when hint routes coexist
- risk to monitor: hint severity language being read as implicit deterministic approval

### Phase 3C-0 Merge Layer

- aligned: deterministic tasks preserved, capital_protection route priority explicit, merged output marked advisory
- needs future guardrail: immutable primary-route dominance contract and tests against upward authority flow
- risk to monitor: future merge UX normalization masking deterministic/advisory separation

### Phase 3D-0 Dev Review Surface

- aligned: fixture-only, non-linked internal route, deterministic source-of-truth copy shown above advisory output
- needs future guardrail: explicit UI type contract that blocks action CTAs and approval affordances
- risk to monitor: accidental promotion of developer surface patterns into client-facing runtime without authority guards

## Recommended Next Step

Recommended next step: **Phase 3A-2 Step 2 — Authority Governance Type Contracts Only**.

Step 2 should define type-level authority contracts and tests only, with no runtime enforcement yet.
