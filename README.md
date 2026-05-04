# Brik Engine v1 — Phase 1 Deal Analysis Calculator

Built for Lake Views Property. Phase 1 of the Brik Engine calculation engine — a web-based tool for analysing fix-and-flip property deals with full finance cost modelling and True MAO at multiple profit targets.

---

## Overview

This project was built as a paid MVP test task to demonstrate:
- Clean code structure and separation of business logic from UI
- Exact SOP formula implementation (Brik Engine v1 Phase 1)
- Clear and professional documentation
- A working, deployable Next.js calculator

The focus is on correctness, simplicity, and extensibility. All formulas are implemented exactly as specified in the SOP — no reinterpretation.

---

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Deployed on [Vercel](https://vercel.com/)

---

## Inputs

| Field | Description |
|---|---|
| Purchase Price (£) | Agreed purchase price of the property |
| GDV (£) | Gross Development Value — estimated post-refurb value |
| Refurb Cost (£) | Total cost to renovate the property |
| Stamp Duty (£) | Stamp Duty Land Tax payable on purchase |
| Legal Costs (£) | Solicitor and conveyancing fees |
| Sale Costs (£) | Agent fees and costs incurred on sale |
| Bridge Term (months) | Duration of bridging loan used for finance cost calculation |

---

## Outputs

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

---

## Formulas (exact SOP — Brik Engine v1 Phase 1)

### Finance Cost

```
Interest         = Purchase Price × 0.15 × (Bridge Term ÷ 12)
Arrangement Fee  = Purchase Price × 0.02
Exit Fee         = Purchase Price × 0.01
Total Finance    = Interest + Arrangement Fee + Exit Fee
```

### Total Project Cost

```
Total Cost = Purchase Price + Refurb Cost + Stamp Duty + Legal Costs + Finance Cost + Sale Costs
```

### Profit & Margin

```
Profit         = GDV − Total Cost
Profit Margin  = (Profit ÷ GDV) × 100
```

### True MAO

```
Desired Profit  = GDV × Desired Profit Rate  (0.15 / 0.20 / 0.25)
True MAO        = GDV − Desired Profit − Refurb Cost − Stamp Duty − Legal Costs − Finance Cost − Sale Costs
```

> Note: Finance Cost in the True MAO formula is calculated from the entered Purchase Price, as specified in the SOP.

---

## Project Structure

```
app/
  page.tsx              # Main page — holds state, wires components
  layout.tsx            # Root layout and metadata
components/
  CalculatorForm.tsx    # Input form — no logic, emits values only
  ResultsDisplay.tsx    # Output display — no logic, renders props only
  Tooltip.tsx           # Reusable hover tooltip component
lib/
  calculations.ts       # All business logic — pure functions (SOP formulas)
  formatters.ts         # Currency and percentage formatting utilities
types/
  deal.ts               # Shared TypeScript types
```

### Logic Separation

All calculation logic lives in `lib/calculations.ts` as pure functions — no React imports, no side effects. Components are stateless receivers that only render what they receive as props.

**Data flow:**

1. User types into `CalculatorForm` → values flow up to `page.tsx` via `onChange`
2. `page.tsx` calls `analyzeDeal()` from `lib/calculations.ts` on every change
3. `analyzeDeal()` runs all SOP formulas and returns a `DealResult` object
4. `DealResult` is passed as props to `ResultsDisplay`, which renders the output

**What each function calculates:**

```ts
calculateFinanceCost(purchasePrice, bridgeTermMonths)  // Interest + Arrangement Fee + Exit Fee
calculateTotalCost(purchasePrice, refurbCost, stampDuty, legalCosts, financeCost, saleCosts)
calculateProfit(gdv, totalCost)                        // GDV - Total Cost
calculateProfitMargin(profit, gdv)                     // (Profit / GDV) × 100
calculateTrueMao(gdv, rate, refurbCost, ...)           // GDV - DesiredProfit - all costs
analyzeDeal(inputs)                                    // Runs all above, returns DealResult
```

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
3. Import the repo — select root directory
4. No environment variables required
5. Click **Deploy**

---

## Notes

- All formulas implemented exactly as specified in the Brik Engine v1 Phase 1 SOP.
- Finance Cost in the True MAO calculation uses the finance cost derived from the entered Purchase Price (per SOP).
- Currency formatted as GBP with comma separators and 2 decimal places (e.g. £166,200.00).
- Profit Margin formatted to 2 decimal places (e.g. 16.90%).
- For guidance only. Not financial advice.
- Phase 2 will add PDF export. The calculation layer is already structured to support this.

---

## Summary

Brik Engine v1 Phase 1 implements a clean, extensible deal analysis engine with full finance cost modelling, profit margin calculation, and True MAO at three profit targets.

The codebase is structured so that Phase 2 additions (PDF export, saved deals, additional fee types) require changes only to `lib/calculations.ts` and `types/deal.ts` — UI components do not need to change.
