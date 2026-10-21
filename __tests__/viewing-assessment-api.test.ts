import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"

const h = vi.hoisted(() => ({
  repo: null as unknown,
  access: vi.fn(),
  getDeal: vi.fn(),
}))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))
vi.mock("@/lib/operator-command/require-saved-deal-read-access", () => ({
  requireSavedDealReadAccess: h.access,
}))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({ getSavedDealById: h.getDeal }))

import * as listRoute from "@/app/api/saved-deals/[id]/viewing-assessments/route"
import * as detailRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/route"
import * as evidenceRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route"
import * as runsRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs/route"
import * as feedbackRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/feedback/route"
import * as reviewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { runMockAnalysis } from "@/lib/viewing-assessment/viewing-assessment-service"
import type { VideoAnalysisService } from "@/types/viewing-assessment"

const OPERATOR = { kind: "internal_operator", subject: "operator-1" }
let mem: ReturnType<typeof createInMemoryViewingRepository>

type Ids = { id?: string; assessmentId?: string; proposalId?: string }
const ctx = (ids: Ids) => ({ params: Promise.resolve(ids) })
const req = (body?: unknown, method = "POST") =>
  new Request("http://localhost/x", {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  })
const read = async (res: Response) => ({ status: res.status, body: await res.json() })

const clip = {
  filename: "IMG_8329.mp4",
  mimeType: "video/mp4",
  sizeBytes: 1_000_000,
  durationSeconds: 60,
  contentSha256: "a".repeat(64),
}
const evidenceBody = (over: Record<string, unknown> = {}) => ({
  clip,
  frames: [
    { timestampSeconds: 4, room: "Front" },
    { timestampSeconds: 12, room: "Kitchen" },
    { timestampSeconds: 30 },
  ],
  ...over,
})

async function createAssessment(dealId = "deal-1", key = "create-key-0001") {
  const r = await read(await listRoute.POST(req({ idempotencyKey: key }), ctx({ id: dealId })))
  return r.body.assessment.id as string
}

async function seedAnalysed(dealId = "deal-1") {
  const assessmentId = await createAssessment(dealId)
  await evidenceRoute.POST(req(evidenceBody()), ctx({ id: dealId, assessmentId }))
  const run = await read(
    await runsRoute.POST(req({ idempotencyKey: "run-key-00001" }), ctx({ id: dealId, assessmentId }))
  )
  const detail = await read(await detailRoute.GET(req(undefined, "GET"), ctx({ id: dealId, assessmentId })))
  return { assessmentId, run, detail }
}

beforeEach(() => {
  mem = createInMemoryViewingRepository()
  h.repo = mem.repo
  h.access.mockReset().mockResolvedValue({ allowed: true, principal: OPERATOR })
  h.getDeal.mockReset().mockImplementation(async (id: string) => (["deal-1", "deal-2"].includes(id) ? { id } : null))
})

describe("authentication and Saved Deal access", () => {
  it("fails closed on every endpoint when unauthenticated and writes nothing", async () => {
    h.access.mockResolvedValue({ allowed: false, reason: "unauthenticated", status: 401, code: "AUTHENTICATION_REQUIRED" })
    const ids = { id: "deal-1", assessmentId: "a", proposalId: "p" }
    const calls = [
      listRoute.GET(req(undefined, "GET"), ctx(ids)),
      listRoute.POST(req({ idempotencyKey: "create-key-0001" }), ctx(ids)),
      detailRoute.GET(req(undefined, "GET"), ctx(ids)),
      evidenceRoute.POST(req(evidenceBody()), ctx(ids)),
      runsRoute.GET(req(undefined, "GET"), ctx(ids)),
      runsRoute.POST(req({ idempotencyKey: "run-key-00001" }), ctx(ids)),
      feedbackRoute.GET(req(undefined, "GET"), ctx(ids)),
      reviewRoute.POST(req({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx(ids)),
    ]
    for (const res of await Promise.all(calls)) {
      const { status, body } = await read(res)
      expect(status).toBe(401)
      expect(body).toEqual({ success: false, error: "AUTHENTICATION_REQUIRED" })
    }
    expect(mem.rows.assessments).toHaveLength(0)
    expect(h.getDeal).not.toHaveBeenCalled()
  })

  it("returns a privacy-preserving 404 for unauthorized principals", async () => {
    h.access.mockResolvedValue({ allowed: false, reason: "unauthorized", status: 404, code: "SAVED_DEAL_NOT_FOUND" })
    const { status, body } = await read(await listRoute.GET(req(undefined, "GET"), ctx({ id: "deal-1" })))
    expect([status, body.error]).toEqual([404, "SAVED_DEAL_NOT_FOUND"])
  })

  it("404s an unknown Saved Deal and rejects malformed identifiers", async () => {
    const missing = await read(await listRoute.POST(req({ idempotencyKey: "create-key-0001" }), ctx({ id: "nope" })))
    expect(missing.status).toBe(404)
    const bad = await read(await listRoute.GET(req(undefined, "GET"), ctx({ id: "../etc/passwd" })))
    expect(bad.status).toBe(400)
    expect(mem.rows.assessments).toHaveLength(0)
  })
})

describe("create / list / idempotency", () => {
  it("derives ownership server-side and replays the same key without duplicating", async () => {
    const first = await read(await listRoute.POST(req({ idempotencyKey: "create-key-0001" }), ctx({ id: "deal-1" })))
    const second = await read(await listRoute.POST(req({ idempotencyKey: "create-key-0001" }), ctx({ id: "deal-1" })))
    expect([first.status, second.status]).toEqual([201, 200])
    expect(second.body.replayed).toBe(true)
    expect(second.body.assessment.id).toBe(first.body.assessment.id)
    expect(mem.rows.assessments).toHaveLength(1)
    expect(mem.rows.assessments[0]).toMatchObject({ dealId: "deal-1", createdBy: "operator-1", checklistVersion: "viewing-checklist-v1" })
  })

  it("rejects client-supplied ownership, identity and financial fields", async () => {
    for (const extra of [{ dealId: "deal-2" }, { createdBy: "evil" }, { reviewerId: "x" }, { gdv: 1 }, { investmentApproved: true }]) {
      const r = await read(await listRoute.POST(req({ idempotencyKey: "create-key-0001", ...extra }), ctx({ id: "deal-1" })))
      expect(r.status).toBe(400)
    }
    expect(mem.rows.assessments).toHaveLength(0)
  })

  it("lists only the requested deal's assessments", async () => {
    await createAssessment("deal-1", "create-key-0001")
    await createAssessment("deal-2", "create-key-0002")
    const r = await read(await listRoute.GET(req(undefined, "GET"), ctx({ id: "deal-1" })))
    expect(r.body.assessments).toHaveLength(1)
    expect(r.body.assessments[0].dealId).toBe("deal-1")
  })

  it("handles malformed, non-object and oversized bodies", async () => {
    expect((await listRoute.POST(req("{not json"), ctx({ id: "deal-1" }))).status).toBe(400)
    expect((await listRoute.POST(req("[]"), ctx({ id: "deal-1" }))).status).toBe(400)
    const huge = JSON.stringify({ idempotencyKey: "create-key-0001", pad: "x".repeat(70_000) })
    expect((await listRoute.POST(req(huge), ctx({ id: "deal-1" }))).status).toBe(413)
  })
})

describe("cross-deal access denial", () => {
  it("denies every operation on another deal's assessment", async () => {
    const { assessmentId, detail } = await seedAnalysed("deal-1")
    const proposalId = detail.body.proposals[0].proposal.id
    const other = { id: "deal-2", assessmentId, proposalId }
    const results = await Promise.all([
      detailRoute.GET(req(undefined, "GET"), ctx(other)),
      evidenceRoute.POST(req(evidenceBody({ clip: { ...clip, contentSha256: "b".repeat(64) } })), ctx(other)),
      runsRoute.GET(req(undefined, "GET"), ctx(other)),
      runsRoute.POST(req({ idempotencyKey: "run-key-00002" }), ctx(other)),
      feedbackRoute.GET(req(undefined, "GET"), ctx(other)),
      reviewRoute.POST(req({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx(other)),
    ])
    for (const res of results) expect(res.status).toBe(404)
    expect(mem.rows.reviews).toHaveLength(0)
    expect(mem.rows.assets).toHaveLength(1)
  })
})

describe("evidence validation", () => {
  it.each([
    ["unsupported mime", { clip: { ...clip, mimeType: "application/pdf" } }],
    ["path in filename", { clip: { ...clip, filename: "../../secret.mp4" } }],
    ["oversized clip", { clip: { ...clip, sizeBytes: 999_999_999 } }],
    ["client storage key", { clip: { ...clip, storageKey: "s3://private/x" } }],
    ["frame beyond clip", { frames: [{ timestampSeconds: 61 }] }],
    ["mismatched capture provenance", { frames: [{ timestampSeconds: 1, requestedTimestampSeconds: 1, captureMethod: "video-frame-callback", captureConfidence: "manual-user-positioned" }] }],
    ["incomplete capture provenance", { frames: [{ timestampSeconds: 1, requestedTimestampSeconds: 1 }] }],
    ["stale capture provenance", { frames: [{ timestampSeconds: 2, requestedTimestampSeconds: 1, captureMethod: "video-frame-callback", captureConfidence: "presented-frame-confirmed" }] }],
    ["no frames", { frames: [] }],
    ["bad hash", { clip: { ...clip, contentSha256: "xyz" } }],
    ["unknown top-level field", { dealId: "deal-2" }],
  ])("rejects %s", async (_label, over) => {
    const assessmentId = await createAssessment()
    const r = await read(await evidenceRoute.POST(req(evidenceBody(over)), ctx({ id: "deal-1", assessmentId })))
    expect(r.status).toBe(400)
    expect(mem.rows.assets).toHaveLength(0)
  })

  it("stores metadata only, never exposes storage paths, and rejects a duplicate clip", async () => {
    const assessmentId = await createAssessment()
    const ok = await read(await evidenceRoute.POST(req(evidenceBody()), ctx({ id: "deal-1", assessmentId })))
    expect(ok.status).toBe(201)
    expect(JSON.stringify(ok.body).toLowerCase()).not.toContain("storage")
    expect(ok.body.asset.source).toBe("DECLARED_METADATA")
    const dup = await read(await evidenceRoute.POST(req(evidenceBody()), ctx({ id: "deal-1", assessmentId })))
    expect([dup.status, dup.body.error]).toEqual([409, "DUPLICATE_ASSET"])
  })

  it("preserves requested and actual timestamps with capture provenance", async () => {
    const assessmentId = await createAssessment()
    const body = evidenceBody({
      frames: [{
        timestampSeconds: 11.52,
        requestedTimestampSeconds: 11.5,
        captureMethod: "video-frame-callback",
        captureConfidence: "presented-frame-confirmed",
      }],
    })
    const result = await read(await evidenceRoute.POST(req(body), ctx({ id: "deal-1", assessmentId })))
    expect(result.status).toBe(201)
    expect(result.body.evidence[0]).toMatchObject({
      timestampSeconds: 11.52,
      requestedTimestampSeconds: 11.5,
      captureMethod: "video-frame-callback",
      captureConfidence: "presented-frame-confirmed",
    })
    expect(mem.rows.evidence[0]).toMatchObject(result.body.evidence[0])
  })
})

describe("mock analysis runs", () => {
  it("requires registered evidence", async () => {
    const assessmentId = await createAssessment()
    const r = await read(await runsRoute.POST(req({ idempotencyKey: "run-key-00001" }), ctx({ id: "deal-1", assessmentId })))
    expect([r.status, r.body.error]).toEqual([409, "NO_EVIDENCE_REGISTERED"])
    expect(mem.rows.proposals).toHaveLength(0)
  })

  it("creates UNVERIFIED pending proposals linked to real evidence, labelled SIMULATED", async () => {
    const { run, detail } = await seedAnalysed()
    expect(run.status).toBe(201)
    expect(run.body).toMatchObject({ analysisSource: "SIMULATED", replayed: false, run: { status: "READY_FOR_REVIEW", provider: "fixture" } })
    const frameIds = new Set(mem.rows.evidence.map((e) => e.id))
    expect(detail.body.proposals).toHaveLength(3)
    for (const item of detail.body.proposals) {
      expect(item.proposal.verification).toBe("UNVERIFIED")
      expect(item.currentReview).toBeNull()
      expect(item.proposal.evidenceIds.every((id: string) => frameIds.has(id))).toBe(true)
    }
    expect(detail.body.summary).toMatchObject({ analysisSource: "SIMULATED", awaitingReview: 3, checksWithoutReviewedFinding: 58 })
  })

  it("is retry-safe: the same key replays the stored run and adds no proposals", async () => {
    const { assessmentId } = await seedAnalysed()
    const again = await read(await runsRoute.POST(req({ idempotencyKey: "run-key-00001" }), ctx({ id: "deal-1", assessmentId })))
    expect([again.status, again.body.replayed]).toEqual([200, true])
    expect(mem.rows.proposals).toHaveLength(3)
    const runs = await read(await runsRoute.GET(req(undefined, "GET"), ctx({ id: "deal-1", assessmentId })))
    expect(runs.body.runs).toHaveLength(1)
  })

  it("records a failed run honestly with no proposals, and reopens it on retry", async () => {
    const assessmentId = await createAssessment()
    await evidenceRoute.POST(req(evidenceBody()), ctx({ id: "deal-1", assessmentId }))
    let calls = 0
    const flaky: VideoAnalysisService = {
      modelVersion: "flaky-v1",
      async analyse(input) {
        if (++calls === 1) throw new Error("provider down")
        return (await import("@/lib/viewing-assessment/mock-video-analysis-service")).mockVideoAnalysisService.analyse(input)
      },
    }
    const args = { dealId: "deal-1", assessmentId, idempotencyKey: "run-key-00001", actor: "operator-1" }
    const first = await runMockAnalysis(mem.repo, args, flaky)
    expect(first).toMatchObject({ status: "ok", run: { status: "FAILED", errorCode: "ANALYSIS_FAILED", attemptCount: 1 } })
    expect(mem.rows.proposals).toHaveLength(0)
    const retry = await runMockAnalysis(mem.repo, args, flaky)
    expect(retry).toMatchObject({ status: "ok", run: { status: "READY_FOR_REVIEW", attemptCount: 2 } })
    expect(mem.rows.proposals).toHaveLength(3)
  })

  it("marks a run PARTIAL when the provider returns invalid findings, keeping the valid ones", async () => {
    const assessmentId = await createAssessment()
    const ev = await read(await evidenceRoute.POST(req(evidenceBody()), ctx({ id: "deal-1", assessmentId })))
    const frame = ev.body.evidence[0].id
    const dodgy: VideoAnalysisService = {
      modelVersion: "dodgy-v1",
      async analyse({ assessmentId: id }) {
        return {
          kind: "brik-ai-findings",
          version: 1,
          assessmentId: id,
          modelVersion: "dodgy-v1",
          findings: [
            { checkId: "C08", status: "concern", observation: "Cracked render", frameIds: [frame], confidence: "low" },
            { checkId: "C99", status: "concern", observation: "Invented check", frameIds: [frame], confidence: "low" },
            { checkId: "C10", status: "concern", observation: "Phantom evidence", frameIds: ["ghost"], confidence: "low" },
          ],
        }
      },
    }
    const out = await runMockAnalysis(mem.repo, { dealId: "deal-1", assessmentId, idempotencyKey: "run-key-00001", actor: "operator-1" }, dodgy)
    expect(out).toMatchObject({ status: "ok", run: { status: "PARTIAL", proposalsCount: 1, rejectedCount: 2 } })
  })
})

describe("human review and preserved prediction history", () => {
  it("records server-derived reviewer identity and keeps the AI prediction untouched", async () => {
    const { assessmentId, detail } = await seedAnalysed()
    const target = detail.body.proposals[0].proposal
    const before = structuredClone(mem.rows.proposals[0])

    const ctxP = ctx({ id: "deal-1", assessmentId, proposalId: target.id })
    const edited = await read(
      await reviewRoute.POST(
        req({ expectedRevision: 0, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Structural crack; surveyor needed." }),
        ctxP
      )
    )
    expect(edited.status).toBe(201)
    expect(edited.body.item.currentReview).toMatchObject({ reviewerId: "operator-1", disposition: "EDITED", revision: 1 })
    expect(edited.body.item.proposal).toEqual(before)
    expect(mem.rows.proposals[0]).toEqual(before)

    const rejected = await read(await reviewRoute.POST(req({ expectedRevision: 1, disposition: "REJECTED", reason: "Shadow, not a crack" }), ctxP))
    expect(rejected.status).toBe(201)
    expect(rejected.body.item.reviewHistory.map((r: { revision: number }) => r.revision)).toEqual([1, 2])
    expect(mem.rows.reviews[0].disposition).toBe("EDITED") // earlier decision preserved

    const fb = await read(await feedbackRoute.GET(req(undefined, "GET"), ctx({ id: "deal-1", assessmentId })))
    expect(fb.body.feedback).toHaveLength(2)
    expect(fb.body.feedback[0]).toMatchObject({
      kind: "REVIEW",
      modelVersion: "fixture-frame-analysis-v1",
      original: { status: before.status, observation: before.observation },
      humanCorrection: { status: "SPECIALIST_REVIEW", observation: "Structural crack; surveyor needed." },
      reviewerId: "operator-1",
      actualOutcome: null,
    })
    expect(fb.body.feedback[1]).toMatchObject({ disposition: "REJECTED", humanCorrection: null })
  })

  it("rejects stale revisions and invalid review input without writing", async () => {
    const { assessmentId, detail } = await seedAnalysed()
    const c = ctx({ id: "deal-1", assessmentId, proposalId: detail.body.proposals[0].proposal.id })
    expect((await reviewRoute.POST(req({ expectedRevision: 1, disposition: "ACCEPTED" }), c)).status).toBe(409)
    for (const bad of [
      { expectedRevision: 0, disposition: "REJECTED" },
      { expectedRevision: 0, disposition: "EDITED", status: "OBSERVED" },
      { expectedRevision: 0, disposition: "EDITED", status: "PASS", observation: "x" },
      { expectedRevision: 0, disposition: "APPROVED" },
      { expectedRevision: -1, disposition: "ACCEPTED" },
      { expectedRevision: 0, disposition: "ACCEPTED", reviewerId: "attacker" },
      { expectedRevision: 0, disposition: "ACCEPTED", reviewedAt: "2020-01-01" },
      { expectedRevision: 0, disposition: "ACCEPTED", status: "OBSERVED" },
    ]) {
      expect((await reviewRoute.POST(req(bad), c)).status).toBe(400)
    }
    expect(mem.rows.reviews).toHaveLength(0)
    expect(mem.rows.feedback).toHaveLength(0)
  })

  it("404s an unknown proposal", async () => {
    const { assessmentId } = await seedAnalysed()
    const r = await reviewRoute.POST(req({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: "deal-1", assessmentId, proposalId: "ghost" }))
    expect(r.status).toBe(404)
  })

  it("keeps findings unverified and checks unassessed until a human accepts or edits", async () => {
    const { assessmentId, detail } = await seedAnalysed()
    const items = detail.body.proposals
    await reviewRoute.POST(req({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: "deal-1", assessmentId, proposalId: items[0].proposal.id }))
    await reviewRoute.POST(req({ expectedRevision: 0, disposition: "REJECTED", reason: "no" }), ctx({ id: "deal-1", assessmentId, proposalId: items[1].proposal.id }))
    const after = await read(await detailRoute.GET(req(undefined, "GET"), ctx({ id: "deal-1", assessmentId })))
    expect(after.body.summary).toMatchObject({ accepted: 1, rejected: 1, awaitingReview: 1, checksWithoutReviewedFinding: 57 })
    expect(after.body.proposals.every((p: { proposal: { verification: string } }) => p.proposal.verification === "UNVERIFIED")).toBe(true)
  })

  it("makes stored rows append-only in the repository contract", async () => {
    await seedAnalysed()
    expect(() => {
      ;(mem.rows.proposals[0] as { observation: string }).observation = "tampered"
    }).toThrow(TypeError)
    expect(() => {
      ;(mem.rows.evidence[0] as { room?: string }).room = "tampered"
    }).toThrow(TypeError)
  })
})

describe("safe error handling", () => {
  it("returns a trace id and no connection details on repository failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined)
    h.repo = {
      listAssessments: async () => {
        throw new Error("connect failed DATABASE_URL=postgres://user:pw@db.internal/prod")
      },
    }
    const { status, body } = await read(await listRoute.GET(req(undefined, "GET"), ctx({ id: "deal-1" })))
    expect(status).toBe(500)
    expect(body.error).toBe("VIEWING_ASSESSMENT_FAILED")
    expect(typeof body.traceId).toBe("string")
    expect(JSON.stringify(body)).not.toMatch(/postgres|pw@|DATABASE_URL|internal/)
  })
})

describe("no financial-engine or Investor Shield coupling", () => {
  const deal = { purchasePrice: 150000, gdv: 250000, refurbCost: 30000, stampDuty: 4500, legalCosts: 2500, saleCosts: 5000, bridgeTermMonths: 6 }
  const shield = { dealId: "deal-1", checks: buildDefaultInvestorShieldChecks("deal-1"), evidenceItems: [], riskFlags: [], manualOverrides: [] }

  it("leaves finance and Investor Shield outputs identical after a full create/evidence/analyse/review flow", async () => {
    const dealBefore = JSON.stringify(analyzeDealWithRefurb(deal))
    const shieldBefore = JSON.stringify(evaluateInvestorShield(shield))
    const { assessmentId, detail } = await seedAnalysed()
    for (const item of detail.body.proposals) {
      await reviewRoute.POST(req({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: "deal-1", assessmentId, proposalId: item.proposal.id }))
    }
    expect(JSON.stringify(analyzeDealWithRefurb(deal))).toBe(dealBefore)
    expect(JSON.stringify(evaluateInvestorShield(shield))).toBe(shieldBefore)
    expect(h.getDeal.mock.calls.every(([id]) => typeof id === "string")).toBe(true)
  })

  it("never imports the finance engine, Investor Shield, or saved-deal writers", () => {
    const root = path.resolve(__dirname, "..")
    // Every source file of the feature, found by walking the directories (so new files are covered automatically).
    const walk = (dir: string): string[] =>
      readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? walk(path.join(dir, e.name)) : /.(ts|tsx)$/.test(e.name) ? [path.join(dir, e.name)] : []
      )
    const files = [
      ...walk("lib/viewing-assessment"),
      ...walk("lib/auth"),
      ...walk("components/viewing-assessment"),
      ...walk("app/api/saved-deals/[id]/viewing-assessments"),
      ...walk("app/saved-deals/[id]/viewing"),
    ]
    expect(files.length).toBeGreaterThan(25)
    for (const file of files) {
      const imports = readFileSync(path.join(root, file), "utf8").match(/from\s+"[^"]+"/g) ?? []
      for (const spec of imports) {
        expect(spec, file).not.toMatch(/calculations|lib\/engine|investor-shield|evidence-lite|deal-offers|deal-tasks|createSavedDeal/)
      }
    }
  })
})

describe("state-changing request hardening", () => {
  const withHeaders = (body: unknown, headers: Record<string, string>) =>
    new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    })

  it("rejects cross-origin and opaque-origin POSTs on every write route without writing", async () => {
    const { assessmentId, detail } = await seedAnalysed()
    const rowsBefore = JSON.stringify(mem.rows)
    const ids = { id: "deal-1", assessmentId, proposalId: detail.body.proposals[0].proposal.id }
    for (const origin of ["http://evil.example", "null", "not a url"]) {
      const h = { origin, host: "localhost" }
      const results = await Promise.all([
        listRoute.POST(withHeaders({ idempotencyKey: "create-key-0009" }, h), ctx(ids)),
        evidenceRoute.POST(withHeaders(evidenceBody({ clip: { ...clip, contentSha256: "c".repeat(64) } }), h), ctx(ids)),
        runsRoute.POST(withHeaders({ idempotencyKey: "run-key-00009" }, h), ctx(ids)),
        reviewRoute.POST(withHeaders({ expectedRevision: 0, disposition: "ACCEPTED" }, h), ctx(ids)),
      ])
      for (const res of results) {
        const { status, body } = await read(res)
        expect([status, body.error]).toEqual([403, "CROSS_ORIGIN_REJECTED"])
      }
    }
    expect(JSON.stringify(mem.rows)).toBe(rowsBefore)
  })

  it("allows same-origin and Origin-less (non-browser) POSTs", async () => {
    const same = await listRoute.POST(withHeaders({ idempotencyKey: "create-key-0001" }, { origin: "http://localhost", host: "localhost" }), ctx({ id: "deal-1" }))
    expect(same.status).toBe(201)
    const none = await listRoute.POST(withHeaders({ idempotencyKey: "create-key-0002" }, {}), ctx({ id: "deal-1" }))
    expect(none.status).toBe(201)
  })

  it("rejects an oversized declared content-length before reading the body", async () => {
    const res = await listRoute.POST(withHeaders({ idempotencyKey: "create-key-0001" }, { "content-length": "999999" }), ctx({ id: "deal-1" }))
    expect(res.status).toBe(413)
    expect(mem.rows.assessments).toHaveLength(0)
  })
})

describe("abandoned analysis run recovery", () => {
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

  async function abandoned() {
    const assessmentId = await createAssessment()
    await evidenceRoute.POST(req(evidenceBody()), ctx({ id: "deal-1", assessmentId }))
    // A worker that started and then died: RUNNING, never completed.
    await mem.repo.startRun("deal-1", assessmentId, { idempotencyKey: "run-key-00001", modelVersion: "mock-video-analysis-v1", createdBy: "operator-1" })
    return assessmentId
  }

  it("answers 409 ANALYSIS_IN_PROGRESS while the lease is live", async () => {
    const assessmentId = await abandoned()
    const r = await read(await runsRoute.POST(req({ idempotencyKey: "run-key-00001" }), ctx({ id: "deal-1", assessmentId })))
    expect([r.status, r.body.error]).toEqual([409, "ANALYSIS_IN_PROGRESS"])
    expect(mem.rows.proposals).toHaveLength(0)
  })

  it("recovers the run once the lease expires, with one set of proposals", async () => {
    const assessmentId = await abandoned()
    await sleep(1100)
    const out = await runMockAnalysis(mem.repo, { dealId: "deal-1", assessmentId, idempotencyKey: "run-key-00001", actor: "operator-1", leaseSeconds: 1 })
    expect(out).toMatchObject({ status: "ok", replayed: false, run: { status: "READY_FOR_REVIEW", attemptCount: 2, proposalsCount: 3 } })
    expect(mem.rows.proposals).toHaveLength(3)
  })

  it("discards a zombie that finishes after its run was reclaimed (no duplicate proposals)", async () => {
    const assessmentId = await createAssessment()
    await evidenceRoute.POST(req(evidenceBody()), ctx({ id: "deal-1", assessmentId }))
    let release!: () => void
    const gate = new Promise<void>((r) => (release = r))
    const { mockVideoAnalysisService } = await import("@/lib/viewing-assessment/mock-video-analysis-service")
    const slow: VideoAnalysisService = {
      modelVersion: "slow-v1",
      async analyse(input) {
        await gate
        return mockVideoAnalysisService.analyse(input)
      },
    }
    const args = { dealId: "deal-1", assessmentId, idempotencyKey: "run-key-00001", actor: "operator-1" }
    const zombie = runMockAnalysis(mem.repo, args, slow) // attempt 1, stalls inside analyse()
    await sleep(1100)
    const winner = await runMockAnalysis(mem.repo, { ...args, leaseSeconds: 1 }) // reclaims as attempt 2, completes
    expect(winner).toMatchObject({ status: "ok", run: { attemptCount: 2, status: "READY_FOR_REVIEW" } })
    release()
    expect(await zombie).toEqual({ status: "lease_lost" })
    expect(mem.rows.proposals).toHaveLength(3)
  })
})

describe("per-assessment growth limits", () => {
  const distinct = (n: number) => ({ ...clip, filename: `c${n}.mp4`, contentSha256: n.toString(16).padStart(64, "0") })

  it("refuses a sixth clip", async () => {
    const assessmentId = await createAssessment()
    for (let n = 1; n <= 5; n++) {
      const ok = await evidenceRoute.POST(req({ clip: distinct(n), frames: [{ timestampSeconds: 1 }] }), ctx({ id: "deal-1", assessmentId }))
      expect(ok.status).toBe(201)
    }
    const sixth = await read(await evidenceRoute.POST(req({ clip: distinct(6), frames: [{ timestampSeconds: 1 }] }), ctx({ id: "deal-1", assessmentId })))
    expect([sixth.status, sixth.body.error]).toEqual([422, "TOO_MANY_CLIPS"])
    expect(mem.rows.assets).toHaveLength(5)
  })

  it("refuses frames beyond the per-assessment total, however they are split across requests", async () => {
    const assessmentId = await createAssessment()
    const frames = (n: number) => Array.from({ length: n }, (_, i) => ({ timestampSeconds: i % 50 }))
    expect((await evidenceRoute.POST(req({ clip: distinct(1), frames: frames(100) }), ctx({ id: "deal-1", assessmentId }))).status).toBe(201)
    const over = await read(await evidenceRoute.POST(req({ clip: distinct(2), frames: frames(21) }), ctx({ id: "deal-1", assessmentId })))
    expect([over.status, over.body.error]).toEqual([422, "TOO_MANY_FRAMES"])
    expect((await evidenceRoute.POST(req({ clip: distinct(3), frames: frames(20) }), ctx({ id: "deal-1", assessmentId }))).status).toBe(201) // exactly at the limit is allowed
    expect(mem.rows.evidence).toHaveLength(120)
  })
})
