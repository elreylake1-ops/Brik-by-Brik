import { afterAll, beforeAll, describe, expect, it } from "vitest"
import pg from "pg"
import { qaGate } from "./qa-gate"
import { cleanRehearsalFixtures } from "../../e2e/clean-rehearsal-fixtures"

const gate = qaGate("Rehearsal test cleanup isolation regression (isolated QA only)")
const describeIf = gate.enabled ? describe : describe.skip

describeIf("Rehearsal test cleanup isolation regression (isolated QA only)", () => {
  let pool: pg.Pool

  const SCHEMA = "brik_by_brik_engine"
  const SHARED_ADDRESS = "14 Victoria Promenade, Harrogate HG1 5ED"

  // 1. Baseline Demonstration Deal (must be preserved across all cleanup operations)
  const DEMO_DEAL_ID = "deal-wp4b-live-01"
  const DEMO_ASMT_ID = "asmt-wp4b-live-01"
  const DEMO_EVIDENCE_ID = "ev-quote-apex-01"

  // 2. Unrelated Third-Party Deal sharing the EXACT same address
  const THIRD_PARTY_DEAL_ID = "deal-same-address-shared-01"
  const THIRD_PARTY_ASMT_ID = "asmt-same-address-shared-01"
  const THIRD_PARTY_EVIDENCE_ID = "ev-same-address-quote-01"

  // 3. Test Rehearsal Deal (the one being setup, tested, and torn down)
  const REHEARSAL_DEAL_ID = "deal-rehearsal-nov6-regression"
  const REHEARSAL_ASMT_ID = "asmt-rehearsal-nov6-regression"
  const REHEARSAL_OPERATOR_SUBJECT = "sim-operator-ephemeral-test-subject"

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: gate.url })

    // Ensure baseline demonstration deal and its child records exist
    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state, pipeline_state,
        engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES (
        $1, $2, 450000, 750000, 50000,
        'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION',
        '{"deal":{"purchasePrice":450000,"gdv":750000,"refurbCost":50000,"totalCost":550000,"profit":120000}}'::jsonb,
        '{}'::jsonb, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [DEMO_DEAL_ID, SHARED_ADDRESS]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.viewing_assessments (
        id, deal_id, checklist_version, idempotency_key, created_by, created_at
      ) VALUES ($1, $2, 'v1', 'idemp-demo-deal', 'operator-qa', NOW())
      ON CONFLICT (deal_id, id) DO NOTHING`,
      [DEMO_ASMT_ID, DEMO_DEAL_ID]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.deal_evidence (
        id, deal_id, evidence_type, linked_gate, title, note, status, reviewed, created_at, updated_at
      ) VALUES (
        $1, $2, 'BUILDER_QUOTE', 'REFURB_CERTAINTY',
        'Apex Contractors Ltd - Fictional Quote APX-3500',
        'Itemised written quotation for bathroom refurbishment works: £3,500.00 gross (inclusive of VAT). Verified by operator.',
        'REVIEWED', TRUE, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [DEMO_EVIDENCE_ID, DEMO_DEAL_ID]
    )

    // Seed unrelated third-party deal with the EXACT same address
    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state, pipeline_state,
        engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES (
        $1, $2, 380000, 600000, 45000,
        'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION',
        '{"deal":{"purchasePrice":380000,"gdv":600000}}'::jsonb, '{}'::jsonb, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [THIRD_PARTY_DEAL_ID, SHARED_ADDRESS]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.viewing_assessments (
        id, deal_id, checklist_version, idempotency_key, created_by, created_at
      ) VALUES ($1, $2, 'v1', 'idemp-third-party', 'operator-qa', NOW())
      ON CONFLICT (deal_id, id) DO NOTHING`,
      [THIRD_PARTY_ASMT_ID, THIRD_PARTY_DEAL_ID]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.deal_evidence (
        id, deal_id, evidence_type, linked_gate, title, note, status, reviewed, created_at, updated_at
      ) VALUES (
        $1, $2, 'BUILDER_QUOTE', 'REFURB_CERTAINTY',
        'Third Party Contractor Quote', 'Separate quote', 'REVIEWED', TRUE, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [THIRD_PARTY_EVIDENCE_ID, THIRD_PARTY_DEAL_ID]
    )

    // Seed rehearsal fixtures with test records (even with the exact same address!)
    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state, pipeline_state,
        engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES (
        $1, $2, 450000, 750000, 50000,
        'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION',
        '{}'::jsonb, '{}'::jsonb, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [REHEARSAL_DEAL_ID, `${SHARED_ADDRESS} (Rehearsal)`]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.viewing_assessments (
        id, deal_id, checklist_version, idempotency_key, created_by, created_at
      ) VALUES ($1, $2, 'v1', 'idemp-rehearsal', 'operator-qa', NOW())
      ON CONFLICT (deal_id, id) DO NOTHING`,
      [REHEARSAL_ASMT_ID, REHEARSAL_DEAL_ID]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.contractor_quote_overrides (
        id, deal_id, assessment_id, item_id, task_id,
        quote_ref, approved_amount, approved_by, status, approved_at
      ) VALUES (
        'qov-rehearsal-01', $1, $2, 'bathroom', 'bathroom-task-01',
        'REH-QUOTE-01', 3500.00, 'operator-qa', 'APPROVED', NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [REHEARSAL_DEAL_ID, REHEARSAL_ASMT_ID]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.operator_sessions (session_hash, subject, created_at, last_seen_at, expires_at)
       VALUES ('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', $1, NOW(), NOW(), NOW() + INTERVAL '1 hour')
       ON CONFLICT (session_hash) DO NOTHING`,
      [REHEARSAL_OPERATOR_SUBJECT]
    )
  })

  afterAll(async () => {
    // Clean up only the third-party fixture created for this test; preserve demo deal
    await pool.query(`DELETE FROM ${SCHEMA}.deal_evidence WHERE deal_id = $1`, [THIRD_PARTY_DEAL_ID]).catch(() => undefined)
    await pool.query(`DELETE FROM ${SCHEMA}.viewing_assessments WHERE deal_id = $1`, [THIRD_PARTY_DEAL_ID]).catch(() => undefined)
    await pool.query(`DELETE FROM ${SCHEMA}.saved_deals WHERE id = $1`, [THIRD_PARTY_DEAL_ID]).catch(() => undefined)
    await pool.end()
  })

  it("1. A seeded demonstration deal survives rehearsal setup cleanup", async () => {
    // Run pre-test rehearsal cleanup targeting REHEARSAL_DEAL_ID
    await cleanRehearsalFixtures(pool, REHEARSAL_DEAL_ID, REHEARSAL_OPERATOR_SUBJECT, SCHEMA)

    const res = await pool.query(`SELECT id, address FROM ${SCHEMA}.saved_deals WHERE id = $1`, [DEMO_DEAL_ID])
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].id).toBe(DEMO_DEAL_ID)
    expect(res.rows[0].address).toBe(SHARED_ADDRESS)
  })

  it("2. A seeded demonstration deal survives rehearsal teardown cleanup", async () => {
    // Re-create rehearsal deal to simulate test execution
    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state, pipeline_state,
        engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES ($1, $2, 450000, 750000, 50000, 'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION', '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
      ON CONFLICT (id) DO NOTHING`,
      [REHEARSAL_DEAL_ID, `${SHARED_ADDRESS} (Rehearsal)`]
    )

    // Execute teardown cleanup
    await cleanRehearsalFixtures(pool, REHEARSAL_DEAL_ID, REHEARSAL_OPERATOR_SUBJECT, SCHEMA)

    const res = await pool.query(`SELECT id, address FROM ${SCHEMA}.saved_deals WHERE id = $1`, [DEMO_DEAL_ID])
    expect(res.rows).toHaveLength(1)
    expect(res.rows[0].id).toBe(DEMO_DEAL_ID)
    expect(res.rows[0].address).toBe(SHARED_ADDRESS)
  })

  it("3. Another deal sharing the exact same address cannot be deleted by rehearsal cleanup", async () => {
    // Verify third-party deal exists with identical SHARED_ADDRESS
    const checkBefore = await pool.query(`SELECT id, address FROM ${SCHEMA}.saved_deals WHERE id = $1`, [THIRD_PARTY_DEAL_ID])
    expect(checkBefore.rows[0]?.address).toBe(SHARED_ADDRESS)

    // Execute cleanup for rehearsal deal
    await cleanRehearsalFixtures(pool, REHEARSAL_DEAL_ID, REHEARSAL_OPERATOR_SUBJECT, SCHEMA)

    const checkAfter = await pool.query(`SELECT id, address FROM ${SCHEMA}.saved_deals WHERE id = $1`, [THIRD_PARTY_DEAL_ID])
    expect(checkAfter.rows).toHaveLength(1)
    expect(checkAfter.rows[0].id).toBe(THIRD_PARTY_DEAL_ID)
    expect(checkAfter.rows[0].address).toBe(SHARED_ADDRESS)
  })

  it("4. Only fixtures created by the test run are removed by cleanup", async () => {
    // Re-insert rehearsal deal, assessment, override, and operator session
    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (id, address, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json, created_at, updated_at)
       VALUES ($1, $2, 450000, 750000, 50000, 'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION', '{}'::jsonb, '{}'::jsonb, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [REHEARSAL_DEAL_ID, `${SHARED_ADDRESS} (Rehearsal)`]
    )
    await pool.query(
      `INSERT INTO ${SCHEMA}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by, created_at)
       VALUES ($1, $2, 'v1', 'idemp-rehearsal', 'operator-qa', NOW())
       ON CONFLICT (deal_id, id) DO NOTHING`,
      [REHEARSAL_ASMT_ID, REHEARSAL_DEAL_ID]
    )
    await pool.query(
      `INSERT INTO ${SCHEMA}.contractor_quote_overrides (
        id, deal_id, assessment_id, item_id, task_id, quote_ref, approved_amount, approved_by, status, approved_at
      ) VALUES (
        'qov-rehearsal-01', $1, $2, 'bathroom', 'bathroom-task-01', 'REH-QUOTE-01', 3500.00, 'operator-qa', 'APPROVED', NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [REHEARSAL_DEAL_ID, REHEARSAL_ASMT_ID]
    )
    await pool.query(
      `INSERT INTO ${SCHEMA}.operator_sessions (session_hash, subject, created_at, last_seen_at, expires_at)
       VALUES ('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', $1, NOW(), NOW(), NOW() + INTERVAL '1 hour')
       ON CONFLICT (session_hash) DO NOTHING`,
      [REHEARSAL_OPERATOR_SUBJECT]
    )

    // Execute cleanup
    await cleanRehearsalFixtures(pool, REHEARSAL_DEAL_ID, REHEARSAL_OPERATOR_SUBJECT, SCHEMA)

    // Rehearsal fixtures MUST be removed
    const rehDeal = await pool.query(`SELECT 1 FROM ${SCHEMA}.saved_deals WHERE id = $1`, [REHEARSAL_DEAL_ID])
    expect(rehDeal.rowCount).toBe(0)

    const rehAsmt = await pool.query(`SELECT 1 FROM ${SCHEMA}.viewing_assessments WHERE id = $1`, [REHEARSAL_ASMT_ID])
    expect(rehAsmt.rowCount).toBe(0)

    const rehQov = await pool.query(`SELECT 1 FROM ${SCHEMA}.contractor_quote_overrides WHERE id = 'qov-rehearsal-01'`)
    expect(rehQov.rowCount).toBe(0)

    const rehSess = await pool.query(`SELECT 1 FROM ${SCHEMA}.operator_sessions WHERE subject = $1`, [REHEARSAL_OPERATOR_SUBJECT])
    expect(rehSess.rowCount).toBe(0)
  })

  it("5. Related demonstration assessments, evidence and contractor quotations remain completely intact", async () => {
    // Execute cleanup again
    await cleanRehearsalFixtures(pool, REHEARSAL_DEAL_ID, REHEARSAL_OPERATOR_SUBJECT, SCHEMA)

    // Demo assessment check
    const asmtRes = await pool.query(
      `SELECT id, deal_id, checklist_version FROM ${SCHEMA}.viewing_assessments WHERE id = $1 AND deal_id = $2`,
      [DEMO_ASMT_ID, DEMO_DEAL_ID]
    )
    expect(asmtRes.rows).toHaveLength(1)
    expect(asmtRes.rows[0].id).toBe(DEMO_ASMT_ID)

    // Demo evidence check
    const evRes = await pool.query(
      `SELECT id, deal_id, evidence_type, title, status FROM ${SCHEMA}.deal_evidence WHERE id = $1 AND deal_id = $2`,
      [DEMO_EVIDENCE_ID, DEMO_DEAL_ID]
    )
    expect(evRes.rows).toHaveLength(1)
    expect(evRes.rows[0].evidence_type).toBe("BUILDER_QUOTE")
    expect(evRes.rows[0].title).toBe("Apex Contractors Ltd - Fictional Quote APX-3500")
    expect(evRes.rows[0].status).toBe("REVIEWED")

    // Third party evidence check
    const tpEvRes = await pool.query(
      `SELECT id, deal_id FROM ${SCHEMA}.deal_evidence WHERE id = $1 AND deal_id = $2`,
      [THIRD_PARTY_EVIDENCE_ID, THIRD_PARTY_DEAL_ID]
    )
    expect(tpEvRes.rows).toHaveLength(1)
  })

  it("6. Explicitly refuses to clean protected demonstration deal or operator session", async () => {
    // Passing persistent demonstration deal must reject immediately
    await expect(
      cleanRehearsalFixtures(pool, DEMO_DEAL_ID, undefined, SCHEMA)
    ).rejects.toThrow(/REFUSING: .* is a protected demonstration deal/)

    // Passing arbitrary non-rehearsal deal must reject
    await expect(
      cleanRehearsalFixtures(pool, "deal-production-unrelated", undefined, SCHEMA)
    ).rejects.toThrow(/REFUSING: .* is not an authorized test fixture deal ID/)

    // Passing persistent demonstration operator subject must reject
    await expect(
      cleanRehearsalFixtures(pool, REHEARSAL_DEAL_ID, "sim-operator-8b84104391ad", SCHEMA)
    ).rejects.toThrow(/REFUSING: .* is a protected demonstration operator/)

    // Confirm demonstration deal and evidence remain in database after rejection
    const demoDeal = await pool.query(`SELECT id FROM ${SCHEMA}.saved_deals WHERE id = $1`, [DEMO_DEAL_ID])
    expect(demoDeal.rows).toHaveLength(1)
  })
})
