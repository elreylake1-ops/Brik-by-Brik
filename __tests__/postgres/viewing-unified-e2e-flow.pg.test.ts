import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe } from "vitest"
import { defineUnifiedE2EFlow } from "../contracts/viewing-unified-e2e-flow"
import { qaGate } from "./qa-gate"

// Unified end-to-end viewing integration against REAL PostgreSQL (isolated disposable QA database only).
// Exercises:
//   Synthetic evidence -> Private storage -> Fixture AI -> Human review ->
//   Refurbishment scope -> Measurements -> Financial-impact proposal -> Decision ->
//   Confidential builder pack -> Three-layer Deal Passport.
// Runs only through `node scripts/qa/local-postgres.mjs test` or when the isolated QA gate is satisfied.

const gate = qaGate("Postgres unified viewing workflow")
type Db = typeof import("@/lib/db/postgres")
let db: Db
const S = "brik_by_brik_engine"

async function makeDeal(label: string): Promise<string> {
  const { deriveSavedDealRecord } = await import("@/lib/operator-command/derive-saved-deal-record")
  const { createSavedDeal } = await import("@/lib/operator-command/saved-deals-repository")
  const derived = deriveSavedDealRecord({
    address: `QA unified ${label} ${randomUUID().slice(0, 8)}`,
    deal_inputs: {
      purchasePrice: 100000,
      gdv: 190000,
      refurbCost: 25000,
      stampDuty: 3000,
      legalCosts: 1500,
      saleCosts: 3000,
      bridgeTermMonths: 9,
    },
  })
  if (!derived.ok) throw new Error(derived.error)
  return (await createSavedDeal(derived.record)).id
}

async function removeDeals(dealIds: string[]) {
  for (const t of [
    "refurb_financial_decisions",
    "refurb_financial_proposals",
    "refurb_plan_confirmations",
    "refurb_measurement_sets",
    "viewing_assessment_proposal_reviews",
    "viewing_assessment_proposals",
    "viewing_analysis_runs",
    "viewing_evidence_blobs",
    "viewing_evidence",
    "viewing_assets",
    "viewing_assessments",
    "investor_shield_checks",
    "evidence_items",
    "risk_flags",
    "manual_overrides",
    "deal_offers",
    "deal_tasks",
    "deal_evidence",
  ]) {
    await db.query(`DELETE FROM ${S}.${t} WHERE deal_id = ANY($1)`, [dealIds]).catch(() => undefined)
  }
  await db.query(`DELETE FROM ${S}.saved_deals WHERE id = ANY($1)`, [dealIds]).catch(() => undefined)
}

describe.skipIf(!gate.enabled)("Postgres unified viewing workflow (isolated local QA only)", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url // this test process only; never the shell's value
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()
  })

  afterAll(async () => {
    await db?.query(`DELETE FROM ${S}.saved_deals WHERE address LIKE 'QA unified %'`).catch(() => undefined)
    await db?.getPostgresPool().end()
  })

  defineUnifiedE2EFlow("real PostgreSQL", async () => {
    const dealId = await makeDeal("target")
    const otherDealId = await makeDeal("isolated")

    const snapshot = async (id: string) => {
      const dealRows = await db.query(`SELECT * FROM ${S}.saved_deals WHERE id = $1`, [id])
      const shieldRows = await db.query(`SELECT * FROM ${S}.investor_shield_checks WHERE deal_id = $1 ORDER BY 1`, [id])
      return JSON.stringify({ deal: dealRows.rows, shield: shieldRows.rows })
    }

    return {
      dealId,
      otherDealId,
      snapshot,
      cleanup: async () => {
        await removeDeals([dealId, otherDealId])
      },
    }
  })
})
