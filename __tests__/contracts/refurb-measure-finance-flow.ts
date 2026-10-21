import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { loadBuilderPack, loadDealPassport, type DocumentDeps } from "@/lib/refurb-integration/documents-service"
import { createFinancialProposal, decideFinancialProposal, getFinancialState } from "@/lib/refurb-integration/financial-proposal-service"
import type { DecisionRequest } from "@/lib/refurb-integration/financial-request-validation"
import { getMeasurementState, recordMeasurements } from "@/lib/refurb-integration/measurement-service"
import { parseMeasurementRequest } from "@/lib/refurb-integration/measurements"
import type { ConfirmRequest } from "@/lib/refurb-integration/plan-request-validation"
import { confirmPlan, getCurrentPlan, loadWorkProposal, previewPlan } from "@/lib/refurb-integration/plan-service"
import { reviewProposalAction } from "@/lib/viewing-assessment/viewing-assessment-service"
import type { FinancialProposalRecord } from "@/types/refurb-financial"
import { ACCEPT, ASSUMPTIONS, seedAssessment, type Seeded } from "../fixtures/refurb-seed"
import type { RefurbFlowEnv } from "./refurb-integration-flow"

// Measurements, quantity assumptions, the financial-impact PROPOSAL and the operator's decision about it, builder
// confidentiality and the three-layer Deal Passport. Run in memory on every test run and against real PostgreSQL (real Saved
// Deals, Investor Shield and evidence-pack services) in the confirmed local QA database.

const NOW = new Date("2026-10-23T10:00:00.000Z")

const entry = (key: string, value: number | string | null, over: Record<string, unknown> = {}) =>
  value === null
    ? { key, value: null, basis: "UNKNOWN", source: null, confidence: null, note: "Not yet visited", ...over }
    : { key, value, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "", ...over }

const GOOD = () => [
  entry("bedrooms", 3),
  entry("bathrooms", 1),
  entry("floorAreaSqm", 85, { source: "FLOOR_PLAN", confidence: "medium" }),
  entry("kitchenSize", "medium", { basis: "OPERATOR_ESTIMATE", source: "EPC_OR_LISTING", confidence: "medium", note: "Judged from the listing photos" }),
]

// Words in a key name (camelCase split), so that e.g. "generatedAt" is not mistaken for "rate".
const BANNED_KEY_WORDS = new Set(["cost", "costs", "rate", "rates", "labour", "profit", "margin", "mao", "gdv", "verdict", "governance", "estimate", "reviewer", "fingerprint", "hash", "purchase", "yield", "roi", "threshold"])
const ALLOWED_KEYS = new Set(["priceRequested", "priceExcludingVat", "totalExcludingVat", "internalEstimateIncluded", "engineRatesIncluded", "investorFiguresIncluded", "governanceInformationIncluded", "confirmedAt"])
export const internalKeysIn = (value: unknown): string[] => {
  const keys: string[] = []
  JSON.parse(JSON.stringify(value), (k, v) => (keys.push(k), v))
  return keys.filter((k) => k && !ALLOWED_KEYS.has(k) && k.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(" ").some((w) => BANNED_KEY_WORDS.has(w)))
}

export function defineMeasureFinanceFlow(label: string, setup: () => Promise<RefurbFlowEnv>) {
  describe(`measurements -> financial-impact proposal -> operator decision (${label})`, () => {
    let env: RefurbFlowEnv
    let deps: DocumentDeps
    let seeded: Seeded
    let ids: Record<string, string>
    let clock = NOW

    beforeEach(async () => {
      env = await setup()
      clock = NOW
      deps = { viewing: env.viewing, plans: env.plans, measurements: env.measurements, proposals: env.proposals, getDeal: env.getDeal, loadPack: env.loadPack, now: () => clock }
      seeded = await seedAssessment(env.viewing, env.dealA, [
        { checkId: "C01", status: "CONCERN", observation: "Slipped tiles on rear slope", frames: [3, 1], review: ACCEPT },
        { checkId: "C41", status: "CONCERN", observation: "Bath sealant failed", frames: [2], review: ACCEPT },
        { checkId: "C08", status: "CONCERN", observation: "Cracked render", frames: [0], review: ACCEPT },
        { checkId: "C10", status: "SPECIALIST_REVIEW", observation: "Crack-like line", frames: [0], review: ACCEPT },
        { checkId: "C39", status: "CONCERN", observation: "Unit doors swollen", frames: [0] },
      ])
      ids = {}
      for (const p of (await env.viewing.listProposals(env.dealA, seeded.assessmentId))!) ids[p.proposal.checkId] ??= p.proposal.id
    })
    afterEach(async () => {
      await env.cleanup()
    })

    // ---- helpers
    const record = async (entries: unknown[], basedOnVersion = 0, key = `meas-key-${basedOnVersion + 1}-aaaa`, changeNote: string | null = null, dealId = env.dealA, assessmentId = seeded.assessmentId) => {
      const parsed = parseMeasurementRequest({ idempotencyKey: key, basedOnVersion, ...(changeNote ? { changeNote } : {}), entries })
      if (!parsed.ok) throw new Error(parsed.errors.join("; "))
      return recordMeasurements(deps, dealId, assessmentId, "operator-5", parsed.value)
    }
    const fp = async () => (await loadWorkProposal(deps, env.dealA, seeded.assessmentId))!.proposal.fingerprint
    const confirmScope = async (over: Partial<ConfirmRequest> = {}, key = "plan-key-0001-aaaa") => {
      const m = await env.measurements.getCurrent(env.dealA, seeded.assessmentId)
      return confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", {
        idempotencyKey: key,
        expectedFingerprint: await fp(),
        accepted: [{ itemId: "roof" }, { itemId: "bathroom", level: "full_replace" }, { itemId: "external-walls" }],
        ...(m ? { measurementSetId: m.id } : {}),
        financialAssumptions: ASSUMPTIONS,
        ...over,
      })
    }
    const setUpPlan = async () => {
      const m = await record(GOOD())
      expect(m.status).toBe("ok")
      const c = await confirmScope()
      expect(c.status).toBe("ok")
      return c.status === "ok" ? c.record : (undefined as never)
    }
    const propose = async (actor = "operator-8", key = "prop-key-0001-aaaa") => {
      const out = await createFinancialProposal(deps, env.dealA, seeded.assessmentId, actor, key)
      if (out.status !== "ok") throw new Error(`proposal not created: ${out.status}`)
      return out.proposal
    }
    const decision = (p: FinancialProposalRecord, over: Partial<DecisionRequest> = {}): DecisionRequest => ({
      idempotencyKey: "decision-key-0001",
      decision: "CONFIRMED",
      proposalHash: p.contentHash,
      note: null,
      acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
      ...over,
    })
    const decide = (p: FinancialProposalRecord, over: Partial<DecisionRequest> = {}, actor = "operator-9") => decideFinancialProposal(deps, env.dealA, seeded.assessmentId, p.id, actor, decision(p, over))

    // ================================================================= measurements
    describe("measurements", () => {
      it("are recorded as append-only versions; a correction names its base and its reason; history shows exactly what changed", async () => {
        const v1 = await record(GOOD())
        expect(v1.status === "ok" && v1.record).toMatchObject({ version: 1, basedOnVersion: 0, recordedBy: "operator-5", changeNote: null })
        const corrected = GOOD().map((e) => (e.key === "floorAreaSqm" ? entry("floorAreaSqm", 84.5, { source: "LASER_MEASURE", confidence: "high" }) : e))
        const v2 = await record(corrected, 1, "meas-key-2-bbbb", "Re-measured with a laser")
        expect(v2.status === "ok" && v2.record).toMatchObject({ version: 2, basedOnVersion: 1, changeNote: "Re-measured with a laser" })
        const state = await getMeasurementState(deps, env.dealA, seeded.assessmentId)
        if (state === "not_found") throw new Error("missing")
        expect(state.history.map((h) => h.record.version)).toEqual([2, 1])
        expect(state.history[0].changesFromPrevious.map((c) => [c.key, c.change])).toEqual([["floorAreaSqm", "CHANGED"]])
        expect(state.history[0].changesFromPrevious[0].from).toMatch(/85 sqm \[MEASURED, FLOOR_PLAN, medium\]/)
        expect(state.history[0].changesFromPrevious[0].to).toMatch(/84.5 sqm \[MEASURED, LASER_MEASURE, high\]/)
        expect(state.history[1].record.entries.find((e) => e.key === "floorAreaSqm")!.value).toBe(85) // the earlier version is untouched
        expect(state.current!.version).toBe(2)
        expect(state.engineQuantities!.basics).toEqual({ bedrooms: 3, bathrooms: 1, floorAreaSqm: 84.5, kitchenSize: "medium" })
      })

      it("refuse a stale base and a reused key, and replay an identical submission", async () => {
        await record(GOOD())
        expect(await record(GOOD(), 0, "meas-key-other-cc")).toMatchObject({ status: "stale_base", currentVersion: 1 })
        expect((await record(GOOD(), 0, "meas-key-1-aaaa")).status).toBe("ok") // same key + same content: replay
        const replay = await record(GOOD(), 0, "meas-key-1-aaaa")
        expect(replay.status === "ok" && replay.replayed).toBe(true)
        expect(await record([entry("bedrooms", 5), entry("bathrooms", 2)], 0, "meas-key-1-aaaa")).toEqual({ status: "key_reused" })
        expect((await env.measurements.list(env.dealA, seeded.assessmentId)).length).toBe(1)
      })

      it("another deal can neither read nor write them", async () => {
        await record(GOOD())
        const other = await seedAssessment(env.viewing, env.dealB, [{ checkId: "C01", status: "CONCERN", review: ACCEPT }])
        expect(await getMeasurementState(deps, env.dealB, seeded.assessmentId)).toBe("not_found")
        expect((await record(GOOD(), 0, "meas-cross-0001", null, env.dealB, seeded.assessmentId)).status).toBe("not_found")
        expect(await env.measurements.getCurrent(env.dealB, seeded.assessmentId)).toBeNull()
        expect((await env.measurements.list(env.dealB, other.assessmentId)).length).toBe(0)
      })

      it("never change a plan, a proposal or the Saved Deal by being recorded", async () => {
        const before = await env.snapshot(env.dealA)
        await record(GOOD())
        expect(await env.snapshot(env.dealA)).toEqual(before)
        expect(await env.plans.list(env.dealA, seeded.assessmentId)).toEqual([])
      })
    })

    // ================================================================= scope from measurements
    describe("scope costed from recorded measurements", () => {
      it("without measurements nothing is costed; with them the engine is called with exactly the recorded quantities", async () => {
        const bare = await previewPlan(deps, env.dealA, seeded.assessmentId, { financialAssumptions: ASSUMPTIONS })
        expect(bare.status === "ok" && bare.basis).toMatchObject({ source: "NONE", blockedBy: ["PROPERTY_BASICS_MISSING"] })
        expect(bare.status === "ok" && bare.computation.estimate.status).toBe("BLOCKED")

        await record(GOOD())
        const out = await previewPlan(deps, env.dealA, seeded.assessmentId, { financialAssumptions: ASSUMPTIONS })
        expect(out.status).toBe("ok")
        if (out.status !== "ok") return
        expect(out.basis).toMatchObject({ source: "LATEST_MEASUREMENT_SET", measurementSetVersion: 1, blockedBy: [] })
        expect(out.basis.basisNotes.join(" | ")).toMatch(/Bedrooms: 3, measured \(tape measure, high confidence\)/)
        expect(out.computation.scopeInput).toMatchObject({ bedrooms: 3, bathrooms: 1, floorAreaSqm: 85, kitchen: { size: "medium" } })
      })

      it("confirming records the measurement set version, and the quantity basis travels with the plan as stated assumptions", async () => {
        const rec = await setUpPlan()
        expect(rec).toMatchObject({ measurementSetVersion: 1, propertyBasics: { bedrooms: 3, bathrooms: 1, floorAreaSqm: 85, kitchenSize: "medium" } })
        expect(rec.measurementSetId).toBeTruthy()
        expect(rec.computation.assumptions.join(" | ")).toMatch(/Quantity basis: Kitchen size: medium, operator estimate/)
        expect(rec.computation.estimate.totalRefurbCost).toBeGreaterThan(0)
      })

      it("the 6A path with typed-in basics still works and is marked as having no measurement record", async () => {
        const out = await confirmScope({ measurementSetId: undefined, propertyBasics: { bedrooms: 3, bathrooms: 1, kitchenSize: "medium" } }, "plan-key-legacy-1")
        expect(out.status === "ok" && out.record).toMatchObject({ measurementSetId: null, measurementSetVersion: null })
        const pack = await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
        expect(pack.status === "ok" && pack.pack.measurements.entries.map((m) => [m.label, m.basis])).toEqual([["Bedrooms", "OPERATOR_ESTIMATE"], ["Bathrooms", "OPERATOR_ESTIMATE"], ["Kitchen size", "OPERATOR_ESTIMATE"]])
      })

      it("unknown or missing bedrooms and bathrooms cannot be confirmed, and are never filled in", async () => {
        await record([entry("bedrooms", null), entry("bathrooms", 1)])
        const out = await confirmScope()
        expect(out.status === "invalid" && out.errors.join(" ")).toMatch(/BEDROOMS_UNKNOWN/)
        expect(await env.plans.list(env.dealA, seeded.assessmentId)).toEqual([])
        const preview = await previewPlan(deps, env.dealA, seeded.assessmentId, { financialAssumptions: ASSUMPTIONS })
        expect(preview.status === "ok" && preview.computation.estimate).toMatchObject({ status: "BLOCKED", blockedBy: ["PROPERTY_BASICS_MISSING"] })
      })

      it("unknown floor area still costs, with the engine's own room-count warning and the gap stated", async () => {
        await record([entry("bedrooms", 3), entry("bathrooms", 1), entry("floorAreaSqm", null), entry("kitchenSize", "medium", { basis: "OPERATOR_ESTIMATE", source: "OTHER", confidence: "low", note: "Guess from photos" })])
        const out = await confirmScope({ accepted: [{ itemId: "roof" }] })
        expect(out.status).toBe("ok")
        const flooring = await confirmFlooringIfProposed()
        void flooring
        const state = await getMeasurementState(deps, env.dealA, seeded.assessmentId)
        if (state === "not_found") throw new Error("missing")
        expect(state.engineQuantities!.unresolved.join(" | ")).toMatch(/Floor area is unknown: flooring is priced by the engine on a room-count basis/)
      })

      async function confirmFlooringIfProposed() {
        // flooring is not among this assessment's reviewed findings, so there is nothing further to confirm
        return (await loadWorkProposal(deps, env.dealA, seeded.assessmentId))!.proposal.items.some((i) => i.itemId === "flooring")
      }

      it("a kitchen replacement cannot be costed without a recorded kitchen size, but other work still can", async () => {
        await reviewProposalAction(env.viewing, { dealId: env.dealA, assessmentId: seeded.assessmentId, proposalId: ids.C39, body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-2" })
        await record([entry("bedrooms", 3), entry("bathrooms", 1), entry("kitchenSize", null)])
        const blocked = await confirmScope({ accepted: [{ itemId: "kitchen", level: "full_replace" }, { itemId: "roof" }] }, "plan-key-kitchen-1")
        expect(blocked.status === "ok" && blocked.record.computation.estimate).toMatchObject({ status: "BLOCKED", blockedBy: ["KITCHEN_SIZE_MISSING"] })
        const fine = await confirmScope({ accepted: [{ itemId: "roof" }] }, "plan-key-kitchen-2")
        expect(fine.status === "ok" && fine.record.computation.estimate.status).toBe("COMPUTED")
        expect(fine.status === "ok" && fine.record.computation.assumptions.join(" ")).toMatch(/Kitchen size was not recorded; it is not used because no kitchen replacement is in scope/)
      })

      it("an older measurement set cannot be used, and a newer one makes the confirmed plan stale", async () => {
        await record(GOOD())
        const v1 = await env.measurements.getCurrent(env.dealA, seeded.assessmentId)
        const plan = await confirmScope()
        expect(plan.status).toBe("ok")
        const v2 = await record(GOOD().map((e) => (e.key === "bathrooms" ? entry("bathrooms", 2) : e)), 1, "meas-key-2-bbbb", "There is a second bathroom")
        expect(v2.status).toBe("ok")
        expect(await confirmScope({ measurementSetId: v1!.id }, "plan-key-old-set-1")).toMatchObject({ status: "stale_measurements" })
        const view = await getCurrentPlan(deps, env.dealA, seeded.assessmentId)
        expect(view && view !== "not_found" && [view.stale, view.staleReasons]).toEqual([true, ["MEASUREMENTS_CHANGED"]])
        // findings change too: both reasons are reported
        await reviewProposalAction(env.viewing, { dealId: env.dealA, assessmentId: seeded.assessmentId, proposalId: ids.C39, body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-2" })
        const both = await getCurrentPlan(deps, env.dealA, seeded.assessmentId)
        expect(both && both !== "not_found" && both.staleReasons).toEqual(["FINDINGS_CHANGED", "MEASUREMENTS_CHANGED"])
        expect(await createFinancialProposal(deps, env.dealA, seeded.assessmentId, "operator-8", "prop-key-stale-1")).toMatchObject({ status: "plan_stale" })
      })
    })

    // ================================================================= financial proposal
    describe("financial-impact proposal", () => {
      it("needs a confirmed plan", async () => {
        expect(await createFinancialProposal(deps, env.dealA, seeded.assessmentId, "operator-8", "prop-key-none-1")).toEqual({ status: "no_plan" })
        expect(await createFinancialProposal(deps, env.dealB, seeded.assessmentId, "operator-8", "prop-key-none-2")).toEqual({ status: "not_found" })
      })

      it("is the existing engine's output beside the authoritative Saved Deal, referencing the scope and its reviewers", async () => {
        const plan = await setUpPlan()
        const p = await propose()
        const c = p.content
        const deal = (await env.getDeal(env.dealA))!
        const inputs = { purchasePrice: Number(deal.purchase_price), gdv: Number(deal.gdv_realistic), refurbCost: Number(deal.refurb_cost), ...ASSUMPTIONS }
        const before = analyzeDealWithRefurb(inputs)
        const after = analyzeDealWithRefurb(inputs, plan.computation.scopeInput!)

        expect(c.nonAuthoritative).toBe(true)
        expect(c.completeness).toBe("HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES")
        expect(c.authoritative).toMatchObject({ dealId: env.dealA, governanceState: deal.governance_state, pipelineState: deal.pipeline_state, purchasePrice: 100000, gdvRealistic: 190000, refurbCost: 25000 })
        expect(c.recalculatedBaseline).toMatchObject({ refurbCost: 25000, totalCost: before.deal.totalCost, profit: before.deal.profit, verdictStatus: before.verdict.status })
        expect(c.proposed).toMatchObject({ refurbCost: after.refurb!.totalRefurbCost, totalCost: after.deal.totalCost, profit: after.deal.profit, profitMargin: after.deal.profitMargin, verdictStatus: after.verdict.status, trueMao: after.deal.trueMao })
        expect(c.delta).toEqual({ refurbCost: after.refurb!.totalRefurbCost - 25000, totalCost: after.deal.totalCost - before.deal.totalCost, profit: after.deal.profit - before.deal.profit, profitMargin: after.deal.profitMargin - before.deal.profitMargin })
        expect(c.storedVersusRecalculated.consistent).not.toBe(false)

        expect(c.plan).toMatchObject({ planId: plan.id, planVersion: 1, confirmedBy: "operator-7", measurementSetVersion: 1, sourceReviewers: ["operator-1"] })
        expect(c.plan.acceptedItems.find((i) => i.itemId === "roof")).toMatchObject({ checkIds: ["C01"], proposalIds: [ids.C01] })
        expect(c.changedAssumptions.join(" | ")).toMatch(/Refurbishment cost: the Saved Deal holds .*25,000.* this proposal uses/)
        expect(c.changedAssumptions.join(" | ")).toMatch(/supplied by the operator when the scope was confirmed/)
        expect(c.changedAssumptions.join(" | ")).toMatch(/Quantity: Bedrooms: 3, measured/)
        expect(c.exclusions.map((e) => e.itemId)).toEqual(["external-walls"]) // the engine cannot price it
        expect(c.unresolvedQuantities.join(" | ")).toMatch(/Kitchen size is an estimate/)
        expect(c.unresolvedQuantities.join(" | ")).toMatch(/Roof works: provisional allowance/)
        expect(c.notes.join(" ")).toMatch(/does not update the Saved Deal/)
        expect(p).toMatchObject({ version: 1, planId: plan.id, createdBy: "operator-8" })
      })

      it("is created idempotently; a changed Saved Deal gives a new version and marks the earlier one out of date", async () => {
        await setUpPlan()
        const first = await propose()
        const again = await createFinancialProposal(deps, env.dealA, seeded.assessmentId, "operator-8", "prop-key-0002-bbbb")
        expect(again.status === "ok" && [again.replayed, again.proposal.id]).toEqual([true, first.id])

        await env.changeDeal(env.dealA, { refurb_cost: 31000 })
        const state = await getFinancialState(deps, env.dealA, seeded.assessmentId)
        if (state === "not_found") throw new Error("missing")
        expect(state).toMatchObject({ status: "OUTDATED", outdated: true })
        expect(state.outdatedReasons.join(" ")).toMatch(/Saved Deal figures .* have changed/)

        const second = await createFinancialProposal(deps, env.dealA, seeded.assessmentId, "operator-8", "prop-key-0003-cccc")
        expect(second.status === "ok" && [second.replayed, second.proposal.version]).toEqual([false, 2])
        expect(second.status === "ok" && second.proposal.content.recalculatedBaseline!.refurbCost).toBe(31000)
        expect((await env.proposals.listProposals(env.dealA, seeded.assessmentId)).map((x) => x.version)).toEqual([2, 1])
        expect((await getFinancialState(deps, env.dealA, seeded.assessmentId) as { status: string }).status).toBe("PROPOSED")
      })

      it("when the plan has no deal assumptions it is not computable, and cannot be approved", async () => {
        await record(GOOD())
        expect((await confirmScope({ financialAssumptions: null })).status).toBe("ok")
        const p = await propose()
        expect(p.content).toMatchObject({ completeness: "NOT_COMPUTABLE", blockedBy: ["FINANCIAL_ASSUMPTIONS_MISSING"], proposed: null, delta: null })
        expect(await decide(p)).toMatchObject({ status: "not_computable", blockedBy: ["FINANCIAL_ASSUMPTIONS_MISSING"] })
        expect((await decide(p, { decision: "DECLINED", acknowledge: { notWriteBack: false, exclusions: false, unresolvedQuantities: false } })).status).toBe("ok") // declining is always allowed
      })
    })

    // ================================================================= the decision
    describe("operator decision", () => {
      it("confirming needs explicit acknowledgements and the exact proposal that was reviewed", async () => {
        await setUpPlan()
        const p = await propose()
        expect(await decide(p, { acknowledge: { notWriteBack: false, exclusions: true, unresolvedQuantities: true } })).toEqual({ status: "acknowledgement_required", missing: ["notWriteBack"] })
        expect(await decide(p, { acknowledge: { notWriteBack: true, exclusions: false, unresolvedQuantities: false } })).toEqual({ status: "acknowledgement_required", missing: ["exclusions", "unresolvedQuantities"] })
        expect(await decide(p, { proposalHash: "f".repeat(64) })).toEqual({ status: "hash_mismatch" })
        expect(await env.proposals.getDecision(env.dealA, seeded.assessmentId, p.id)).toBeNull()
      })

      it("records an auditable event naming the operator, what they acknowledged and the Saved Deal fingerprint at that moment", async () => {
        const plan = await setUpPlan()
        const p = await propose()
        clock = new Date(NOW.getTime() + 3_600_000)
        const out = await decide(p, { note: "Agreed for builder pricing" }, "operator-9")
        expect(out.status).toBe("ok")
        if (out.status !== "ok") return
        expect(out.event).toMatchObject({ proposalId: p.id, decision: "CONFIRMED", actor: "operator-9", note: "Agreed for builder pricing", acknowledged: { notWriteBack: true, exclusions: true, unresolvedQuantities: true }, sameOperatorAsScopeConfirmer: false, occurredAt: clock.toISOString() })
        expect(out.event.baselineFingerprint).toMatch(/^[a-f0-9]{64}$/)
        expect(plan.confirmedBy).toBe("operator-7")

        const sameOp = await propose("operator-8", "prop-key-0009-zzzz") // identical content: same proposal
        expect(sameOp.id).toBe(p.id)
        const state = await getFinancialState(deps, env.dealA, seeded.assessmentId)
        expect(state !== "not_found" && [state.status, state.decision?.actor]).toEqual(["CONFIRMED", "operator-9"])
      })

      it("is idempotent; a different key cannot decide again; a reused key with different content is refused", async () => {
        await setUpPlan()
        const p = await propose()
        const first = await decide(p)
        const replay = await decide(p)
        expect(first.status === "ok" && replay.status === "ok" && [replay.replayed, replay.event.id]).toEqual([true, first.status === "ok" ? first.event.id : ""])
        expect((await decide(p, { idempotencyKey: "decision-key-0002" })).status).toBe("already_decided")
        expect((await decide(p, { decision: "DECLINED" })).status).toBe("key_reused")
        await expect(env.proposals.getDecision(env.dealA, seeded.assessmentId, p.id)).resolves.toMatchObject({ decision: "CONFIRMED" })
      })

      it("an approved adjustment of the Saved Deal is NOT an update of it: deal row, governance and Investor Shield are unchanged", async () => {
        await setUpPlan()
        const before = await env.snapshot(env.dealA)
        const packBefore = await env.loadPack(env.dealA, NOW.toISOString())
        const p = await propose()
        expect((await decide(p)).status).toBe("ok")
        expect(await env.snapshot(env.dealA)).toEqual(before)
        const packAfter = await env.loadPack(env.dealA, NOW.toISOString())
        expect(packAfter!.investorShield).toEqual(packBefore!.investorShield)
        expect(packAfter!.investorSummary).toEqual(packBefore!.investorSummary)
        const deal = (await env.getDeal(env.dealA))!
        expect(Number(deal.refurb_cost)).toBe(25000) // still the authoritative figure, not the proposed one
      })

      it("cannot confirm a proposal that went out of date, or one that is not the latest; declining still works", async () => {
        await setUpPlan()
        const first = await propose()
        await env.changeDeal(env.dealA, { refurb_cost: 31000 })
        expect(await decide(first)).toMatchObject({ status: "outdated" })
        const second = await createFinancialProposal(deps, env.dealA, seeded.assessmentId, "operator-8", "prop-key-0004-dddd")
        if (second.status !== "ok") throw new Error("expected a new proposal")
        expect(await decide(first, { idempotencyKey: "decision-key-0003" })).toEqual({ status: "not_latest" })
        expect((await decide(second.proposal)).status).toBe("ok")
        const declined = await decideFinancialProposal(deps, env.dealA, seeded.assessmentId, first.id, "operator-9", decision(first, { idempotencyKey: "decision-key-0004", decision: "DECLINED" }))
        expect(declined.status).toBe("not_latest") // history is not decided after the fact
      })

      it("an approval stays on record as approved but is flagged out of date when the Saved Deal later changes", async () => {
        await setUpPlan()
        const p = await propose()
        expect((await decide(p)).status).toBe("ok")
        await env.changeDeal(env.dealA, { purchase_price: 120000 })
        const state = await getFinancialState(deps, env.dealA, seeded.assessmentId)
        expect(state !== "not_found" && [state.status, state.outdated]).toEqual(["CONFIRMED", true])
        const passport = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
        expect(passport.status === "ok" && passport.passport.outstandingDecisions.map((d) => d.code)).toEqual(expect.arrayContaining(["FINANCIAL_APPROVAL_OUTDATED", "NO_WRITE_BACK"]))
      })

      it("another deal cannot create, read or decide proposals for this assessment", async () => {
        await setUpPlan()
        const p = await propose()
        expect(await getFinancialState(deps, env.dealB, seeded.assessmentId)).toBe("not_found")
        expect(await decideFinancialProposal(deps, env.dealB, seeded.assessmentId, p.id, "operator-9", decision(p))).toEqual({ status: "not_found" })
        expect(await env.proposals.getProposal(env.dealB, seeded.assessmentId, p.id)).toBeNull()
        expect(await env.proposals.listProposals(env.dealB, seeded.assessmentId)).toEqual([])
        expect(await env.proposals.getDecision(env.dealB, seeded.assessmentId, p.id)).toBeNull()
        expect(await env.proposals.getDecision(env.dealA, seeded.assessmentId, p.id)).toBeNull()
      })
    })

    // ================================================================= builder confidentiality
    describe("builder pack confidentiality", () => {
      it("carries reviewed scope, measurements with their basis, evidence, exclusions and a blank pricing sheet, and nothing internal", async () => {
        await setUpPlan()
        const out = await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
        expect(out.status).toBe("ok")
        if (out.status !== "ok") return
        const pack = out.pack
        expect(pack).toMatchObject({ version: "builder-pack-v2", status: "DRAFT", approval: "NOT_APPROVED" })
        expect(pack.measurements).toMatchObject({ setVersion: 1 })
        expect(pack.measurements.entries.find((m) => m.label === "Bedrooms")).toMatchObject({ value: 3, basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high" })
        expect(pack.measurements.entries.find((m) => m.label === "Kitchen size")).toMatchObject({ basis: "OPERATOR_ESTIMATE", note: "Judged from the listing photos" })
        expect(pack.items.find((i) => i.itemId === "roof")!.evidence.map((e) => e.timestampSeconds).sort((a, b) => a - b)).toEqual([12, 31])
        expect(pack.items.find((i) => i.itemId === "roof")!.quantityBasis).toMatch(/to be established by the builder on site/)
        expect(pack.pricingSheet.lines.map((l) => l.itemId).sort()).toEqual(["bathroom", "external-walls", "roof"])
        expect(Object.values(pack.pricingSheet).filter((v) => v === null).length).toBeGreaterThanOrEqual(6)
        expect(pack.exclusions.length).toBeGreaterThan(3)
        expect(pack.confidentiality).toEqual({ internalEstimateIncluded: false, engineRatesIncluded: false, investorFiguresIncluded: false, governanceInformationIncluded: false })
      })

      it("contains none of: engine rates or labour days, our estimate, the Saved Deal's figures, profit/return/MAO/verdict/threshold language, governance or Shield information, operator identities", async () => {
        const plan = await setUpPlan()
        const proposal = await propose()
        await decide(proposal)
        const out = await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
        if (out.status !== "ok") throw new Error("no pack")
        const text = JSON.stringify({ ...out.pack, confidentiality: undefined }) // the flags that DENY content name it, so they are checked separately
        const deal = (await env.getDeal(env.dealA))!

        // numbers: the deal's own figures and our estimate, as whole numbers
        const secretNumbers = [Number(deal.purchase_price), Number(deal.gdv_realistic), Number(deal.refurb_cost), plan.computation.estimate.totalRefurbCost!, plan.computation.estimate.labourCost!, plan.computation.estimate.materialCost!, proposal.content.proposed!.profit, proposal.content.proposed!.totalCost]
        for (const n of secretNumbers) {
          const asText = String(Math.round(n))
          expect(new RegExp(`(?<![0-9.])${asText}(?![0-9])`).test(text), `pack contains ${asText}`).toBe(false)
        }
        // currency, rates and engine vocabulary
        expect(text).not.toMatch(/[£$€]/)
        expect(text).not.toMatch(/\b(day ?rate|labour|contingency|per sqm|allowance|material rate|trade rate)\b/i)
        // investor and governance vocabulary
        expect(text).not.toMatch(/\b(profit|margin|MAO|GDV|yield|ROI|return|verdict|threshold|capital protection|investor|governance|shield|purchase price|go\b|no-go|conditional)\b/i)
        // our engine and our people
        expect(text).not.toMatch(/analyzeDealWithRefurb|engine/i)
        for (const person of ["operator-1", "operator-5", "operator-7", "operator-8", "operator-9"]) expect(text).not.toContain(person)
        // structure: no monetary or internal keys
        expect(internalKeysIn(out.pack)).toEqual([])
      })

      it("builder-facing wording for every mapped work type is free of engine and pricing language", async () => {
        const { FINDING_WORK_MAPPINGS, builderNoteFor, BUILDER_INSPECTION_NOTE } = await import("@/lib/data/finding-work-mapping")
        for (const m of FINDING_WORK_MAPPINGS) expect(builderNoteFor(m.id), m.id).not.toMatch(/(engine|allowance|rate|rates|estimate|labour|cost|costs)|£/i)
        expect(BUILDER_INSPECTION_NOTE).not.toMatch(/(engine|allowance|rate|rates)|£/i)
      })
    })

    // ================================================================= passport
    describe("Deal Passport layers", () => {
      it("keeps the authoritative Saved Deal, the confirmed scope and the financial proposal apart, with the approval and correction history", async () => {
        await record(GOOD())
        await record(GOOD().map((e) => (e.key === "floorAreaSqm" ? entry("floorAreaSqm", 84.5, { source: "LASER_MEASURE" }) : e)), 1, "meas-key-2-bbbb", "Re-measured with a laser")
        const plan = await (async () => {
          const c = await confirmScope()
          return c.status === "ok" ? c.record : (undefined as never)
        })()
        const proposal = await propose()
        await decide(proposal, { note: "OK to take to builders" })

        const out = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
        expect(out.status).toBe("ok")
        if (out.status !== "ok") return
        const p = out.passport
        const stored = (await env.getDeal(env.dealA))!

        // layer 1: authoritative
        expect(p.financial.authoritative).toMatchObject({ dealId: env.dealA, governanceState: stored.governance_state, purchasePrice: 100000, refurbCost: 25000 })
        expect(p.deal.stored.refurbCost).toBe(25000)
        // layer 2: confirmed scope
        expect(p.refurbishment).toMatchObject({ status: "CONFIRMED", planId: plan.id, planVersion: 1, confirmedBy: "operator-7" })
        expect(p.financial.confirmedScopeSnapshot).toEqual(plan.computation.financialImpact)
        // layer 3: proposal and its approval
        expect(p.financial.proposal).toMatchObject({ status: "CONFIRMED", outdated: false })
        expect(p.financial.proposal.latest!.id).toBe(proposal.id)
        expect(p.financial.proposal.decision).toMatchObject({ decision: "CONFIRMED", actor: "operator-9", note: "OK to take to builders" })
        expect(p.financial.proposal.history).toEqual([expect.objectContaining({ version: 1, proposalId: proposal.id, decision: "CONFIRMED", decidedBy: "operator-9" })])
        expect(p.financial.statement).toMatch(/Saved Deal figures are authoritative/)
        // the proposal is not blended into the authoritative figures
        expect(p.financial.authoritative.refurbCost).not.toBe(p.financial.proposal.latest!.content.proposed!.refurbCost)
        // measurements and corrections
        expect(p.measurements.current).toMatchObject({ version: 2 })
        expect(p.measurements.history.map((h) => [h.version, h.changeNote, h.changes.length])).toEqual([[2, "Re-measured with a laser", 1], [1, null, 4]])
        expect(p.measurements.engineQuantityNotes.join(" ")).toMatch(/Floor area: 84.5 sqm, measured \(laser measure/)
        // provenance
        expect(p.provenance.planHistory).toEqual([{ planId: plan.id, version: 1, confirmedAt: NOW.toISOString(), confirmedBy: "operator-7", measurementSetVersion: 2 }])
        expect(p.provenance.sourceTrail.every((t) => t.reviewerId === "operator-1")).toBe(true)
        const codes = p.outstandingDecisions.map((d) => d.code)
        expect(codes).toContain("NO_WRITE_BACK")
        expect(codes).not.toContain("NO_FINANCIAL_PROPOSAL")
      })

      it("says what is outstanding at each stage: measurements, scope, proposal, decision", async () => {
        const codes = async () => {
          const o = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
          return o.status === "ok" ? o.passport.outstandingDecisions.map((d) => d.code) : []
        }
        expect(await codes()).toEqual(expect.arrayContaining(["NO_MEASUREMENTS", "NO_CONFIRMED_PLAN"]))
        await record([entry("bedrooms", null), entry("bathrooms", 1)])
        expect(await codes()).toContain("MEASUREMENTS_INCOMPLETE")
        await record(GOOD(), 1, "meas-key-2-bbbb", "Visited and measured")
        expect(await codes()).not.toContain("NO_MEASUREMENTS")
        await confirmScope()
        expect(await codes()).toContain("NO_FINANCIAL_PROPOSAL")
        const p = await propose()
        expect(await codes()).toContain("FINANCIAL_PROPOSAL_AWAITING_DECISION")
        await decide(p, { decision: "DECLINED" })
        expect(await codes()).toContain("FINANCIAL_PROPOSAL_DECLINED")
      })
    })
  })
}
