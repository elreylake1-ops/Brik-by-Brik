import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { scrubbedEnv } from "../../scripts/qa/local-qa-target.mjs"
import { qaGate } from "./qa-gate"

// Real end-to-end rehearsal: the production build of the application, started as a separate process on loopback, a local
// HTTPS identity-provider simulator, and the disposable local QA PostgreSQL. Everything is driven over real HTTP.
// Runs only through `node scripts/qa/local-postgres.mjs test` (confirmed local QA database) after `npm run build`.
// Nothing here prints a session id, token, password or key; cookie VALUES are replaced by <redacted> in every record.

const gate = qaGate("End-to-end authentication rehearsal")
const root = path.resolve(__dirname, "..", "..")
const S = "brik_by_brik_engine"
const built = existsSync(path.join(root, ".next", "BUILD_ID"))

type Seen = { method: string; path: string; status: number; headers: [string, string][]; body: string }

describe.skipIf(!gate.enabled || !built)("Local sign-in rehearsal against the production build (isolated QA only)", () => {
  let sim: Awaited<ReturnType<typeof import("../../scripts/qa/idp-simulator.mjs").startIdentitySimulator>>
  let app: ChildProcess
  let base = ""
  let db: typeof import("@/lib/db/postgres")
  const transcript: Seen[] = []
  const created: string[] = []
  const operator = () => sim.accounts["operator@qa.test"]

  async function http(method: string, p: string, o: { headers?: Record<string, string>; json?: unknown; cookie?: string; ip?: string; origin?: string | null; https?: boolean; redirect?: RequestRedirect } = {}) {
    const headers: Record<string, string> = { "x-forwarded-for": o.ip ?? "10.0.0.1", ...(o.headers ?? {}) }
    if (o.origin !== null && (method !== "GET" || o.origin)) headers.origin = o.origin ?? base
    if (o.cookie) headers.cookie = o.cookie
    if (o.https) headers["x-forwarded-proto"] = "https"
    if (o.json !== undefined) headers["content-type"] = "application/json"
    const res = await fetch(`${base}${p}`, { method, headers, body: o.json !== undefined ? JSON.stringify(o.json) : undefined, redirect: o.redirect ?? "manual" })
    const body = await res.text()
    const hs = [...res.headers.entries()] as [string, string][]
    transcript.push({ method, path: p, status: res.status, headers: hs, body })
    return { status: res.status, body, json: () => JSON.parse(body), setCookie: res.headers.getSetCookie(), location: res.headers.get("location") }
  }
  const signIn = (email: string, password: string, extra: Parameters<typeof http>[2] = {}) => http("POST", "/api/auth/session", { json: { email, password }, ...extra })
  const cookiePair = (setCookie: string[]) => setCookie[0].split(";")[0]
  const redact = (c: string) => c.replace(/=[^;]+/, "=<redacted>")

  beforeAll(async () => {
    const { startIdentitySimulator } = await import("../../scripts/qa/idp-simulator.mjs")
    sim = await startIdentitySimulator()
    process.env.DATABASE_URL = gate.url // this test process only
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()

    const port = await new Promise<number>((resolve) => {
      const s = net.createServer().listen(0, "127.0.0.1", () => {
        const p = (s.address() as net.AddressInfo).port
        s.close(() => resolve(p))
      })
    })
    base = `http://127.0.0.1:${port}`
    app = spawn(process.execPath, [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
      cwd: root,
      stdio: ["ignore", "ignore", "ignore"],
      env: {
        ...scrubbedEnv(),
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        DATABASE_URL: gate.url,
        OPERATOR_AUTH_MODE: "supabase-jwt",
        OPERATOR_JWT_ISSUER: sim.issuer,
        OPERATOR_JWT_AUDIENCE: sim.audience,
        OPERATOR_JWKS_URL: sim.jwksUrl,
        OPERATOR_PASSWORD_GRANT_URL: sim.grantUrl,
        OPERATOR_PASSWORD_GRANT_API_KEY: sim.apiKey,
        OPERATOR_ALLOWED_SUBJECTS: sim.accounts["operator@qa.test"].subject,
        NODE_EXTRA_CA_CERTS: sim.caFile, // trusts the simulator's throw-away certificate in this one process; TLS verification stays ON
        SAVED_DEALS_AUTH_ENFORCEMENT: "development-open", // must be ignored by a production build
      },
    })
    for (let i = 0; i < 90; i++) {
      try {
        if ((await fetch(`${base}/sign-in`)).status === 200) return
      } catch {
        /* still starting */
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    throw new Error("application did not start")
  }, 120_000)

  afterAll(async () => {
    app?.kill()
    if (db) {
      const testSubjects = Object.values(sim?.accounts ?? {}).map((a) => a.subject)
      await db.query(`DELETE FROM ${S}.saved_deals WHERE address LIKE 'QA e2e %'`)
      if (testSubjects.length > 0) {
        await db.query(`DELETE FROM ${S}.operator_sessions WHERE subject = ANY($1)`, [testSubjects])
      }
      await db.getPostgresPool().end()
    }
    await sim?.close()
  })

  const GOOD = { purchasePrice: 100000, gdv: 160000, refurbCost: 20000, stampDuty: 3000, legalCosts: 1500, saleCosts: 3000, bridgeTermMonths: 9 }
  let cookie = ""
  let dealId = ""

  it("1. anonymous Saved Deals requests are refused, and deal pages show nothing", async () => {
    for (const [m, p] of [["GET", "/api/saved-deals"], ["GET", "/api/saved-deals/x"], ["GET", "/api/saved-deals/x/offers"], ["GET", "/api/saved-deals/x/viewing-assessments"], ["GET", "/api/saved-deals/x/investor-summary"]] as const) {
      const r = await http(m, p)
      expect([m, p, r.status]).toEqual([m, p, 401])
      expect(r.json()).toEqual({ success: false, error: "AUTHENTICATION_REQUIRED" })
    }
    expect((await http("POST", "/api/saved-deals", { json: { address: "QA e2e anon", deal_inputs: GOOD } })).status).toBe(401)
    const rows = await db.query(`SELECT 1 FROM ${S}.saved_deals WHERE address = 'QA e2e anon'`)
    expect(rows.rowCount).toBe(0)

    const viewing = await http("GET", "/saved-deals/x/viewing")
    expect([viewing.status, viewing.location]).toEqual([307, "/sign-in?next=%2Fsaved-deals%2Fx%2Fviewing"])
    for (const p of ["/saved-deals/x/review", "/saved-deals/x/summary"]) {
      const r = await http("GET", p)
      expect(r.body).toContain("NEXT_REDIRECT;replace;/sign-in?next=")
      expect(r.body).not.toMatch(/purchase|governance|capital protection/i)
    }
  })

  it("2. the public calculator and the sign-in page render; the sign-in form posts email and password only", async () => {
    expect((await http("GET", "/")).status).toBe(200)
    const page = await http("GET", "/sign-in")
    expect(page.status).toBe(200)
    expect(page.body).toMatch(/type="email"/)
    expect(page.body).toMatch(/type="password"/)
    expect((await http("GET", "/api/auth/session")).json()).toEqual({ authenticated: false })
  })

  it("3. fixture-only developer pages are 404 in this production build, signed in or not", async () => {
    const pages = ["/phase-2-review", "/phase-2-live-review", "/phase-3-dev-review", "/phase-5a-professional-gateway-proof"]
    for (const p of pages) expect([p, (await http("GET", p)).status]).toEqual([p, 404])
  })

  it("4. wrong credentials, a non-operator, a bad or expired token and a wrong audience are all denied identically, with no cookie and no session", async () => {
    const attempts: Array<[string, string]> = [
      ["operator@qa.test", "wrong-password"],
      ["nobody@qa.test", "x"],
      ["stranger@qa.test", sim.accounts["stranger@qa.test"].password], // valid account elsewhere, not an operator
      ["expired@qa.test", sim.accounts["expired@qa.test"].password],
      ["badsig@qa.test", sim.accounts["badsig@qa.test"].password],
      ["wrongaud@qa.test", sim.accounts["wrongaud@qa.test"].password],
    ]
    for (const [email, password] of attempts) {
      const r = await signIn(email, password, { ip: `10.1.0.${attempts.findIndex((a) => a[0] === email)}` })
      expect([email, r.status, r.body, r.setCookie]).toEqual([email, 401, '{"success":false,"error":"SIGN_IN_FAILED"}', []])
    }
    const testSubjects = Object.values(sim.accounts).map((a) => a.subject)
    const sessions = await db.query(
      `SELECT 1 FROM ${S}.operator_sessions WHERE subject = ANY($1)`,
      [testSubjects]
    )
    expect(sessions.rowCount).toBe(0)
  })

  it("5. cross-site or origin-less sign-in is refused", async () => {
    const creds = { email: "operator@qa.test", password: operator().password }
    expect((await http("POST", "/api/auth/session", { json: creds, origin: "https://evil.example", ip: "10.2.0.1" })).status).toBe(403)
    expect((await http("POST", "/api/auth/session", { json: creds, origin: null, ip: "10.2.0.1" })).status).toBe(403)
  })

  it("6. the enrolled operator signs in and receives a hardened, server-backed cookie", async () => {
    const r = await signIn("operator@qa.test", operator().password, { https: true, ip: "10.3.0.1" })
    expect(r.status).toBe(200)
    expect(r.json()).toEqual({ success: true })
    expect(r.setCookie).toHaveLength(1)
    cookie = cookiePair(r.setCookie)
    const attrs = r.setCookie[0].split("; ")
    console.info("sign-in Set-Cookie (value redacted):", [redact(attrs[0]), ...attrs.slice(1)].join("; "))
    expect(attrs[0]).toMatch(/^__Host-brik_session=[A-Za-z0-9_-]{43}$/)
    expect(attrs).toEqual(expect.arrayContaining(["Path=/", "HttpOnly", "Secure", "SameSite=Lax", "Max-Age=28800"]))
    expect(attrs.some((a) => /^Domain=/i.test(a))).toBe(false)

    const id = cookie.split("=")[1]
    const rows = await db.query<{ session_hash: string; subject: string; revoked_at: Date | null }>(`SELECT session_hash, subject, revoked_at FROM ${S}.operator_sessions WHERE subject = $1`, [operator().subject])
    expect(rows.rows).toHaveLength(1)
    expect(rows.rows[0].session_hash).toMatch(/^[a-f0-9]{64}$/)
    expect(rows.rows[0].session_hash).not.toBe(id)
    expect(JSON.stringify(rows.rows[0])).not.toContain(id)
    expect((await http("GET", "/api/auth/session", { cookie })).json()).toEqual({ authenticated: true })
  })

  it("7. an authenticated operator uses the existing Saved Deals API (list, save, read)", async () => {
    expect((await http("GET", "/api/saved-deals", { cookie })).status).toBe(200)
    const saved = await http("POST", "/api/saved-deals", { cookie, json: { address: "QA e2e honest", deal_inputs: GOOD, next_action: "check" } })
    expect(saved.status).toBe(201)
    dealId = saved.json().deal.id
    created.push(dealId)
    const read = await http("GET", `/api/saved-deals/${dealId}`, { cookie })
    expect(read.status).toBe(200)
    expect(read.json().deal).toMatchObject({ address: "QA e2e honest", pipeline_state: "UNDER_ANALYSIS" })
    expect(Number(read.json().deal.purchase_price)).toBe(100000) // pg returns numeric columns as strings (existing behaviour)
    expect((await http("GET", `/api/saved-deals/${dealId}/offers`, { cookie })).status).toBe(200)
    expect((await http("GET", `/api/saved-deals/${dealId}/tasks`, { cookie })).status).toBe(200)
  })

  it("8. forged governance or financial-result fields are rejected and nothing is stored", async () => {
    const before = (await db.query(`SELECT count(*)::int AS n FROM ${S}.saved_deals WHERE address LIKE 'QA e2e %'`)).rows[0].n
    const forged = [
      { governance_state: "STRONG_OPPORTUNITY" },
      { capital_protection_state: "PROTECTED" },
      { classification: "STRONG_DEAL" },
      { pipeline_state: "READY_FOR_OFFER" },
      { engine_result_json: { deal: { profit: 9_999_999 } } },
      { gdv_realistic: 9_999_999 },
      { refurb_cost: 1 },
    ]
    for (const extra of forged) {
      const r = await http("POST", "/api/saved-deals", { cookie, json: { address: "QA e2e forged", deal_inputs: { ...GOOD, purchasePrice: 190000 }, ...extra } })
      expect([Object.keys(extra)[0], r.status]).toEqual([Object.keys(extra)[0], 400])
    }
    for (const bad of [{ ...GOOD, gdv: -5 }, { ...GOOD, gdv: 1e15 }, { ...GOOD, purchasePrice: "100000" }]) {
      expect((await http("POST", "/api/saved-deals", { cookie, json: { address: "QA e2e forged", deal_inputs: bad } })).status).toBe(400)
    }
    expect((await db.query(`SELECT count(*)::int AS n FROM ${S}.saved_deals WHERE address LIKE 'QA e2e %'`)).rows[0].n).toBe(before)

    // The honest record carries the server's own result: tampering with the stored engine output is not possible via the API
    const stored = (await db.query(`SELECT governance_state, engine_result_json FROM ${S}.saved_deals WHERE id = $1`, [dealId])).rows[0]
    expect(stored.engine_result_json.verdict.status).toBe(stored.governance_state)
  })

  it("9. the viewing-assessment workflow works through the same session", async () => {
    const page = await http("GET", `/saved-deals/${dealId}/viewing`, { cookie })
    expect(page.status).toBe(200)
    const made = await http("POST", `/api/saved-deals/${dealId}/viewing-assessments`, { cookie, json: { idempotencyKey: `e2e-${randomUUID().slice(0, 12)}` } })
    expect(made.status).toBe(201)
    const assessmentId = made.json().assessment.id
    const list = await http("GET", `/api/saved-deals/${dealId}/viewing-assessments`, { cookie })
    expect(list.json().assessments.map((a: { id: string }) => a.id)).toContain(assessmentId)
    expect((await http("GET", `/api/saved-deals/${dealId}/viewing-assessments/${assessmentId}`, { cookie })).status).toBe(200)
    expect((await http("GET", `/api/saved-deals/${dealId}/viewing-assessments/evaluation-export`, { cookie })).status).toBe(200)
    // another deal's id cannot be paired with this assessment
    const other = await http("GET", `/api/saved-deals/no-such-deal/viewing-assessments/${assessmentId}`, { cookie })
    expect(other.status).toBe(404)
    // and the page without the session is not served
    expect((await http("GET", `/saved-deals/${dealId}/viewing`)).status).toBe(307)
    const developer = await http("GET", "/phase-3-dev-review", { cookie })
    expect(developer.status).toBe(404)
  })

  it("9b. reviewed findings -> human-confirmed scope -> builder pack -> Deal Passport, through the live server and the same session", async () => {
    const { pgViewingAssessmentRepository } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
    const { seedAssessment, BASICS, ASSUMPTIONS, ACCEPT } = await import("../fixtures/refurb-seed")
    const seeded = await seedAssessment(pgViewingAssessmentRepository, dealId, [
      { checkId: "C01", status: "CONCERN", observation: "Slipped tiles on the rear slope", frames: [3], suggestedWork: "Replace the whole roof, roughly 40k", review: ACCEPT },
      { checkId: "C08", status: "CONCERN", observation: "Cracked render", frames: [0], review: ACCEPT },
      { checkId: "C39", status: "CONCERN", observation: "Unit doors swollen", frames: [0] }, // never reviewed by a person
    ])
    const base = `/api/saved-deals/${dealId}/viewing-assessments/${seeded.assessmentId}`
    const rowBefore = JSON.stringify((await db.query(`SELECT * FROM ${S}.saved_deals WHERE id = $1`, [dealId])).rows)
    const shieldBefore = JSON.stringify((await db.query(`SELECT * FROM ${S}.investor_shield_checks WHERE deal_id = $1 ORDER BY 1`, [dealId])).rows)

    // anonymous callers get nothing
    for (const p of [`${base}/refurb-plan`, `${base}/builder-pack`, `/api/saved-deals/${dealId}/deal-passport`]) expect([p, (await http("GET", p)).status]).toEqual([p, 401])

    // the proposal comes only from reviewed findings
    const proposed = await http("GET", `${base}/refurb-plan`, { cookie })
    expect(proposed.status).toBe(200)
    const proposal = proposed.json().proposal
    expect(proposal.items.map((i: { itemId: string }) => i.itemId)).toEqual(["roof", "external-walls"])
    expect(proposal.excluded).toContainEqual(expect.objectContaining({ checkId: "C39", reason: "UNREVIEWED" }))

    // preview: engine figures, nothing stored
    const input = { propertyBasics: BASICS, financialAssumptions: ASSUMPTIONS }
    const preview = await http("POST", `${base}/refurb-plan/preview`, { cookie, json: input })
    expect(preview.status).toBe(200)
    expect(preview.json().computation.estimate.totalRefurbCost).toBeGreaterThan(0)
    expect((await db.query(`SELECT 1 FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1`, [dealId])).rowCount).toBe(0)

    // the human decision
    const body = { idempotencyKey: `e2e-plan-${randomBytes(4).toString("hex")}`, expectedFingerprint: proposal.fingerprint, accepted: [{ itemId: "roof" }, { itemId: "external-walls" }], ...input }
    const crossSite = await http("POST", `${base}/refurb-plan`, { cookie, json: body, origin: "https://evil.example" })
    expect(crossSite.status).toBe(403)
    const confirmed = await http("POST", `${base}/refurb-plan`, { cookie, json: body })
    expect(confirmed.status).toBe(201)
    expect(confirmed.json().plan).toMatchObject({ version: 1, confirmedBy: operator().subject, dealId })
    const replay = await http("POST", `${base}/refurb-plan`, { cookie, json: body })
    expect([replay.status, replay.json().replayed]).toEqual([200, true])
    expect((await db.query(`SELECT 1 FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1`, [dealId])).rowCount).toBe(1)

    // draft documents
    const pack = await http("GET", `${base}/builder-pack`, { cookie })
    expect(pack.status).toBe(200)
    expect(pack.json().pack).toMatchObject({ status: "DRAFT", approval: "NOT_APPROVED", confidentiality: { internalEstimateIncluded: false } })
    expect(pack.body).not.toContain("£")
    const passport = await http("GET", `/api/saved-deals/${dealId}/deal-passport?assessmentId=${seeded.assessmentId}`, { cookie })
    expect(passport.status).toBe(200)
    expect(passport.json().passport).toMatchObject({ status: "DRAFT", refurbishment: { status: "CONFIRMED", confirmedBy: operator().subject } })
    expect(passport.json().passport.investorShield.dealId).toBe(dealId)
    for (const text of [confirmed.body, pack.body, passport.body]) expect(text).not.toMatch(/roughly 40k|whole roof/)

    // pages
    const page = await http("GET", `/saved-deals/${dealId}/passport?assessmentId=${seeded.assessmentId}`, { cookie })
    expect(page.status).toBe(200)
    expect(page.body).toContain("Deal Passport")
    expect(page.body).toMatch(/Draft/)
    const latest = await http("GET", `/saved-deals/${dealId}/passport`, { cookie }) // no assessmentId: this deal's most recent assessment
    expect(latest.status).toBe(200)
    expect(latest.body.replace(/<!-- -->/g, "")).toMatch(/Version 1, confirmed/) // React inserts comment nodes between text parts
    expect((await http("GET", `/saved-deals/${dealId}/passport`)).status).toBe(307) // anonymous: redirected to sign-in
    const viewing = await http("GET", `/saved-deals/${dealId}/viewing?assessment=${seeded.assessmentId}`, { cookie })
    expect(viewing.body).toContain("Refurbishment scope")

    // none of it touched the Saved Deal, governance or Investor Shield
    expect(JSON.stringify((await db.query(`SELECT * FROM ${S}.saved_deals WHERE id = $1`, [dealId])).rows)).toBe(rowBefore)
    expect(JSON.stringify((await db.query(`SELECT * FROM ${S}.investor_shield_checks WHERE deal_id = $1 ORDER BY 1`, [dealId])).rows)).toBe(shieldBefore)

    // another deal cannot reach it
    expect((await http("GET", `/api/saved-deals/no-such-deal/viewing-assessments/${seeded.assessmentId}/refurb-plan`, { cookie })).status).toBe(404)
  })

  it("9c. measurements -> scope -> financial-impact proposal -> operator decision -> confidential builder pack, through the live server; the Saved Deal never changes", async () => {
    const { pgViewingAssessmentRepository } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
    const { seedAssessment, ASSUMPTIONS, ACCEPT } = await import("../fixtures/refurb-seed")
    const seeded = await seedAssessment(pgViewingAssessmentRepository, dealId, [
      { checkId: "C01", status: "CONCERN", observation: "Slipped tiles on the rear slope", frames: [3], review: ACCEPT },
      { checkId: "C41", status: "CONCERN", observation: "Failed sealant", frames: [2], review: ACCEPT },
      { checkId: "C08", status: "CONCERN", observation: "Cracked render", frames: [0], review: ACCEPT },
    ])
    const base = `/api/saved-deals/${dealId}/viewing-assessments/${seeded.assessmentId}`
    const rowBefore = JSON.stringify((await db.query(`SELECT * FROM ${S}.saved_deals WHERE id = $1`, [dealId])).rows)
    const shieldBefore = JSON.stringify((await db.query(`SELECT * FROM ${S}.investor_shield_checks WHERE deal_id = $1 ORDER BY 1`, [dealId])).rows)
    const entry = (key: string, value: number | string | null, over: Record<string, unknown> = {}) =>
      value === null ? { key, value: null, basis: "UNKNOWN", source: null, confidence: null, note: "Not yet visited", ...over } : { key, value, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "", ...over }
    const measures = [entry("bedrooms", 3), entry("bathrooms", 1), entry("floorAreaSqm", 85, { source: "FLOOR_PLAN" }), entry("kitchenSize", "medium", { basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "medium", note: "From the listing" })]

    // measurements: typed by the operator; nothing from video is accepted
    expect((await http("GET", `${base}/measurements`)).status).toBe(401)
    expect((await http("POST", `${base}/measurements`, { cookie, json: { idempotencyKey: "e2e-meas-bad-1", basedOnVersion: 0, entries: [entry("floorAreaSqm", 80, { basis: "OPERATOR_ESTIMATE", source: "VIDEO_FRAME", note: "from the clip" })] } })).status).toBe(400)
    expect((await http("POST", `${base}/measurements`, { cookie, origin: "https://evil.example", json: { idempotencyKey: "e2e-meas-csrf-1", basedOnVersion: 0, entries: measures } })).status).toBe(403)
    const m1 = await http("POST", `${base}/measurements`, { cookie, json: { idempotencyKey: "e2e-meas-key-1", basedOnVersion: 0, entries: measures } })
    expect(m1.status).toBe(201)
    expect(m1.json().measurementSet).toMatchObject({ version: 1, recordedBy: operator().subject })
    const m2 = await http("POST", `${base}/measurements`, { cookie, json: { idempotencyKey: "e2e-meas-key-2", basedOnVersion: 1, changeNote: "Re-measured with a laser", entries: measures.map((e) => (e.key === "floorAreaSqm" ? entry("floorAreaSqm", 84.5, { source: "LASER_MEASURE" }) : e)) } })
    expect(m2.status).toBe(201)
    const state = (await http("GET", `${base}/measurements`, { cookie })).json()
    expect(state.history.map((h: { record: { version: number } }) => h.record.version)).toEqual([2, 1])
    expect(state.history[0].changesFromPrevious[0]).toMatchObject({ key: "floorAreaSqm", change: "CHANGED" })

    // scope costed from the recorded set; an older set is refused
    const proposal = (await http("GET", `${base}/refurb-plan`, { cookie })).json().proposal
    const body = { idempotencyKey: "e2e-plan-m-key", expectedFingerprint: proposal.fingerprint, accepted: [{ itemId: "roof" }, { itemId: "bathroom", level: "full_replace" }, { itemId: "external-walls" }], financialAssumptions: ASSUMPTIONS }
    expect((await http("POST", `${base}/refurb-plan`, { cookie, json: { ...body, measurementSetId: m1.json().measurementSet.id } })).status).toBe(409)
    const plan = await http("POST", `${base}/refurb-plan`, { cookie, json: { ...body, measurementSetId: m2.json().measurementSet.id } })
    expect(plan.status).toBe(201)
    expect(plan.json().plan).toMatchObject({ measurementSetVersion: 2, propertyBasics: { floorAreaSqm: 84.5 } })

    // the proposal: engine figures beside the authoritative Saved Deal
    expect((await http("POST", `${base}/financial-proposal`, { cookie, json: { idempotencyKey: "e2e-prop-csrf-1" }, origin: "https://evil.example" })).status).toBe(403)
    const prop = await http("POST", `${base}/financial-proposal`, { cookie, json: { idempotencyKey: "e2e-prop-key-1" } })
    expect(prop.status).toBe(201)
    const pr = prop.json().proposal
    expect(pr.content).toMatchObject({ nonAuthoritative: true, authoritative: { purchasePrice: 100000, refurbCost: 20000 } })
    expect(pr.content.proposed.refurbCost).toBeGreaterThan(0)
    expect(pr.content.exclusions.map((e: { itemId: string }) => e.itemId)).toEqual(["external-walls"])

    // the decision: acknowledgements, the verified operator, and an explicit statement that nothing was written back
    const decisionPath = `${base}/financial-proposal/${pr.id}/decision`
    const dBody = { idempotencyKey: "e2e-decision-key", decision: "CONFIRMED", proposalHash: pr.contentHash, note: "Agreed for builder pricing", acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true } }
    expect((await http("POST", decisionPath, { cookie, json: { ...dBody, acknowledge: { ...dBody.acknowledge, notWriteBack: false } } })).status).toBe(400)
    expect((await http("POST", decisionPath, { cookie, json: dBody, origin: "https://evil.example" })).status).toBe(403)
    const decided = await http("POST", decisionPath, { cookie, json: dBody })
    expect(decided.status).toBe(201)
    expect(decided.json()).toMatchObject({ savedDealChanged: false, decision: { decision: "CONFIRMED", actor: operator().subject } })
    expect((await http("POST", decisionPath, { cookie, json: dBody })).json().replayed).toBe(true)
    expect((await http("POST", decisionPath, { cookie, json: { ...dBody, idempotencyKey: "e2e-decision-2" } })).status).toBe(409)
    expect((await db.query(`SELECT 1 FROM ${S}.refurb_financial_decisions WHERE deal_id = $1`, [dealId])).rowCount).toBe(1)

    // the builder pack carries nothing internal
    const pack = await http("GET", `${base}/builder-pack`, { cookie })
    expect(pack.status).toBe(200)
    const packText = JSON.stringify({ ...pack.json().pack, confidentiality: undefined })
    expect(pack.json().pack).toMatchObject({ version: "builder-pack-v2", confidentiality: { internalEstimateIncluded: false, engineRatesIncluded: false } })
    expect(packText).not.toMatch(/[£$€]|\bprofit\b|\bMAO\b|\bGDV\b|\bverdict\b|governance|\bshield\b|purchase price|\blabour\b|\bengine\b/i)
    expect(packText).not.toContain(operator().subject)
    for (const n of ["100000", "160000", "20000", String(Math.round(pr.content.proposed.refurbCost)), String(Math.round(pr.content.proposed.profit))]) expect(new RegExp(`(?<![0-9.])${n}(?![0-9])`).test(packText), n).toBe(false)

    // the Passport keeps three layers apart
    const passport = (await http("GET", `/api/saved-deals/${dealId}/deal-passport?assessmentId=${seeded.assessmentId}`, { cookie })).json().passport
    expect(passport.financial.authoritative).toMatchObject({ purchasePrice: 100000, refurbCost: 20000 })
    expect(passport.financial.proposal).toMatchObject({ status: "CONFIRMED", decision: { actor: operator().subject } })
    expect(passport.financial.proposal.latest.content.proposed.refurbCost).not.toBe(20000)
    const page = await http("GET", `/saved-deals/${dealId}/passport?assessmentId=${seeded.assessmentId}`, { cookie })
    expect(page.status).toBe(200)
    expect(page.body.replace(/<!-- -->/g, "")).toMatch(/3\. Proposal: financial impact of the confirmed scope \(not authoritative\)/)

    // approving a proposed adjustment wrote nothing to the Saved Deal or Investor Shield
    expect(JSON.stringify((await db.query(`SELECT * FROM ${S}.saved_deals WHERE id = $1`, [dealId])).rows)).toBe(rowBefore)
    expect(JSON.stringify((await db.query(`SELECT * FROM ${S}.investor_shield_checks WHERE deal_id = $1 ORDER BY 1`, [dealId])).rows)).toBe(shieldBefore)

    // another deal reaches none of it
    for (const p of [`measurements`, `financial-proposal`, `refurb-plan`]) expect([p, (await http("GET", `/api/saved-deals/no-such-deal/viewing-assessments/${seeded.assessmentId}/${p}`, { cookie })).status]).toEqual([p, 404])
  })

  it("10. cross-origin and origin-less writes with a valid cookie are refused (CSRF), reads are not", async () => {
    const countRows = async () => (await db.query(`SELECT count(*)::int AS n FROM ${S}.saved_deals WHERE address LIKE 'QA e2e %'`)).rows[0].n
    const before = await countRows()
    for (const origin of ["https://evil.example", "null", null]) {
      const r = await http("POST", "/api/saved-deals", { cookie, origin, json: { address: "QA e2e csrf", deal_inputs: GOOD } })
      expect([String(origin), r.status, r.json().error]).toEqual([String(origin), 403, "CROSS_ORIGIN_REJECTED"])
    }
    const viewing = await http("POST", `/api/saved-deals/${dealId}/viewing-assessments`, { cookie, origin: "https://evil.example", json: { idempotencyKey: "csrf-attempt-1" } })
    expect(viewing.status).toBe(403)
    const logout = await http("DELETE", "/api/auth/session", { cookie, origin: "https://evil.example" })
    expect(logout.status).toBe(403)
    expect(await countRows()).toBe(before)
    expect((await http("GET", "/api/saved-deals", { cookie, origin: "https://evil.example" })).status).toBe(200)
  })

  it("11. invalid, tampered, expired, idle, revoked and non-member sessions fail closed", async () => {
    const id = cookie.split("=")[1]
    const name = cookie.split("=")[0]
    const probe = async (c: string) => (await http("GET", "/api/saved-deals", { cookie: c })).status

    expect(await probe(`${name}=${id.slice(0, -2)}xx`)).toBe(401) // tampered
    expect(await probe(`${name}=${randomBytes(32).toString("base64url")}`)).toBe(401) // well-formed but unknown
    expect(await probe(`${name}=short`)).toBe(401)
    expect(await probe("")).toBe(401)

    const fresh = async (email = "operator@qa.test", account = operator()) => {
      const r = await signIn(email, account.password, { ip: `10.4.0.${Math.floor(Math.random() * 200)}`, https: true })
      return cookiePair(r.setCookie)
    }
    const latestHash = () => db.query<{ session_hash: string }>(`SELECT session_hash FROM ${S}.operator_sessions WHERE subject = $1 ORDER BY created_at DESC LIMIT 1`, [operator().subject]).then((r) => r.rows[0].session_hash)

    // absolute expiry
    const a = await fresh()
    expect(await probe(a)).toBe(200)
    await db.query(`UPDATE ${S}.operator_sessions SET expires_at = NOW() - INTERVAL '1 second', created_at = NOW() - INTERVAL '9 hours' WHERE session_hash = $1`, [await latestHash()])
    expect(await probe(a)).toBe(401)

    // idle expiry
    const b = await fresh()
    await db.query(`UPDATE ${S}.operator_sessions SET last_seen_at = NOW() - INTERVAL '2 hours' WHERE session_hash = $1`, [await latestHash()])
    expect(await probe(b)).toBe(401)

    // revoked server-side (as an administrator might)
    const c = await fresh()
    expect(await probe(c)).toBe(200)
    await db.query(`UPDATE ${S}.operator_sessions SET revoked_at = NOW() WHERE session_hash = $1`, [await latestHash()])
    expect(await probe(c)).toBe(401)

    // a perfectly valid session row for someone who is not an enrolled operator: membership is checked per request
    const strangerId = randomBytes(32).toString("base64url")
    const { createHash } = await import("node:crypto")
    await db.query(`INSERT INTO ${S}.operator_sessions (session_hash, subject, created_at, last_seen_at, expires_at) VALUES ($1, $2, NOW(), NOW(), NOW() + INTERVAL '1 hour')`, [createHash("sha256").update(strangerId).digest("hex"), sim.accounts["stranger@qa.test"].subject])
    const r = await http("GET", "/api/saved-deals", { cookie: `${name}=${strangerId}` })
    expect(r.status).toBe(404)
    expect(r.json()).toEqual({ success: false, error: "SAVED_DEAL_NOT_FOUND" })
    expect((await http("GET", "/saved-deals/x/viewing", { cookie: `${name}=${strangerId}` })).status).toBe(404)
    expect((await http("GET", "/api/auth/session", { cookie: `${name}=${strangerId}` })).json()).toEqual({ authenticated: false })

    // a forged bearer header is not rescued by a valid cookie
    expect((await http("GET", "/api/saved-deals", { cookie, headers: { authorization: "Bearer forged.token.value" } })).status).toBe(401)
    // forged identity hints change nothing
    expect((await http("GET", "/api/saved-deals", { headers: { "x-user-id": operator().subject, "x-role": "admin", cookie: "role=admin" } })).status).toBe(401)
  })

  it("12. sign-out ends the session on the server; the old cookie is worthless afterwards", async () => {
    const r = await signIn("operator@qa.test", operator().password, { https: true, ip: "10.5.0.1" })
    const mine = cookiePair(r.setCookie)
    expect((await http("GET", "/api/saved-deals", { cookie: mine })).status).toBe(200)
    const out = await http("DELETE", "/api/auth/session", { cookie: mine })
    expect(out.status).toBe(200)
    console.info("sign-out Set-Cookie (value redacted):", redact(out.setCookie[0]))
    expect(out.setCookie[0]).toMatch(/^[\w-]+=; .*Max-Age=0/)
    expect((await http("GET", "/api/saved-deals", { cookie: mine })).status).toBe(401)
    expect((await http("GET", "/api/auth/session", { cookie: mine })).json()).toEqual({ authenticated: false })
    const row = await db.query(`SELECT revoked_at FROM ${S}.operator_sessions WHERE session_hash = encode(sha256(convert_to($1, 'UTF8')), 'hex')`, [mine.split("=")[1]])
    expect(row.rows[0].revoked_at).not.toBeNull()
  })

  it("13. repeated failed sign-ins are rate limited, even for the correct password afterwards", async () => {
    for (let i = 0; i < 5; i++) expect((await signIn("operator@qa.test", `wrong-${i}`, { ip: "10.9.9.9" })).status).toBe(401)
    const limited = await signIn("operator@qa.test", operator().password, { ip: "10.9.9.9" })
    expect(limited.status).toBe(429)
    expect(limited.setCookie).toEqual([])
    expect((await signIn("operator@qa.test", operator().password, { ip: "10.9.9.10", https: true })).status).toBe(200) // another client is unaffected
  })

  it("14. the development-open switch, set on this production server, opened nothing (every anonymous request above was 401)", async () => {
    expect((await http("GET", "/api/saved-deals")).status).toBe(401)
    expect((await http("GET", "/phase-2-review")).status).toBe(404)
  })

  it("15. no provider token, refresh token, API key, password or raw session id reaches a browser-visible response", async () => {
    expect(sim.issued.length).toBeGreaterThan(0) // tokens really were issued and handled server-side
    const secrets = [...sim.issued, sim.apiKey, ...Object.values(sim.accounts).map((a) => a.password)]
    const sessionIds = transcript.flatMap((t) => t.headers.filter(([k]) => k === "set-cookie").map(([, v]) => v.split(";")[0].split("=")[1])).filter(Boolean)
    for (const t of transcript) {
      const visible = t.body + t.headers.map(([k, v]) => `${k}: ${k === "set-cookie" ? v.split("=")[0] : v}`).join("\n")
      for (const s of secrets) expect(visible.includes(s), `${t.method} ${t.path}`).toBe(false)
      if (!t.path.startsWith("/_next/")) for (const id of sessionIds) if (id) expect(t.body.includes(id), `${t.method} ${t.path}`).toBe(false)
    }
    // the only place an access-token-like value appears is the cookie, and it is an opaque random id, not a JWT
    for (const id of sessionIds) if (id) expect(id).not.toMatch(/^eyJ/)
    console.info(`checked ${transcript.length} responses for ${secrets.length} secrets and ${sessionIds.length} session ids: none exposed`)
  })
})
