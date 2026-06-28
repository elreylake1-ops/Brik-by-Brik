# PDF Evidence Pack Access-Control Boundary Resolution

## Purpose

Determine whether the planned PDF Evidence Pack GET route can reuse an existing authenticated and authorized request boundary.

This phase is inspection and security-boundary planning only. No route, auth code, or authorization code is implemented.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `eab6bcdc847ef9aa1f32bf5a36d7e7c288c05d57` |
| `origin/main` | `eab6bcdc847ef9aa1f32bf5a36d7e7c288c05d57` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this plan | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_GET_ROUTE_AND_SAFE_RESPONSE_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_AGGREGATION_REPOSITORY_AND_MOCKED_TESTS.md`
- `lib/pdf-evidence-pack/load-pdf-evidence-pack.ts`
- `lib/pdf-evidence-pack/pdf-evidence-pack-types.ts`
- `app/api/saved-deals/route.ts`
- `app/api/saved-deals/[id]/route.ts`
- `app/api/saved-deals/[id]/investor-summary/route.ts`
- `app/api/saved-deals/[id]/investor-shield-ui/route.ts`
- `app/api/saved-deals/[id]/evidence/route.ts`
- `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts`
- `app/api/saved-deals/[id]/offers/route.ts`
- `app/api/saved-deals/[id]/tasks/route.ts`
- `app/api/saved-deals/[id]/pipeline/route.ts`
- `__tests__/saved-deals-api-route.test.ts`
- `__tests__/saved-deals-api-detail-route.test.ts`
- `__tests__/investor-summary-route.test.ts`
- `__tests__/investor-shield-ui-route.test.ts`
- `__tests__/evidence-lite-api-route.test.ts`
- `__tests__/evidence-lite-item-api-route.test.ts`
- `__tests__/deal-offers-api-route.test.ts`
- `__tests__/deal-tasks-api-route.test.ts`
- `__tests__/saved-deals-pipeline-route.test.ts`
- `__tests__/pdf-evidence-pack-contract.test.ts`
- `package.json`
- `README.md`
- `AGENTS.md`
- `LEAN-CTX.md`
- `lib/http/safe-route-error.ts`

## Existing PDF Evidence Pack Route Plan

Selected route path:

`app/api/saved-deals/[id]/pdf-evidence-pack/route.ts`

Approved success envelope:

```json
{
  "success": true,
  "pack": {}
}
```

Safe error codes:

- `PDF_EVIDENCE_PACK_INVALID_ID`
- `PDF_EVIDENCE_PACK_NOT_FOUND`
- `PDF_EVIDENCE_PACK_READ_FAILED`

Privacy boundary:

- return only the existing `PdfEvidencePack`
- do not append owner names, contact details, raw SQL, signed URLs, file bytes, OCR output, AI summaries, or internal diagnostics to success responses
- do not add any database details to safe errors

Fixed confidentiality label:

`INTERNAL USE ONLY`

Reason implementation is blocked:

- no proven authenticated caller boundary exists in the repository
- no proven authorization or deal-ownership boundary exists in the repository
- no reusable request guard was found to inherit safely
- no route tests prove `401` / `403` behavior for saved-deal access

## Current Saved-Deal Access-Control Inventory

| Route | Authentication Check | Authorization Check | Deal Ownership Check | Classification |
| --- | --- | --- | --- | --- |
| `app/api/saved-deals/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/investor-summary/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/investor-shield-ui/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/evidence/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/evidence/[evidenceId]/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/offers/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/tasks/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |
| `app/api/saved-deals/[id]/pipeline/route.ts` | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL | NO APPLICATION ACCESS CONTROL |

Notes:

- `getSavedDealById(...)` is only an existence gate.
- `evaluateOperatorGuard(...)` and Investor Shield guards are business-rule guards, not caller authentication or deal authorization.
- route tests in this repository assert `400`, `404`, `409`, and `500` responses, but they do not prove authenticated access control.

## Authentication Versus Authorization

Authentication finding:

- no application identity system is present in the repository evidence
- no `middleware.ts`, `proxy.ts`, `auth.ts`, `lib/auth/**`, `lib/security/**`, or `lib/session/**` was found
- no `getServerSession`, `requireAuth`, `requireUser`, Clerk, Auth.js, or NextAuth configuration was found
- `package.json` does not declare authentication dependencies

Authorization finding:

- no request-level saved-deal authorization helper was found
- no deal ownership check was found
- no tenant, organization, role, or permission model was found
- route handlers check existence or business invariants, but not caller entitlement to the requested deal

Application access model:

- no application identity model
- unresolved future access requirements
- no repository evidence supports a claim of authenticated and authorized deal access

## PDF Evidence Pack Sensitivity Classification

The pack is sensitive even though it is read-only JSON.

It can expose:

- deal and financial information
- True MAO
- Investor Summary content
- Investor Shield results
- task context
- offer context
- Evidence Lite titles and notes
- risk and due-diligence information

Confirmed:

- `INTERNAL USE ONLY` is not access control
- a random-looking deal ID is not access control
- read-only access can still leak sensitive information
- structured JSON is still sensitive
- `Cache-Control: no-store` is not authentication

## Existing Access-Boundary Candidates

| Candidate | Exists | Authenticates | Authorizes Deal Access | Testable Locally | Suitable | Decision |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Existing application session guard | No | No | No | No | No | Rejected |
| Existing authorization helper | No | No | No | No | No | Rejected |
| Existing deal-ownership check | No | No | No | No | No | Rejected |
| Existing trusted single-operator boundary | No evidence | No | No | No | No | Rejected |
| Verified platform deployment protection | Unverified | No | No | No | No | `UNVERIFIED — NOT SUFFICIENT FOR ROUTE IMPLEMENTATION APPROVAL` |
| Verified service-to-service authentication | No evidence | No | No | No | No | Rejected |
| No usable boundary | Yes | No | No | Yes | No | Chosen blocked decision |

## Infrastructure-Protection Assessment

Finding:

- no verified platform-level protection was found that can be used as a route-implementation approval boundary
- local repository evidence does not prove any production-only access gate
- route nesting, secrecy, UUIDs, `Cache-Control: no-store`, and confidentiality labels are not access controls
- the route cannot be approved on infrastructure assumptions alone

## Reusable-Boundary Decision

Decision C - No safe application boundary exists.

Why:

- the repository has no proven authenticated caller boundary
- the repository has no proven authorization or deal-access boundary
- the existing saved-deal routes are open application handlers with existence gates only
- no reusable guard can be inherited safely for the PDF Evidence Pack route

## Unauthenticated and Unauthorized Behavior

No approved route behavior exists yet for these cases because the reusable security boundary is missing.

Current decision:

- unauthenticated requests: not approved for implementation yet
- authenticated but unauthorized requests: not approved for implementation yet
- the next security phase must define these behaviors before route implementation can begin

## Deal-Existence Disclosure Policy

The route implementation is not approved to decide deal-existence disclosure until a reusable access boundary exists.

Current policy:

- do not implement `403` or privacy-preserving `404` semantics yet
- do not reveal deal existence or absence policy through the route until the security phase defines caller identity and deal entitlement
- do not treat `INTERNAL USE ONLY` or non-obvious ids as access controls

## Future Mocked Access-Test Expectations

The next security phase, if approved, should add mocked tests for:

- unauthenticated request behavior
- authenticated but unauthorized request behavior
- deal-existence handling under the approved access policy
- safe rejection without leaking stack traces or pack contents
- no repository reads before the access guard

The current phase does not authorize creating those tests.

## Route-Implementation Readiness Checklist

- Reusable auth guard exists: No
- Reusable authorization guard exists: No
- Deal-ownership model exists: No
- Auth or session helpers exist: No
- 401 / 403 access tests exist: No
- Platform protection is verified locally: No
- Route implementation approved: No

## Minimum Separate Security Work Required

Smallest next security phase:

- approve the internal saved-deal access model
- define one reusable server-side saved-deal access guard
- prove caller identity and deal entitlement before the PDF Evidence Pack route is implemented
- add focused mocked tests for the guard
- apply the guard consistently to the relevant saved-deal read routes

Do not design:

- complex RBAC
- subscriptions
- public investor portals
- external invitations
- share-token systems
- multi-tenant administration
- CRM permission systems

## Explicit Non-Implementation

Confirmed not done in this phase:

- no route implemented
- no route tests created
- no auth code added
- no authorization code added
- no middleware changed
- no API route changed
- no aggregation or composer change
- no database access
- no migration
- no UI
- no PDF generation
- no storage or persistence
- no sharing token
- no production access
- no deployment
- no environment change
- `.gitignore` untouched

## Verdict

PDF EVIDENCE PACK ACCESS BOUNDARY BLOCKED — NO SAFE ACCESS MODEL EXISTS

## Recommended Next Step

Plan the smallest reusable saved-deal authentication and authorization boundary before implementing the PDF Evidence Pack route.
