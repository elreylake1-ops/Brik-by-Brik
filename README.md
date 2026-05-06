# Brik Engine v1 - Deal Analysis & Refurb Scope Engine

Built for Lake Views Property. Brik Engine v1 is a UK fix-and-flip analysis tool that combines core deal math with manual refurb input, task-based refurb scope analysis, configurable cost data, override/assumptions reporting, verdict/confidence outputs, and visible Phase 1C due diligence output.

---

## Overview

The current product supports:

- core fix-and-flip deal analysis
- manual refurb mode using an entered refurb cost
- task-based refurb scope mode using room/scope selections
- configurable labour, material, and task-cost data
- override and assumptions reporting for auditability
- engine-driven verdict and confidence outputs
- visible Phase 1C deep due diligence output in the analysis panel

The focus remains correctness, auditability, and separation of business logic from UI.

---

## Current Status

| Area | Status |
|---|---|
| Phase 1 Core Deal Calculator | Complete |
| Phase 1A Builder Scope Engine | Complete |
| Phase 1B Cost Data + Overrides | Complete |
| Post-Phase 1B Demo Hardening | Complete |
| Phase 1C Due Diligence | In Progress - engine attached and visible in analysis panel |
| Phase 2 | Not Started |

---

## Tech Stack

- [Next.js 16](https://nextjs.org/) (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Deployed on [Vercel](https://vercel.com/)

---

## Inputs

### Core Deal Inputs

| Field | Description |
|---|---|
| Purchase Price (GBP) | Agreed purchase price of the property |
| GDV (GBP) | Gross Development Value, estimated post-refurb value |
| Stamp Duty (GBP) | Stamp Duty Land Tax payable on purchase |
| Legal Costs (GBP) | Solicitor and conveyancing fees |
| Sale Costs (GBP) | Agent fees and costs incurred on sale |
| Bridge Term (months) | Duration of bridging loan used for finance cost calculation |

### Manual Refurb Mode

| Field | Description |
|---|---|
| Refurb Cost (GBP) | Manual refurb estimate used directly in deal analysis when scope mode is off |

### Task-Based Refurb Scope Mode

| Field Group | Description |
|---|---|
| Bedrooms / Bathrooms | Room-count scaling inputs |
| Floor Area (sqm) | Used for whole-property flooring calculations when provided |
| Kitchen Scope + Size | Kitchen task generation inputs |
| Bathroom Scope | Bathroom task generation input |
| Bedroom Scope | Bedroom task generation input |
| Flooring Toggle | Whole-property flooring replacement toggle |
| Major Works | Rewire, boiler, and roof toggles |

---

## Outputs

### Core Deal Outputs

| Output | Description |
|---|---|
| Interest | Bridging loan interest charge |
| Arrangement Fee | Lender arrangement fee |
| Exit Fee | Lender exit fee |
| Total Finance Cost | Sum of all finance charges |
| Total Cost | All-in project cost |
| Profit | GDV minus Total Cost |
| Profit Margin | Profit as a percentage of GDV |
| True MAO at 15% | Max offer price to achieve 15% profit on GDV |
| True MAO at 20% | Max offer price to achieve 20% profit on GDV |
| True MAO at 25% | Max offer price to achieve 25% profit on GDV |
| Verdict | Engine output: GO / CONDITIONAL / NO-GO / ANALYSIS ONLY |
| Confidence | Engine output summarizing warning level, overrides, and input completeness |

### Refurb Scope Outputs

| Output | Description |
|---|---|
| Generated Refurb Cost | Task-based refurb total used in scope mode |
| Labour Cost | Labour subtotal from generated tasks |
| Material Cost | Material subtotal from generated tasks |
| Room Breakdown | Cost breakdown by room |
| Trade Breakdown | Cost breakdown by trade |
| Task List | Generated tasks with quantity and cost |
| Timeline | Working days, contingency-adjusted days, and estimated weeks |
| Warnings | Visible low-confidence or verification flags |
| Assumptions Report | Audit trail of assumptions and override effects |
| Overrides Applied | Audit entries for manual override usage |

### Due Diligence Outputs

| Output | Description |
|---|---|
| GDV Range | Downside, realistic, and strong GDV views |
| Profit Scenarios | Downside, realistic, and strong profit outputs |
| Capital Protection | Capital used percentage and risk status |
| Deal Classification | Strong Deal / Marginal / No Deal |
| Recommended Strategy | BRRR or Flip / Flip Only or Renegotiate / No Deal |
| Risk Flags | Client-readable caution flags |
| Due Diligence True MAO | Phase 1C MAO targets based on realistic GDV |

---

## Formulas (Current MVP Core Deal Engine)

### Finance Cost

```text
Interest         = Purchase Price x 0.15 x (Bridge Term / 12)
Arrangement Fee  = Purchase Price x 0.02
Exit Fee         = Purchase Price x 0.01
Total Finance    = Interest + Arrangement Fee + Exit Fee
```

### Total Project Cost

```text
Total Cost = Purchase Price + Refurb Cost + Stamp Duty + Legal Costs + Finance Cost + Sale Costs
```

### Profit and Margin

```text
Profit         = GDV - Total Cost
Profit Margin  = (Profit / GDV) x 100
```

### True MAO

```text
Desired Profit  = GDV x Desired Profit Rate  (0.15 / 0.20 / 0.25)
True MAO        = GDV - Desired Profit - Refurb Cost - Stamp Duty - Legal Costs - Finance Cost - Sale Costs
```

> Note: Finance Cost in the True MAO formula is calculated from the entered Purchase Price, as specified in the SOP.

### Current Finance Model

Finance cost is currently derived from the entered Purchase Price. This is intentional MVP behavior and matches the current implemented app and engine behavior.

LTV-based finance is not implemented.

Do not add loan-to-value or LTV-based finance without explicit approval as a separate spec/model change.

Any future LTV switch must include updated inputs, formulas, tests, and UI copy.

---

## Sample Deal Validation

Use these values to verify the calculator is working correctly:

| Input | Value |
|---|---|
| Purchase Price | £120,000 |
| GDV | £200,000 |
| Refurb Cost | £25,000 |
| Stamp Duty | £3,600 |
| Legal Costs | £2,000 |
| Sale Costs | £3,000 |
| Bridge Term | 6 months |

**Expected outputs:**

| Output | Expected |
|---|---|
| Interest | £9,000.00 |
| Arrangement Fee | £2,400.00 |
| Exit Fee | £1,200.00 |
| Total Finance Cost | £12,600.00 |
| Total Cost | £166,200.00 |
| Profit | +£33,800.00 |
| Profit Margin | 16.90% |
| True MAO at 15% | £123,800.00 |
| True MAO at 20% | £113,800.00 |
| True MAO at 25% | £103,800.00 |

---

## Project Structure

```text
app/
  page.tsx
  layout.tsx
components/
  CalculatorForm.tsx
  EngineAnalysisPanel.tsx
  RefurbBreakdownSummary.tsx
  RefurbScopeForm.tsx
  ResultsDisplay.tsx
  Tooltip.tsx
lib/
  calculations.ts
  formatters.ts
  data/
    trade-rates.ts
    material-baselines.ts
    task-cost-library.ts
  engine/
    analyze-deal-with-refurb.ts
    apply-overrides.ts
    due-diligence-engine.ts
    refurb-cost-engine.ts
    scope-to-tasks.ts
    timeline-engine.ts
types/
  deal.ts
  due-diligence.ts
  overrides.ts
  refurb.ts
  scope.ts
__tests__/
  *.test.ts
```

---

## Logic Separation

- Core formulas live in `lib/calculations.ts`.
- Orchestration lives in `lib/engine/analyze-deal-with-refurb.ts`.
- Configurable assumptions and cost data live in `lib/data/`.
- React components remain render-focused and consume engine output.

---

## Explicitly Out of Scope

The following remain out of scope in the current product:

- PDF export
- Saved deals
- CRM
- AI
- Live scraping
- Dashboard expansion

---

## Run Locally

```bash
git clone <repo-url>
cd lakeviewsproperty
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo and select the root directory
4. No environment variables are required
5. Click **Deploy**

---

## Testing

Run the current validation steps with:

```bash
npm run test
npm run build
```

---

## Notes

- Core deal formulas remain implemented exactly as specified in the current Brik Engine v1 Phase 1 SOP.
- Manual refurb mode and task-based refurb mode intentionally coexist.
- Downside and strong GDV are currently auto-generated in the visible Phase 1C due diligence output.
- For guidance only. Not financial advice.
