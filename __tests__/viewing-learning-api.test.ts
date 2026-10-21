import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { tinyJpeg } from "./fixtures/jpeg-fixtures"

const h = vi.hoisted(() => ({ repo: null as unknown, access: vi.fn(), getDeal: vi.fn() }))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))
vi.mock("@/lib/operator-command/require-saved-deal-read-access", () => ({ requireSavedDealReadAccess: h.access }))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({ getSavedDealById: h.getDeal }))

import * as listRoute from "@/app/api/saved-deals/[id]/viewing-assessments/route"
import * as evidenceRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route"
import * as imageRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/route"
import * as runsRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs/route"
import * as reviewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route"
import * as outcomeRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/outcome/route"
import * as exportRoute from "@/app/api/saved-deals/[id]/viewing-assessments/evaluation-export/route"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { __setBlobStoreForTests } from "@/lib/viewing-assessment/storage/get-blob-store"
import { createLocalFsBlobStore } from "@/lib/viewing-assessment/storage/local-fs-blob-store"

const OPERATOR = { kind: "internal_operator", subject: "operator-1" }
const ctx = (ids: Record<string, string>) => ({ params: Promise.resolve(ids) })
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) })
const get = (url = "http://localhost/x") => new Request(url, { method: "GET" })
const read = async (res: Response) => ({ status: res.status, body: await res.json() })

let mem: ReturnType<typeof createInMemoryViewingRepository>
let root: string

beforeEach(() => {
  mem = createInMemoryViewingRepository()
  h.repo = mem.repo
  h.access.mockReset().mockResolvedValue({ allowed: true, principal: OPERATOR })
  h.getDeal.mockReset().mockImplementation(async (id: string) => (["deal-1", "deal-2"].includes(id) ? { id } : null))
  root = mkdtempSync(path.join(tmpdir(), "brik-learning-"))
  __setBlobStoreForTests(createLocalFsBlobStore(root))
})
afterEach(() => {
  __setBlobStoreForTests(undefined)
  rmSync(root, { recursive: true, force: true })
})

/** An assessment with 3 frames (the first with a stored image) analysed by the fixture provider. */
async function analysed() {
  const created = await read(await listRoute.POST(post({ idempotencyKey: "create-key-0001" }), ctx({ id: "deal-1" })))
  const assessmentId = created.body.assessment.id as string
  const ev = await read(await evidenceRoute.POST(post({ clip: { filename: "walk.mp4", mimeType: "video/mp4", sizeBytes: 5000, durationSeconds: 60, contentSha256: null }, frames: [{ timestampSeconds: 4, room: "Front" }, { timestampSeconds: 12, room: "Kitchen" }, { timestampSeconds: 30 }] }), ctx({ id: "deal-1", assessmentId })))
  const evidenceIds = ev.body.evidence.map((e: { id: string }) => e.id) as string[]
  await imageRoute.PUT(new Request("http://localhost/x", { method: "PUT", headers: { "content-type": "image/jpeg" }, body: tinyJpeg("a") as unknown as BodyInit }), ctx({ id: "deal-1", assessmentId, evidenceId: evidenceIds[0] }))
  await runsRoute.POST(post({ idempotencyKey: "run-key-00001" }), ctx({ id: "deal-1", assessmentId }))
  const proposalIds = mem.rows.proposals.map((p) => p.id)
  return { assessmentId, evidenceIds, proposalIds }
}

const outcomeBody = (over: Record<string, unknown> = {}) => ({ result: "CONFIRMED", source: "SURVEY", note: "Surveyor confirmed cracking to the front elevation.", ...over })
const record = (s: { assessmentId: string; proposalIds: string[] }, body: unknown, i = 0, dealId = "deal-1") =>
  outcomeRoute.POST(post(body), ctx({ id: dealId, assessmentId: s.assessmentId, proposalId: s.proposalIds[i] }))

describe("recording actual outcomes", () => {
  it("appends an outcome that snapshots the original prediction, with the recorder taken from the verified identity", async () => {
    const s = await analysed()
    const res = await read(await record(s, outcomeBody({ observedStatus: "SPECIALIST_REVIEW" })))
    expect(res.status).toBe(201)
    expect(res.body.outcome).toMatchObject({
      kind: "ACTUAL_OUTCOME",
      proposalId: s.proposalIds[0],
      modelVersion: "fixture-frame-analysis-v1",
      original: { status: "CONCERN", observation: expect.any(String), confidence: "low" },
      disposition: null, // not reviewed yet: the snapshot says so honestly
      humanCorrection: null,
      reviewerId: "operator-1",
      actualOutcome: { result: "CONFIRMED", source: "SURVEY", observedStatus: "SPECIALIST_REVIEW", note: expect.stringContaining("Surveyor") },
    })
  })

  it("snapshots the human decision and correction in force at that moment, and later reviews never rewrite it", async () => {
    const s = await analysed()
    await reviewRoute.POST(post({ expectedRevision: 0, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Possible structural movement." }), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: s.proposalIds[0] }))
    const first = await read(await record(s, outcomeBody({ result: "PARTIALLY_CONFIRMED" })))
    expect(first.body.outcome).toMatchObject({ disposition: "EDITED", humanCorrection: { status: "SPECIALIST_REVIEW", observation: "Possible structural movement." } })
    await reviewRoute.POST(post({ expectedRevision: 1, disposition: "REJECTED", reason: "changed my mind" }), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: s.proposalIds[0] }))
    const second = await read(await record(s, outcomeBody({ result: "NOT_CONFIRMED", note: "Works completed: no defect found." })))
    expect(second.body.outcome).toMatchObject({ disposition: "REJECTED", humanCorrection: null })
    const stored = mem.rows.feedback.filter((f) => f.kind === "ACTUAL_OUTCOME")
    expect(stored).toHaveLength(2) // append-only: two records, the first untouched
    expect(stored[0]).toMatchObject({ disposition: "EDITED", actualOutcome: { result: "PARTIALLY_CONFIRMED" } })
  })

  it("changes nothing else: not the proposal, the reviews, any check state, or the finance and Investor Shield outputs", async () => {
    const s = await analysed()
    const inputs = { purchasePrice: 150000, gdv: 250000, refurbCost: 30000, stampDuty: 4500, legalCosts: 2500, saleCosts: 5000, bridgeTermMonths: 6 }
    const shield = { dealId: "d", checks: buildDefaultInvestorShieldChecks("d"), evidenceItems: [], riskFlags: [], manualOverrides: [] }
    const before = { proposals: JSON.stringify(mem.rows.proposals), reviews: JSON.stringify(mem.rows.reviews), finance: JSON.stringify(analyzeDealWithRefurb(inputs)), shield: JSON.stringify(evaluateInvestorShield(shield)) }
    await record(s, outcomeBody())
    await record(s, outcomeBody({ result: "NOT_CONFIRMED", note: "later finding" }), 1)
    expect(JSON.stringify(mem.rows.proposals)).toBe(before.proposals)
    expect(JSON.stringify(mem.rows.reviews)).toBe(before.reviews)
    expect(JSON.stringify(analyzeDealWithRefurb(inputs))).toBe(before.finance)
    expect(JSON.stringify(evaluateInvestorShield(shield))).toBe(before.shield)
  })

  it("rejects client-supplied identity, ids, time and financial fields, and invalid values, writing nothing", async () => {
    const s = await analysed()
    const bad: Record<string, unknown>[] = [
      outcomeBody({ recordedBy: "someone" }),
      outcomeBody({ reviewerId: "operator-9" }),
      outcomeBody({ proposalId: "p" }),
      outcomeBody({ dealId: "deal-2" }),
      outcomeBody({ recordedAt: "2020-01-01T00:00:00Z" }),
      outcomeBody({ refurbCost: 0 }),
      outcomeBody({ result: "GREAT" }),
      outcomeBody({ source: "A FRIEND" }),
      outcomeBody({ observedStatus: "PASS" }),
      outcomeBody({ note: "" }),
      outcomeBody({ note: "   " }),
      outcomeBody({ note: "x".repeat(1001) }),
      outcomeBody({ result: undefined }),
    ]
    for (const body of bad) expect((await record(s, body)).status, JSON.stringify(body).slice(0, 60)).toBe(400)
    expect(mem.rows.feedback.filter((f) => f.kind === "ACTUAL_OUTCOME")).toHaveLength(0)
  })

  it("fails closed: unauthenticated 401, non-member 404, cross-deal 404, unknown proposal 404, cross-origin 403", async () => {
    const s = await analysed()
    h.access.mockResolvedValue({ allowed: false, reason: "unauthenticated", status: 401, code: "AUTHENTICATION_REQUIRED" })
    expect((await record(s, outcomeBody())).status).toBe(401)
    h.access.mockResolvedValue({ allowed: false, reason: "unauthorized", status: 404, code: "SAVED_DEAL_NOT_FOUND" })
    expect((await record(s, outcomeBody())).status).toBe(404)
    h.access.mockResolvedValue({ allowed: true, principal: OPERATOR })
    expect((await record(s, outcomeBody(), 0, "deal-2")).status).toBe(404)
    const ghost = await outcomeRoute.POST(post(outcomeBody()), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: "no-such-proposal" }))
    expect(ghost.status).toBe(404)
    const csrf = await outcomeRoute.POST(post(outcomeBody(), { origin: "http://evil.example", host: "localhost" }), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: s.proposalIds[0] }))
    expect(csrf.status).toBe(403)
    expect(mem.rows.feedback.filter((f) => f.kind === "ACTUAL_OUTCOME")).toHaveLength(0)
  })
})

describe("evaluation dataset export", () => {
  const exportOf = async (query = "", dealId = "deal-1") => read(await exportRoute.GET(get(`http://localhost/x${query}`), ctx({ id: dealId })))

  it("excludes simulated predictions by default so test data cannot contaminate an evaluation, and reports how many", async () => {
    await analysed()
    const res = await exportOf()
    expect(res.status).toBe(200)
    expect(res.body.dataset).toMatchObject({ datasetVersion: "viewing-eval-dataset-v1", scope: { dealId: "deal-1", includeSimulated: false }, excludedSimulated: 3, records: [] })
  })

  it("exports each prediction with model version, prompt version, exact evidence references, review history and outcomes", async () => {
    const s = await analysed()
    await imageRoute.PUT(new Request("http://localhost/x", { method: "PUT", headers: { "content-type": "image/jpeg" }, body: tinyJpeg("b") as unknown as BodyInit }), ctx({ id: "deal-1", assessmentId: s.assessmentId, evidenceId: s.evidenceIds[1] }))
    await reviewRoute.POST(post({ expectedRevision: 0, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Needs a surveyor.", reason: "crack pattern" }), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: s.proposalIds[0] }))
    await record(s, outcomeBody({ result: "CONFIRMED", observedStatus: "SPECIALIST_REVIEW" }))
    const { body } = await exportOf("?includeSimulated=true")
    const rec = body.dataset.records.find((r: { recordId: string }) => r.recordId === s.proposalIds[0])
    expect(body.dataset.scope.includeSimulated).toBe(true)
    expect(rec).toMatchObject({
      assessmentId: s.assessmentId,
      checkId: "C08",
      simulated: true,
      run: { provider: "fixture", modelVersion: "fixture-frame-analysis-v1", promptVersion: "fixture-prompt-v1" },
      prediction: { status: "CONCERN", confidence: "low" },
      humanReview: { label: "HUMAN_CORRECTED", revisions: [{ revision: 1, disposition: "EDITED", status: "SPECIALIST_REVIEW", observation: "Needs a surveyor.", reason: "crack pattern" }] },
      outcomes: [{ result: "CONFIRMED", source: "SURVEY", observedStatus: "SPECIALIST_REVIEW" }],
      outcomeLabel: "TRUE_POSITIVE",
      usage: { costMicros: 0, costBasis: "simulated_free" },
    })
    // exact references: real recorded time and room, and the checksum of the stored image where there is one
    expect(rec.evidence.every((e: { timestampSeconds: number | null }) => typeof e.timestampSeconds === "number")).toBe(true)
    expect(rec.evidence).toEqual([expect.objectContaining({ timestampSeconds: 4, room: "Front", clipFilename: "walk.mp4", imageSha256: expect.stringMatching(/^[a-f0-9]{64}$/) })])
    expect(rec.evidence.every((e: { evidenceId: string }) => s.evidenceIds.includes(e.evidenceId))).toBe(true)
    expect(body.dataset.summary).toMatchObject({ records: 3, byProvider: { fixture: 3 } })
    expect(body.dataset.summary.byHumanLabel).toMatchObject({ HUMAN_CORRECTED: 1, UNREVIEWED: 2 })
  })

  it("keeps the human decision and the actual outcome as two separate labels, never merged", async () => {
    const s = await analysed()
    await reviewRoute.POST(post({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: s.proposalIds[0] }))
    await record(s, outcomeBody({ result: "NOT_CONFIRMED", note: "No defect found on inspection." }))
    const rec = (await exportOf("?includeSimulated=true")).body.dataset.records.find((r: { recordId: string }) => r.recordId === s.proposalIds[0])
    expect([rec.humanReview.label, rec.outcomeLabel]).toEqual(["HUMAN_AGREES", "FALSE_POSITIVE"]) // the human agreed; reality disagreed
  })

  it("includes live-provider predictions by default, with provider-reported usage and the prompt version that produced them", async () => {
    const s = await analysed()
    const run = (await mem.repo.startRun("deal-1", s.assessmentId, { idempotencyKey: "live-run-0001", modelVersion: "claude-opus-5-5", createdBy: "op", provider: "claude" }))!.run
    await mem.repo.completeRun(run.id, {
      attempt: 1, status: "READY_FOR_REVIEW", rejectedCount: 0,
      proposals: [{ id: `${run.id}:P1`, assessmentId: s.assessmentId, checkId: "C20", status: "CONCERN", observation: "Live finding.", evidenceIds: [s.evidenceIds[2]], confidence: "medium", modelVersion: "claude-opus-5-5", verification: "UNVERIFIED", disposition: "PENDING" }],
      usage: { provider: "claude", modelVersion: "claude-opus-5-5", promptVersion: "viewing-prompt-v1", frameCount: 3, inputTokens: 15_600, outputTokens: 4_000, cacheReadTokens: 0, cacheWriteTokens: 0, costMicros: 142_400, simulated: false, outcome: "OK" },
    })
    const { body } = await exportOf()
    expect(body.dataset.records).toHaveLength(1)
    expect(body.dataset.records[0]).toMatchObject({
      simulated: false,
      run: { provider: "claude", modelVersion: "claude-opus-5-5", promptVersion: "viewing-prompt-v1" },
      usage: { inputTokens: 15_600, outputTokens: 4_000, costMicros: 142_400, costBasis: "provider_reported_usage" },
    })
    expect(body.dataset.excludedSimulated).toBe(3)
  })

  it("contains no reviewer identities, storage keys, paths or image bytes", async () => {
    const s = await analysed()
    await reviewRoute.POST(post({ expectedRevision: 0, disposition: "ACCEPTED" }), ctx({ id: "deal-1", assessmentId: s.assessmentId, proposalId: s.proposalIds[0] }))
    await record(s, outcomeBody())
    const text = JSON.stringify((await exportOf("?includeSimulated=true")).body)
    expect(text).not.toMatch(/operator-1|reviewerId|recordedBy|createdBy|blob_|storage_?key/)
  })

  it("is read-only and scoped to the requested deal", async () => {
    const s = await analysed()
    const before = JSON.stringify([mem.rows.proposals, mem.rows.reviews, mem.rows.feedback, mem.rows.usage])
    await exportOf("?includeSimulated=true")
    expect(JSON.stringify([mem.rows.proposals, mem.rows.reviews, mem.rows.feedback, mem.rows.usage])).toBe(before)
    const other = await exportOf("?includeSimulated=true", "deal-2")
    expect(other.body.dataset.records).toEqual([])
    expect(s.assessmentId).toBeTruthy()
  })

  it("fails closed without authentication, and 404s a deal the caller cannot see", async () => {
    await analysed()
    h.access.mockResolvedValue({ allowed: false, reason: "unauthenticated", status: 401, code: "AUTHENTICATION_REQUIRED" })
    expect((await exportOf()).status).toBe(401)
    h.access.mockResolvedValue({ allowed: true, principal: OPERATOR })
    expect((await exportOf("", "no-such-deal")).status).toBe(404)
  })
})
