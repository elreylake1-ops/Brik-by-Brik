import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { getSavedDealByIdMock } = vi.hoisted(() => ({ getSavedDealByIdMock: vi.fn() }))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({ getSavedDealById: getSavedDealByIdMock }))

import * as planRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/route"
import * as measurementsRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/measurements/route"
import * as proposalRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/route"
import * as decisionRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/[proposalId]/decision/route"
import * as passportRoute from "@/app/api/saved-deals/[id]/deal-passport/route"
import { __setRefurbDepsForTests } from "@/lib/refurb-integration/deps"
import type { DocumentDeps } from "@/lib/refurb-integration/documents-service"
import { PDF_EVIDENCE_PACK_COMPLETE_FIXTURE } from "./fixtures/pdf-evidence-pack-fixtures"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { installTestOperator, OPERATOR_SUBJECT, operatorHeaders, removeTestOperator } from "./fixtures/operator-session"
import { ACCEPT, ASSUMPTIONS, makeDeal, seedAssessment, type Seeded } from "./fixtures/refurb-seed"

// Measurement, financial-proposal and decision endpoints through the real handlers, the real access guard and real validation.

const ctx = (ids: Record<string, string>) => ({ params: Promise.resolve(ids) })
const entry = (key: string, value: number | string | null, over: Record<string, unknown> = {}) =>
  value === null ? { key, value: null, basis: "UNKNOWN", source: null, confidence: null, note: "Not yet visited", ...over } : { key, value, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "", ...over }
const GOOD = () => [entry("bedrooms", 3), entry("bathrooms", 1), entry("floorAreaSqm", 85, { source: "FLOOR_PLAN" }), entry("kitchenSize", "medium", { basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "medium", note: "From the listing" })]

describe("measurement, financial-proposal and decision endpoints", () => {
  let seeded: Seeded
  let seededB: Seeded
  let plans: ReturnType<typeof createInMemoryRefurbPlanRepository>
  let measurements: ReturnType<typeof createInMemoryMeasurementRepository>
  let proposals: ReturnType<typeof createInMemoryFinancialRepository>
  let deals: Map<string, ReturnType<typeof makeDeal>>
  let fingerprint = ""

  const get = (headers: Record<string, string> = {}, path = "/x") => new Request(`http://localhost${path}`, { method: "GET", headers })
  const post = (body: unknown, headers: Record<string, string> = operatorHeaders()) =>
    new Request("http://localhost/x", { method: "POST", headers: { "content-type": "application/json", host: "localhost", ...headers }, body: JSON.stringify(body) })
  const A = () => ctx({ id: "deal-a", assessmentId: seeded.assessmentId })
  const measureBody = (over: Record<string, unknown> = {}) => ({ idempotencyKey: "measure-key-0001", basedOnVersion: 0, entries: GOOD(), ...over })

  beforeEach(async () => {
    installTestOperator()
    const { repo: viewing } = createInMemoryViewingRepository()
    plans = createInMemoryRefurbPlanRepository()
    measurements = createInMemoryMeasurementRepository()
    proposals = createInMemoryFinancialRepository()
    deals = new Map([["deal-a", makeDeal("deal-a")], ["deal-b", makeDeal("deal-b")]])
    getSavedDealByIdMock.mockImplementation(async (id: string) => deals.get(id) ?? null)
    seeded = await seedAssessment(viewing, "deal-a", [
      { checkId: "C01", status: "CONCERN", review: ACCEPT },
      { checkId: "C08", status: "CONCERN", review: ACCEPT },
    ])
    seededB = await seedAssessment(viewing, "deal-b", [{ checkId: "C37", status: "CONCERN", review: ACCEPT }])
    const deps: DocumentDeps = {
      viewing,
      plans,
      measurements,
      proposals,
      getDeal: async (id) => deals.get(id) ?? null,
      loadPack: async (dealId) => ({ ...structuredClone(PDF_EVIDENCE_PACK_COMPLETE_FIXTURE), meta: { ...PDF_EVIDENCE_PACK_COMPLETE_FIXTURE.meta, savedDealId: dealId } }),
      now: () => new Date("2026-10-23T10:00:00.000Z"),
    }
    __setRefurbDepsForTests(deps)
    fingerprint = (await (await planRoute.GET(get(operatorHeaders()), A())).json()).proposal.fingerprint
  })
  afterEach(() => {
    __setRefurbDepsForTests(undefined)
    removeTestOperator()
    getSavedDealByIdMock.mockReset()
  })

  const confirmScope = async (over: Record<string, unknown> = {}) => {
    const m = await (await measurementsRoute.GET(get(operatorHeaders()), A())).json()
    return planRoute.POST(post({ idempotencyKey: "plan-key-0001-aaaa", expectedFingerprint: fingerprint, accepted: [{ itemId: "roof" }, { itemId: "external-walls" }], measurementSetId: m.current?.id, financialAssumptions: ASSUMPTIONS, ...over }), A())
  }
  const readyPlan = async () => {
    expect((await measurementsRoute.POST(post(measureBody()), A())).status).toBe(201)
    const c = await confirmScope()
    expect(c.status).toBe(201)
    return (await c.json()).plan
  }
  const makeProposal = async (key = "prop-key-0001-aaaa") => (await (await proposalRoute.POST(post({ idempotencyKey: key }), A())).json()).proposal
  const decisionCtx = (id: string) => ctx({ id: "deal-a", assessmentId: seeded.assessmentId, proposalId: id })
  const decisionBody = (p: { contentHash: string }, over: Record<string, unknown> = {}) => ({ idempotencyKey: "decision-key-0001", decision: "CONFIRMED", proposalHash: p.contentHash, acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true }, ...over })

  const protectedCalls: Array<[string, (h: Record<string, string>) => Promise<Response>]> = [
    ["GET measurements", (h) => measurementsRoute.GET(get(h), A())],
    ["POST measurements", (h) => measurementsRoute.POST(post(measureBody(), h), A())],
    ["GET financial-proposal", (h) => proposalRoute.GET(get(h), A())],
    ["POST financial-proposal", (h) => proposalRoute.POST(post({ idempotencyKey: "prop-key-9999-zzzz" }, h), A())],
    ["POST decision", (h) => decisionRoute.POST(post({ idempotencyKey: "decision-key-0001", decision: "DECLINED", proposalHash: "a".repeat(64), acknowledge: {} }, h), decisionCtx("nope"))],
  ]
  it.each(protectedCalls)("%s: anonymous -> 401 and nothing is written", async (_n, call) => {
    expect((await call({})).status).toBe(401)
    expect((await call({ authorization: "Bearer forged", "x-user-id": OPERATOR_SUBJECT })).status).toBe(401)
    expect(measurements.rows).toHaveLength(0)
    expect(proposals.proposals).toHaveLength(0)
    expect(proposals.decisions).toHaveLength(0)
  })
  it.each(protectedCalls)("%s: a valid account that is not an operator -> 404", async (_n, call) => {
    removeTestOperator()
    installTestOperator({ members: ["someone-else"] })
    expect((await call(operatorHeaders())).status).toBe(404)
    expect(measurements.rows).toHaveLength(0)
  })

  describe("measurements", () => {
    it("record a first set under the VERIFIED identity, replay on repeat, and list the recordable measurements with which ones the engine uses", async () => {
      const res = await measurementsRoute.POST(post(measureBody()), A())
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body.measurementSet).toMatchObject({ version: 1, recordedBy: OPERATOR_SUBJECT, dealId: "deal-a", assessmentId: seeded.assessmentId })
      const replay = await measurementsRoute.POST(post(measureBody()), A())
      expect([replay.status, (await replay.json()).replayed]).toEqual([200, true])
      expect(measurements.rows).toHaveLength(1)

      const state = await (await measurementsRoute.GET(get(operatorHeaders()), A())).json()
      expect(state.current.version).toBe(1)
      expect(state.engineQuantities.basics).toEqual({ bedrooms: 3, bathrooms: 1, floorAreaSqm: 85, kitchenSize: "medium" })
      expect(state.spec.filter((s: { usedByEngine: boolean }) => s.usedByEngine).map((s: { key: string }) => s.key).sort()).toEqual(["bathrooms", "bedrooms", "floorAreaSqm", "kitchenSize"])
    })

    it("cannot carry video-derived values, frame references, identities or any unknown field", async () => {
      for (const bad of [
        measureBody({ entries: [entry("floorAreaSqm", 80, { basis: "OPERATOR_ESTIMATE", source: "VIDEO_FRAME", note: "from the clip" })] }),
        measureBody({ entries: [{ ...entry("floorAreaSqm", 80), frameIds: ["f1"] }] }),
        measureBody({ recordedBy: "boss" }),
        measureBody({ entries: [{ ...entry("floorAreaSqm", 80), reviewerId: "x" }] }),
      ]) expect((await measurementsRoute.POST(post(bad), A())).status).toBe(400)
      expect(measurements.rows).toHaveLength(0)
    })

    it.each([
      ["implausible", measureBody({ entries: [entry("floorAreaSqm", 900)] }), /outside the usual range/],
      ["impossible", measureBody({ entries: [entry("bedrooms", -2)] }), /outside the allowed range/],
      ["conflicting", measureBody({ entries: [entry("floorAreaSqm", 80), entry("floorAreaSqm", 95, { basis: "OPERATOR_ESTIMATE", source: "OTHER", note: "agent said" })] }), /conflicting values/],
      ["rooms larger than the property", measureBody({ entries: [entry("floorAreaSqm", 20), entry("room_length_m", 6, { room: "Lounge" }), entry("room_width_m", 5, { room: "Lounge" })] }), /add up to 30 sqm, more than the total floor area of 20 sqm/],
      ["a correction with no reason", measureBody({ basedOnVersion: 1 }), /changeNote is required/],
    ])("rejects %s measurements with 400 and says why", async (_n, body, pattern) => {
      const res = await measurementsRoute.POST(post(body), A())
      expect(res.status).toBe(400)
      expect(JSON.stringify(await res.json())).toMatch(pattern)
      expect(measurements.rows).toHaveLength(0)
    })

    it("accept an unusual value the operator confirmed, and record the warning", async () => {
      const res = await measurementsRoute.POST(post(measureBody({ entries: [entry("floorAreaSqm", 900, { acknowledgedImplausible: true }), entry("bedrooms", 3), entry("bathrooms", 1)] })), A())
      expect(res.status).toBe(201)
      expect((await res.json()).measurementSet.warnings.map((w: { code: string }) => w.code)).toContain("IMPLAUSIBLE_ACKNOWLEDGED")
    })

    it("a correction is based on the version it corrects (409 if someone else changed it), must say why, and keeps the old version", async () => {
      await measurementsRoute.POST(post(measureBody()), A())
      const stale = await measurementsRoute.POST(post(measureBody({ idempotencyKey: "measure-key-0002", basedOnVersion: 0 })), A())
      expect([stale.status, (await stale.json()).error]).toEqual([409, "STALE_MEASUREMENTS"])
      const fixed = await measurementsRoute.POST(post(measureBody({ idempotencyKey: "measure-key-0003", basedOnVersion: 1, changeNote: "Re-measured with a laser", entries: GOOD().map((e) => (e.key === "bedrooms" ? entry("bedrooms", 4) : e)) })), A())
      expect(fixed.status).toBe(201)
      const state = await (await measurementsRoute.GET(get(operatorHeaders()), A())).json()
      expect(state.history.map((h: { record: { version: number } }) => h.record.version)).toEqual([2, 1])
      expect(state.history[0].changesFromPrevious[0]).toMatchObject({ key: "bedrooms", change: "CHANGED" })
      expect(state.history[1].record.entries.find((e: { key: string }) => e.key === "bedrooms").value).toBe(3)
      const reused = await measurementsRoute.POST(post(measureBody({ idempotencyKey: "measure-key-0003", basedOnVersion: 1, changeNote: "Something else entirely" })), A())
      expect(reused.status).toBe(409)
    })

    it("another deal's id is a 404 for reading and writing", async () => {
      await measurementsRoute.POST(post(measureBody()), A())
      const wrong = ctx({ id: "deal-b", assessmentId: seeded.assessmentId })
      expect((await measurementsRoute.GET(get(operatorHeaders()), wrong)).status).toBe(404)
      expect((await measurementsRoute.POST(post(measureBody({ idempotencyKey: "measure-cross-0001" })), wrong)).status).toBe(404)
      expect(measurements.rows).toHaveLength(1)
    })
  })

  describe("scope from measurements", () => {
    it("is confirmed against a recorded set (version stored), and refuses an older set with 409", async () => {
      await measurementsRoute.POST(post(measureBody()), A())
      const v1 = (await (await measurementsRoute.GET(get(operatorHeaders()), A())).json()).current
      await measurementsRoute.POST(post(measureBody({ idempotencyKey: "measure-key-0002", basedOnVersion: 1, changeNote: "Added a bathroom", entries: GOOD().map((e) => (e.key === "bathrooms" ? entry("bathrooms", 2) : e)) })), A())
      const stale = await confirmScope({ measurementSetId: v1.id })
      expect([stale.status, (await stale.json()).error]).toEqual([409, "STALE_MEASUREMENTS"])
      const ok = await confirmScope({ idempotencyKey: "plan-key-0002-bbbb", measurementSetId: undefined })
      expect(ok.status).toBe(400) // neither propertyBasics nor measurementSetId
      const current = (await (await measurementsRoute.GET(get(operatorHeaders()), A())).json()).current
      const good = await confirmScope({ idempotencyKey: "plan-key-0003-cccc", measurementSetId: current.id })
      expect(good.status).toBe(201)
      expect((await good.json()).plan).toMatchObject({ measurementSetVersion: 2, propertyBasics: { bathrooms: 2 } })
    })

    it("cannot send both typed-in basics and a measurement set", async () => {
      await measurementsRoute.POST(post(measureBody()), A())
      const m = (await (await measurementsRoute.GET(get(operatorHeaders()), A())).json()).current
      const both = await confirmScope({ measurementSetId: m.id, propertyBasics: { bedrooms: 3, bathrooms: 1, kitchenSize: "medium" } })
      expect(both.status).toBe(400)
    })

    it("refuses when the recorded measurements cannot cost anything", async () => {
      await measurementsRoute.POST(post(measureBody({ entries: [entry("bedrooms", null), entry("bathrooms", 1)] })), A())
      const res = await confirmScope()
      expect(res.status).toBe(400)
      expect(JSON.stringify(await res.json())).toMatch(/BEDROOMS_UNKNOWN/)
    })
  })

  describe("financial-impact proposal", () => {
    it("needs a confirmed scope, then is created from it with figures that come only from the server", async () => {
      expect(await (await proposalRoute.POST(post({ idempotencyKey: "prop-key-0000-none" }), A())).json()).toMatchObject({ error: "NO_CONFIRMED_PLAN" })
      for (const extra of [{ proposed: { profit: 1e9 } }, { refurbCost: 1 }, { governance_state: "GO" }, { contentHash: "a".repeat(64) }]) {
        expect((await proposalRoute.POST(post({ idempotencyKey: "prop-key-0000-bad", ...extra }), A())).status).toBe(400)
      }
      await readyPlan()
      const res = await proposalRoute.POST(post({ idempotencyKey: "prop-key-0001-aaaa" }), A())
      expect(res.status).toBe(201)
      const { proposal } = await res.json()
      expect(proposal).toMatchObject({ version: 1, createdBy: OPERATOR_SUBJECT })
      expect(proposal.content).toMatchObject({ nonAuthoritative: true, authoritative: { purchasePrice: 100000, refurbCost: 25000 } })
      expect(proposal.content.proposed.refurbCost).toBeGreaterThan(0)
      const replay = await proposalRoute.POST(post({ idempotencyKey: "prop-key-0002-bbbb" }), A())
      expect([replay.status, (await replay.json()).replayed]).toEqual([200, true])
      expect(proposals.proposals).toHaveLength(1)
    })

    it("GET reports the latest proposal, its decision and whether it is out of date", async () => {
      await readyPlan()
      const p = await makeProposal()
      expect(await (await proposalRoute.GET(get(operatorHeaders()), A())).json()).toMatchObject({ status: "PROPOSED", outdated: false, latest: { id: p.id } })
      deals.set("deal-a", { ...deals.get("deal-a")!, refurb_cost: 40000 })
      expect(await (await proposalRoute.GET(get(operatorHeaders()), A())).json()).toMatchObject({ status: "OUTDATED", outdated: true })
    })
  })

  describe("operator decision", () => {
    it("confirming records the VERIFIED operator, never changes the Saved Deal, and says so", async () => {
      await readyPlan()
      const p = await makeProposal()
      const before = JSON.stringify(deals.get("deal-a"))
      const res = await decisionRoute.POST(post(decisionBody(p, { note: "Agreed" })), decisionCtx(p.id))
      expect(res.status).toBe(201)
      const body = await res.json()
      expect(body).toMatchObject({ success: true, replayed: false, savedDealChanged: false, decision: { decision: "CONFIRMED", actor: OPERATOR_SUBJECT, note: "Agreed" } })
      expect(JSON.stringify(deals.get("deal-a"))).toBe(before)
      expect(getSavedDealByIdMock.mock.calls.length).toBeGreaterThan(0) // read, only
    })

    it("a body cannot name the actor or supply any figure; unknown fields are refused", async () => {
      await readyPlan()
      const p = await makeProposal()
      for (const extra of [{ actor: "boss" }, { occurredAt: "2020-01-01T00:00:00Z" }, { baselineFingerprint: "a".repeat(64) }, { savedDealChanged: true }, { refurbCost: 5 }]) {
        expect([Object.keys(extra)[0], (await decisionRoute.POST(post(decisionBody(p, extra)), decisionCtx(p.id))).status]).toEqual([Object.keys(extra)[0], 400])
      }
      expect(proposals.decisions).toHaveLength(0)
    })

    it("needs the acknowledgements and the exact proposal hash", async () => {
      await readyPlan()
      const p = await makeProposal()
      const noAck = await decisionRoute.POST(post(decisionBody(p, { acknowledge: { notWriteBack: false, exclusions: true, unresolvedQuantities: true } })), decisionCtx(p.id))
      expect(noAck.status).toBe(400)
      expect(JSON.stringify(await noAck.json())).toMatch(/notWriteBack/)
      const wrongHash = await decisionRoute.POST(post(decisionBody(p, { proposalHash: "f".repeat(64) })), decisionCtx(p.id))
      expect([wrongHash.status, (await wrongHash.json()).error]).toEqual([409, "PROPOSAL_CHANGED"])
      expect((await decisionRoute.POST(post(decisionBody(p, { proposalHash: "short" })), decisionCtx(p.id))).status).toBe(400)
      expect(proposals.decisions).toHaveLength(0)
    })

    it("is idempotent, refuses a second decision, and refuses an out-of-date proposal", async () => {
      await readyPlan()
      const p = await makeProposal()
      expect((await decisionRoute.POST(post(decisionBody(p)), decisionCtx(p.id))).status).toBe(201)
      const replay = await decisionRoute.POST(post(decisionBody(p)), decisionCtx(p.id))
      expect([replay.status, (await replay.json()).replayed]).toEqual([200, true])
      const second = await decisionRoute.POST(post(decisionBody(p, { idempotencyKey: "decision-key-0002" })), decisionCtx(p.id))
      expect([second.status, (await second.json()).error]).toEqual([409, "ALREADY_DECIDED"])
      expect(proposals.decisions).toHaveLength(1)

      // a new proposal after the deal changes; the old one can no longer be confirmed
      deals.set("deal-a", { ...deals.get("deal-a")!, refurb_cost: 40000 })
      const p2 = await makeProposal("prop-key-0009-zzzz")
      expect(p2.version).toBe(2)
      const stale = await decisionRoute.POST(post(decisionBody(p, { idempotencyKey: "decision-key-0003" })), decisionCtx(p.id))
      expect(stale.status).toBe(409) // already decided
      deals.set("deal-a", { ...deals.get("deal-a")!, refurb_cost: 41000 })
      const outdated = await decisionRoute.POST(post(decisionBody(p2, { idempotencyKey: "decision-key-0004" })), decisionCtx(p2.id))
      expect([outdated.status, (await outdated.json()).error]).toEqual([409, "PROPOSAL_OUTDATED"])
    })

    it("a cookie-authenticated decision from another origin is refused (CSRF); a bearer client is unaffected", async () => {
      await readyPlan()
      const p = await makeProposal()
      const { createInMemorySessionStore } = await import("./fixtures/in-memory-session-store")
      const { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } = await import("@/lib/auth/operator-auth")
      const { createTestIdentityProvider } = await import("./fixtures/auth-fixtures")
      const { startSession, SECURE_SESSION_COOKIE } = await import("@/lib/auth/session")
      const sessions = createInMemorySessionStore()
      __setOperatorAuthDepsForTests({ provider: createTestIdentityProvider({}), membership: createAllowlistMembershipStore("op-1")!, sessions })
      const { id } = await startSession(sessions, "op-1", new Date())
      const cookie = `${SECURE_SESSION_COOKIE}=${id}`
      const attempt = (origin?: string) => decisionRoute.POST(new Request("https://app.example.test/x", { method: "POST", headers: { "content-type": "application/json", host: "app.example.test", cookie, ...(origin ? { origin } : {}) }, body: JSON.stringify(decisionBody(p)) }), decisionCtx(p.id))
      expect((await attempt("https://evil.example")).status).toBe(403)
      expect((await attempt()).status).toBe(403)
      expect(proposals.decisions).toHaveLength(0)
      expect((await attempt("https://app.example.test")).status).toBe(201)
    })

    it("another deal gets 404 for proposals and decisions", async () => {
      await readyPlan()
      const p = await makeProposal()
      const wrong = ctx({ id: "deal-b", assessmentId: seeded.assessmentId, proposalId: p.id })
      expect((await decisionRoute.POST(post(decisionBody(p)), wrong)).status).toBe(404)
      expect((await proposalRoute.GET(get(operatorHeaders()), ctx({ id: "deal-b", assessmentId: seeded.assessmentId }))).status).toBe(404)
      expect((await proposalRoute.POST(post({ idempotencyKey: "prop-cross-0001" }), ctx({ id: "deal-b", assessmentId: seeded.assessmentId }))).status).toBe(404)
      // deal B's own assessment has no plan, so no proposal
      expect((await proposalRoute.POST(post({ idempotencyKey: "prop-cross-0002" }), ctx({ id: "deal-b", assessmentId: seededB.assessmentId }))).status).toBe(409)
      expect(proposals.decisions).toHaveLength(0)
    })
  })

  describe("Deal Passport", () => {
    it("separates the authoritative Saved Deal, the confirmed scope and the approved proposal", async () => {
      await readyPlan()
      const p = await makeProposal()
      await decisionRoute.POST(post(decisionBody(p)), decisionCtx(p.id))
      const res = await passportRoute.GET(get(operatorHeaders(), `/x?assessmentId=${seeded.assessmentId}`), ctx({ id: "deal-a" }))
      expect(res.status).toBe(200)
      const { passport } = await res.json()
      expect(passport.version).toBe("deal-passport-v2")
      expect(passport.financial.authoritative).toMatchObject({ refurbCost: 25000, purchasePrice: 100000 })
      expect(passport.financial.proposal).toMatchObject({ status: "CONFIRMED", decision: { actor: OPERATOR_SUBJECT } })
      expect(passport.financial.proposal.latest.content.proposed.refurbCost).not.toBe(25000)
      expect(passport.refurbishment).toMatchObject({ status: "CONFIRMED", planVersion: 1 })
      expect(passport.measurements.current.version).toBe(1)
    })
  })
})
