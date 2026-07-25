# Phase 5A-4C PR 4C-1B-1 - Database Authentication Mismatch Audit

## Purpose

Determine why the current Preview `DATABASE_URL` is rejected by PostgreSQL, identify the exact approved replacement source, and define the next correction without changing credentials, redeploying, modifying code, or accessing database records.

## Repository Baseline

```text
Branch: phase5a-4c-investor-review-professional-gateway
HEAD: 69b48913eb880a946cd60a51ecd9971c9712ccd0
origin/phase5a-4c-investor-review-professional-gateway: 69b48913eb880a946cd60a51ecd9971c9712ccd0
Latest commit: 69b4891 docs: verify preview database restoration
Working tree: clean before documentation changes
```

## Preview Deployment

```text
Preview URL: https://brik-by-brik-engine-klwv2grx9-brikbybrik-engine.vercel.app
Deployment ID: dpl_7kawLWLnQigbR7Un69MBF1GbVUhg
Project: brik-by-brik-engine
Scope: brikbybrik-engine
Target: preview
Status: Ready
```

## Confirmed Runtime Error

Route checked:

```text
GET /api/saved-deals
```

Observed result:

- HTTP `500`
- safe error: `SAVED_DEALS_READ_FAILED`
- PostgreSQL code: `28P01`
- prior missing-`DATABASE_URL` error: gone
- current diagnostic class: authentication failure

## Current Credential Source Classification

Current Preview credential source:

```text
local .env.local
```

How this was determined:

- PR `#4C-1B` repo record states Preview `DATABASE_URL` was added from local secret material during the branch-scoped Preview correction.
- current local `.env.local` contains a real `DATABASE_URL` secret line and is explicitly documented as local-only.

Classification:

```text
APPROVED BUT STALE
```

Reason:

- repository evidence shows `.env.local` was once an authorized source for a prior production correction;
- repository handover docs also state `.env.local` is local-only and not an authoritative ongoing production secret store;
- current Preview auth failure proves the copied Preview value is not the currently accepted working runtime credential.

## Non-Secret Connection Metadata Comparison

### Current Preview Source Metadata

Derived from local `.env.local` without printing the value:

| Field | Current Preview Source |
| --- | --- |
| Provider | `postgresql` |
| Host category | `pooler` |
| Masked host shape | `*.pooler.supabase.com` |
| Port | `5432` |
| Database name | `postgres` |
| Username format | `postgres.project_ref` |
| Placeholder tokens | `absent` |

### Known Approved Runtime Target Metadata

From repository documentation:

| Field | Approved Runtime Target |
| --- | --- |
| Database target | `Brik by Brik Engine — Production Database` |
| Provider family | PostgreSQL / Supabase |
| Host category | `pooler` |
| Documented pooler placeholder format | `postgres.PROJECT_REF@aws-0-REGION.pooler.supabase.com:6543/postgres` |
| Runtime variable | `DATABASE_URL` |

### Comparison Result

- provider family: aligned
- host category: aligned (`pooler`)
- database name: aligned (`postgres`)
- username shape: aligned with documented pooler username form
- port: current Preview source uses `5432`; documented placeholder pooler format uses `6543`
- exact project reference: not safely verified in this audit
- exact password: not inspected

## Authentication-Failure Cause

```text
A. Stale password
```

Evidence supporting this cause:

- runtime now reaches PostgreSQL and fails specifically with `28P01`
- current Preview source was copied from local `.env.local`, not from the current authoritative live Vercel Production secret
- non-secret connection metadata broadly matches the expected Supabase/Postgres pooler shape, so the failure is not best explained by a totally different provider or database family

Secondary note:

- current local secret also carries an encoding risk signal, so the stale credential may also be stored in a form that is not safe to keep using as an authority source

## Encoding Assessment

```text
ENCODING RISK IDENTIFIED
```

This audit confirmed the local secret may contain characters that require URL-safe handling. The value was not printed or rewritten.

## Approved Replacement Source

```text
current Production Vercel DATABASE_URL for brik-by-brik-engine
```

Why this is the approved replacement source:

- Production remains the only documented current working runtime credential source
- Production runtime is already verified against the intended Brik by Brik Engine database target
- repo docs do not establish local `.env.local` as the authoritative ongoing secret source

## Preview Database Environment Model

Current repository evidence supports:

```text
Preview uses the same database as Production.
```

Basis:

- historical repo evidence recorded `DATABASE_URL` present for both `Production` and `Preview`
- the only documented live database target is `Brik by Brik Engine — Production Database`
- no separate Preview database is documented anywhere in the inspected repository evidence

Risk note:

- this controlled Preview model means Preview read-only verification can expose live production data shapes if broader UI proof work is done carelessly

## Exact Correction Required

Replace the branch-scoped Preview `DATABASE_URL` with the current Production Vercel `DATABASE_URL` for the linked `brik-by-brik-engine` project, then redeploy the current feature branch Preview deployment.

## Security Confirmation

Confirmed:

- no credential printed
- no environment variable changed
- no redeployment
- no database record accessed or mutated
- no Production setting changed
- no application code changed

## Result

`PR #4C-1B-1 COMPLETE — DATABASE AUTHENTICATION ROOT CAUSE IDENTIFIED`

## Recommended Next Step

`PR #4C-1B-2 — Replace the Preview DATABASE_URL with the approved current credential and redeploy Preview.`
