# Phase 4A-R1 Production Ownership / Environment Retest Plan

## Purpose
This document plans GitHub, Vercel, and Supabase ownership/retest checks before production-ready classification.

## Current Project Status
- Phase 4C backend enforcement complete
- Phase 4D read-only UI complete
- tests/build/lint passing
- production ownership/retest still pending

## Production Readiness Rule
The system must not be called production-ready until GitHub, Vercel, and Supabase ownership/access are confirmed clean and a safe environment retest is completed.

## Ownership Areas To Verify

### GitHub
Plan checks for:
- correct repository ownership
- correct remote URL
- expected branch
- clean working tree
- latest commit present on remote
- repository move notice resolved or documented
- collaborator/access expectations

### Vercel
Plan checks for:
- correct Vercel project
- correct linked GitHub repo/branch
- deployment status
- build command
- environment variables present without exposing values
- preview vs production deployment clarity
- domain status if applicable

### Supabase
Plan checks for:
- correct Supabase project
- correct schema: `brik_by_brik_engine`
- `saved_deals.id` remains `TEXT`
- Investor Shield tables exist
- environment `DATABASE_URL` points to intended project without printing the secret
- read/write proof plan is safe and reversible
- no destructive migration needed

## Safe Retest Plan
Plan future retests only:
- `npm test`
- `npm run build`
- `npm run lint`
- safe DB connectivity check without printing secrets
- safe Investor Shield read-only API check
- safe saved deal read check
- optional controlled test deal only if approved

## Secrets / Safety Rules
- never print secrets
- never commit env files
- never expose service role keys
- never run destructive SQL
- never mutate production data without explicit approval
- use masked/presence-only env reporting

## Risks
- GitHub remote moved notice
- wrong Vercel project linked
- wrong Supabase project or schema
- stale env variables
- accidental production mutation
- calling staging production-ready too early

## Recommended Micro-Steps
- Phase 4A-R2 GitHub Ownership / Remote Audit Only
- Phase 4A-R3 Vercel Project / Env Presence Audit Only
- Phase 4A-R4 Supabase Project / Schema Presence Audit Only
- Phase 4A-R5 Safe Environment Retest Runtime Proof
- Phase 4A-R6 Production Ownership Closeout

## Recommended Next Step
Phase 4A-R2 — GitHub Ownership / Remote Audit Only

