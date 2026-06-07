# Phase 4D-2N-A app/page.tsx State/Fetched-Data Insertion Audit

## Purpose
This audit identifies safe `app/page.tsx` insertion points only and makes no runtime or UI changes.

## Existing Saved Deal Selection State
- Existing selected saved deal variable/state name: `selectedSavedDeal`
- It is set in `handleViewSavedDeal(id)` after the `/api/saved-deals/[id]` request succeeds.
- Saved deal detail is rendered inside the `Saved Deal Detail` section beginning at the existing conditional block that checks `isLoadingSelectedSavedDeal`, `selectedSavedDealError`, and `selectedSavedDeal`.

## Existing Effects Near Saved Deals
- Existing `useEffect` blocks are for mounting the click-outside handler and loading the saved deal list on first render.
- There is no existing saved-deal selection fetch effect beyond `handleViewSavedDeal(id)`.
- A new Investor Shield effect can be added near the other hooks without changing existing behavior if it only watches the selected saved deal id and only updates local Investor Shield state.

## Proposed Future State Insertion Point
Insert the future local state declarations near the other saved-deal state hooks, immediately after:
- `selectedSavedDeal`
- `isLoadingSelectedSavedDeal`
- `selectedSavedDealError`

Future state names:
- `investorShieldModel`
- `investorShieldLoading`
- `investorShieldError`

Do not add the state in this step.

## Proposed Future Fetch Effect Insertion Point
Insert the future fetch effect near the existing `useEffect` hooks, after the saved-deal list loading effect and before the rest of the local helper functions.

The effect should depend on the selected saved deal id and call the fetch helper only when a selected deal exists.

Do not add the effect in this step.

## Proposed Future Render Insertion Point
Insert the future panel/fallback render inside the existing `Saved Deal Detail` section, after the core summary cards and before the `Saved Engine Snapshot` / `Operator Command` blocks.

That placement keeps the panel inside the saved deal context without expanding the dashboard or changing calculator layout.

Do not render anything in this step.

## Risk Notes
- Fetch could trigger during calculator edits if the dependency is tied to unrelated form state instead of the selected saved deal id.
- A stale response could overwrite the panel after the user selects a different saved deal.
- It is easy to accidentally call task or pipeline APIs if the helper boundary is not kept narrow.
- The panel could be placed in a global dashboard area instead of the saved deal detail area.
- The saved deal detail section is already dense, so adding another block too high can expand the layout more than intended.

## Recommended Next Step
Phase 4D-2N-B — `app/page.tsx` Investor Shield State Variables Only.
