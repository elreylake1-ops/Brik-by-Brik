# Phase 5A-4C PR 4C-1B - Preview DATABASE_URL Restoration and Runtime Verification

## Purpose

Record the Preview `DATABASE_URL` restoration attempt, the resulting Preview redeployment, and the saved-deal runtime verification outcome without changing application code or mutating database records.

## Repository Baseline

```text
Branch: phase5a-4c-investor-review-professional-gateway
HEAD: 8225800ff20667037b720f499b97537da22fd60c
origin/phase5a-4c-investor-review-professional-gateway: 8225800ff20667037b720f499b97537da22fd60c
Latest commit: 8225800 docs: audit preview database configuration
Working tree: clean before documentation changes
```

## Vercel Project

```text
Project: brik-by-brik-engine
Project ID: prj_AbokvX7ZPyaX9zw3i7U579Q2bzNb
Org ID: team_iIqoB5QTKVCU0i9LtSuY6keD
Scope: brikbybrik-engine
```

## Preview Environment Correction

- `DATABASE_URL` was added to `Preview`.
- Vercel required branch-scoped Preview targeting for this non-interactive flow.
- Applied Preview target: `phase5a-4c-investor-review-professional-gateway`
- Value was not disclosed.
- Production remained unchanged.
- No credential rotation occurred.

Presence-by-name after correction:

| Variable       | Preview |
| -------------- | ------: |
| `DATABASE_URL` | Present |

## New Preview Deployment

```text
URL: https://brik-by-brik-engine-klwv2grx9-brikbybrik-engine.vercel.app
Deployment ID: dpl_7kawLWLnQigbR7Un69MBF1GbVUhg
Target: preview
Status: Ready
Created: 2026-07-25 18:34:09 +08:00
Deployed commit: 8225800ff20667037b720f499b97537da22fd60c
```

## Saved-Deals Read Verification

Route checked:

```text
GET /api/saved-deals
```

Observed result:

- HTTP status: `500`
- response shape: safe JSON error envelope with `success`, `error`, `traceId`, `diagnostic`
- `SAVED_DEALS_READ_FAILED`: still present
- prior missing-variable failure: resolved
- current failure category: database authentication failure
- current diagnostic code: `28P01`
- no connection string, password, or stack trace exposed

The missing-`DATABASE_URL` blocker is no longer the active failure. Runtime now reaches database-authentication boundary and fails there.

## Investor Review Runtime Verification

Deal ID checked:

```text
4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863
```

Review path checked:

```text
/saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/review
```

Observed result:

- usable Investor Review content did **not** render
- route still rendered `Investor review temporarily unavailable`
- no secret leakage observed
- no visible internal stack trace observed

## Read-Only Verification

Only safe reads were used:

- `GET /api/saved-deals`
- `GET /saved-deals/4b0e02bc-1cc6-40d2-a6b0-d7685c2b6863/review`

No:

- `POST`
- `PUT`
- `PATCH`
- `DELETE`
- task creation
- evidence mutation
- offer mutation
- pipeline movement
- migration execution

## Production Safety Confirmation

Confirmed:

- Production `DATABASE_URL` remains present
- Production deployment remained `dpl_BcEeFuUj9AsaQwmQQdqPMAHsdTbu`
- Production alias remained `https://brik-by-brik-engine-chi.vercel.app`
- no Production deployment was created in this task
- no Production environment variable was modified

## Security Confirmation

Confirmed:

- no secret printed
- no env file committed
- no database mutation
- no migration
- no application code change

## Explicit Non-Implementation

Confirmed no:

- desktop visual QA
- mobile visual QA
- final screenshots
- PR creation
- merge
- Production deployment
- code change
- database change
- Investor Shield mutation
- Evidence Lite mutation
- task, offer, or pipeline mutation
- formula or classification change

## Result

`PR #4C-1B PARTIALLY COMPLETE — PREVIEW ENV RESTORED BUT SAVED-DEAL READ STILL FAILS`

## Recommended Next Step

Investigate and correct the Preview `DATABASE_URL` credential/authentication mismatch, then redeploy Preview and re-run the read-only saved-deal runtime verification before PR `#4C-1C`.
