import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import pg from "pg"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..")
const envFile = path.join(root, ".qa-local", "pg.env")
const envContent = readFileSync(envFile, "utf8")
const user = envContent.match(/POSTGRES_USER=([^\r\n]+)/)?.[1] || "brik_qa"
const pass = envContent.match(/POSTGRES_PASSWORD=([^\r\n]+)/)?.[1] || ""
const db = envContent.match(/POSTGRES_DB=([^\r\n]+)/)?.[1] || "brik_viewing_qa_local"

const dbUrl = `postgres://${user}:${pass}@127.0.0.1:54339/${db}`
const pool = new pg.Pool({ connectionString: dbUrl })

const dealId = "deal-wp4b-live-01"
const assessmentId = "asmt-wp4b-live-01"

console.log("Seeding fresh WP4B demo deal into PostgreSQL:", dealId, assessmentId)

// 1. Saved Deal
await pool.query(
  `INSERT INTO brik_by_brik_engine.saved_deals (
    id, address, purchase_price, gdv_realistic, refurb_cost,
    classification, governance_state, capital_protection_state, pipeline_state,
    engine_result_json, risk_summary_json, created_at, updated_at
  ) VALUES (
    $1, '14 Victoria Promenade, Harrogate HG1 5ED', 450000, 750000, 50000,
    'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION',
    '{"deal":{"purchasePrice":450000,"gdv":750000,"refurbCost":50000,"totalCost":550000,"profit":120000,"trueMao":{"twentyPercent":450875}}}'::jsonb,
    '{}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING`,
  [dealId]
)

// 2. Fictional Contractor Quotation Evidence in deal_evidence table
await pool.query(
  `INSERT INTO brik_by_brik_engine.deal_evidence (
    id, deal_id, evidence_type, linked_gate, title, note, status, reviewed, created_at, updated_at
  ) VALUES (
    'ev-quote-apex-01', $1, 'BUILDER_QUOTE', 'REFURB_CERTAINTY',
    'Apex Contractors Ltd - Fictional Quote APX-3500',
    'Itemised written quotation for bathroom refurbishment works: £3,500.00 gross (inclusive of VAT). Verified by operator.',
    'REVIEWED', TRUE, NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING`,
  [dealId]
)

// 3. Viewing Assessment
await pool.query(
  `INSERT INTO brik_by_brik_engine.viewing_assessments (
    id, deal_id, checklist_version, idempotency_key, created_by, created_at
  ) VALUES (
    $1, $2, 'v1', 'idemp-wp4b-live-01', 'operator-qa', NOW()
  ) ON CONFLICT (deal_id, id) DO NOTHING`,
  [assessmentId, dealId]
)

// 4. Asset and evidence frames
await pool.query(
  `INSERT INTO brik_by_brik_engine.viewing_assets (
    id, assessment_id, filename, mime_type, size_bytes, duration_seconds, source, created_by, created_at
  ) VALUES (
    'asset-live-01', $1, 'walkthrough.mp4', 'video/mp4', 12345678, 120, 'DECLARED_METADATA', 'operator-qa', NOW()
  ) ON CONFLICT (id) DO NOTHING`,
  [assessmentId]
)

await pool.query(
  `INSERT INTO brik_by_brik_engine.viewing_evidence (
    id, assessment_id, asset_id, timestamp_seconds, room, ordinal, created_at
  ) VALUES
    ('ev-live-f1', $1, 'asset-live-01', 25, 'Bathroom', 0, NOW()),
    ('ev-live-f2', $1, 'asset-live-01', 40, 'Kitchen', 1, NOW())
  ON CONFLICT (id) DO NOTHING`,
  [assessmentId]
)

// 5. Analysis Run
await pool.query(
  `INSERT INTO brik_by_brik_engine.viewing_analysis_runs (
    id, assessment_id, idempotency_key, provider, model_version, status, attempt_count, created_by, created_at, updated_at
  ) VALUES (
    'run-live-01', $1, 'idemp-run-live-01', 'mock', 'm1', 'READY_FOR_REVIEW', 1, 'operator-qa', NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING`,
  [assessmentId]
)

// 6. Viewing Proposals (Bathroom works C41 + Kitchen works C39)
await pool.query(
  `INSERT INTO brik_by_brik_engine.viewing_proposals (
    id, assessment_id, run_id, check_id, status, observation, evidence_ids, ordinal, room, confidence, model_version, verification, created_at
  ) VALUES
    ('prop-live-bath', $1, 'run-live-01', 'C41', 'CONCERN', 'Observed bathroom sanitaryware and fittings need partial refurbishment', ARRAY['ev-live-f1'], 0, 'Bathroom', 'high', 'm1', 'UNVERIFIED', NOW()),
    ('prop-live-kitch', $1, 'run-live-01', 'C39', 'CONCERN', 'Kitchen cabinetry and worktops worn, refresh recommended', ARRAY['ev-live-f2'], 1, 'Kitchen', 'high', 'm1', 'UNVERIFIED', NOW())
  ON CONFLICT (id) DO NOTHING`,
  [assessmentId]
)

// 7. Human Reviews (accepted findings)
await pool.query(
  `INSERT INTO brik_by_brik_engine.viewing_reviews (
    id, proposal_id, assessment_id, revision, disposition, edited_status, edited_observation, reason, reviewer_id, reviewed_at
  ) VALUES
    ('rv-live-bath', 'prop-live-bath', $1, 1, 'ACCEPTED', NULL, NULL, 'Confirmed works required', 'operator-qa', NOW()),
    ('rv-live-kitch', 'prop-live-kitch', $1, 1, 'ACCEPTED', NULL, NULL, 'Confirmed works required', 'operator-qa', NOW())
  ON CONFLICT (id) DO NOTHING`,
  [assessmentId]
)

console.log("Seeding complete! Deal ID:", dealId, "Assessment ID:", assessmentId)
await pool.end()
