# Phase 5A-3 - Repository and Read-Model Mapping Scope Proposal Only

## 1. Purpose

This document proposes the Phase 5A-3 repository and read-model mapping scope for James review and approval only.

No Phase 5A-3 coding has started.
No runtime code, source code, type contracts, validation helpers, tests, API routes, UI, repository modules, migrations, config, or production data have been modified for this proposal.

## 2. Accepted Baseline

Phase 5A-2 accepted and closed at:

```text
3de38a2eda35f97ab13fda15e57238b86b76b581
```

Phase 5A-2G docs-only proof note included at current HEAD:

```text
e58f83ff5f2d820ae015a38e9b021342be616aa4
```

Confirmed baseline:

- Phase 4 tag remains untouched.
- `phase4-final-approved` peels to `5d13f0cfdf4484f9bfe5be4626ac554d0c74680e`.
- Phase 5A-3 coding is not yet authorised.
- Current proposal work is documentation-only.

## 3. Proposed Phase 5A-3 Scope

The proposed Phase 5A-3 scope should be limited to:

- repository/read-model mapping only
- read-focused Professional Evidence Gateway aggregation
- gate-to-source compatibility mapping
- no Investor Shield gate clearing
- no pipeline mutation
- no True MAO change
- no scoring change
- no UI work
- no API route work unless separately approved
- no migration unless separately approved

This scope should map existing evidence and governance state into a display/read model. It should not create a new authority layer.

## 4. Proposed Files for Later Implementation

The following files are proposed for later implementation only. They are not created or implemented by this scope proposal.

```text
lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts
lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility.ts
__tests__/professional-evidence-gateway-read-model.test.ts
__tests__/professional-evidence-gateway-source-compatibility.test.ts
docs/phase5/PHASE_5A_3_REPOSITORY_AND_READ_MODEL_MAPPING.md
```

These files should only be created after James approves Phase 5A-3 implementation.

## 5. Gate-to-Source Compatibility Proposal

Proposed compatibility matrix:

| Professional Gate Area | Qualifying Review Sources | Non-Qualifying Sources |
| --- | --- | --- |
| `SOLICITOR_REVIEW` | `SOLICITOR`, `LAND_REGISTRY` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `LEASEHOLD_ADVICE` | `SOLICITOR`, `LAND_REGISTRY` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `BROKER_LENDER_CONFIRMATION` | `BROKER`, `LENDER` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `BUILDER_QUOTE_CONFIRMATION` | `BUILDER`, `SURVEYOR` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `SURVEYOR_REPORT` | `SURVEYOR` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `SOLD_COMPARABLE_REVIEW` | `RIGHTMOVE_SOLD_DATA`, `SURVEYOR`, `SOLICITOR` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |

This compatibility matrix must be enforced before any professional confirmation can be surfaced in the read model.

## 6. Read-Model Mapping Proposal

The proposed read model should map existing `deal_evidence` records into:

- professional gate area
- review source
- gate status
- professional readiness
- final decision lock status
- linked Investor Shield gate
- linked Evidence Command record ids
- blocker/caution status
- recommended next action
- expiry/review date

The read model should be display/read focused only. It should aggregate existing evidence and gate context without writing to evidence, Investor Shield, pipeline, scoring, task, offer, or deal status records.

## 7. Confirmation Rules

Proposed confirmation rules:

- `CONFIRMED` requires explicit qualifying source.
- `PROFESSIONALLY_CONFIRMED` requires explicit qualifying source.
- Source must be compatible with the professional gate area.
- `OPERATOR_NOTE`, `AGENT`, and `OTHER` cannot create professional confirmation.
- Missing source cannot create professional confirmation.
- Incompatible source cannot create professional confirmation.
- Weak/operator-only evidence can remain visible as evidence, but not professional confirmation.

The read model should therefore distinguish visible evidence from professional confirmation.

## 8. Investor Shield Boundary

Investor Shield remains authoritative.

Phase 5A-3 read-model work must not:

- clear Investor Shield gates
- mutate progression
- override hard gates
- alter scoring
- alter formulas
- alter True MAO
- alter classification
- create an alternate gate authority

Professional Evidence Gateway output should support review visibility only.

## 9. Repository Boundary

The proposed repository/read-model work must:

- reuse existing `deal_evidence`
- avoid new tables
- avoid migrations
- avoid duplicate evidence ledger
- avoid duplicate gate namespace
- remain mocked/local-testable
- not access production

Existing Evidence Command records remain the canonical evidence surface for this proposed work.

## 10. Test Scope Proposal

Future Phase 5A-3 implementation should include tests for:

- gate-to-source compatibility
- incompatible source rejection
- missing source rejection for professional confirmation
- operator-only evidence remains non-confirming
- each gate preserves its own review source
- read model maps linked evidence ids
- read model does not mutate inputs
- read model does not import API/UI/database/production modules
- Investor Shield no-mutation regression
- Phase 4 tag untouched documentation

These tests should be added only after implementation approval.

## 11. Explicit Non-Scope

This Phase 5A-3 proposal does not include:

- UI
- API route changes
- repository persistence writes
- migrations
- deployment work
- production access
- Phase 5B
- Market History
- Deal Formulation Engine
- scoring changes
- True MAO changes
- Investor Shield authority changes
- gate-clearing logic
- pipeline mutation
- AI/OCR/scraping/CRM/uploads/PDF generation

## 12. Proposed Acceptance Criteria

Phase 5A-3 should only be accepted later if:

- read model remains read-only
- gate-to-source compatibility is enforced
- professional confirmation cannot be operator-only
- no runtime mutation occurs
- no API/UI/migration/deployment occurs unless separately approved
- lint/build/full tests pass
- Phase 4 tag remains untouched
- Phase 5B remains untouched

## 13. Message to James

James, Phase 5A-2 is fully accepted and closed. Please review and approve the proposed Phase 5A-3 scope before any coding starts. The proposed next step is limited to repository/read-model mapping only: read-focused Professional Evidence Gateway aggregation, gate-to-source compatibility enforcement, and read-only mapping from existing `deal_evidence` into Professional Evidence Gateway display state. It excludes UI, API route changes unless separately approved, migrations, production access, Phase 5B, Market History, scoring, True MAO, Investor Shield authority changes, gate clearing, and pipeline mutation.

## 14. Result

PHASE 5A-3 REPOSITORY AND READ-MODEL MAPPING SCOPE PROPOSAL COMPLETE — READY FOR JAMES REVIEW BEFORE CODING
