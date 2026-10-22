import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { qaGate } from "./qa-gate"

const gate = qaGate("Postgres video evidence schema")
const S = "brik_by_brik_engine"

describe.skipIf(!gate.enabled)("Postgres video evidence schema (isolated QA only)", () => {
  let db: typeof import("@/lib/db/postgres")
  const testRunId = randomUUID().slice(0, 8)
  const dealIdA = `qa-deal-a-${testRunId}`
  const dealIdB = `qa-deal-b-${testRunId}`
  const viewingIdA = `qa-view-a-${testRunId}`
  const viewingIdB = `qa-view-b-${testRunId}`
  const operatorSubject = `qa-operator-${testRunId}`

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()

    // Create prerequisite deal A and deal B
    for (const id of [dealIdA, dealIdB]) {
      await db.query(`
        INSERT INTO ${S}.saved_deals (
          id, address, classification, governance_state, capital_protection_state,
          pipeline_state, engine_result_json, risk_summary_json
        ) VALUES ($1, $2, 'STANDARD', 'DRAFT', 'PROTECTED', 'SOURCING', '{}'::jsonb, '{}'::jsonb)
      `, [id, `123 Test St ${id}`])
    }

    // Create viewing assessment for deal A and deal B
    await db.query(`
      INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
      VALUES ($1, $2, 'v1', $3, $4)
    `, [viewingIdA, dealIdA, `key-${viewingIdA}`, operatorSubject])

    await db.query(`
      INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
      VALUES ($1, $2, 'v1', $3, $4)
    `, [viewingIdB, dealIdB, `key-${viewingIdB}`, operatorSubject])
  })

  afterAll(async () => {
    await db?.getPostgresPool().end()
  })

  it("enforces Row Level Security (RLS) on both video tables", async () => {
    const res = await db.query(`
      SELECT tablename, rowsecurity
      FROM pg_tables
      WHERE schemaname = $1 AND tablename IN ('video_jobs', 'video_frames')
    `, [S])
    expect(res.rows).toHaveLength(2)
    for (const row of res.rows) {
      expect(row.rowsecurity).toBe(true)
    }
  })

  it("inserts a valid video job with server-generated path, temporary 30-day expiry, and protected original evidence policy", async () => {
    const jobId = `vj_${randomUUID()}`
    const sourcePath = `video-evidence/${dealIdA}/${jobId}/original.mp4`

    const insertRes = await db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 150000000)
      RETURNING *
    `, [jobId, dealIdA, viewingIdA, operatorSubject, sourcePath])

    expect(insertRes.rows).toHaveLength(1)
    const job = insertRes.rows[0]
    expect(job.id).toBe(jobId)
    expect(job.state).toBe("upload_pending")
    expect(job.source_bucket).toBe("deal-evidence")
    expect(job.deletion_status).toBe("ACTIVE")

    // Verify original evidence retention is explicitly protected pending owner policy
    expect(job.original_retention_policy).toBe("RETAIN_PENDING_OWNER_POLICY")

    // Verify temporary derivative expiry is set ~30 days in future
    const now = Date.now()
    const temporaryExpiryMs = new Date(job.temporary_retention_expires_at).getTime()
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
    expect(temporaryExpiryMs).toBeGreaterThan(now + thirtyDaysMs - 60000)
    expect(temporaryExpiryMs).toBeLessThan(now + thirtyDaysMs + 60000)
  })

  it("enforces valid original_retention_policy values and protects original evidence from unapproved purge", async () => {
    const badPolicyId = `vj_bad_pol_${randomUUID()}`
    const sourcePath = `video-evidence/${dealIdA}/${badPolicyId}/original.mp4`

    // Rejects invalid retention policy
    await expect(db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes, original_retention_policy
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 1000000, 'UNAUTHORIZED_AUTO_PURGE')
    `, [badPolicyId, dealIdA, viewingIdA, operatorSubject, sourcePath])).rejects.toThrow()

    // Valid job with RETAIN_PENDING_OWNER_POLICY is not matched by scheduled purge queries
    const goodJobId = `vj_protect_${randomUUID()}`
    const goodPath = `video-evidence/${dealIdA}/${goodJobId}/original.mp4`
    await db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes, temporary_retention_expires_at
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 1000000, NOW() - INTERVAL '1 day')
    `, [goodJobId, dealIdA, viewingIdA, operatorSubject, goodPath])

    // Cleanup query targeting only temporary derivatives or owner-authorized purges
    const purgeEligible = await db.query(`
      SELECT id FROM ${S}.video_jobs
      WHERE id = $1
        AND temporary_retention_expires_at < NOW()
        AND original_retention_policy = 'OWNER_SCHEDULED_PURGE'
    `, [goodJobId])

    expect(purgeEligible.rows).toHaveLength(0) // Protected!
  })

  it("rejects cross-deal mismatch via composite foreign key (deal_id, viewing_id)", async () => {
    const jobId = `vj_cross_${randomUUID()}`
    const sourcePath = `video-evidence/${dealIdA}/${jobId}/original.mp4`

    // Attempt to create job with deal A but viewing B (which belongs to deal B)
    await expect(db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 50000000)
    `, [jobId, dealIdA, viewingIdB, operatorSubject, sourcePath])).rejects.toThrow()
  })

  it("rejects invalid video_jobs constraints (invalid path, oversized bytes, invalid mime)", async () => {
    const badPath = async (path: string) => {
      const id = `vj_${randomUUID()}`
      return db.query(`
        INSERT INTO ${S}.video_jobs (
          id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes
        ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 50000)
      `, [id, dealIdA, viewingIdA, operatorSubject, path])
    }

    // Path traversal attempt or bad prefix
    await expect(badPath(`../video-evidence/${dealIdA}/orig.mp4`)).rejects.toThrow()
    await expect(badPath(`public-bucket/${dealIdA}/orig.mp4`)).rejects.toThrow()
    await expect(badPath(`video-evidence/${dealIdA}/orig.avi`)).rejects.toThrow()

    // Oversize bytes (> 500 MB = 524288000)
    await expect(db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 524288001)
    `, [`vj_${randomUUID()}`, dealIdA, viewingIdA, operatorSubject, `video-evidence/${dealIdA}/${randomUUID()}/original.mp4`])).rejects.toThrow()

    // Invalid MIME
    await expect(db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes
      ) VALUES ($1, $2, $3, $4, $5, 'video/avi', 1000)
    `, [`vj_${randomUUID()}`, dealIdA, viewingIdA, operatorSubject, `video-evidence/${dealIdA}/${randomUUID()}/original.mp4`])).rejects.toThrow()

    // Duration > 300,000 ms (5 min)
    await expect(db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 1000, 300001)
    `, [`vj_${randomUUID()}`, dealIdA, viewingIdA, operatorSubject, `video-evidence/${dealIdA}/${randomUUID()}/original.mp4`])).rejects.toThrow()
  })

  it("stores extracted video frames and enforces lineage, timestamp and sequence uniqueness", async () => {
    const jobId = `vj_frames_${randomUUID()}`
    const sourcePath = `video-evidence/${dealIdA}/${jobId}/original.mp4`
    await db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes, state
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 80000000, 'processing')
    `, [jobId, dealIdA, viewingIdA, operatorSubject, sourcePath])

    // Insert valid frames
    for (let seq = 0; seq < 3; seq++) {
      const sha = "a".repeat(63) + seq.toString()
      const framePath = `video-evidence/${dealIdA}/${jobId}/extracted/frame_${String(seq).padStart(3, "0")}.png`
      const thumbPath = `video-evidence/${dealIdA}/${jobId}/thumbnails/frame_${String(seq).padStart(3, "0")}.jpg`
      await db.query(`
        INSERT INTO ${S}.video_frames (
          job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, 1920, 1080)
      `, [jobId, seq, seq * 8000, framePath, thumbPath, sha])
    }

    const frames = await db.query(`
      SELECT sequence_no, source_time_ms, original_frame_path, is_reviewed_evidence
      FROM ${S}.video_frames
      WHERE job_id = $1
      ORDER BY sequence_no ASC
    `, [jobId])

    expect(frames.rows).toHaveLength(3)
    expect(frames.rows[0].sequence_no).toBe(0)
    expect(frames.rows[0].source_time_ms).toBe(0)
    expect(frames.rows[0].is_reviewed_evidence).toBe(false)
    expect(frames.rows[1].sequence_no).toBe(1)
    expect(frames.rows[1].source_time_ms).toBe(8000)

    // Reject duplicate sequence number for same job
    const dupSha = "b".repeat(64)
    const dupPath = `video-evidence/${dealIdA}/${jobId}/extracted/frame_000.png`
    const dupThumb = `video-evidence/${dealIdA}/${jobId}/thumbnails/frame_000.jpg`
    await expect(db.query(`
      INSERT INTO ${S}.video_frames (
        job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height
      ) VALUES ($1, 0, 9999, $2, $3, $4, 1920, 1080)
    `, [jobId, dupPath, dupThumb, dupSha])).rejects.toThrow()

    // Reject sequence_no >= 40 (hard frame cap constraint)
    const capPath = `video-evidence/${dealIdA}/${jobId}/extracted/frame_040.png`
    const capThumb = `video-evidence/${dealIdA}/${jobId}/thumbnails/frame_040.jpg`
    await expect(db.query(`
      INSERT INTO ${S}.video_frames (
        job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height
      ) VALUES ($1, 40, 40000, $2, $3, $4, 1920, 1080)
    `, [jobId, capPath, capThumb, dupSha])).rejects.toThrow()
  })

  it("enforces evidence immutability on reviewed frames: rejects deletion, demotion, and tampering", async () => {
    const jobId = `vj_immut_${randomUUID()}`
    const sourcePath = `video-evidence/${dealIdA}/${jobId}/original.mp4`
    await db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes, state
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 50000000, 'processing')
    `, [jobId, dealIdA, viewingIdA, operatorSubject, sourcePath])

    const framePath = `video-evidence/${dealIdA}/${jobId}/extracted/frame_000.png`
    const thumbPath = `video-evidence/${dealIdA}/${jobId}/thumbnails/frame_000.jpg`
    const sha = "d".repeat(64)

    const insertFrame = await db.query(`
      INSERT INTO ${S}.video_frames (
        job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height
      ) VALUES ($1, 0, 0, $2, $3, $4, 1920, 1080)
      RETURNING id
    `, [jobId, framePath, thumbPath, sha])
    const frameId = insertFrame.rows[0].id

    // Promote to reviewed evidence
    await db.query(`
      UPDATE ${S}.video_frames
      SET is_reviewed_evidence = TRUE
      WHERE id = $1
    `, [frameId])

    // Negative case 1: Reject deletion of reviewed frame
    await expect(db.query(`
      DELETE FROM ${S}.video_frames WHERE id = $1
    `, [frameId])).rejects.toThrow(/locked as reviewed evidence/)

    // Negative case 2: Reject demotion from reviewed evidence
    await expect(db.query(`
      UPDATE ${S}.video_frames
      SET is_reviewed_evidence = FALSE
      WHERE id = $1
    `, [frameId])).rejects.toThrow(/Cannot demote reviewed evidence/)

    // Negative case 3: Reject altering cryptographic hash on reviewed frame
    await expect(db.query(`
      UPDATE ${S}.video_frames
      SET sha256 = $2
      WHERE id = $1
    `, [frameId, "e".repeat(64)])).rejects.toThrow(/Cannot modify evidence attributes/)

    // Negative case 4: Reject altering storage path on reviewed frame
    await expect(db.query(`
      UPDATE ${S}.video_frames
      SET original_frame_path = 'video-evidence/${dealIdA}/${jobId}/extracted/frame_001.png'
      WHERE id = $1
    `, [frameId])).rejects.toThrow(/Cannot modify evidence attributes/)

    // Positive case: Unreviewed frame CAN be deleted (supporting 30-day derivative pruning)
    const unreviewedFramePath = `video-evidence/${dealIdA}/${jobId}/extracted/frame_001.png`
    const unreviewedThumbPath = `video-evidence/${dealIdA}/${jobId}/thumbnails/frame_001.jpg`
    const insertUnreviewed = await db.query(`
      INSERT INTO ${S}.video_frames (
        job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height, is_reviewed_evidence
      ) VALUES ($1, 1, 1000, $2, $3, $4, 1920, 1080, FALSE)
      RETURNING id
    `, [jobId, unreviewedFramePath, unreviewedThumbPath, "f".repeat(64)])
    const unreviewedId = insertUnreviewed.rows[0].id

    const deleteRes = await db.query(`DELETE FROM ${S}.video_frames WHERE id = $1`, [unreviewedId])
    expect(deleteRes.rowCount).toBe(1)
  })

  it("protects original video job lineage: rejects deletion under RETAIN_PENDING_OWNER_POLICY and rejects un-audited purge policy switches", async () => {
    const jobId = `vj_prot_lin_${randomUUID()}`
    const sourcePath = `video-evidence/${dealIdA}/${jobId}/original.mp4`

    await db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes, state, original_retention_policy
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 50000000, 'ready_for_review', 'RETAIN_PENDING_OWNER_POLICY')
    `, [jobId, dealIdA, viewingIdA, operatorSubject, sourcePath])

    // Negative case 1: Reject direct deletion of job with original retention policy active
    await expect(db.query(`
      DELETE FROM ${S}.video_jobs WHERE id = $1
    `, [jobId])).rejects.toThrow(/original video evidence is protected under RETAIN_PENDING_OWNER_POLICY policy/)

    // Negative case 2: Reject policy switch to OWNER_SCHEDULED_PURGE without audit trail notes
    await expect(db.query(`
      UPDATE ${S}.video_jobs
      SET original_retention_policy = 'OWNER_SCHEDULED_PURGE', retention_decision_notes = NULL
      WHERE id = $1
    `, [jobId])).rejects.toThrow(/without explicit retention_decision_notes/)

    // Negative case 3: Reject modifying core evidence attributes (source_path, deal_id) on processed job
    await expect(db.query(`
      UPDATE ${S}.video_jobs
      SET source_path = 'video-evidence/${dealIdB}/${jobId}/original.mp4'
      WHERE id = $1
    `, [jobId])).rejects.toThrow(/Cannot alter evidence attributes/)

    // Positive case: Policy switch to purge succeeds with explicit owner audit notes
    await db.query(`
      UPDATE ${S}.video_jobs
      SET original_retention_policy = 'OWNER_SCHEDULED_PURGE',
          retention_decision_notes = 'Owner James Lake explicitly authorized purge for pilot job'
      WHERE id = $1
    `, [jobId])

    const updatedJob = await db.query(`
      SELECT original_retention_policy, retention_decision_notes FROM ${S}.video_jobs WHERE id = $1
    `, [jobId])
    expect(updatedJob.rows[0].original_retention_policy).toBe("OWNER_SCHEDULED_PURGE")
    expect(updatedJob.rows[0].retention_decision_notes).toContain("James Lake")
  })

  it("restricts deletion of parent deal or viewing assessment when video evidence exists (no silent cascade)", async () => {
    const restrictDealId = `qa-deal-restr-${testRunId}`
    const restrictViewingId = `qa-view-restr-${testRunId}`
    const restrictJobId = `vj_restr_${randomUUID()}`
    const sourcePath = `video-evidence/${restrictDealId}/${restrictJobId}/original.mp4`

    await db.query(`
      INSERT INTO ${S}.saved_deals (
        id, address, classification, governance_state, capital_protection_state,
        pipeline_state, engine_result_json, risk_summary_json
      ) VALUES ($1, 'Restricted Deal Address', 'STANDARD', 'DRAFT', 'PROTECTED', 'SOURCING', '{}'::jsonb, '{}'::jsonb)
    `, [restrictDealId])

    await db.query(`
      INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
      VALUES ($1, $2, 'v1', $3, $4)
    `, [restrictViewingId, restrictDealId, `key-${restrictViewingId}`, operatorSubject])

    await db.query(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by, source_path, content_type, declared_bytes
      ) VALUES ($1, $2, $3, $4, $5, 'video/mp4', 10000000)
    `, [restrictJobId, restrictDealId, restrictViewingId, operatorSubject, sourcePath])

    const framePath = `video-evidence/${restrictDealId}/${restrictJobId}/extracted/frame_000.png`
    const thumbPath = `video-evidence/${restrictDealId}/${restrictJobId}/thumbnails/frame_000.jpg`
    await db.query(`
      INSERT INTO ${S}.video_frames (
        job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height
      ) VALUES ($1, 0, 0, $2, $3, $4, 1920, 1080)
    `, [restrictJobId, framePath, thumbPath, "c".repeat(64)])

    // Negative case 1: Deleting parent saved_deal must be RESTRICTED (cannot silently cascade)
    await expect(db.query(`
      DELETE FROM ${S}.saved_deals WHERE id = $1
    `, [restrictDealId])).rejects.toThrow(/violates foreign key constraint/i)

    // Negative case 2: Deleting parent viewing_assessment must be RESTRICTED (cannot silently cascade)
    await expect(db.query(`
      DELETE FROM ${S}.viewing_assessments WHERE id = $1
    `, [restrictViewingId])).rejects.toThrow(/violates foreign key constraint/i)

    // Negative case 3a: Deleting video_jobs while under RETAIN_PENDING_OWNER_POLICY must be rejected by trigger
    await expect(db.query(`
      DELETE FROM ${S}.video_jobs WHERE id = $1
    `, [restrictJobId])).rejects.toThrow(/original video evidence is protected under RETAIN_PENDING_OWNER_POLICY/i)

    // Negative case 3b: Even if switched to purge, deleting video_jobs while child frames exist must be RESTRICTED by FK
    await db.query(`
      UPDATE ${S}.video_jobs
      SET original_retention_policy = 'OWNER_SCHEDULED_PURGE',
          retention_decision_notes = 'Test authorized purge'
      WHERE id = $1
    `, [restrictJobId])

    await expect(db.query(`
      DELETE FROM ${S}.video_jobs WHERE id = $1
    `, [restrictJobId])).rejects.toThrow(/violates foreign key constraint "fk_video_frames_job"/i)
  })

  it("rejects TRUNCATE on video_jobs and video_frames to guard audit lineage", async () => {
    await expect(db.query(`TRUNCATE TABLE ${S}.video_jobs CASCADE`)).rejects.toThrow(/video_jobs is append-only/)
    await expect(db.query(`TRUNCATE TABLE ${S}.video_frames`)).rejects.toThrow(/video_frames is append-only/)
  })
})
