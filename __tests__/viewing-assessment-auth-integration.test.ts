import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { createTestIdentityProvider } from "./fixtures/auth-fixtures"

const h = vi.hoisted(() => ({ repo: null as unknown, getDeal: vi.fn() }))

vi.mock("@/lib/viewing-assessment/pg-viewing-assessment-repository", () => ({
  get pgViewingAssessmentRepository() {
    return h.repo
  },
}))
vi.mock("@/lib/operator-command/saved-deals-repository", () => ({ getSavedDealById: h.getDeal }))
// NOTE: the access guard and identity resolver are deliberately NOT mocked here.

import * as listRoute from "@/app/api/saved-deals/[id]/viewing-assessments/route"
import * as reviewRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route"
import * as runsRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs/route"
import * as evidenceRoute from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route"
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } from "@/lib/auth/operator-auth"

const ctx = (ids: { id?: string; assessmentId?: string; proposalId?: string }) => ({ params: Promise.resolve(ids) })
const post = (body: unknown, token?: string) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
const get = (token?: string) =>
  new Request("http://localhost/x", { method: "GET", headers: token ? { authorization: `Bearer ${token}` } : {} })

let mem: ReturnType<typeof createInMemoryViewingRepository>

beforeEach(() => {
  mem = createInMemoryViewingRepository()
  h.repo = mem.repo
  h.getDeal.mockReset().mockImplementation(async (id: string) => (id === "deal-1" ? { id } : null))
  __setOperatorAuthDepsForTests({
    provider: createTestIdentityProvider({ "tok-member": "operator-1", "tok-outsider": "other-app-user" }),
    membership: createAllowlistMembershipStore("operator-1")!,
  })
})
afterEach(() => __setOperatorAuthDepsForTests(undefined))

describe("viewing routes behind the real identity boundary", () => {
  it("returns 401 with no credentials, and with an unrecognised token, writing nothing", async () => {
    for (const token of [undefined, "tok-unknown"]) {
      const res = await listRoute.POST(post({ idempotencyKey: "create-key-0001" }, token), ctx({ id: "deal-1" }))
      expect([res.status, (await res.json()).error]).toEqual([401, "AUTHENTICATION_REQUIRED"])
    }
    expect(mem.rows.assessments).toHaveLength(0)
    expect(h.getDeal).not.toHaveBeenCalled()
  })

  it("returns a privacy-preserving 404 for an authenticated user who is not an operator", async () => {
    const res = await listRoute.POST(post({ idempotencyKey: "create-key-0001" }, "tok-outsider"), ctx({ id: "deal-1" }))
    expect([res.status, (await res.json()).error]).toEqual([404, "SAVED_DEAL_NOT_FOUND"])
    expect(mem.rows.assessments).toHaveLength(0)
  })

  it("lets a member through and records the VERIFIED subject, not anything the client sent", async () => {
    const res = await listRoute.POST(post({ idempotencyKey: "create-key-0001" }, "tok-member"), ctx({ id: "deal-1" }))
    expect(res.status).toBe(201)
    expect(mem.rows.assessments[0].createdBy).toBe("operator-1")
    const spoof = new Request("http://localhost/x", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": "operator-1", "x-role": "admin" },
      body: JSON.stringify({ idempotencyKey: "create-key-0002" }),
    })
    expect((await listRoute.POST(spoof, ctx({ id: "deal-1" }))).status).toBe(401)
  })

  it("carries the verified reviewer identity through analysis and review end to end", async () => {
    const created = await (await listRoute.POST(post({ idempotencyKey: "create-key-0001" }, "tok-member"), ctx({ id: "deal-1" }))).json()
    const assessmentId = created.assessment.id as string
    const evidence = {
      clip: { filename: "a.mp4", mimeType: "video/mp4", sizeBytes: 10, durationSeconds: 60, contentSha256: null },
      frames: [{ timestampSeconds: 4 }],
    }
    expect((await evidenceRoute.POST(post(evidence, "tok-member"), ctx({ id: "deal-1", assessmentId }))).status).toBe(201)
    expect((await runsRoute.POST(post({ idempotencyKey: "run-key-00001" }, "tok-member"), ctx({ id: "deal-1", assessmentId }))).status).toBe(201)
    const proposalId = mem.rows.proposals[0].id
    const review = await reviewRoute.POST(post({ expectedRevision: 0, disposition: "ACCEPTED" }, "tok-member"), ctx({ id: "deal-1", assessmentId, proposalId }))
    expect(review.status).toBe(201)
    expect(mem.rows.reviews[0].reviewerId).toBe("operator-1")
    // The outsider can neither read nor review it.
    expect((await listRoute.GET(get("tok-outsider"), ctx({ id: "deal-1" }))).status).toBe(404)
    expect((await reviewRoute.POST(post({ expectedRevision: 1, disposition: "ACCEPTED" }, "tok-outsider"), ctx({ id: "deal-1", assessmentId, proposalId }))).status).toBe(404)
    expect(mem.rows.reviews).toHaveLength(1)
  })
})
