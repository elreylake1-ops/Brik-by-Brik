# Phase 5A-4C PR 4C-1B-3A - Investor Shield Connection Pool Audit

## Purpose

Identify why the Preview Investor Shield read path exhausts Supabase session-mode connections and select the smallest safe correction without changing code, credentials, environment variables, deployments, or database records.

## Repository Baseline

```text
Branch: phase5a-4c-investor-review-professional-gateway
HEAD: 0b0f4d50cb96ed6f250872c728a041dffb3f5a12
origin/phase5a-4c-investor-review-professional-gateway: 0b0f4d50cb96ed6f250872c728a041dffb3f5a12
Latest commit: 0b0f4d5 docs: verify preview investor review runtime
Working tree: clean before documentation changes
```

## Preview Runtime Failure

Confirmed Preview runtime:

- `GET /api/saved-deals` -> `200`
- `GET /api/saved-deals/b619c646-7ee9-469d-bbb2-40d010b3f63e` -> `200`
- `GET /api/saved-deals/[id]/tasks` -> `200`
- `GET /api/saved-deals/[id]/offers` -> `200`
- `GET /saved-deals/[id]/review` -> safe unavailable state
- `GET /api/saved-deals/[id]/investor-shield-ui` -> `500`

Safe Investor Shield failure diagnostic:

```text
Public code: INVESTOR_SHIELD_UI_READ_FAILED
Database code: XX000
Pooler diagnostic: EMAXCONNSESSION
Session-mode limit: pool_size: 15
```

## Shared PostgreSQL Adapter

Canonical adapter:

- file: `lib/db/postgres.ts`
- one shared module-level `pg.Pool` variable: `let pool: Pool | null = null`
- lazy construction location: `getPostgresPool()`
- query path: `query()` -> `getPostgresPool().query(...)`
- direct test: `__tests__/postgres-adapter.test.ts`

Pool construction:

```text
new Pool({ connectionString: getDatabaseUrl() })
```

Findings:

- one shared canonical pool per loaded module instance: yes
- explicit `max`: no
- effective default `max` from installed `pg`/`pg-pool`: `10`
- explicit idle timeout: no
- effective idle timeout from installed `pg-pool`: `10000ms`
- explicit connection timeout: no
- effective connection timeout: none (`connectionTimeoutMillis` unset)
- explicit `ssl` option: no
- explicit pool cache across module reloads via `globalThis`: no
- development behavior: hot/module reload can recreate pool because cache is module-local only
- serverless behavior: warm instance can reuse its own module-local pool, but that pool is not shared across separate Vercel instances

## Runtime Pool Constructors

### SHARED CANONICAL POOL

- `lib/db/postgres.ts`

### SCRIPT-ONLY

- `scripts/check-db-connectivity-safe.ts`
- `scripts/phase4b7-investor-shield-runtime-proof.ts`
- `scripts/phase4c6c-investor-shield-task-persistence-proof.ts`
- `scripts/phase4c7d-investor-shield-pipeline-guard-proof.ts`

### TEST-ONLY

- no runtime `new Pool` constructor found in `__tests__`

### DUPLICATE RUNTIME POOL

- none found

### UNRESOLVED

- none

Conclusion:

```text
No Investor Shield runtime path creates a second production pool.
```

## Investor Shield Read Sequence

Exact runtime sequence:

```text
GET Investor Shield UI
-> app/api/saved-deals/[id]/investor-shield-ui/route.ts
-> getSavedDealById(id)
-> loadInvestorShieldUiModelForDeal(id)
-> loadInvestorShieldEvaluationInput(id)
-> Promise.all([
     listInvestorShieldChecksByDealId,
     listEvidenceItemsByDealId,
     listRiskFlagsByDealId,
     listManualOverridesByDealId
   ])
-> each repository uses query(...)
-> query(...) -> getPostgresPool().query(...)
-> evaluateInvestorShield(...)
-> buildInvestorShieldUiModel(...)
```

Findings:

- total repository reads for one Shield UI request: `5`
  - `1` saved-deal existence read
  - `4` Shield dependency reads
- post-existence Shield dependency reads: concurrent
- any function opens its own client: no
- any explicit client release path required: no, `pool.query()` auto-releases
- transactions used: no
- duplicate Shield evaluation inside one Shield request: no
- duplicate default-gate repository initialization: no, default gates are static in-memory config

## Vercel Serverless Pool Behavior

Likely runtime behavior:

- each warm Vercel serverless instance may create its own module-local `pg.Pool`
- each such pool may grow up to default `max = 10`
- Supabase session-mode pooler reported hard session limit `15`
- module-level singleton reduces duplication inside one instance only
- module-level singleton does not create one global pool across all Vercel instances

Implication:

- one warm instance can reserve up to `10` session connections
- two warm instances or overlapping route invocations can compete past session limit `15`
- idle pooled clients may remain open for about `10s`, so bursty traffic can temporarily retain session slots

## Connection Mode

Non-secret metadata and runtime evidence:

- host category: `pooler`
- current configured port from prior safe audit: `5432`
- runtime diagnostic explicitly identifies session-mode limit: `pool_size: 15`

Classification:

```text
SESSION POOLER
```

Expected fit for serverless workloads:

```text
Transaction pooler is preferred; current session pooler is poor fit.
```

## Port and Pooler Assessment

Repository documentation:

- `docs/phase4/PHASE_4A_LOCAL_ENV_SETUP.md` placeholder pooler format uses port `6543`
- prior safe Preview metadata audit recorded current runtime port `5432`
- current runtime diagnostic confirms session-mode exhaustion

Assessment:

- port `5432` is intentionally behaving as session mode in current credential
- documented port `6543` is consistent with intended transaction-pooler placeholder usage
- project documentation is not the main stale element here
- current Vercel credential is using unsuitable session-pooler mode for serverless execution

## Request Concurrency Assessment

### Application request behavior

- one Shield UI request performs `4` concurrent DB reads after saved-deal existence check
- one Investor Summary request performs `3` concurrent dependency reads after saved-deal existence check, including another Shield evaluation
- one Investor Review request duplicates saved-deal lookup, then performs `4` top-level concurrent dependency reads:
  - Shield evaluation
  - tasks
  - offers
  - Evidence Lite
- Shield evaluation inside Investor Review adds its own `4` concurrent repository reads

Result:

- one Investor Review request can fan out into multiple overlapping DB queries
- same deal may be re-read across route boundaries

### QA behavior

During prior Preview verification, separate manual GET calls were made for:

- Shield
- Evidence Lite
- Investor Summary
- tasks
- offers
- review page

Those manual checks included parallel route probing and therefore could add temporary pressure on pooled sessions.

Assessment:

```text
Observed pool exhaustion is mainly consistent with session-pooler unsuitability for serverless concurrency, and was likely amplified by request fan-out plus QA parallel GETs.
```

Reproducibility classification:

```text
Possibly amplified by QA sequence; single isolated Shield request alone is not proven as sole trigger from zero load.
```

## Client-Release Assessment

Findings:

- no `pool.connect()` in runtime code
- no manual checked-out clients in Shield runtime path
- no missing `client.release()` path
- no transactions lacking `finally`
- no streaming query path

Classification:

```text
NO CLIENT LEAK FOUND
```

## Root Cause

```text
A. Session pooler unsuitable for Vercel serverless concurrency
```

Evidence:

- runtime diagnostic explicitly reports session-mode exhaustion: `EMAXCONNSESSION`, `pool_size: 15`
- canonical runtime uses one clean shared pool, not duplicate pools
- no client leak evidence found
- default pool max `10` per instance is large relative to session limit `15`, but that is secondary to wrong connection mode
- module-local pool exists per serverless instance, not globally, so concurrent warm instances can exhaust session slots even with correct singleton code structure

## Primary Correction

```text
Connection-mode correction
```

Use approved Supabase transaction-pooler connection string intended for serverless execution for Preview, then redeploy Preview only.

## Secondary Safeguards

- After connection-mode correction, consider explicit conservative `max` on canonical shared pool in a later focused code phase only if exhaustion persists.
- Reduce duplicate read fan-out only if post-correction Preview still shows connection pressure.
- Keep QA runtime verification reads serialized when diagnosing connection pressure.

## Exact Next Implementation Boundary

`PR #4C-1B-3A-2 â€” Correct the Preview connection mode and redeploy only.`

## Deferred Evidence Lite Schema Issue

`The missing linked_investor_shield_gate column is not investigated or corrected in this phase.`

## Security Confirmation

Confirmed:

- no connection string printed
- no credential changed
- no environment variable changed
- no database mutation
- no migration
- no redeployment
- no application code change

## Result

`PR #4C-1B-3A COMPLETE â€” INVESTOR SHIELD CONNECTION-POOL ROOT CAUSE IDENTIFIED`

## Recommended Next Step

`PR #4C-1B-3A-2 â€” Correct the Preview connection mode and redeploy only.`
