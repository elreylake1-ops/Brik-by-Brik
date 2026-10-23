import { createHash } from "node:crypto"
import * as fs from "node:fs"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as listRoute from "@/app/api/saved-deals/[id]/viewing-assessments/route"
import * as detailRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/route"
import * as evidenceRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route"
import * as imageRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/route"
import * as runsRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs/route"
import * as reviewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route"
import * as refurbPlanRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/route"
import * as refurbPlanPreviewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/preview/route"
import * as measurementsRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/measurements/route"
import * as financialProposalRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/route"
import * as financialDecisionRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/[proposalId]/decision/route"
import * as builderPackRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/builder-pack/route"
import * as dealPassportRoute from "@/app/api/saved-deals/[id]/deal-passport/route"
import * as outcomeRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/outcome/route"
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } from "@/lib/auth/operator-auth"
import { uploadClipFrames } from "@/lib/viewing-assessment/capture/upload-frames"
import { exportEvaluationDataset } from "@/lib/viewing-assessment/viewing-assessment-service"
import { __setBlobStoreForTests } from "@/lib/viewing-assessment/storage/get-blob-store"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"
import { inspectMedia, probeStreamPresentationTimestamps } from "@/lib/viewing-assessment/video/media-inspector"
import { extractFramePng, generateThumbnailJpg } from "@/lib/viewing-assessment/video/video-extraction-worker"
import { createTestIdentityProvider } from "./fixtures/auth-fixtures"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { makeDeal } from "./fixtures/refurb-seed"
import { __setRefurbDepsForTests } from "@/lib/refurb-integration/deps"

// TASK 12A: Genuine Video Demonstration and Evidence Verification Test Suite
// Verifies:
// 1. Genuine local video file detection and SHA-256 provenance calculation
// 2. Real FFprobe media inspection (H.264 codec, dimensions, container, duration)
// 3. Hardware stream presentation timestamp (PTS) probing
// 4. Actual FFmpeg extraction of unenhanced lossless PNG frames (-an audio strip)
// 5. Derivative JPEG thumbnail scaling via FFmpeg
// 6. Registration and private storage of decoded video frames
// 7. Complete downstream integration: Human review, Refurb scope, Measurements, True MAO, Builder Pack, Deal Passport, Outcomes

const h = vi.hoisted(() => ({
  repo: null as unknown,
  deals: new Map<string, ReturnType<typeof makeDeal>>(),
}))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: async (id: string) => h.deals.get(id) ?? null,
}))

describe("Task 12A: Genuine Video Demonstration and Evidence Verification", () => {
  let root: string
  const DEAL_ID = "deal-task12a-demo-1"
  const OTHER_DEAL_ID = "deal-task12a-other-2"
  let viewingRepo: ReturnType<typeof createInMemoryViewingRepository>["repo"]
  const videoFixturePath = path.resolve(__dirname, "fixtures/synthetic-video.mp4")

  beforeEach(() => {
    process.env.VIEWING_AI_FIXTURE_SCENARIO = "complete_flow"

    const viewing = createInMemoryViewingRepository().repo
    viewingRepo = viewing
    h.repo = viewing
    const plans = createInMemoryRefurbPlanRepository()
    const measurements = createInMemoryMeasurementRepository()
    const proposals = createInMemoryFinancialRepository()

    const dealA = makeDeal(DEAL_ID, {
      address: "42 Headingley Lane, Leeds LS6 2BS",
      purchase_price: 195000,
      gdv_realistic: 325000,
      refurb_cost: 38000,
    })
    const dealB = makeDeal(OTHER_DEAL_ID, {
      address: "18 Fallowfield Road, Manchester M14 6TT",
      purchase_price: 215000,
      gdv_realistic: 350000,
      refurb_cost: 42000,
    })

    h.deals = new Map([
      [DEAL_ID, dealA],
      [OTHER_DEAL_ID, dealB],
    ])

    const pack = (id: string) => ({
      ...structuredClone(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE),
      meta: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta, savedDealId: id },
      identity: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.identity, dealId: id, address: h.deals.get(id)?.address ?? "" },
    })

    __setRefurbDepsForTests({
      viewing,
      plans,
      measurements,
      proposals,
      getDeal: async (id: string) => h.deals.get(id) ?? null,
      loadPack: async (id: string) => (h.deals.has(id) ? pack(id) : null),
      now: () => new Date("2026-10-23T11:00:00.000Z"),
    })

    root = mkdtempSync(path.join(tmpdir(), "brik-task12a-demo-"))
    __setBlobStoreForTests(createLocalFsBlobStore(root))
    __setOperatorAuthDepsForTests({
      provider: createTestIdentityProvider({ "tok-operator": "james-lake-operator", "tok-outsider": "unauthorized-user" }),
      membership: createAllowlistMembershipStore("james-lake-operator")!,
    })
  })

  afterEach(() => {
    delete process.env.VIEWING_AI_FIXTURE_SCENARIO
    __setOperatorAuthDepsForTests(undefined)
    __setBlobStoreForTests(undefined)
    __setRefurbDepsForTests(undefined)
    rmSync(root, { recursive: true, force: true })
  })

  const ctx = (ids: Record<string, string>) => ({ params: Promise.resolve(ids) })
  const sha256Hex = async (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
  const asJson = async (res: Response) => ({ status: res.status, body: await res.json() })
  const bearer = (token?: string): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {})
  const call = (token?: string, body?: unknown, method = "POST", origin?: string) =>
    new Request("http://localhost/x", {
      method,
      headers: {
        "content-type": "application/json",
        host: "localhost",
        ...(origin ? { origin } : {}),
        ...bearer(token),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })

  const serverFetch = ((url: string, init: RequestInit = {}) => {
    const m = String(url).match(/^\/api\/saved-deals\/([^/]+)\/viewing-assessments\/([^/]+)\/evidence(?:\/([^/]+)\/image)?$/)
    if (!m) throw new Error(`unexpected url ${url}`)
    const request = new Request(`http://localhost${url}`, init)
    return m[3]
      ? imageRoute.PUT(request, ctx({ id: m[1], assessmentId: m[2], evidenceId: m[3] }))
      : evidenceRoute.POST(request, ctx({ id: m[1], assessmentId: m[2] }))
  }) as unknown as typeof fetch

  it("exercises genuine FFprobe inspection, FFmpeg frame extraction, and complete downstream assessment", async () => {
    // =========================================================================
    // 1. Verify existence and compute SHA-256 of the genuine local video fixture
    // =========================================================================
    expect(fs.existsSync(videoFixturePath)).toBe(true)
    const videoBytes = fs.readFileSync(videoFixturePath)
    expect(videoBytes.length).toBeGreaterThan(0)
    const videoSha256 = createHash("sha256").update(videoBytes).digest("hex")
    expect(videoSha256).toBe("468e7eec18db2ee41c3628433b747b36878194b8d15778ac74c87d0f39d6c4b2")

    // =========================================================================
    // 2. Real FFprobe media inspection & hardware PTS stream probing
    // =========================================================================
    const mediaInspection = await inspectMedia(videoFixturePath)
    expect(mediaInspection.valid).toBe(true)
    if (mediaInspection.valid) {
      expect(mediaInspection.codec).toBe("h264")
      expect(mediaInspection.durationSec).toBe(3)
      expect(mediaInspection.width).toBe(320)
      expect(mediaInspection.height).toBe(240)
      expect(mediaInspection.fps).toBe(10)
    }

    const streamPts = await probeStreamPresentationTimestamps(videoFixturePath)
    expect(streamPts.length).toBe(30) // 3 seconds at 10 fps
    expect(streamPts[0]).toBe(0)
    expect(streamPts[10]).toBeCloseTo(1.0, 1)
    expect(streamPts[20]).toBeCloseTo(2.0, 1)

    // =========================================================================
    // 3. Genuine FFmpeg extraction of frames & derivative JPEG thumbnails
    // =========================================================================
    const tmpPng0 = path.join(root, "extracted_frame_0.png")
    const tmpJpg0 = path.join(root, "thumb_frame_0.jpg")
    const tmpPng1 = path.join(root, "extracted_frame_1.png")
    const tmpJpg1 = path.join(root, "thumb_frame_1.jpg")
    const tmpPng2 = path.join(root, "extracted_frame_2.png")
    const tmpJpg2 = path.join(root, "thumb_frame_2.jpg")

    const png0 = await extractFramePng(videoFixturePath, 0.5, tmpPng0)
    const jpg0 = await generateThumbnailJpg(tmpPng0, tmpJpg0)
    const png1 = await extractFramePng(videoFixturePath, 1.5, tmpPng1)
    const jpg1 = await generateThumbnailJpg(tmpPng1, tmpJpg1)
    const png2 = await extractFramePng(videoFixturePath, 2.5, tmpPng2)
    const jpg2 = await generateThumbnailJpg(tmpPng2, tmpJpg2)

    expect(png0.length).toBeGreaterThan(0)
    expect(jpg0.length).toBeGreaterThan(0)
    expect(png1.length).toBeGreaterThan(0)
    expect(jpg1.length).toBeGreaterThan(0)
    expect(png2.length).toBeGreaterThan(0)
    expect(jpg2.length).toBeGreaterThan(0)

    const sha0 = createHash("sha256").update(jpg0).digest("hex")
    const sha1 = createHash("sha256").update(jpg1).digest("hex")
    const sha2 = createHash("sha256").update(jpg2).digest("hex")

    // =========================================================================
    // 4. Register viewing assessment and upload real decoded video frames
    // =========================================================================
    const createRes = await asJson(
      await listRoute.POST(call("tok-operator", { idempotencyKey: "task12a-asmt-1" }), ctx({ id: DEAL_ID }))
    )
    expect(createRes.status).toBe(201)
    const assessmentId = createRes.body.assessment.id as string
    const base = `/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}`

    const realExtractedFrames = [
      { timestampSeconds: 0.5, room: "Roof slope", bytes: jpg0 },
      { timestampSeconds: 1.5, room: "Family bathroom", bytes: jpg1 },
      { timestampSeconds: 2.5, room: "Front elevation", bytes: jpg2 },
    ]
    const clipMeta = {
      filename: "synthetic-video.mp4",
      mimeType: "video/mp4",
      sizeBytes: videoBytes.length,
      durationSeconds: 3,
      contentSha256: videoSha256,
    }

    const upload = await uploadClipFrames(clipMeta, realExtractedFrames, {
      baseUrl: base,
      fetchImpl: serverFetch,
      sha256Hex,
      headers: () => bearer("tok-operator"),
    })
    expect(upload.status).toBe("done")
    expect(upload.evidenceIds).toHaveLength(3)

    // Verify stored blobs match real SHA-256 hashes
    const detail = await asJson(await detailRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(detail.status).toBe(200)
    expect(detail.body.blobs).toHaveLength(3)
    const blobHashes = detail.body.blobs.map((b: { sha256: string }) => b.sha256)
    expect(blobHashes).toContain(sha0)
    expect(blobHashes).toContain(sha1)
    expect(blobHashes).toContain(sha2)

    // =========================================================================
    // 5. AI visible-condition suggestions against genuine frame IDs
    // =========================================================================
    const runRes = await asJson(
      await runsRoute.POST(call("tok-operator", { idempotencyKey: "task12a-run-1" }), ctx({ id: DEAL_ID, assessmentId }))
    )
    expect(runRes.status).toBe(201)
    expect(runRes.body.analysisSource).toBe("SIMULATED")

    const detailWithProposals = await asJson(await detailRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(detailWithProposals.body.proposals).toHaveLength(3)

    const propC01 = detailWithProposals.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C01").proposal.id
    const propC08 = detailWithProposals.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C08").proposal.id
    const propC41 = detailWithProposals.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C41").proposal.id

    // =========================================================================
    // 6. Human verification: Accept C01, Edit C08, Reject C41
    // =========================================================================
    const revAccept = await asJson(
      await reviewRoute.POST(call("tok-operator", { expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: DEAL_ID, assessmentId, proposalId: propC01 }))
    )
    expect(revAccept.status).toBe(201)

    const revEdit = await asJson(
      await reviewRoute.POST(
        call("tok-operator", {
          expectedRevision: 0,
          disposition: "EDITED",
          status: "CONCERN",
          observation: "Render spalling verified near ground damp proof course.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC08 })
      )
    )
    expect(revEdit.status).toBe(201)

    const revReject = await asJson(
      await reviewRoute.POST(
        call("tok-operator", {
          expectedRevision: 0,
          disposition: "REJECTED",
          reason: "Bath tiling intact; surface condensation only.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC41 })
      )
    )
    expect(revReject.status).toBe(201)

    // =========================================================================
    // 7. Refurbishment scope & Operator measurements
    // =========================================================================
    const planProposalRes = await asJson(await refurbPlanRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(planProposalRes.status).toBe(200)
    const planProp = planProposalRes.body.proposal
    expect(planProp.items.map((i: { itemId: string }) => i.itemId)).toEqual(["roof", "external-walls"])
    expect(planProp.excluded.some((e: { checkId: string; reason: string }) => e.checkId === "C41" && e.reason === "REJECTED")).toBe(true)

    const measRes = await asJson(
      await measurementsRoute.POST(
        call("tok-operator", {
          idempotencyKey: "task12a-meas-1",
          basedOnVersion: 0,
          entries: [
            { key: "bedrooms", value: 3, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
            { key: "bathrooms", value: 1, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
            { key: "floorAreaSqm", value: 92, basis: "MEASURED", source: "FLOOR_PLAN", confidence: "high", note: "" },
          ],
        }),
        ctx({ id: DEAL_ID, assessmentId })
      )
    )
    expect(measRes.status).toBe(201)
    const measurementSetId = measRes.body.measurementSet.id as string

    // Scope confirmation with financial assumptions
    const financialAssumptions = { stampDuty: 6500, legalCosts: 2000, saleCosts: 4500, bridgeTermMonths: 9 }
    const confirmRes = await asJson(
      await refurbPlanRoute.POST(
        call("tok-operator", {
          idempotencyKey: "task12a-confirm-1",
          expectedFingerprint: planProp.fingerprint,
          measurementSetId,
          financialAssumptions,
          accepted: [{ itemId: "roof" }, { itemId: "external-walls" }],
        }),
        ctx({ id: DEAL_ID, assessmentId })
      )
    )
    expect(confirmRes.status).toBe(201)
    expect(confirmRes.body.plan.confirmedBy).toBe("james-lake-operator")

    // =========================================================================
    // 8. Brik financial engine & operator financial approval
    // =========================================================================
    const propRes = await asJson(
      await financialProposalRoute.POST(call("tok-operator", { idempotencyKey: "task12a-finprop-1" }), ctx({ id: DEAL_ID, assessmentId }))
    )
    expect(propRes.status).toBe(201)
    const finProp = propRes.body.proposal

    const decRes = await asJson(
      await financialDecisionRoute.POST(
        call("tok-operator", {
          idempotencyKey: "task12a-findec-1",
          decision: "CONFIRMED",
          proposalHash: finProp.contentHash,
          acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: finProp.id })
      )
    )
    expect(decRes.status).toBe(201)
    expect(decRes.body.savedDealChanged).toBe(false)

    // =========================================================================
    // 9. Confidential Builder Pack & Three-Layer Deal Passport
    // =========================================================================
    const packRes = await asJson(await builderPackRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(packRes.status).toBe(200)
    expect(packRes.body.pack).toMatchObject({
      version: "builder-pack-v2",
      confidentiality: { internalEstimateIncluded: false, engineRatesIncluded: false },
    })

    const passRes = await asJson(
      await dealPassportRoute.GET(
        new Request(`http://localhost/api/saved-deals/${DEAL_ID}/deal-passport?assessmentId=${assessmentId}`, {
          method: "GET",
          headers: bearer("tok-operator"),
        }),
        ctx({ id: DEAL_ID })
      )
    )
    expect(passRes.status).toBe(200)
    expect(passRes.body.passport).toMatchObject({
      status: "DRAFT",
      deal: { dealId: DEAL_ID },
      refurbishment: { status: "CONFIRMED", confirmedBy: "james-lake-operator" },
    })

    // =========================================================================
    // 10. Continuous-learning actual outcome recording
    // =========================================================================
    const outcomeRes = await asJson(
      await outcomeRoute.POST(
        call("tok-operator", {
          result: "CONFIRMED",
          source: "SURVEY",
          observedStatus: "CONCERN",
          note: "Structural surveyor confirmed roof slate deterioration.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC01 })
      )
    )
    expect(outcomeRes.status).toBe(201)

    const dataset = await exportEvaluationDataset(viewingRepo, { dealId: DEAL_ID, includeSimulated: true })
    const c01Rec = dataset.records.find((r) => r.checkId === "C01")!
    expect(c01Rec.outcomes[0]).toMatchObject({ result: "CONFIRMED", source: "SURVEY" })
    expect(c01Rec.outcomeLabel).toBe("TRUE_POSITIVE")
  }, 30000)
})
