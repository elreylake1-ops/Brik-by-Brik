# Phase 2 Screenshot Guide

Place validated client-review screenshots in this folder.

Route separation:

- `/`: live calculator walkthrough screenshots.
- `/phase-2-live-review`: official live-behavior proof screenshots for the locked 15 validation fixtures.
- `/phase-2-review`: saved validation-report screenshots.

Normal calculator screenshots must not be treated as proof for hidden governance and evidence scenarios because the current calculator form does not expose all Phase 2 governance inputs.

## Live Calculator Walkthrough Screenshots

- `01-calculator-strong-profitable-deal.png`: Strong profitable deal — The calculator shows a clean GO / Proceed decision where purchase price, generated refurb cost, fees, finance, and GDV produce a strong profit margin and safe capital protection.
- `02-calculator-marginal-renegotiate-deal.png`: Marginal renegotiate deal — The calculator shows a positive-profit but thin-margin deal being classified as MARGINAL / Renegotiate, proving that weak profit buffers are not presented as strong opportunities and require price negotiation or assumption validation before proceeding.
- `03-calculator-no-go-negative-profit-deal.png`: No-go negative-profit deal — The calculator shows a loss-making deal being classified as NO-GO / Reject, proving that negative profit, capital overexposure, and downside risk are blocked from proceeding.
- `04-calculator-downside-sensitive-deal.png`: Downside-sensitive deal — The calculator shows a profitable deal that still requires caution because capital exposure and downside sensitivity can weaken the investment case, proving that the app does not rely on headline profit alone.
- `05-calculator-heavy-refurb-exposure.png`: Heavy refurb exposure — The calculator shows that a larger, more complex refurbishment increases cost, timeline, and execution risk, proving that the app does not treat heavy capex projects as clean deals without caution or scope validation.
- `06-calculator-high-finance-long-bridge-term.png`: High finance / long bridge term — The calculator shows how a longer bridge period increases finance cost and reduces profitability, proving that the app accounts for time and funding drag instead of relying only on purchase price and GDV.
- `07-calculator-zero-refurb-edge-case.png`: Zero refurb edge case — The calculator handles a £0 refurb input without crashing or producing invalid values, proving that edge-case inputs still return a complete investment analysis with profit, margin, capital protection, and decision output.
- `08-calculator-unsupported-scope-warning.png`: Unsupported scope warning — The calculator shows that when a selected refurb scope has no cost template, the deal is downgraded to CONDITIONAL / Verify Scope, proving that uncosted assumptions cannot appear as a clean proceed decision.
- `09-calculator-capital-exposure-caution.png`: Capital exposure caution — The calculator shows a profitable deal being marked CONDITIONAL / Proceed With Caution because capital exposure remains above the preferred safe threshold, proving that the app protects investor capital even when projected profit is positive.
- `10-calculator-high-purchase-mao-fail.png`: High purchase / MAO fail — The calculator shows that when the purchase price is too high against the MAO targets, the deal is no longer treated as safe, proving that the app protects investors from overpaying even when the GDV appears attractive.
- `11-calculator-large-kitchen-cost-impact.png`: Large kitchen cost impact — The calculator shows that a larger kitchen increases the generated refurb cost and reduces projected profit, proving that the refurb engine scales costs based on scope and room size rather than using one flat assumption.
- `12-calculator-two-bathroom-scaling.png`: Two-bathroom scaling — The calculator shows that adding a second bathroom increases generated refurb cost and reduces projected profit, proving that the refurb engine scales costs by room count rather than using a fixed one-size estimate.
- `13-calculator-flooring-area-scaling.png`: Flooring area scaling — The calculator shows that increasing floor area increases whole-property flooring cost and reduces projected profit, proving that the refurb engine scales area-based work instead of using one flat flooring assumption.
- `14-calculator-major-works-impact.png`: Major works impact — The calculator shows that selecting full rewire, boiler replacement, and roof works increases generated refurb cost, trade exposure, and project risk, proving that major capex items are reflected in the investment decision.
- `15-calculator-missing-scope-completeness-guard.png`: Missing scope completeness guard — The calculator prevents selected-but-uncosted refurb scope from appearing as a clean deal, proving that incomplete cost assumptions are flagged before an investor relies on the projected profit.

## Locked Validation Runner Screenshots

- Capture these from `/phase-2-live-review`.
- Use them for official proof of hidden governance, evidence, and locked-fixture validation behavior.
- The saved static reference view remains `/phase-2-review`.

Use this folder only for review images intended to support the Phase 2 client walkthrough and the locked validation runner package.
