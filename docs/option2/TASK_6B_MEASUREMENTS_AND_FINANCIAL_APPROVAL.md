# Task 6B: Quantity capture and controlled financial approval

Local development and isolated QA only. Nothing here touches Production, Preview, a remote database, the security RC1 branch, Phase 5B or any paid service. The branch stays local while checklist reuse rights are unresolved.

```
reviewed findings -> proposed work -> [operator measurements] -> [operator confirms scope]
   -> engine estimate + schedule + impact -> financial-impact PROPOSAL -> [operator decision]
   -> builder pack (confidential) + Deal Passport (three layers)
```

The proprietary engine (`analyzeDealWithRefurb` and the functions it calls) is the only source of any figure. The Saved Deal stays the authoritative record. There is no write-back.

## 1. Measurements and quantity assumptions

Operators type measurements against an assessment (`GET/POST .../measurements`). `lib/refurb-integration/measurements.ts` validates; `lib/data/measurement-spec.ts` is the visible list of what can be recorded and the sanity ranges.

- **Never from video.** There is no source value for video and no field for a frame; a request that tries (`source: "VIDEO_FRAME"`, `frameIds`, any unknown field) is rejected. The panel offers only tape, laser, scaled floor plan, EPC/listing, agent/vendor, other.
- **How each value is known:** `MEASURED` (tape, laser or scaled plan only), `OPERATOR_ESTIMATE` (a stated or approximate figure), or `UNKNOWN` (no value; a reason is required). Each carries source, confidence and a note (required for estimates, low confidence and unknowns). A tape or laser reading cannot be labelled an estimate; a listing figure cannot be labelled measured.
- **Catches:** impossible values are rejected (hard ranges); unusual-but-possible values (e.g. 900 sqm) need `acknowledgedImplausible` and leave a recorded warning; conflicting values for the same quantity are rejected; room dimensions that add up to more than the entered floor area are rejected.
- **Only four quantities reach the engine:** bedrooms, bathrooms, total floor area and kitchen size (the engine's own inputs). Room lengths and widths, ceiling height, window and door counts, roof and wall areas are recorded for builders and the audit trail but are **never** converted into a price or a kitchen-size band (that would be a new method).
- **Nothing is filled in.** Unknown or missing bedrooms/bathrooms block costing and block confirming a scope. Unknown floor area still costs, using the engine's own room-count fallback and its warning, and the gap is stated. A kitchen replacement cannot be costed without a recorded kitchen size; other work still can.
- **Versions and corrections:** append-only. A new version must be based on the version being corrected (otherwise 409), must say what was wrong, and shows exactly what changed. Earlier versions stay readable.
- **Stored against the scope version:** a confirmed plan records the measurement set id and version it used. Recording newer measurements, or reviewing findings again, marks the plan **stale** (`MEASUREMENTS_CHANGED`, `FINDINGS_CHANGED`); a stale scope cannot be turned into a proposal.
- The Task 6A typed-in-basics path still works (recorded as operator estimates with no measurement record).

## 2. Financial-impact proposal and the operator's decision

`POST .../financial-proposal` builds a **versioned proposal** from the current, non-stale confirmed scope (`lib/refurb-integration/financial-proposal.ts`). It contains:
- the confirmed scope version, who confirmed it, and every reviewer whose decision supports an item (with check and proposal ids);
- the **authoritative** Saved Deal figures exactly as stored (including the stored engine result's headline numbers), the engine's **recalculation** of the stored figures with the operator's assumptions (a like-for-like baseline), and the **proposed** figures from the confirmed scope, with the difference. A flag says when the stored result and the recalculation disagree (the assumptions used when the deal was saved are not stored);
- changed assumptions, items excluded from the figures and why, unresolved quantities, and what blocks it when it cannot be computed (`NOT_COMPUTABLE`);
- `nonAuthoritative: true`, enforced by a database CHECK.
Identical content is returned, not duplicated; a change in the plan, findings, measurements or the Saved Deal figures makes a new version and marks the earlier one out of date.

`POST .../financial-proposal/:id/decision` records the operator's decision (`CONFIRMED` or `DECLINED`) as an append-only event. Confirming requires: the exact proposal hash the operator saw; that it is the latest and still matches current data; that it can be computed; and explicit acknowledgement that it approves a **proposed adjustment only, not a write-back** (database CHECK), plus acknowledgement of any listed exclusions and unresolved quantities. The event stores the actor (from the verified session, never the body), time, note, what was acknowledged, a fingerprint of the Saved Deal figures at that moment, and whether the same person confirmed the scope (recorded, not blocked: a four-eyes rule is an owner decision). One decision per proposal; repeats are idempotent; a second decision is refused (`ALREADY_DECIDED`).

**What a confirmation is not:** it writes nothing to the Saved Deal, does not touch Investor Shield, governance or pipeline state, and is not an investment approval. The response says `savedDealChanged: false`. There is no function in the dependency set that could write to a deal, and a test scans the new code for such imports.

## 3. Builder pack confidentiality (v2)

The 6A pack included engine-derived labour days, the engine's schedule, "provisional allowance" text and an internal-provenance block. Those are **removed**. The pack now holds only: the reviewed scope with the reviewer's observations, frame ids and timestamps; the recorded measurements with their basis, source, confidence and notes; quantity statements; assumptions and exclusions; what the builder must verify and what is requested; and a **blank pricing sheet** (price excluding VAT, includes, excludes, duration, notes per item, totals, VAT treatment, start, validity, builder name and contact). Builder-facing wording per work type lives in `BUILDER_NOTES` (no engine, rate or estimate language).

Verified by tests that scan the output for: currency symbols; the deal's purchase price, GDV, stored refurbishment cost and our estimate, labour, material and profit figures as whole numbers; rate, labour, contingency and allowance vocabulary; profit, margin, MAO, GDV, yield, verdict, threshold, governance, Investor Shield and capital-protection language; the word "engine"; operator identities; and any key whose name is a cost, rate, estimate, reviewer, fingerprint or hash. Two mutation checks (adding an internal estimate to the pack; removing the out-of-date refusal) were confirmed to make tests fail. The pack carries explicit `confidentiality` flags, and notes the operator must review free-text notes before sending.

## 4. Deal Passport v2

Three layers, never blended: **1. Authoritative** (Saved Deal as stored, Investor Shield as evaluated), **2. Confirmed scope** (what a person accepted, with the engine's cost and schedule at that moment and the measurement version), **3. Proposal** (the engine's financial effect, whether a named operator approved it, outdated state and history). Also: measurements with correction history, inspection and evidence status, outstanding decisions (no measurements, incomplete measurements, no proposal, proposal awaiting decision, declined, outdated, approval outdated, no write-back, unpriced items, simulated data), and the full source trail.

## 5. Reused, not rewritten
`analyzeDealWithRefurb`, `generateTasksFromScope`, `calculateRefurbCost`, `calculateTimeline` (all via the 6A `computePlan`), `parseDealInputs`, `buildCheckStates`, the review action and stored reviews, `loadPdfEvidencePackForDeal`, `authorize` / CSRF / `requireOperatorPage`, `formatCurrency`. No formula, rate, band or threshold was added; a test scans the new code for rate and contingency constants.

## 6. Endpoints and storage

| Endpoint | Purpose |
|---|---|
| `GET/POST .../measurements` | read (with history and engine-quantity notes) / record a version |
| `POST .../refurb-plan` and `.../preview` | now accept `measurementSetId` (preferred) instead of typed-in basics |
| `GET/POST .../financial-proposal` | read state / create a proposal |
| `POST .../financial-proposal/:id/decision` | the operator's decision |
| `GET .../builder-pack`, `GET /api/saved-deals/:id/deal-passport` | confidential pack / three-layer passport |

Migrations (new, local only, apply in this order): `20261023_task6b_measurements.sql`, `20261024_task6b_financial_proposals.sql` (also adds two nullable columns, a unique key and two constraints to the Task 6A plan table, which has only ever existed in the local QA database). All tables are append-only with truncate guards and composite foreign keys that bind rows to their deal and assessment. `local-postgres.mjs rollback` now drops 15 documented tables/functions in dependency order; rollback and clean re-apply were run. The PostgreSQL suites now run **serially** (they share one database and take exclusive locks).

## 7. If write-back is ever wanted: separate authorization and compatibility testing
Nothing in 6B should be stretched into write-back. A future write-back is a different feature needing, at minimum:
1. **Owner authorization** naming who may apply an approved proposal (a stronger role than "operator"; probably a second person), and whether Investor Shield or pipeline state may be affected.
2. **A separate endpoint and permission**, never an extra flag on the decision endpoint. Preconditions: decision `CONFIRMED`, proposal latest and not outdated, plan current, Saved Deal fingerprint unchanged since the decision (optimistic concurrency), and a fresh idempotency key.
3. **Recomputation, not copying.** The server re-runs the canonical pathway (as `deriveSavedDealRecord` does on save) so classification, governance and capital protection are re-derived by the engine, not taken from the proposal.
4. **Investor Shield** re-evaluated only through its established workflow; any override rules unchanged; no gate cleared by a refurbishment change alone.
5. **Reversibility:** the prior values and the engine result are stored in an append-only audit record so the change can be reversed; the audit event names the approver, the proposal and the decision.
6. **Compatibility testing before any shared environment:** the Saved Deals, pipeline guard, offers, tasks, evidence, Investor Shield and summary/review/PDF-pack suites run before and after on a copy; side-by-side comparison of governance, pipeline and Shield outputs for the same inputs; behaviour for deals saved earlier with browser-supplied governance; concurrent-edit tests; an isolated Preview rehearsal with a real browser and the real identity provider; and a rollback rehearsal.
7. **Never AI in the loop:** no AI output may feed the write path.

## 8. Tests (all local)
Measurement validation and engine-quantity derivation (40); the measurement and financial repository contracts (in memory and real PostgreSQL, including concurrent writers); the measurement/proposal/decision flow (in memory and real PostgreSQL with the real Saved Deals, Investor Shield and evidence-pack services); route tests for every new endpoint (authentication, non-member, CSRF, forged fields, idempotency, stale, cross-deal); component tests for the measurement form, proposal and decision UI; database-rule tests (append-only, constraints, cross-deal links, non-authoritative and acknowledgement checks, no Saved Deal columns); a live-server scenario against the production build and the local identity simulator. One database weakness was found by these tests and fixed: a CHECK that passed when the key was missing (NULL).

## 9. Gaps and owner decisions
- Room dimensions are recorded but do not yet drive a price; a measured-quantity take-off would need new engine templates (an owner and estimator decision).
- No four-eyes rule: the same operator may confirm the scope and the proposal (recorded in the event).
- Free-text measurement notes and reviewed observations reach the builder pack; the operator must review them.
- Still unresolved from earlier tasks: Production exposure and the RC1 release, identity provider and Preview database, checklist reuse rights, real AI analysis, a real-browser and Android pass.
