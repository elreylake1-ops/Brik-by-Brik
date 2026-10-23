import { test, expect } from "@playwright/test"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, mkdirSync, readFileSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import pg from "pg"

const root = path.resolve(__dirname, "..")
const SCHEMA = "brik_by_brik_engine"
const DEAL_ID = "deal-11e-e2e-playwright"
const DEAL_ADDRESS = "11E Walkthrough Parade, Bristol"
const ASSESSMENT_ID = "va_11e_playwright_assessment"
const JOB_ID = "vj_11e_playwright_job"

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

test.describe.serial("Task 11E Video-to-Evidence Viewing Assessment E2E", () => {
  let sim: SimHandle | undefined
  let app: ChildProcess
  let pool: pg.Pool
  let baseUrl: string
  let operatorPassword = ""

  test.beforeAll("setup isolated QA environment, seed video evidence, and start Next.js", async () => {
    test.setTimeout(90_000)
    const { assertLocalQaTarget, buildLocalQaUrl, LOCAL_QA, scrubbedEnv } = await import("../scripts/qa/local-qa-target.mjs")
    const { startIdentitySimulator } = await import("../scripts/qa/idp-simulator.mjs")

    // 1. Confirm isolated local QA database credentials
    const envFile = path.join(root, ".qa-local", "pg.env")
    if (!existsSync(envFile)) {
      throw new Error(".qa-local/pg.env not found. Run: node scripts/qa/local-postgres.mjs up")
    }
    const line = readFileSync(envFile, "utf8").split(/\r?\n/).find((l) => l.startsWith("POSTGRES_PASSWORD="))
    if (!line) throw new Error("POSTGRES_PASSWORD missing from .qa-local/pg.env")
    const password = line.slice("POSTGRES_PASSWORD=".length)

    const dbUrl = buildLocalQaUrl(password)
    assertLocalQaTarget(dbUrl)

    pool = new pg.Pool({ connectionString: dbUrl, max: 2 })
    const dbCheck = await pool.query("SELECT current_database() AS db")
    if (dbCheck.rows[0]?.db !== LOCAL_QA.database) {
      throw new Error(`Connected to unexpected database: ${dbCheck.rows[0]?.db}`)
    }

    // 2. Start ephemeral Identity Provider simulator
    process.env.VIEWING_QA_CONFIRM_ISOLATED = "I_CONFIRM_THIS_IS_NOT_PRODUCTION"
    sim = await startIdentitySimulator()
    operatorPassword = sim.accounts["operator@qa.test"].password
    const operatorSubject = sim.accounts["operator@qa.test"].subject

    // 3. Seed test deal, viewing assessment, and ready-for-review video job with frames
    await pool.query(
      `INSERT INTO ${SCHEMA}.saved_deals (
         id, address, purchase_price, gdv_realistic, refurb_cost,
         classification, governance_state, capital_protection_state,
         pipeline_state, engine_result_json, risk_summary_json
       ) VALUES ($1, $2, 195000, 310000, 32000, 'STANDARD', 'DRAFT', 'PROTECTED', 'UNDER_ANALYSIS', '{}'::jsonb, '{}'::jsonb)
       ON CONFLICT (id) DO UPDATE SET address = $2`,
      [DEAL_ID, DEAL_ADDRESS]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.viewing_assessments (
         id, deal_id, checklist_version, idempotency_key, created_by
       ) VALUES ($1, $2, 'v1', 'key-11e-e2e', $3)
       ON CONFLICT (id) DO NOTHING`,
      [ASSESSMENT_ID, DEAL_ID, operatorSubject]
    )

    await pool.query(
      `INSERT INTO ${SCHEMA}.video_jobs (
         id, deal_id, viewing_id, created_by, source_bucket, source_path,
         content_type, declared_bytes, observed_bytes, sha256, duration_ms,
         contact_sheet_path, processor_version, state
       ) VALUES (
         $1, $2, $3, $4, 'deal-evidence', $5,
         'video/mp4', 18450000, 18450000, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 45000,
         'video-evidence/' || $2 || '/' || $1 || '/contact_sheet.jpg', 'v1.0.0-ffmpeg', 'ready_for_review'
       ) ON CONFLICT (id) DO UPDATE SET state = 'ready_for_review'`,
      [JOB_ID, DEAL_ID, ASSESSMENT_ID, operatorSubject, `video-evidence/${DEAL_ID}/${JOB_ID}/original.mp4`]
    )

    // Seed 4 genuine video frames
    const frameTimes = [
      { seq: 0, ms: 1200, sha: "a1a2a3a4b1b2b3b4c1c2c3c4d1d2d3d4a1a2a3a4b1b2b3b4c1c2c3c4d1d2d3d4" },
      { seq: 1, ms: 8400, sha: "b1b2b3b4c1c2c3c4d1d2d3d4a1a2a3a4b1b2b3b4c1c2c3c4d1d2d3d4a1a2a3a4" },
      { seq: 2, ms: 18200, sha: "c1c2c3c4d1d2d3d4a1a2a3a4b1b2b3b4c1c2c3c4d1d2d3d4a1a2a3a4b1b2b3b4" },
      { seq: 3, ms: 32600, sha: "d1d2d3d4a1a2a3a4b1b2b3b4c1c2c3c4d1d2d3d4a1a2a3a4b1b2b3b4c1c2c3c4" },
    ]

    for (const f of frameTimes) {
      await pool.query(
        `INSERT INTO ${SCHEMA}.video_frames (
           id, job_id, sequence_no, source_time_ms, original_frame_path, thumbnail_path,
           sha256, mime_type, width, height, is_reviewed_evidence
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, 'image/png', 1920, 1080, FALSE
         ) ON CONFLICT (id) DO NOTHING`,
        [
          `vf_${JOB_ID}_${f.seq}`,
          JOB_ID,
          f.seq,
          f.ms,
          `video-evidence/${DEAL_ID}/${JOB_ID}/extracted/frame_${String(f.seq).padStart(3, "0")}.png`,
          `video-evidence/${DEAL_ID}/${JOB_ID}/thumbnails/frame_${String(f.seq).padStart(3, "0")}.jpg`,
          f.sha,
        ]
      )
    }

    // 4. Start Next.js on an ephemeral local port
    const appPort = await new Promise<number>((resolve) => {
      const s = net.createServer()
      s.listen(0, "127.0.0.1", () => {
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
          VIEWING_CHECKLIST_WORDING_APPROVED: "true",
          OPERATOR_AUTH_MODE: "supabase-jwt",
          OPERATOR_JWT_ISSUER: sim.issuer,
          OPERATOR_JWT_AUDIENCE: sim.audience,
          OPERATOR_JWKS_URL: sim.jwksUrl,
          OPERATOR_PASSWORD_GRANT_URL: sim.grantUrl,
          OPERATOR_PASSWORD_GRANT_API_KEY: sim.apiKey,
          OPERATOR_ALLOWED_SUBJECTS: operatorSubject,
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
        // waiting
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    if (!ready) throw new Error("Next.js server failed to start within 30 seconds")
  })

  test.afterAll(async () => {
    if (app) app.kill()
    if (pool) {
      await pool.query(`DELETE FROM ${SCHEMA}.video_frames WHERE job_id = $1`, [JOB_ID]).catch(() => undefined)
      await pool.query(`DELETE FROM ${SCHEMA}.video_jobs WHERE id = $1`, [JOB_ID]).catch(() => undefined)
      await pool.query(`DELETE FROM ${SCHEMA}.viewing_assessments WHERE id = $1`, [ASSESSMENT_ID]).catch(() => undefined)
      await pool.query(`DELETE FROM ${SCHEMA}.saved_deals WHERE id = $1`, [DEAL_ID]).catch(() => undefined)
      await pool.query(`DELETE FROM ${SCHEMA}.operator_sessions WHERE subject LIKE 'sim-%'`).catch(() => undefined)
      await pool.end()
    }
    if (sim) await sim.close()
  })

  test("operator video-to-evidence viewing assessment panel flow and screenshots", async ({ page }, testInfo) => {
    test.setTimeout(60_000)
    const isMobile = testInfo.project.name.includes("mobile")
    const deviceName = isMobile ? "android" : "desktop"

    // 1. Sign in as operator
    await page.goto(`${baseUrl}/sign-in?next=/saved-deals/${DEAL_ID}/viewing`)
    await page.locator('input[type="email"]').fill("operator@qa.test")
    await page.locator('input[type="password"]').fill(operatorPassword)
    await page.locator('button[type="submit"]').click()

    // 2. Expect redirection to Viewing Assessment page
    await expect(page).toHaveURL(`${baseUrl}/saved-deals/${DEAL_ID}/viewing`, { timeout: 15_000 })
    await expect(page.getByRole("heading", { name: "Viewing assessment" })).toBeVisible()

    // 3. Verify Video Evidence Panel is rendered and responsive
    await expect(page.getByRole("heading", { name: "Walkthrough Video-to-Evidence" })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText("Upload Walkthrough Footage")).toBeVisible()
    await expect(page.getByText(/H\.264 or H\.265 in MP4\/MOV container/)).toBeVisible()

    // 4. Verify Video Job is listed with ready for review status
    await expect(page.getByRole("button", { name: /ready for review/ })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText(/4 genuine frames extracted/)).toBeVisible()

    // 5. Verify Genuine Frame Cards
    await expect(page.getByText("F00").first()).toBeVisible()
    await expect(page.getByText(/Derivative/).first()).toBeVisible()

    // 6. Open Attach Modal for Frame 0
    const attachBtn = page.getByRole("button", { name: "Attach" }).first()
    await attachBtn.click()
    await expect(page.getByText(/Attach Frame F00/)).toBeVisible()
    await expect(page.getByText("Target Checklist Item (Unapproved Working Draft)")).toBeVisible()

    // 7. Capture Viewport Screenshot (Desktop or Android Mobile Viewport)
    const screenshotPath = path.join(screenshotsDir, `task-11e-video-evidence-${deviceName}.png`)
    await page.screenshot({ path: screenshotPath, fullPage: true })
    expect(existsSync(screenshotPath)).toBe(true)
  })
})
