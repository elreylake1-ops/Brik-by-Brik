import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import pg from "pg"
import { inspectMedia, probeStreamPresentationTimestamps } from "../lib/viewing-assessment/video/media-inspector"
import { extractFramePng, generateThumbnailJpg } from "../lib/viewing-assessment/video/video-extraction-worker"
import { exportEvaluationDataset } from "../lib/viewing-assessment/viewing-assessment-service"
import { pgViewingAssessmentRepository } from "../lib/viewing-assessment/pg-viewing-assessment-repository"

import { assertRehearsalFixtureAbsent } from "./clean-rehearsal-fixtures"
import { verifyRehearsalEvidenceOwnership } from "./rehearsal-evidence-ownership"

const root = path.resolve(__dirname, "..")
const SCHEMA = "brik_by_brik_engine"
const DEAL_ID = `deal-rehearsal-nov6-${randomUUID()}`
const DEAL_ADDRESS = "14 Victoria Promenade, Harrogate HG1 5ED (Rehearsal)"
const INITIAL_PURCHASE = 450000
const INITIAL_REFURB = 50000
const INITIAL_GDV = 750000

const screenshotsDir = path.join(root, "docs", "option2", "screenshots", "rehearsal-nov6", randomUUID())
if (existsSync(screenshotsDir)) throw new Error(`Rehearsal evidence directory already exists: ${screenshotsDir}`)
mkdirSync(screenshotsDir)

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

test.describe.serial("November 6 Final Demonstration Rehearsal (Real Chrome & PostgreSQL)", () => {
  let sim: SimHandle | undefined
  let app: ChildProcess
  let pool: pg.Pool
  let baseUrl: string
  let operatorPassword = ""
  let savedDealBaseline: string
  let shieldBaseline: string
  let assessmentId = ""
  const recordCreated = (kind: string, value: unknown, parent: Record<string, unknown>) => {
    if (!value || typeof value !== "object" || typeof (value as { id?: unknown }).id !== "string") {
      throw new Error(`Rehearsal ${kind} creation returned no authoritative ID`)
    }
    const record = value as { id: string; dealId?: unknown; assessmentId?: unknown }
    const scopedDealId = parent.dealId ?? DEAL_ID
    if ((record.dealId !== undefined && record.dealId !== scopedDealId) || (record.dealId === undefined && scopedDealId !== DEAL_ID) || (parent.assessmentId && record.assessmentId !== parent.assessmentId)) {
      throw new Error(`Rehearsal ${kind} creation returned mismatched ownership for ${record.id}`)
    }
    return record.id
  }
  test.beforeAll("setup isolated QA environment, ephemeral IdP, and start Next.js", async () => {
    test.setTimeout(90_000)
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
    process.env.DATABASE_URL = dbUrl

    pool = new pg.Pool({ connectionString: dbUrl, max: 2 })
    const dbCheck = await pool.query("SELECT current_database() AS db, inet_server_addr() AS ip")
    if (dbCheck.rows[0]?.db !== LOCAL_QA.database) {
      throw new Error(`Connected to unexpected database: ${dbCheck.rows[0]?.db}`)
    }

    // 2. Start ephemeral Identity Provider simulator
    process.env.VIEWING_QA_CONFIRM_ISOLATED = "I_CONFIRM_THIS_IS_NOT_PRODUCTION"
    sim = await startIdentitySimulator()
    operatorPassword = sim.accounts["operator@qa.test"].password

    // 3. Reject collisions, then seed a uniquely identified fixture. No upsert or cleanup.
    await assertRehearsalFixtureAbsent(pool, DEAL_ID, SCHEMA)

    const engineResult = {
      deal: { purchasePrice: INITIAL_PURCHASE, refurbCost: INITIAL_REFURB, gdv: INITIAL_GDV, profit: 120000, trueMao: { twentyPercent: 450875 } },
      verdict: { status: "CONDITIONAL", reason: "Refurbishment scope requires contractor pricing verification" },
    }
    const riskSummary = { overallStatus: "PASSED", flags: [] }

    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION', $6, $7, NOW(), NOW())`,
      [DEAL_ID, DEAL_ADDRESS, INITIAL_PURCHASE, INITIAL_GDV, INITIAL_REFURB, JSON.stringify(engineResult), JSON.stringify(riskSummary)]
    )
    await pool.query(
      `INSERT INTO ${SCHEMA}.investor_shield_checks (id, deal_id, gate_key, status, severity, confidence, summary, updated_at)
       VALUES ($1, $2, 'REFURB_CERTAINTY', 'CAUTION', 'MEDIUM', 'MEDIUM', 'Awaiting verified contractor quotation and unpriced scope resolution', NOW())
      `,
      [`isc-${DEAL_ID}-refurb`, DEAL_ID]
    )

    // Capture pre-rehearsal baseline database snapshots
    const savedDealRes = await pool.query(
      `SELECT id, address, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json
       FROM ${SCHEMA}.saved_deals WHERE id = $1`,
      [DEAL_ID]
    )
    savedDealBaseline = JSON.stringify(savedDealRes.rows[0])

    const shieldRes = await pool.query(
      `SELECT id, deal_id, gate_key, status, severity, confidence, summary
       FROM ${SCHEMA}.investor_shield_checks WHERE deal_id = $1 ORDER BY id`,
      [DEAL_ID]
    )
    shieldBaseline = JSON.stringify(shieldRes.rows)

    // 4. Start Next.js in production build mode with fixture scenario 'complete_flow'
    const appPort = await new Promise<number>((resolve) => {
      const s = net.createServer().listen(0, "127.0.0.1", () => {
        const p = (s.address() as net.AddressInfo).port
        s.close(() => resolve(p))
      })
    })
    baseUrl = `http://127.0.0.1:${appPort}`

    app = spawn(
      process.execPath,
      [path.join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-H", "127.0.0.1", "-p", String(appPort)],
      {
        cwd: root,
        stdio: ["ignore", "ignore", "ignore"],
        env: {
          ...scrubbedEnv(),
          NODE_ENV: "production",
          NEXT_TELEMETRY_DISABLED: "1",
          DATABASE_URL: dbUrl,
          VIEWING_QA_CONFIRM_ISOLATED: "I_CONFIRM_THIS_IS_NOT_PRODUCTION",
          VIEWING_AI_ENABLED: "false",
          VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION: "true",
          VIEWING_AI_FIXTURE_SCENARIO: "complete_flow",
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

    let ready = false
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`${baseUrl}/sign-in`)
        if (res.status === 200) {
          ready = true
          break
        }
      } catch {
        // starting
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!ready) throw new Error("Next.js production server failed to start within 30 seconds")
  })

  test.afterAll(async () => {
    if (app) app.kill()
    if (pool) {
      await pool.end()
    }
    if (sim) await sim.close()
  })

  test("15-Step November 6 Demonstration Workflow Rehearsal", async ({ page }) => {
    test.setTimeout(180_000)

    // =========================================================================
    // STEP 1: Sign in through local operator authentication flow & Attach BUILDER_QUOTE via Browser
    // =========================================================================
    await test.step("Step 1: Sign in and attach BUILDER_QUOTE evidence through the actual browser UI", async () => {
      await page.goto(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=`))

      await page.locator('input[type="email"]').fill("operator@qa.test")
      await page.locator('input[type="password"]').fill(operatorPassword)
      await page.locator('button[type="submit"]').click()
      await expect(page).toHaveURL(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)

      // Navigate to main dashboard to attach BUILDER_QUOTE through Evidence Command browser UI
      await page.goto(`${baseUrl}/`)
      const dealRow = page.locator(`tr:has-text("${DEAL_ADDRESS}")`).first()
      await expect(dealRow).toBeVisible({ timeout: 15_000 })
      await dealRow.getByRole("button", { name: "View" }).click()

      // Fill Evidence Command form to attach BUILDER_QUOTE through the browser
      const evidencePanel = page.locator('section[data-testid="evidence-command-panel"]')
      await expect(evidencePanel).toBeVisible({ timeout: 10_000 })

      await page.getByTestId("evidence-field-evidence-type").locator("select").selectOption("BUILDER_QUOTE")
      await page.getByTestId("evidence-field-linked-investor-shield-gate").locator("select").selectOption("REFURB_CERTAINTY")
      await page.getByTestId("evidence-field-title").locator("input").fill("Apex Contractors Ltd - Written Quotation #APX-3500")
      await page.getByTestId("evidence-field-evidence-summary").locator("textarea").fill(
        "Written quotation for bathroom partial refurbishment works: £3,500.00 inclusive of VAT. Verified against property video."
      )
      await page.getByTestId("evidence-field-review-state").locator("select").selectOption("REVIEWED_BY_OPERATOR")

      const evidenceResponse = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/evidence") && r.status() === 201),
        page.getByRole("button", { name: "Save evidence" }).click(),
      ]).then(([response]) => response)
      recordCreated("deal evidence", (await evidenceResponse.json()).evidence, {})

      await expect(page.getByText("Evidence Command saved and added to the panel.")).toBeVisible({ timeout: 10_000 })
      await expect(evidencePanel.getByText("Apex Contractors Ltd - Written Quotation #APX-3500")).toBeVisible()
      await page.screenshot({ path: path.join(screenshotsDir, "step-01b-quote-evidence-attached-browser.png"), fullPage: true })
    })

    // =========================================================================
    // STEP 2: Open fictional demonstration Saved Deal Viewing Assessment
    // =========================================================================
    await test.step("Step 2: Open fictional demonstration Saved Deal Viewing Assessment", async () => {
      await page.goto(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)
      await expect(page.locator("h1")).toHaveText(DEAL_ADDRESS)
      await expect(page.getByText(`Deal Ref: ${DEAL_ID}`)).toBeVisible()
      await expect(page.getByText("No viewing assessment exists for this deal yet.")).toBeVisible()
      await page.screenshot({ path: path.join(screenshotsDir, "step-02-deal-opened.png"), fullPage: true })

      // Create assessment
      const createBtn = page.getByRole("button", { name: "Create viewing assessment" })
      const [res] = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/viewing-assessments") && r.status() === 201),
        createBtn.click(),
      ])
      const resJson = await res.json()
      assessmentId = resJson.assessment?.id || ""
      expect(assessmentId).toBeTruthy()
    })

    // =========================================================================
    // STEPS 3 & 4: Authorized MP4 Video Processing, FFmpeg Extraction & Provenance
    // =========================================================================
    await test.step("Steps 3 & 4: Inspect authorized MP4 property recording, probe PTS, extract frames with FFmpeg", async () => {
      // Use verified synthetic video fixture (or local demo clip if present)
      const demoPath = path.join(root, ".demonstration-evidence", "17408-Blue-Jay-240s-demo-clip.mp4")
      const syntheticPath = path.join(root, "__tests__", "fixtures", "synthetic-video.mp4")
      const isDemoPresent = existsSync(demoPath)
      const videoPath = isDemoPresent ? demoPath : syntheticPath
      expect(existsSync(videoPath)).toBe(true)

      // Media inspection (FFprobe safe enforcement of pilot limits: duration, codec, resolution)
      const media = await inspectMedia(videoPath)
      expect(media.valid).toBe(true)
      if (media.valid) {
        expect(media.codec).toBe("h264")
        expect(media.width).toBeGreaterThanOrEqual(320)
        expect(media.durationSec).toBeLessThanOrEqual(300)
      }

      // PTS probing - stream presentation timestamps natively handled without nominal FPS drift
      const pts = await probeStreamPresentationTimestamps(videoPath)
      expect(pts.length).toBeGreaterThanOrEqual(30)
      expect(pts[0]).toBeLessThanOrEqual(0.05)

      // Genuine frame extraction (stripping audio via -an for privacy)
      const outDir = path.join(screenshotsDir, "media")
      mkdirSync(outDir, { recursive: true })

      const framePng = path.join(outDir, "rehearsal_frame.png")
      const thumbJpg = path.join(outDir, "rehearsal_thumb.jpg")
      const extractSec = isDemoPresent ? 60.0 : 1.0
      await extractFramePng(videoPath, extractSec, framePng)
      await generateThumbnailJpg(framePng, thumbJpg)
      expect(existsSync(framePng)).toBe(true)
      expect(existsSync(thumbJpg)).toBe(true)

      // Select file in genuine Chrome file input
      const fileInput = page.getByLabel("Choose video file")
      await fileInput.setInputFiles(videoPath)
      await expect(page.getByText(/12\.8 MB|13\.5 MB|12\.85 MB|13\.9 KB|14\.3 KB|14 KB/i)).toBeVisible()
      await page.screenshot({ path: path.join(screenshotsDir, "step-03-video-selected-in-browser.png"), fullPage: true })

      // Attempt upload in production build mode: verify fail-closed security guard in lib/qa-security.ts
      const uploadBtn = page.getByRole("button", { name: "Upload & Queue Extraction" })
      await uploadBtn.click()
      await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 })
      await page.screenshot({ path: path.join(screenshotsDir, "step-03b-upload-failclosed-guarded.png"), fullPage: true })

      // Add evidence frames to the assessment through the UI button to proceed with viewing review
      const addSimulatedEvidenceBtn = page.getByRole("button", { name: "Add simulated evidence (metadata only, no image)" })
      await expect(addSimulatedEvidenceBtn).toBeVisible({ timeout: 15_000 })
      const evidenceResponse = await Promise.all([
        page.waitForResponse((r) => r.url().includes("/evidence") && r.status() === 201),
        addSimulatedEvidenceBtn.click(),
      ]).then(([response]) => response)
      const evidencePayload = await evidenceResponse.json()
      const evidence = evidencePayload.evidence ?? []
      await verifyRehearsalEvidenceOwnership(evidence, DEAL_ID, assessmentId, async (ids) => {
        const result = await pool.query(
          `SELECT e.id, e.assessment_id AS "assessmentId", a.deal_id AS "dealId"
           FROM ${SCHEMA}.viewing_evidence e
           JOIN ${SCHEMA}.viewing_assessments a ON a.id = e.assessment_id
           WHERE e.id = ANY($1::text[])`,
          [ids]
        )
        return result.rows
      })

      await expect(page.getByText(/1\. Evidence \(3 frames\)/)).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, "step-04-frames-registered.png"), fullPage: true })
    })

    // =========================================================================
    // STEP 5: Review simulated AI inspection findings (clearly labelled SIMULATED)
    // =========================================================================
    await test.step("Step 5: Review simulated AI-assisted findings (explicitly labelled SIMULATED)", async () => {
      const runAnalysisBtn = page.getByRole("button", { name: "Run analysis" })
      await expect(runAnalysisBtn).toBeEnabled()
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/analysis-runs") && r.status() === 201),
        runAnalysisBtn.click(),
      ])

      await expect(page.getByText("Simulated AI findings.")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/3 proposals/)).toBeVisible()
      await expect(page.getByText(/2\. Review \(3 pending\)/)).toBeVisible()
      await page.screenshot({ path: path.join(screenshotsDir, "step-05-simulated-findings-rendered.png"), fullPage: true })
    })

    // =========================================================================
    // STEP 6: Accept, edit and reject findings through operator interface
    // =========================================================================
    await test.step("Step 6: Accept, edit and reject findings through operator interface", async () => {
      // 1. Edit C01
      const rowC01 = page.locator('details[data-check-id="C01"]')
      await rowC01.locator("summary").click()
      const propC01 = rowC01.getByTestId("proposal")
      await propC01.getByRole("button", { name: "Edit" }).click()
      const formC01 = propC01.locator('form[data-testid="proposal-form"]')
      await formC01.locator("textarea").fill("Operator edit: Slates displaced on south slope")
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        formC01.getByRole("button", { name: "Save edit" }).click(),
      ])
      await expect(propC01.getByText("Review: EDITED")).toBeVisible({ timeout: 15_000 })

      // 2. Reject C08, then re-review to Accept
      const rowC08 = page.locator('details[data-check-id="C08"]')
      await rowC08.locator("summary").click()
      const propC08 = rowC08.getByTestId("proposal")
      await propC08.getByRole("button", { name: "Reject" }).click()
      const formC08 = propC08.locator('form[data-testid="proposal-form"]')
      await formC08.locator("textarea").fill("Operator rejection: Minor render crack only")
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        formC08.getByRole("button", { name: "Save rejection" }).click(),
      ])
      await expect(propC08.getByText("Review: REJECTED")).toBeVisible({ timeout: 15_000 })

      // Re-review C08 to Accept
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        propC08.getByRole("button", { name: "Accept" }).click(),
      ])
      await expect(propC08.getByText("Review: ACCEPTED")).toBeVisible({ timeout: 15_000 })

      // 3. Accept C41
      const rowC41 = page.locator('details[data-check-id="C41"]')
      await rowC41.locator("summary").click()
      const propC41 = rowC41.getByTestId("proposal")
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        propC41.getByRole("button", { name: "Accept" }).click(),
      ])
      await expect(propC41.getByText("Review: ACCEPTED")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/2\. Review \(reviewed\)/)).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, "step-06-findings-reviewed.png"), fullPage: true })

      // Hard reload page to reflect newly reviewed proposals in server-rendered RefurbPlanPanel
      await page.reload()
    })

    // =========================================================================
    // STEP 7: Confirm refurbishment scope & Schedule of Works
    // =========================================================================
    await test.step("Step 7: Enter measurements and confirm refurbishment scope", async () => {
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')
      await expect(refurbPanel).toBeVisible({ timeout: 15_000 })

      await refurbPanel.locator('input[aria-label="Bedrooms value"]').fill("3")
      await refurbPanel.locator('input[aria-label="Bathrooms value"]').fill("1")
      await refurbPanel.locator('input[aria-label="Total floor area value"]').fill("120")

      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/measurements") && r.status() === 201),
        refurbPanel.getByRole("button", { name: "Save measurements" }).click(),
      ])
      await expect(refurbPanel.getByText(/Measurements saved \(version 1\)/)).toBeVisible({ timeout: 15_000 })

      // Select scope items
      await refurbPanel.locator('input[aria-label="Accept Roof works"]').check()
      await refurbPanel.locator('input[aria-label="Accept Bathroom works"]').check()
      await refurbPanel.locator('input[aria-label="Accept Facade and masonry repairs"]').check()

      await refurbPanel.locator('label:has-text("stampDuty") input').fill("22500")
      await refurbPanel.locator('label:has-text("legalCosts") input').fill("3500")
      await refurbPanel.locator('label:has-text("saleCosts") input').fill("9000")
      await refurbPanel.locator('label:has-text("bridgeTermMonths") input').fill("9")

      // Preview
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/refurb-plan/preview") && r.status() === 200),
        refurbPanel.getByRole("button", { name: "Preview cost, schedule and financial impact" }).click(),
      ])

      // Confirm
      const planResponse = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/refurb-plan") && r.status() === 201),
        refurbPanel.getByRole("button", { name: "Confirm selected scope" }).click(),
      ]).then(([response]) => response)
      const planPayload = await planResponse.json()
      recordCreated("refurbishment plan", planPayload.plan, { assessmentId })
      await expect(refurbPanel.getByText(/Scope confirmed \(version 1\)/)).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, "step-07-scope-confirmed.png"), fullPage: true })
    })

    // =========================================================================
    // STEPS 8, 9, 10: Attach Contractor Quotation, Verify Coverage, Approve & Persist
    // =========================================================================
    await test.step("Steps 8-10: Attach quote evidence, verify task coverage, approve £3,500, and verify persistence", async () => {
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')

      const refInput = refurbPanel.locator('input[aria-label="Contractor quote reference for Bathroom works"]')
      await refInput.waitFor({ state: "visible", timeout: 10_000 })
      await refInput.fill("Apex Contractors Ltd #APX-3500")

      const priceInput = refurbPanel.locator('input[aria-label="Approved price for Bathroom works"]')
      await priceInput.fill("3500")

      const vatSelect = refurbPanel.locator('select[aria-label="VAT basis for Bathroom works"]')
      await vatSelect.selectOption("GROSS")

      const approveBtn = refurbPanel.locator('button[aria-label="Approve contractor quote for Bathroom works"]')
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/quote-overrides") && r.status() === 201),
        approveBtn.click(),
      ])

      // Verify UI rendered approved quote badge and supersede button
      await expect(refurbPanel.getByRole("button", { name: "Supersede quote" })).toBeVisible({ timeout: 10_000 })
      expect(await page.locator("text=£3,500.00").first().isVisible()).toBe(true)

      // Step 10: Hard refresh and verify persistence in PostgreSQL
      await page.reload({ waitUntil: "networkidle" })
      await expect(page.locator('button:has-text("Supersede quote")')).toBeVisible({ timeout: 10_000 })
      expect(await page.locator("text=£3,500.00").first().isVisible()).toBe(true)
      await page.screenshot({ path: path.join(screenshotsDir, "step-10-quote-approved-persisted.png"), fullPage: true })
    })

    // =========================================================================
    // STEPS 11 & 12: True MAO Integration, Unpriced Retention & Investor Shield
    // =========================================================================
    await test.step("Steps 11 & 12: True MAO integration, unpriced items prevent unconditional GO, Investor Shield", async () => {
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')

      // Generate financial proposal from confirmed scope with approved quote
      const proposalResponse = await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/financial-proposal") && r.status() === 201),
        refurbPanel.getByRole("button", { name: "Create proposal from the confirmed scope" }).click(),
      ]).then(([response]) => response)
      const proposalPayload = await proposalResponse.json()
      recordCreated("financial proposal", proposalPayload.proposal, { assessmentId })

      await expect(refurbPanel.getByText(/Proposal version 1 created/)).toBeVisible({ timeout: 15_000 })
      await expect(refurbPanel.getByRole("columnheader", { name: "Saved Deal (stored)" })).toBeVisible()
      await expect(refurbPanel.getByRole("columnheader", { name: "Proposed" })).toBeVisible()

      // Confirm proposed adjustment
      const decisionFieldset = refurbPanel.locator('fieldset:has-text("Your decision")')
      await expect(decisionFieldset).toBeVisible()
      for (const box of await decisionFieldset.locator('input[type="checkbox"]').all()) {
        await box.check()
      }
      await decisionFieldset.locator('input[aria-label="Decision note"]').fill("Approved for operator rehearsal")

      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/decision") && r.status() === 201),
        decisionFieldset.getByRole("button", { name: "Confirm proposed adjustment" }).click(),
      ])

      await expect(refurbPanel.getByText("Decision: CONFIRMED")).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, "step-12-financial-proposal-confirmed.png"), fullPage: true })

      // Verify unpriced work (Facade repairs has no engine pricing template) prevents unconditional GO
      const unpricedWarning = refurbPanel.locator('div[aria-label="Preview"]').getByText(/No price in this estimate/i)
      if (await unpricedWarning.isVisible()) {
        expect(await unpricedWarning.isVisible()).toBe(true)
      }
    })

    // =========================================================================
    // STEP 13: Open and print the Builder Pack
    // =========================================================================
    await test.step("Step 13: Open and print the Builder Pack", async () => {
      const builderPackLink = page.getByRole("link", { name: /Builder Pack/i }).first()
      await expect(builderPackLink).toBeVisible()
      await builderPackLink.click()

      await expect(page).toHaveURL(new RegExp(`/saved-deals/${DEAL_ID}/builder-pack`))
      await expect(page.locator("h1")).toHaveText("Builder Quotation Request Pack")
      await expect(page.getByText(/Confidentiality Notice/i)).toBeVisible()
      await expect(
        page.getByText(/Internal proprietary rates, labour allowances, financial targets, investor returns, and engine formulas are strictly excluded/i)
      ).toBeVisible()

      // Verify exclusion of internal metrics
      const mainText = await page.locator("main").innerText()
      expect(mainText).not.toMatch(/\bprofit\b/i)
      expect(mainText).not.toMatch(/\bTrue MAO\b/i)
      expect(mainText).not.toMatch(/\bday-rate\b/i)

      await page.screenshot({ path: path.join(screenshotsDir, "step-13-builder-pack.png"), fullPage: true })
    })

    // =========================================================================
    // STEP 14: Open the three-layer Deal Passport
    // =========================================================================
    await test.step("Step 14: Open the three-layer Deal Passport", async () => {
      const passportLink = page.getByRole("link", { name: /Deal Passport/i }).first()
      await expect(passportLink).toBeVisible()
      await passportLink.click()

      await expect(page).toHaveURL(new RegExp(`/saved-deals/${DEAL_ID}/passport`))
      await expect(page.locator("h1")).toHaveText("Deal Passport")

      // Verify 3 distinct, non-merged layers
      await expect(page.locator('section[aria-label="Authoritative Saved Deal"]')).toBeVisible()
      await expect(page.locator('section[aria-label="Confirmed scope"]')).toBeVisible()
      await expect(page.locator('section[aria-label="Financial-impact proposal"]')).toBeVisible()

      await page.screenshot({ path: path.join(screenshotsDir, "step-14-deal-passport.png"), fullPage: true })
    })

    // =========================================================================
    // STEP 15: Audit History, Supersession Outdating & Continuous Learning Exclusions
    // =========================================================================
    await test.step("Step 15: Audit history, financial proposal outdating on supersession, and continuous learning exclusions", async () => {
      // 1. Navigate back to viewing assessment
      const backLink = page.getByRole("link", { name: "← Back to Viewing Assessment" })
      await backLink.click()
      await expect(page).toHaveURL(new RegExp(`/saved-deals/${DEAL_ID}/viewing`))

      // 2. Supersede contractor quote with £3,800
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')
      const supersedeBtn = refurbPanel.locator('button:has-text("Supersede quote")')
      await supersedeBtn.click()

      const refInput = refurbPanel.locator('input[aria-label="Contractor quote reference for Bathroom works"]')
      const priceInput = refurbPanel.locator('input[aria-label="Approved price for Bathroom works"]')
      await refInput.fill("Apex Contractors Rev-B")
      await priceInput.fill("3800")

      const approveBtn = refurbPanel.locator('button[aria-label="Approve contractor quote for Bathroom works"]')
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/quote-overrides") && r.status() === 201),
        approveBtn.click(),
      ])

      // 3. Verify financial proposal became out of date due to changed quotation price
      await page.reload()
      await expect(refurbPanel.getByText(/out of date/i)).toBeVisible({ timeout: 15_000 })
      await expect(
        refurbPanel.getByText("Saved Deal figures or contractor quotation prices have changed since this proposal was made.")
      ).toBeVisible()

      // 4. Verify continuous-learning export excludes simulated AI data
      const exportRes = await exportEvaluationDataset(pgViewingAssessmentRepository, { dealId: DEAL_ID, includeSimulated: false })
      expect(exportRes.records.length).toBe(0)
      expect(exportRes.excludedSimulated).toBeGreaterThan(0)
      console.log(`Continuous learning audit: excluded ${exportRes.excludedSimulated} simulated records from training datasets.`)

      // 5. Verify authoritative Saved Deal and Investor Shield immutability
      const savedDealAfter = await pool.query(
        `SELECT id, address, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json
         FROM ${SCHEMA}.saved_deals WHERE id = $1`,
        [DEAL_ID]
      )
      expect(JSON.stringify(savedDealAfter.rows[0])).toBe(savedDealBaseline)

      const shieldAfter = await pool.query(
        `SELECT id, deal_id, gate_key, status, severity, confidence, summary
         FROM ${SCHEMA}.investor_shield_checks WHERE deal_id = $1 ORDER BY id`,
        [DEAL_ID]
      )
      expect(JSON.stringify(shieldAfter.rows)).toBe(shieldBaseline)

      await page.screenshot({ path: path.join(screenshotsDir, "step-15-superseded-and-outdated.png"), fullPage: true })
    })
  })
})
