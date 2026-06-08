## Purpose
Plan a controlled production proof fixture for verifying saved-deal detail and Investor Shield UI success paths.

## Current Verified Baseline
- Production ownership/runtime status: `VERIFIED FOR SAFE READ-ONLY MVP RUNTIME`
- Root page status: `200`
- Saved-deals list status: `200`
- Missing detail 404 status: `404`
- Missing Investor Shield UI 404 status: `404`
- Verified schema/table status:
  - `brik_by_brik_engine.saved_deals`
  - `brik_by_brik_engine.deal_offers`
  - `brik_by_brik_engine.deal_tasks`
  - `brik_by_brik_engine.investor_shield_checks`
  - `brik_by_brik_engine.evidence_items`
  - `brik_by_brik_engine.risk_flags`
  - `brik_by_brik_engine.manual_overrides`
  - `brik_by_brik_engine.builder_proposals`
  - `brik_by_brik_engine.builder_contract_checks`

## Why A Fixture Is Needed
- Current production read-only runtime is verified only for list success and missing-ID safe 404.
- A real `saved_deals` row is needed to verify the detail success path.
- Investor Shield UI success path may require related rows in `investor_shield_checks` and related tables.
- Fixture must be clearly marked, reversible, and minimal.

## Fixture Design
Proposed temporary fixture:
- deterministic id: `r12_proof_fixture_001`
- address: `R12 PROOF FIXTURE - DO NOT USE AS REAL CLIENT DEAL`
- classification: `PROOF_ONLY`
- governance_state: `PROOF_ONLY`
- capital_protection_state: `PROOF_ONLY`
- pipeline_state: `UNDER_ANALYSIS`
- minimal engine_result_json:
  - `{"verdict":{"status":"ANALYSIS_ONLY"},"dueDiligence":{"decision":{"capitalProtectionStatus":"PROOF_ONLY"}}}`
- minimal risk_summary_json:
  - `{"warnings":["Production proof fixture only"],"riskFlags":[]}`
- next_action: `Proof fixture verification only`
- created_at / updated_at approach:
  - use explicit timestamp values in the fixture insert
  - keep them identical on insert for deterministic review

Use only columns confirmed in production:
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

## Investor Shield Fixture Options

### Option A - saved_deals only
- verifies saved-deal detail route
- Investor Shield UI may return incomplete/empty model or require related checks
- safest first option

### Option B - saved_deals plus minimal Investor Shield checks
- verifies Investor Shield UI success route more completely
- requires inserting default `investor_shield_checks` rows
- optionally no evidence/risk/override rows unless required

Recommended: Option A first.

## Proposed Read-Only Proof Checks After Fixture
- `GET /api/saved-deals`
- `GET /api/saved-deals/{fixtureId}`
- `GET /api/saved-deals/{fixtureId}/investor-shield-ui`

Expected:
- list includes fixture or returns successfully
- detail returns `200`
- Investor Shield UI returns either `200` with expected model or documented safe incomplete state
- no `500`

## Rollback / Cleanup Plan
- delete only fixture rows by deterministic fixture id
- delete related Investor Shield rows by fixture `deal_id` if inserted
- verify route returns `404` after cleanup
- do not touch real rows

## Safety Rules
- fixture must not look like a real client deal
- fixture id must be unique and documented
- no real personal/client data
- no secrets
- no production migrations
- no broad delete
- no destructive cleanup beyond fixture id
- operator approval required before insertion

## Manual SQL Drafts
NOT TO RUN UNTIL OPERATOR APPROVES R13.

### Read-only precheck for fixture id existence
```sql
select id
from brik_by_brik_engine.saved_deals
where id = 'r12_proof_fixture_001';
```

### Insert saved_deals fixture
```sql
begin;

insert into brik_by_brik_engine.saved_deals (
  id,
  created_at,
  updated_at,
  archived_at,
  address,
  listing_url,
  purchase_price,
  gdv_realistic,
  refurb_cost,
  classification,
  governance_state,
  capital_protection_state,
  pipeline_state,
  engine_result_json,
  risk_summary_json,
  next_action
) values (
  'r12_proof_fixture_001',
  timestamptz '2026-06-08 00:00:00+00',
  timestamptz '2026-06-08 00:00:00+00',
  null,
  'R12 PROOF FIXTURE - DO NOT USE AS REAL CLIENT DEAL',
  null,
  null,
  null,
  null,
  'PROOF_ONLY',
  'PROOF_ONLY',
  'PROOF_ONLY',
  'UNDER_ANALYSIS',
  '{"verdict":{"status":"ANALYSIS_ONLY"},"dueDiligence":{"decision":{"capitalProtectionStatus":"PROOF_ONLY"}}}'::jsonb,
  '{"warnings":["Production proof fixture only"],"riskFlags":[]}'::jsonb,
  'Proof fixture verification only'
);

commit;
```

### Optional insert Investor Shield checks only if required
```sql
begin;

insert into brik_by_brik_engine.investor_shield_checks (
  id,
  deal_id,
  gate_key,
  sub_gate_key,
  status,
  severity,
  confidence,
  required_evidence,
  summary,
  created_at,
  updated_at
) values (
  gen_random_uuid()::text,
  'r12_proof_fixture_001',
  'TITLE',
  null,
  'REQUIRED',
  'LOW',
  'UNKNOWN',
  '[]'::jsonb,
  'Proof fixture check',
  timestamptz '2026-06-08 00:00:00+00',
  timestamptz '2026-06-08 00:00:00+00'
);

commit;
```

### Read-only verification query
```sql
select
  id,
  address,
  classification,
  governance_state,
  capital_protection_state,
  pipeline_state
from brik_by_brik_engine.saved_deals
where id = 'r12_proof_fixture_001';
```

### Cleanup SQL by fixture id
```sql
begin;

delete from brik_by_brik_engine.investor_shield_checks
where deal_id = 'r12_proof_fixture_001';

delete from brik_by_brik_engine.saved_deals
where id = 'r12_proof_fixture_001';

commit;
```

## Result
PLANNED ONLY

## Recommended Next Step
Phase 4A-R13 - Controlled Production Proof Fixture Execution

R13 should proceed only if operator approves temporary production fixture insertion.
