import { chromium } from "@playwright/test"
import * as fs from "node:fs"
import path from "node:path"

const DEAL_ID = "deal-17408-blue-jay"
const BASE_URL = "http://localhost:3000"
const SCREENSHOT_DIR = path.resolve(".demonstration-evidence", "screenshots")

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function captureScreenshots() {
  console.log("=== Launching Chrome to Capture Real Application Screenshots ===")
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } })
  const page = await context.newPage()

  const asmtListRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments`)
  const asmtListData = await asmtListRes.json()
  const assessmentId = asmtListData.assessments[0].id
  console.log(`Target Assessment ID: ${assessmentId}`)

  // 1. Saved Deal Investor Summary
  console.log("Navigating to Saved Deal Summary...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/summary`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_saved_deal_summary.png"), fullPage: true })
  console.log("Captured: 01_saved_deal_summary.png")

  // 2. Viewing Assessment Main Page (Top / Stepper / Stats)
  console.log("Navigating to Viewing Assessment Page...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/viewing?assessment=${assessmentId}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_viewing_assessment_full.png"), fullPage: true })
  console.log("Captured: 02_viewing_assessment_full.png")

  // 3. Confidential Builder Quotation Pack
  console.log("Navigating to Builder Quotation Pack...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/builder-pack?assessmentId=${assessmentId}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_builder_pack_full.png"), fullPage: true })
  console.log("Captured: 03_builder_pack_full.png")

  // 4. Three-Layer Deal Passport
  console.log("Navigating to Deal Passport...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/passport?assessmentId=${assessmentId}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_deal_passport_full.png"), fullPage: true })
  console.log("Captured: 04_deal_passport_full.png")

  await browser.close()
  console.log("All screenshots captured successfully in:", SCREENSHOT_DIR)
}

captureScreenshots().catch((e) => {
  console.error("Screenshot error:", e)
  process.exit(1)
})
