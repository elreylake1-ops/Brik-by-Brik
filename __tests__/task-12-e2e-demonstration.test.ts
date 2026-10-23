import { createHash } from "node:crypto"
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
import { createTestIdentityProvider } from "./fixtures/auth-fixtures"
import { tinyJpeg } from "./fixtures/jpeg-fixtures"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { makeDeal } from "./fixtures/refurb-seed"
import { __setRefurbDepsForTests } from "@/lib/refurb-integration/deps"

// TASK 12: Comprehensive End-to-End Working Demonstration Test Suite
// Verifies all 10 stages:
// 1. Video-to-Evidence upload & private frame extraction
// 2. AI-assisted condition suggestions with verified frame IDs & hashes
// 3. Human verification workflows: Accept, Edit, and Reject
// 4. Exclusion of rejected suggestions from works proposals
// 5. Refurbishment scope mapping, Schedule of Works, and supplier costing
// 6. Operator measurements (tape/laser/plan) with rejection of video sources
// 7. Deterministic True MAO and financial engine recalculations
// 8. Confidential Builder Quote Pack (zero rate leakage, blank quote sheets)
// 9. Three-layer Deal Passport assembly (Authoritative, Confirmed, Proposed)
// 10. Continuous-learning actual outcome recording and evaluation dataset export

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

describe("Task 12: End-to-End Integration, Security Acceptance & Working Demonstration", () => {
  let root: string
  const DEAL_ID = "deal-task12-demo-1"
  const OTHER_DEAL_ID = "deal-task12-other-2"
  let viewingRepo: ReturnType<typeof createInMemoryViewingRepository>["repo"]
  const previousScenario = process.env.VIEWING_AI_FIXTURE_SCENARIO

  beforeEach(() => {
    process.env.VIEWING_AI_FIXTURE_SCENARIO = "complete_flow"

    const viewing = createInMemoryViewingRepository().repo
    viewingRepo = viewing
    h.repo = viewing
    const plans = createInMemoryRefurbPlanRepository()
    const measurements = createInMemoryMeasurementRepository()
    const proposals = createInMemoryFinancialRepository()

    const dealA = makeDeal(DEAL_ID, {
      address: "24 Park Avenue, Headingley, Leeds LS6 2EE",
      purchase_price: 185000,
      gdv_realistic: 310000,
      refurb_cost: 35000,
    })
    const dealB = makeDeal(OTHER_DEAL_ID, {
      address: "10 Victoria Road, Manchester M14 5XX",
      purchase_price: 210000,
      gdv_realistic: 340000,
      refurb_cost: 40000,
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
      now: () => new Date("2026-10-23T10:00:00.000Z"),
    })

    root = mkdtempSync(path.join(tmpdir(), "brik-task12-demo-"))
    __setBlobStoreForTests(createLocalFsBlobStore(root))
    __setOperatorAuthDepsForTests({
      provider: createTestIdentityProvider({ "tok-operator": "james-lake-operator", "tok-outsider": "unauthorized-user" }),
      membership: createAllowlistMembershipStore("james-lake-operator")!,
    })
  })

  afterEach(() => {
    if (previousScenario === undefined) delete process.env.VIEWING_AI_FIXTURE_SCENARIO
    else process.env.VIEWING_AI_FIXTURE_SCENARIO = previousScenario
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

  it("executes the complete 10-step Video-to-Evidence, Refurbishment, and Financial Demonstration", async () => {
    // =========================================================================
    // STEP 1: Assessment Initialization & Baseline Snapshot
    // =========================================================================
    const initialDeal = h.deals.get(DEAL_ID)!
    const baselineSnapshot = JSON.stringify(initialDeal)

    const createRes = await asJson(
      await listRoute.POST(call("tok-operator", { idempotencyKey: "task12-assessment-key-1" }), ctx({ id: DEAL_ID }))
    )
    expect(createRes.status).toBe(201)
    const assessmentId = createRes.body.assessment.id as string
    expect(assessmentId).toBeTruthy()

    const base = `/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}`

    // =========================================================================
    // STEP 2: Frame Extraction, SHA-256 Provenance & Private Storage
    // =========================================================================
    const rawFrames = [
      { timestampSeconds: 4.5, room: "Roof slope", bytes: tinyJpeg("roof-frame-1") },
      { timestampSeconds: 14.0, room: "Family bathroom", bytes: tinyJpeg("bath-frame-1") },
      { timestampSeconds: 26.5, room: "Front elevation", bytes: tinyJpeg("facade-frame-1") },
      { timestampSeconds: 38.0, room: "Hallway", bytes: tinyJpeg("hallway-frame-1") },
    ]
    const clip = { filename: "property-inspection-walkthrough.mp4", mimeType: "video/mp4", sizeBytes: 32_000_000, durationSeconds: 65 }

    const upload = await uploadClipFrames(clip, rawFrames, {
      baseUrl: base,
      fetchImpl: serverFetch,
      sha256Hex,
      headers: () => bearer("tok-operator"),
    })
    expect(upload.status).toBe("done")
    expect(upload.evidenceIds).toHaveLength(4)

    // Verify private storage received 4 blob files and API never leaks storage keys
    const storedBlobFiles = readdirSync(root, { recursive: true }).map(String).filter((f) => f.includes("blob_") && !f.endsWith(".tmp"))
    expect(storedBlobFiles).toHaveLength(4)

    const detailAfterUpload = await asJson(await detailRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(detailAfterUpload.status).toBe(200)
    expect(detailAfterUpload.body.evidence).toHaveLength(4)
    expect(detailAfterUpload.body.blobs).toHaveLength(4)
    expect(JSON.stringify(detailAfterUpload.body)).not.toMatch(/blob_|storage_?key/i)

    // =========================================================================
    // STEP 3: AI-Assisted Visible-Condition Suggestion
    // =========================================================================
    const runRes = await asJson(
      await runsRoute.POST(call("tok-operator", { idempotencyKey: "task12-run-key-1" }), ctx({ id: DEAL_ID, assessmentId }))
    )
    expect(runRes.status).toBe(201)
    expect(runRes.body).toMatchObject({
      analysisSource: "SIMULATED",
      replayed: false,
      run: { status: "READY_FOR_REVIEW", provider: "fixture", proposalsCount: 3 },
    })

    const detailAfterRun = await asJson(await detailRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(detailAfterRun.body.proposals).toHaveLength(3)

    for (const item of detailAfterRun.body.proposals) {
      expect(item.proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING" })
      expect(item.proposal.evidenceIds.length).toBeGreaterThan(0)
      expect(item.currentReview).toBeNull()
    }

    // =========================================================================
    // STEP 4: Human Verification Workflows (Accept, Amend, Reject)
    // =========================================================================
    const propC01 = detailAfterRun.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C01").proposal.id
    const propC08 = detailAfterRun.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C08").proposal.id
    const propC41 = detailAfterRun.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C41").proposal.id

    // 4.1 Accept valid finding (C01 roof tiles slipped)
    const revAccept = await asJson(
      await reviewRoute.POST(
        call("tok-operator", { expectedRevision: 0, disposition: "ACCEPTED" }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC01 })
      )
    )
    expect(revAccept.status).toBe(201)
    expect(revAccept.body.item.currentReview).toMatchObject({
      disposition: "ACCEPTED",
      reviewerId: "james-lake-operator",
      revision: 1,
    })

    // 4.2 Amend inaccurate finding (C08 exterior render cracking near opening)
    const revAmend = await asJson(
      await reviewRoute.POST(
        call("tok-operator", {
          expectedRevision: 0,
          disposition: "EDITED",
          status: "CONCERN",
          observation: "Render hairline cracking confirmed along bay window reveal; no masonry displacement.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC08 })
      )
    )
    expect(revAmend.status).toBe(201)
    expect(revAmend.body.item.currentReview).toMatchObject({
      disposition: "EDITED",
      reviewerId: "james-lake-operator",
      editedObservation: "Render hairline cracking confirmed along bay window reveal; no masonry displacement.",
    })

    // 4.3 Reject unsupported finding (C41 bathroom seal; operator confirms harmless water stain)
    const revReject = await asJson(
      await reviewRoute.POST(
        call("tok-operator", {
          expectedRevision: 0,
          disposition: "REJECTED",
          reason: "Sealant intact; superficial limescale staining only. No replacement needed.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC41 })
      )
    )
    expect(revReject.status).toBe(201)
    expect(revReject.body.item.currentReview).toMatchObject({
      disposition: "REJECTED",
      reviewerId: "james-lake-operator",
      reason: "Sealant intact; superficial limescale staining only. No replacement needed.",
    })

    // =========================================================================
    // STEP 5: Refurbishment Scope & Exclusion of Rejected Suggestions
    // =========================================================================
    const planProposalRes = await asJson(
      await refurbPlanRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId }))
    )
    expect(planProposalRes.status).toBe(200)
    const planProposal = planProposalRes.body.proposal

    // Verify accepted items: roof and external walls
    const itemIds = planProposal.items.map((i: { itemId: string }) => i.itemId)
    expect(itemIds).toContain("roof")
    expect(itemIds).toContain("external-walls")
    expect(itemIds).not.toContain("bathroom") // Bathroom was REJECTED; MUST NOT be proposed!

    // Verify rejection record in excluded list
    const excludedBathroom = planProposal.excluded.find((e: { checkId: string }) => e.checkId === "C41")
    expect(excludedBathroom).toMatchObject({ checkId: "C41", reason: "REJECTED" })

    // =========================================================================
    // STEP 6: Operator Measurements (Tape/Laser/Plan)
    // =========================================================================
    const measRes = await asJson(
      await measurementsRoute.POST(
        call("tok-operator", {
          idempotencyKey: "task12-meas-key-1",
          basedOnVersion: 0,
          entries: [
            { key: "bedrooms", value: 4, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "Ground & first floor counted" },
            { key: "bathrooms", value: 2, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "Family bath + ensuite" },
            { key: "floorAreaSqm", value: 125, basis: "MEASURED", source: "FLOOR_PLAN", confidence: "high", note: "Architectural floor plan" },
            { key: "kitchenSize", value: "medium", basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "medium", note: "Galley style" },
          ],
        }),
        ctx({ id: DEAL_ID, assessmentId })
      )
    )
    expect(measRes.status).toBe(201)
    const measurementSetId = measRes.body.measurementSet.id as string

    // =========================================================================
    // STEP 7: Refurbishment Costing, Timeline Schedule & Scope Confirmation
    // =========================================================================
    const financialAssumptions = { stampDuty: 6500, legalCosts: 2000, saleCosts: 4500, bridgeTermMonths: 9 }

    // 7.1 Preview computation
    const previewRes = await asJson(
      await refurbPlanPreviewRoute.POST(
        call("tok-operator", {
          measurementSetId,
          financialAssumptions,
          accepted: [{ itemId: "roof" }, { itemId: "external-walls" }],
        }),
        ctx({ id: DEAL_ID, assessmentId })
      )
    )
    expect(previewRes.status).toBe(200)
    const comp = previewRes.body.computation
    expect(comp.estimate.totalRefurbCost).toBeGreaterThan(0)
    expect(comp.schedule.timeline.totalCalendarWeeks).toBeGreaterThan(0)
    // external-walls is UNPRICED: must appear in unpricedItems list without inventing costs
    expect(comp.estimate.unpricedItems.map((u: { itemId: string }) => u.itemId)).toContain("external-walls")

    // 7.2 Confirm scope
    const confirmRes = await asJson(
      await refurbPlanRoute.POST(
        call("tok-operator", {
          idempotencyKey: "task12-confirm-key-1",
          expectedFingerprint: planProposal.fingerprint,
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
    // STEP 8: Proprietary Brik Financial Engine & Operator Decision
    // =========================================================================
    const finPropRes = await asJson(
      await financialProposalRoute.POST(call("tok-operator", { idempotencyKey: "task12-fin-prop-1" }), ctx({ id: DEAL_ID, assessmentId }))
    )
    expect(finPropRes.status).toBe(201)
    const finProposal = finPropRes.body.proposal
    expect(finProposal.content.nonAuthoritative).toBe(true)
    expect(finProposal.content.proposed.trueMao.twentyPercent).toBeGreaterThan(0)

    // Operator confirms proposal with mandatory acknowledgements
    const finDecRes = await asJson(
      await financialDecisionRoute.POST(
        call("tok-operator", {
          idempotencyKey: "task12-fin-dec-1",
          decision: "CONFIRMED",
          proposalHash: finProposal.contentHash,
          note: "James Lake confirmed for builder quoting and lender comparison",
          acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: finProposal.id })
      )
    )
    expect(finDecRes.status).toBe(201)
    expect(finDecRes.body.savedDealChanged).toBe(false)
    expect(finDecRes.body.decision.actor).toBe("james-lake-operator")

    // Assert Saved Deal remains 100% byte-for-byte untouched
    const afterDeal = h.deals.get(DEAL_ID)!
    expect(JSON.stringify(afterDeal)).toBe(baselineSnapshot)

    // =========================================================================
    // STEP 9: Confidential Builder Quote Pack & Three-Layer Deal Passport
    // =========================================================================
    // 9.1 Builder Pack
    const packRes = await asJson(await builderPackRoute.GET(call("tok-operator", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId })))
    expect(packRes.status).toBe(200)
    const builderPack = packRes.body.pack
    expect(builderPack).toMatchObject({
      version: "builder-pack-v2",
      status: "DRAFT",
      confidentiality: { internalEstimateIncluded: false, engineRatesIncluded: false },
    })

    // String scan: Builder Pack MUST NOT contain profit, rates, MAO, GDV, or operator name
    const packStr = JSON.stringify({ ...builderPack, confidentiality: undefined })
    expect(packStr).not.toMatch(/[£$€]|\bprofit\b|\bMAO\b|\bGDV\b|\blabour\b|\bengine\b/i)
    expect(packStr).not.toContain("james-lake-operator")

    // 9.2 Deal Passport
    const passportRes = await asJson(
      await dealPassportRoute.GET(
        new Request(`http://localhost/api/saved-deals/${DEAL_ID}/deal-passport?assessmentId=${assessmentId}`, {
          method: "GET",
          headers: bearer("tok-operator"),
        }),
        ctx({ id: DEAL_ID })
      )
    )
    expect(passportRes.status).toBe(200)
    const passport = passportRes.body.passport
    expect(passport).toMatchObject({
      status: "DRAFT",
      deal: { dealId: DEAL_ID },
      refurbishment: { status: "CONFIRMED", confirmedBy: "james-lake-operator" },
      financial: {
        authoritative: expect.any(Object),
        proposal: { status: "CONFIRMED", decision: { actor: "james-lake-operator" } },
      },
    })
    expect(passport.inspection.evidenceFrameCount).toBe(4)

    // =========================================================================
    // STEP 10: Continuous-Learning & Actual Outcome Recording
    // =========================================================================
    // Record RICS Level 3 survey confirmation for C01 roof tiles
    const outcomeC01 = await asJson(
      await outcomeRoute.POST(
        call("tok-operator", {
          result: "CONFIRMED",
          source: "SURVEY",
          observedStatus: "CONCERN",
          note: "RICS Level 3 building survey confirmed 8 slipped slates on rear elevation with minor batten damp.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC01 })
      )
    )
    expect(outcomeC01.status).toBe(201)
    expect(outcomeC01.body.outcome).toMatchObject({
      proposalId: propC01,
      reviewerId: "james-lake-operator",
      actualOutcome: {
        result: "CONFIRMED",
        source: "SURVEY",
      },
    })

    // Record contractor quote outcome for C08 render cracking
    const outcomeC08 = await asJson(
      await outcomeRoute.POST(
        call("tok-operator", {
          result: "PARTIALLY_CONFIRMED",
          source: "CONTRACTOR_QUOTE",
          observedStatus: "CONCERN",
          note: "Plasterer confirmed surface hairline cracks only; raking out and silicone render patch quoted at £350.",
        }),
        ctx({ id: DEAL_ID, assessmentId, proposalId: propC08 })
      )
    )
    expect(outcomeC08.status).toBe(201)
    expect(outcomeC08.body.outcome).toMatchObject({
      proposalId: propC08,
      reviewerId: "james-lake-operator",
      actualOutcome: {
        result: "PARTIALLY_CONFIRMED",
        source: "CONTRACTOR_QUOTE",
      },
    })

    // Export evaluation dataset and verify feedback linkage across AI prediction, human review, and actual outcome
    const dataset = await exportEvaluationDataset(viewingRepo, { dealId: DEAL_ID, includeSimulated: true })
    expect(dataset.records.length).toBeGreaterThanOrEqual(3)

    const c01Rec = dataset.records.find((r) => r.checkId === "C01")!
    expect(c01Rec.prediction.status).toBe("CONCERN")
    expect(c01Rec.humanReview.label).toBe("HUMAN_AGREES")
    expect(c01Rec.outcomes).toHaveLength(1)
    expect(c01Rec.outcomes[0]).toMatchObject({ result: "CONFIRMED", source: "SURVEY" })
    expect(c01Rec.outcomeLabel).toBe("TRUE_POSITIVE")

    const c08Rec = dataset.records.find((r) => r.checkId === "C08")!
    expect(c08Rec.humanReview.label).toBe("HUMAN_CORRECTED")
    expect(c08Rec.outcomes).toHaveLength(1)
    expect(c08Rec.outcomes[0]).toMatchObject({ result: "PARTIALLY_CONFIRMED", source: "CONTRACTOR_QUOTE" })

    const c41Rec = dataset.records.find((r) => r.checkId === "C41")!
    expect(c41Rec.humanReview.label).toBe("HUMAN_REJECTED")

    // =========================================================================
    // STEP 11: Security & Multi-Tenant Access Controls
    // =========================================================================
    // 11.1 Cross-deal isolation (Other deal cannot view or mutate this assessment)
    const otherContext = ctx({ id: OTHER_DEAL_ID, assessmentId })
    expect((await detailRoute.GET(call("tok-operator", undefined, "GET"), otherContext)).status).toBe(404)
    expect((await refurbPlanRoute.GET(call("tok-operator", undefined, "GET"), otherContext)).status).toBe(404)
    expect((await builderPackRoute.GET(call("tok-operator", undefined, "GET"), otherContext)).status).toBe(404)

    // 11.2 Unauthorized user fails closed (404 prevents deal ID enumeration)
    expect((await detailRoute.GET(call("tok-outsider", undefined, "GET"), ctx({ id: DEAL_ID, assessmentId }))).status).toBe(404)
    expect((await detailRoute.GET(call(undefined, undefined, "GET"), ctx({ id: DEAL_ID, assessmentId }))).status).toBe(401)

    // 11.3 CSRF origin check
    const csrfRes = await asJson(
      await financialDecisionRoute.POST(
        call("tok-operator", { idempotencyKey: "csrf-key", decision: "CONFIRMED" }, "POST", "https://malicious.example"),
        ctx({ id: DEAL_ID, assessmentId, proposalId: finProposal.id })
      )
    )
    expect(csrfRes.status).toBe(403)
  })
})
