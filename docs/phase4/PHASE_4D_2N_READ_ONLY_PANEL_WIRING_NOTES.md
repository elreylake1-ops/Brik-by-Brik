# Phase 4D-2N Read-Only Panel Wiring Notes

## Purpose
Manual QA notes for the Investor Shield panel wiring inside `app/page.tsx`.

## Manual QA Steps
1. Open the app and select a saved deal.
2. Confirm the `Investor Shield` block appears inside the saved deal detail section.
3. Confirm the loading text still appears while the read-only fetch is active.
4. Confirm the error text still appears when the read-only fetch fails.
5. Confirm the empty text still appears when no saved deal is selected.
6. Confirm the panel renders only when the model is available.
7. Confirm no upload, edit, waiver, task, or pipeline action controls appear in the Investor Shield area.

## Expected Read-Only Behavior
- Loading copy: `Loading Investor Shield status...`
- Empty copy: `Investor Shield status is not available yet.`
- Error copy: `Investor Shield status could not be loaded. Pipeline rules remain unchanged.`
- Loaded state: `InvestorShieldGateSummaryPanel`
