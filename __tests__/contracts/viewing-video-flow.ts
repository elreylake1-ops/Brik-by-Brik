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
import * as feedbackRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/feedback/route"
import * as outcomeRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/outcome/route"
import * as exportRoute from "@/app/api/saved-deals/[id]/viewing-assessments/evaluation-export/route"
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } from "@/lib/auth/operator-auth"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { uploadClipFrames } from "@/lib/viewing-assessment/capture/upload-frames"
import { __setBlobStoreForTests } from "@/lib/viewing-assessment/storage/get-blob-store"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"
import { createTestIdentityProvider } from "../fixtures/auth-fixtures"
import { tinyJpeg } from "../fixtures/jpeg-fixtures"

// The whole local workflow, authenticated, with no bypass:
//   frames (as the browser sends them) -> private storage -> simulated analysis -> validated proposals -> human review
// Driven through the real route handlers and the real access guard (test identity + operator membership), using the
// real browser-side upload code with a fetch that dispatches to those handlers. Used by the in-memory run (always) and
// by the Postgres run (only against the confirmed local QA database).

export type FlowEnv = { dealId: string; otherDealId: string; cleanup: () => Promise<void> }

const ctx = (ids: Record<string, string>) => ({ params: Promise.resolve(ids) })
const sha256Hex = async (b: Uint8Array) => createHash("sha256").update(b).digest("hex")
const asJson = async (res: Response) => ({ status: res.status, body: await res.json() })

export function defineVideoFlow(label: string, setup: () => Promise<FlowEnv>) {
  describe(`video -> checklist workflow (${label})`, () => {
    let env: FlowEnv
    let root: string

    beforeEach(async () => {
      env = await setup()
      root = mkdtempSync(path.join(tmpdir(), "brik-flow-"))
      __setBlobStoreForTests(createLocalFsBlobStore(root))
      __setOperatorAuthDepsForTests({
        provider: createTestIdentityProvider({ "tok-member": "operator-1", "tok-outsider": "someone-else" }),
        membership: createAllowlistMembershipStore("operator-1")!,
      })
    })
    afterEach(async () => {
      __setOperatorAuthDepsForTests(undefined)
      __setBlobStoreForTests(undefined)
      rmSync(root, { recursive: true, force: true })
      await env.cleanup()
    })

    const bearer = (token?: string): Record<string, string> => (token ? { authorization: `Bearer ${token}` } : {})
    const call = (token?: string, body?: unknown, method = "POST") =>
      new Request("http://localhost/x", { method, headers: { "content-type": "application/json", ...bearer(token) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    const storedFiles = () => readdirSync(root, { recursive: true }).map(String).filter((f) => f.includes("blob_") && !f.endsWith(".tmp"))

    /** A fetch that hands the browser code's requests to the real route handlers. */
    const serverFetch = ((url: string, init: RequestInit = {}) => {
      const m = String(url).match(/^\/api\/saved-deals\/([^/]+)\/viewing-assessments\/([^/]+)\/evidence(?:\/([^/]+)\/image)?$/)
      if (!m) throw new Error(`unexpected url ${url}`)
      const request = new Request(`http://localhost${url}`, init)
      return m[3] ? imageRoute.PUT(request, ctx({ id: m[1], assessmentId: m[2], evidenceId: m[3] })) : evidenceRoute.POST(request, ctx({ id: m[1], assessmentId: m[2] }))
    }) as unknown as typeof fetch

    const frames = [5, 15, 25, 35].map((t, i) => ({ timestampSeconds: t, room: i % 2 ? "Kitchen" : "Hall", bytes: tinyJpeg(`flow-${i}`) }))
    const clip = { filename: "IMG_8329.mp4", mimeType: "video/mp4", sizeBytes: 12_345_678, durationSeconds: 60 }

    async function newAssessment(token = "tok-member", dealId = env.dealId) {
      const res = await asJson(await listRoute.POST(call(token, { idempotencyKey: `flow-key-${Math.random().toString(36).slice(2, 12)}` }), ctx({ id: dealId })))
      return res.body.assessment.id as string
    }

    it("runs the full flow and keeps every guarantee", async () => {
      const dealInputs = { purchasePrice: 150000, gdv: 250000, refurbCost: 30000, stampDuty: 4500, legalCosts: 2500, saleCosts: 5000, bridgeTermMonths: 6 }
      const shieldInput = { dealId: "d", checks: buildDefaultInvestorShieldChecks("d"), evidenceItems: [], riskFlags: [], manualOverrides: [] }
      const financeBefore = JSON.stringify(analyzeDealWithRefurb(dealInputs))
      const shieldBefore = JSON.stringify(evaluateInvestorShield(shieldInput))

      const assessmentId = await newAssessment()
      const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`

      // 1. the browser's own upload code, authenticated
      const uploaded = await uploadClipFrames(clip, frames, { baseUrl: base, fetchImpl: serverFetch, sha256Hex, headers: () => bearer("tok-member") })
      expect(uploaded.status).toBe("done")
      expect(storedFiles()).toHaveLength(4)

      // 2. detail shows images present (no keys), and the frames are retrievable byte-for-byte
      const detail1 = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(detail1.body.blobs).toHaveLength(4)
      expect(JSON.stringify(detail1.body)).not.toMatch(/blob_|storage_?key/i)
      expect(detail1.body.evidence.map((e: { timestampSeconds: number }) => e.timestampSeconds)).toEqual([5, 15, 25, 35])
      for (const [i, e] of detail1.body.evidence.entries()) {
        const img = await imageRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId, evidenceId: e.id }))
        expect(Buffer.from(await img.arrayBuffer())).toEqual(Buffer.from(frames[i].bytes))
      }

      // 3. simulated analysis; idempotent
      const run = await asJson(await runsRoute.POST(call("tok-member", { idempotencyKey: "flow-run-0001" }), ctx({ id: env.dealId, assessmentId })))
      expect(run.status).toBe(201)
      expect(run.body).toMatchObject({ analysisSource: "SIMULATED", replayed: false, run: { status: "READY_FOR_REVIEW", provider: "fixture", modelVersion: "fixture-frame-analysis-v1" } })
      const again = await asJson(await runsRoute.POST(call("tok-member", { idempotencyKey: "flow-run-0001" }), ctx({ id: env.dealId, assessmentId })))
      expect([again.status, again.body.replayed, again.body.run.id]).toEqual([200, true, run.body.run.id])

      // 4. validated, UNVERIFIED proposals citing real frames; duplicates merged with both sources kept
      const detail2 = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      const frameIds = new Set(detail1.body.evidence.map((e: { id: string }) => e.id))
      expect(detail2.body.proposals).toHaveLength(3) // frames 1 and 4 produce the same finding: merged
      for (const item of detail2.body.proposals) {
        expect(item.proposal).toMatchObject({ verification: "UNVERIFIED", disposition: "PENDING" })
        expect(item.currentReview).toBeNull()
        expect(item.proposal.evidenceIds.every((id: string) => frameIds.has(id))).toBe(true)
      }
      expect(detail2.body.proposals[0].proposal.evidenceIds).toHaveLength(2)
      expect(detail2.body.summary).toMatchObject({ analysisSource: "SIMULATED", awaitingReview: 3, checksWithoutReviewedFinding: 58 })

      // 5. human review: reviewer comes from the verified token; the AI prediction is preserved beside the correction
      const [first, second] = detail2.body.proposals.map((p: { proposal: { id: string } }) => p.proposal.id)
      const accepted = await asJson(await reviewRoute.POST(call("tok-member", { expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: env.dealId, assessmentId, proposalId: first })))
      const edited = await asJson(await reviewRoute.POST(call("tok-member", { expectedRevision: 0, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Surveyor to assess the crack." }), ctx({ id: env.dealId, assessmentId, proposalId: second })))
      expect([accepted.status, edited.status]).toEqual([201, 201])
      expect(accepted.body.item.currentReview.reviewerId).toBe("operator-1")
      const feedback = await asJson(await feedbackRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(feedback.body.feedback).toHaveLength(2)
      const correction = feedback.body.feedback.find((f: { disposition: string }) => f.disposition === "EDITED")
      expect(correction).toMatchObject({ modelVersion: "fixture-frame-analysis-v1", humanCorrection: { status: "SPECIALIST_REVIEW" }, actualOutcome: null, reviewerId: "operator-1" })
      expect(correction.original.observation).not.toBe("Surveyor to assess the crack.") // the model's own words are still on record

      const detail3 = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(detail3.body.summary).toMatchObject({ accepted: 1, edited: 1, awaitingReview: 1, checksWithoutReviewedFinding: 56 })
      expect(detail3.body.proposals.every((p: { proposal: { verification: string } }) => p.proposal.verification === "UNVERIFIED")).toBe(true)

      // 6. none of it touched the proprietary finance engine or Investor Shield
      expect(JSON.stringify(analyzeDealWithRefurb(dealInputs))).toBe(financeBefore)
      expect(JSON.stringify(evaluateInvestorShield(shieldInput))).toBe(shieldBefore)
    })

    it("denies the same flow to an unauthenticated caller and to a non-member, and stores nothing", async () => {
      const assessmentId = await newAssessment()
      const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`
      const anon = await uploadClipFrames(clip, frames, { baseUrl: base, fetchImpl: serverFetch, sha256Hex })
      expect(anon).toMatchObject({ status: "registration_failed", message: expect.stringMatching(/not signed in/) })
      const outsider = await uploadClipFrames(clip, frames, { baseUrl: base, fetchImpl: serverFetch, sha256Hex, headers: () => bearer("tok-outsider") })
      expect(outsider).toMatchObject({ status: "registration_failed", message: expect.stringMatching(/could not be found/) })
      expect(storedFiles()).toHaveLength(0)
      const detail = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(detail.body.evidence).toHaveLength(0)
    })

    it("cannot reach another deal's assessment, frames or analysis with a valid member token", async () => {
      const assessmentId = await newAssessment()
      const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`
      const up = await uploadClipFrames(clip, frames.slice(0, 1), { baseUrl: base, fetchImpl: serverFetch, sha256Hex, headers: () => bearer("tok-member") })
      if (up.status === "registration_failed") throw new Error(up.message)
      const evidenceId = up.evidenceIds[0]
      const other = { id: env.otherDealId, assessmentId }
      expect((await detailRoute.GET(call("tok-member", undefined, "GET"), ctx(other))).status).toBe(404)
      expect((await imageRoute.GET(call("tok-member", undefined, "GET"), ctx({ ...other, evidenceId }))).status).toBe(404)
      expect((await imageRoute.PUT(new Request("http://localhost/x", { method: "PUT", headers: { "content-type": "image/jpeg", ...bearer("tok-member") }, body: tinyJpeg("planted") as unknown as BodyInit }), ctx({ ...other, evidenceId }))).status).toBe(404)
      expect((await runsRoute.POST(call("tok-member", { idempotencyKey: "flow-run-9999" }), ctx(other))).status).toBe(404)
      expect(storedFiles()).toHaveLength(1)
    })

    it("surfaces a provider refusal honestly: failed run, no proposals, nothing verified", async () => {
      const previous = process.env.VIEWING_AI_FIXTURE_SCENARIO
      process.env.VIEWING_AI_FIXTURE_SCENARIO = "refusal"
      try {
        const assessmentId = await newAssessment()
        const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`
        await uploadClipFrames(clip, frames.slice(0, 2), { baseUrl: base, fetchImpl: serverFetch, sha256Hex, headers: () => bearer("tok-member") })
        const run = await asJson(await runsRoute.POST(call("tok-member", { idempotencyKey: "flow-run-0002" }), ctx({ id: env.dealId, assessmentId })))
        expect(run.body.run).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_REFUSAL", proposalsCount: 0 })
        const detail = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
        expect(detail.body.proposals).toHaveLength(0)
        expect(detail.body.summary.checksWithoutReviewedFinding).toBe(58)
      } finally {
        if (previous === undefined) delete process.env.VIEWING_AI_FIXTURE_SCENARIO
        else process.env.VIEWING_AI_FIXTURE_SCENARIO = previous
      }
    })

    it("answers 503 with the unmet requirements (names only) when a live provider is requested but not enabled", async () => {
      const saved = { p: process.env.VIEWING_AI_PROVIDER, k: process.env.ANTHROPIC_API_KEY }
      process.env.VIEWING_AI_PROVIDER = "claude"
      process.env.ANTHROPIC_API_KEY = "sk-ant-NOT-A-REAL-KEY"
      try {
        const assessmentId = await newAssessment()
        const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`
        await uploadClipFrames(clip, frames.slice(0, 1), { baseUrl: base, fetchImpl: serverFetch, sha256Hex, headers: () => bearer("tok-member") })
        const run = await asJson(await runsRoute.POST(call("tok-member", { idempotencyKey: "flow-run-0003" }), ctx({ id: env.dealId, assessmentId })))
        expect(run.status).toBe(503)
        expect(run.body.error).toBe("AI_UNAVAILABLE")
        expect(run.body.reasons.join(" | ")).toMatch(/VIEWING_AI_ENABLED/)
        expect(JSON.stringify(run.body)).not.toContain("NOT-A-REAL-KEY")
        const detail = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
        expect(detail.body.runs).toHaveLength(0) // refused before a run was even created: nothing recorded, nothing spent
      } finally {
        for (const [name, value] of [["VIEWING_AI_PROVIDER", saved.p], ["ANTHROPIC_API_KEY", saved.k]] as const) {
          if (value === undefined) delete process.env[name]
          else process.env[name] = value
        }
      }
    })

    it("records what actually turned out and exports a dataset joining prediction, correction and outcome", async () => {
      const assessmentId = await newAssessment()
      const base = `/api/saved-deals/${env.dealId}/viewing-assessments/${assessmentId}`
      await uploadClipFrames(clip, frames.slice(0, 3), { baseUrl: base, fetchImpl: serverFetch, sha256Hex, headers: () => bearer("tok-member") })
      await runsRoute.POST(call("tok-member", { idempotencyKey: "flow-run-0004" }), ctx({ id: env.dealId, assessmentId }))
      const detail = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      const proposalId = detail.body.proposals[0].proposal.id as string

      await reviewRoute.POST(call("tok-member", { expectedRevision: 0, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Surveyor needed." }), ctx({ id: env.dealId, assessmentId, proposalId }))
      const outcome = await asJson(await outcomeRoute.POST(call("tok-member", { result: "CONFIRMED", source: "SURVEY", observedStatus: "SPECIALIST_REVIEW", note: "Surveyor confirmed movement." }), ctx({ id: env.dealId, assessmentId, proposalId })))
      expect(outcome.status).toBe(201)
      expect(outcome.body.outcome).toMatchObject({ kind: "ACTUAL_OUTCOME", disposition: "EDITED", humanCorrection: { status: "SPECIALIST_REVIEW" }, reviewerId: "operator-1" })

      // the outcome appears in the append-only history, after the review, and the prediction itself is untouched
      const history = await asJson(await feedbackRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(history.body.feedback.map((f: { kind: string }) => f.kind)).toEqual(["REVIEW", "ACTUAL_OUTCOME"])
      const after = await asJson(await detailRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId, assessmentId })))
      expect(after.body.proposals[0].proposal).toEqual(detail.body.proposals[0].proposal)

      // simulated data is excluded from the default export, included on request, with exact references and no identities
      const byDefault = await asJson(await exportRoute.GET(call("tok-member", undefined, "GET"), ctx({ id: env.dealId })))
      expect(byDefault.body.dataset.records).toEqual([])
      expect(byDefault.body.dataset.excludedSimulated).toBeGreaterThan(0)
      const full = await asJson(await exportRoute.GET(new Request("http://localhost/x?includeSimulated=true", { headers: bearer("tok-member") }), ctx({ id: env.dealId })))
      const record = full.body.dataset.records.find((r: { recordId: string }) => r.recordId === proposalId)
      expect(record).toMatchObject({
        simulated: true,
        run: { provider: "fixture", modelVersion: "fixture-frame-analysis-v1", promptVersion: "fixture-prompt-v1" },
        humanReview: { label: "HUMAN_CORRECTED" },
        outcomeLabel: "TRUE_POSITIVE",
        usage: { costBasis: "simulated_free", costMicros: 0 },
      })
      expect(record.evidence.every((e: { timestampSeconds: number; imageSha256: string }) => typeof e.timestampSeconds === "number" && /^[a-f0-9]{64}$/.test(e.imageSha256))).toBe(true)
      expect(JSON.stringify(full.body)).not.toMatch(/operator-1|reviewerId|recordedBy|createdBy|blob_|storage_?key/)

      // outcomes need authentication and membership like everything else
      const anon = await outcomeRoute.POST(call(undefined, { result: "CONFIRMED", source: "SURVEY", note: "x" }), ctx({ id: env.dealId, assessmentId, proposalId }))
      const outsider = await outcomeRoute.POST(call("tok-outsider", { result: "CONFIRMED", source: "SURVEY", note: "x" }), ctx({ id: env.dealId, assessmentId, proposalId }))
      expect([anon.status, outsider.status]).toEqual([401, 404])
    })
  })
}
