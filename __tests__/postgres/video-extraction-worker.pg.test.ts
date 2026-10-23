import { execFile } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { promisify } from "node:util"
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { qaGate } from "./qa-gate"
import { InMemoryVideoStorageService } from "@/lib/viewing-assessment/video/video-storage-service"
import {
  claimNextQueuedVideoJob,
  completeVideoJob,
  getVideoJobById,
  insertVideoFrames,
  listVideoFramesByJobId,
} from "@/lib/viewing-assessment/video/video-jobs-repository"
import {
  probeStreamPresentationTimestamps,
} from "@/lib/viewing-assessment/video/media-inspector"
import {
  processVideoJob,
  runWorkerCycle,
  WORKER_PROCESSOR_VERSION,
} from "@/lib/viewing-assessment/video/video-extraction-worker"
import type { VideoJobRecord } from "@/types/video-jobs"

const execFileAsync = promisify(execFile)
const gate = qaGate("Postgres video extraction worker")
const S = "brik_by_brik_engine"

describe.skipIf(!gate.enabled)("Postgres genuine video extraction worker (isolated QA only)", () => {
  let db: typeof import("@/lib/db/postgres")
  let storage: InMemoryVideoStorageService

  const testRunId = randomUUID().slice(0, 8)
  const dealId = `qa-deal-worker-${testRunId}`
  const operatorId = `qa-op-worker-${testRunId}`
  let viewingId: string

  // Synthetic video generation helper
  const createSyntheticClip = async (options: {
    durationSec?: number
    fps?: number
    width?: number
    height?: number
    codec?: string
    format?: string
    vfr?: boolean
  }): Promise<Buffer> => {
    const duration = options.durationSec ?? 3
    const fps = options.fps ?? 10
    const w = options.width ?? 320
    const h = options.height ?? 240
    const codec = options.codec ?? "libx264"
    const format = options.format ?? "mp4"

    const tempOut = path.join(os.tmpdir(), `synth_${randomUUID()}.${format}`)
    const inputFilter = options.vfr
      ? `testsrc=size=${w}x${h}:rate=${fps},setpts='N*0.1 + sin(N)*0.04'`
      : `testsrc=size=${w}x${h}:rate=${fps}`

    const args = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      inputFilter,
      "-t",
      String(duration),
      "-c:v",
      codec,
      "-pix_fmt",
      "yuv420p",
      "-fps_mode",
      options.vfr ? "vfr" : "auto",
      "-f",
      format,
      tempOut,
    ]

    try {
      await execFileAsync("ffmpeg", args, { timeout: 30_000, windowsHide: true })
      return await fs.promises.readFile(tempOut)
    } finally {
      try {
        await fs.promises.unlink(tempOut)
      } catch {
        // ignore
      }
    }
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()

    // Create prerequisite deal with authoritative financial figures
    await db.query(`
      INSERT INTO ${S}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state,
        pipeline_state, engine_result_json, risk_summary_json
      ) VALUES (
        $1, '74 Worker Wharf, London', 225000, 360000, 42000,
        'STANDARD', 'DRAFT', 'PROTECTED',
        'SOURCING', '{"trueMao": 210000, "profit": 45000}'::jsonb, '{"riskFlags": []}'::jsonb
      )
    `, [dealId])

    viewingId = `qa-view-worker-${testRunId}`
    await db.query(`
      INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
      VALUES ($1, $2, 'v1', $3, $4)
    `, [viewingId, dealId, `key-${viewingId}`, operatorId])
  })

  afterAll(async () => {
    await db?.getPostgresPool().end()
  })

  beforeEach(async () => {
    storage = new InMemoryVideoStorageService()
    if (db) {
      await db.query(`
        UPDATE ${S}.video_jobs
        SET state = 'failed', failure_code = 'TEST_RESET', lease_until = NULL
        WHERE deal_id = $1 AND state IN ('queued', 'processing')
      `, [dealId])
    }
  })

  const insertTestJob = async (overrides: Partial<VideoJobRecord> = {}): Promise<VideoJobRecord> => {
    const jobId = overrides.id ?? `vj_${randomUUID().replace(/-/g, "").slice(0, 16)}`
    const sourcePath = overrides.source_path ?? `video-evidence/${dealId}/${jobId}/original.mp4`
    const state = overrides.state ?? "queued"
    const attemptCount = overrides.attempt_count ?? 0

    const res = await db.query<VideoJobRecord>(`
      INSERT INTO ${S}.video_jobs (
        id, deal_id, viewing_id, created_by,
        source_bucket, source_path, content_type, declared_bytes,
        state, attempt_count, lease_until, worker_id
      ) VALUES (
        $1, $2, $3, $4,
        'deal-evidence', $5, 'video/mp4', 1024000,
        $6, $7, $8, $9
      )
      RETURNING *
    `, [
      jobId,
      dealId,
      viewingId,
      operatorId,
      sourcePath,
      state,
      attemptCount,
      overrides.lease_until ?? null,
      overrides.worker_id ?? null,
    ])

    return res.rows[0]
  }

  it("claims the next queued video job atomically and transitions state to processing with active lease", async () => {
    const job = await insertTestJob({ state: "queued" })

    const claimed = await claimNextQueuedVideoJob("worker-alpha", 15, dealId)
    expect(claimed).not.toBeNull()
    expect(claimed!.id).toBe(job.id)
    expect(claimed!.state).toBe("processing")
    expect(claimed!.worker_id).toBe("worker-alpha")
    expect(claimed!.attempt_count).toBe(1)
    expect(claimed!.lease_until).not.toBeNull()
    expect(new Date(claimed!.lease_until!).getTime()).toBeGreaterThan(Date.now())
  })

  it("prevents concurrent workers from claiming the same job (FOR UPDATE SKIP LOCKED)", async () => {
    const job = await insertTestJob({ state: "queued" })

    const [claimA, claimB] = await Promise.all([
      claimNextQueuedVideoJob("worker-1", 10, dealId),
      claimNextQueuedVideoJob("worker-2", 10, dealId),
    ])

    const claimedCount = (claimA ? 1 : 0) + (claimB ? 1 : 0)
    expect(claimedCount).toBe(1)
    const claimedJob = claimA ?? claimB
    expect(claimedJob!.id).toBe(job.id)
  })

  it("reclaims a stale processing job after its lease has expired", async () => {
    const staleTime = new Date(Date.now() - 60_000).toISOString()
    const job = await insertTestJob({
      state: "processing",
      worker_id: "worker-dead",
      attempt_count: 1,
      lease_until: staleTime,
    })

    const reclaimed = await claimNextQueuedVideoJob("worker-recovery", 15, dealId)
    expect(reclaimed).not.toBeNull()
    expect(reclaimed!.id).toBe(job.id)
    expect(reclaimed!.worker_id).toBe("worker-recovery")
    expect(reclaimed!.attempt_count).toBe(2)
  })

  it("fences out stale jobs that have reached maximum attempts (3 attempts)", async () => {
    const staleTime = new Date(Date.now() - 60_000).toISOString()
    await insertTestJob({
      state: "processing",
      worker_id: "worker-exhausted",
      attempt_count: 3,
      lease_until: staleTime,
    })

    const claimed = await claimNextQueuedVideoJob("worker-new", 15, dealId)
    expect(claimed).toBeNull()
  })

  it("extracts genuine unenhanced PNG frames and generates derivatives with verified sha256 provenance", async () => {
    const videoBytes = await createSyntheticClip({ durationSec: 3, fps: 10, width: 320, height: 240 })
    const expectedSha256 = createHash("sha256").update(videoBytes).digest("hex")

    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, videoBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-e2e", 15, dealId))!
    expect(claimed).not.toBeNull()
    expect(claimed.id).toBe(job.id)

    const result = await processVideoJob(claimed, { storage, workerId: "worker-e2e" })
    expect(result.success).toBe(true)
    if (!result.success) return

    expect(result.frameCount).toBeGreaterThanOrEqual(5)
    expect(result.sha256).toBe(expectedSha256)

    // Verify database record updated to ready_for_review
    const updatedJob = await getVideoJobById(job.id)
    expect(updatedJob).not.toBeNull()
    expect(updatedJob!.state).toBe("ready_for_review")
    expect(updatedJob!.sha256).toBe(expectedSha256)
    expect(updatedJob!.duration_ms).toBeGreaterThanOrEqual(2500)
    expect(updatedJob!.contact_sheet_path).toContain("contact_sheet.jpg")
    expect(updatedJob!.processor_version).toBe(WORKER_PROCESSOR_VERSION)
    expect(updatedJob!.lease_until).toBeNull()

    // Verify frames persisted in database
    const frames = await listVideoFramesByJobId(job.id)
    expect(frames.length).toBe(result.frameCount)

    // Verify frame ordering and properties
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i]
      expect(f.sequence_no).toBe(i)
      expect(f.width).toBe(320)
      expect(f.height).toBe(240)
      expect(f.mime_type).toBe("image/png")
      expect(f.is_reviewed_evidence).toBe(false) // Marked as derivative/candidate, not original reviewed evidence

      if (i > 0) {
        expect(f.source_time_ms).toBeGreaterThan(frames[i - 1].source_time_ms)
      }

      // Verify frame exists in storage and sha256 matches actual stored bytes
      const storedFrameBytes = await storage.downloadObject(job.source_bucket, f.original_frame_path)
      expect(storedFrameBytes).not.toBeNull()
      const actualHash = createHash("sha256").update(storedFrameBytes!).digest("hex")
      expect(actualHash).toBe(f.sha256)

      // Verify thumbnail exists
      const thumbBytes = await storage.downloadObject(job.source_bucket, f.thumbnail_path)
      expect(thumbBytes).not.toBeNull()
      expect(thumbBytes!.length).toBeGreaterThan(0)
    }

    // Verify contact sheet exists in storage
    const contactSheetBytes = await storage.downloadObject(job.source_bucket, updatedJob!.contact_sheet_path!)
    expect(contactSheetBytes).not.toBeNull()
    expect(contactSheetBytes!.length).toBeGreaterThan(0)
  })

  it("proves source_time_ms is derived from actual stream presentation timestamps on variable-frame-rate (VFR) video", async () => {
    const vfrBytes = await createSyntheticClip({
      durationSec: 3,
      fps: 10,
      width: 160,
      height: 120,
      vfr: true,
    })

    const tempVfr = path.join(os.tmpdir(), `vfr_probe_${randomUUID()}.mp4`)
    await fs.promises.writeFile(tempVfr, vfrBytes)
    const genuinePts = await probeStreamPresentationTimestamps(tempVfr)
    await fs.promises.unlink(tempVfr)

    expect(genuinePts.length).toBeGreaterThan(10)

    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, vfrBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-vfr", 15, dealId))!
    const result = await processVideoJob(claimed, { storage, workerId: "worker-vfr" })
    expect(result.success).toBe(true)

    const frames = await listVideoFramesByJobId(job.id)
    expect(frames.length).toBeGreaterThanOrEqual(5)

    // Every recorded frame timestamp in milliseconds must map to an independently probed genuine packet PTS
    const genuineMsSet = new Set(genuinePts.map((p) => Math.round(p * 1000)))
    for (const f of frames) {
      expect(genuineMsSet.has(f.source_time_ms)).toBe(true)
    }
  })

  it("fences out stale workers from publishing ready_for_review after their lease expires or gets reclaimed", async () => {
    const job = await insertTestJob({ state: "queued" })
    const claimed = (await claimNextQueuedVideoJob("worker-stale", 1, dealId))!
    expect(claimed).not.toBeNull()

    // Manually expire the worker's lease
    await db.query(`
      UPDATE ${S}.video_jobs
      SET lease_until = NOW() - INTERVAL '30 seconds'
      WHERE id = $1
    `, [job.id])

    // Worker attempts to complete job with expired lease
    const staleCompletion = await completeVideoJob(job.id, {
      workerId: "worker-stale",
      observedBytes: 2048,
      sha256: "b".repeat(64),
      durationMs: 3000,
      contactSheetPath: "video-evidence/test/cs.jpg",
    })

    // Must be rejected by worker fence
    expect(staleCompletion).toBeNull()

    // State remains processing, preventing false ready_for_review publication
    const jobRecord = await getVideoJobById(job.id)
    expect(jobRecord!.state).toBe("processing")
    expect(jobRecord!.sha256).toBeNull()
  })

  it("protects reviewed evidence frames (is_reviewed_evidence=TRUE) from being modified by re-extraction attempts", async () => {
    const job = await insertTestJob({ state: "queued" })

    // Insert an accepted/reviewed frame
    const reviewedFrameId = `vf_reviewed_${randomUUID().replace(/-/g, "").slice(0, 12)}`
    await insertVideoFrames([
      {
        id: reviewedFrameId,
        jobId: job.id,
        sequenceNo: 0,
        sourceTimeMs: 1500,
        originalFramePath: `video-evidence/${dealId}/${job.id}/extracted/frame_000.png`,
        thumbnailPath: `video-evidence/${dealId}/${job.id}/thumbnails/frame_000.jpg`,
        sha256: "c".repeat(64),
        mimeType: "image/png",
        width: 320,
        height: 240,
        isReviewedEvidence: true,
      },
    ])

    // Attempt to insert/overwrite candidate frame with sequenceNo 0
    await insertVideoFrames([
      {
        id: `vf_tamper_${randomUUID().replace(/-/g, "").slice(0, 12)}`,
        jobId: job.id,
        sequenceNo: 0,
        sourceTimeMs: 2500,
        originalFramePath: `video-evidence/${dealId}/${job.id}/extracted/frame_000.png`,
        thumbnailPath: `video-evidence/${dealId}/${job.id}/thumbnails/frame_000.jpg`,
        sha256: "d".repeat(64),
        mimeType: "image/png",
        width: 320,
        height: 240,
        isReviewedEvidence: false,
      },
    ])

    // Reviewed frame remains pristine with original attributes
    const frames = await listVideoFramesByJobId(job.id)
    expect(frames.length).toBe(1)
    expect(frames[0].sha256).toBe("c".repeat(64))
    expect(frames[0].source_time_ms).toBe(1500)
    expect(frames[0].is_reviewed_evidence).toBe(true)
  })

  it("safely rejects corrupt media, marks job failed, and prevents frame persistence", async () => {
    const corruptBytes = Buffer.from("NOT_A_VALID_MP4_VIDEO_HEADER_JUST_GARBAGE_BYTES_123456789")
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, corruptBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-corrupt", 15, dealId))!
    const result = await processVideoJob(claimed, { storage, workerId: "worker-corrupt" })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("CORRUPT_MEDIA")

    const updatedJob = await getVideoJobById(job.id)
    expect(updatedJob!.state).toBe("failed")
    expect(updatedJob!.failure_code).toBe("CORRUPT_MEDIA")

    const frames = await listVideoFramesByJobId(job.id)
    expect(frames.length).toBe(0)
  })

  it("strictly enforces pilot specification: rejects non-H.264/H.265 codecs (VP9, MPEG-4, etc.)", async () => {
    const vp9Bytes = await createSyntheticClip({
      durationSec: 2,
      fps: 10,
      codec: "libvpx-vp9",
      format: "mp4",
    })
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, vp9Bytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-codec", 15, dealId))!
    const result = await processVideoJob(claimed, { storage, workerId: "worker-codec" })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("UNSUPPORTED_CODEC")

    const updatedJob = await getVideoJobById(job.id)
    expect(updatedJob!.state).toBe("failed")
    expect(updatedJob!.failure_code).toBe("UNSUPPORTED_CODEC")
  })

  it("safely rejects video with duration exceeding pilot limit (> 300 seconds)", async () => {
    const longBytes = await createSyntheticClip({
      durationSec: 305,
      fps: 1,
      width: 160,
      height: 120,
    })
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, longBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-duration", 15, dealId))!
    const result = await processVideoJob(claimed, { storage, workerId: "worker-duration" })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("DURATION_EXCEEDED")

    const updatedJob = await getVideoJobById(job.id)
    expect(updatedJob!.state).toBe("failed")
    expect(updatedJob!.failure_code).toBe("DURATION_EXCEEDED")
  })

  it("safely rejects video with resolution exceeding 1080p-equivalent (2560x1440)", async () => {
    const largeResBytes = await createSyntheticClip({
      durationSec: 1,
      fps: 1,
      width: 2560,
      height: 1440,
    })
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, largeResBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-res", 15, dealId))!
    const result = await processVideoJob(claimed, { storage, workerId: "worker-res" })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.code).toBe("RESOLUTION_EXCEEDED")

    const updatedJob = await getVideoJobById(job.id)
    expect(updatedJob!.state).toBe("failed")
    expect(updatedJob!.failure_code).toBe("RESOLUTION_EXCEEDED")
  })

  it("guarantees temporary worker scratch directories are cleaned up after processing", async () => {
    const videoBytes = await createSyntheticClip({ durationSec: 2, fps: 5 })
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, videoBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-clean", 15, dealId))!

    const tmpRoot = os.tmpdir()
    const getWorkerTmpDirs = async () => {
      const files = await fs.promises.readdir(tmpRoot)
      return files.filter((f) => f.startsWith("brik-video-worker-"))
    }

    const before = await getWorkerTmpDirs()
    await processVideoJob(claimed, { storage, workerId: "worker-clean" })
    const after = await getWorkerTmpDirs()

    expect(after.length).toBeLessThanOrEqual(before.length)
  })

  it("integrates runWorkerCycle claiming and execution in a single worker cycle", async () => {
    const videoBytes = await createSyntheticClip({ durationSec: 2, fps: 5 })
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, videoBytes, "video/mp4")

    const cycleResult = await runWorkerCycle("cycle-worker", { storage }, dealId)
    expect(cycleResult).not.toBeNull()
    if (!cycleResult) return

    expect(cycleResult.jobId).toBe(job.id)
    expect(cycleResult.success).toBe(true)

    // Second cycle finds no queued jobs and returns null (idle)
    const idleCycle = await runWorkerCycle("cycle-worker", { storage }, dealId)
    expect(idleCycle).toBeNull()
  })

  it("strictly preserves financial and Investor Shield invariance across worker operations", async () => {
    const checkDealFinancials = async () => {
      const res = await db.query(`
        SELECT purchase_price, gdv_realistic, refurb_cost, capital_protection_state, engine_result_json
        FROM ${S}.saved_deals WHERE id = $1
      `, [dealId])
      return res.rows[0]
    }

    const before = await checkDealFinancials()

    // Run valid video processing
    const videoBytes = await createSyntheticClip({ durationSec: 2, fps: 5 })
    const job = await insertTestJob({ state: "queued" })
    await storage.uploadObject(job.source_bucket, job.source_path, videoBytes, "video/mp4")

    const claimed = (await claimNextQueuedVideoJob("worker-shield", 15, dealId))!
    await processVideoJob(claimed, { storage, workerId: "worker-shield" })

    const after = await checkDealFinancials()

    expect(after.purchase_price).toBe(before.purchase_price)
    expect(after.gdv_realistic).toBe(before.gdv_realistic)
    expect(after.refurb_cost).toBe(before.refurb_cost)
    expect(after.capital_protection_state).toBe(before.capital_protection_state)
    expect(JSON.stringify(after.engine_result_json)).toBe(JSON.stringify(before.engine_result_json))
  })
})
