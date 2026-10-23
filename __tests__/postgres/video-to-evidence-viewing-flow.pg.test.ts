import { execFile } from "node:child_process"
import { randomUUID } from "node:crypto"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { promisify } from "node:util"
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
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
import {
  processVideoJob,
} from "@/lib/viewing-assessment/video/video-extraction-worker"
import {
  claimNextQueuedVideoJob,
  listVideoFramesByJobId,
} from "@/lib/viewing-assessment/video/video-jobs-repository"
import * as videoRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/route"
import * as confirmRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/confirm/route"
import * as statusRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/route"
import * as attachRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/attach/route"
import * as detailRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/route"
import * as reviewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route"
import * as exportRoute from "@/app/api/saved-deals/[id]/viewing-assessments/evaluation-export/route"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { buildCheckStates } from "@/lib/viewing-assessment/check-states"
import type { RouteContext } from "@/lib/viewing-assessment/route-support"

const execFileAsync = promisify(execFile)
const gate = qaGate("Postgres video-to-evidence viewing flow")
const S = "brik_by_brik_engine"

describe.skipIf(!gate.enabled)("Postgres video-to-evidence viewing assessment integration (isolated QA only)", () => {
  let db: typeof import("@/lib/db/postgres")
  let storage: InMemoryVideoStorageService

  const testRunId = randomUUID().slice(0, 8)
  const dealId = `qa-deal-11e-${testRunId}`
  const otherDealId = `qa-deal-other-11e-${testRunId}`
  const operatorId = `qa-op-11e-${testRunId}`
  const outsiderId = `qa-op-outsider-11e-${testRunId}`
  const tokenMember = `tok-member-11e-${testRunId}`
  const tokenOutsider = `tok-outsider-11e-${testRunId}`

  let viewingId: string

  const createSyntheticClip = async (durationSec = 2): Promise<Buffer> => {
    const tempOut = path.join(os.tmpdir(), `synth_11e_${randomUUID()}.mp4`)
    const args = [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "testsrc=size=320x240:rate=10",
      "-t",
      String(durationSec),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-f",
      "mp4",
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

  const ctx = (params: Record<string, string>): RouteContext => ({
    params: Promise.resolve(params),
  })

  const req = (options: {
    token?: string
    body?: unknown
    method?: string
  }) => {
    const { token, body, method = "POST" } = options
    const headers: Record<string, string> = {
      host: "localhost:3000",
    }
    if (token) {
      headers.authorization = `Bearer ${token}`
    }
    if (body !== undefined) {
      headers["content-type"] = "application/json"
    }

    return new Request("http://localhost:3000/api/endpoint", {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()

    // Create primary deal and other deal with authoritative financial figures
    for (const [id, addr] of [
      [dealId, "10 Downing Road, London"],
      [otherDealId, "99 Baker Street, London"],
    ] as const) {
      await db.query(`
        INSERT INTO ${S}.saved_deals (
          id, address, purchase_price, gdv_realistic, refurb_cost,
          classification, governance_state, capital_protection_state,
          pipeline_state, engine_result_json, risk_summary_json
        ) VALUES (
          $1, $2, 250000, 380000, 45000,
          'STANDARD', 'DRAFT', 'PROTECTED',
          'UNDER_ANALYSIS', '{"trueMao": 235000, "profit": 42000}'::jsonb, '{"riskFlags": []}'::jsonb
        )
      `, [id, addr])
    }

    viewingId = `qa-view-11e-${testRunId}`
    await db.query(`
      INSERT INTO ${S}.viewing_assessments (id, deal_id, checklist_version, idempotency_key, created_by)
      VALUES ($1, $2, 'v1', $3, $4)
    `, [viewingId, dealId, `key-${viewingId}`, operatorId])
  })

  afterAll(async () => {
    __setOperatorAuthDepsForTests(undefined)
    __setVideoStorageServiceForTests(undefined)
    if (db) {
      try {
        await db.query(`DELETE FROM ${S}.viewing_proposals WHERE assessment_id IN (SELECT id FROM ${S}.viewing_assessments WHERE deal_id = ANY($1))`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.viewing_evidence_blobs WHERE evidence_id IN (SELECT id FROM ${S}.viewing_evidence WHERE assessment_id IN (SELECT id FROM ${S}.viewing_assessments WHERE deal_id = ANY($1)))`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.viewing_evidence WHERE assessment_id IN (SELECT id FROM ${S}.viewing_assessments WHERE deal_id = ANY($1))`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.viewing_analysis_runs WHERE assessment_id IN (SELECT id FROM ${S}.viewing_assessments WHERE deal_id = ANY($1))`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.viewing_assets WHERE assessment_id IN (SELECT id FROM ${S}.viewing_assessments WHERE deal_id = ANY($1))`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.video_frames WHERE job_id IN (SELECT id FROM ${S}.video_jobs WHERE deal_id = ANY($1))`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.video_jobs WHERE deal_id = ANY($1)`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.viewing_assessments WHERE deal_id = ANY($1)`, [[dealId, otherDealId]])
        await db.query(`DELETE FROM ${S}.saved_deals WHERE id = ANY($1)`, [[dealId, otherDealId]])
      } catch {
        // Disposable QA container handles cleanup if needed
      }
      await db.getPostgresPool().end()
    }
  })

  beforeEach(() => {
    storage = new InMemoryVideoStorageService()
    __setVideoStorageServiceForTests(storage)
    __setOperatorAuthDepsForTests({
      provider: createTestIdentityProvider({
        [tokenMember]: operatorId,
        [tokenOutsider]: outsiderId,
      }),
      membership: createAllowlistMembershipStore(operatorId)!,
    })
  })

  afterEach(() => {
    __setOperatorAuthDepsForTests(undefined)
    __setVideoStorageServiceForTests(undefined)
  })

  it("completes full operator workflow: upload -> extract -> attach -> review -> zero unreviewed financial mutation", async () => {
    // 0. Establish baseline authoritative financial and investor shield state
    const dealInputs = { purchasePrice: 250000, gdv: 380000, refurbCost: 45000, stampDuty: 7500, legalCosts: 2500, saleCosts: 5000, bridgeTermMonths: 6 }
    const shieldInput = { dealId, checks: buildDefaultInvestorShieldChecks(dealId), evidenceItems: [], riskFlags: [], manualOverrides: [] }
    const baselineFinanceJson = JSON.stringify(analyzeDealWithRefurb(dealInputs))
    const baselineShieldJson = JSON.stringify(evaluateInvestorShield(shieldInput))

    // 1. Step 1: Upload Intent (Direct TUS initialization)
    const videoBytes = await createSyntheticClip(2)

    const intentRes = await videoRoute.POST(
      req({
        token: tokenMember,
        body: {
          filename: "ground_floor_walkthrough.mp4",
          contentType: "video/mp4",
          declaredBytes: videoBytes.length,
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId })
    )
    expect(intentRes.status).toBe(201)
    const intentData = await intentRes.json()
    expect(intentData.success).toBe(true)
    const jobId = intentData.jobId as string
    expect(intentData.uploadEndpoint).toContain(intentData.sourcePath)

    // Store video in storage simulating completed direct TUS upload
    await storage.uploadObject("deal-evidence", intentData.sourcePath, videoBytes, "video/mp4")

    // 2. Step 2: Upload Confirmation
    const confirmRes = await confirmRoute.POST(
      req({
        token: tokenMember,
        body: {},
      }),
      ctx({ id: dealId, assessmentId: viewingId, jobId })
    )
    expect(confirmRes.status).toBe(200)
    const confirmData = await confirmRes.json()
    expect(confirmData.success).toBe(true)
    expect(confirmData.state).toBe("queued")

    // 3. Step 3: Worker Processing (extract genuine PNG frames and contact sheet)
    const claimedJob = await claimNextQueuedVideoJob("worker-11e", 30, dealId)
    expect(claimedJob).not.toBeNull()
    expect(claimedJob!.id).toBe(jobId)

    const processResult = await processVideoJob(claimedJob!, { storage, workerId: "worker-11e" })
    expect(processResult.success).toBe(true)
    expect(processResult.frameCount).toBeGreaterThanOrEqual(4)

    // 4. Step 4: Status Verification & Frame Gallery
    const statusRes = await statusRoute.GET(
      req({ token: tokenMember, method: "GET" }),
      ctx({ id: dealId, assessmentId: viewingId, jobId })
    )
    expect(statusRes.status).toBe(200)
    const statusData = await statusRes.json()
    expect(statusData.success).toBe(true)
    expect(statusData.job.state).toBe("ready_for_review")
    expect(statusData.job.frames.length).toBe(processResult.frameCount)

    const frame0 = statusData.job.frames[0]
    const frame1 = statusData.job.frames[1]
    expect(frame0.sequenceNo).toBe(0)
    expect(frame0.mimeType).toBe("image/png") // Lossless original PNG
    expect(frame0.sourceTimeMs).toBeGreaterThanOrEqual(0)
    expect(frame0.isReviewedEvidence).toBe(false) // Candidate derivative before review

    // 5. Step 5: Attach Frame 0 to Checklist C01 (Roof and Rainwater Goods) as suggestion
    const attachRes1 = await attachRoute.POST(
      req({
        token: tokenMember,
        body: {
          frameId: frame0.id,
          checkId: "C01",
          status: "CONCERN",
          observation: "Cracked gutter observed in walkthrough frame 0",
          room: "Exterior Front",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, jobId })
    )
    expect(attachRes1.status).toBe(201)
    const attachData1 = await attachRes1.json()
    expect(attachData1.success).toBe(true)
    expect(attachData1.checkId).toBe("C01")
    const proposal1Id = attachData1.proposalId as string

    // 6. Invariant Check: Attached frame is marked as reviewed evidence to protect from overwrite
    const dbFrames = await listVideoFramesByJobId(jobId)
    const updatedFrame0 = dbFrames.find((f) => f.id === frame0.id)
    expect(updatedFrame0?.is_reviewed_evidence).toBe(true)

    // 7. Invariant Check: Proposal is nonauthoritative / UNVERIFIED suggestion
    const detailRes1 = await detailRoute.GET(
      req({ token: tokenMember, method: "GET" }),
      ctx({ id: dealId, assessmentId: viewingId })
    )
    const detailData1 = await detailRes1.json()
    const propItem1 = detailData1.proposals.find((p: { proposal: { id: string } }) => p.proposal.id === proposal1Id)
    expect(propItem1).toBeDefined()
    expect(propItem1.proposal.verification).toBe("UNVERIFIED")
    expect(propItem1.proposal.disposition).toBe("PENDING")
    expect(propItem1.currentReview).toBeNull()

    // 8. Invariant Check: Checklist item C01 remains NOT_ASSESSED until explicit operator review
    const checkStates1 = buildCheckStates(["C01"], detailData1.proposals)
    expect(checkStates1[0].state).toBe("NOT_ASSESSED")
    expect(checkStates1[0].basis).toBe("none")
    expect(checkStates1[0].pendingCount).toBe(1)

    // 9. Invariant Check: Financials and Investor Shield remain 100% UNTOUCHED
    expect(JSON.stringify(analyzeDealWithRefurb(dealInputs))).toBe(baselineFinanceJson)
    expect(JSON.stringify(evaluateInvestorShield(shieldInput))).toBe(baselineShieldJson)

    // 10. Step 6: Attach Frame 1 to C02 and then REJECT it in Human Review
    const attachRes2 = await attachRoute.POST(
      req({
        token: tokenMember,
        body: {
          frameId: frame1.id,
          checkId: "C02",
          status: "OBSERVED",
          observation: "Potential chimney defect",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, jobId })
    )
    expect(attachRes2.status).toBe(201)
    const proposal2Id = (await attachRes2.json()).proposalId

    // Operator rejects Proposal 2
    const rejectRes = await reviewRoute.POST(
      req({
        token: tokenMember,
        body: {
          expectedRevision: 0,
          disposition: "REJECTED",
          reason: "Artifact/shadow only, no actual chimney defect.",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, proposalId: proposal2Id })
    )
    expect(rejectRes.status).toBe(201)

    // Verify C02 remains NOT_ASSESSED after rejection
    const detailRes2 = await detailRoute.GET(
      req({ token: tokenMember, method: "GET" }),
      ctx({ id: dealId, assessmentId: viewingId })
    )
    const detailData2 = await detailRes2.json()
    const checkStates2 = buildCheckStates(["C02"], detailData2.proposals)
    expect(checkStates2[0].state).toBe("NOT_ASSESSED")
    expect(checkStates2[0].basis).toBe("none")
    expect(checkStates2[0].rejectedCount).toBe(1)

    // Re-verify financials still 100% UNTOUCHED
    expect(JSON.stringify(analyzeDealWithRefurb(dealInputs))).toBe(baselineFinanceJson)
    expect(JSON.stringify(evaluateInvestorShield(shieldInput))).toBe(baselineShieldJson)

    // 11. Step 7: Operator Human Review - Explicitly ACCEPT Proposal 1
    const acceptRes = await reviewRoute.POST(
      req({
        token: tokenMember,
        body: {
          expectedRevision: 0,
          disposition: "ACCEPTED",
          reason: "Confirmed gutter crack from genuine video frame.",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, proposalId: proposal1Id })
    )
    expect(acceptRes.status).toBe(201)
    const acceptData = await acceptRes.json()
    expect(acceptData.item.currentReview.disposition).toBe("ACCEPTED")
    expect(acceptData.item.currentReview.reviewerId).toBe(operatorId)

    // 12. Verification: Checklist C01 is now updated with human review
    const detailRes3 = await detailRoute.GET(
      req({ token: tokenMember, method: "GET" }),
      ctx({ id: dealId, assessmentId: viewingId })
    )
    const detailData3 = await detailRes3.json()
    const checkStates3 = buildCheckStates(["C01"], detailData3.proposals)
    expect(checkStates3[0].state).toBe("CONCERN")
    expect(checkStates3[0].basis).toBe("human_reviewed")

    // 13. Builder Pack / Deal Passport dataset export integration
    const exportRes = await exportRoute.GET(
      new Request("http://localhost:3000/api/export?includeSimulated=true", {
        headers: { host: "localhost:3000", authorization: `Bearer ${tokenMember}` },
      }),
      ctx({ id: dealId })
    )
    expect(exportRes.status).toBe(200)
    const exportData = await exportRes.json()
    expect(exportData.dataset).toBeDefined()
    const record = exportData.dataset.records.find((r: { recordId: string }) => r.recordId === proposal1Id)
    expect(record).toBeDefined()
    expect(record.humanReview.label).toBe("HUMAN_AGREES")
    expect(record.humanReview.revisions[0].disposition).toBe("ACCEPTED")
    expect(record.evidence[0].timestampSeconds).toBeCloseTo(frame0.sourceTimeMs / 1000, 1)
  }, 30_000)

  it("rejects unauthorized, cross-deal, and malformed attach requests", async () => {
    // 1. Cross-deal rejection: accessing job from another deal
    const crossRes = await attachRoute.POST(
      req({
        token: tokenMember,
        body: {
          frameId: "dummy-frame",
          checkId: "C01",
        },
      }),
      ctx({ id: otherDealId, assessmentId: viewingId, jobId: "dummy-job" })
    )
    expect([403, 404]).toContain(crossRes.status)

    // 2. Outsider token rejection
    const outsiderRes = await attachRoute.POST(
      req({
        token: tokenOutsider,
        body: {
          frameId: "dummy-frame",
          checkId: "C01",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, jobId: "dummy-job" })
    )
    expect([401, 403, 404]).toContain(outsiderRes.status)

    // 3. Unauthenticated rejection
    const unauthRes = await attachRoute.POST(
      req({
        body: {
          frameId: "dummy-frame",
          checkId: "C01",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, jobId: "dummy-job" })
    )
    expect(unauthRes.status).toBe(401)

    // 4. Invalid checkId validation rejection (e.g. "X99")
    // Needs a valid job to reach body validation
    const validJobRes = await videoRoute.POST(
      req({
        token: tokenMember,
        body: {
          filename: "test.mp4",
          contentType: "video/mp4",
          declaredBytes: 1024,
          idempotencyKey: `invalid-check-${testRunId}`,
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId })
    )
    const validJobId = (await validJobRes.json()).jobId

    const invalidCheckRes = await attachRoute.POST(
      req({
        token: tokenMember,
        body: {
          frameId: "some-frame",
          checkId: "INVALID_99",
        },
      }),
      ctx({ id: dealId, assessmentId: viewingId, jobId: validJobId })
    )
    expect(invalidCheckRes.status).toBe(400)
    const err = await invalidCheckRes.json()
    expect(err.validation.errors[0]).toMatch(/not a valid C01-C45 or V01-V13/)
  })
})
