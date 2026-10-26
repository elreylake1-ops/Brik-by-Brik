import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import pg from "pg"
const root = path.resolve(__dirname, "..")
const SCHEMA = "brik_by_brik_engine"
const DEAL_ID = "deal-smoke-playwright-1"
const DEAL_ADDRESS = "QA Smoke 42 Victoria Way, Leeds"
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

test.describe.serial("Viewing Assessment Operator Smoke Test", () => {
  let sim: SimHandle | undefined
  let app: ChildProcess
  let pool: pg.Pool
  let baseUrl: string
  let operatorPassword = ""

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
    sim = await startIdentitySimulator()
    operatorPassword = sim.accounts["operator@qa.test"].password

    // 3. Clean any existing smoke fixture & seed isolated test deal
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

    // 4. Start Next.js in production build mode on an ephemeral port
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

    // Wait for Next.js to respond
    let ready = false
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`${baseUrl}/sign-in`)
        if (res.status === 200) {
          ready = true
          break
        }
      } catch {
        // still starting
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!ready) throw new Error("Next.js failed to start within 30 seconds")
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

  test("1. unauthenticated visit to viewing assessment redirects to sign-in", async ({ page }) => {
    await page.goto(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)
    await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=`))
    await expect(page.locator("h1")).toHaveText("Operator sign-in")
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toHaveText("Sign in")
  })

  test("2. authorized operator authenticates and Viewing Assessment page renders", async ({ page }) => {
    await page.goto(`${baseUrl}/sign-in?next=/saved-deals/${DEAL_ID}/viewing`)

    // Fill credentials for enrolled operator
    await page.locator('input[type="email"]').fill("operator@qa.test")
    await page.locator('input[type="password"]').fill(operatorPassword)
    await page.locator('button[type="submit"]').click()

    // Expect redirection to the Viewing Assessment page
    await expect(page).toHaveURL(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`)

    // Verify key elements on Viewing Assessment page
    const heading = page.locator("h1")
    await expect(heading).toHaveText(DEAL_ADDRESS)

    const breadcrumb = page.getByText("Viewing Assessment", { exact: true })
    await expect(breadcrumb).toBeVisible()

    const panelHeading = page.getByRole("heading", { name: "Viewing assessment" })
    await expect(panelHeading).toBeVisible()

    const dealRef = page.locator(`text=Deal Ref: ${DEAL_ID}`)
    await expect(dealRef).toBeVisible()

    // Capture visual proof screenshot
    const screenshotPath = path.join(screenshotsDir, "task-9b-smoke-authenticated.png")
    await page.screenshot({ path: screenshotPath, fullPage: true })
    expect(existsSync(screenshotPath)).toBe(true)
  })
})
