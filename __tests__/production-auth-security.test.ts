import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { __setOperatorAuthForTests } from "@/lib/auth/operator-auth"
import { __setTrustedOriginsForTests } from "@/lib/auth/session"
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

  it("1. Anonymous API GET returns 401 on /api/saved-deals", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals", { method: "GET" })
    const res = await dealsRoute.GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toEqual({ success: false, error: "AUTHENTICATION_REQUIRED" })
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  it("2. Anonymous mutation returns 401 on /api/saved-deals (POST)", async () => {
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

  it("3. Invalid token returns 401", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals/deal-1", {
      method: "GET",
      headers: { authorization: "Bearer invalid.token.value" },
    })
    const res = await dealDetailRoute.GET(req, { params: Promise.resolve({ id: "deal-1" }) })
    expect(res.status).toBe(401)
  })

  it("4. Expired token returns 401", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const req = new Request("https://app.brik.com/api/saved-deals/deal-1/offers", {
      method: "GET",
      headers: { authorization: "Bearer expired.token" },
    })
    const res = await offersRoute.GET(req, { params: Promise.resolve({ id: "deal-1" }) })
    expect(res.status).toBe(401)
  })

  it("5. Valid authenticated user but unapproved subject returns 403 on all endpoints", async () => {
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

  it("6. Approved operator is permitted and has shared company-deal access", async () => {
    vi.spyOn(repo, "getSavedDealById").mockResolvedValue(null)

    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "bearer",
    }))

    // Verification check reaches repository level (which returns 404 for nonexistent deal, proving auth passed)
    const res = await dealDetailRoute.GET(new Request("https://app.brik.com/api/saved-deals/nonexistent-deal"), {
      params: Promise.resolve({ id: "nonexistent-deal" }),
    })
    // 404 means authentication succeeded and passed through to repository lookup!
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: "Saved deal not found." })
  })

  it("7. Cookie-authenticated mutation with cross-origin or missing Origin returns 403 CROSS_ORIGIN_REJECTED", async () => {
    __setOperatorAuthForTests(async () => ({
      status: "verified",
      subject: APPROVED_OPERATOR,
      credential: "cookie",
    }))

    // Attack from evil origin
    const reqEvil = new Request("https://app.brik.com/api/saved-deals/deal-1/pipeline", {
      method: "POST",
      headers: {
        origin: "https://evil-attacker.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ requested_pipeline_state: "COMPLETED" }),
    })
    const resEvil = await pipelineRoute.POST(reqEvil, { params: Promise.resolve({ id: "deal-1" }) })
    expect(resEvil.status).toBe(403)
    expect(await resEvil.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })

    // Missing origin on cookie mutation
    const reqMissingOrigin = new Request("https://app.brik.com/api/saved-deals/deal-1/pipeline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ requested_pipeline_state: "COMPLETED" }),
    })
    const resMissing = await pipelineRoute.POST(reqMissingOrigin, { params: Promise.resolve({ id: "deal-1" }) })
    expect(resMissing.status).toBe(403)
    expect(await resMissing.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })
  })

  it("8. Same-origin cookie-authenticated mutation passes CSRF and reaches domain logic", async () => {
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
    // Passed CSRF! 404 indicates it safely reached repository lookup
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ success: false, error: "Saved deal not found." })
  })

  it("9. Bearer-authenticated mutation from integration does not require Origin header", async () => {
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

  it("10. Sign-in rejects cross-origin POST attacks", async () => {
    const req = new Request("https://app.brik.com/api/auth/session", {
      method: "POST",
      headers: {
        origin: "https://evil.com",
        "content-type": "application/json",
      },
      body: JSON.stringify({ email: "op@brik.com", password: "pwd" }),
    })
    const res = await sessionRoute.POST(req)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ success: false, error: "CROSS_ORIGIN_REJECTED" })
  })

  it("11. Private responses carry cache-control: no-store", async () => {
    __setOperatorAuthForTests(async () => ({ status: "unauthenticated" }))
    const res = await dealsRoute.GET(new Request("https://app.brik.com/api/saved-deals"))
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
