## Purpose
This document gives a safe manual checklist for verifying Vercel project ownership/linkage/env completeness before production-ready classification.

## Current Baseline
- Current branch: `main`
- Latest commit: `0524c6b`
- Origin URL: `https://github.com/karloangeloalamares-cyber/Brik-by-Brik.git`
- R7D local runtime status: verified; local runtime success path returned `200`
- R8 Vercel status: partially verified; project exists as `superseded staging Vercel project` and production URL is ready, but repo/branch/deployment linkage was not fully confirmed from the safe local checks
- R9 env completeness status: partially verified; `DATABASE_URL` is the only runtime-required env var identified, and local presence was confirmed only in `.env.local`
- Current production-ready classification: blocked

## What Must Be Verified In Vercel Dashboard
- [ ] Vercel project name is `superseded staging Vercel project`
- [ ] Production domain is `[superseded deployment removed from active acceptance scope]`
- [ ] Linked GitHub repository matches the expected origin repo
- [ ] Production branch is `main`
- [ ] Latest deployment commit matches the intended GitHub commit
- [ ] Production deployment status is `Ready`
- [ ] Preview deployment behavior is understood
- [ ] Project owner/team is known
- [ ] Build command matches repo expectations
- [ ] Install command matches repo expectations
- [ ] Output/framework settings match Next.js expectations

## Required Production Env Names
### Currently runtime-required
- `DATABASE_URL`

### Not currently runtime-required based on R9
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VERCEL_URL`
- `VERCEL_PROJECT_ID`

## Manual Dashboard Verification Steps
1. Open the Vercel dashboard.
2. Select project `superseded staging Vercel project`.
3. Check Git repository linkage.
4. Confirm production branch.
5. Open the latest production deployment.
6. Confirm deployment commit.
7. Open `Settings` -> `Environment Variables`.
8. Confirm `DATABASE_URL` exists for `Production`.
9. Confirm whether it also exists for `Preview` if preview deployments are expected.
10. Do not reveal or copy values into the repo.

## Pass / Fail Criteria
### PASS only if:
- GitHub repo matches origin.
- Production branch is `main`.
- Latest production deployment commit is known and intentional.
- `DATABASE_URL` exists in `Production`.
- Production deployment is `Ready`.
- No mismatch in project ownership/team.

### PARTIAL if:
- project exists and production is `Ready`, but repo/branch/env cannot be confirmed.

### FAIL/BLOCKED if:
- wrong repo linked
- wrong branch linked
- `DATABASE_URL` missing in `Production`
- production deployment commit is unknown or stale
- project ownership cannot be confirmed

## Safety Confirmation
- no secrets printed
- no env files committed
- no Vercel settings changed
- no Supabase settings changed
- no DB mutation
- no runtime behavior changed
- no code changed except documentation

## Operator Evidence To Capture
Record text-only evidence for:
- project name
- linked repo name
- linked branch
- latest deployment commit hash
- production deployment status
- `DATABASE_URL` presence: yes/no only
- preview `DATABASE_URL` presence: yes/no/not applicable only
- project owner/team name

Do not request screenshots containing env values.

## Result
- `VERIFIED`
- `PARTIALLY VERIFIED`
- `BLOCKED`

## Recommended Next Step
If `VERIFIED`:
Recommend Phase 4A-R10 Ã¢â‚¬â€ Full Safe Runtime Success-Path Retest.

If `PARTIALLY VERIFIED` or `BLOCKED`:
Recommend resolving Vercel linkage/env visibility before any production-ready classification.

