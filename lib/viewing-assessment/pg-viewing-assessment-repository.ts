import { randomUUID } from "node:crypto"
import type { PoolClient, QueryResultRow } from "pg"
import { getPostgresPool, query } from "@/lib/db/postgres"
import type {
  AnalysisRunRecord,
  AnalysisRunStatus,
  FeedbackEntry,
  ProposalWithReview,
  StoredProposal,
  StoredReview,
  ViewingAssessmentRecord,
  ViewingAssetRecord,
} from "@/types/viewing-assessment"
import {
  MAX_RUN_ATTEMPTS,
  RUN_LEASE_SECONDS,
  RunLeaseLostError,
  type ViewingAssessmentRepository,
} from "./viewing-assessment-repository"

// Postgres implementation. Targets brik_by_brik_engine.viewing_* (migration 20261020, NOT yet applied).
// Not exercised by the automated tests (no live database); the in-memory double in
// __tests__/fixtures covers the interface semantics. Verify against the isolated QA database first.
// No query selects storage_key, so it cannot reach any API response.

const S = "brik_by_brik_engine"
const UNIQUE_VIOLATION = "23505"

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))
const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === UNIQUE_VIOLATION

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPostgresPool().connect()
  try {
    await client.query("BEGIN")
    const result = await fn(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

const mapAssessment = (r: QueryResultRow): ViewingAssessmentRecord => ({
  id: r.id,
  dealId: r.deal_id,
  checklistVersion: r.checklist_version,
  createdBy: r.created_by,
  createdAt: iso(r.created_at),
})

const mapAsset = (r: QueryResultRow): ViewingAssetRecord => ({
  id: r.id,
  assessmentId: r.assessment_id,
  filename: r.filename,
  mimeType: r.mime_type,
  sizeBytes: Number(r.size_bytes),
  durationSeconds: Number(r.duration_seconds),
  contentSha256: r.content_sha256,
  source: r.source,
  createdAt: iso(r.created_at),
})

const mapRun = (r: QueryResultRow): AnalysisRunRecord => ({
  id: r.id,
  assessmentId: r.assessment_id,
  provider: r.provider,
  modelVersion: r.model_version,
  status: r.status as AnalysisRunStatus,
  attemptCount: r.attempt_count,
  proposalsCount: r.proposals_count,
  rejectedCount: r.rejected_count,
  errorCode: r.error_code,
  createdAt: iso(r.created_at),
  updatedAt: iso(r.updated_at),
})

const mapProposal = (r: QueryResultRow): StoredProposal => ({
  id: r.id,
  assessmentId: r.assessment_id,
  runId: r.run_id,
  checkId: r.check_id,
  status: r.status,
  observation: r.observation,
  evidenceIds: r.evidence_ids,
  ...(r.room ? { room: r.room } : {}),
  confidence: r.confidence,
  ...(r.suggested_work ? { suggestedWork: r.suggested_work } : {}),
  modelVersion: r.model_version,
  verification: "UNVERIFIED",
  disposition: "PENDING",
  createdAt: iso(r.created_at),
})

const mapReview = (r: QueryResultRow): StoredReview => ({
  id: r.id,
  proposalId: r.proposal_id,
  revision: r.revision,
  disposition: r.disposition,
  editedStatus: r.edited_status,
  editedObservation: r.edited_observation,
  reason: r.reason,
  reviewerId: r.reviewer_id,
  reviewedAt: iso(r.reviewed_at),
})

const ASSESSMENT_FIELDS = "id, deal_id, checklist_version, created_by, created_at"
const ASSET_FIELDS =
  "id, assessment_id, filename, mime_type, size_bytes, duration_seconds, content_sha256, source, created_at"
const RUN_FIELDS =
  "id, assessment_id, provider, model_version, status, attempt_count, proposals_count, rejected_count, error_code, created_at, updated_at"

async function assessmentInDeal(
  run: (text: string, values: unknown[]) => Promise<{ rows: QueryResultRow[] }>,
  dealId: string,
  assessmentId: string
): Promise<boolean> {
  const r = await run(`SELECT 1 FROM ${S}.viewing_assessments WHERE id = $1 AND deal_id = $2`, [
    assessmentId,
    dealId,
  ])
  return r.rows.length > 0
}

export const pgViewingAssessmentRepository: ViewingAssessmentRepository = {
  async createAssessment({ dealId, idempotencyKey, checklistVersion, createdBy }) {
    const inserted = await query(
      `INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (deal_id, idempotency_key) DO NOTHING
       RETURNING ${ASSESSMENT_FIELDS}`,
      [randomUUID(), dealId, checklistVersion, idempotencyKey, createdBy]
    )
    if (inserted.rows[0]) return { record: mapAssessment(inserted.rows[0]), created: true }

    const existing = await query(
      `SELECT ${ASSESSMENT_FIELDS} FROM ${S}.viewing_assessments WHERE deal_id = $1 AND idempotency_key = $2`,
      [dealId, idempotencyKey]
    )
    return { record: mapAssessment(existing.rows[0]), created: false }
  },

  async listAssessments(dealId) {
    const r = await query(
      `SELECT ${ASSESSMENT_FIELDS} FROM ${S}.viewing_assessments WHERE deal_id = $1 ORDER BY created_at DESC, id DESC`,
      [dealId]
    )
    return r.rows.map(mapAssessment)
  },

  async getAssessment(dealId, assessmentId) {
    const r = await query(
      `SELECT ${ASSESSMENT_FIELDS} FROM ${S}.viewing_assessments WHERE id = $1 AND deal_id = $2`,
      [assessmentId, dealId]
    )
    return r.rows[0] ? mapAssessment(r.rows[0]) : null
  },

  async addAsset(dealId, assessmentId, { asset, frames, createdBy }) {
    try {
      return await withTransaction(async (client) => {
        const run = (t: string, v: unknown[]) => client.query(t, v)
        if (!(await assessmentInDeal(run, dealId, assessmentId))) return null

        const assetRow = await client.query(
          `INSERT INTO ${S}.viewing_assets
             (id, assessment_id, filename, mime_type, size_bytes, duration_seconds, content_sha256, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${ASSET_FIELDS}`,
          [
            randomUUID(),
            assessmentId,
            asset.filename,
            asset.mimeType,
            asset.sizeBytes,
            asset.durationSeconds,
            asset.contentSha256,
            createdBy,
          ]
        )
        const record = mapAsset(assetRow.rows[0])
        const evidence = []
        for (const [ordinal, frame] of frames.entries()) {
          const id = randomUUID()
          await client.query(
            `INSERT INTO ${S}.viewing_evidence
               (id, assessment_id, asset_id, timestamp_seconds, requested_timestamp_seconds, capture_method, capture_confidence, room, ordinal)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, assessmentId, record.id, frame.timestampSeconds, frame.requestedTimestampSeconds ?? null, frame.captureMethod ?? null, frame.captureConfidence ?? null, frame.room ?? null, ordinal]
          )
          evidence.push({
            id,
            assetId: record.id,
            clipFilename: record.filename,
            timestampSeconds: frame.timestampSeconds,
            ...(frame.requestedTimestampSeconds !== undefined ? { requestedTimestampSeconds: frame.requestedTimestampSeconds } : {}),
            ...(frame.captureMethod ? { captureMethod: frame.captureMethod } : {}),
            ...(frame.captureConfidence ? { captureConfidence: frame.captureConfidence } : {}),
            ...(frame.room ? { room: frame.room } : {}),
          })
        }
        return { status: "ok" as const, asset: record, evidence }
      })
    } catch (error) {
      if (isUniqueViolation(error)) return { status: "duplicate_asset" as const }
      throw error
    }
  },

  async listAssets(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const r = await query(
      `SELECT ${ASSET_FIELDS} FROM ${S}.viewing_assets WHERE assessment_id = $1 ORDER BY created_at, id`,
      [assessmentId]
    )
    return r.rows.map(mapAsset)
  },

  async getEvidenceContext(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const assets = await query(
      `SELECT id, duration_seconds FROM ${S}.viewing_assets WHERE assessment_id = $1`,
      [assessmentId]
    )
    const evidence = await query(
      `SELECT e.id, e.asset_id, e.timestamp_seconds, e.requested_timestamp_seconds, e.capture_method, e.capture_confidence, e.room, a.filename
       FROM ${S}.viewing_evidence e JOIN ${S}.viewing_assets a ON a.id = e.asset_id
       WHERE e.assessment_id = $1 ORDER BY a.created_at, a.id, e.timestamp_seconds, e.ordinal`, // clip, then time, then submission position: never a generated id
      [assessmentId]
    )
    return {
      assets: assets.rows.map((r) => ({ id: r.id, durationSeconds: Number(r.duration_seconds) })),
      evidence: evidence.rows.map((r) => ({
        id: r.id,
        assetId: r.asset_id,
        clipFilename: r.filename,
        timestampSeconds: Number(r.timestamp_seconds),
        ...(r.requested_timestamp_seconds !== null ? { requestedTimestampSeconds: Number(r.requested_timestamp_seconds) } : {}),
        ...(r.capture_method ? { captureMethod: r.capture_method } : {}),
        ...(r.capture_confidence ? { captureConfidence: r.capture_confidence } : {}),
        ...(r.room ? { room: r.room } : {}),
      })),
    }
  },

  async startRun(dealId, assessmentId, { idempotencyKey, modelVersion, createdBy, leaseSeconds, provider }) {
    const lease = leaseSeconds ?? RUN_LEASE_SECONDS
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const inserted = await query(
      `INSERT INTO ${S}.viewing_analysis_runs
         (id, assessment_id, idempotency_key, provider, model_version, status, created_by)
       VALUES ($1, $2, $3, $6, $4, 'RUNNING', $5)
       ON CONFLICT (assessment_id, idempotency_key) DO NOTHING
       RETURNING ${RUN_FIELDS}`,
      [randomUUID(), assessmentId, idempotencyKey, modelVersion, createdBy, provider ?? "mock"]
    )
    if (inserted.rows[0]) return { run: mapRun(inserted.rows[0]), created: true }

    // Reclaim a FAILED run, or a RUNNING run whose lease expired, while attempts remain. A single UPDATE:
    // concurrent claimants serialize on the row lock and the loser re-evaluates against the fresh updated_at.
    const reopened = await query(
      `UPDATE ${S}.viewing_analysis_runs
       SET status = 'RUNNING', attempt_count = attempt_count + 1, error_code = NULL, updated_at = NOW()
       WHERE assessment_id = $1 AND idempotency_key = $2 AND attempt_count < $3
         AND (status = 'FAILED' OR (status = 'RUNNING' AND updated_at < NOW() - make_interval(secs => $4::double precision)))
       RETURNING ${RUN_FIELDS}`,
      [assessmentId, idempotencyKey, MAX_RUN_ATTEMPTS, lease]
    )
    if (reopened.rows[0]) return { run: mapRun(reopened.rows[0]), created: true }

    // Stale and out of attempts: park it so it stops blocking the key as "in progress".
    await query(
      `UPDATE ${S}.viewing_analysis_runs
       SET status = 'FAILED', error_code = 'MAX_ATTEMPTS_EXCEEDED', updated_at = NOW()
       WHERE assessment_id = $1 AND idempotency_key = $2 AND status = 'RUNNING' AND attempt_count >= $3
         AND updated_at < NOW() - make_interval(secs => $4::double precision)`,
      [assessmentId, idempotencyKey, MAX_RUN_ATTEMPTS, lease]
    )

    const existing = await query(
      `SELECT ${RUN_FIELDS} FROM ${S}.viewing_analysis_runs WHERE assessment_id = $1 AND idempotency_key = $2`,
      [assessmentId, idempotencyKey]
    )
    return { run: mapRun(existing.rows[0]), created: false }
  },

  async completeRun(runId, { attempt, status, proposals, rejectedCount, errorCode, usage }) {
    return withTransaction(async (client) => {
      // Fencing: only the current attempt may finish the run. Doing this first takes the row lock and
      // aborts a zombie before it writes anything.
      const r = await client.query(
        `UPDATE ${S}.viewing_analysis_runs
         SET status = $2, proposals_count = $3, rejected_count = $4, error_code = $5, updated_at = NOW()
         WHERE id = $1 AND status = 'RUNNING' AND attempt_count = $6 RETURNING ${RUN_FIELDS}`,
        [runId, status, proposals.length, rejectedCount, errorCode ?? null, attempt]
      )
      if (!r.rows[0]) throw new RunLeaseLostError()
      for (const [ordinal, p] of proposals.entries()) {
        await client.query(
          `INSERT INTO ${S}.viewing_proposals
             (id, assessment_id, run_id, check_id, status, observation, evidence_ids, room, confidence,
              suggested_work, model_version, ordinal)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
          [
            p.id,
            p.assessmentId,
            runId,
            p.checkId,
            p.status,
            p.observation,
            p.evidenceIds,
            p.room ?? null,
            p.confidence,
            p.suggestedWork ?? null,
            p.modelVersion,
            ordinal,
          ]
        )
      }
      if (usage) {
        await client.query(
          `INSERT INTO ${S}.viewing_ai_usage
             (id, run_id, assessment_id, attempt, provider, model_version, prompt_version, frame_count,
              input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, cost_micros, simulated, outcome)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            randomUUID(), runId, r.rows[0].assessment_id, attempt, usage.provider, usage.modelVersion,
            usage.promptVersion, usage.frameCount, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens,
            usage.cacheWriteTokens, usage.costMicros, usage.simulated, usage.outcome,
          ]
        )
      }
      return mapRun(r.rows[0])
    })
  },

  async listRuns(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const r = await query(
      `SELECT ${RUN_FIELDS} FROM ${S}.viewing_analysis_runs WHERE assessment_id = $1 ORDER BY created_at DESC, id DESC`,
      [assessmentId]
    )
    return r.rows.map(mapRun)
  },

  async listAbandonedRuns({ leaseSeconds, limit }) {
    const r = await query(
      `SELECT r.id, a.deal_id, r.assessment_id, r.idempotency_key, r.attempt_count, r.provider
       FROM ${S}.viewing_analysis_runs r JOIN ${S}.viewing_assessments a ON a.id = r.assessment_id
       WHERE r.status = 'RUNNING' AND r.updated_at < NOW() - make_interval(secs => $1::double precision)
       ORDER BY r.updated_at, r.id LIMIT $2`,
      [leaseSeconds, limit]
    )
    return r.rows.map((row) => ({
      runId: row.id,
      dealId: row.deal_id,
      assessmentId: row.assessment_id,
      idempotencyKey: row.idempotency_key,
      attemptCount: row.attempt_count,
      provider: row.provider,
    }))
  },

  async putEvidenceBlob(dealId, assessmentId, evidenceId, { storageKey, sha256, sizeBytes, mimeType, createdBy }) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const known = await query(`SELECT 1 FROM ${S}.viewing_evidence WHERE id = $1 AND assessment_id = $2`, [evidenceId, assessmentId])
    if (!known.rows[0]) return null
    const meta = { evidenceId, sha256, sizeBytes, mimeType }
    const inserted = await query(
      `INSERT INTO ${S}.viewing_evidence_blobs (evidence_id, assessment_id, storage_key, sha256, size_bytes, mime_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (evidence_id) DO NOTHING RETURNING evidence_id`,
      [evidenceId, assessmentId, storageKey, sha256, sizeBytes, mimeType, createdBy]
    )
    if (inserted.rows[0]) return { status: "created" as const, meta }
    const existing = await query(`SELECT sha256, size_bytes FROM ${S}.viewing_evidence_blobs WHERE evidence_id = $1`, [evidenceId])
    return existing.rows[0]?.sha256 === sha256
      ? { status: "exists_same" as const, meta: { evidenceId, sha256, sizeBytes: Number(existing.rows[0].size_bytes), mimeType } }
      : { status: "conflict" as const }
  },

  async getEvidenceBlobLocation(dealId, assessmentId, evidenceId) {
    const r = await query(
      `SELECT b.storage_key, b.sha256, b.size_bytes, b.mime_type
       FROM ${S}.viewing_evidence_blobs b JOIN ${S}.viewing_assessments a ON a.id = b.assessment_id
       WHERE b.evidence_id = $1 AND b.assessment_id = $2 AND a.deal_id = $3`,
      [evidenceId, assessmentId, dealId]
    )
    const row = r.rows[0]
    return row ? { evidenceId, storageKey: row.storage_key, sha256: row.sha256, sizeBytes: Number(row.size_bytes), mimeType: row.mime_type } : null
  },

  async listEvidenceBlobs(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    // storage_key is deliberately not selected: this list is safe to send to a client.
    const r = await query(
      `SELECT evidence_id, sha256, size_bytes, mime_type FROM ${S}.viewing_evidence_blobs WHERE assessment_id = $1 ORDER BY evidence_id`,
      [assessmentId]
    )
    return r.rows.map((row) => ({ evidenceId: row.evidence_id, sha256: row.sha256, sizeBytes: Number(row.size_bytes), mimeType: row.mime_type }))
  },

  async getAiUsageSummary(sinceIso) {
    const r = await query(
      `SELECT COALESCE(SUM(cost_micros), 0) AS total,
              COALESCE(SUM(cost_micros) FILTER (WHERE created_at >= $1::timestamptz), 0) AS since_cost,
              COUNT(*) FILTER (WHERE created_at >= $1::timestamptz) AS since_runs
       FROM ${S}.viewing_ai_usage WHERE NOT simulated`,
      [sinceIso]
    )
    const row = r.rows[0]
    return { totalCostMicros: Number(row.total), sinceCostMicros: Number(row.since_cost), sinceRuns: Number(row.since_runs) }
  },

  async listProposals(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const proposals = await query(
      `SELECT * FROM ${S}.viewing_proposals WHERE assessment_id = $1 ORDER BY created_at, run_id, ordinal`, // submission position within the run: never a generated id
      [assessmentId]
    )
    const reviews = await query(
      `SELECT * FROM ${S}.viewing_reviews WHERE assessment_id = $1 ORDER BY proposal_id, revision`,
      [assessmentId]
    )
    const byProposal = new Map<string, StoredReview[]>()
    for (const row of reviews.rows) {
      const review = mapReview(row)
      byProposal.set(review.proposalId, [...(byProposal.get(review.proposalId) ?? []), review])
    }
    return proposals.rows.map((row): ProposalWithReview => {
      const history = byProposal.get(row.id) ?? []
      return {
        proposal: mapProposal(row),
        currentReview: history[history.length - 1] ?? null,
        reviewHistory: history,
      }
    })
  },

  async recordReview(dealId, assessmentId, proposalId, { expectedRevision, decision, feedback }) {
    try {
      return await withTransaction(async (client) => {
        const proposal = await client.query(
          `SELECT p.id FROM ${S}.viewing_proposals p
           JOIN ${S}.viewing_assessments a ON a.id = p.assessment_id
           WHERE p.id = $1 AND p.assessment_id = $2 AND a.deal_id = $3
           FOR UPDATE OF p`,
          [proposalId, assessmentId, dealId]
        )
        if (!proposal.rows[0]) return null

        const current = await client.query(
          `SELECT COALESCE(MAX(revision), 0) AS revision FROM ${S}.viewing_reviews WHERE proposal_id = $1`,
          [proposalId]
        )
        if (Number(current.rows[0].revision) !== expectedRevision) {
          return { status: "stale_revision" as const }
        }

        const reviewId = randomUUID()
        const edited = decision.disposition === "EDITED" ? decision : null
        const reason = "reason" in decision ? (decision.reason ?? null) : null
        const row = await client.query(
          `INSERT INTO ${S}.viewing_reviews
             (id, proposal_id, assessment_id, revision, disposition, edited_status, edited_observation,
              reason, reviewer_id, reviewed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
          [
            reviewId,
            proposalId,
            assessmentId,
            expectedRevision + 1,
            decision.disposition,
            edited?.status ?? null,
            edited?.observation ?? null,
            reason,
            decision.reviewerId,
            decision.reviewedAt,
          ]
        )
        await client.query(
          `INSERT INTO ${S}.viewing_feedback
             (id, proposal_id, assessment_id, review_id, kind, model_version, original_json,
              human_correction_json, disposition, recorded_by, recorded_at)
           VALUES ($1, $2, $3, $4, 'REVIEW', $5, $6, $7, $8, $9, $10)`,
          [
            randomUUID(),
            proposalId,
            assessmentId,
            reviewId,
            feedback.modelVersion,
            JSON.stringify(feedback.original),
            feedback.humanCorrection ? JSON.stringify(feedback.humanCorrection) : null,
            feedback.disposition,
            feedback.reviewerId,
            feedback.reviewedAt,
          ]
        )
        return { status: "ok" as const, review: mapReview(row.rows[0]) }
      })
    } catch (error) {
      if (isUniqueViolation(error)) return { status: "stale_revision" as const }
      throw error
    }
  },

  async recordOutcome(dealId, assessmentId, proposalId, { result, source, observedStatus, note, recordedBy, recordedAt }) {
    return withTransaction(async (client) => {
      const found = await client.query(
        `SELECT p.check_id, p.status, p.observation, p.confidence, p.model_version
         FROM ${S}.viewing_proposals p JOIN ${S}.viewing_assessments a ON a.id = p.assessment_id
         WHERE p.id = $1 AND p.assessment_id = $2 AND a.deal_id = $3`,
        [proposalId, assessmentId, dealId]
      )
      const p = found.rows[0]
      if (!p) return null
      const latest = (
        await client.query(
          `SELECT id, disposition, edited_status, edited_observation FROM ${S}.viewing_reviews
           WHERE proposal_id = $1 ORDER BY revision DESC LIMIT 1`,
          [proposalId]
        )
      ).rows[0]
      const original = { status: p.status, observation: p.observation, confidence: p.confidence }
      const correction =
        latest?.disposition === "EDITED" ? { status: latest.edited_status, observation: latest.edited_observation } : null
      const id = randomUUID()
      const inserted = await client.query(
        `INSERT INTO ${S}.viewing_feedback
           (id, proposal_id, assessment_id, review_id, kind, model_version, original_json, human_correction_json,
            disposition, outcome_note, outcome_result, outcome_source, outcome_observed_status, recorded_by, recorded_at)
         VALUES ($1, $2, $3, $4, 'ACTUAL_OUTCOME', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          id, proposalId, assessmentId, latest?.id ?? null, p.model_version, JSON.stringify(original),
          correction ? JSON.stringify(correction) : null, latest?.disposition ?? null, note, result, source,
          observedStatus, recordedBy, recordedAt,
        ]
      )
      void inserted
      return {
        id,
        kind: "ACTUAL_OUTCOME" as const,
        proposalId,
        assessmentId,
        checkId: p.check_id,
        modelVersion: p.model_version,
        original,
        disposition: latest?.disposition ?? null,
        humanCorrection: correction,
        reviewerId: recordedBy,
        reviewedAt: recordedAt,
        actualOutcome: { recordedAt, result, source, observedStatus, note },
      }
    })
  },

  async listRunUsage(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const r = await query(
      `SELECT run_id, attempt, provider, model_version, prompt_version, frame_count, input_tokens, output_tokens,
              cache_read_tokens, cache_write_tokens, cost_micros, simulated, outcome, created_at
       FROM ${S}.viewing_ai_usage WHERE assessment_id = $1 ORDER BY created_at, run_id, attempt`,
      [assessmentId]
    )
    return r.rows.map((row) => ({
      runId: row.run_id,
      attempt: row.attempt,
      provider: row.provider,
      modelVersion: row.model_version,
      promptVersion: row.prompt_version,
      frameCount: row.frame_count,
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      cacheReadTokens: Number(row.cache_read_tokens),
      cacheWriteTokens: Number(row.cache_write_tokens),
      costMicros: Number(row.cost_micros),
      simulated: row.simulated,
      outcome: row.outcome,
      recordedAt: iso(row.created_at),
    }))
  },

  async listFeedback(dealId, assessmentId) {
    if (!(await assessmentInDeal(query, dealId, assessmentId))) return null
    const r = await query(
      // Same-timestamp reviews must still come back in revision order (the id is a random UUID, so it is only
      // a last-resort tiebreak). Outcome rows have no review and sort after reviews that share their timestamp.
      `SELECT f.*, p.check_id FROM ${S}.viewing_feedback f
       JOIN ${S}.viewing_proposals p ON p.id = f.proposal_id
       LEFT JOIN ${S}.viewing_reviews r ON r.id = f.review_id
       WHERE f.assessment_id = $1 ORDER BY f.recorded_at, r.revision NULLS LAST, f.id`,
      [assessmentId]
    )
    return r.rows.map(
      (row): FeedbackEntry => ({
        id: row.id,
        kind: row.kind,
        proposalId: row.proposal_id,
        assessmentId: row.assessment_id,
        checkId: row.check_id,
        modelVersion: row.model_version,
        original: row.original_json,
        disposition: row.disposition,
        humanCorrection: row.human_correction_json,
        reviewerId: row.recorded_by,
        reviewedAt: iso(row.recorded_at),
        actualOutcome:
          row.kind === "ACTUAL_OUTCOME"
            ? {
                recordedAt: iso(row.recorded_at),
                result: row.outcome_result,
                source: row.outcome_source,
                observedStatus: row.outcome_observed_status,
                note: row.outcome_note,
              }
            : null,
      })
    )
  },
}
