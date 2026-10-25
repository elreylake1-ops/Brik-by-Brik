import type pg from "pg"

const PROTECTED_DEMO_DEALS = new Set([
  "deal-wp4b-live-01",
  "deal-17408-blue-jay",
])

const PROTECTED_OPERATOR_SUBJECTS = new Set([
  "sim-operator-8b84104391ad",
])

/**
 * Validates that the target deal ID is an authorized test fixture and not a protected demonstration deal.
 * Throws immediately if a protected demonstration deal ID is provided.
 */
export function assertRehearsalDealTarget(dealId: string): void {
  if (!dealId || typeof dealId !== "string") {
    throw new Error("Rehearsal cleanup rejected: missing or invalid dealId")
  }
  if (PROTECTED_DEMO_DEALS.has(dealId) || dealId.includes("live") || dealId.includes("demo")) {
    throw new Error(`REFUSING: ${dealId} is a protected demonstration deal and cannot be deleted by rehearsal teardown`)
  }
  if (
    !dealId.startsWith("deal-rehearsal-") &&
    !dealId.startsWith("deal-local-upload-") &&
    !dealId.startsWith("deal-wp4b-qa-")
  ) {
    throw new Error(`REFUSING: ${dealId} is not an authorized test fixture deal ID`)
  }
}

/**
 * Validates that the operator subject is not a protected persistent demonstration session.
 */
export function assertRehearsalOperatorSubject(subject: string): void {
  if (PROTECTED_OPERATOR_SUBJECTS.has(subject)) {
    throw new Error(`REFUSING: ${subject} is a protected demonstration operator and cannot be deleted by rehearsal teardown`)
  }
}

/**
 * Isolated cleanup for rehearsal test fixtures.
 * Strictly scopes all deletions to the specified test deal ID and optional operator subject.
 * Rejects protected demonstration deals and sessions.
 * Never deletes records by property address, wildcard pattern, or unverified foreign keys.
 */
export async function cleanRehearsalFixtures(
  client: pg.Pool | pg.Client,
  dealId: string,
  operatorSubject?: string,
  schema = "brik_by_brik_engine"
): Promise<void> {
  assertRehearsalDealTarget(dealId)
  if (operatorSubject) {
    assertRehearsalOperatorSubject(operatorSubject)
  }

  // 1. Contractor quote overrides, investor shield checks, and evidence strictly for this deal
  await client.query(`DELETE FROM ${schema}.contractor_quote_overrides WHERE deal_id = $1`, [dealId]).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.investor_shield_checks WHERE deal_id = $1`, [dealId]).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.deal_evidence WHERE deal_id = $1`, [dealId]).catch(() => undefined)

  // 2. Video frames & video jobs strictly for this deal
  await client.query(
    `DELETE FROM ${schema}.video_frames WHERE job_id IN (SELECT id FROM ${schema}.video_jobs WHERE deal_id = $1)`,
    [dealId]
  ).catch(() => undefined)
  await client.query(
    `UPDATE ${schema}.video_jobs
     SET original_retention_policy = 'OWNER_SCHEDULED_PURGE',
         retention_decision_notes = 'Owner James Lake authorized rehearsal cleanup'
     WHERE deal_id = $1`,
    [dealId]
  ).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.video_jobs WHERE deal_id = $1`, [dealId]).catch(() => undefined)

  // 3. Child viewing assessment entities strictly for this deal
  const asmtSubquery = `SELECT id FROM ${schema}.viewing_assessments WHERE deal_id = $1`
  await client.query(`DELETE FROM ${schema}.viewing_proposals WHERE assessment_id IN (${asmtSubquery})`, [dealId]).catch(() => undefined)
  await client.query(
    `DELETE FROM ${schema}.viewing_evidence_blobs WHERE evidence_id IN (
       SELECT id FROM ${schema}.viewing_evidence WHERE assessment_id IN (${asmtSubquery})
     )`,
    [dealId]
  ).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.viewing_evidence WHERE assessment_id IN (${asmtSubquery})`, [dealId]).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.viewing_analysis_runs WHERE assessment_id IN (${asmtSubquery})`, [dealId]).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.viewing_assets WHERE assessment_id IN (${asmtSubquery})`, [dealId]).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.refurb_plans WHERE assessment_id IN (${asmtSubquery})`, [dealId]).catch(() => undefined)
  await client.query(`DELETE FROM ${schema}.financial_proposals WHERE assessment_id IN (${asmtSubquery})`, [dealId]).catch(() => undefined)

  // 4. Viewing assessments strictly for this deal
  await client.query(`DELETE FROM ${schema}.viewing_assessments WHERE deal_id = $1`, [dealId]).catch(() => undefined)

  // 5. Saved deal strictly for this deal ID (zero address-based deletion)
  await client.query(`DELETE FROM ${schema}.saved_deals WHERE id = $1`, [dealId]).catch(() => undefined)

  // 6. Test operator session strictly for the ephemeral subject
  if (operatorSubject) {
    await client.query(`DELETE FROM ${schema}.operator_sessions WHERE subject = $1`, [operatorSubject]).catch(() => undefined)
  }
}
