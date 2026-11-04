import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: vi.fn(),
}))

import { __setOperatorAuthForTests } from "@/lib/auth/operator-auth"
import { __setTrustedOriginsForTests } from "@/lib/auth/session"
import * as supabaseServer from "@/lib/auth/supabase-server"
import * as dealsRoute from "@/app/api/saved-deals/route"
import * as dealDetailRoute from "@/app/api/saved-deals/[id]/route"
import * as evidenceRoute from "@/app/api/saved-deals/[id]/evidence/route"
import * as investorShieldRoute from "@/app/api/saved-deals/[id]/investor-shield-ui/route"
import * as investorSummaryRoute from "@/app/api/saved-deals/[id]/investor-summary/route"
import * as offersRoute from "@/app/api/saved-deals/[id]/offers/route"
import * as pipelineRoute from "@/app/api/saved-deals/[id]/pipeline/route"
import * as tasksRoute from "@/app/api/saved-deals/[id]/tasks/route"
import * as sessionRoute from "@/app/api/auth/session/route"
import * as repo from "@/lib/operator-command/saved-deals-repository"
import * as reviewLoader from "@/lib/investor-review/load-investor-review-page-model"
import InvestorReviewPage from "@/app/saved-deals/[id]/review/page"
import * as nextNav from "next/navigation"

describe("Production Saved Deal Security & Authorization", () => {
  const ORIGIN = "https://app.brik.com"
  const APPROVED_OPERATOR = "op-approved-uuid-1"
  const UNAPPROVED_OPERATOR = "user-unapproved-uuid-2"

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("SAVED_DEALS_AUTH_ENFORCEMENT", "enforced")
    vi.stubEnv("OPERATOR_ALLOWED_SUBJECTS", APPROVED_OPERATOR)
    vi.stubEnv("TRUSTED_ORIGINS", ORIGIN)
    __setTrustedOriginsForTests([ORIGIN])
  })

  afterEach(() => {
    vi.restoreAllMocks()
    __setOperatorAuthForTests(undefined)
    __setTrustedOriginsForTests(undefined)
    vi.unstubAllEnvs()
  })

  it("1. Missing authentication returns 401 on GET /api/saved-deals", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals", { method: "GET" })
    const res = await dealsRoute.GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ success: false, error: "AUTHENTICATION_REQUIRED" })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("2. Missing authentication returns 401 on mutation POST /api/saved-deals", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: "123 High St" }),
    })
    const res = await dealsRoute.POST(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("AUTHENTICATION_REQUIRED")
  })

  it("3. Invalid authentication token returns 401", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals/deal-1", {
      method: "GET",
      headers: { authorization: "Bearer invalid.token.value" },
    })
    const res = await dealDetailRoute.GET(req, { params: Promise.resolve({ id: "deal-1" }) })
    expect(res.status).toBe(401)
  })

  it("4. Expired authentication token returns 401", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals/deal-1/offers", {
      method: "GET",
      headers: { authorization: "Bearer expired.token" },
    })
    const res = await offersRoute.GET(req, { params: Promise.resolve({ id: "deal-1" }) })
    expect(res.status).toBe(401)
  })

  it("5. Verified but unapproved subject returns 403 on all endpoints", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthorized", subject: UNAPPROVED_OPERATOR }))

    // GET deals
    const resList = await dealsRoute.GET(new Request("https://app.brik.com/api/saved-deals"))
    expect(resList.status).toBe(403)
    expect(await resList.json()).toEqual({ success: false, error: "UNAUTHORIZED_OPERATOR" })

    // GET detail
    const resDetail = await dealDetailRoute.GET(new Request("https://app.brik.com/api/saved-deals/deal-1"), {
      params: Promise.resolve({ id: "deal-1" }),
    })
    expect(resDetail.status).toBe(403)

    // GET evidence
    const resEvidence = await evidenceRoute.GET(new Request("https://app.brik.com/api/saved-deals/deal-1/evidence"), {
      params: Promise.resolve({ id: "deal-1" }),
    })
    expect(resEvidence.status).toBe(403)

    // GET investor-shield-ui
    const resShield = await investorShieldRoute.GET(new Request("https://app.brik.com/api/saved-deals/deal-1/investor-shield-ui"), {
      params: Promise.resolve({ id: "deal-1" }),
    })
    expect(resShield.status).toBe(403)

    // GET investor-summary
    const resSummary = await investorSummaryRoute.GET(new Request("https://app.brik.com/api/saved-deals/deal-1/investor-summary"), {
      params: Promise.resolve({ id: "deal-1" }),
    })
    expect(resSummary.status).toBe(403)

    // POST pipeline movement
    const resPipeline = await pipelineRoute.POST(
      new Request("https://app.brik.com/api/saved-deals/deal-1/pipeline", {
        method: "POST",
        body: JSON.stringify({ requested_pipeline_state: "DUE_DILIGENCE" }),
      }),
      { params: Promise.resolve({ id: "deal-1" }) }
    )
    expect(resPipeline.status).toBe(403)

    // POST task
    const resTask = await tasksRoute.POST(
      new Request("https://app.brik.com/api/saved-deals/deal-1/tasks", {
        method: "POST",
        body: JSON.stringify({ task_title: "Audit" }),
      }),
      { params: Promise.resolve({ id: "deal-1" }) }
    )
    expect(resTask.status).toBe(403)
  })

  it("6. Allowed operator is permitted and has shared company-deal access", async () => {
    vi.spyOn(repo, "getSavedDealById").mockResolvedValue(null)

    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "bearer",
    }))

    const res = await dealDetailRoute.GET(new Request("https://app.brik.com/api/saved-deals/nonexistent-deal"), {
      params: Promise.resolve({ id: "nonexistent-deal" }),
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: "Saved deal not found." })
  })

  it("7. Untrusted Origin matching spoofed Host returns 403 CROSS_ORIGIN_REJECTED", async () => {
    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "cookie",
    }))

    const reqSpoofed = new Request("https://evil-attacker.com/api/saved-deals/deal-1/pipeline", {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.com",
        host: "evil-attacker.com",
        "x-forwarded-host": "evil-attacker.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ requested_pipeline_state: "COMPLETED" }),
    })
    const resSpoofed = await pipelineRoute.POST(reqSpoofed, { params: Promise.resolve({ id: "deal-1" }) })
    expect(resSpoofed.status).toBe(403)
    expect(await resSpoofed.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })
  })

  it("8. Missing Origin on cookie-authenticated mutation returns 403 CROSS_ORIGIN_REJECTED", async () => {
    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "cookie",
    }))

    const reqMissingOrigin = new Request("https://app.brik.com/api/saved-deals/deal-1/pipeline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requested_pipeline_state: "COMPLETED" }),
    })
    const resMissing = await pipelineRoute.POST(reqMissingOrigin, { params: Promise.resolve({ id: "deal-1" }) })
    expect(resMissing.status).toBe(403)
    expect(await resMissing.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })
  })

  it("9. Missing trusted-origin configuration fails closed with 403 CROSS_ORIGIN_REJECTED", async () => {
    __setTrustedOriginsForTests([]) // zero trusted origins configured
    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "cookie",
    }))

    const req = new Request("https://app.brik.com/api/saved-deals/deal-1/pipeline", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ requested_pipeline_state: "COMPLETED" }),
    })
    const res = await pipelineRoute.POST(req, { params: Promise.resolve({ id: "deal-1" }) })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })
  })

  it("10. Invalid Bearer token cannot bypass CSRF on mutation", async () => {
    __setOperatorAuthForTests(async (req) => {
      const auth = req.headers.get("authorization")
      if (auth && auth !== `Bearer ${APPROVED_OPERATOR}`) {
        return { status: "unauthenticated" }
      }
      return { status: "verified", subject: APPROVED_OPERATOR, credential: "cookie" }
    })

    const req = new Request("https://app.brik.com/api/saved-deals/deal-1/pipeline", {
      method: "POST",
      headers: {
        authorization: "Bearer invalid-attacker-token",
        origin: "https://evil-attacker.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ requested_pipeline_state: "COMPLETED" }),
    })
    const res = await pipelineRoute.POST(req, { params: Promise.resolve({ id: "deal-1" }) })
    // Invalid bearer is rejected as 401 unauthenticated, never bypassing CSRF
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ success: false, error: "AUTHENTICATION_REQUIRED" })
  })

  it("11. Same-origin cookie-authenticated mutation passes CSRF and reaches domain logic", async () => {
    vi.spyOn(repo, "getSavedDealById").mockResolvedValue(null)

    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "cookie",
    }))

    const reqValid = new Request("https://app.brik.com/api/saved-deals/nonexistent/pipeline", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ requested_pipeline_state: "DUE_DILIGENCE" }),
    })
    const res = await pipelineRoute.POST(reqValid, { params: Promise.resolve({ id: "nonexistent" }) })
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: "Saved deal not found." })
  })

  it("12. Bearer-authenticated mutation from integration does not require Origin header", async () => {
    vi.spyOn(repo, "getSavedDealById").mockResolvedValue(null)

    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "bearer",
    }))

    const reqBearer = new Request("https://app.brik.com/api/saved-deals/nonexistent/pipeline", {
      method: "POST",
      headers: {
        authorization: "Bearer valid.token",
        "content-type": "application/json",
      },
      body: JSON.stringify({ requested_pipeline_state: "DUE_DILIGENCE" }),
    })
    const res = await pipelineRoute.POST(reqBearer, { params: Promise.resolve({ id: "nonexistent" }) })
    expect(res.status).toBe(404)
  })

  it("13. Sign-in rejects cross-origin and missing Origin POST attacks", async () => {
    // Cross origin
    const reqEvil = new Request("https://app.brik.com/api/auth/session", {
      method: "POST",
      headers: {
        origin: "https://evil.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "op@brik.com", password: "pwd" }),
    })
    const resEvil = await sessionRoute.POST(reqEvil)
    expect(resEvil.status).toBe(403)
    expect(await resEvil.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })

    // Missing origin
    const reqMissing = new Request("https://app.brik.com/api/auth/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "op@brik.com", password: "pwd" }),
    })
    const resMissing = await sessionRoute.POST(reqMissing)
    expect(resMissing.status).toBe(403)
    expect(await resMissing.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })
  })

  it("14. Rejected operator login issues no session cookies and returns 403", async () => {
    const mockSignOut = vi.fn().mockResolvedValue({})
    const mockSignInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { id: "unapproved-user-99", email: "unapproved@brik.com" } },
      error: null,
    })

    const mockClient = {
      supabase: {
        auth: {
          signInWithPassword: mockSignInWithPassword,
          signOut: mockSignOut,
        },
      },
      applyCookies: vi.fn((res: Response) => {
        res.headers.append("set-cookie", "sb-auth-token=forbidden-session-cookie; Path=/")
        return res
      }),
    }

    vi.spyOn(supabaseServer, "createRouteHandlerSupabaseClient").mockReturnValue(mockClient as any)

    const req = new Request("https://app.brik.com/api/auth/session", {
      method: "POST",
      headers: {
        origin: ORIGIN,
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "unapproved@brik.com", password: "secret-password" }),
    })

    const res = await sessionRoute.POST(req)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ success: false, error: "UNAUTHORIZED_OPERATOR" })
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    // Verify no session cookies forwarded
    const setCookie = res.headers.get("set-cookie")
    expect(setCookie).toBeNull()
  })

  it("15. Anonymous and unapproved SSR requests never reach the database loader", async () => {
    const loadSpy = vi.spyOn(reviewLoader, "loadInvestorReviewPageModel").mockResolvedValue({
      status: "ready",
      viewModel: {} as any,
    })

    // 1. Anonymous SSR request: triggers redirect to /sign-in
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    redirectMock.mockClear()

    await InvestorReviewPage({ params: Promise.resolve({ id: "deal-1" }) })
    expect(redirectMock).toHaveBeenCalledWith("/sign-in")
    expect(loadSpy).not.toHaveBeenCalled()

    // 2. Unapproved SSR request: returns Access Denied without DB call
    loadSpy.mockClear()
    __setOperatorAuthForTests(async () => ({ status: "unauthorized", subject: UNAPPROVED_OPERATOR }))

    const result = await InvestorReviewPage({ params: Promise.resolve({ id: "deal-1" }) })
    expect(loadSpy).not.toHaveBeenCalled()
    expect(result).toBeDefined()
  })

  it("16. 500 error does not expose stack traces, credentials, or SQL details", async () => {
    vi.spyOn(repo, "getSavedDealById").mockRejectedValue(
      new Error("FATAL: relation 'public.deals' password='secret_db_password' select * from sensitive_table at Query.execute (pg.ts:99)")
    )

    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "bearer",
    }))

    const req = new Request("https://app.brik.com/api/saved-deals/deal-1", {
      method: "GET",
      headers: { authorization: "Bearer valid-token" },
    })

    const res = await dealDetailRoute.GET(req, { params: Promise.resolve({ id: "deal-1" }) })
    expect(res.status).toBe(500)
    const bodyText = await res.text()
    expect(bodyText).not.toContain("secret_db_password")
    expect(bodyText).not.toContain("password=")
    expect(bodyText).not.toContain("pg.ts")
    expect(bodyText).not.toContain("sensitive_table")
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("17. Session refresh attaches refreshed cookies and logout clears credentials", async () => {
    // 1. Session refresh via applyCookies on route handler
    vi.spyOn(repo, "getSavedDealById").mockResolvedValue({ id: "deal-1" } as any)
    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "cookie",
      applyCookies: <T extends Response>(res: T): T => {
        res.headers.append("set-cookie", "sb-refreshed=refreshed-token-123; Path=/; HttpOnly; SameSite=Lax")
        return res
      },
    }))

    const reqDetail = new Request("https://app.brik.com/api/saved-deals/deal-1", {
      method: "GET",
      headers: { origin: ORIGIN },
    })
    const resDetail = await dealDetailRoute.GET(reqDetail, { params: Promise.resolve({ id: "deal-1" }) })
    expect(resDetail.headers.get("set-cookie")).toContain("sb-refreshed=refreshed-token-123")

    // 2. Logout clears credentials
    const mockSignOut = vi.fn().mockResolvedValue({})
    const mockClient = {
      supabase: {
        auth: { signOut: mockSignOut },
      },
      applyCookies: vi.fn((res: Response) => {
        res.headers.append("set-cookie", "sb-auth-token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
        return res
      }),
    }
    vi.spyOn(supabaseServer, "createRouteHandlerSupabaseClient").mockReturnValue(mockClient as any)

    const reqLogout = new Request("https://app.brik.com/api/auth/session", {
      method: "DELETE",
      headers: { origin: ORIGIN },
    })
    const resLogout = await sessionRoute.DELETE(reqLogout)
    expect(resLogout.status).toBe(200)
    expect(mockSignOut).toHaveBeenCalledTimes(1)
    expect(resLogout.headers.get("set-cookie")).toContain("Max-Age=0")
  })

  it("18. Private responses carry cache-control: no-store", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const res = await dealsRoute.GET(new Request("https://app.brik.com/api/saved-deals"))
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
