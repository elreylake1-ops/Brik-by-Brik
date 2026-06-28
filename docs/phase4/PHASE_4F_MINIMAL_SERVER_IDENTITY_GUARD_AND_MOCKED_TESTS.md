# Minimal Server Identity Guard and Mocked Tests

## Purpose

Implement the approved fail-closed identity seam and reusable saved-deal read guard without wiring it into routes yet.

This phase is documentation, code, and focused mocked-test work only. No route integration is added here.

## Repository Baseline

| Item | Value |
| --- | --- |
| Branch | `main` |
| `HEAD` | `472a3330c9f7b2bb6a5c8e5c19d83b030b1a1284` |
| `origin/main` | `472a3330c9f7b2bb6a5c8e5c19d83b030b1a1284` |
| Remote | `https://github.com/elreylake1-ops/Brik-by-Brik.git` |
| Dirty state before this plan | only the pre-existing unstaged `.gitignore` modification |

## Files Inspected

- `docs/phase4/PHASE_4F_SAVED_DEAL_INTERNAL_ACCESS_MODEL_AND_MINIMAL_GUARD_PLAN.md`
- `docs/phase4/PHASE_4F_PDF_EVIDENCE_PACK_ACCESS_CONTROL_BOUNDARY_RESOLUTION.md`
- `lib/http/safe-route-error.ts`
- `lib/operator-command/`
- existing pure-helper tests
- existing module-mocking patterns
- existing route error-code conventions
- `tsconfig.json`
- `package.json`

## Files Added or Changed

- `lib/operator-command/trusted-internal-operator-identity.ts`
- `lib/operator-command/require-saved-deal-read-access.ts`
- `__tests__/trusted-internal-operator-identity.test.ts`
- `__tests__/require-saved-deal-read-access.test.ts`
- `docs/phase4/PHASE_4F_MINIMAL_SERVER_IDENTITY_GUARD_AND_MOCKED_TESTS.md`

## Approved MVP Access Model

The approved MVP access model remains:

`SINGLE TRUSTED INTERNAL OPERATOR`

Authorization rule:

```text
verified trusted internal operator
-> may read the internal saved-deal surface
```

No deal ownership or tenant isolation is introduced.

## Trusted Internal Operator Principal

Principal contract:

```ts
export type TrustedInternalOperatorPrincipal = {
  kind: "internal_operator";
  subject: string;
};
```

Meaning:

- `kind` identifies the approved internal principal shape
- `subject` is the stable server-side identity value carried forward by the resolver

## Identity Resolver Boundary

Resolver contract:

```ts
export async function resolveTrustedInternalOperatorIdentity(
  request: Request,
): Promise<TrustedInternalOperatorIdentityResult>;
```

Resolver states:

- `authenticated`
- `unauthenticated`
- `unauthorized`

## Fail-Closed Default Behavior

The default resolver implementation fails closed.

Behavior:

- no verified server identity integration is present yet
- the resolver returns `unauthenticated`
- arbitrary headers are ignored
- no hardcoded operator password, token, email, or secret is used
- no client-provided identity header is trusted

## Saved-Deal Read Access Guard

Guard contract:

```ts
export async function requireSavedDealReadAccess(
  request: Request,
  dealId?: string,
): Promise<SavedDealReadAccessResult>;
```

Guard result states:

- allowed with a preserved trusted principal
- denied with `401 / AUTHENTICATION_REQUIRED`
- denied with privacy-preserving `404 / SAVED_DEAL_NOT_FOUND`

## Allowed Result

Allowed result shape:

- `allowed: true`
- `principal.kind: "internal_operator"`
- `principal.subject` preserved from the resolver

## Unauthenticated Result

Unauthenticated result shape:

- `allowed: false`
- `reason: "unauthenticated"`
- `status: 401`
- `code: "AUTHENTICATION_REQUIRED"`

## Unauthorized Privacy-Preserving Result

Unauthorized result shape:

- `allowed: false`
- `reason: "unauthorized"`
- `status: 404`
- `code: "SAVED_DEAL_NOT_FOUND"`

The denial result does not reveal whether the saved deal exists.

## Unexpected Resolver-Failure Behavior

Unexpected resolver failure fails closed.

Behavior:

- the guard returns the unauthenticated denial shape
- the guard does not expose the thrown error
- the guard does not become authorized
- the guard does not query saved deals

## Deal-ID Boundary

The optional `dealId` is accepted only for future evolution of the authorization seam.

Current behavior:

- no ownership check is performed
- no deal existence lookup is performed
- no authorization is inferred from the `dealId`
- collection/list compatibility is preserved when `dealId` is omitted

## No Ownership or Tenant Lookup

Confirmed absent from this phase:

- no ownership lookup
- no tenant lookup
- no organization lookup
- no repository call
- no database adapter call

## No Client-Header Trust

Confirmed absent from the resolver and guard:

- no `x-user-id`
- no `x-role`
- no `x-operator`
- no client-controlled identity proof

## Mocking Strategy

Resolver tests:

- call the real resolver
- pass requests with illustrative headers
- assert fail-closed behavior

Guard tests:

- mock the resolver boundary
- assert the exact request is passed once
- assert each identity result maps to the expected safe access decision
- assert no saved-deal lookup or database call occurs

## Focused Test Coverage

Covered scenarios:

1. Unauthenticated request is denied with `401 / AUTHENTICATION_REQUIRED`.
2. Unauthorized identity is denied with privacy-preserving `404 / SAVED_DEAL_NOT_FOUND`.
3. Verified internal operator is allowed.
4. Resolver receives the exact request once.
5. Deal ID does not trigger existence lookup.
6. Omitted deal ID remains supported.
7. Resolver rejection fails closed.
8. Client headers do not authenticate the caller.
9. Same mocked identity result yields deterministic guard output.
10. Tests do not require live infrastructure.

## Provider Integration Status

- no provider selected
- no provider installed
- default runtime resolver rejects access
- provider integration requires a separately approved phase

## Route Integration Status

- no route uses the guard yet
- saved-deal routes remain unchanged
- PDF Evidence Pack route remains unimplemented

## Explicit Non-Implementation

Confirmed not done in this phase:

- no route integration
- no middleware
- no auth provider
- no session issuance
- no login UI
- no user table
- no ownership fields
- no tenant model
- no roles or permissions
- no database query
- no migration
- no API mutation
- no UI change
- no PDF route
- no PDF generation
- no storage
- no sharing
- no production access
- no deployment
- no environment change
- `.gitignore` untouched

## Result

`MINIMAL SERVER IDENTITY GUARD COMPLETE — FAIL-CLOSED MOCKED BOUNDARY VERIFIED`

## Recommended Next Step

`Apply the proven guard to the saved-deal detail GET route with focused mocked route tests only.`
