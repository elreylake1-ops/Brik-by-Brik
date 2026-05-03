# Deal Analyzer — 70% Rule Calculator

A clean, fast fix-and-flip deal analysis tool for property investors. Enter purchase price, GDV, and refurb cost — get instant results including max offer, profit, and a deal verdict.

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

All calculation logic lives in `lib/calculations.ts`. Components are stateless receivers — they do not compute anything. `page.tsx` holds state, calls `analyzeDeal()`, and passes results down as props. This keeps business logic independently testable and UI components simple.

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
