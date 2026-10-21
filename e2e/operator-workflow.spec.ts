import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import pg from "pg"

const root = path.resolve(__dirname, "..")
const SCHEMA = "brik_by_brik_engine"
const DEAL_ID = "deal-walkthrough-playwright-1"
const DEAL_ADDRESS = "QA Rehearsal 42 Victoria Way, Leeds"
const INITIAL_PURCHASE = 140000
const INITIAL_REFURB = 20000
const INITIAL_GDV = 225000

const screenshotsDir = path.join(root, "docs", "option2", "screenshots")
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

test.describe.serial("Viewing Assessment Complete Operator Walkthrough", () => {
  let sim: SimHandle | undefined
  let app: ChildProcess
  let pool: pg.Pool
  let baseUrl: string
  let operatorPassword = ""
  let savedDealBaseline: string
  let shieldBaseline: string

  test.beforeAll("setup isolated QA environment and start Next.js", async () => {
    test.setTimeout(60_000)
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

    // 2. Start ephemeral Identity Provider simulator
    process.env.VIEWING_QA_CONFIRM_ISOLATED = "I_CONFIRM_THIS_IS_NOT_PRODUCTION"
    sim = await startIdentitySimulator()
    operatorPassword = sim.accounts["operator@qa.test"].password

    // 3. Clean any existing walkthrough fixtures & seed isolated test deal
    await pool.query(`DELETE FROM ${SCHEMA}.investor_shield_checks WHERE deal_id = $1`, [DEAL_ID])
    await pool.query(`DELETE FROM ${SCHEMA}.saved_deals WHERE id = $1`, [DEAL_ID])
    await pool.query(`DELETE FROM ${SCHEMA}.operator_sessions WHERE subject LIKE 'sim-%'`)

    const engineResult = {
      deal: { purchasePrice: INITIAL_PURCHASE, refurbCost: INITIAL_REFURB, gdv: INITIAL_GDV, profit: 45000 },
      verdict: { status: "GO" },
    }
    const riskSummary = { overallStatus: "PASSED" }

    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'STRONG_DEAL', 'GO', 'PROTECTED', 'UNDER_ANALYSIS', $6, $7, NOW(), NOW())`,
      [DEAL_ID, DEAL_ADDRESS, INITIAL_PURCHASE, INITIAL_GDV, INITIAL_REFURB, JSON.stringify(engineResult), JSON.stringify(riskSummary)]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.investor_shield_checks (id, deal_id, gate_key, status, severity, confidence, summary, updated_at)
       VALUES ($1, $2, 'FLOOD_RISK', 'PASSED', 'LOW', 'HIGH', 'Zone 1 low probability', NOW())
       ON CONFLICT (id) DO UPDATE SET status = 'PASSED'`,
      [`isc-${DEAL_ID}-flood`, DEAL_ID]
    )

    // Capture pre-walkthrough baseline database snapshots
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
      await pool.query(`DELETE FROM ${SCHEMA}.investor_shield_checks WHERE deal_id = $1`, [DEAL_ID])
      await pool.query(`DELETE FROM ${SCHEMA}.operator_sessions WHERE subject LIKE 'sim-%'`)
      await pool.query(`DELETE FROM ${SCHEMA}.saved_deals WHERE id = $1`, [DEAL_ID])
      await pool.end()
    }
    if (sim) await sim.close()
  })

  test("16-stage operator viewing assessment journey", async ({ page }, testInfo) => {
    test.setTimeout(120_000)
    const isMobile = testInfo.project.name.includes("mobile")
    const deviceTag = isMobile ? "mobile" : "desktop"

    // Stage 1: Unauthenticated visit redirects to sign-in
    await test.step("Stage 1: Operator authentication via sign-in page", async () => {
      await page.goto(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)
      await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=`))

      await page.locator('input[type="email"]').fill("operator@qa.test")
      await page.locator('input[type="password"]').fill(operatorPassword)
      await page.locator('button[type="submit"]').click()
    })

    // Stages 2-3: Land on Saved Deal Viewing Assessment page
    await test.step("Stages 2-3: Saved-deal navigation and viewing assessment opening", async () => {
      await expect(page).toHaveURL(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)
      await expect(page.locator("h1")).toHaveText(DEAL_ADDRESS)
      await expect(page.getByText(`Deal Ref: ${DEAL_ID}`)).toBeVisible()
      await expect(page.getByText("No viewing assessment exists for this deal yet.")).toBeVisible()

      if (isMobile) {
        // Confirm viewport is mobile width and navigation links remain accessible
        const viewport = page.viewportSize()
        expect(viewport?.width).toBeLessThanOrEqual(500)
      }
    })

    // Stage 4: Create viewing assessment
    await test.step("Stage 4: Create viewing assessment", async () => {
      const createBtn = page.getByRole("button", { name: "Create viewing assessment" })
      await expect(createBtn).toBeVisible()
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/viewing-assessments") && r.status() === 201),
        createBtn.click(),
      ])

      await expect(page.getByRole("button", { name: "Add simulated evidence (metadata only, no image)" })).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-01-assessment-created-${deviceTag}.png`), fullPage: true })
    })

    // Stages 5-6: Register simulated evidence and inspect thumbnails
    await test.step("Stages 5-6: Register simulated evidence and inspect thumbnails", async () => {
      const addEvidenceBtn = page.getByRole("button", { name: "Add simulated evidence (metadata only, no image)" })
      await expect(addEvidenceBtn).toBeVisible()
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/evidence") && r.status() === 201),
        addEvidenceBtn.click(),
      ])

      await expect(page.getByText(/1\. Evidence \(3 frames\)/)).toBeVisible({ timeout: 15_000 })
      const evidenceSummary = page.locator("summary", { hasText: "Evidence frames (3;" })
      await expect(evidenceSummary).toBeVisible()
      await evidenceSummary.click()
      await expect(page.getByTestId("evidence-list")).toBeVisible()
      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-02-evidence-registered-${deviceTag}.png`), fullPage: true })
    })

    // Stage 7: Run analysis
    await test.step("Stage 7: Execute fixture AI analysis", async () => {
      const runAnalysisBtn = page.getByRole("button", { name: "Run analysis" })
      await expect(runAnalysisBtn).toBeEnabled()
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/analysis-runs") && r.status() === 201),
        runAnalysisBtn.click(),
      ])

      await expect(page.getByTestId("runs")).toBeVisible({ timeout: 15_000 })
      await expect(page.getByText(/Run READY_FOR_REVIEW/)).toBeVisible()
      await expect(page.getByText(/3 proposals/)).toBeVisible()
      await expect(page.getByText(/2\. Review \(3 pending\)/)).toBeVisible()
    })

    // Stage 8: Human review (Correction on C01, Rejection & Re-review on C08, Acceptance on C41)
    await test.step("Stage 8: Human review (Acceptance, Correction, and Rejection of findings)", async () => {
      // 1. Proposal C01: Human correction (Edit)
      const rowC01 = page.locator('details[data-check-id="C01"]')
      await rowC01.locator("summary").click()
      const propC01 = rowC01.getByTestId("proposal")
      await expect(propC01).toBeVisible()

      await propC01.getByRole("button", { name: "Edit" }).click()
      const formC01 = propC01.locator('form[data-testid="proposal-form"]')
      await expect(formC01).toBeVisible()
      await formC01.locator("textarea").fill("Operator correction: Minor tile displacement on north pitch")
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        formC01.getByRole("button", { name: "Save edit" }).click(),
      ])
      await expect(propC01.getByText("Review: EDITED")).toBeVisible({ timeout: 15_000 })
      await expect(propC01.getByTestId("reviewer-correction")).toBeVisible()
      await expect(propC01.getByTestId("review-history")).toContainText("Rev 1: EDITED")

      // 2. Proposal C08: Human rejection (Reject) followed by Re-review (Accept)
      const rowC08 = page.locator('details[data-check-id="C08"]')
      await rowC08.locator("summary").click()
      const propC08 = rowC08.getByTestId("proposal")
      await expect(propC08).toBeVisible()

      await propC08.getByRole("button", { name: "Reject" }).click()
      const formC08 = propC08.locator('form[data-testid="proposal-form"]')
      await expect(formC08).toBeVisible()
      await formC08.locator("textarea").fill("Operator rejection: Cosmetic hairline crack in render only")
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        formC08.getByRole("button", { name: "Save rejection" }).click(),
      ])
      await expect(propC08.getByText("Review: REJECTED")).toBeVisible({ timeout: 15_000 })
      await expect(propC08.getByTestId("review-history")).toContainText("Rev 1: REJECTED")

      // Now re-review C08 to Accept so facade masonry repairs are included in scope
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        propC08.getByRole("button", { name: "Accept" }).click(),
      ])
      await expect(propC08.getByText("Review: ACCEPTED")).toBeVisible({ timeout: 15_000 })
      await expect(propC08.getByTestId("review-history")).toContainText("Rev 2: ACCEPTED")

      // 3. Proposal C41: Human acceptance (Accept)
      const rowC41 = page.locator('details[data-check-id="C41"]')
      await rowC41.locator("summary").click()
      const propC41 = rowC41.getByTestId("proposal")
      await expect(propC41).toBeVisible()
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/review") && r.status() === 201),
        propC41.getByRole("button", { name: "Accept" }).click(),
      ])
      await expect(propC41.getByText("Review: ACCEPTED")).toBeVisible({ timeout: 15_000 })
      await expect(propC41.getByTestId("review-history")).toContainText("Rev 1: ACCEPTED")

      await expect(page.getByText(/2\. Review \(reviewed\)/)).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-03-findings-reviewed-${deviceTag}.png`), fullPage: true })

      // Reload page to reflect newly reviewed proposals in server-rendered RefurbPlanPanel
      await page.reload()
    })

    // Stages 9-10: Refurbishment work mapping and operator measurement entry
    await test.step("Stages 9-10: Refurbishment work mapping and operator measurement entry", async () => {
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')
      await expect(refurbPanel).toBeVisible({ timeout: 15_000 })

      await expect(refurbPanel.getByText("Roof works", { exact: true })).toBeVisible()
      await expect(refurbPanel.getByText("Bathroom works", { exact: true })).toBeVisible()
      await expect(refurbPanel.getByText("Facade and masonry repairs", { exact: true })).toBeVisible()

      await refurbPanel.locator('input[aria-label="Bedrooms value"]').fill("3")
      await refurbPanel.locator('input[aria-label="Bathrooms value"]').fill("1")
      await refurbPanel.locator('input[aria-label="Total floor area value"]').fill("85")

      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/measurements") && r.status() === 201),
        refurbPanel.getByRole("button", { name: "Save measurements" }).click(),
      ])

      await expect(refurbPanel.getByText(/Measurements saved \(version 1\)/)).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-04-measurements-saved-${deviceTag}.png`), fullPage: true })
    })

    // Stage 11: Scope preview and confirmation
    await test.step("Stage 11: Scope preview and confirmation", async () => {
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')

      await refurbPanel.locator('input[aria-label="Accept Roof works"]').check()
      await refurbPanel.locator('input[aria-label="Accept Bathroom works"]').check()
      await refurbPanel.locator('input[aria-label="Accept Facade and masonry repairs"]').check()

      await refurbPanel.locator('label:has-text("stampDuty") input').fill("3000")
      await refurbPanel.locator('label:has-text("legalCosts") input').fill("1500")
      await refurbPanel.locator('label:has-text("saleCosts") input').fill("3000")
      await refurbPanel.locator('label:has-text("bridgeTermMonths") input').fill("9")

      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/refurb-plan/preview") && r.status() === 200),
        refurbPanel.getByRole("button", { name: "Preview cost, schedule and financial impact" }).click(),
      ])

      const previewSection = refurbPanel.locator('div[aria-label="Preview"]')
      await expect(previewSection).toBeVisible()
      await expect(previewSection.getByText(/^Estimate:/)).toBeVisible()
      await expect(previewSection.getByText(/No price in this estimate/i)).toBeVisible()

      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/refurb-plan") && r.status() === 201),
        refurbPanel.getByRole("button", { name: "Confirm selected scope" }).click(),
      ])

      await expect(refurbPanel.getByText(/Scope confirmed \(version 1\)/)).toBeVisible({ timeout: 15_000 })
      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-05-scope-confirmed-${deviceTag}.png`), fullPage: true })
    })

    // Stages 12-13: Financial proposal generation and explicit decision
    await test.step("Stages 12-13: Financial proposal generation and explicit decision", async () => {
      const refurbPanel = page.locator('section[aria-label="Refurbishment scope"]')

      await Promise.all([
        page.waitForResponse((r) => r.url().endsWith("/financial-proposal") && r.status() === 201),
        refurbPanel.getByRole("button", { name: "Create proposal from the confirmed scope" }).click(),
      ])

      await expect(refurbPanel.getByText(/Proposal version 1 created/)).toBeVisible({ timeout: 15_000 })
      await expect(refurbPanel.locator("table")).toBeVisible()
      await expect(refurbPanel.getByRole("columnheader", { name: "Saved Deal (stored)" })).toBeVisible()
      await expect(refurbPanel.getByRole("columnheader", { name: "Proposed" })).toBeVisible()

      const decisionFieldset = refurbPanel.locator('fieldset:has-text("Your decision")')
      await expect(decisionFieldset).toBeVisible()

      for (const box of await decisionFieldset.locator('input[type="checkbox"]').all()) {
        await box.check()
      }

      await decisionFieldset.locator('input[aria-label="Decision note"]').fill("Approved by QA operator for contractor benchmark")

      const confirmBtn = decisionFieldset.getByRole("button", { name: "Confirm proposed adjustment" })
      await expect(confirmBtn).toBeEnabled()
      await Promise.all([
        page.waitForResponse((r) => r.url().includes("/decision") && r.status() === 201),
        confirmBtn.click(),
      ])

      await expect(refurbPanel.getByText("Decision: CONFIRMED")).toBeVisible({ timeout: 15_000 })
      await expect(refurbPanel.getByText(/Proposed adjustment approved\. The Saved Deal figures were not changed\./)).toBeVisible()
      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-06-financial-proposal-decided-${deviceTag}.png`), fullPage: true })
    })

    // Stage 14: Builder Quotation Pack presentation
    await test.step("Stage 14: Builder Quotation Pack presentation", async () => {
      const builderPackLink = page.getByRole("link", { name: /Builder Pack/i }).first()
      await expect(builderPackLink).toBeVisible()
      await builderPackLink.click()

      await expect(page).toHaveURL(new RegExp(`/saved-deals/${DEAL_ID}/builder-pack`))
      await expect(page.locator("h1")).toHaveText("Builder Quotation Request Pack")
      await expect(page.getByText(/DRAFT/i).first()).toBeVisible()
      await expect(page.getByText(/Confidentiality Notice/i)).toBeVisible()
      await expect(
        page.getByText(/Internal proprietary rates, labour allowances, financial targets, investor returns, and engine formulas are strictly excluded/i)
      ).toBeVisible()

      const pageText = await page.locator("main").innerText()
      expect(pageText).not.toMatch(/\bprofit\b/i)
      expect(pageText).not.toMatch(/\bMAO\b/i)
      expect(pageText).not.toMatch(/\bGDV\b/i)
      expect(pageText).not.toMatch(/\bday-rate\b/i)

      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-07-builder-pack-${deviceTag}.png`), fullPage: true })
    })

    // Stage 15: Deal Passport three-layer presentation
    await test.step("Stage 15: Deal Passport three-layer presentation", async () => {
      const passportLink = page.getByRole("link", { name: /Deal Passport/i }).first()
      await expect(passportLink).toBeVisible()
      await passportLink.click()

      await expect(page).toHaveURL(new RegExp(`/saved-deals/${DEAL_ID}/passport`))
      await expect(page.locator("h1")).toHaveText("Deal Passport")
      await expect(page.getByText(/DRAFT/i).first()).toBeVisible()

      // Verify the three distinct, non-merged layers are present
      await expect(page.locator('section[aria-label="Authoritative Saved Deal"]')).toBeVisible()
      await expect(page.locator('section[aria-label="Confirmed scope"]')).toBeVisible()
      await expect(page.locator('section[aria-label="Financial-impact proposal"]')).toBeVisible()

      await page.screenshot({ path: path.join(screenshotsDir, `task-9b-08-deal-passport-${deviceTag}.png`), fullPage: true })
    })

    // Stage 16: Navigation, refresh, and state consistency
    await test.step("Stage 16: Navigation, refresh, and state consistency", async () => {
      await page.reload()
      await expect(page.locator("h1")).toHaveText("Deal Passport")
      await expect(page.locator('section[aria-label="Confirmed scope"]')).toBeVisible()

      const backToViewing = page.getByRole("link", { name: "← Back to Viewing Assessment" })
      await backToViewing.click()

      await expect(page).toHaveURL(new RegExp(`/saved-deals/${DEAL_ID}/viewing`))
      await expect(page.locator("h1")).toHaveText(DEAL_ADDRESS)
      await expect(page.getByText("Decision: CONFIRMED")).toBeVisible()
    })

    // Stage 17: Database integrity and non-mutation proof
    await test.step("Stage 17: Database integrity and non-mutation proof", async () => {
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
    })
  })
})
