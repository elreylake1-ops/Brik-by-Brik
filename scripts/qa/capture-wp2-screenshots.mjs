import { chromium } from "@playwright/test"
import * as fs from "node:fs"
import path from "node:path"

const DEAL_ID = "deal-17408-blue-jay"
const BASE_URL = "http://localhost:3000"
const SCREENSHOT_DIR = path.resolve(".demonstration-evidence", "screenshots", "task-wp2")

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function captureWp2Screenshots() {
  console.log("=== Launching Chrome to Capture Work Package 2 Real Application Screenshots ===")
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  })

  const asmtListRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments`)
  if (!asmtListRes.ok) {
    throw new Error(`Failed to fetch viewing assessments: ${asmtListRes.status}`)
  }
  const asmtListData = await asmtListRes.json()
  const assessmentId = asmtListData.assessments[0].id
  console.log(`Target Assessment ID: ${assessmentId}`)

  // 1. Mobile 375px Evidence Gallery
  console.log("\n[1/7] Capturing 375px Mobile Evidence Gallery...")
  const mobileContext = await browser.newContext({
    viewport: { width: 375, height: 812 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/viewing?assessment=${assessmentId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })
  await mobilePage.waitForTimeout(3000)

  // Scroll to video evidence gallery
  const gallerySection = mobilePage.locator("[data-testid='video-evidence-panel']").first()
  if (await gallerySection.isVisible()) {
    await gallerySection.scrollIntoViewIfNeeded()
    await mobilePage.waitForTimeout(1000)
  }
  await mobilePage.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_01_responsive_evidence_gallery_mobile_375px.png"),
    fullPage: false,
  })
  console.log("  -> Saved: wp2_01_responsive_evidence_gallery_mobile_375px.png")
  await mobileContext.close()

  // Desktop Context (1280x900)
  const desktopContext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
  })
  const page = await desktopContext.newPage()

  // 2. Desktop Evidence Gallery
  console.log("\n[2/7] Capturing 1280px Desktop Evidence Gallery...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/viewing?assessment=${assessmentId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })
  await page.waitForTimeout(3000)
  const desktopGallery = page.locator("[data-testid='video-evidence-panel']").first()
  if (await desktopGallery.isVisible()) {
    await desktopGallery.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_02_responsive_evidence_gallery_desktop_1280px.png"),
  })
  console.log("  -> Saved: wp2_02_responsive_evidence_gallery_desktop_1280px.png")

  // 3. Human-Reviewed Findings
  console.log("\n[3/7] Capturing Human-Reviewed Findings Section...")
  const findingsSection = page.getByText("AI Assessment & Operator Verification").first()
  if (await findingsSection.isVisible()) {
    await findingsSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_03_human_reviewed_findings.png"),
  })
  console.log("  -> Saved: wp2_03_human_reviewed_findings.png")

  // 4. Priced / Unpriced Refurbishment Scope & Schedule
  console.log("\n[4/7] Capturing Refurbishment Plan & Schedule of Works...")
  const planSection = page.getByText("Refurbishment Plan & Schedule of Works").first()
  if (await planSection.isVisible()) {
    await planSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_04_refurb_scope_priced_and_unpriced.png"),
  })
  console.log("  -> Saved: wp2_04_refurb_scope_priced_and_unpriced.png")

  // 5. Financial Comparison & True MAO
  console.log("\n[5/7] Capturing Financial Impact & True MAO Decision...")
  const financeSection = page.getByText("Financial Impact & True MAO Decision").first()
  if (await financeSection.isVisible()) {
    await financeSection.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1000)
  }
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_05_financial_comparison_and_true_mao.png"),
  })
  console.log("  -> Saved: wp2_05_financial_comparison_and_true_mao.png")

  // 6. Printable Builder Quotation Pack
  console.log("\n[6/7] Capturing Production-Quality Printable Builder Pack...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/builder-pack?assessmentId=${assessmentId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_06_printable_builder_pack.png"),
    fullPage: true,
  })
  console.log("  -> Saved: wp2_06_printable_builder_pack.png")

  // 7. Three-Layer Deal Passport
  console.log("\n[7/7] Capturing Three-Layer Deal Passport...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/passport?assessmentId=${assessmentId}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  })
  await page.waitForTimeout(2000)
  await page.screenshot({
    path: path.join(SCREENSHOT_DIR, "wp2_07_three_layer_deal_passport.png"),
    fullPage: true,
  })
  console.log("  -> Saved: wp2_07_three_layer_deal_passport.png")

  await desktopContext.close()
  await browser.close()
  console.log("\n=== ALL WORK PACKAGE 2 SCREENSHOTS CAPTURED SUCCESSFULLY ===")
  console.log(`Directory: ${SCREENSHOT_DIR}`)
}

captureWp2Screenshots().catch((err) => {
  console.error("Screenshot capture failed:", err)
  process.exit(1)
})
