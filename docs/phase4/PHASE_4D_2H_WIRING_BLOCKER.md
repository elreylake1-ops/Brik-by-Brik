# Phase 4D-2H Wiring Blocker

## What Blocks Safe Tiny Wiring
The existing saved-deal detail surface in `app/page.tsx` is a client component and loads saved-deal data through client-side fetches.

The new `loadInvestorShieldUiModelForDeal` helper is server-only because it depends on the read model and repository-backed Investor Shield loading path.

Under the current constraints, there is no safe tiny way to pass an `InvestorShieldUiModel` into `InvestorShieldGateSummaryPanel` from `app/page.tsx` without doing one of the following:
- adding client-side fetching
- exposing a new API route or changing existing API route behavior
- converting the page or a major part of it into a server-rendered composition path

Those moves are outside the scope of this step.

## Smallest Preparatory Step
Split the saved-deal detail surface into a server-side host later, so it can call the read-only Investor Shield UI model loader before rendering the client panel.

That preparatory step should remain read-only and should still avoid:
- pipeline changes
- write paths
- task creation
- upload/edit controls
- route expansion

## Recommended Next Step
Phase 4D-2I — Server-Rendered Saved Deal Detail Host Plan Only

That step should define the smallest server-side composition boundary needed to render the panel safely.

