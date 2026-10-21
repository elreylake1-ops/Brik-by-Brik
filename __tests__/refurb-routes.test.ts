import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getSavedDealByIdMock } = vi.hoisted(() => ({ getSavedDealByIdMock: vi.fn() }))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({ getSavedDealById: getSavedDealByIdMock }))

import * as planRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/route"
import * as previewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/preview/route"
import * as packRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/builder-pack/route"
import * as passportRoute from "@/app/api/saved-deals/[id]/deal-passport/route"
import { __setRefurbDepsForTests } from "@/lib/refurb-integration/deps"
import type { DocumentDeps } from "@/lib/refurb-integration/documents-service"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { installTestOperator, operatorHeaders, removeTestOperator } from "./fixtures/operator-session"
import { ACCEPT, ASSUMPTIONS, BASICS, makeDeal, seedAssessment, type Seeded } from "./fixtures/refurb-seed"

// The new endpoints through the real handlers, the real access guard (test identity + operator membership) and real
// request validation. Data comes from the in-memory repositories honouring the production contracts.

const ctx = (ids: Record<string, string>) => ({ params: Promise.resolve(ids) })
const BASE = "http://localhost"

describe("refurbishment plan, builder pack and Deal Passport endpoints", () => {
  let seeded: Seeded
  let seededB: Seeded
  let deps: DocumentDeps
  let plans: ReturnType<typeof createInMemoryRefurbPlanRepository>
  let fingerprint: string

  beforeEach(async () => {
    installTestOperator()
    const { repo: viewing } = createInMemoryViewingRepository()
    plans = createInMemoryRefurbPlanRepository()
    const deals = new Map([["deal-a", makeDeal("deal-a")], ["deal-b", makeDeal("deal-b")]])
    getSavedDealByIdMock.mockImplementation(async (id: string) => deals.get(id) ?? null)
    seeded = await seedAssessment(viewing, "deal-a", [
      { checkId: "C01", status: "CONCERN", review: ACCEPT },
      { checkId: "C08", status: "CONCERN", review: ACCEPT },
      { checkId: "C39", status: "CONCERN" },
    ])
    seededB = await seedAssessment(viewing, "deal-b", [{ checkId: "C37", status: "CONCERN", review: ACCEPT }])
    deps = {
      viewing,
      plans,
      measurements: createInMemoryMeasurementRepository(),
      proposals: createInMemoryFinancialRepository(),
      getDeal: async (id) => deals.get(id) ?? null,
      loadPack: async (dealId) => ({ ...structuredClone(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE), meta: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta, savedDealId: dealId } }),
      now: () => new Date("2026-10-22T10:00:00.000Z"),
    }
    __setRefurbDepsForTests(deps)
    const first = await planRoute.GET(get(`/x`, operatorHeaders()), ctx({ id: "deal-a", assessmentId: seeded.assessmentId }))
    fingerprint = (await first.json()).proposal.fingerprint
  })
  afterEach(() => {
    __setRefurbDepsForTests(undefined)
    removeTestOperator()
    getSavedDealByIdMock.mockReset()
  })

  const get = (path: string, headers: Record<string, string> = {}) => new Request(`${BASE}${path}`, { method: "GET", headers })
  const post = (body: unknown, headers: Record<string, string> = operatorHeaders()) =>
    new Request(`${BASE}/x`, { method: "POST", headers: { "content-type": "application/json", host: "localhost", ...headers }, body: JSON.stringify(body) })
  const confirmBody = (over: Record<string, unknown> = {}) => ({ idempotencyKey: "route-key-0001", expectedFingerprint: fingerprint, accepted: [{ itemId: "roof" }, { itemId: "external-walls" }], propertyBasics: BASICS, financialAssumptions: ASSUMPTIONS, ...over })
  const A = () => ctx({ id: "deal-a", assessmentId: seeded.assessmentId })

  const protectedCalls: Array<[string, (h: Record<string, string>) => Promise<Response>]> = [
    ["GET refurb-plan", (h) => planRoute.GET(get("/x", h), A())],
    ["POST refurb-plan", (h) => planRoute.POST(post(confirmBody(), h), A())],
    ["POST preview", (h) => previewRoute.POST(post({}, h), A())],
    ["GET builder-pack", (h) => packRoute.GET(get("/x", h), A())],
    ["GET deal-passport", (h) => passportRoute.GET(get("/x", h), ctx({ id: "deal-a" }))],
  ]

  it.each(protectedCalls)("%s: anonymous -> 401, nothing written", async (_n, call) => {
    expect((await call({})).status).toBe(401)
    expect((await call({ authorization: "Bearer not-a-real-token", "x-user-id": "test-operator-1" })).status).toBe(401)
    expect(plans.rows).toHaveLength(0)
  })

  it.each(protectedCalls)("%s: a valid account that is not an operator -> 404", async (_n, call) => {
    removeTestOperator()
    installTestOperator({ members: ["someone-else"] })
    expect((await call(operatorHeaders())).status).toBe(404)
    expect(plans.rows).toHaveLength(0)
  })

  it.each(protectedCalls)("%s: an operator is served", async (_n, call) => {
    const status = (await call(operatorHeaders())).status
    expect([200, 201, 409]).toContain(status) // 409: builder pack before any plan exists
  })

  it("GET refurb-plan returns the proposal built from reviewed findings only, with exclusions", async () => {
    const res = await planRoute.GET(get("/x", operatorHeaders()), A())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.proposal.items.map((i: { itemId: string }) => i.itemId)).toEqual(["roof", "external-walls"])
    expect(body.proposal.excluded).toContainEqual(expect.objectContaining({ checkId: "C39", reason: "UNREVIEWED" }))
    expect(body.current).toBeNull()
  })

  it("preview computes and persists nothing", async () => {
    const res = await previewRoute.POST(post({ propertyBasics: BASICS, financialAssumptions: ASSUMPTIONS }), A())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ preview: true, selection: "ALL_PROPOSED_DEFAULT" })
    expect(body.computation.estimate.status).toBe("COMPUTED")
    expect(body.computation.financialImpact.savedDealUnchanged).toBe(true)
    expect(plans.rows).toHaveLength(0)
  })

  it("confirming: 201, recorded under the VERIFIED identity (never the body), 200 on replay, 409 on key reuse", async () => {
    const make = (over = {}) => planRoute.POST(post(confirmBody(over)), A())
    const first = await make()
    expect(first.status).toBe(201)
    const body = await first.json()
    expect(body.plan).toMatchObject({ version: 1, confirmedBy: "test-operator-1", assessmentId: seeded.assessmentId, dealId: "deal-a" })
    const replay = await make()
    expect([replay.status, (await replay.json()).replayed]).toEqual([200, true])
    expect((await make({ accepted: [{ itemId: "roof" }] })).status).toBe(409)
    expect(plans.rows).toHaveLength(1)
  })

  it("a body cannot supply a cost, a verdict, a reviewer, a governance value or any unknown field", async () => {
    for (const extra of [{ confirmedBy: "boss" }, { totalRefurbCost: 1 }, { governance_state: "GO" }, { computation: {} }, { verdict: "GO" }, { reviewerId: "x" }, { dealId: "deal-b" }]) {
      const res = await planRoute.POST(post(confirmBody(extra)), A())
      expect([Object.keys(extra)[0], res.status]).toEqual([Object.keys(extra)[0], 400])
    }
    expect(plans.rows).toHaveLength(0)
  })

  it.each([
    ["no accepted items", { accepted: [] }],
    ["unknown item", { accepted: [{ itemId: "kitchen" }] }],
    ["bad key", { idempotencyKey: "x" }],
    ["bad fingerprint", { expectedFingerprint: "nope" }],
    ["missing property basics", { propertyBasics: undefined }],
    ["fractional bedrooms", { propertyBasics: { ...BASICS, bedrooms: 2.5 } }],
    ["negative stamp duty", { financialAssumptions: { ...ASSUMPTIONS, stampDuty: -1 } }],
    ["absurd bridge term", { financialAssumptions: { ...ASSUMPTIONS, bridgeTermMonths: 5000 } }],
    ["level not allowed", { accepted: [{ itemId: "roof", level: "gold" }] }],
    ["duplicate item", { accepted: [{ itemId: "roof" }, { itemId: "roof" }] }],
  ])("rejects %s with 400 and writes nothing", async (_n, over) => {
    const res = await planRoute.POST(post(confirmBody(over)), A())
    expect(res.status).toBe(400)
    expect(plans.rows).toHaveLength(0)
  })

  it("a stale fingerprint is a 409 that tells the client the current one", async () => {
    const res = await planRoute.POST(post(confirmBody({ expectedFingerprint: "f".repeat(64) })), A())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: "STALE_FINDINGS", currentFingerprint: fingerprint })
  })

  it("a cookie-authenticated confirmation from another origin is refused (CSRF); a bearer client is not affected", async () => {
    const { createInMemorySessionStore } = await import("./fixtures/in-memory-session-store")
    const { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } = await import("@/lib/auth/operator-auth")
    const { createTestIdentityProvider } = await import("./fixtures/auth-fixtures")
    const { startSession, SECURE_SESSION_COOKIE } = await import("@/lib/auth/session")
    const sessions = createInMemorySessionStore()
    __setOperatorAuthDepsForTests({ provider: createTestIdentityProvider({}), membership: createAllowlistMembershipStore("op-1")!, sessions })
    const { id } = await startSession(sessions, "op-1", new Date())
    const cookie = `${SECURE_SESSION_COOKIE}=${id}`
    const attempt = (origin?: string) =>
      planRoute.POST(new Request("https://app.example.test/x", { method: "POST", headers: { "content-type": "application/json", host: "app.example.test", cookie, ...(origin ? { origin } : {}) }, body: JSON.stringify(confirmBody()) }), A())
    expect((await attempt("https://evil.example")).status).toBe(403)
    expect((await attempt()).status).toBe(403)
    expect(plans.rows).toHaveLength(0)
    expect((await attempt("https://app.example.test")).status).toBe(201)
  })

  it("cross-deal: deal B's id with deal A's assessment is a 404 on every endpoint, and deal A's plan is invisible", async () => {
    await planRoute.POST(post(confirmBody()), A())
    const wrong = ctx({ id: "deal-b", assessmentId: seeded.assessmentId })
    expect((await planRoute.GET(get("/x", operatorHeaders()), wrong)).status).toBe(404)
    expect((await planRoute.POST(post(confirmBody({ idempotencyKey: "cross-key-0001" })), wrong)).status).toBe(404)
    expect((await previewRoute.POST(post({}), wrong)).status).toBe(404)
    expect((await packRoute.GET(get("/x", operatorHeaders()), wrong)).status).toBe(404)
    const passport = await passportRoute.GET(get(`/x?assessmentId=${seeded.assessmentId}`, operatorHeaders()), ctx({ id: "deal-b" }))
    expect(passport.status).toBe(404)
    // deal B's own assessment has its own, empty, plan state
    const own = await packRoute.GET(get("/x", operatorHeaders()), ctx({ id: "deal-b", assessmentId: seededB.assessmentId }))
    expect([own.status, (await own.json()).error]).toEqual([409, "NO_CONFIRMED_PLAN"])
    // unknown deal
    expect((await planRoute.GET(get("/x", operatorHeaders()), ctx({ id: "no-such-deal", assessmentId: seeded.assessmentId }))).status).toBe(404)
  })

  it("builder pack and passport are served as DRAFT after a plan is confirmed", async () => {
    await planRoute.POST(post(confirmBody()), A())
    const pack = await (await packRoute.GET(get("/x", operatorHeaders()), A())).json()
    expect(pack.pack).toMatchObject({ status: "DRAFT", approval: "NOT_APPROVED", confidentiality: { internalEstimateIncluded: false } })
    const passport = await (await passportRoute.GET(get(`/x?assessmentId=${seeded.assessmentId}`, operatorHeaders()), ctx({ id: "deal-a" }))).json()
    expect(passport.passport).toMatchObject({ kind: "DEAL_PASSPORT", status: "DRAFT", approval: "NOT_APPROVED" })
    expect(passport.passport.refurbishment.status).toBe("CONFIRMED")
  })

  it("rejects a malformed assessmentId on the passport", async () => {
    const res = await passportRoute.GET(get("/x?assessmentId=../../etc", operatorHeaders()), ctx({ id: "deal-a" }))
    expect(res.status).toBe(400)
  })

  it("the test seam refuses to run outside the test environment", () => {
    vi.stubEnv("NODE_ENV", "production")
    expect(() => __setRefurbDepsForTests(deps)).toThrow(/test-only/)
    vi.unstubAllEnvs()
  })
})
