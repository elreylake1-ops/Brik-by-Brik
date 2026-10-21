import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe } from "vitest"
import { defineVideoFlow } from "../contracts/viewing-video-flow"
import { qaGate } from "./qa-gate"

// The end-to-end video -> checklist workflow against REAL PostgreSQL, through the real route handlers, the real
// access guard (test identity + membership), the real pg repository and a temporary private blob store.
// Runs only against the confirmed disposable local QA database (see qa-gate.ts). Creates its own saved deals
// (ids prefixed "qa-flow-") and deletes them afterwards; the cascade delete is part of what is exercised.

const gate = qaGate("Postgres viewing workflow")
type Db = typeof import("@/lib/db/postgres")
let db: Db
const S = "brik_by_brik_engine"

async function makeDeal(): Promise<string> {
  const id = `qa-flow-${randomUUID()}`
  await db.query(
    `INSERT INTO ${S}.saved_deals (id, address, classification, governance_state, capital_protection_state, pipeline_state, engine_result_json, risk_summary_json)
     VALUES ($1, 'QA flow test', 'QA', 'QA', 'QA', 'UNDER_ANALYSIS', '{}'::jsonb, '{}'::jsonb)`,
    [id]
  )
  return id
}

describe.skipIf(!gate.enabled)("Postgres viewing workflow (isolated local QA only)", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url // this test process only; never the shell's value
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()
  })
  afterAll(async () => {
    await db?.getPostgresPool().end()
  })

  defineVideoFlow("real PostgreSQL", async () => {
    const dealId = await makeDeal()
    const otherDealId = await makeDeal()
    return {
      dealId,
      otherDealId,
      cleanup: async () => {
        await db.query(`DELETE FROM ${S}.saved_deals WHERE id = ANY($1)`, [[dealId, otherDealId]])
      },
    }
  })
})
