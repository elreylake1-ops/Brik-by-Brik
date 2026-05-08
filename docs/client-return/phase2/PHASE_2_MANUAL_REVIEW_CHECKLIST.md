# Phase 2 Manual Review Checklist

This checklist is for client-side dangerous-deal review only. It is intended to confirm that the deployed app matches the validated Phase 2 governance behavior.

## No Deal

- Test objective: Confirm that a loss-making case fails capital protection and does not progress.
- Suggested app input values: Purchase `180000`, GDV `200000`, refurb `10000`, stamp duty `6000`, legal `2000`, sale `3000`, bridge term `6`, evidence `STRONG`, comparables `5`, structural risk `NONE`.
- Expected result: `BLOCKED / NO_DEAL`.
- What to verify manually: Negative-profit or fatal-risk messaging is visible; the app does not present a proceed outcome.
- Pass/Fail: [ ] Pass [ ] Fail

## Downside Loss

- Test objective: Confirm that a deal with a workable realistic case but loss-making downside is escalated for review.
- Suggested app input values: Purchase `125000`, realistic GDV `195000`, downside GDV `160000`, refurb `18000`, stamp duty `4000`, legal `2000`, sale `3000`, bridge term `6`, evidence `MODERATE`, comparables `4`, coverage `LIMITED`.
- Expected result: `REVIEW_REQUIRED / REVIEW_REQUIRED`.
- What to verify manually: The app explains that downside loss creates caution and that GDV verification is required before progression.
- Pass/Fail: [ ] Pass [ ] Fail

## False HOT Deal

- Test objective: Confirm that urgency claims do not bypass governance.
- Suggested app input values: Purchase `128000`, GDV `205000`, refurb `18000`, stamp duty `4000`, legal `2000`, sale `3000`, bridge term `6`, evidence `MODERATE`, comparables `3`, coverage `LIMITED`, `hotDealClaimed = true`.
- Expected result: `REVIEW_REQUIRED / REVIEW_REQUIRED`.
- What to verify manually: The deal is not shown as a clean HOT proceed case; urgency unsupported by evidence is surfaced as a review reason.
- Pass/Fail: [ ] Pass [ ] Fail

## Structural / Fatal Risk

- Test objective: Confirm that fatal structural issues override strong raw economics.
- Suggested app input values: Purchase `105000`, GDV `200000`, refurb `15000`, stamp duty `3500`, legal `2000`, sale `3000`, bridge term `6`, evidence `STRONG`, comparables `5`, structural risk `FATAL`.
- Expected result: `BLOCKED / NO_DEAL`.
- What to verify manually: Fatal structural messaging is visible and any otherwise attractive economics do not produce a proceed recommendation.
- Pass/Fail: [ ] Pass [ ] Fail

## Missing Evidence / Manual Review

- Test objective: Confirm that incomplete support pauses progression even when the economics look investable.
- Suggested app input values: Purchase `112000`, GDV `205000`, refurb `16000`, stamp duty `3500`, legal `2000`, sale `3000`, bridge term `6`, evidence `MISSING`, comparables `0`, coverage `NONE`, manual review notes for missing comparable pack and incomplete evidence.
- Expected result: `REVIEW_REQUIRED / REVIEW_REQUIRED`.
- What to verify manually: The app clearly shows missing evidence and does not allow the case to appear clean or fully verified.
- Pass/Fail: [ ] Pass [ ] Fail

## Missing Comparables

- Test objective: Confirm that a case without valuation support cannot pass as a clean deal.
- Suggested app input values: Purchase `118000`, GDV `208000`, refurb `18000`, stamp duty `3500`, legal `2000`, sale `3000`, bridge term `6`, evidence `MISSING`, comparables `0`, coverage `NONE`.
- Expected result: `REVIEW_REQUIRED / REVIEW_REQUIRED`.
- What to verify manually: Missing comparable support is explicitly visible and a comparable request is the appropriate next step.
- Pass/Fail: [ ] Pass [ ] Fail

## Unrealistic GDV

- Test objective: Confirm that a stretched valuation assumption is blocked.
- Suggested app input values: Purchase `120000`, GDV `240000`, refurb `15000`, stamp duty `4000`, legal `2000`, sale `3000`, bridge term `6`, evidence `WEAK`, comparables `1`, coverage `LIMITED`, `hasUnrealisticGdvRisk = true`.
- Expected result: `BLOCKED / NO_DEAL`.
- What to verify manually: The app does not permit optimistic GDV to create a proceed outcome; unrealistic valuation is clearly challenged or blocked.
- Pass/Fail: [ ] Pass [ ] Fail

## High Leverage

- Test objective: Confirm that aggressive leverage fails capital protection.
- Suggested app input values: Purchase `145000`, GDV `170000`, refurb `5000`, stamp duty `5000`, legal `2000`, sale `3000`, bridge term `6`, evidence `MODERATE`, comparables `3`, coverage `FULL`, `loanToValue = 0.92`.
- Expected result: `BLOCKED / NO_DEAL`.
- What to verify manually: The app surfaces leverage or capital-overexposure concerns and does not present a clean proceed path.
- Pass/Fail: [ ] Pass [ ] Fail
