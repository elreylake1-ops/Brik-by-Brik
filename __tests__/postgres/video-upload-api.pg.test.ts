import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it } from "vitest"
import { qaGate } from "./qa-gate"
import { createTestIdentityProvider } from "../fixtures/auth-fixtures"
import {
  __setOperatorAuthDepsForTests,
  createAllowlistMembershipStore,
} from "@/lib/auth/operator-auth"
import {
  InMemoryVideoStorageService,
  __setVideoStorageServiceForTests,
} from "@/lib/viewing-assessment/video/video-storage-service"
import * as videoRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/route"
import * as confirmRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/confirm/route"
import * as statusRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/route"
import type { RouteContext } from "@/lib/viewing-assessment/route-support"

const gate = qaGate("Postgres video upload APIs")
const S = "brik_by_brik_engine"

describe.skipIf(!gate.enabled)("Postgres video upload intent, confirmation and status APIs (isolated QA only)", () => {
  let db: typeof import("@/lib/db/postgres")
  let storage: InMemoryVideoStorageService

  const testRunId = randomUUID().slice(0, 8)
  const dealIdA = `qa-deal-api-a-${testRunId}`
  const dealIdB = `qa-deal-api-b-${testRunId}`
  const operatorA = `qa-op-a-${testRunId}`
  const operatorOutsider = `qa-op-outsider-${testRunId}`

  const tokenMember = `tok-member-${testRunId}`
  const tokenOutsider = `tok-outsider-${testRunId}`

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()

    // Create prerequisite deal A and deal B with financial figures
    for (const [id, addr, price] of [
      [dealIdA, "100 Alpha St", 200000],
      [dealIdB, "200 Beta St", 350000],
    ] as const) {
      await db.query(`
        INSERT INTO ${S}.saved_deals (
          id, address, purchase_price, gdv_realistic, refurb_cost,
          classification, governance_state, capital_protection_state,
          pipeline_state, engine_result_json, risk_summary_json
        ) VALUES (
          $1, $2, $3, 300000, 35000,
          'STANDARD', 'DRAFT', 'PROTECTED',
          'SOURCING', '{"trueMao": 195000, "profit": 35000}'::jsonb, '{"riskFlags": []}'::jsonb
        )
      `, [id, addr, price])
    }
  })

  afterAll(async () => {
    __setOperatorAuthDepsForTests(undefined)
    __setVideoStorageServiceForTests(undefined)
    await db?.getPostgresPool().end()
  })

  beforeEach(() => {
    storage = new InMemoryVideoStorageService()
    __setVideoStorageServiceForTests(storage)
    __setOperatorAuthDepsForTests({
      provider: createTestIdentityProvider({
        [tokenMember]: operatorA,
        [tokenOutsider]: operatorOutsider,
      }),
      membership: createAllowlistMembershipStore(operatorA)!,
    })
  })

  afterEach(() => {
    __setOperatorAuthDepsForTests(undefined)
    __setVideoStorageServiceForTests(undefined)
  })

  const createViewing = async (dealId: string): Promise<string> => {
    const viewingId = `qa-view-${randomUUID().slice(0, 8)}`
    await db.query(`
      INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
      VALUES ($1, $2, 'v1', $3, $4)
    `, [viewingId, dealId, `key-${viewingId}`, operatorA])
    return viewingId
  }

  const ctx = (params: Record<string, string>): RouteContext => ({
    params: Promise.resolve(params),
  })

  const req = (options: {
    token?: string
    body?: unknown
    method?: string
    origin?: string
    host?: string
  }) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      host: options.host ?? "localhost",
    }
    if (options.token) {
      headers.authorization = `Bearer ${options.token}`
    }
    if (options.origin) {
      headers.origin = options.origin
    }
    return new Request("http://localhost/api/test", {
      method: options.method ?? "POST",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  }

  const asJson = async (res: Response) => ({
    status: res.status,
    body: (await res.json()) as Record<string, unknown>,
  })

  // 1. Anonymous request denied
  it("denies anonymous requests with 401 across all video endpoints", async () => {
    const viewingId = await createViewing(dealIdA)
    const postRes = await asJson(
      await videoRoute.POST(
        req({ body: { contentType: "video/mp4", declaredBytes: 10_000_000 } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(postRes.status).toBe(401)
    expect(postRes.body.error).toBe("AUTHENTICATION_REQUIRED")

    const confirmRes = await asJson(
      await confirmRoute.POST(
        req({ body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId: "vj_fake" })
      )
    )
    expect(confirmRes.status).toBe(401)

    const statusRes = await asJson(
      await statusRoute.GET(
        req({ method: "GET" }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId: "vj_fake" })
      )
    )
    expect(statusRes.status).toBe(401)
  })

  // 2. Unapproved operator denied
  it("denies unapproved operator token with fail-closed 404 (saving deal existence privacy)", async () => {
    const viewingId = await createViewing(dealIdA)
    const res = await asJson(
      await videoRoute.POST(
        req({ token: tokenOutsider, body: { contentType: "video/mp4", declaredBytes: 10_000_000 } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(res.status).toBe(404)
    expect(res.body.error).toBe("SAVED_DEAL_NOT_FOUND")
  })

  // 3. Wrong-deal and wrong-viewing access denied
  it("denies access to wrong deal or wrong viewing assessment", async () => {
    const viewingIdA = await createViewing(dealIdA)
    const viewingIdB = await createViewing(dealIdB)

    // Non-existent deal
    const resWrongDeal = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes: 10_000_000 } }),
        ctx({ id: "non-existent-deal-id", assessmentId: viewingIdA })
      )
    )
    expect(resWrongDeal.status).toBe(404)

    // Non-existent viewing assessment under deal A
    const resWrongViewing = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes: 10_000_000 } }),
        ctx({ id: dealIdA, assessmentId: "non-existent-viewing" })
      )
    )
    expect(resWrongViewing.status).toBe(404)
    expect(resWrongViewing.body.error).toBe("ASSESSMENT_NOT_FOUND")

    // Mismatched assessment: viewingIdB belongs to dealIdB, not dealIdA
    const resMismatched = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes: 10_000_000 } }),
        ctx({ id: dealIdA, assessmentId: viewingIdB })
      )
    )
    expect(resMismatched.status).toBe(404)
    expect(resMismatched.body.error).toBe("ASSESSMENT_NOT_FOUND")
  })

  // 4. Cross-origin write denied
  it("denies state-changing POST requests with cross-origin Origin headers", async () => {
    const viewingId = await createViewing(dealIdA)
    const res = await asJson(
      await videoRoute.POST(
        req({
          token: tokenMember,
          origin: "https://evil-attacker.example.com",
          host: "localhost",
          body: { contentType: "video/mp4", declaredBytes: 10_000_000 },
        }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(res.status).toBe(403)
    expect(res.body.error).toBe("CROSS_ORIGIN_REJECTED")
  })

  // 5. Oversized and invalid uploads rejected
  it("rejects oversized bytes, invalid MIME, and malformed container extensions", async () => {
    const viewingId = await createViewing(dealIdA)

    // Oversize: 500 MB + 1 byte (524288001)
    const resOversize = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes: 524_288_001 } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(resOversize.status).toBe(400)
    expect(resOversize.body.error).toBe("INVALID_DECLARED_BYTES")

    // Zero or negative bytes
    const resZero = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes: 0 } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(resZero.status).toBe(400)

    // Unsupported MIME (e.g. AVI, WEBM, EXE)
    const resAvi = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/avi", declaredBytes: 10_000_000 } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(resAvi.status).toBe(415)
    expect(resAvi.body.error).toBe("UNSUPPORTED_MEDIA_TYPE")

    // Invalid file extension
    const resBadExt = await asJson(
      await videoRoute.POST(
        req({
          token: tokenMember,
          body: { contentType: "video/mp4", declaredBytes: 10_000_000, filename: "walkthrough.exe" },
        }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(resBadExt.status).toBe(400)
    expect(resBadExt.body.error).toBe("INVALID_FILE_EXTENSION")
  })

  // 6. Intent creation issues path-bound upload credentials and enforces duplicate upload protection
  it("creates upload intent with server-generated path and protects against duplicate pending intents", async () => {
    const viewingId = await createViewing(dealIdA)
    const bytes = 45_000_000
    const res1 = await asJson(
      await videoRoute.POST(
        req({
          token: tokenMember,
          body: { contentType: "video/mp4", declaredBytes: bytes, filename: "front_room.mp4" },
        }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(res1.status).toBe(201)
    expect(res1.body.success).toBe(true)
    expect(res1.body.jobId).toMatch(/^vj_[0-9a-f-]{36}$/)
    expect(res1.body.sourcePath).toBe(`video-evidence/${dealIdA}/${res1.body.jobId}/original.mp4`)
    expect(res1.body.uploadToken).toBeDefined()
    expect(res1.body.uploadEndpoint).toContain(res1.body.sourcePath)

    // Immediate duplicate intent with identical signature is rejected with 409
    const resDuplicate = await asJson(
      await videoRoute.POST(
        req({
          token: tokenMember,
          body: { contentType: "video/mp4", declaredBytes: bytes },
        }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(resDuplicate.status).toBe(409)
    expect(resDuplicate.body.error).toBe("DUPLICATE_UPLOAD_IN_PROGRESS")
  })

  // 7. Missing or size-mismatched storage object rejected during confirmation
  it("rejects confirmation if storage object is missing or actual byte size mismatches", async () => {
    const viewingId = await createViewing(dealIdA)
    const declaredBytes = 20_000_000
    const intentRes = await asJson(
      await videoRoute.POST(
        req({
          token: tokenMember,
          body: { contentType: "video/quicktime", declaredBytes },
        }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId, sourcePath } = intentRes.body

    // Case 7a: Object does not exist in storage
    const resMissing = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(resMissing.status).toBe(400)
    expect(resMissing.body.error).toBe("STORAGE_OBJECT_NOT_FOUND")

    // Case 7b: Object exists but actual size is 19,999,999 (size mismatch)
    storage.setObject("deal-evidence", sourcePath, 19_999_999, "video/quicktime")
    const resMismatch = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(resMismatch.status).toBe(400)
    expect(resMismatch.body.error).toBe("SIZE_MISMATCH")
  })

  // 8. Correct job lifecycle transitions and duplicate confirmation rejection
  it("transitions job from upload_pending to queued upon confirmation, and rejects duplicate confirmation", async () => {
    const viewingId = await createViewing(dealIdA)
    const declaredBytes = 15_000_000
    const intentRes = await asJson(
      await videoRoute.POST(
        req({
          token: tokenMember,
          body: { contentType: "video/mp4", declaredBytes },
        }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId, sourcePath, protocols } = intentRes.body as {
      jobId: string
      sourcePath: string
      protocols: {
        standard: { uploadUrl: string; method: string }
        resumable: { endpoint: string; token: string; bucket: string; objectName: string }
      }
    }
    expect(protocols).toBeDefined()
    expect(protocols.standard.uploadUrl).toBeDefined()
    expect(protocols.standard.method).toBe("PUT")
    expect(protocols.resumable.endpoint).toContain("/upload/resumable")
    expect(protocols.resumable.token).toBeDefined()
    expect(protocols.resumable.bucket).toBe("deal-evidence")
    expect(protocols.resumable.objectName).toBe(sourcePath)

    // Simulate direct browser upload completed in storage
    storage.setObject("deal-evidence", sourcePath, declaredBytes, "video/mp4")

    // Confirm upload
    const confirmRes = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(confirmRes.status).toBe(200)
    expect(confirmRes.body.success).toBe(true)
    expect(confirmRes.body.state).toBe("queued")
    expect(confirmRes.body.observedBytes).toBe(declaredBytes)
    expect(confirmRes.body.confirmedAt).toBeDefined()

    // Verify status endpoint reflects queued state
    const statusRes1 = await asJson(
      await statusRoute.GET(
        req({ token: tokenMember, method: "GET" }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(statusRes1.status).toBe(200)
    expect(statusRes1.body.job.state).toBe("queued")
    expect(statusRes1.body.job.observedBytes).toBe(declaredBytes)

    // Negative case: Duplicate confirmation is rejected with 409
    const dupRes = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(dupRes.status).toBe(409)
    expect(dupRes.body.error).toBe("ALREADY_CONFIRMED")
  })

  // 9. Cross-deal job verification: Job from Deal A cannot be confirmed or read under Deal B
  it("enforces cross-deal boundary: Job A cannot be accessed under Deal B", async () => {
    const viewingIdA = await createViewing(dealIdA)
    const viewingIdB = await createViewing(dealIdB)

    const declaredBytes = 12_000_000
    const intentRes = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes } }),
        ctx({ id: dealIdA, assessmentId: viewingIdA })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId } = intentRes.body

    // Attempt confirm under deal B
    const confirmRes = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdB, assessmentId: viewingIdB, jobId })
      )
    )
    expect(confirmRes.status).toBe(404)
    expect(confirmRes.body.error).toBe("VIDEO_JOB_NOT_FOUND")

    // Attempt status check under deal B
    const statusRes = await asJson(
      await statusRoute.GET(
        req({ token: tokenMember, method: "GET" }),
        ctx({ id: dealIdB, assessmentId: viewingIdB, jobId })
      )
    )
    expect(statusRes.status).toBe(404)
    expect(statusRes.body.error).toBe("VIDEO_JOB_NOT_FOUND")
  })

  // 10. Status returns safe metadata and short-lived signed URLs for frames when ready
  it("returns safe frame metadata and signed URLs when ready_for_review without exposing credentials", async () => {
    const viewingId = await createViewing(dealIdA)
    const declaredBytes = 8_000_000
    const intentRes = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId } = intentRes.body

    // Simulate worker completed extraction: update state to ready_for_review and insert frames
    await db.query(`
      UPDATE ${S}.video_jobs
      SET state = 'ready_for_review',
          duration_ms = 45000,
          contact_sheet_path = 'video-evidence/${dealIdA}/${jobId}/contact_sheet.jpg',
          finished_at = NOW()
      WHERE id = $1
    `, [jobId])

    for (let seq = 0; seq < 2; seq++) {
      const framePath = `video-evidence/${dealIdA}/${jobId}/extracted/frame_${String(seq).padStart(3, "0")}.png`
      const thumbPath = `video-evidence/${dealIdA}/${jobId}/thumbnails/frame_${String(seq).padStart(3, "0")}.jpg`
      await db.query(`
        INSERT INTO ${S}.video_frames (
          job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path, sha256, width, height
        ) VALUES ($1, $2, $3, $4, $5, $6, 1920, 1080)
      `, [jobId, seq, seq * 15000, framePath, thumbPath, "f".repeat(64)])
    }

    const res = await asJson(
      await statusRoute.GET(
        req({ token: tokenMember, method: "GET" }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(res.status).toBe(200)
    const job = res.body.job
    expect(job.state).toBe("ready_for_review")
    expect(job.contactSheetUrl).toContain("token=sig_read_")
    expect(job.frames).toHaveLength(2)
    expect(job.frames[0].originalFrameUrl).toContain("token=sig_read_")
    expect(job.frames[0].thumbnailUrl).toContain("token=sig_read_")

    // Verify zero credentials or DB connection secrets are exposed
    const serialized = JSON.stringify(res.body)
    expect(serialized).not.toContain("password")
    expect(serialized).not.toContain("postgres://")
    expect(serialized).not.toContain("service_role")
  })

  // 11. Original evidence and approved financial values unchanged
  it("guarantees Saved Deal financial values, True MAO, and governance state are completely unmodified", async () => {
    const dealRow = await db.query(
      `SELECT purchase_price, gdv_realistic, refurb_cost, governance_state, engine_result_json FROM ${S}.saved_deals WHERE id = $1`,
      [dealIdA]
    )
    expect(Number(dealRow.rows[0].purchase_price)).toBe(200000)
    expect(Number(dealRow.rows[0].gdv_realistic)).toBe(300000)
    expect(Number(dealRow.rows[0].refurb_cost)).toBe(35000)
    expect(dealRow.rows[0].governance_state).toBe("DRAFT")
    expect(dealRow.rows[0].engine_result_json.trueMao).toBe(195000)
  })

  // 12. Negative test: verifies TUS credential scope, x-signature contract, and fail-closed confirmation on revoked session
  it("verifies TUS credential scope, x-signature contract, and enforces fail-closed confirmation if operator session revoked", async () => {
    const viewingId = await createViewing(dealIdA)
    const declaredBytes = 12_000_000

    const intentRes = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId, sourcePath, protocols, uploadToken } = intentRes.body as {
      jobId: string
      sourcePath: string
      uploadToken: string
      protocols: {
        resumable: {
          signatureHeader: string
          signatureToken: string
          chunkSize: number
          metadata: { bucketName: string; objectName: string; contentType: string }
        }
      }
    }

    // Verify TUS contract
    expect(protocols.resumable.signatureHeader).toBe("x-signature")
    expect(protocols.resumable.signatureToken).toBe(uploadToken)
    expect(protocols.resumable.chunkSize).toBe(6 * 1024 * 1024)
    expect(protocols.resumable.metadata.bucketName).toBe("deal-evidence")
    expect(protocols.resumable.metadata.objectName).toBe(sourcePath)
    expect(protocols.resumable.metadata.contentType).toBe("video/mp4")

    // Verify token is path-bound and never a database credential or service key
    expect(uploadToken).toMatch(/^sig_token_/)
    expect(uploadToken).not.toContain("password")
    expect(uploadToken).not.toContain("postgres")

    // Simulate file arrived in storage
    storage.setObject("deal-evidence", sourcePath, declaredBytes, "video/mp4")

    // Revoke operator session/token before confirmation
    __setOperatorAuthDepsForTests({
      provider: createTestIdentityProvider({}),
      membership: createAllowlistMembershipStore(operatorA)!,
    })

    // Confirmation must fail-closed with 401
    const confirmRes = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(confirmRes.status).toBe(401)
    expect(confirmRes.body.error).toBe("AUTHENTICATION_REQUIRED")

    // Job in database must remain in upload_pending and never queue
    const jobRow = await db.query(`SELECT state FROM ${S}.video_jobs WHERE id = $1`, [jobId])
    expect(jobRow.rows[0].state).toBe("upload_pending")
  })

  // 13. Preliminary correction: rejects late confirmation exceeding 2-hour window
  it("rejects late confirmation with 410 UPLOAD_INTENT_EXPIRED when intent is older than 2 hours", async () => {
    const viewingId = await createViewing(dealIdA)
    const declaredBytes = 5_000_000
    const intentRes = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId, sourcePath } = intentRes.body as { jobId: string; sourcePath: string }
    storage.setObject("deal-evidence", sourcePath, declaredBytes, "video/mp4")

    // Simulate elapsed time: update created_at to 3 hours ago
    await db.query(`UPDATE ${S}.video_jobs SET created_at = NOW() - INTERVAL '3 hours' WHERE id = $1`, [jobId])

    const confirmRes = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(confirmRes.status).toBe(410)
    expect(confirmRes.body.error).toBe("UPLOAD_INTENT_EXPIRED")

    // State remains upload_pending
    const jobRow = await db.query(`SELECT state FROM ${S}.video_jobs WHERE id = $1`, [jobId])
    expect(jobRow.rows[0].state).toBe("upload_pending")
  })

  // 14. Preliminary correction: rejects confirmation when job is marked cancelled
  it("rejects confirmation with 410 JOB_CANCELLED when job deletion_status is not active", async () => {
    const viewingId = await createViewing(dealIdA)
    const declaredBytes = 5_000_000
    const intentRes = await asJson(
      await videoRoute.POST(
        req({ token: tokenMember, body: { contentType: "video/mp4", declaredBytes } }),
        ctx({ id: dealIdA, assessmentId: viewingId })
      )
    )
    expect(intentRes.status).toBe(201)
    const { jobId, sourcePath } = intentRes.body as { jobId: string; sourcePath: string }
    storage.setObject("deal-evidence", sourcePath, declaredBytes, "video/mp4")

    // Mark job cancelled (PENDING_DELETION satisfies check constraint)
    await db.query(`UPDATE ${S}.video_jobs SET deletion_status = 'PENDING_DELETION' WHERE id = $1`, [jobId])

    const confirmRes = await asJson(
      await confirmRoute.POST(
        req({ token: tokenMember, body: {} }),
        ctx({ id: dealIdA, assessmentId: viewingId, jobId })
      )
    )
    expect(confirmRes.status).toBe(410)
    expect(confirmRes.body.error).toBe("JOB_CANCELLED")
  })
})
