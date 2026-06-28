# Saved-Deal Internal Access Model and Minimal Reusable Guard Plan

## Purpose

Define the smallest safe internal access model for the current saved-deal application and plan one reusable server-side access guard.

This phase is documentation, inspection, and security-boundary planning only. No authentication or authorization implementation is added here.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `d5315c5107e18e7000973925ea36e741467e62da` |
| `origin/main` | `d5315c5107e18e7000973925ea36e741467e62da` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this plan | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_ACCESS_CONTROL_BOUNDARY_RESOLUTION.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_GET_ROUTE_AND_SAFE_RESPONSE_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_AGGREGATION_REPOSITORY_AND_MOCKED_TESTS.md`
- `README.md`
- `AGENTS.md`
- `LEAN-CTX.md`
- `app/page.tsx`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/route.ts`
- `db/migrations/20260522_phase4a_saved_deals_table.sql`
- `lib/operator-command/saved-deals-repository.ts`
- `lib/http/safe-route-error.ts`
- `package.json`

## Prior Access-Audit Verdict

The completed access audit concluded:

`PDF EVIDENCE PACK ACCESS BOUNDARY BLOCKED — NO SAFE ACCESS MODEL EXISTS`

Why the route was blocked:

- no proven authenticated caller boundary existed in the repository
- no proven authorization or deal-ownership boundary existed in the repository
- no reusable request guard could be inherited safely
- no route tests proved `401` / `403` behavior for saved-deal access

Current saved-deal access-control classification from the audit:

- `NO APPLICATION ACCESS CONTROL` on the saved-deal routes inspected

Identity / ownership / infrastructure findings from the audit:

- no application identity model existed in the repository evidence
- no deal ownership or tenancy model existed in the repository evidence
- infrastructure protection was unresolved and could not be treated as an application access boundary
- the minimum recommended security work was to approve the internal saved-deal access model, define one reusable server-side access guard, prove caller identity and deal entitlement, and add focused mocked tests

## Current Product Identity Evidence

| Evidence | What It Shows |
| --- | --- |
| `app/page.tsx` | `Read-only saved deals list`, `Read-only saved deal detail`, and `Operator Command` text are visible in the product surface |
| `docs/phase4/PHASE_4A_MINIMAL_DATA_MODEL_BOUNDARY.md` | Says `single-operator first` and `no multi-user permissions` |
| `docs/phase4/PHASE_4A_OPERATOR_COMMAND_MVP_LIVE_HANDOFF.md` | Says `this build is single-operator focused` |
| `db/migrations/20260522_phase4a_saved_deals_table.sql` | Defines `saved_deals` with operational fields only and no ownership or tenant columns |
| `package.json` | Declares `next`, `react`, `react-dom`, and `pg` only; no auth provider dependency is present |
| Repository searches | No `userId`, `ownerId`, `tenantId`, `organizationId`, `teamId`, `role`, or `permission` fields were found in `db/migrations`, `types`, or `lib` |
| Repository searches | No `middleware.ts`, `proxy.ts`, `auth.ts`, `lib/auth/**`, `lib/security/**`, `lib/session/**`, `getServerSession`, `requireAuth`, `requireUser`, Clerk, Auth.js, or NextAuth configuration was found |

Current implications:

- the application is internally oriented, not public-facing
- the saved-deal surface is presented as an operator command workspace
- there is no repository evidence of customer, investor, public, or external user access
- there is no repository evidence of saved-deal ownership, tenant isolation, or role-based access

## Current Product Access-Model Classification

Classification:

`SINGLE TRUSTED INTERNAL OPERATOR`

Why this is the best fit:

- the Phase 4A docs explicitly say `single-operator first` and `single-operator focused`
- the UI is labeled as read-only saved-deal and Operator Command surface
- the schema contains saved-deal data but no ownership or tenant model
- no multi-user permission system or auth provider is present in the repository

Intended callers:

- one approved internal operator or one trusted internal operator session

Authenticated caller access:

- any authenticated trusted internal operator may read all saved deals in the MVP model

Deal-level ownership:

- not required for the MVP model

Organization isolation:

- not required for the MVP model

External users:

- not supported

Classification scope:

- MVP-only, not permanent
- if more operators, customers, investors, or tenant boundaries are introduced later, that requires a separate access-model decision

## Selected MVP Access Model

Selected model:

`Single trusted internal operator access`

Authorization rule:

```text
verified trusted internal operator
-> may access all internal saved deals
```

Why this is the smallest safe model consistent with repository evidence:

- it matches the single-operator wording in the Phase 4A docs
- it does not invent ownership columns or tenant boundaries
- it avoids a larger RBAC, subscription, or public-sharing design
- it can be expressed as one reusable server-side guard

## Authentication Requirements

Documentation-level requirements for the future boundary:

- caller identity must be verified server-side
- authentication cannot rely on a client-provided user header
- authentication cannot rely on route obscurity
- authentication cannot rely on a confidentiality label
- authentication cannot rely on CORS alone
- unauthenticated requests must be rejected before saved-deal or PDF loader execution
- mocked tests must not require a live identity provider

Viable future approaches to assess, without selecting a large ecosystem yet:

- a narrow internal application session
- a verified platform-backed identity boundary, if later approved
- a separately approved identity provider

No provider is installed or selected in this phase.

## Authorization Requirements

For the selected MVP model:

```text
verified trusted internal operator
-> authorized for the internal saved-deal read surface
```

Required properties:

- authorization must be enforced server-side
- authorization must be reusable by sensitive saved-deal read routes
- authorization must not rely on route nesting or secrecy
- authorization must not rely on `INTERNAL USE ONLY`
- authorization must not rely on `Cache-Control: no-store`
- authorization must not require deal-level ownership for the MVP

Schema implication:

- the current schema is sufficient for the internal-operator MVP because the rule is principal-based, not deal-owned
- if a later model requires per-deal ownership or tenant isolation, that will need a separate schema phase

## Schema Support Assessment

Current saved-deal table shape:

- `id`
- `created_at`
- `updated_at`
- `archived_at`
- `address`
- `listing_url`
- `purchase_price`
- `gdv_realistic`
- `refurb_cost`
- `classification`
- `governance_state`
- `capital_protection_state`
- `pipeline_state`
- `engine_result_json`
- `risk_summary_json`
- `next_action`

Assessment:

- no owner, user, tenant, organization, or team columns exist
- that is compatible with the selected single-operator MVP
- that is not enough for future per-deal authorization or tenant isolation

## Minimal Reusable Guard Contract

Planned conceptual guard:

```ts
type SavedDealReadAccess =
  | {
      allowed: true;
      principal: {
        kind: "internal_operator";
      };
    }
  | {
      allowed: false;
      reason: "unauthenticated" | "unauthorized";
    };
```

Planned conceptual helper:

```ts
requireSavedDealReadAccess(request, dealId?)
```

Guard requirements:

- execute server-side
- verify caller identity
- apply the approved internal authorization rule
- return a narrow safe result
- avoid loading the PDF Evidence Pack before access succeeds
- avoid exposing whether a deal exists to unauthorized callers
- be mockable in route tests
- contain no business calculations
- contain no PDF-specific logic
- contain no database mutation
- be reusable by other sensitive saved-deal read routes

## Guard Placement Decision

Selected placement:

- shared server-side helper under `lib/operator-command/`
- imported by saved-deal read routes

Why this placement:

- it is the smallest reusable server-side boundary available in the repository shape
- `lib/security` does not exist yet
- middleware-only is insufficient because route context and authorization behavior still need to be enforced near the read loaders
- route-local-only would duplicate the same policy across multiple sensitive read routes

Planned file shape:

- `lib/operator-command/require-saved-deal-read-access.ts`

## Safe Request Sequence

General read-surface sequence:

```text
request
-> verify internal identity
-> authorize saved-deal read access
-> normalize route deal ID
-> call route business loader
-> return safe response
```

PDF Evidence Pack sequence:

```text
GET request
-> reusable saved-deal access guard
-> normalized deal ID
-> loadPdfEvidencePackForDeal(...)
-> safe JSON response
```

Loader constraint:

- the loader must not run before access succeeds

## Unauthenticated Behavior

Future behavior:

- HTTP `401`
- public code `AUTHENTICATION_REQUIRED`

Required handling:

- reject before any saved-deal or PDF loader runs
- do not trust client headers by themselves
- do not trust route obscurity

## Unauthorized Behavior

Future behavior:

- HTTP `404`
- privacy-preserving not-found response

Reason:

- the data is sensitive
- the application has no public share model
- unauthorized callers should not learn whether a saved deal exists

Response shape:

- do not expose a distinct authorization failure to the caller
- map to each route's safe not-found behavior where needed

## Deal-Existence Disclosure Policy

Policy for the future guard and routes that use it:

- authenticated but unauthorized callers receive privacy-preserving `404`
- authorized callers may still receive route-specific `404` when the deal genuinely does not exist
- the guard must not reveal deal existence before authorization passes
- `INTERNAL USE ONLY` is not access control
- random-looking ids are not access control
- `Cache-Control: no-store` is not authentication

## Sensitive Saved-Deal Route Inventory

| Route | Sensitive | Guard Required | Deal-Level Authorization Needed | Future Migration Priority |
| --- | ---: | ---: | ---: | --- |
| `GET /api/saved-deals` | Yes | Yes | No for the MVP model | Highest |
| `GET /api/saved-deals/[id]` | Yes | Yes | No for the MVP model | Highest |
| `GET /api/saved-deals/[id]/investor-summary` | Yes | Yes | No for the MVP model | High |
| `GET /api/saved-deals/[id]/investor-shield-ui` | Yes | Yes | No for the MVP model | High |
| `GET /api/saved-deals/[id]/evidence` | Yes | Yes | No for the MVP model | High |
| `GET /api/saved-deals/[id]/evidence/[evidenceId]` | Yes | Yes | No for the MVP model | High |
| `GET /api/saved-deals/[id]/offers` | Yes | Yes | No for the MVP model | Medium |
| `GET /api/saved-deals/[id]/tasks` | Yes | Yes | No for the MVP model | Medium |
| `GET /api/saved-deals/[id]/pdf-evidence-pack` | Yes | Yes | No for the MVP model | Highest |

Notes:

- the guard is intended to be reusable across all sensitive saved-deal read surfaces
- the MVP model does not require per-deal ownership
- if ownership or tenancy is added later, these routes will need a new authorization layer

## Controlled Future Implementation Steps

Recommended sequence:

1. Implement the minimal server-side identity guard and focused mocked tests.
2. Apply the same guard to one narrow saved-deal read route as proof.
3. Reuse the guard across the remaining sensitive saved-deal read routes.
4. Implement the PDF Evidence Pack GET route on top of the proven guard.

This phase does not begin any implementation step.

## Future Mocked-Test Expectations

Future tests should prove:

1. Unauthenticated request is rejected.
2. Authentication failure occurs before business loaders.
3. Unauthorized request does not reveal deal existence.
4. Authorized internal operator is permitted under the approved MVP model.
5. Guard result is deterministic.
6. Guard can be mocked without a live provider.
7. No client-provided identity header is trusted by itself.
8. No saved-deal or PDF loader is called after access failure.
9. No database write occurs.
10. No production configuration is required in unit tests.

If ownership becomes required later, add:

11. Caller cannot access a deal belonging to another principal.
12. Missing ownership information fails closed.

## Explicit Non-Goals

Do not add:

- a large RBAC system
- tenant administration
- subscription permissions
- a public investor portal
- an external invitation system
- a share-token system
- client access
- customer access
- PDF implementation
- database or schema changes in this phase

## Explicit Non-Implementation

Confirmed not done in this phase:

- no auth code added
- no authorization code added
- no middleware changed
- no route changed
- no route tests created
- no provider installed
- no database access
- no schema change
- no migration
- no UI
- no PDF generation
- no storage
- no persistence
- no external sharing
- no production access
- no deployment
- no environment change
- `.gitignore` untouched

## Verdict

`SAVED-DEAL INTERNAL ACCESS MODEL APPROVED — READY FOR MINIMAL IDENTITY GUARD IMPLEMENTATION`

## Recommended Next Step

`Implement the minimal server-side identity guard with focused mocked tests only.`
