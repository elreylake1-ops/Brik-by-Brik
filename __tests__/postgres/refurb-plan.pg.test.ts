import { randomUUID } from "node:crypto"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { defineRefurbIntegrationFlow, type RefurbFlowEnv } from "../contracts/refurb-integration-flow"
import { defineMeasureFinanceFlow } from "../contracts/refurb-measure-finance-flow"
import { decisionInput, defineFinancialRepositoryContract, defineMeasurementRepositoryContract, measurementInput, proposalInput } from "../contracts/refurb-measure-finance-repository-contract"
import { definePlanRepositoryContract, planInput } from "../contracts/refurb-plan-repository-contract"
import { qaGate } from "./qa-gate"

// Refurbishment plans against REAL PostgreSQL (isolated disposable QA database only; see qa-gate.ts):
//   1. the repository contract, 2. database-enforced rules, 3. the whole reviewed-findings -> plan -> builder pack ->
//   Deal Passport flow using the real Saved Deals, Investor Shield and evidence-pack services.
// Creates its own deals (address prefixed "QA refurb ") and removes them afterwards.

const gate = qaGate("Postgres refurbishment plans")
const S = "brik_by_brik_engine"
type Db = typeof import("@/lib/db/postgres")
let db: Db

async function makeDeal(label: string): Promise<string> {
  const { deriveSavedDealRecord } = await import("@/lib/operator-command/derive-saved-deal-record")
  const { createSavedDeal } = await import("@/lib/operator-command/saved-deals-repository")
  const derived = deriveSavedDealRecord({
    address: `QA refurb ${label} ${randomUUID().slice(0, 8)}`,
    deal_inputs: { purchasePrice: 100000, gdv: 190000, refurbCost: 25000, stampDuty: 3000, legalCosts: 1500, saleCosts: 3000, bridgeTermMonths: 9 },
  })
  if (!derived.ok) throw new Error(derived.error)
  return (await createSavedDeal(derived.record)).id
}

async function removeDeals(dealIds: string[]) {
  for (const t of ["investor_shield_checks", "evidence_items", "risk_flags", "manual_overrides", "deal_offers", "deal_tasks", "deal_evidence"]) {
    await db.query(`DELETE FROM ${S}.${t} WHERE deal_id = ANY($1)`, [dealIds]).catch(() => undefined)
  }
  await db.query(`DELETE FROM ${S}.saved_deals WHERE id = ANY($1)`, [dealIds]) // cascades through viewing assessments and plans
}

describe.skipIf(!gate.enabled)("Postgres refurbishment plans (isolated QA only)", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url // this test process only; never the shell's value
    db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()
  })
  afterAll(async () => {
    await db?.query(`DELETE FROM ${S}.saved_deals WHERE address LIKE 'QA refurb %'`).catch(() => undefined)
    await db?.getPostgresPool().end()
  })

  definePlanRepositoryContract("real PostgreSQL", async () => {
    const { pgViewingAssessmentRepository: viewing } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
    const { pgRefurbPlanRepository } = await import("@/lib/refurb-integration/pg-plan-repository")
    const dealA = await makeDeal("contract-a")
    const dealB = await makeDeal("contract-b")
    const mk = async (dealId: string, key: string) => (await viewing.createAssessment({ dealId, idempotencyKey: key, checklistVersion: "v1", createdBy: "qa" })).record.id
    return {
      plans: pgRefurbPlanRepository,
      dealA,
      dealB,
      assessmentA1: await mk(dealA, "contract-key-a1"),
      assessmentA2: await mk(dealA, "contract-key-a2"),
      assessmentB1: await mk(dealB, "contract-key-b1"),
      cleanup: async () => removeDeals([dealA, dealB]),
    }
  })

  describe("database-enforced rules", () => {
    async function seeded() {
      const { pgViewingAssessmentRepository: viewing } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
      const { pgRefurbPlanRepository } = await import("@/lib/refurb-integration/pg-plan-repository")
      const dealA = await makeDeal("rules-a")
      const dealB = await makeDeal("rules-b")
      const a = (await viewing.createAssessment({ dealId: dealA, idempotencyKey: "rules-key-a1", checklistVersion: "v1", createdBy: "qa" })).record.id
      const b = (await viewing.createAssessment({ dealId: dealB, idempotencyKey: "rules-key-b1", checklistVersion: "v1", createdBy: "qa" })).record.id
      const env = { plans: pgRefurbPlanRepository, dealA, dealB, assessmentA1: a, assessmentA2: a, assessmentB1: b, cleanup: async () => removeDeals([dealA, dealB]) }
      const created = await pgRefurbPlanRepository.create(planInput(env))
      return { env, created }
    }

    it("a stored plan cannot be updated, deleted or truncated", async () => {
      const { env } = await seeded()
      try {
        await expect(db.query(`UPDATE ${S}.refurb_plan_confirmations SET confirmed_by = 'x' WHERE deal_id = $1`, [env.dealA])).rejects.toThrow(/append-only/)
        await expect(db.query(`DELETE FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1`, [env.dealA])).rejects.toThrow(/append-only/)
        await expect(db.query(`TRUNCATE ${S}.refurb_plan_confirmations`)).rejects.toThrow(/append-only|cannot truncate a table referenced/) // referenced by proposals: refused either way
        await expect(db.query(`TRUNCATE ${S}.refurb_plan_confirmations CASCADE`)).rejects.toThrow(/append-only/) // and CASCADE reaches the guard
      } finally {
        await env.cleanup() // deleting the deal cascades (allowed), so history never blocks removal of a deal
      }
      expect((await db.query(`SELECT 1 FROM ${S}.refurb_plan_confirmations WHERE deal_id = $1`, [env.dealA])).rowCount).toBe(0)
    })

    it("a plan cannot point at another deal's assessment, even through raw SQL", async () => {
      const { env } = await seeded()
      try {
        await expect(
          db.query(
            `INSERT INTO ${S}.refurb_plan_confirmations (id, deal_id, assessment_id, version, idempotency_key, request_hash, source_fingerprint, analysis_source, accepted_items, excluded, property_basics, computation, confirmed_by, confirmed_at)
             VALUES ('plan-x', $1, $2, 1, 'raw-key-0001', $3, $3, 'NONE', '[{}]'::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 'qa', NOW())`,
            [env.dealB, env.assessmentA1, "a".repeat(64)]
          )
        ).rejects.toThrow(/fk_refurb_plan_assessment|foreign key/)
      } finally {
        await env.cleanup()
      }
    })

    it("malformed rows are refused by CHECK constraints (bad hash, no items, unknown analysis source, version 0)", async () => {
      const { env } = await seeded()
      const insert = (over: { hash?: string; items?: string; source?: string; version?: number }) =>
        db.query(
          `INSERT INTO ${S}.refurb_plan_confirmations (id, deal_id, assessment_id, version, idempotency_key, request_hash, source_fingerprint, analysis_source, accepted_items, excluded, property_basics, computation, confirmed_by, confirmed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8::jsonb, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb, 'qa', NOW())`,
          [`plan-${randomUUID()}`, env.dealA, env.assessmentA1, over.version ?? 9, `chk-${randomUUID().slice(0, 12)}`, over.hash ?? "a".repeat(64), over.source ?? "NONE", over.items ?? '[{}]']
        )
      try {
        await expect(insert({ hash: "not-a-hash" })).rejects.toThrow(/ck_refurb_plan_hash/)
        await expect(insert({ items: "[]" })).rejects.toThrow(/ck_refurb_plan_has_items/)
        await expect(insert({ source: "REAL" })).rejects.toThrow(/ck_refurb_plan_analysis_source/)
        await expect(insert({ version: 0 })).rejects.toThrow(/ck_refurb_plan_version/)
      } finally {
        await env.cleanup()
      }
    })
  })

  defineMeasurementRepositoryContract("real PostgreSQL", async () => {
    const { pgViewingAssessmentRepository: viewing } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
    const { pgMeasurementRepository } = await import("@/lib/refurb-integration/pg-measurement-repository")
    const dealA = await makeDeal("meas-contract-a")
    const dealB = await makeDeal("meas-contract-b")
    const mk = async (dealId: string, key: string) => (await viewing.createAssessment({ dealId, idempotencyKey: key, checklistVersion: "v1", createdBy: "qa" })).record.id
    return {
      measurements: pgMeasurementRepository,
      dealA,
      dealB,
      assessmentA1: await mk(dealA, "meas-key-a1"),
      assessmentA2: await mk(dealA, "meas-key-a2"),
      assessmentB1: await mk(dealB, "meas-key-b1"),
      cleanup: async () => removeDeals([dealA, dealB]),
    }
  })

  async function financialEnv() {
    const { pgViewingAssessmentRepository: viewing } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
    const { pgRefurbPlanRepository } = await import("@/lib/refurb-integration/pg-plan-repository")
    const { pgFinancialProposalRepository } = await import("@/lib/refurb-integration/pg-financial-proposal-repository")
    const dealA = await makeDeal("fin-a")
    const dealB = await makeDeal("fin-b")
    const mk = async (dealId: string, key: string) => (await viewing.createAssessment({ dealId, idempotencyKey: key, checklistVersion: "v1", createdBy: "qa" })).record.id
    const assessmentA1 = await mk(dealA, "fin-key-a1")
    const assessmentB1 = await mk(dealB, "fin-key-b1")
    const planEnv = { plans: pgRefurbPlanRepository, dealA, dealB, assessmentA1, assessmentA2: assessmentA1, assessmentB1, cleanup: async () => undefined }
    const plan = async (dealId: string, assessmentId: string, key: string) => {
      const r = await pgRefurbPlanRepository.create(planInput(planEnv, { dealId, assessmentId, idempotencyKey: key }))
      if (r.status !== "created") throw new Error("plan not created")
      return r.record.id
    }
    return {
      proposals: pgFinancialProposalRepository,
      dealA,
      dealB,
      assessmentA1,
      assessmentB1,
      planA1: await plan(dealA, assessmentA1, "plan-key-0001"),
      planA1b: await plan(dealA, assessmentA1, "plan-key-0002"),
      planB1: await plan(dealB, assessmentB1, "plan-key-0001"),
      cleanup: async () => removeDeals([dealA, dealB]),
    }
  }

  defineFinancialRepositoryContract("real PostgreSQL", financialEnv)

  describe("database-enforced rules for measurements, proposals and decisions", () => {
    it("measurement sets, proposals and decisions cannot be updated, deleted or truncated", async () => {
      const env = await financialEnv()
      try {
        const { pgMeasurementRepository } = await import("@/lib/refurb-integration/pg-measurement-repository")
        const m = await pgMeasurementRepository.create(measurementInput({ measurements: pgMeasurementRepository, dealA: env.dealA, dealB: env.dealB, assessmentA1: env.assessmentA1, assessmentA2: env.assessmentA1, assessmentB1: env.assessmentB1, cleanup: async () => undefined }))
        expect(m.status).toBe("created")
        const p = await env.proposals.createProposal(proposalInput(env))
        const d = await env.proposals.appendDecision(decisionInput(env, p.record.id))
        expect(d.status).toBe("created")
        for (const [table, where] of [["refurb_measurement_sets", "deal_id"], ["refurb_financial_proposals", "deal_id"], ["refurb_financial_decisions", "deal_id"]] as const) {
          await expect(db.query(`UPDATE ${S}.${table} SET ${where} = ${where} WHERE ${where} = $1`, [env.dealA])).rejects.toThrow(/append-only/)
          await expect(db.query(`DELETE FROM ${S}.${table} WHERE ${where} = $1`, [env.dealA])).rejects.toThrow(/append-only/)
          await expect(db.query(`TRUNCATE ${S}.${table}`)).rejects.toThrow(/append-only|cannot truncate a table referenced/)
          await expect(db.query(`TRUNCATE ${S}.${table} CASCADE`)).rejects.toThrow(/append-only/)
        }
      } finally {
        await env.cleanup()
      }
      for (const table of ["refurb_measurement_sets", "refurb_financial_proposals", "refurb_financial_decisions"]) {
        expect((await db.query(`SELECT 1 FROM ${S}.${table} WHERE deal_id = $1`, [env.dealA])).rowCount).toBe(0) // a deal can still be removed: cascade is allowed
      }
    })

    it("measurement sets refuse malformed rows: skipped versions, a correction with no reason, empty or oversized lists, bad hashes, another deal's assessment", async () => {
      const env = await financialEnv()
      const insert = (over: { dealId?: string; assessmentId?: string; version?: number; based?: number; note?: string | null; entries?: string; hash?: string }) =>
        db.query(
          `INSERT INTO ${S}.refurb_measurement_sets (id, deal_id, assessment_id, version, based_on_version, idempotency_key, request_hash, entries, warnings, change_note, recorded_by, recorded_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'[]'::jsonb,$9,'qa',NOW())`,
          [`meas-${randomUUID()}`, over.dealId ?? env.dealA, over.assessmentId ?? env.assessmentA1, over.version ?? 1, over.based ?? 0, `chk-${randomUUID().slice(0, 12)}`, over.hash ?? "a".repeat(64), over.entries ?? '[{"key":"bedrooms"}]', over.note ?? null]
        )
      try {
        await expect(insert({ version: 3, based: 0, note: "a proper reason" })).rejects.toThrow(/ck_refurb_measurements_version/)
        await expect(insert({ version: 2, based: 1, note: null })).rejects.toThrow(/ck_refurb_measurements_correction/)
        await expect(insert({ version: 2, based: 1, note: "  " })).rejects.toThrow(/ck_refurb_measurements_correction/)
        await expect(insert({ entries: "[]" })).rejects.toThrow(/ck_refurb_measurements_entries/)
        await expect(insert({ entries: JSON.stringify(Array.from({ length: 61 }, () => ({}))) })).rejects.toThrow(/ck_refurb_measurements_entries/)
        await expect(insert({ hash: "nope" })).rejects.toThrow(/ck_refurb_measurements_hash/)
        await expect(insert({ dealId: env.dealB })).rejects.toThrow(/fk_refurb_measurements_assessment|foreign key/)
      } finally {
        await env.cleanup()
      }
    })

    it("a plan can reference only a measurement set of its own assessment, and the version must travel with the id", async () => {
      const env = await financialEnv()
      try {
        const { pgMeasurementRepository } = await import("@/lib/refurb-integration/pg-measurement-repository")
        const { pgViewingAssessmentRepository: viewing } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
        const other = (await viewing.createAssessment({ dealId: env.dealA, idempotencyKey: "fin-key-a2", checklistVersion: "v1", createdBy: "qa" })).record.id
        const m = await pgMeasurementRepository.create(measurementInput({ measurements: pgMeasurementRepository, dealA: env.dealA, dealB: env.dealB, assessmentA1: env.assessmentA1, assessmentA2: other, assessmentB1: env.assessmentB1, cleanup: async () => undefined }, { assessmentId: other }))
        if (m.status !== "created") throw new Error("set not created")
        const insert = (setId: string | null, version: number | null) =>
          db.query(
            `INSERT INTO ${S}.refurb_plan_confirmations (id, deal_id, assessment_id, version, idempotency_key, request_hash, source_fingerprint, analysis_source, accepted_items, excluded, property_basics, computation, confirmed_by, confirmed_at, measurement_set_id, measurement_set_version)
             VALUES ($1,$2,$3,50,$4,$5,$5,'NONE','[{}]'::jsonb,'[]'::jsonb,'{}'::jsonb,'{}'::jsonb,'qa',NOW(),$6,$7)`,
            [`plan-${randomUUID()}`, env.dealA, env.assessmentA1, `mset-${randomUUID().slice(0, 12)}`, "a".repeat(64), setId, version]
          )
        await expect(insert(m.record.id, 1)).rejects.toThrow(/fk_refurb_plan_measurements|foreign key/) // a set of a different assessment
        await expect(insert(m.record.id, null)).rejects.toThrow(/ck_refurb_plan_measurement_pair/)
        await expect(insert(null, 1)).rejects.toThrow(/ck_refurb_plan_measurement_pair/)
      } finally {
        await env.cleanup()
      }
    })

    it("a proposal must be marked non-authoritative; a confirmation must carry the not-a-write-back acknowledgement; one decision per proposal; hashes are validated", async () => {
      const env = await financialEnv()
      const insertProposal = (content: object, hash = "b".repeat(64), planId = env.planA1) =>
        db.query(
          `INSERT INTO ${S}.refurb_financial_proposals (id, deal_id, assessment_id, plan_id, version, content_hash, idempotency_key, content, created_by, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'qa',NOW())`,
          [`fprop-${randomUUID()}`, env.dealA, env.assessmentA1, planId, 90 + Math.floor(Math.random() * 900), hash, `k-${randomUUID().slice(0, 12)}`, JSON.stringify(content)]
        )
      try {
        await expect(insertProposal({ nonAuthoritative: false })).rejects.toThrow(/ck_refurb_proposal_nonauth/)
        await expect(insertProposal({})).rejects.toThrow(/ck_refurb_proposal_nonauth/)
        await expect(insertProposal({ nonAuthoritative: true }, "nope")).rejects.toThrow(/ck_refurb_proposal_hash/)
        await expect(insertProposal({ nonAuthoritative: true }, "b".repeat(64), env.planB1)).rejects.toThrow(/fk_refurb_proposal_plan|foreign key/) // another deal's plan

        const p = await env.proposals.createProposal(proposalInput(env))
        const insertDecision = (decision: string, ack: object, hash = "d".repeat(64), baseline = "e".repeat(64)) =>
          db.query(
            `INSERT INTO ${S}.refurb_financial_decisions (id, deal_id, assessment_id, proposal_id, decision, actor, note, idempotency_key, request_hash, acknowledged, baseline_fingerprint, same_operator_as_scope_confirmer, occurred_at)
             VALUES ($1,$2,$3,$4,$5,'qa',NULL,$6,$7,$8::jsonb,$9,false,NOW())`,
            [`fdec-${randomUUID()}`, env.dealA, env.assessmentA1, p.record.id, decision, `k-${randomUUID().slice(0, 12)}`, hash, JSON.stringify(ack), baseline]
          )
        await expect(insertDecision("APPROVED", { notWriteBack: true })).rejects.toThrow(/ck_refurb_decision_value/)
        await expect(insertDecision("CONFIRMED", { notWriteBack: false })).rejects.toThrow(/ck_refurb_decision_ack/)
        await expect(insertDecision("CONFIRMED", {})).rejects.toThrow(/ck_refurb_decision_ack/)
        await expect(insertDecision("CONFIRMED", { notWriteBack: true }, "x")).rejects.toThrow(/ck_refurb_decision_hashes/)
        await expect(insertDecision("CONFIRMED", { notWriteBack: true }, "d".repeat(64), "y")).rejects.toThrow(/ck_refurb_decision_hashes/)
        await insertDecision("DECLINED", { notWriteBack: false }) // declining needs no acknowledgement
        await expect(insertDecision("CONFIRMED", { notWriteBack: true })).rejects.toThrow(/uq_refurb_decision_one_per_proposal/)
      } finally {
        await env.cleanup()
      }
    })

    it("nothing in these tables can reach a Saved Deal: the schema has no reference from them to saved-deal figures, only key links", async () => {
      const cols = await db.query<{ table_name: string; column_name: string }>(
        `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name IN ('refurb_measurement_sets','refurb_financial_proposals','refurb_financial_decisions','refurb_plan_confirmations')`,
        [S]
      )
      const names = cols.rows.map((c) => c.column_name)
      for (const forbidden of ["purchase_price", "gdv_realistic", "refurb_cost", "governance_state", "capital_protection_state", "pipeline_state"]) expect(names, forbidden).not.toContain(forbidden)
      // and no trigger on saved_deals or Investor Shield tables was added by these migrations
      const triggers = await db.query<{ tgname: string }>(
        `SELECT t.tgname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = $1 AND c.relname IN ('saved_deals','investor_shield_checks') AND NOT t.tgisinternal`,
        [S]
      )
      expect(triggers.rows.map((t) => t.tgname).filter((n) => /refurb/.test(n))).toEqual([])
    })
  })

  const flowEnv = async (): Promise<RefurbFlowEnv> => {
    const { pgViewingAssessmentRepository } = await import("@/lib/viewing-assessment/pg-viewing-assessment-repository")
    const { pgRefurbPlanRepository } = await import("@/lib/refurb-integration/pg-plan-repository")
    const { pgMeasurementRepository } = await import("@/lib/refurb-integration/pg-measurement-repository")
    const { pgFinancialProposalRepository } = await import("@/lib/refurb-integration/pg-financial-proposal-repository")
    const { getSavedDealById } = await import("@/lib/operator-command/saved-deals-repository")
    const { loadPdfEvidencePackForDeal } = await import("@/lib/pdf-evidence-pack/load-pdf-evidence-pack")
    const dealA = await makeDeal("flow-a")
    const dealB = await makeDeal("flow-b")
    const tables = ["investor_shield_checks", "evidence_items", "risk_flags", "manual_overrides", "deal_offers", "deal_tasks", "deal_evidence"]
    return {
      viewing: pgViewingAssessmentRepository,
      plans: pgRefurbPlanRepository,
      measurements: pgMeasurementRepository,
      proposals: pgFinancialProposalRepository,
      changeDeal: async (id, patch) => {
        if (patch.refurb_cost !== undefined) await db.query(`UPDATE ${S}.saved_deals SET refurb_cost = $2, updated_at = NOW() WHERE id = $1`, [id, patch.refurb_cost])
        if (patch.purchase_price !== undefined) await db.query(`UPDATE ${S}.saved_deals SET purchase_price = $2, updated_at = NOW() WHERE id = $1`, [id, patch.purchase_price])
      },
      dealA,
      dealB,
      getDeal: getSavedDealById,
      loadPack: (dealId, generatedAt) => loadPdfEvidencePackForDeal({ dealId, generatedAt, confidentialityLabel: "INTERNAL USE ONLY - DRAFT" }),
      // the saved deal row and every Investor Shield / evidence / offer / task row of the deal, exactly as stored
      snapshot: async (dealId) => {
        const parts: unknown[] = [(await db.query(`SELECT * FROM ${S}.saved_deals WHERE id = $1`, [dealId])).rows]
        for (const t of tables) parts.push((await db.query(`SELECT * FROM ${S}.${t} WHERE deal_id = $1 ORDER BY 1`, [dealId]).catch(() => ({ rows: [] }))).rows)
        return JSON.stringify(parts)
      },
      cleanup: async () => removeDeals([dealA, dealB]),
    }
  }

  defineRefurbIntegrationFlow("real PostgreSQL, real Saved Deals / Investor Shield / evidence-pack services", flowEnv)
  defineMeasureFinanceFlow("real PostgreSQL, real Saved Deals / Investor Shield / evidence-pack services", flowEnv)
})
