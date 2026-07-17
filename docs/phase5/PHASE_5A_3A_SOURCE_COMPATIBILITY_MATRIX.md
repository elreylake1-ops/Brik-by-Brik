# Phase 5A-3A - Source Compatibility Matrix

## Purpose

Phase 5A-3A adds the Professional Evidence Gateway source compatibility matrix only. It defines which review sources can qualify each professional gate area before later read-model mapping work.

This step does not add read-model mapping, repository aggregation, repository persistence, repository writes, database access, API routes, UI, migrations, config changes, production access, Investor Shield authority changes, gate-clearing, pipeline mutation, True MAO changes, scoring changes, Phase 5B work, or Market History work.

## Feature Branch

```text
phase5a-3-professional-gateway-read-model
```

## Files Changed

```text
lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility.ts
__tests__/professional-evidence-gateway-source-compatibility.test.ts
docs/phase5/PHASE_5A_3A_SOURCE_COMPATIBILITY_MATRIX.md
```

## Compatibility Matrix

| Professional Gate Area | Qualifying Sources | Non-Qualifying Sources |
| --- | --- | --- |
| `SOLICITOR_REVIEW` | `SOLICITOR`, `LAND_REGISTRY` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `LEASEHOLD_ADVICE` | `SOLICITOR`, `LAND_REGISTRY` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `BROKER_LENDER_CONFIRMATION` | `BROKER`, `LENDER` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `BUILDER_QUOTE_CONFIRMATION` | `BUILDER`, `SURVEYOR` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `SURVEYOR_REPORT` | `SURVEYOR` | `OPERATOR_NOTE`, `AGENT`, `OTHER` |
| `SOLD_COMPARABLE_REVIEW` | `SURVEYOR`, `SOLICITOR`, `LAND_REGISTRY` | `RIGHTMOVE_SOLD_DATA`, `OPERATOR_NOTE`, `AGENT`, `OTHER` |

`OPERATOR_NOTE`, `AGENT`, and `OTHER` never confirm professional evidence.
`RIGHTMOVE_SOLD_DATA` remains known visible portal evidence, but it does not confirm `SOLD_COMPARABLE_REVIEW` unless reviewed or validated by a qualifying professional or approved source.

## Helper Functions Added

```text
isProfessionalEvidenceReviewSourceQualifyingForGate(area, source)
getQualifyingReviewSourcesForGate(area)
getNonQualifyingReviewSourcesForGate(area)
assertProfessionalGateSourceCompatibility(area, source)
```

The helpers are pure functions. They do not call databases, APIs, UI modules, production config, repositories, or persistence layers.

## Tests Added

```text
__tests__/professional-evidence-gateway-source-compatibility.test.ts
```

Coverage includes:

- each allowed gate/source pairing
- every gate rejecting `OPERATOR_NOTE`
- every gate rejecting `AGENT`
- every gate rejecting `OTHER`
- incompatible but valid source rejection
- missing and unknown source rejection
- `SOLICITOR_REVIEW` canonical behavior
- `SOLICITOR_FEEDBACK` rejection
- compatibility module import-boundary regression

## Validation Proof

```text
npx vitest run __tests__/professional-evidence-gateway-source-compatibility.test.ts
PASS - Test Files 1 passed (1), Tests 25 passed (25)

npm run lint
PASS - eslint completed without errors

npm run build
PASS - next build completed successfully

npm test -- --testTimeout 60000
PASS - Test Files 118 passed (118), Tests 1194 passed (1194)
```

## Confirmations

No merge occurred.
No deployment occurred.
No production access occurred.
No API changes occurred.
No UI changes occurred.
No migration changes occurred.
No config changes occurred.
No repository persistence, repository write, or database access changes occurred.
No Investor Shield authority change occurred.
No gate-clearing occurred.
No pipeline mutation occurred.
No True MAO change occurred.
No scoring change occurred.
No Phase 5B work occurred.
No Market History work occurred.

## Result

PHASE 5A-3A SOURCE COMPATIBILITY MATRIX COMPLETE ON FEATURE BRANCH — READY FOR 5A-3B READ-MODEL MAPPING
