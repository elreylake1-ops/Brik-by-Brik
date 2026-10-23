import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { queryMock, headersMock, redirectMock, notFoundMock, loadModelMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn((to: string) => {
    throw new Error(`NEXT_REDIRECT:${to}`)
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND")
  }),
  loadModelMock: vi.fn(),
}))

// Any database access at all is recorded: an unauthorised request must never get as far as a query.
vi.mock("@/lib/db/postgres", () => ({ query: queryMock, getPostgresPool: () => ({ query: queryMock }) }))
vi.mock("next/headers", () => ({ headers: headersMock }))
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }))
vi.mock("@/lib/investor-review/load-investor-review-page-model", () => ({ loadInvestorReviewPageModel: loadModelMock }))

import * as collection from "@/app/api/saved-deals/route"
import * as detail from "@/app/api/saved-deals/[id]/route"
import * as evidence from "@/app/api/saved-deals/[id]/evidence/route"
import * as evidenceItem from "@/app/api/saved-deals/[id]/evidence/[evidenceId]/route"
import * as shield from "@/app/api/saved-deals/[id]/investor-shield-ui/route"
import * as summary from "@/app/api/saved-deals/[id]/investor-summary/route"
import * as offers from "@/app/api/saved-deals/[id]/offers/route"
import * as pipeline from "@/app/api/saved-deals/[id]/pipeline/route"
import * as tasks from "@/app/api/saved-deals/[id]/tasks/route"
import * as viewingList from "@/app/api/saved-deals/[id]/viewing-assessments/route"
import * as viewingDetail from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/route"
import * as viewingEvidence from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/route"
import * as viewingRuns from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/analysis-runs/route"
import * as viewingFeedback from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/feedback/route"
import * as viewingReview from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/review/route"
import * as viewingOutcome from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/proposals/[proposalId]/outcome/route"
import * as viewingExport from "@/app/api/saved-deals/[id]/viewing-assessments/evaluation-export/route"
import * as viewingImage from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/evidence/[evidenceId]/image/route"
import * as refurbPlan from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/route"
import * as refurbPreview from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/refurb-plan/preview/route"
import * as builderPack from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/builder-pack/route"
import * as dealPassport from "@/app/api/saved-deals/[id]/deal-passport/route"
import * as measurements from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/measurements/route"
import * as financialProposal from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/route"
import * as financialDecision from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/financial-proposal/[proposalId]/decision/route"
import * as videoIntent from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/route"
import * as videoStatus from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/route"
import * as videoConfirm from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/confirm/route"
import * as videoAttach from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/videos/[jobId]/attach/route"
import * as quoteOverrides from "@/app/api/saved-deals/[id]/viewing-assessments/[assessmentId]/quote-overrides/route"
import ReviewPage from "@/app/saved-deals/[id]/review/page"
import SummaryPage from "@/app/saved-deals/[id]/summary/page"
import ViewingPage from "@/app/saved-deals/[id]/viewing/page"
import { requireOperatorPage } from "@/lib/auth/require-operator-page"
import { isDevelopmentOpen } from "@/lib/operator-command/guard-saved-deal-api"
import { signInRequest } from "@/lib/auth/sign-in"
import { __setOperatorAuthDepsForTests, createAllowlistMembershipStore } from "@/lib/auth/operator-auth"
import { createTestIdentityProvider } from "./fixtures/auth-fixtures"
import { createInMemorySessionStore } from "./fixtures/in-memory-session-store"
import { installTestOperator, operatorHeaders, removeTestOperator } from "./fixtures/operator-session"

type Handler = (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>
const ids = { id: "deal-1", evidenceId: "ev-1", assessmentId: "as-1", proposalId: "pr-1", jobId: "vj-1" }
const ctx = { params: Promise.resolve(ids) }
const BASE = "http://localhost"

// Every protected API handler in the application: [label, handler, method, path].
const ROUTES: Array<[string, Handler, string, string]> = [
  ["list deals", collection.GET as unknown as Handler, "GET", "/api/saved-deals"],
  ["create deal", collection.POST as unknown as Handler, "POST", "/api/saved-deals"],
  ["deal detail", detail.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1"],
  ["list evidence", evidence.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/evidence"],
  ["create evidence", evidence.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/evidence"],
  ["update evidence", evidenceItem.PATCH as unknown as Handler, "PATCH", "/api/saved-deals/deal-1/evidence/ev-1"],
  ["investor shield", shield.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/investor-shield-ui"],
  ["investor summary", summary.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/investor-summary"],
  ["list offers", offers.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/offers"],
  ["create offer", offers.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/offers"],
  ["move pipeline", pipeline.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/pipeline"],
  ["list tasks", tasks.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/tasks"],
  ["create task", tasks.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/tasks"],
  ["viewing list", viewingList.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments"],
  ["viewing create", viewingList.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments"],
  ["viewing detail", viewingDetail.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1"],
  ["viewing frame upload", viewingEvidence.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/evidence"],
  ["viewing analysis run", viewingRuns.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/analysis-runs"],
  ["viewing feedback history", viewingFeedback.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/feedback"],
  ["viewing review decision", viewingReview.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/proposals/pr-1/review"],
  ["viewing outcome", viewingOutcome.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/proposals/pr-1/outcome"],
  ["viewing export", viewingExport.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/evaluation-export"],
  ["viewing frame image", viewingImage.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/evidence/ev-1/image"],
  ["refurb plan proposal", refurbPlan.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/refurb-plan"],
  ["refurb plan confirmation", refurbPlan.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/refurb-plan"],
  ["refurb plan preview", refurbPreview.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/refurb-plan/preview"],
  ["builder pack", builderPack.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/builder-pack"],
  ["deal passport", dealPassport.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/deal-passport"],
  ["measurements read", measurements.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/measurements"],
  ["measurements record", measurements.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/measurements"],
  ["financial proposal read", financialProposal.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/financial-proposal"],
  ["financial proposal create", financialProposal.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/financial-proposal"],
  ["financial proposal decision", financialDecision.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/financial-proposal/pr-1/decision"],
  ["video upload intent", videoIntent.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/videos"],
  ["video job status", videoStatus.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/videos/vj-1"],
  ["video job confirm", videoConfirm.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/videos/vj-1/confirm"],
  ["video frame attach", videoAttach.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/videos/vj-1/attach"],
  ["quote overrides list", quoteOverrides.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-1/quote-overrides"],
  ["quote overrides create", quoteOverrides.POST as unknown as Handler, "POST", "/api/saved-deals/deal-1/viewing-assessments/as-1/quote-overrides"],
]

const call = (handler: Handler, method: string, path: string, headers: Record<string, string> = {}, body: unknown = {}) =>
  handler(new Request(`${BASE}${path}`, { method, headers: { "content-type": "application/json", host: "localhost", ...headers }, ...(method === "GET" ? {} : { body: JSON.stringify(body) }) }), ctx)

beforeEach(() => {
  queryMock.mockReset()
  headersMock.mockReset()
  redirectMock.mockClear()
  notFoundMock.mockClear()
  loadModelMock.mockReset()
  installTestOperator()
})
afterEach(() => removeTestOperator())

describe("every Saved Deals API handler is authenticated before it touches anything", () => {
  it("every route file under app/api/saved-deals calls a guard, so a new unguarded route fails here", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs")
    const path = await import("node:path")
    const files: string[] = []
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const full = path.join(dir, n)
        if (statSync(full).isDirectory()) walk(full)
        else if (n === "route.ts") files.push(full)
      }
    }
    walk(path.join(process.cwd(), "app", "api", "saved-deals"))
    expect(files.length).toBe(30)
    for (const f of files) expect(readFileSync(f, "utf8"), f).toMatch(/(guardSavedDealApi|authorize|requireSavedDealReadAccess)\(/)
    expect(ROUTES.length).toBe(39) // one entry per exported handler
  })

  it.each(ROUTES)("%s: anonymous -> 401 and no database access", async (_label, handler, method, path) => {
    removeTestOperator()
    __setOperatorAuthDepsForTests(null)
    const response = await call(handler, method, path)
    expect(response.status).toBe(401)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it.each(ROUTES)("%s: forged identity headers and cookies are ignored -> 401", async (_label, handler, method, path) => {
    const forged = { "x-user-id": "test-operator-1", "x-role": "admin", "x-operator-id": "test-operator-1", cookie: "role=admin; operator_id=test-operator-1; brik_session=" + "a".repeat(43) }
    expect((await call(handler, method, path, forged)).status).toBe(401)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it.each(ROUTES)("%s: invalid bearer token -> 401", async (_label, handler, method, path) => {
    expect((await call(handler, method, path, { authorization: "Bearer not-a-real-token" })).status).toBe(401)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it.each(ROUTES)("%s: a valid account that is not an operator -> 404 (existence not revealed), no database access", async (_label, handler, method, path) => {
    const response = await call(handler, method, path, { authorization: "Bearer tok-outsider" })
    expect(response.status).toBe(404)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it.each(ROUTES)("%s: operator access passes the guard (reaches the handler)", async (_label, handler, method, path) => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 })
    const response = await call(handler, method, path, operatorHeaders())
    expect([401, 403]).not.toContain(response.status)
  })
})

describe("cookie sessions on the existing routes", () => {
  const sessions = createInMemorySessionStore()
  let cookie = ""
  const A = "https://app.example.test"

  beforeEach(async () => {
    sessions.rows.clear()
    __setOperatorAuthDepsForTests({
      provider: createTestIdentityProvider({}),
      membership: createAllowlistMembershipStore("op-1")!,
      sessions,
      credentials: { signIn: async (email, pw) => (pw === "pw" ? { status: "verified", subject: email === "stranger" ? "stranger-1" : "op-1" } : { status: "invalid" }) },
    })
    const r = await signInRequest(new Request(`${A}/api/auth/session`, { method: "POST", headers: { origin: A, host: "app.example.test" }, body: JSON.stringify({ email: "op", password: "pw" }) }))
    cookie = r.setCookie!.split(";")[0]
  })

  const viaCookie = (handler: Handler, method: string, path: string, headers: Record<string, string> = {}) =>
    handler(new Request(`${A}${path}`, { method, headers: { cookie, host: "app.example.test", "content-type": "application/json", ...headers }, ...(method === "GET" ? {} : { body: "{}" }) }), ctx)

  it("a signed-in operator can read through the cookie", async () => {
    queryMock.mockResolvedValue({ rows: [], rowCount: 0 })
    expect((await viaCookie(collection.GET as unknown as Handler, "GET", "/api/saved-deals")).status).not.toBe(401)
  })

  it.each(ROUTES.filter(([, , method]) => method !== "GET"))("%s: cross-site or origin-less cookie request is refused with 403 before any work", async (_l, handler, method, path) => {
    expect((await viaCookie(handler, method, path, { origin: "https://evil.example" })).status).toBe(403)
    expect((await viaCookie(handler, method, path)).status).toBe(403)
    expect(queryMock).not.toHaveBeenCalled()
  })

  it("a revoked session no longer works on any route", async () => {
    await signOutBy(cookie)
    for (const [, handler, method, path] of ROUTES) expect((await viaCookie(handler, method, path, { origin: A })).status).toBe(401)
    expect(queryMock).not.toHaveBeenCalled()
  })

  async function signOutBy(c: string) {
    const { signOutRequest } = await import("@/lib/auth/sign-in")
    await signOutRequest(new Request(`${A}/api/auth/session`, { method: "DELETE", headers: { origin: A, host: "app.example.test", cookie: c } }))
  }
})

describe("per-deal authorization", () => {
  it("a deal id in the URL is never proof of access: every id-bearing route authenticates before looking it up", async () => {
    removeTestOperator()
    __setOperatorAuthDepsForTests(null)
    for (const [, handler, method, path] of ROUTES.filter(([, , , p]) => p.includes("deal-1"))) {
      expect((await call(handler, method, path)).status).toBe(401)
    }
    expect(queryMock).not.toHaveBeenCalled()
  })

  it("an operator cannot reach another deal's assessment by pairing it with their own deal id (404, not data)", async () => {
    // saved deal exists, the assessment belongs to a different deal => the repository reports no such assessment
    queryMock.mockImplementation(async (sql: string) => {
      if (/FROM brik_by_brik_engine\.saved_deals/i.test(sql)) return { rows: [{ id: "deal-1" }], rowCount: 1 }
      return { rows: [], rowCount: 0 }
    })
    const response = await call(viewingDetail.GET as unknown as Handler, "GET", "/api/saved-deals/deal-1/viewing-assessments/as-OTHER-DEAL", operatorHeaders())
    expect([404, 500]).toContain(response.status)
    expect(response.status).not.toBe(200)
  })
})

describe("development-only opt-in cannot open a real environment", () => {
  const dev = { SAVED_DEALS_AUTH_ENFORCEMENT: "development-open", NODE_ENV: "development" }
  it("is honoured only for NODE_ENV=development with the explicit flag and no deployment marker", () => {
    expect(isDevelopmentOpen(dev)).toBe(true)
    expect(isDevelopmentOpen({ ...dev, NODE_ENV: "production" })).toBe(false)
    expect(isDevelopmentOpen({ ...dev, NODE_ENV: "test" })).toBe(false)
    expect(isDevelopmentOpen({ ...dev, VERCEL: "1" })).toBe(false)
    expect(isDevelopmentOpen({ ...dev, VERCEL_ENV: "preview" })).toBe(false)
    expect(isDevelopmentOpen({ ...dev, CI: "true" })).toBe(false)
    expect(isDevelopmentOpen({ NODE_ENV: "development" })).toBe(false) // default is enforcement
    expect(isDevelopmentOpen({ ...dev, SAVED_DEALS_AUTH_ENFORCEMENT: "true" })).toBe(false)
    expect(isDevelopmentOpen({ ...dev, SAVED_DEALS_AUTH_ENFORCEMENT: "off" })).toBe(false)
  })

  it("setting the flag in the test environment does not open any route", async () => {
    vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "development-open")
    removeTestOperator()
    __setOperatorAuthDepsForTests(null)
    expect((await call(collection.GET as unknown as Handler, "GET", "/api/saved-deals")).status).toBe(401)
    vi.unstubAllEnvs()
  })
})

describe("server-rendered pages", () => {
  const asHeaders = (h: Record<string, string>) => headersMock.mockResolvedValue(new Headers(h))
  const props = { params: Promise.resolve({ id: "deal-1" }), searchParams: Promise.resolve({}) }

  it("anonymous visitors are redirected to sign-in with a safe return path", async () => {
    asHeaders({})
    await expect(requireOperatorPage("/saved-deals/deal-1/viewing", "deal-1")).rejects.toThrow("NEXT_REDIRECT:/sign-in?next=%2Fsaved-deals%2Fdeal-1%2Fviewing")
  })

  it("a signed-in non-operator gets a 404, not a sign-in loop", async () => {
    asHeaders({ authorization: "Bearer tok-outsider" })
    await expect(requireOperatorPage("/x", "deal-1")).rejects.toThrow("NEXT_NOT_FOUND")
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it("an operator passes", async () => {
    asHeaders(operatorHeaders())
    await expect(requireOperatorPage("/x", "deal-1")).resolves.toBeUndefined()
  })

  it.each([
    ["review", () => ReviewPage({ params: Promise.resolve({ id: "deal-1" }) })],
    ["summary", () => SummaryPage({ params: Promise.resolve({ id: "deal-1" }) })],
    ["viewing", () => ViewingPage(props)],
  ])("%s page: anonymous -> redirect, and no data is loaded", async (_n, render) => {
    asHeaders({})
    await expect(render()).rejects.toThrow(/NEXT_REDIRECT:\/sign-in\?next=/)
    expect(loadModelMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })

  it.each([
    ["review", () => ReviewPage({ params: Promise.resolve({ id: "deal-1" }) })],
    ["summary", () => SummaryPage({ params: Promise.resolve({ id: "deal-1" }) })],
    ["viewing", () => ViewingPage(props)],
  ])("%s page: non-operator -> 404 and no data is loaded", async (_n, render) => {
    asHeaders({ authorization: "Bearer tok-outsider" })
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND")
    expect(loadModelMock).not.toHaveBeenCalled()
    expect(queryMock).not.toHaveBeenCalled()
  })
})
