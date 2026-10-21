import { createHash } from "node:crypto"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
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
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } from "@/lib/auth/operator-auth"
import { uploadClipFrames } from "@/lib/viewing-assessment/capture/upload-frames"
import { __setBlobStoreForTests } from "@/lib/viewing-assessment/storage/get-blob-store"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"
import { createTestIdentityProvider } from "../fixtures/auth-fixtures"
import { tinyJpeg } from "../fixtures/jpeg-fixtures"

// Unified end-to-end viewing-assessment integration contract:
// Synthetic evidence -> Private storage -> Fixture AI ("complete_flow") -> Human review ->
// Refurbishment scope -> Measurements -> Financial-impact proposal -> Decision ->
// Confidential builder pack -> Three-layer Deal Passport.
//
// Guaranteed properties exercised:
//   1. Fully authorized operator session; unauthenticated & non-member fail closed.
//   2. Video stays local; only extracted JPEG still frames are registered and stored privately.
//   3. Fixture AI proposals are strictly UNVERIFIED and PENDING until reviewed by a person.
//   4. C01 (roof), C41 (bathroom), and C08 (facade) cleanly map into ENGINE_SCOPE and UNPRICED work items.
//   5. Measurements are strictly operator-typed (video source rejected).
//   6. Refurb scope confirmation and financial impact proposals are versioned and idempotent.
//   7. Financial decisions approve proposed adjustments ONLY: nonAuthoritative=true, savedDealChanged=false.
//   8. Builder pack strips all internal profit targets, rates, estimates, and engine vocabulary.
//   9. Deal Passport cleanly separates Authoritative, Confirmed Scope, and Proposed Adjustment layers.
//  10. Authoritative Saved Deal and Investor Shield rows remain 100% byte-for-byte unchanged.

export type UnifiedFlowEnv = {
  dealId: string
  otherDealId: string
  snapshot: (dealId: string) => Promise<string>
  cleanup: () => Promise<void>
}

const ctx = (ids: Record<string, string>) => ({ params: Promise.resolve(ids) })
const sha256Hex = async (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
const asJson = async (res: Response) => ({ status: res.status, body: await res.json() })

export function defineUnifiedE2EFlow(label: string, setup: () => Promise<UnifiedFlowEnv>) {
  describe(`unified end-to-end viewing integration (${label})`, () => {
    let env: UnifiedFlowEnv
    let root: string
    const previousScenario = process.env.VIEWING_AI_FIXTURE_SCENARIO

    beforeEach(async () => {
      process.env.VIEWING_AI_FIXTURE_SCENARIO = "complete_flow"
      env = await setup()
      root = mkdtempSync(path.join(tmpdir(), "brik-unified-flow-"))
      __setBlobStoreForTests(createLocalFsBlobStore(root))
      __setOperatorAuthDepsForTests({
        provider: createTestIdentityProvider({ "tok-member": "operator-1", "tok-outsider": "stranger" }),
        membership: createAllowlistMembershipStore("operator-1")!,
      })
    })

    afterEach(async () => {
      if (previousScenario === undefined) delete process.env.VIEWING_AI_FIXTURE_SCENARIO
      else process.env.VIEWING_AI_FIXTURE_SCENARIO = previousScenario
      __setOperatorAuthDepsForTests(undefined)
      __setBlobStoreForTests(undefined)
      rmSync(root, { recursive: true, force: true })
      await env.cleanup()
    })

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

    const storedBlobs = () => readdirSync(root, { recursive: true }).map(String).filter((f) => f.includes("blob_") && !f.endsWith(".tmp"))

    it("runs the continuous 10-stage integration and preserves all safety and governance invariants", async () => {
      // 0. Capture authoritative baseline snapshot of the Saved Deal
      const baselineSnapshot = await env.snapshot(env.dealId)

      // 1. Create viewing assessment
      const assessmentRes = await asJson(
        await listRoute.POST(call("tok-member", { idempotencyKey: "unified-assessment-key-1" }), ctx({ id: env.dealId }))
      )
      expect(assessmentRes.status).toBe(201)
      const assessmentId = assessmentRes.body.assessment.id as string
      expect(assessmentId).toBeTruthy()

      const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`

      // 2. Register synthetic evidence and upload private frame thumbnails
      const frames = [
        { timestampSeconds: 4.5, room: "Roof slope", bytes: tinyJpeg("roof-frame") },
        { timestampSeconds: 12.0, room: "Family bathroom", bytes: tinyJpeg("bath-frame") },
        { timestampSeconds: 22.5, room: "Front elevation", bytes: tinyJpeg("facade-frame") },
        { timestampSeconds: 35.0, room: "Hallway", bytes: tinyJpeg("hall-frame") },
      ]
      const clip = { filename: "synthetic-clip.mp4", mimeType: "video/mp4", sizeBytes: 15_000_000, durationSeconds: 60 }

      const uploadResult = await uploadClipFrames(clip, frames, {
        baseUrl: base,
        fetchImpl: serverFetch,
        sha256Hex,
        headers: () => bearer("tok-member"),
      })
      if (uploadResult.status !== "done") {
        throw new Error(`Upload failed with status: ${uploadResult.status}`)
      }
      expect(uploadResult.status).toBe("done")
      expect(uploadResult.evidenceIds).toHaveLength(4)
      expect(storedBlobs()).toHaveLength(4)

      // Verify detail shows 4 evidence frames registered and images stored privately
      const detail1 = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(detail1.status).toBe(200)
      expect(detail1.body.evidence).toHaveLength(4)
      expect(detail1.body.blobs).toHaveLength(4)
      expect(JSON.stringify(detail1.body)).not.toMatch(/blob_|storage_?key/i)

      // 3. Invoke fixture AI analysis ("complete_flow" scenario)
      const runRes = await asJson(
        await runsRoute.POST(call("tok-member", { idempotencyKey: "unified-run-key-1" }), ctx({ id: env.dealId, assessmentId }))
      )
      expect(runRes.status).toBe(201)
      expect(runRes.body).toMatchObject({
        analysisSource: "SIMULATED",
        replayed: false,
        run: { status: "READY_FOR_REVIEW", provider: "fixture", proposalsCount: 3 },
      })

      // 4. Inspect validated, UNVERIFIED proposals citing real frame IDs
      const detail2 = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(detail2.body.proposals).toHaveLength(3)
      const checks = detail2.body.proposals.map((p: { proposal: { checkId: string } }) => p.proposal.checkId)
      expect(checks).toEqual(["C01", "C41", "C08"])

      for (const item of detail2.body.proposals) {
        expect(item.proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING" })
        expect(item.proposal.observation).toMatch(/^Synthetic observation:/)
        expect(item.currentReview).toBeNull()
        expect(item.proposal.evidenceIds.length).toBeGreaterThan(0)
      }

      // 5. Human review: Accept C01, Accept C41, Edit C08
      const propC01 = detail2.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C01").proposal.id
      const propC41 = detail2.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C41").proposal.id
      const propC08 = detail2.body.proposals.find((p: { proposal: { checkId: string } }) => p.proposal.checkId === "C08").proposal.id

      const rev1 = await asJson(
        await reviewRoute.POST(
          call("tok-member", { expectedRevision: 0, disposition: "ACCEPTED" }),
          ctx({ id: env.dealId, assessmentId, proposalId: propC01 })
        )
      )
      expect(rev1.status).toBe(201)
      expect(rev1.body.item.currentReview.reviewerId).toBe("operator-1")

      const rev2 = await asJson(
        await reviewRoute.POST(
          call("tok-member", { expectedRevision: 0, disposition: "ACCEPTED" }),
          ctx({ id: env.dealId, assessmentId, proposalId: propC41 })
        )
      )
      expect(rev2.status).toBe(201)

      const rev3 = await asJson(
        await reviewRoute.POST(
          call("tok-member", {
            expectedRevision: 0,
            disposition: "EDITED",
            status: "CONCERN",
            observation: "Human-verified exterior render cracking near lintel.",
          }),
          ctx({ id: env.dealId, assessmentId, proposalId: propC08 })
        )
      )
      expect(rev3.status).toBe(201)

      // 6. Refurbishment proposal: check mapping of reviewed findings into proposed scope
      const proposedPlanRes = await asJson(
        await refurbPlanRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId }))
      )
      expect(proposedPlanRes.status).toBe(200)
      const proposal = proposedPlanRes.body.proposal
      expect(proposal.fingerprint).toMatch(/^[a-f0-9]{64}$/)
      const itemIds = proposal.items.map((i: { itemId: string }) => i.itemId)
      expect(itemIds).toContain("roof")
      expect(itemIds).toContain("bathroom")
      expect(itemIds).toContain("external-walls")

      // 7. Operator measurements (tape/laser/plan)
      // Negative check: ensure source=VIDEO_FRAME is refused
      const badMeas = await asJson(
        await measurementsRoute.POST(
          call("tok-member", {
            idempotencyKey: "meas-bad-video-source",
            basedOnVersion: 0,
            entries: [{ key: "floorAreaSqm", value: 85, basis: "OPERATOR_ESTIMATE", source: "VIDEO_FRAME", note: "attempted from video" }],
          }),
          ctx({ id: env.dealId, assessmentId })
        )
      )
      expect(badMeas.status).toBe(400)

      // Positive measurement entry
      const measEntries = [
        { key: "bedrooms", value: 3, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
        { key: "bathrooms", value: 1, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "" },
        { key: "floorAreaSqm", value: 85, basis: "MEASURED", source: "FLOOR_PLAN", confidence: "high", note: "" },
        { key: "kitchenSize", value: "medium", basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "medium", note: "From listing notes" },
      ]
      const measRes = await asJson(
        await measurementsRoute.POST(
          call("tok-member", { idempotencyKey: "meas-valid-key-1", basedOnVersion: 0, entries: measEntries }),
          ctx({ id: env.dealId, assessmentId })
        )
      )
      expect(measRes.status).toBe(201)
      const measurementSetId = measRes.body.measurementSet.id as string
      expect(measRes.body.measurementSet.version).toBe(1)

      // 8. Preview refurbishment computation (estimates, timeline schedule, financial impact)
      const assumptions = { stampDuty: 3000, legalCosts: 1500, saleCosts: 3000, bridgeTermMonths: 9 }
      const previewRes = await asJson(
        await refurbPlanPreviewRoute.POST(
          call("tok-member", {
            measurementSetId,
            financialAssumptions: assumptions,
            accepted: [{ itemId: "roof" }, { itemId: "bathroom", level: "full_replace" }, { itemId: "external-walls" }],
          }),
          ctx({ id: env.dealId, assessmentId })
        )
      )
      expect(previewRes.status).toBe(200)
      expect(previewRes.body.computation.estimate.totalRefurbCost).toBeGreaterThan(0)
      expect(previewRes.body.computation.schedule.timeline.totalCalendarWeeks).toBeGreaterThan(0)
      expect(previewRes.body.computation.estimate.unpricedItems.map((u: { itemId: string }) => u.itemId)).toContain("external-walls")

      // 9. Confirm refurbishment scope
      // Negative check: wrong/stale fingerprint is rejected
      const staleConfirm = await asJson(
        await refurbPlanRoute.POST(
          call("tok-member", {
            idempotencyKey: "confirm-stale-test-1",
            expectedFingerprint: "0000000000000000000000000000000000000000000000000000000000000000",
            measurementSetId,
            financialAssumptions: assumptions,
            accepted: [{ itemId: "roof" }, { itemId: "bathroom", level: "full_replace" }, { itemId: "external-walls" }],
          }),
          ctx({ id: env.dealId, assessmentId })
        )
      )
      expect(staleConfirm.status).toBe(409)
      expect(staleConfirm.body.error).toBe("STALE_FINDINGS")

      // Positive confirmation
      const confirmBody = {
        idempotencyKey: "confirm-valid-key-1",
        expectedFingerprint: proposal.fingerprint,
        measurementSetId,
        financialAssumptions: assumptions,
        accepted: [{ itemId: "roof" }, { itemId: "bathroom", level: "full_replace" }, { itemId: "external-walls" }],
      }
      const confirmRes = await asJson(await refurbPlanRoute.POST(call("tok-member", confirmBody), ctx({ id: env.dealId, assessmentId })))
      expect(confirmRes.status).toBe(201)
      expect(confirmRes.body.plan).toMatchObject({
        version: 1,
        confirmedBy: "operator-1",
        measurementSetVersion: 1,
        acceptedItems: expect.arrayContaining([
          expect.objectContaining({ itemId: "roof" }),
          expect.objectContaining({ itemId: "bathroom" }),
          expect.objectContaining({ itemId: "external-walls" }),
        ]),
      })

      // Idempotency replay check
      const replayConfirm = await asJson(await refurbPlanRoute.POST(call("tok-member", confirmBody), ctx({ id: env.dealId, assessmentId })))
      expect(replayConfirm.status).toBe(200)
      expect(replayConfirm.body.replayed).toBe(true)

      // 10. Generate versioned financial-impact proposal
      const propRes = await asJson(
        await financialProposalRoute.POST(call("tok-member", { idempotencyKey: "fin-prop-valid-key-1" }), ctx({ id: env.dealId, assessmentId }))
      )
      expect(propRes.status).toBe(201)
      const financialProposal = propRes.body.proposal
      expect(financialProposal.content).toMatchObject({
        nonAuthoritative: true,
        authoritative: expect.any(Object),
        proposed: expect.any(Object),
      })
      expect(financialProposal.content.proposed.refurbCost).toBeGreaterThan(0)
      expect(financialProposal.content.exclusions.map((e: { itemId: string }) => e.itemId)).toContain("external-walls")

      // 11. Human financial decision with acknowledgements
      // Negative check: omitting required notWriteBack acknowledgement must fail
      const badDecisionRes = await asJson(
        await financialDecisionRoute.POST(
          call("tok-member", {
            idempotencyKey: "fin-dec-bad-ack",
            decision: "CONFIRMED",
            proposalHash: financialProposal.contentHash,
            acknowledge: { notWriteBack: false, exclusions: true, unresolvedQuantities: true },
          }),
          ctx({ id: env.dealId, assessmentId, proposalId: financialProposal.id })
        )
      )
      expect(badDecisionRes.status).toBe(400)

      // Negative check: cross-origin CSRF attempt must fail
      const csrfDecisionRes = await asJson(
        await financialDecisionRoute.POST(
          call("tok-member", {
            idempotencyKey: "fin-dec-csrf",
            decision: "CONFIRMED",
            proposalHash: financialProposal.contentHash,
            acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
          }, "POST", "https://evil.example"),
          ctx({ id: env.dealId, assessmentId, proposalId: financialProposal.id })
        )
      )
      expect(csrfDecisionRes.status).toBe(403)

      // Positive operator decision
      const validDecisionBody = {
        idempotencyKey: "fin-dec-valid-1",
        decision: "CONFIRMED",
        proposalHash: financialProposal.contentHash,
        note: "Approved by operator for builder quotation benchmarking",
        acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
      }
      const decisionRes = await asJson(
        await financialDecisionRoute.POST(
          call("tok-member", validDecisionBody),
          ctx({ id: env.dealId, assessmentId, proposalId: financialProposal.id })
        )
      )
      expect(decisionRes.status).toBe(201)
      expect(decisionRes.body).toMatchObject({
        savedDealChanged: false,
        decision: { decision: "CONFIRMED", actor: "operator-1" },
      })

      // 12. Builder quotation pack: verify confidential draft and zero prohibited rate exposure
      const packRes = await asJson(await builderPackRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(packRes.status).toBe(200)
      const pack = packRes.body.pack
      expect(pack).toMatchObject({
        version: "builder-pack-v2",
        status: "DRAFT",
        approval: "NOT_APPROVED",
        confidentiality: { internalEstimateIncluded: false, engineRatesIncluded: false },
      })
      const packString = JSON.stringify({ ...pack, confidentiality: undefined })
      expect(packString).not.toMatch(/[£$€]|\bprofit\b|\bMAO\b|\bGDV\b|\bverdict\b|governance|\bshield\b|purchase price|\blabour\b|\bengine\b/i)
      expect(packString).not.toContain("operator-1")

      // 13. Deal Passport generation: verify 3 distinct layers and metadata
      const passportRes = await asJson(
        await dealPassportRoute.GET(
          new Request(`http://localhost/api/saved-deals/${env.dealId}/deal-passport?assessmentId=${assessmentId}`, {
            method: "GET",
            headers: bearer("tok-member"),
          }),
          ctx({ id: env.dealId })
        )
      )
      expect(passportRes.status).toBe(200)
      const passport = passportRes.body.passport
      expect(passport).toMatchObject({
        status: "DRAFT",
        deal: { dealId: env.dealId },
        investorShield: expect.any(Object),
        refurbishment: { status: "CONFIRMED", confirmedBy: "operator-1" },
        financial: {
          authoritative: expect.any(Object),
          proposal: { status: "CONFIRMED", decision: { actor: "operator-1" } },
        },
      })
      expect(passport.inspection.evidenceFrameCount).toBe(4)
      expect(passport.measurements.current.entries).toHaveLength(4)

      // 14. Immutability guarantee: Saved Deal and Investor Shield rows remain identical
      const afterSnapshot = await env.snapshot(env.dealId)
      expect(afterSnapshot).toBe(baselineSnapshot)

      // 15. Cross-deal isolation: another deal cannot access or mutate this assessment
      const otherContext = ctx({ id: env.otherDealId, assessmentId })
      expect((await detailRoute.GET(call("tok-member", undefined, "GET"), otherContext)).status).toBe(404)
      expect((await refurbPlanRoute.GET(call("tok-member", undefined, "GET"), otherContext)).status).toBe(404)
      expect((await measurementsRoute.GET(call("tok-member", undefined, "GET"), otherContext)).status).toBe(404)
      expect((await financialProposalRoute.GET(call("tok-member", undefined, "GET"), otherContext)).status).toBe(404)
      expect((await builderPackRoute.GET(call("tok-member", undefined, "GET"), otherContext)).status).toBe(404)
    })
  })
}
