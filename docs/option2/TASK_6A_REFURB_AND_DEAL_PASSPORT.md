# Task 6A: Refurbishment scope, builder quotation pack and Deal Passport

Local development and isolated QA only. Nothing here touches Production, Preview, a remote database, the security RC1 branch, Phase 5B, or any paid AI service. The branch stays local while checklist reuse rights are unresolved.

## The chain

```
human-reviewed findings  ->  proposed work items  ->  [human confirms]  ->  accepted scope
      -> estimate + schedule + financial impact (EXISTING engine)  ->  builder pack (draft)  +  Deal Passport (draft)
```

Nothing in the chain is automatic. A person reviews each AI suggestion (existing), a person confirms the scope (new), and every output is marked DRAFT / NOT_APPROVED.

## What was reused (nothing was re-implemented)

| Need | Existing component reused | How |
|---|---|---|
| Scope vocabulary | `types/scope.ts` `RefurbScopeInput` | the confirmed items are translated into this exact type |
| Scope to tasks | `generateTasksFromScope` | cost lines are the engine's own tasks |
| Cost | `calculateRefurbCost` (+ task library, trade rates, material baselines) | unchanged; no rate appears in the new code |
| Schedule | `calculateTimeline` | the plan stores the engine's `RefurbTimeline` |
| Financial impact | `analyzeDealWithRefurb` | run twice (Saved Deal figures, and with the confirmed scope); the layer only subtracts the two results |
| Input bounds | `parseDealInputs`, `parseScope` | assumptions and scope are validated with the same functions the Saved Deal save path uses |
| Check state rule | `buildCheckStates` | the single definition of "what state is each check in", also used by the review UI |
| Review trail | `reviewProposalAction`, stored reviews, `loadAssessmentDetail` | reviewer, time, revision and frame links are read from stored data |
| Evidence, summary, Investor Shield, disclaimers | `loadPdfEvidencePackForDeal` | the Deal Passport embeds its identity, investor summary, Shield result, evidence index and disclaimers unchanged |
| Auth, CSRF, deal scoping | `authorize()` / `requireSavedDealReadAccess` / `requireOperatorPage` | all new endpoints and the passport page use them |
| Rendering helpers | `formatCurrency` | display only |

Not used, on purpose: the standalone viewing module's own financial calculator (it is not ported or imported), the AI provider layer, and every writer for Saved Deals, Investor Shield, pipeline and operator-guard state (a test scans the new code for those imports).

## Behaviour

**1. Findings to proposed work** (`lib/refurb-integration/findings-to-work.ts`, mapping in `lib/data/finding-work-mapping.ts`)
- Only suggestions a person ACCEPTED or EDITED can matter; the check's effective state decides: CONCERN proposes works, SPECIALIST_REVIEW proposes an inspection only, anything else (observed, not accessible, not applicable) proposes nothing. Unreviewed and rejected suggestions are listed as excluded, with the reason.
- A claim with no resolvable evidence frame is excluded. Concerns on sale/legal/finance checks never create work.
- Each item carries its sources: proposal, review id and revision, reviewer, time, the human's wording, and every frame with its timestamp and room. No money appears in a proposal.
- Three kinds of item: `ENGINE_SCOPE` (maps to a field of the existing scope: roof, electrics, heating, flooring, kitchen, bathroom), `UNPRICED` (a real finding the engine has no scope for, e.g. facade, windows, drainage: listed for builders, no figure), `SPECIALIST_INSPECTION` (nothing priced or scheduled).
- A finding proposes the lowest level that means "some work". Only a human can choose a higher one.

**2. Human confirmation** (`plan-service.ts`, `POST .../refurb-plan`)
- The body contains choices only: which proposed items to accept (optionally a level), property basics, deal assumptions, an idempotency key, and the fingerprint of the proposal the person was looking at. The server rebuilds the proposal from stored data, refuses items that are not in it, refuses a stale fingerprint (409), and records the confirmation under the verified identity.
- Property basics (bedrooms, bathrooms, floor area, kitchen size) and the four deal assumptions (stamp duty, legal costs, sale costs, bridge term) are required operator input, recorded and labelled as such. They are never defaulted or read from video.
- Confirmations are append-only versions. A repeat of the same key and request returns the stored confirmation; the same key with different content is refused. A plan is flagged **stale** when any finding is reviewed again after confirmation.

**3. Cost, schedule, financial impact**
- Computed by the existing functions from the confirmed scope and stored with the confirmation (so the figures a person confirmed can be shown exactly as they were). Each engine task is attributed to the confirmed item that produced it; the sum of lines equals the engine total (checked as an invariant, and tested).
- Unknowns are explicit: missing basics block costing; missing assumptions block the financial impact; items the engine cannot price (levels without templates, unpriced works, inspections) are listed with the reason and carry no cost and no duration; priced items are listed as provisional allowances with their quantity caveat; the engine's own warnings pass through.
- The financial impact compares the Saved Deal's stored figures with the same deal plus the confirmed scope. It is a preview. It does not update the Saved Deal, Investor Shield, governance state or pipeline (no function that could is available to this code).

**4. Builder quotation-request pack** (`GET .../builder-pack`)
- Itemised scope with the human-reviewed observation, frame ids and timestamps; quantity basis per item; the engine's indicative quantities (tasks, trades, labour days) without prices; draft schedule with the engine's contingency; unscheduled items; assumptions; standard exclusions (editable in the config file); what the builder must verify; what is requested from the builder; disclaimers. A pack is stamped stale if findings changed.
- Our own estimate is withheld by design, and any engine line containing a currency amount (rates, placeholder ranges) is removed from the pack. A test found this leak (engine assumption strings quote per-sqm rates) before it shipped.
- `internalProvenance` (reviewer and operator ids) is marked INTERNAL_REMOVE_BEFORE_SENDING.

**5. Deal Passport** (`GET /api/saved-deals/:id/deal-passport`, page `/saved-deals/:id/passport`)
- Property and Saved Deal summary as stored; inspection and evidence status; the confirmed scope, estimate, schedule and financial impact; Investor Shield exactly as evaluated; an explicit list of outstanding decisions (unreviewed findings, specialist inspections, unpriced items, blocked costing, stale plan, Shield blockers and missing evidence, simulated data); review history and provenance (plan versions, every source trail entry, evidence ids); disclaimers.
- Read-only, no controls on the page.

**6. UI** (minimal): a "Refurbishment scope" panel on the viewing page (choose items and levels, enter basics and assumptions, preview, confirm) and the read-only passport page.

## Endpoints and files

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/saved-deals/:id/viewing-assessments/:aid/refurb-plan` | GET | proposal from reviewed findings, exclusions, current plan and stale flag |
| same | POST | the human confirmation |
| `.../refurb-plan/preview` | POST | cost, schedule and financial impact for chosen items; writes nothing |
| `.../builder-pack` | GET | draft builder quotation-request pack (needs a confirmed plan) |
| `/api/saved-deals/:id/deal-passport[?assessmentId=]` | GET | draft Deal Passport |

New code: `lib/refurb-integration/*` (adapter, compute, service, repository interface + PostgreSQL, builder pack, passport, wiring), `lib/data/finding-work-mapping.ts`, `types/refurb-integration.ts`, `types/deal-documents.ts`, `components/refurb-plan/*`, the four route folders and `app/saved-deals/[id]/passport`, and migration `db/migrations/20261022_task6a_refurb_plan.sql` (one new append-only table; no change to any existing table). Changed: `app/saved-deals/[id]/viewing/page.tsx` (adds the panel), `scripts/qa/local-postgres.mjs` (applies the full migration set, rolls back the new table first, and now runs PostgreSQL suites serially).

## Safety properties and where they are tested

| Property | Test |
|---|---|
| Unreviewed, rejected, observed, unsupported, non-works findings produce no work | `refurb-findings-to-work`, flow suite |
| Items outside the reviewed proposal cannot be accepted | flow suite (`invalid`), routes |
| Human confirmation required; plan records items, sources, engine numbers | flow suite (in memory and real PostgreSQL) |
| Cost, schedule and impact equal the existing engine's own output; every pound traces to an item | `refurb-plan-compute` |
| Missing basics, assumptions, price/GDV and unpriced work stated, not hidden | `refurb-plan-compute` |
| Saved Deal row and Investor Shield rows byte-identical after preview, confirm, pack and passport | flow suite on real PostgreSQL, live-server scenario 9b |
| New code cannot import any deal/governance writer or AI provider | `refurb-plan-compute` (static scan) |
| AI free text (including cost claims) never reaches a plan, pack or passport | flow suite, scenario 9b |
| Idempotency, key reuse, versioning, staleness, concurrent submissions | flow suite, repository contract (in memory and PostgreSQL) |
| Cross-deal isolation (all endpoints, repository, composite foreign key) | flow suite, routes, PostgreSQL rules |
| Authentication, non-member, CSRF, no body-supplied identity/cost/verdict | `refurb-routes`, `saved-deals-authorization` (28 handlers) |
| Builder pack: draft, evidence cited, our estimate and rates withheld | flow suite |
| Passport: reused services' output unchanged, outstanding decisions, provenance trail | flow suite |
| Append-only, no truncate, malformed rows refused | PostgreSQL rules |

## Demonstrable end to end (locally)
Against the production build, the local HTTPS identity simulator and the disposable PostgreSQL: sign in, seed reviewed findings, `GET` the proposal, preview, confirm (cross-site attempt refused), replay, fetch the builder pack and passport (JSON and page), and prove the Saved Deal and Investor Shield rows did not change (`e2e-auth-flow.pg.test.ts` scenario 9b).

## What still uses mocked or operator-supplied input
- Findings come from the **simulated** fixture provider (no real AI has run); seeded reviews stand in for real operator reviews in tests.
- Property basics and deal assumptions are typed by the operator; nothing reads them from the video or from the Saved Deal (the Saved Deal does not store its stamp duty, legal or sale-cost inputs).
- The Deal Passport's evidence pack and Investor Shield result are real services but the QA deals have no evidence or shield decisions beyond defaults.

## Gaps
- **Refurbishment**: the engine prices only kitchen/bathroom full replacement, whole-property flooring, rewire, boiler and a roof placeholder. Everything else is listed unpriced. No per-room or partial-area quantities (needs measurements or a surveyor), no bedroom mapping, no engine templates for lighter levels. A quantity-capture step (rooms, areas, counts) is the main missing input.
- **Applying the result**: nothing writes the confirmed scope back to the Saved Deal or the calculator. That needs an explicit, separately authorised step through the existing workflow.
- **Scheduling**: the schedule is the engine's trade-phase model for priced items only; no dates, no dependencies on unpriced works or inspections, no builder programme import.
- **Builder pack**: JSON only (no PDF, no email, no builder portal, no quote comparison or return of quotes). Quotes received are not yet modelled; Investor Shield's existing builder-proposal tables are not connected.
- **Deal Passport**: HTML and JSON only; no PDF, no signatures or approvals, no share link. Evidence images are not embedded.
- **Review**: a plan cannot yet be superseded or withdrawn by a person other than by confirming a new version; there is no sign-off role.

## Decisions for the owner
1. Should the builder pack ever contain our own estimate or allowances? Currently withheld.
2. Who may confirm a scope (any operator today), and is a second-person approval needed?
3. Where should the confirmed scope be allowed to flow next (calculator scope form, Saved Deal refurbishment figure, Investor Shield builder gate), and through which authorised workflow?
4. Which unpriced work types should get engine templates first (facade, windows, drainage, ceilings)?
5. Deal Passport audience: internal only (as built), or an investor-facing version with different content?
6. Third-party checklist reuse rights still block pushing this branch.
