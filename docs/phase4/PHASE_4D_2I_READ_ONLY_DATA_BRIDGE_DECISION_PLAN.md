# Phase 4D-2I Read-Only Data Bridge Decision Plan

## Purpose
This document decides the safest bridge for read-only Investor Shield UI data after 4D-2H was blocked.

## 4D-2H Blocker Summary
- The saved deal detail surface is client-rendered in `app/page.tsx`.
- The UI model loader is server-only and read-only.
- Directly importing the server loader into the client page is unsafe and out of scope.
- Wiring was correctly stopped.

## Bridge Options Considered

### Option A: Add Read-Only API Endpoint
- The client page fetches the Investor Shield UI model by saved deal id.
- The endpoint uses the server loader.
- The endpoint returns the read-only model only.

Pros:
- Clear client/server boundary.
- Does not expose DB access to the client.
- Keeps the panel prop-based.
- Can be tested as read-only.

Cons:
- Adds an API route.
- Must strictly prevent writes and task creation.

### Option B: Server Component Wrapper
- Move saved deal detail rendering into a server-side wrapper or route-level server component.

Pros:
- Avoids a new API endpoint.

Cons:
- Likely a larger refactor.
- Risky with the current client-heavy `app/page.tsx`.
- May disturb existing saved-deal behavior.

### Option C: Extend Existing Saved Deal API Response
- Add the Investor Shield UI model to the existing saved deal read response.

Pros:
- Fewer endpoints.

Cons:
- Changes the existing route contract.
- Higher regression risk.
- Could mix saved-deal core data with Investor Shield presentation data too early.

## Recommended Bridge
Recommend Option A: a small read-only API endpoint dedicated to the Investor Shield UI model.

Reason:
- Smallest safe client/server bridge.
- Avoids importing server-only code into the client page.
- Avoids refactoring `app/page.tsx`.
- Avoids changing the existing saved deal route contract.
- Can be tested for no writes.

## Proposed Endpoint Shape
Plan only:
- `GET /api/saved-deals/[id]/investor-shield-ui`

Response:
- `success: true`
- `model: InvestorShieldUiModel`

Error:
- `success: false`
- `error: safe string`

Rules:
- GET only.
- No POST/PATCH/DELETE.
- No task creation.
- No evidence upload.
- No pipeline mutation.
- No manual override mutation.

## Safety Requirements For Future Route
Future route must:
- validate deal id
- call `loadInvestorShieldUiModelForDeal`
- return safe JSON
- fail safely
- not call write helpers
- not call task persistence
- not call pipeline update
- not expose secrets
- not change existing saved deal route behavior

## Future Test Requirements
Future route tests must confirm:
- valid id returns model
- missing or empty id returns safe error
- loader failure returns safe error
- no task persistence helper is called
- no pipeline update helper is called
- no write repository helpers are called
- response contains no upload, edit, or action affordances

## Recommended Next Step
Phase 4D-2J — Read-Only Investor Shield UI API Route Only

