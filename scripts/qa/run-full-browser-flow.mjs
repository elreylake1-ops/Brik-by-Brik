import { chromium } from "@playwright/test"
import * as fs from "node:fs"
import path from "node:path"

const DEAL_ID = "deal-17408-blue-jay"
const BASE_URL = "http://localhost:3000"
const SCREENSHOT_DIR = path.resolve(".demonstration-evidence", "screenshots")

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true })
}

async function runFullFlow() {
  console.log("=== Brik by Brik ??? Task 12C Browser Demonstration Workflow ===\n")

  // Query assessment detail to get active assessment and proposals
  const asmtListRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments`)
  const asmtListData = await asmtListRes.json()
  const assessmentId = asmtListData.assessments[0].id
  console.log(`Active Assessment ID: ${assessmentId}`)

  const detailRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}`)
  const detail = await detailRes.json()
  console.log(`Evidence count: ${detail.evidence?.length}, Blobs count: ${detail.blobs?.length}`)
  console.log(`Proposals count: ${detail.proposals?.length}`)

  // 1. Execute Human Reviews via API
  console.log("\n--- Executing Human Reviews on Simulated Proposals ---")
  for (const p of detail.proposals) {
    const checkId = p.proposal.checkId
    const proposalId = p.proposal.id

    if (checkId === "C41") {
      console.log(`Reviewing C41 (Sanitary appliances) -> ACCEPTED`)
      const res = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/proposals/${proposalId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: p.reviewHistory.length, disposition: "ACCEPTED" }),
      })
      console.log("C41 review status:", res.status)
    } else if (checkId === "C08") {
      console.log(`Reviewing C08 (External masonry & render) -> EDITED (AMEND)`)
      const res = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/proposals/${proposalId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: p.reviewHistory.length,
          disposition: "EDITED",
          status: "CONCERN",
          observation: "Cosmetic hairline render crazing near patio steps; structural substrate sound.",
        }),
      })
      console.log("C08 review status:", res.status)
    } else if (checkId === "C01") {
      console.log(`Reviewing C01 (Main roof pitch) -> REJECTED`)
      const res = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/proposals/${proposalId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: p.reviewHistory.length,
          disposition: "REJECTED",
          reason: "Aerial drone footage confirms roof planes and ridge lines are intact and sound.",
        }),
      })
      console.log("C01 review status:", res.status)
    }
  }

  // 2. Verified Physical Measurements
  console.log("\n--- Submitting Physical Measurements ---")
  const measRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/measurements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: `meas-flow-${Date.now()}`,
      basedOnVersion: 0,
      entries: [
        { key: "bedrooms", value: 4, basis: "MEASURED", source: "FLOOR_PLAN", confidence: "high", note: "Architect floor plan" },
        { key: "bathrooms", value: 3, basis: "MEASURED", source: "FLOOR_PLAN", confidence: "high", note: "Family and en-suite baths" },
        { key: "floorAreaSqm", value: 240, basis: "MEASURED", source: "FLOOR_PLAN", confidence: "high", note: "Gross internal area" },
      ],
    }),
  })
  const measData = await measRes.json()
  const measurementSetId = measData.measurementSet?.id
  console.log("Measurement Set ID:", measurementSetId)

  // 3. Confirm Refurb Plan
  console.log("\n--- Confirming Refurbishment Scope & Works Schedule ---")
  const planPropRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/refurb-plan`)
  const planPropData = await planPropRes.json()
  const fingerprint = planPropData.proposal?.fingerprint
  console.log("Refurb plan fingerprint:", fingerprint)
  console.log("Proposed items:", planPropData.proposal?.items?.map((i) => i.itemId))
  console.log("Excluded items:", planPropData.proposal?.excluded?.map((e) => `${e.checkId} (${e.reason})`))

  const confirmRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/refurb-plan`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: `confirm-flow-${Date.now()}`,
      expectedFingerprint: fingerprint,
      measurementSetId,
      financialAssumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      accepted: [{ itemId: "bathroom" }, { itemId: "external-walls" }],
    }),
  })
  const confirmData = await confirmRes.json()
  console.log("Plan confirmation success:", confirmData.success, "Plan ID:", confirmData.plan?.id)

  // 4. Financial Proposal & Decision
  console.log("\n--- Calculating Brik True MAO & Financial Decision ---")
  const finPropRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/financial-proposal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `finprop-flow-${Date.now()}` }),
  })
  const finPropData = await finPropRes.json()
  const finProp = finPropData.proposal
  console.log("Financial Proposal ID:", finProp?.id)
  console.log("True MAO (20% Target Profit Margin):", finProp?.content?.proposed?.trueMao?.twentyPercent)

  const finDecRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/financial-proposal/${finProp?.id}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idempotencyKey: `findec-flow-${Date.now()}`,
      decision: "CONFIRMED",
      proposalHash: finProp?.contentHash,
      acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
    }),
  })
  const finDecData = await finDecRes.json()
  console.log("Financial Decision confirmed:", finDecData.success, "Saved deal changed:", finDecData.savedDealChanged)

  // 5. Continuous Learning Outcome Feedback
  console.log("\n--- Recording Ground-Truth Outcome Feedback ---")
  const propC41 = detail.proposals.find((p) => p.proposal.checkId === "C41")?.proposal.id
  if (propC41) {
    const outcomeRes = await fetch(`${BASE_URL}/api/saved-deals/${DEAL_ID}/viewing-assessments/${assessmentId}/proposals/${propC41}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        result: "CONFIRMED",
        source: "SURVEY",
        observedStatus: "CONCERN",
        note: "Sanitary surveyor confirmed defective vanity seal during intrusive inspection.",
      }),
    })
    console.log("Outcome feedback status:", outcomeRes.status)
  }

  // 6. Launch Chrome to Capture High-Resolution Screenshots
  console.log("\n--- Launching Local Chrome Browser for Verification & Screenshots ---")
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  })
  const context = await browser.newContext({ viewport: { width: 1280, height: 960 } })
  const page = await context.newPage()

  // 6.1 Viewing Assessment Main Interface
  console.log("Navigating to Viewing Assessment page in Chrome...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/viewing?assessment=${assessmentId}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "01_viewing_assessment_full.png"), fullPage: true })
  console.log("Captured: 01_viewing_assessment_full.png")

  // 6.2 Builder Pack View
  console.log("Navigating to Confidential Builder Quotation Pack...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/builder-pack?assessmentId=${assessmentId}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "02_builder_pack_full.png"), fullPage: true })
  console.log("Captured: 02_builder_pack_full.png")

  // 6.3 Deal Passport View
  console.log("Navigating to Three-Layer Deal Passport...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/passport?assessmentId=${assessmentId}`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "03_deal_passport_full.png"), fullPage: true })
  console.log("Captured: 03_deal_passport_full.png")

  // 6.4 Saved Deal Summary View
  console.log("Navigating to Saved Deal Investor Summary...")
  await page.goto(`${BASE_URL}/saved-deals/${DEAL_ID}/summary`, { waitUntil: "networkidle" })
  await page.waitForTimeout(1000)
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "04_saved_deal_summary.png"), fullPage: true })
  console.log("Captured: 04_saved_deal_summary.png")

  await browser.close()
  console.log("\n=== Task 12C Complete Workflow Executed Successfully! ===")
}

runFullFlow().catch((e) => {
  console.error("Execution failed:", e)
  process.exit(1)
})
