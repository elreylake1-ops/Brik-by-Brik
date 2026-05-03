# Deal Analyzer — 70% Rule Calculator

A clean, fast fix-and-flip deal analysis tool for property investors. Enter purchase price, GDV, and refurb cost — get instant results including max offer, profit, and a deal verdict.

---

## Overview

This project was built as a small test task to demonstrate:
- Clean code structure
- Separation of business logic from UI
- Clear and professional documentation
- A working web-based calculator using Next.js

The focus is on simplicity, correctness, and extensibility rather than feature complexity.

---

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router)
- TypeScript (strict mode)
- Tailwind CSS
- Deployed on [Vercel](https://vercel.com/)

---

## Features

- Real-time calculations — updates on every keystroke
- 70% Rule max offer calculation
- Profit display (green/red based on value)
- DEAL / NO DEAL verdict badge
- Mobile-first, responsive layout
- GBP (£) currency formatting

---

## Formulas

```
Total Cost  = Purchase Price + Refurb Cost

Profit      = GDV - Total Cost

Max Offer   = (0.7 × GDV) - Refurb Cost
```

**Deal Verdict:**
- `Purchase Price ≤ Max Offer` → DEAL
- `Purchase Price > Max Offer` → NO DEAL

---

## Project Structure

```
app/
  page.tsx              # Main page — holds state, wires components
  layout.tsx            # Root layout and metadata
components/
  CalculatorForm.tsx    # Input form — no logic, emits values only
  ResultsDisplay.tsx    # Output display — no logic, renders props only
lib/
  calculations.ts       # All business logic — pure functions
  formatters.ts         # Currency formatting utility
types/
  deal.ts               # Shared TypeScript types (DealInputs, DealResult)
```

### Logic Separation

All calculation logic lives in `lib/calculations.ts` as pure functions — no React imports, no side effects. Components are stateless receivers that only render what they receive as props.

**How it works:**

1. User types into `CalculatorForm` → values flow up to `page.tsx` via `onChange`
2. `page.tsx` passes the three numbers into `analyzeDeal()` from `lib/calculations.ts`
3. `analyzeDeal()` runs the formulas and returns a `DealResult` object
4. `DealResult` is passed as props to `ResultsDisplay`, which renders the output

**What each function calculates:**

```ts
calculateTotalCost(purchasePrice, refurbCost)  // purchasePrice + refurbCost
calculateProfit(gdv, totalCost)                // gdv - totalCost
calculateMaxOffer(gdv, refurbCost)             // (0.7 × gdv) - refurbCost
getDealVerdict(purchasePrice, maxOffer)        // purchasePrice ≤ maxOffer ? "DEAL" : "NO DEAL"
```

Adding new calculations means editing `calculations.ts` and `types/deal.ts` only — no UI component needs to change.

---

## Run Locally

```bash
git clone <repo-url>
cd deal-analyzer
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deploy to Vercel

1. Push repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. No environment variables required
5. Click **Deploy**

Vercel auto-detects Next.js. No configuration needed.

---

## Notes

- The 70% rule is a guide only, not financial advice.
- Currency is GBP (£). To switch currency, update `lib/formatters.ts` only.

---

## Summary

This implementation focuses on clarity, correctness, and clean architecture over complexity.

The codebase is structured to be easily extended into a more advanced deal analysis tool (e.g. adding fees, ROI, or financing calculations) without requiring changes to UI components.
