import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { NewPlanConfirmation, RefurbPlanRepository } from "@/lib/refurb-integration/plan-repository"
import type { ConfirmedPlanRecord } from "@/types/refurb-integration"
import { ASSUMPTIONS, BASICS } from "../fixtures/refurb-seed"

// Behavioural contract for RefurbPlanRepository: in-memory double and real PostgreSQL must agree.

export type PlanContractEnv = {
  plans: RefurbPlanRepository
  dealA: string
  dealB: string
  /** assessments that exist: A1 and A2 belong to dealA, B1 to dealB */
  assessmentA1: string
  assessmentA2: string
  assessmentB1: string
  cleanup: () => Promise<void>
}

const hex = (c: string) => c.repeat(64)

export function planInput(env: PlanContractEnv, over: Partial<NewPlanConfirmation> = {}): NewPlanConfirmation {
  return {
    dealId: env.dealA,
    assessmentId: env.assessmentA1,
    idempotencyKey: "plan-key-0001",
    requestHash: hex("a"),
    sourceFingerprint: hex("b"),
    analysisSource: "SIMULATED",
    acceptedItems: [
      {
        itemId: "roof",
        mappingId: "roof",
        kind: "ENGINE_SCOPE",
        label: "Roof works",
        area: "roof",
        scopeEffect: { field: "majorWorks.roof", level: true },
        levelChosenByHuman: false,
        quantityNote: "Extent unknown",
        sources: [],
      },
    ],
    excluded: [{ proposalId: "p1", checkId: "C39", reason: "UNREVIEWED" }],
    propertyBasics: BASICS,
    measurementSetId: null,
    measurementSetVersion: null,
    financialAssumptions: ASSUMPTIONS,
    computation: {
      scopeInput: null,
      estimate: { status: "BLOCKED", blockedBy: ["X"], totalRefurbCost: null, labourCost: null, materialCost: null, lines: [], unpricedItems: [], provisionalAllowances: [], confidenceFlags: [] },
      schedule: { status: "BLOCKED", timeline: null, unscheduledItems: [], assumptions: [] },
      financialImpact: { status: "BLOCKED", blockedBy: ["X"], baseline: null, scenario: null, delta: null, inputs: { purchasePrice: 1, gdv: 2, baselineRefurbCost: 3 }, savedDealUnchanged: true, note: "n" },
      assumptions: ["a"],
      warnings: [],
      engineInputs: { dealInputs: null, scope: null },
    },
    confirmedBy: "operator-1",
    confirmedAt: "2026-10-22T10:00:00.000Z",
    ...over,
  }
}

export function definePlanRepositoryContract(label: string, setup: () => Promise<PlanContractEnv>) {
  describe(`RefurbPlanRepository contract: ${label}`, () => {
    let env: PlanContractEnv
    beforeEach(async () => {
      env = await setup()
    })
    afterEach(async () => {
      await env.cleanup()
    })

    const created = (r: Awaited<ReturnType<RefurbPlanRepository["create"]>>): ConfirmedPlanRecord => {
      if (r.status === "key_reused") throw new Error("unexpected key_reused")
      return r.record
    }

    it("creates version 1, round-trips every field exactly, and reads it back as current", async () => {
      const input = planInput(env)
      const r = await env.plans.create(input)
      expect(r.status).toBe("created")
      const rec = created(r)
      expect(rec).toMatchObject({ dealId: env.dealA, assessmentId: env.assessmentA1, version: 1, idempotencyKey: "plan-key-0001", sourceFingerprint: hex("b"), analysisSource: "SIMULATED", confirmedBy: "operator-1", confirmedAt: "2026-10-22T10:00:00.000Z" })
      expect(rec.acceptedItems).toEqual(input.acceptedItems)
      expect(rec.excluded).toEqual(input.excluded)
      expect(rec.propertyBasics).toEqual(BASICS)
      expect(rec.financialAssumptions).toEqual(ASSUMPTIONS)
      expect(rec.computation).toEqual(input.computation)
      expect(await env.plans.getCurrent(env.dealA, env.assessmentA1)).toEqual(rec)
    })

    it("keeps null financial assumptions as null", async () => {
      const rec = created(await env.plans.create(planInput(env, { financialAssumptions: null })))
      expect(rec.financialAssumptions).toBeNull()
    })

    it("numbers versions per assessment, keeps history newest first, and never edits an earlier version", async () => {
      const v1 = created(await env.plans.create(planInput(env)))
      const v2 = created(await env.plans.create(planInput(env, { idempotencyKey: "plan-key-0002", requestHash: hex("c") })))
      const other = created(await env.plans.create(planInput(env, { assessmentId: env.assessmentA2, idempotencyKey: "plan-key-0001" })))
      expect([v1.version, v2.version, other.version]).toEqual([1, 2, 1])
      expect((await env.plans.getCurrent(env.dealA, env.assessmentA1))!.id).toBe(v2.id)
      expect((await env.plans.list(env.dealA, env.assessmentA1)).map((p) => p.version)).toEqual([2, 1])
      expect((await env.plans.list(env.dealA, env.assessmentA1))[1]).toEqual(v1)
    })

    it("treats the same key and request as a replay (nothing new written), and the same key with a different request as reuse", async () => {
      const first = created(await env.plans.create(planInput(env)))
      const again = await env.plans.create(planInput(env))
      expect(again.status).toBe("replayed")
      expect(created(again)).toEqual(first)
      expect((await env.plans.list(env.dealA, env.assessmentA1)).length).toBe(1)
      expect((await env.plans.create(planInput(env, { requestHash: hex("d") }))).status).toBe("key_reused")
      expect((await env.plans.list(env.dealA, env.assessmentA1)).length).toBe(1)
    })

    it("finds a stored confirmation by key together with the hash of the request that made it", async () => {
      const first = created(await env.plans.create(planInput(env)))
      const found = await env.plans.findByKey(env.dealA, env.assessmentA1, "plan-key-0001")
      expect(found).toEqual({ record: first, requestHash: hex("a") })
      expect(await env.plans.findByKey(env.dealA, env.assessmentA1, "no-such-key-1")).toBeNull()
    })

    it("handles concurrent submissions of one key without duplicating", async () => {
      const results = await Promise.all(Array.from({ length: 5 }, () => env.plans.create(planInput(env))))
      expect(results.filter((r) => r.status === "created")).toHaveLength(1)
      expect(results.filter((r) => r.status === "replayed")).toHaveLength(4)
      expect((await env.plans.list(env.dealA, env.assessmentA1)).length).toBe(1)
    })

    it("scopes every read by deal AND assessment", async () => {
      created(await env.plans.create(planInput(env)))
      expect(await env.plans.getCurrent(env.dealB, env.assessmentA1)).toBeNull()
      expect(await env.plans.getCurrent(env.dealA, env.assessmentA2)).toBeNull()
      expect(await env.plans.getCurrent(env.dealB, env.assessmentB1)).toBeNull()
      expect(await env.plans.list(env.dealB, env.assessmentA1)).toEqual([])
      expect(await env.plans.findByKey(env.dealB, env.assessmentA1, "plan-key-0001")).toBeNull()
      expect(await env.plans.findByKey(env.dealA, env.assessmentA2, "plan-key-0001")).toBeNull()
    })
  })
}
