import { test, expect, type Locator } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import pg from "pg"
import { inspectMedia } from "../lib/viewing-assessment/video/media-inspector"
import { isQaEnvironment } from "../lib/qa-security"
import { externalUploadServer, verifyExternalRuntimeIdentity } from "./local-upload-server-ownership"

const root = path.resolve(__dirname, "..")
const SCHEMA = "brik_by_brik_engine"
const testRunId = randomUUID().slice(0, 8)
const DEAL_ID = `deal-local-upload-${testRunId}`
const DEAL_ADDRESS = `18 St Andrews Crescent, Harrogate HG2 8RE (${testRunId})`
const INITIAL_PURCHASE = 320000
const INITIAL_REFURB = 40000
const INITIAL_GDV = 520000
const lifecycleStartedAt = performance.now()

function lifecycle(marker: string, details: Record<string, unknown> = {}) {
  console.log(
    `[Upload lifecycle ${marker} +${Math.round(performance.now() - lifecycleStartedAt)}ms] ${JSON.stringify(details)}`
  )
}
lifecycle("T0 module-loaded")

const fixtureVideoPath = path.join(root, "__tests__", "fixtures", "synthetic-video.mp4")
const screenshotsDir = path.join(root, "docs", "option2", "screenshots", "upload-acceptance")
mkdirSync(screenshotsDir, { recursive: true })

type SimHandle = {
  accounts: Record<string, { subject: string; password: string }>
  issuer: string
  audience: string
  jwksUrl: string
  grantUrl: string
  apiKey: string
  caFile: string
  close: () => Promise<void>
}

test.describe.serial("Local Browser Video Upload & Extraction Acceptance (Genuine Chrome)", () => {
  let sim: SimHandle | undefined
  let app: ChildProcess
  let serverOwned = false
  let pool: pg.Pool
  let baseUrl: string
  let operatorPassword = ""
  let assessmentId = ""

  function cleanLocalFixtureStorage() {
    const fixtureDirectory = path.join(root, ".qa-local", "evidence", "video", "deal-evidence", "video-evidence", DEAL_ID)
    if (existsSync(fixtureDirectory)) rmSync(fixtureDirectory, { recursive: true, force: true })
  }

  test.beforeAll("setup isolated local development runtime, ephemeral IdP, and start Next.js dev", async () => {
    lifecycle("T1 beforeAll-begin")
    test.setTimeout(120_000)
    const { assertLocalQaTarget, buildLocalQaUrl, LOCAL_QA, scrubbedEnv } = await import("../scripts/qa/local-qa-target.mjs")
    const { startIdentitySimulator } = await import("../scripts/qa/idp-simulator.mjs")

    // 1. Confirm isolated local QA database credentials
    const envFile = path.join(root, ".qa-local", "pg.env")
    if (!existsSync(envFile)) {
      throw new Error(".qa-local/pg.env not found. Ensure isolated QA container is running via node scripts/qa/local-postgres.mjs up")
    }
    const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("POSTGRES_PASSWORD="))
    if (!line) throw new Error("POSTGRES_PASSWORD missing from .qa-local/pg.env")
    const password = line.slice("POSTGRES_PASSWORD=".length)

    const dbUrl = buildLocalQaUrl(password)
    assertLocalQaTarget(dbUrl)

    pool = new pg.Pool({ connectionString: dbUrl, max: 2 })
    const dbCheck = await pool.query("SELECT current_database() AS db, inet_server_addr() AS ip")
    if (dbCheck.rows[0]?.db !== LOCAL_QA.database) {
      throw new Error(`Connected to unexpected database: ${dbCheck.rows[0]?.db}`)
    }
    lifecycle("T2 database-ready", { database: dbCheck.rows[0]?.db })
    const externalServer = externalUploadServer(process.env)
    const externalIssuer = process.env.E2E_EXTERNAL_IDP_ISSUER
    const externalRunIdentity = process.env.E2E_EXTERNAL_RUN_IDENTITY
    const externalIssuerFingerprint = process.env.E2E_EXTERNAL_IDP_ISSUER_FINGERPRINT
    if (externalServer && (!process.env.E2E_EXTERNAL_OPERATOR_PASSWORD || !externalIssuer || !externalRunIdentity || !externalIssuerFingerprint)) throw new Error("external server IdP handoff is required")

    // 2. Start ephemeral Identity Provider simulator
    if (!externalServer) {
      sim = await startIdentitySimulator()
      operatorPassword = sim.accounts["operator@qa.test"].password
      lifecycle("T3 idp-ready")
    } else operatorPassword = process.env.E2E_EXTERNAL_OPERATOR_PASSWORD!

    // 3. Each run has a random deal ID. Append-only records are cleared by the
    // post-test isolated QA baseline recovery, not by row-level deletion.

    const engineResult = {
      deal: { purchasePrice: INITIAL_PURCHASE, refurbCost: INITIAL_REFURB, gdv: INITIAL_GDV, profit: 90000 },
      verdict: { status: "CONDITIONAL", reason: "Awaiting video viewing verification" },
    }
    const riskSummary = { overallStatus: "PASSED", flags: [] }

    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION', $6, $7, NOW(), NOW())`,
      [DEAL_ID, DEAL_ADDRESS, INITIAL_PURCHASE, INITIAL_GDV, INITIAL_REFURB, JSON.stringify(engineResult), JSON.stringify(riskSummary)]
    )

    if (externalServer) {
      const readiness = await fetch(`${externalServer.baseUrl}/sign-in`)
      if (readiness.status !== 200) throw new Error(`external upload server readiness failed: ${readiness.status}`)
      const identity = await fetch(`${externalServer.baseUrl}/api/qa/runtime-identity`)
      if (identity.status !== 200) throw new Error("external upload server identity probe failed")
      const marker = await identity.json()
      verifyExternalRuntimeIdentity({ runIdentity: externalRunIdentity!, idpIssuerFingerprint: externalIssuerFingerprint! }, marker)
      baseUrl = externalServer.baseUrl
      lifecycle("T4 external-server-reused", { baseUrl, issuer: externalIssuer })
      return
    }

    // 4. Allocate isolated local port and spawn Next.js under the supported local development runtime
    const appPort = await new Promise<number>((resolve) => {
      const s = net.createServer().listen(0, "127.0.0.1", () => {
        const p = (s.address() as net.AddressInfo).port
        s.close(() => resolve(p))
      })
    })
    baseUrl = `http://127.0.0.1:${appPort}`

    app = spawn(
      process.execPath,
      [path.join(root, "node_modules", "next", "dist", "bin", "next"), "dev", "-H", "127.0.0.1", "-p", String(appPort)],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "inherit"],
        env: {
          ...scrubbedEnv(),
          NODE_ENV: "development",
          VIEWING_BLOB_STORE: "local-fs",
          NEXT_TELEMETRY_DISABLED: "1",
          DATABASE_URL: dbUrl,
          VIEWING_QA_CONFIRM_ISOLATED: "I_CONFIRM_THIS_IS_NOT_PRODUCTION",
          VIEWING_AI_ENABLED: "false",
          VIEWING_CHECKLIST_WORDING_APPROVED: "true",
          OPERATOR_AUTH_MODE: "supabase-jwt",
          OPERATOR_JWT_ISSUER: sim.issuer,
          OPERATOR_JWT_AUDIENCE: sim.audience,
          OPERATOR_JWKS_URL: sim.jwksUrl,
          OPERATOR_PASSWORD_GRANT_URL: sim.grantUrl,
          OPERATOR_PASSWORD_GRANT_API_KEY: sim.apiKey,
          OPERATOR_ALLOWED_SUBJECTS: sim.accounts["operator@qa.test"].subject,
          NODE_EXTRA_CA_CERTS: sim.caFile,
          SAVED_DEALS_AUTH_ENFORCEMENT: "development-open",
        },
      }
    )
    serverOwned = true
    lifecycle("T4 next-spawned", { pid: app.pid ?? null, port: appPort })
    app.once("exit", (code, signal) => lifecycle("T16 next-exit", { code, signal }))

    let ready = false
    for (let i = 0; i < 90; i++) {
      try {
        const res = await fetch(`${baseUrl}/sign-in`)
        if (res.status === 200) {
          ready = true
          break
        }
      } catch {
        // starting up
      }
      await new Promise((r) => setTimeout(r, 1000))
    }
    if (!ready) throw new Error("Next.js development server failed to respond within 90 seconds")
    lifecycle("T5 next-ready", { port: appPort })
  })

  test.afterAll(async () => {
    lifecycle("T14 afterAll-begin", { appPid: app?.pid ?? null })
    lifecycle("T15 next-kill-requested", { appPid: app?.pid ?? null, alreadyExited: app?.exitCode !== null })
    if (serverOwned && app) app.kill()
    if (pool) await pool.end()
    if (sim) await sim.close()
    cleanLocalFixtureStorage()
    console.log(`[Upload fixture cleanup requires isolated QA baseline recovery: ${DEAL_ID}]`)
    lifecycle("T17 afterAll-complete")
  })

  test.afterEach(() => lifecycle("T13 test-afterEach"))

  test("Genuine Chrome video upload, local-fs TUS storage, worker extraction, gallery and frame attachment", async ({ page }, testInfo) => {
    lifecycle("T6 test-begin")
    test.setTimeout(120_000)

    // =========================================================================
    // 1. Verify media fixture independently
    // =========================================================================
    const media = await inspectMedia(fixtureVideoPath)
    expect(media.valid).toBe(true)
    if (media.valid) {
      expect(media.codec).toBe("h264")
      expect(media.durationSec).toBe(3)
      expect(media.width).toBe(320)
      expect(media.height).toBe(240)
    }

    // =========================================================================
    // 2. Sign in as enrolled operator
    // =========================================================================
    page.on("console", (msg) => console.log(`[Browser Console ${msg.type()}]:`, msg.text()))
    page.on("requestfailed", (req) => console.log(`[Request Failed]:`, req.url(), req.failure()?.errorText))
    page.on("response", (res) => {
      if (res.url().includes("/videos") || res.url().includes("/qa/video-storage")) {
        console.log(`[HTTP ${res.status()}]:`, res.url())
      }
    })

    await page.goto(`${baseUrl}/sign-in`)
    await page.locator('input[type="email"]').fill("operator@qa.test")
    await page.locator('input[type="password"]').fill(operatorPassword)
    await page.locator('button[type="submit"]').click()
    await page.waitForLoadState("networkidle")
    await page.goto(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)

    // =========================================================================
    // 3. Create viewing assessment
    // =========================================================================
    const createBtn = page.getByRole("button", { name: "Create viewing assessment" })
    await expect(createBtn).toBeVisible({ timeout: 15_000 })
    const [res] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/viewing-assessments") && r.status() === 201),
      createBtn.click(),
    ])
    const resJson = await res.json()
    assessmentId = resJson.assessment?.id || ""
    expect(assessmentId).toBeTruthy()
    console.log("[Upload harness] STEP A - assessment created")
    lifecycle("T7 assessment-created", { assessmentId })

    let uploadStep = "STEP B - locating upload control"
    const captureUploadStall = async () => {
      const fileInput = page.getByLabel("Choose video file")
      const state = {
        step: uploadStep,
        url: page.url(),
        title: await page.title(),
        heading: await page.locator("h1, h2, h3").first().textContent(),
        dialogVisible: await page.getByRole("dialog").count().then((count) => count > 0),
        fileInputCount: await fileInput.count(),
        fileInputVisible: await fileInput.isVisible().catch(() => false),
        fileInputDisabled: await fileInput.isDisabled().catch(() => null),
      }
      await page.screenshot({ path: testInfo.outputPath("upload-harness-stall.png") })
      console.log(`[Upload harness stall] ${JSON.stringify(state)}`)
    }

    // =========================================================================
    // 4. Negative validation: invalid file format rejected by client-side guard
    // =========================================================================
    const fileInput = page.getByLabel("Choose video file")
    let uploadBtn: Locator
    try {
      await expect(fileInput).toBeVisible({ timeout: 15_000 })
      console.log("[Upload harness] STEP C - upload control located")

      uploadStep = "STEP D - attaching invalid file"
      const invalidPath = path.join(root, "package.json")
      await fileInput.setInputFiles(invalidPath, { timeout: 15_000 })
      await expect(page.getByText(/Unsupported file extension/i)).toBeVisible({ timeout: 15_000 })

      uploadStep = "STEP E - attaching synthetic video"
      await fileInput.setInputFiles(fixtureVideoPath, { timeout: 15_000 })
      await expect(page.getByText(/13\.9 KB|14\.3 KB|14 KB/i)).toBeVisible({ timeout: 15_000 })
      uploadBtn = page.getByRole("button", { name: "Upload & Queue Extraction" })
      await expect(uploadBtn).toBeVisible({ timeout: 15_000 })
      console.log("[Upload harness] STEP F - file attached and upload action ready")
      lifecycle("T8 upload-ready")
    } catch (error) {
      await captureUploadStall()
      throw error
    }

    // =========================================================================
    // 6. Execute genuine browser upload via local-fs TUS endpoint & confirm
    // =========================================================================
    let preConfirmDiagnostic: Record<string, unknown> | undefined
    await page.route("**/confirm", async (route) => {
      const request = route.request()
      const parts = new URL(request.url()).pathname.split("/")
      const videosIndex = parts.lastIndexOf("videos")
      const jobId = parts[videosIndex + 1]
      const rowById = await pool.query(
        `SELECT id, deal_id, viewing_id, state, created_at, updated_at
         FROM ${SCHEMA}.video_jobs WHERE id = $1`,
        [jobId]
      )
      const rowByScope = await pool.query(
        `SELECT id FROM ${SCHEMA}.video_jobs WHERE deal_id = $1 AND viewing_id = $2 AND id = $3`,
        [DEAL_ID, assessmentId, jobId]
      )
      const target = await pool.query(
        "SELECT current_database() AS database, current_user AS username, inet_server_addr()::text AS host, inet_server_port() AS port"
      )
      preConfirmDiagnostic = {
        method: request.method(),
        path: new URL(request.url()).pathname,
        dealId: DEAL_ID,
        assessmentId,
        jobId,
        bodyShape: request.postDataJSON() && typeof request.postDataJSON() === "object" ? "object" : typeof request.postDataJSON(),
        rowById: rowById.rows[0] ?? null,
        scopedTripleFound: rowByScope.rowCount === 1,
        databaseTarget: target.rows[0],
      }
      console.log(`[Upload diagnostic pre-confirm] ${JSON.stringify(preConfirmDiagnostic)}`)
      await route.continue()
    })

    const [intentResponse, confirmResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/videos") && !r.url().includes("/confirm") && r.request().method() === "POST" && (r.status() === 200 || r.status() === 201)
      ),
      page.waitForResponse((r) => r.url().includes("/confirm") && r.request().method() === "POST"),
      uploadBtn!.click(),
    ])

    const intentData = await intentResponse.json()
    const confirmData = await confirmResponse.json()
    lifecycle("T9 upload-responses", { intentStatus: intentResponse.status(), confirmStatus: confirmResponse.status() })
    console.log(`[Upload diagnostic intent] ${JSON.stringify({ status: intentResponse.status(), dealId: DEAL_ID, assessmentId, jobId: intentData.jobId, sourcePath: intentData.sourcePath })}`)
    console.log(`[Upload diagnostic confirm] ${JSON.stringify({ status: confirmResponse.status(), body: confirmData })}`)
    expect(preConfirmDiagnostic).toMatchObject({
      dealId: DEAL_ID,
      assessmentId,
      jobId: intentData.jobId,
      scopedTripleFound: true,
    })
    expect(intentData.success).toBe(true)
    expect(confirmData.success).toBe(true)
    expect(confirmData.state).toBe("queued")
    expect(confirmData.observedBytes).toBe(14265)

    // Verify UI displays queued notice and "Run Media Worker" button
    await expect(page.getByText(/Queued for server extraction worker/i)).toBeVisible({ timeout: 15_000 })
    const workerBtn = page.getByTestId("run-media-worker-btn")
    await expect(workerBtn).toBeVisible()

    // =========================================================================
    // 7. Trigger worker extraction and verify state transitions
    // =========================================================================
    const [workerResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/qa/video-worker/cycle") && r.status() === 200),
      workerBtn.click(),
    ])
    const workerData = await workerResponse.json()
    lifecycle("T10 worker-complete", { frameCount: workerData.result?.frameCount ?? null })
    expect(workerData.success).toBe(true)
    expect(workerData.result.success).toBe(true)
    expect(workerData.result.frameCount).toBeGreaterThanOrEqual(1)

    // Hard reload page to refresh assessment and render extracted frames gallery
    await page.reload()

    // =========================================================================
    // 8. Verify genuine extracted frames gallery in Chrome DOM
    // =========================================================================
    const gallery = page.getByTestId("frames-gallery")
    await expect(gallery).toBeVisible({ timeout: 15_000 })

    // Verify frames have sequence numbers, timestamps and SHA-256 hashes
    await expect(page.getByText(/Unenhanced Lossless PNGs/i)).toBeVisible()
    await expect(page.getByText(/F00 · 00:00/i)).toBeVisible()

    // =========================================================================
    // 9. Attach extracted frame F00 to checklist check C01 via browser UI
    // =========================================================================
    const attachBtns = gallery.getByRole("button", { name: "Attach" })
    await expect(attachBtns.first()).toBeVisible()
    await attachBtns.first().click()

    // Verify attach modal appears
    const attachModal = page.getByRole("dialog")
    await expect(attachModal).toBeVisible()
    await expect(attachModal.getByText(/Attach Frame F00/i)).toBeVisible()

    // Submit frame attachment
    const submitAttachBtn = attachModal.getByRole("button", { name: "Attach as Suggestion" })
    await Promise.all([
      page.waitForResponse((r) => r.url().includes("/attach") && r.status() === 201),
      submitAttachBtn.click(),
    ])

    // Verify modal closes and evidence is rendered in assessment checklist
    await expect(attachModal).not.toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/attached to check C01/i)).toBeVisible({ timeout: 10_000 })
    lifecycle("T11 frame-attached")

    // =========================================================================
    // 10. Verify PostgreSQL persistence & storage objects on disk
    // =========================================================================
    const framesInDb = await pool.query(
      `SELECT id, job_id, sequence_no, source_time_ms, sha256, width, height, is_reviewed_evidence
       FROM ${SCHEMA}.video_frames
       WHERE job_id = $1 ORDER BY sequence_no`,
      [intentData.jobId]
    )
    expect(framesInDb.rows.length).toBeGreaterThanOrEqual(1)
    expect(framesInDb.rows[0].width).toBe(320)
    expect(framesInDb.rows[0].height).toBe(240)
    expect(framesInDb.rows[0].is_reviewed_evidence).toBe(true)

    console.log(`Verified genuine upload & extraction: ${framesInDb.rows.length} frames registered in PostgreSQL for job ${intentData.jobId}.`)
    lifecycle("T12 assertions-complete", { frames: framesInDb.rows.length })
  })
})
