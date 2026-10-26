import type pg from "pg"

export type RehearsalOwnershipManifest = {
  dealId: string
  operatorSubject?: string
  createdDeal: boolean
  assessmentIds: string[]
  evidenceIds: string[]
  proposalIds: string[]
  planIds: string[]
  videoJobIds: string[]
  screenshotDirectory: string
}

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

export async function assertRehearsalFixtureAbsent(
  client: pg.Pool | pg.Client,
  dealId: string,
  schema = "brik_by_brik_engine"
): Promise<void> {
  assertRehearsalDealTarget(dealId)
  const result = await client.query(`SELECT 1 FROM ${schema}.saved_deals WHERE id = $1`, [dealId])
  if (result.rowCount) {
    throw new Error(`Rehearsal fixture collision: ${dealId} already exists; refusing pre-run cleanup or adoption`)
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
  ownership: RehearsalOwnershipManifest | string,
  legacyOperatorSubjectOrSchema = "brik_by_brik_engine",
  legacySchema?: string
): Promise<void> {
  if (typeof ownership === "string") {
    throw new Error(`Rehearsal cleanup refused for ${ownership}: ownership manifest required`)
  }
  const schema = legacySchema ?? legacyOperatorSubjectOrSchema
  const { dealId, operatorSubject } = ownership
  if (!ownership.createdDeal || !ownership.screenshotDirectory) {
    throw new Error(`Rehearsal cleanup retained ${dealId}: incomplete ownership manifest; manual recovery required`)
  }
  assertRehearsalDealTarget(dealId)
  if (operatorSubject) {
    assertRehearsalOperatorSubject(operatorSubject)
  }

  const run = async (label: string, text: string, values: unknown[]) => {
    try {
      return await client.query(text, values)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new Error(`Rehearsal cleanup failed at ${label} for ${dealId}: ${detail}`)
    }
  }

  if (ownership.evidenceIds.length === 0 || ownership.assessmentIds.length === 0) {
    throw new Error(`Rehearsal cleanup retained ${dealId}: child ownership is incomplete; manual recovery required`)
  }

  // Only exact identifiers recorded after successful creation are eligible.
  await run("deal evidence", `DELETE FROM ${schema}.deal_evidence WHERE id = ANY($1) AND deal_id = $2`, [ownership.evidenceIds, dealId])

  // 2. Video frames & video jobs only when the current run owner is known.
  if (!operatorSubject) {
    console.warn(`Rehearsal cleanup retained video jobs for ${dealId}: run owner unavailable; manual review required.`)
  } else {
    if (ownership.videoJobIds.length === 0) {
      console.warn(`Rehearsal cleanup retained video media for ${dealId}: no verified job ownership; manual review required.`)
    } else {
      await run("video frames", `DELETE FROM ${schema}.video_frames WHERE job_id = ANY($1)`, [ownership.videoJobIds])
      await run(
        "video retention policy",
        `UPDATE ${schema}.video_jobs
         SET original_retention_policy = 'OWNER_SCHEDULED_PURGE',
             retention_decision_notes = 'Owner James Lake authorized rehearsal cleanup'
         WHERE id = ANY($1) AND deal_id = $2 AND created_by = $3`,
        [ownership.videoJobIds, dealId, operatorSubject]
      )
      await run("video jobs", `DELETE FROM ${schema}.video_jobs WHERE id = ANY($1) AND deal_id = $2 AND created_by = $3`, [ownership.videoJobIds, dealId, operatorSubject])
    }
  }

  // 3. Child viewing entities only for explicitly recorded assessment IDs.
  await run("viewing proposals", `DELETE FROM ${schema}.viewing_proposals WHERE assessment_id = ANY($1)`, [ownership.assessmentIds])
  await run(
    "evidence blobs",
    `DELETE FROM ${schema}.viewing_evidence_blobs WHERE evidence_id = ANY($1)`,
    [ownership.evidenceIds]
  )
  await run("viewing evidence", `DELETE FROM ${schema}.viewing_evidence WHERE id = ANY($1)`, [ownership.evidenceIds])
  await run("analysis runs", `DELETE FROM ${schema}.viewing_analysis_runs WHERE assessment_id = ANY($1)`, [ownership.assessmentIds])
  await run("viewing assets", `DELETE FROM ${schema}.viewing_assets WHERE assessment_id = ANY($1)`, [ownership.assessmentIds])
  await run("refurb plans", `DELETE FROM ${schema}.refurb_plans WHERE id = ANY($1) AND assessment_id = ANY($2)`, [ownership.planIds, ownership.assessmentIds])
  await run("financial proposals", `DELETE FROM ${schema}.financial_proposals WHERE id = ANY($1) AND assessment_id = ANY($2)`, [ownership.proposalIds, ownership.assessmentIds])

  // 4. Viewing assessments strictly for this deal
  await run("viewing assessments", `DELETE FROM ${schema}.viewing_assessments WHERE id = ANY($1) AND deal_id = $2`, [ownership.assessmentIds, dealId])

  // 5. Saved deal strictly for this deal ID (zero address-based deletion)
  await run("saved deal", `DELETE FROM ${schema}.saved_deals WHERE id = $1`, [dealId])

  // 6. Test operator session strictly for the ephemeral subject
  if (operatorSubject) {
    await run("operator session", `DELETE FROM ${schema}.operator_sessions WHERE subject = $1`, [operatorSubject])
  }
}
