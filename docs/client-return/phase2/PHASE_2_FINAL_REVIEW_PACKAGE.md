# Phase 2 Final Review Package

## Executive Summary

Brik Engine Phase 2 is validated for client review.

- Phase 2 validated against the locked deterministic stress suite.
- 15/15 stress scenarios passed.
- Deterministic behavior confirmed across repeated runs.
- Governance override confirmed above raw scoring.
- Dangerous deals were either blocked or escalated for review.
- Phase 3 remains blocked pending client acceptance of this package.

## Deployment Link

- App for manual review: https://lakeviewsproperty.vercel.app/

## Full Scenario List

1. Strong BRRR candidate
2. Marginal deal
3. No deal
4. Downside loss
5. Weak GDV evidence
6. Heavy refurb exposure
7. High finance cost
8. False HOT deal
9. Structural / fatal risk
10. Missing evidence / manual review
11. Missing comparables
12. Unrealistic GDV
13. Long bridge term
14. Zero refurb edge case
15. High leverage scenario

## Expected vs Actual Matrix

| Scenario | Expected Governance / Final | Actual Governance / Final | Actual Raw Heat | Result | Notes |
| --- | --- | --- | --- | --- | --- |
| Strong BRRR candidate | PASS / HOT_OR_WARM | PASS / HOT | 100 / HOT | PASS | Clean baseline pass case. |
| Marginal deal | PASS / MARGINAL | PASS / MARGINAL | 64 / MARGINAL | PASS | Thin margin stays cautionary, not inflated. |
| No deal | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | 30 / COLD | PASS | Negative realistic profit and fatal downside loss. |
| Downside loss | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 68 / WARM | PASS | Investable headline case escalated because downside turns loss-making. |
| Weak GDV evidence | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 77 / WARM | PASS | Raw opportunity held for stronger valuation evidence. |
| Heavy refurb exposure | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 68 / WARM | PASS | Scope and capex pressure surfaced for review. |
| High finance cost | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 79 / WARM | PASS | Finance drag prevents clean progression. |
| False HOT deal | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 79 / WARM | PASS | Urgency claim does not bypass governance. |
| Structural / fatal risk | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | 95 / HOT | PASS | Strong raw economics still blocked by fatal risk. |
| Missing evidence / manual review | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 64 / MARGINAL | PASS | Missing evidence pauses progression. |
| Missing comparables | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 64 / MARGINAL | PASS | No comparable support means no clean offer progression. |
| Unrealistic GDV | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | 64 / MARGINAL | PASS | Stretched valuation assumption is blocked. |
| Long bridge term | REVIEW_REQUIRED / REVIEW_REQUIRED | REVIEW_REQUIRED / REVIEW_REQUIRED | 78 / WARM | PASS | Time and finance drag escalated for review. |
| Zero refurb edge case | PASS / HOT_OR_WARM | PASS / HOT | 100 / HOT | PASS | Zero-refurb case remains deterministic and safe. |
| High leverage scenario | BLOCKED / NO_DEAL | BLOCKED / NO_DEAL | 26 / COLD | PASS | Capital protection blocks aggressive leverage. |

## Dangerous-Deal Walkthrough

### No Deal

- Why it is dangerous: The fixture is loss-making and fails capital protection.
- Expected behavior: Automatic block and reject outcome.
- Actual behavior: `BLOCKED / NO_DEAL` with raw heat `30 / COLD`.
- Governance result: Fatal risk confirmed with capital-protection and downside-loss failure.
- Investor safety explanation: The engine prevents progression when realistic profit is negative and downside loss is unacceptable.

### Downside Loss

- Why it is dangerous: The realistic case may look workable, but the downside GDV turns the deal loss-making.
- Expected behavior: Escalate to manual review and force GDV verification.
- Actual behavior: `REVIEW_REQUIRED / REVIEW_REQUIRED` with raw heat `68 / WARM`.
- Governance result: Downside-loss logic holds the deal for review before any offer step.
- Investor safety explanation: This protects against accepting a deal that only works under optimistic valuation assumptions.

### False HOT Deal

- Why it is dangerous: Seller urgency or source pressure can create a false impression of opportunity.
- Expected behavior: Urgency claim should not create a clean HOT or proceed outcome.
- Actual behavior: `REVIEW_REQUIRED / REVIEW_REQUIRED` with raw heat `79 / WARM`.
- Governance result: Review required; next action slows urgency pressure instead of rewarding it.
- Investor safety explanation: The engine forces underwriting discipline and prevents rush decisions based on unsupported urgency.

### Structural / Fatal Risk

- Why it is dangerous: A fatal structural issue can invalidate the entire deal even when the numbers appear strong.
- Expected behavior: Hard block regardless of raw score.
- Actual behavior: `BLOCKED / NO_DEAL` with raw heat `95 / HOT`.
- Governance result: Fatal governance override applied.
- Investor safety explanation: Capital protection stays above headline deal attractiveness when structural failure risk is present.

### Unrealistic GDV

- Why it is dangerous: An overstretched GDV can make a weak deal look acceptable on paper.
- Expected behavior: Block progression and force valuation challenge.
- Actual behavior: `BLOCKED / NO_DEAL` with raw heat `64 / MARGINAL`.
- Governance result: Fatal governance block triggered by unrealistic GDV assumption.
- Investor safety explanation: The engine rejects valuation optimism that is not supported by comparable evidence.

### High Leverage Scenario

- Why it is dangerous: Aggressive leverage magnifies downside exposure and can wipe out capital protection.
- Expected behavior: Automatic block and reject outcome.
- Actual behavior: `BLOCKED / NO_DEAL` with raw heat `26 / COLD`.
- Governance result: Fatal capital-protection block confirmed.
- Investor safety explanation: The engine prevents progression when leverage pushes the deal outside a safe operating range.

## Governance Override Examples

| Scenario | Raw Score / Raw Band | Governance State | Final Classification | Override Applied | Explanation |
| --- | --- | --- | --- | --- | --- |
| False HOT deal | 79 / WARM | REVIEW_REQUIRED | REVIEW_REQUIRED | Yes | Attractive-looking deal is held because urgency is unsupported by evidence quality and governance signals. |
| Structural / fatal risk | 95 / HOT | BLOCKED | NO_DEAL | Yes | Raw HOT score is invalidated by fatal structural risk. |

Governance remains the final authority. A strong raw score is informative, but it is never allowed to overrule capital-protection, evidence, or fatal-risk controls.

## JSON Output Samples

### Deal Heat Score

```json
{
  "score": 79,
  "band": "WARM",
  "positiveSignals": [
    "Healthy realistic profit margin.",
    "Comparable coverage is sufficient."
  ],
  "negativeSignals": [
    "Moderate GDV evidence."
  ],
  "explanation": "Raw heat score is deterministic and explainable, but governance remains final authority."
}
```

### Risk Radar

```json
{
  "overallRisk": "HIGH",
  "riskFlags": [
    {
      "code": "GDV_EVIDENCE_WEAK",
      "label": "Weak GDV evidence",
      "severity": "HIGH",
      "source": "gdv"
    },
    {
      "code": "COMPARABLES_THIN",
      "label": "Thin comparable coverage",
      "severity": "MEDIUM",
      "source": "comparables"
    }
  ],
  "fatalRisks": [],
  "reviewRisks": [
    "Weak GDV evidence",
    "Thin comparable coverage"
  ]
}
```

### Governance Layer

```json
{
  "state": "BLOCKED",
  "finalClassification": "NO_DEAL",
  "scoreBeforeGovernance": 95,
  "classificationBeforeGovernance": "HOT",
  "governanceOverrideApplied": true,
  "fatalRisk": true,
  "fatalReasons": [
    "Structural survey indicates fatal risk."
  ],
  "explanation": "Governance overrides scoring because a fatal blocker exists."
}
```

### Decision Gates

```json
[
  {
    "gateId": "capital-protection",
    "label": "Capital Protection Gate",
    "status": "FAIL",
    "severity": "FATAL"
  },
  {
    "gateId": "gdv-evidence",
    "label": "GDV Evidence Gate",
    "status": "REVIEW",
    "severity": "HIGH"
  }
]
```

### Investor Summary

```json
{
  "headline": "Raw HOT score blocked by governance.",
  "summary": "Raw opportunity signals exist, but final progression is blocked by governance controls and/or fatal risk.",
  "decision": "NO_DEAL",
  "recommendedNextStep": "Reject deal or clear fatal governance blocker before any offer step."
}
```

### Next Actions

```json
[
  {
    "id": "obtain-comparables",
    "priority": "HIGH",
    "action": "Obtain sold comparables to support GDV.",
    "owner": "analyst",
    "blocksOfferSubmission": true
  },
  {
    "id": "tighten-finance-assumptions",
    "priority": "HIGH",
    "action": "Tighten finance assumptions and bridge timeline before offer.",
    "owner": "broker",
    "blocksOfferSubmission": true
  }
]
```

## Screenshots / Walkthrough

Place screenshots in `docs/client-return/phase2/screenshots/`. If screenshots are not yet committed, use the placeholders below during client review.

| Screenshot Slot | Placeholder Path | Input Summary | Expected Decision | What the Screen Proves |
| --- | --- | --- | --- | --- |
| Strong clean deal | `docs/client-return/phase2/screenshots/01-strong-clean-deal.png` | Purchase `110000`, GDV `200000`, refurb `20000`, strong evidence, 5 comparables. | `PASS / HOT` | Clean baseline scenario can progress without governance friction. |
| Marginal / renegotiate thin-margin deal | `docs/client-return/phase2/screenshots/02-marginal-thin-margin.png` | Purchase `125000`, GDV `200000`, refurb `20000`, moderate evidence. | `PASS / MARGINAL` | Thin margin is shown as cautionary rather than strong. |
| No-go / negative-profit deal | `docs/client-return/phase2/screenshots/03-no-go-negative-profit.png` | Purchase `180000`, GDV `200000`, refurb `10000`, fatal downside loss. | `BLOCKED / NO_DEAL` | Capital protection blocks negative-profit progression. |
| Heavy refurb exposure | `docs/client-return/phase2/screenshots/04-heavy-refurb-exposure.png` | Purchase `100000`, GDV `185000`, refurb `35000`, low refurb confidence. | `REVIEW_REQUIRED` | High capex exposure is escalated for review. |
| Unsupported scope / verify-scope warning | `docs/client-return/phase2/screenshots/05-unsupported-scope-warning.png` | Heavy refurb or low-confidence scope with incomplete support. | `REVIEW_REQUIRED` | Scope validation warnings appear before clean progression. |
| Governance / dangerous-deal explanation if visible | `docs/client-return/phase2/screenshots/06-governance-dangerous-deal.png` | Structural fatal risk or false HOT review case. | `BLOCKED / NO_DEAL` or `REVIEW_REQUIRED` | Governance explanation is visible and clearly overrides raw appeal. |

Suggested walkthrough order:

1. Open the strong clean deal to confirm clean pass behavior.
2. Open the marginal deal to confirm thin-margin caution behavior.
3. Open the no-go scenario to confirm capital-protection blocking.
4. Open heavy refurb exposure to confirm review escalation.
5. Open a dangerous-deal governance case to confirm override messaging.

## Known Limitations Summary

- Manual comparable input only.
- No automated sold-price validation.
- No AI listing extraction.
- No live market integrations.
- Rules-based refurb assumptions.
- GDV confidence remains user-dependent.
- Legal and structural risks are user-indicated.
- No persistent analysis history.
- No automated lender validation.

## Phase 3 Readiness Statement

Phase 3 can begin only after client acceptance of this Phase 2 review package.

When Phase 3 is eventually approved, it must continue protecting:

- deterministic logic
- governance-first hierarchy
- explainable outputs
- modular architecture
- capital protection first
