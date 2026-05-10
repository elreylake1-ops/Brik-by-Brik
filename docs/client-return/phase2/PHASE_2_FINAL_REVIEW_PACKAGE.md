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

## Supporting Review Documents

- [Actual Outputs for All 15 Tested Scenarios](./PHASE_2_SCENARIO_ACTUAL_OUTPUTS.md)
- [Phase 2 Manual Review Checklist](./PHASE_2_MANUAL_REVIEW_CHECKLIST.md)
- Saved validation-report viewer: `/phase-2-review`
- Live engine execution route for official scenario screenshots: `/phase-2-live-review`
- Live calculator route for manual walkthrough screenshots: `/`

`/phase-2-review` displays saved validation report outputs from `docs/validation/phase2-stress-test-results.json`.

`/phase-2-live-review` executes the actual deterministic Phase 2 engine against the locked 15 fixtures at runtime and is the official screenshot route for live-behavior proof.

`/` is the live calculator used for manual walkthrough screenshots of normal calculator behavior such as profit, refurb scope scaling, finance drag, capital exposure caution, and completeness-guard handling.

The normal calculator must not be described as proof for hidden governance or evidence scenarios that depend on fields not exposed in the calculator form.

## Route Map

- `/`: live calculator for manual walkthrough screenshots and normal deal analysis.
- `/phase-2-live-review`: live Phase 2 engine runner for the locked 15 validation fixtures.
- `/phase-2-review`: static saved validation report viewer.
- `docs/validation/phase2-stress-test-results.json`: machine-readable validation output artifact.

## Live Calculator Walkthrough Screenshots

These screenshots were manually validated from the deployed calculator route at `/`. They evidence calculator behavior only, not hidden governance scenarios that require the locked fixture runner.

| Screenshot | Description |
| --- | --- |
| `01-calculator-strong-profitable-deal.png` | Strong profitable deal — The calculator shows a clean GO / Proceed decision where purchase price, generated refurb cost, fees, finance, and GDV produce a strong profit margin and safe capital protection. |
| `02-calculator-marginal-renegotiate-deal.png` | Marginal renegotiate deal — The calculator shows a positive-profit but thin-margin deal being classified as MARGINAL / Renegotiate, proving that weak profit buffers are not presented as strong opportunities and require price negotiation or assumption validation before proceeding. |
| `03-calculator-no-go-negative-profit-deal.png` | No-go negative-profit deal — The calculator shows a loss-making deal being classified as NO-GO / Reject, proving that negative profit, capital overexposure, and downside risk are blocked from proceeding. |
| `04-calculator-downside-sensitive-deal.png` | Downside-sensitive deal — The calculator shows a profitable deal that still requires caution because capital exposure and downside sensitivity can weaken the investment case, proving that the app does not rely on headline profit alone. |
| `05-calculator-heavy-refurb-exposure.png` | Heavy refurb exposure — The calculator shows that a larger, more complex refurbishment increases cost, timeline, and execution risk, proving that the app does not treat heavy capex projects as clean deals without caution or scope validation. |
| `06-calculator-high-finance-long-bridge-term.png` | High finance / long bridge term — The calculator shows how a longer bridge period increases finance cost and reduces profitability, proving that the app accounts for time and funding drag instead of relying only on purchase price and GDV. |
| `07-calculator-zero-refurb-edge-case.png` | Zero refurb edge case — The calculator handles a £0 refurb input without crashing or producing invalid values, proving that edge-case inputs still return a complete investment analysis with profit, margin, capital protection, and decision output. |
| `08-calculator-unsupported-scope-warning.png` | Unsupported scope warning — The calculator shows that when a selected refurb scope has no cost template, the deal is downgraded to CONDITIONAL / Verify Scope, proving that uncosted assumptions cannot appear as a clean proceed decision. |
| `09-calculator-capital-exposure-caution.png` | Capital exposure caution — The calculator shows a profitable deal being marked CONDITIONAL / Proceed With Caution because capital exposure remains above the preferred safe threshold, proving that the app protects investor capital even when projected profit is positive. |
| `10-calculator-high-purchase-mao-fail.png` | High purchase / MAO fail — The calculator shows that when the purchase price is too high against the MAO targets, the deal is no longer treated as safe, proving that the app protects investors from overpaying even when the GDV appears attractive. |
| `11-calculator-large-kitchen-cost-impact.png` | Large kitchen cost impact — The calculator shows that a larger kitchen increases the generated refurb cost and reduces projected profit, proving that the refurb engine scales costs based on scope and room size rather than using one flat assumption. |
| `12-calculator-two-bathroom-scaling.png` | Two-bathroom scaling — The calculator shows that adding a second bathroom increases generated refurb cost and reduces projected profit, proving that the refurb engine scales costs by room count rather than using a fixed one-size estimate. |
| `13-calculator-flooring-area-scaling.png` | Flooring area scaling — The calculator shows that increasing floor area increases whole-property flooring cost and reduces projected profit, proving that the refurb engine scales area-based work instead of using one flat flooring assumption. |
| `14-calculator-major-works-impact.png` | Major works impact — The calculator shows that selecting full rewire, boiler replacement, and roof works increases generated refurb cost, trade exposure, and project risk, proving that major capex items are reflected in the investment decision. |
| `15-calculator-missing-scope-completeness-guard.png` | Missing scope completeness guard — The calculator prevents selected-but-uncosted refurb scope from appearing as a clean deal, proving that incomplete cost assumptions are flagged before an investor relies on the projected profit. |

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

Official 15-scenario proof screenshots should be captured from `/phase-2-live-review` because it executes the actual Phase 2 engine against the locked fixtures at runtime.

`/phase-2-review` remains useful as the saved validation-report viewer for documentation and package review.

Normal calculator screenshots may still be used for visual examples of manual deal-calculator behavior, but they should not be treated as proof for governance scenarios that require evidence and risk fields not exposed in the basic calculator form.

| Screenshot Slot | Placeholder Path | Input Summary | Expected Decision | What the Screen Proves |
| --- | --- | --- | --- | --- |
| Strong clean deal | `docs/client-return/phase2/screenshots/01-strong-clean-deal.png` | Purchase `110000`, GDV `200000`, refurb `20000`, strong evidence, 5 comparables. | `PASS / HOT` | Clean baseline scenario can progress without governance friction. |
| Marginal / renegotiate thin-margin deal | `docs/client-return/phase2/screenshots/02-marginal-thin-margin.png` | Purchase `125000`, GDV `200000`, refurb `20000`, moderate evidence. | `PASS / MARGINAL` | Thin margin is shown as cautionary rather than strong. |
| No-go / negative-profit deal | `docs/client-return/phase2/screenshots/03-no-deal.png` | Purchase `190000`, GDV `200000`, stamp duty `0`, legal `0`, sale `0`, bridge term `0`, generated standard refurb with 2 beds, 1 bath, 80 sqm, full kitchen, full bathroom, bedroom cosmetic refresh, whole-property flooring, rewire on. | `NO-GO / Reject` | Proves capital protection rejects a true loss-making deal and blocks negative profit with capital overexposure. |
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
