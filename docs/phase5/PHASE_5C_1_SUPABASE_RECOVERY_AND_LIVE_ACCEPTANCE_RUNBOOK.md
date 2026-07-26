# Phase 5C-1 Supabase Recovery and Live Acceptance Runbook

## Purpose

Create one controlled recovery and acceptance runbook for authorized Supabase restoration, original database identity verification, Vercel environment verification, safe preview deployment, read-only API and route verification, live Phase 5A acceptance, live Phase 5B acceptance, mandatory human desktop and mobile QA, screenshot evidence, PR opening gates, merge gates, and rollback behavior.

## Repository Baseline

- repository: `Brik-by-Brik`
- origin: `https://github.com/elreylake1-ops/Brik-by-Brik.git`
- runbook branch: `phase5c-1-recovery-acceptance-runbook`
- branch base: `main`
- `main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- `origin/main`: `6d0981b4de7097b36e3995ff1733784a0c0fdaa5`
- working tree was clean before this documentation step

## Frozen Phase 5 Branches

### Phase 5A Professional Gateway and readiness

- branch: `phase5a-5b-professional-readiness-investor-review`
- frozen remote HEAD: `5ade84138727a489390a6eab958e3f399af95f0f`

### Phase 5B Deal Formulation Investor Review

- branch: `phase5b-1d-deal-formulation-investor-review`
- frozen remote HEAD: `1e2c2abf4d2aa1b44b8f6cd48ed8f554c418b70d`
- frozen implementation commit: `4eb911e54bbaede9291e328876b955e6da734c96`

### Phase 5B Investor and Deal Summary

- branch: `phase5b-2b-investor-deal-summary`
- frozen remote HEAD: `b668aff65654975a678406056c962a94b31599ff`
- frozen implementation commit: `e3ffb851e42c212141fe6d25f29a7533827d49e8`

All remain do-not-merge until live Supabase-backed verification and human desktop/mobile visual QA complete.

## Current External Blocker

The original Supabase project is inaccessible.

Only an authorized owner, currently James or Supabase Support acting with the owner, may restore access or provide approved recovery credentials.

This means:

- original project identity is not yet re-proven;
- approved database connectivity is not yet re-verified;
- live saved-deal routes cannot be accepted against the intended database;
- no preview deployment should begin until original-project identity is proven;
- this is not yet proven to be a Phase 5 implementation failure.

## Authorized Restoration Boundary

Only the authorized Supabase owner or Supabase Support may:

- restore the original project;
- unpause the project;
- recover database access;
- provide approved credentials;
- confirm the project reference;
- confirm the database host;
- confirm backup restoration.

## Prohibited Recovery Actions

Karlo or Codex must not:

- guess credentials;
- reset credentials;
- create a replacement project;
- run destructive SQL;
- run migrations;
- import a backup;
- delete database content;
- overwrite environment values;
- perform production deployment.

## Original Database Identity Proof

Before any deployment, require proof that the restored database is the original intended project.

Required non-secret evidence:

- Supabase project name;
- project reference;
- region;
- database host suffix or masked hostname;
- restored or unpaused dashboard state;
- expected schema and table presence;
- controlled saved-deal record presence;
- record count sanity check when safe;
- no indication of an empty replacement database.

Do not record:

- database passwords;
- full connection strings;
- API keys;
- service-role keys;
- access tokens.

## Vercel Environment Verification

After authorized restoration, verify only:

- correct Vercel project;
- correct production or preview environment scope;
- `DATABASE_URL` presence;
- environment target;
- last-updated metadata when available;
- deployment linkage to the correct Git repository.

Constraints:

- do not expose the variable value;
- do not replace the value unless the owner explicitly authorizes it;
- do not deploy until database identity is verified.

## Locked Recovery Sequence

```text
authorized Supabase restoration
→ original-project identity proof
→ approved DATABASE_URL verification
→ database connectivity smoke check
→ saved-deal API smoke check
→ exact frozen-commit preview deployment
→ live route verification
→ human desktop QA
→ human mobile QA
→ screenshot evidence
→ PR review
→ merge authorization
```

Do not reorder this sequence.

## Read-Only Connectivity Checks

After restoration, perform read-only checks first:

1. database connection succeeds;
2. expected saved-deal table exists;
3. controlled saved deal can be loaded;
4. no migration is required merely to perform acceptance;
5. no write occurs;
6. no test data is inserted;
7. no offer, task, evidence, or pipeline state changes.

If any check fails, stop and classify the failure before any deployment.

## API Smoke Checks

Verify read-only routes, including:

- `/api/saved-deals`;
- saved-deal detail route;
- Investor Review dependencies;
- summary dependencies;
- canonical evidence-read routes required by the frozen implementation.

Minimum recorded evidence for each read-only route:

- HTTP status;
- safe response shape;
- controlled deal presence where expected;
- absence of exposed secrets;
- absence of unexpected writes.

Do not perform mutation routes during acceptance recovery.

## Preview Deployment Strategy

Deploy frozen implementations only to an approved preview first.

### Preview A — Phase 5A and Phase 5B Investor Review

Use exact frozen implementation lineage containing:

- Professional Evidence Gateway;
- professional readiness;
- Deal Formulation.

### Preview B — Investor and Deal Summary

Use exact summary implementation commit:

`e3ffb851e42c212141fe6d25f29a7533827d49e8`

Rules:

- record exact Git commit deployed;
- do not treat later docs-only freeze commits as different implementation code;
- do not deploy Production during first recovery verification.

## Controlled Saved-Deal Routes

Use the approved controlled saved deal only.

Existing documented controlled deal identifiers include:

- `4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863` from prior live Investor Review proof;
- prior temporary fixture IDs such as `r12_proof_fixture_001` are historical proof artifacts only and must not be treated as replacement live-data authority.

Verify:

- saved-deal detail;
- Investor Review;
- Investor and Deal Summary;
- refresh behavior;
- fresh-browser behavior;
- direct-link behavior;
- safe not-found behavior;
- safe unavailable behavior.

Do not create or mutate a deal for acceptance.

## Phase 5A Acceptance Checklist

### Professional Evidence Gateway

Verify:

- canonical evidence is visible;
- no second evidence path appears;
- empty state is truthful;
- required and advisory boundaries remain clear.

### Professional readiness

Verify:

- correct readiness label;
- correct styling;
- no unsafe state appears successful;
- authority notice visible;
- Evidence Lite cannot show professional confirmation.

### Investor Shield

Verify:

- existing status unchanged;
- `canProgress` unchanged;
- no gate silently cleared;
- no readiness output overrides Shield.

## Deal Formulation Acceptance Checklist

Verify:

- purchase price;
- realistic, downside, and strong GDV;
- refurbishment cost;
- stamp duty;
- legal costs;
- sale costs;
- finance cost;
- total investment;
- projected profit;
- profit margin;
- all three True MAO bands;
- latest offer or no-offer state;
- verdict;
- classification;
- capital protection;
- strategy;
- recommended next action.

Confirm:

- ROI remains unavailable;
- acquisition-cost aggregate remains unavailable;
- offer-ladder values remain unavailable;
- missing money is not shown as zero;
- no True MAO band is selected;
- no UI calculation occurs.

## Investor and Deal Summary Acceptance Checklist

Verify exact section order:

1. Header
2. Executive decision snapshot
3. Core financial position
4. True MAO
5. Offer position
6. Unsupported values
7. Investor Shield
8. Professional readiness
9. Evidence Lite
10. Risks, blockers, and missing evidence
11. Recommended next action
12. Footer

Verify:

- values match Investor Review;
- authority wording is visible;
- confidentiality wording is visible;
- loading state works;
- not-found state is safe;
- unavailable state is safe;
- no PDF, print, download, sharing, or mutation control exists.

## Human Desktop QA

A human must inspect the actual rendered preview.

Check:

- section completeness;
- section order;
- financial readability;
- amount formatting;
- negative-profit styling;
- adverse and blocked styling;
- equal True MAO weighting;
- unavailable-state clarity;
- Investor Shield distinction;
- readiness advisory styling;
- Evidence Lite informational styling;
- long text wrapping;
- no horizontal overflow;
- no hidden controls;
- visible wording exactly matches the locked contracts.

Automated screenshots alone are insufficient.

## Human Mobile QA

A human must inspect an actual mobile viewport or device.

Check:

- single-column behavior;
- no horizontal scrolling;
- cards and sections fit viewport;
- long deal IDs wrap;
- monetary values remain readable;
- notes and notices wrap;
- gate rows remain understandable;
- True MAO bands remain equally weighted;
- no clipped text;
- no overlapping amounts;
- no inaccessible controls.

## Required Screenshot Evidence

### Investor Review

- desktop full page;
- Deal Formulation;
- True MAO;
- Investor Shield and readiness;
- Evidence Lite;
- mobile full page.

### Investor and Deal Summary

- desktop full page;
- financial summary;
- True MAO;
- Shield and readiness;
- Evidence Lite;
- mobile;
- safe unavailable state;
- safe not-found state when practical.

Screenshots must show the live preview and exact deployed commit.

## Database Non-Mutation Proof

After acceptance, confirm by read-only comparison methods:

- controlled saved-deal record unchanged;
- offers unchanged;
- tasks unchanged;
- pipeline unchanged;
- evidence unchanged;
- Shield state unchanged except where pre-existing data naturally dictates it;
- no test or acceptance record inserted;
- no migration applied;
- no schema change.

## Stop Conditions

Stop immediately when:

- restored project identity is uncertain;
- database appears empty or replaced;
- credentials are unapproved;
- schema is missing unexpectedly;
- a migration appears required;
- live values conflict materially with canonical outputs;
- route triggers a write;
- Investor Shield changes unexpectedly;
- a True MAO value differs from canonical engine output;
- UI calculates an unsupported value;
- sensitive information appears in the browser;
- desktop or mobile layout is materially broken.

Do not continue by patching Production. Classify and isolate the failure first.

## Failure Classification

If recovery or acceptance fails, classify into one of:

- Supabase restoration;
- environment configuration;
- schema or data mismatch;
- canonical loader;
- presentation;
- authority mismatch;
- responsive layout.

Only create a new isolated repair branch after the failure is proven.

## PR Opening Gates

A Phase 5 PR may be opened for review only after:

- original Supabase project restored;
- database identity verified;
- approved DB connection verified;
- preview deployment succeeds;
- read-only routes succeed;
- live values verified;
- desktop human QA passes;
- mobile human QA passes;
- screenshots captured;
- non-mutation proof completed.

## Merge Gates

A PR may be merged only after:

- Karlo approves desktop and mobile;
- James reviews or approves the required business presentation;
- no unresolved authority or data mismatch exists;
- do-not-merge notice is removed intentionally;
- exact implementation commit is known;
- merge target is confirmed.

## Rollback Strategy

If preview verification fails:

- stop the preview acceptance;
- do not modify Production;
- retain frozen branches;
- preserve logs and screenshots;
- classify the failure;
- create a new isolated repair branch only after the failure is proven.

Do not patch frozen branches directly.

## PDF Deferral

PDF generation remains prohibited until:

- browser summary live verification passes;
- desktop human QA passes;
- mobile human QA passes;
- separate PDF architecture is approved.

## Explicit Non-Implementation

This runbook step confirms no:

- application code;
- test change;
- deployment;
- Supabase access;
- credential change;
- Vercel variable change;
- migration;
- database write;
- schema change;
- replacement project;
- API change;
- route change;
- formula change;
- True MAO change;
- ROI calculation;
- acquisition-cost calculation;
- offer-ladder change;
- Investor Shield change;
- readiness change;
- Evidence Lite change;
- PDF generation;
- storage;
- sharing;
- task, offer, or pipeline mutation.

## Result

`PHASE 5C-1 RECOVERY AND LIVE ACCEPTANCE RUNBOOK COMPLETE — WAITING FOR AUTHORIZED SUPABASE RESTORATION`

## Recommended Next Step

`Authorized owner restores the original Supabase project and provides non-secret restoration confirmation before any live verification or deployment begins.`
