import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { DocumentDeps } from "@/lib/refurb-integration/documents-service"
import { loadBuilderPack, loadDealPassport } from "@/lib/refurb-integration/documents-service"
import { confirmPlan, getCurrentPlan, loadWorkProposal, previewPlan, type PlanDeps } from "@/lib/refurb-integration/plan-service"
import type { ConfirmRequest } from "@/lib/refurb-integration/plan-request-validation"
import type { FinancialProposalRepository } from "@/lib/refurb-integration/financial-proposal-repository"
import type { MeasurementRepository } from "@/lib/refurb-integration/measurement-repository"
import type { RefurbPlanRepository } from "@/lib/refurb-integration/plan-repository"
import { reviewProposalAction } from "@/lib/viewing-assessment/viewing-assessment-service"
import type { ViewingAssessmentRepository } from "@/lib/viewing-assessment/viewing-assessment-repository"
import { ACCEPT, ASSUMPTIONS, BASICS, seedAssessment, type Seeded } from "../fixtures/refurb-seed"

// End-to-end behaviour of: reviewed findings -> proposal -> human-confirmed plan -> builder pack -> Deal Passport,
// against REAL stored data. Run with the in-memory repositories on every test run, and with real PostgreSQL (real
// Saved Deals, real evidence-pack and Investor Shield services) only in the confirmed local QA database.

export type RefurbFlowEnv = {
  viewing: ViewingAssessmentRepository
  plans: RefurbPlanRepository
  measurements: MeasurementRepository
  proposals: FinancialProposalRepository
  /** Test setup only (never application code): change a stored Saved Deal figure, as a person editing the deal elsewhere would. */
  changeDeal: (dealId: string, patch: { refurb_cost?: number; purchase_price?: number }) => Promise<void>
  dealA: string
  dealB: string
  getDeal: PlanDeps["getDeal"]
  loadPack: DocumentDeps["loadPack"]
  /** Everything stored about the deal that this feature must never change (deal row, Investor Shield state). */
  snapshot: (dealId: string) => Promise<unknown>
  cleanup: () => Promise<void>
}

const NOW = new Date("2026-10-22T10:00:00.000Z")

export function defineRefurbIntegrationFlow(label: string, setup: () => Promise<RefurbFlowEnv>) {
  describe(`reviewed findings -> plan -> builder pack -> Deal Passport (${label})`, () => {
    let env: RefurbFlowEnv
    let deps: DocumentDeps
    let seeded: Seeded
    let ids: Record<string, string> // checkId -> proposal id (first per check)

    beforeEach(async () => {
      env = await setup()
      deps = { viewing: env.viewing, plans: env.plans, measurements: env.measurements, proposals: env.proposals, getDeal: env.getDeal, loadPack: env.loadPack, now: () => NOW }
      seeded = await seedAssessment(env.viewing, env.dealA, [
        { checkId: "C01", status: "CONCERN", observation: "Slipped tiles on rear slope", frames: [3, 1], suggestedWork: "Replace whole roof, roughly 40k", review: ACCEPT },
        { checkId: "C41", status: "CONCERN", observation: "Bath sealant failed", frames: [2], review: ACCEPT },
        { checkId: "C08", status: "CONCERN", observation: "Cracked render", frames: [0], review: ACCEPT },
        { checkId: "C10", status: "SPECIALIST_REVIEW", observation: "Crack-like line", frames: [0], review: ACCEPT },
        { checkId: "C39", status: "CONCERN", observation: "Unit doors swollen", frames: [0] }, // never reviewed
        { checkId: "C15", status: "CONCERN", observation: "Uneven path", frames: [1], review: { disposition: "REJECTED", reason: "Not a defect" } },
        { checkId: "C37", status: "OBSERVED", observation: "Consumer unit visible", frames: [1], review: ACCEPT },
        { checkId: "V09", status: "CONCERN", observation: "Possible title issue", frames: [1], review: ACCEPT },
      ])
      ids = {}
      const detail = await env.viewing.listProposals(env.dealA, seeded.assessmentId)
      for (const p of detail!) ids[p.proposal.checkId] ??= p.proposal.id
    })
    afterEach(async () => {
      await env.cleanup()
    })

    const request = (over: Partial<ConfirmRequest> & { fingerprint: string }): ConfirmRequest => ({
      idempotencyKey: "confirm-key-0001",
      expectedFingerprint: over.fingerprint,
      accepted: [{ itemId: "roof" }, { itemId: "bathroom" }, { itemId: "external-walls" }, { itemId: "external-walls:inspect" }],
      propertyBasics: BASICS,
      financialAssumptions: ASSUMPTIONS,
      ...over,
    })
    const fingerprint = async () => (await loadWorkProposal(deps, env.dealA, seeded.assessmentId))!.proposal.fingerprint

    it("proposes work only from reviewed, evidenced, works-related findings, and says what it left out and why", async () => {
      const { proposal } = (await loadWorkProposal(deps, env.dealA, seeded.assessmentId))!
      expect(proposal.items.map((i) => i.itemId)).toEqual(["roof", "bathroom", "external-walls", "external-walls:inspect"])
      const reasons = Object.fromEntries(proposal.excluded.map((e) => [e.checkId, e.reason]))
      expect(reasons).toMatchObject({ C39: "UNREVIEWED", C15: "REJECTED", C37: "OBSERVED_ONLY", V09: "NOT_A_WORKS_CHECK" })
      expect(proposal.analysisSource).toBe("SIMULATED")
      const roof = proposal.items.find((i) => i.itemId === "roof")!
      expect(roof.sources[0].evidence.map((e) => e.timestampSeconds).sort((a, b) => a - b)).toEqual([12, 31]) // exact frames, real timestamps
    })

    it("a preview shows cost, schedule and financial impact and writes nothing", async () => {
      const before = await env.snapshot(env.dealA)
      const out = await previewPlan(deps, env.dealA, seeded.assessmentId, { propertyBasics: BASICS, financialAssumptions: ASSUMPTIONS })
      expect(out.status).toBe("ok")
      if (out.status !== "ok") return
      expect(out.selection).toBe("ALL_PROPOSED_DEFAULT")
      expect(out.computation.estimate.status).toBe("COMPUTED")
      expect(out.computation.estimate.totalRefurbCost).toBeGreaterThan(0) // roof placeholder allowance from the engine
      expect(out.computation.schedule.timeline).not.toBeNull()
      expect(out.computation.financialImpact.status).toBe("COMPUTED")
      expect(out.computation.estimate.unpricedItems.map((u) => u.itemId).sort()).toEqual(["bathroom", "external-walls", "external-walls:inspect"])
      expect(await env.plans.list(env.dealA, seeded.assessmentId)).toEqual([])
      expect(await env.snapshot(env.dealA)).toEqual(before)
    })

    it("human confirmation records the accepted items with their full source trail and the engine's numbers at that moment", async () => {
      const fp = await fingerprint()
      const out = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp }))
      expect(out.status).toBe("ok")
      if (out.status !== "ok") return
      const rec = out.record
      expect(rec).toMatchObject({ dealId: env.dealA, assessmentId: seeded.assessmentId, version: 1, confirmedBy: "operator-7", confirmedAt: NOW.toISOString(), sourceFingerprint: fp, analysisSource: "SIMULATED" })
      expect(rec.acceptedItems.map((i) => i.itemId)).toEqual(["roof", "bathroom", "external-walls", "external-walls:inspect"])
      expect(rec.acceptedItems[0].sources[0]).toMatchObject({ proposalId: ids.C01, reviewerId: "operator-1", disposition: "ACCEPTED", checkId: "C01" })
      expect(rec.excluded.some((e) => e.checkId === "C39" && e.reason === "UNREVIEWED")).toBe(true)
      expect(rec.propertyBasics).toEqual(BASICS)
      expect(rec.financialAssumptions).toEqual(ASSUMPTIONS)
      expect(rec.computation.financialImpact.savedDealUnchanged).toBe(true)

      // the stored snapshot is exactly what a preview of the same choices shows
      const preview = await previewPlan(deps, env.dealA, seeded.assessmentId, { accepted: request({ fingerprint: fp }).accepted, propertyBasics: BASICS, financialAssumptions: ASSUMPTIONS })
      expect(preview.status === "ok" && preview.computation).toEqual(rec.computation)
    })

    it("accepting findings in the plan changes no Saved Deal data, no governance, and no Investor Shield result", async () => {
      const before = await env.snapshot(env.dealA)
      const packBefore = await env.loadPack(env.dealA, NOW.toISOString())
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
      await loadDealPassport(deps, env.dealA, seeded.assessmentId)
      expect(await env.snapshot(env.dealA)).toEqual(before)
      const packAfter = await env.loadPack(env.dealA, NOW.toISOString())
      expect(packAfter!.investorShield).toEqual(packBefore!.investorShield)
      expect(packAfter!.investorSummary).toEqual(packBefore!.investorSummary)
    })

    it("an item that is not in the reviewed proposal cannot be accepted (unreviewed, rejected, observed, unsupported)", async () => {
      const fp = await fingerprint()
      for (const itemId of ["kitchen", "grounds", "electrics", "electrics:inspect", "nonsense", "roof:inspect"]) {
        const out = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, idempotencyKey: `k-${itemId.replace(/[^a-z]/g, "")}-0001`, accepted: [{ itemId }] }))
        expect([itemId, out.status]).toEqual([itemId, "invalid"])
      }
      expect(await env.plans.list(env.dealA, seeded.assessmentId)).toEqual([])
    })

    it("only levels the proposal allows can be chosen, and a human-chosen level is recorded as such", async () => {
      const fp = await fingerprint()
      const bad = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, idempotencyKey: "level-bad-0001", accepted: [{ itemId: "bathroom", level: "gold_plated" }] }))
      expect(bad.status).toBe("invalid")
      const lowering = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, idempotencyKey: "level-low-0001", accepted: [{ itemId: "bathroom", level: "cosmetic" }] }))
      expect(lowering.status).toBe("invalid") // below the proposed level is not offered
      const good = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, idempotencyKey: "level-ok-00001", accepted: [{ itemId: "bathroom", level: "full_replace" }] }))
      expect(good.status).toBe("ok")
      if (good.status !== "ok") return
      expect(good.record.acceptedItems[0]).toMatchObject({ levelChosenByHuman: true, scopeEffect: { field: "bathroom.scope", level: "full_replace" } })
      expect(good.record.computation.estimate.totalRefurbCost).toBeGreaterThan(0) // the engine prices a full bathroom replacement
    })

    it("a duplicate submission returns the stored confirmation; a reused key with different content is refused; a new key makes version 2", async () => {
      const fp = await fingerprint()
      const first = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp }))
      const replay = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp }))
      expect(first.status === "ok" && !first.replayed).toBe(true)
      expect(replay.status === "ok" && replay.replayed && first.status === "ok" && replay.record.id === first.record.id).toBe(true)
      expect((await env.plans.list(env.dealA, seeded.assessmentId)).length).toBe(1)

      const reused = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, accepted: [{ itemId: "roof" }] }))
      expect(reused.status).toBe("key_reused")

      const second = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, idempotencyKey: "confirm-key-0002", accepted: [{ itemId: "roof" }] }))
      expect(second.status === "ok" && second.record.version).toBe(2)
      expect((await env.plans.getCurrent(env.dealA, seeded.assessmentId))!.version).toBe(2)
      expect((await env.plans.list(env.dealA, seeded.assessmentId)).map((p) => p.version)).toEqual([2, 1]) // history preserved, nothing edited
    })

    it("a plan goes stale when findings are reviewed afterwards, and confirming needs the fingerprint the human actually saw", async () => {
      const fp = await fingerprint()
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp }))
      const view = await getCurrentPlan(deps, env.dealA, seeded.assessmentId)
      expect(view && view !== "not_found" && view.stale).toBe(false)

      await reviewProposalAction(env.viewing, { dealId: env.dealA, assessmentId: seeded.assessmentId, proposalId: ids.C39, body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-2" })
      const stale = await getCurrentPlan(deps, env.dealA, seeded.assessmentId)
      expect(stale && stale !== "not_found" && stale.stale).toBe(true)

      const old = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp, idempotencyKey: "after-review-001" }))
      expect(old.status).toBe("stale")
      const fresh = await fingerprint()
      expect(fresh).not.toBe(fp)
      const proposal = (await loadWorkProposal(deps, env.dealA, seeded.assessmentId))!.proposal
      expect(proposal.items.map((i) => i.itemId)).toContain("kitchen") // now reviewed, now proposable
      const ok = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fresh, idempotencyKey: "after-review-001", accepted: [{ itemId: "kitchen", level: "full_replace" }] }))
      expect(ok.status).toBe("ok")
    })

    it("a replay of an already-stored confirmation still works after findings have moved on", async () => {
      const fp = await fingerprint()
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp }))
      await reviewProposalAction(env.viewing, { dealId: env.dealA, assessmentId: seeded.assessmentId, proposalId: ids.C39, body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-2" })
      const replay = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: fp }))
      expect(replay.status === "ok" && replay.replayed).toBe(true)
    })

    it("another deal can reach nothing: proposal, preview, confirmation, plan, builder pack and passport are all not found", async () => {
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      const other = await seedAssessment(env.viewing, env.dealB, [{ checkId: "C01", status: "CONCERN", review: ACCEPT }])
      const A = seeded.assessmentId
      expect(await loadWorkProposal(deps, env.dealB, A)).toBeNull()
      expect((await previewPlan(deps, env.dealB, A, {})).status).toBe("not_found")
      expect((await confirmPlan(deps, env.dealB, A, "operator-7", request({ fingerprint: "a".repeat(64), idempotencyKey: "cross-deal-0001" }))).status).toBe("not_found")
      expect(await getCurrentPlan(deps, env.dealB, A)).toBe("not_found")
      expect(await env.plans.getCurrent(env.dealB, A)).toBeNull()
      expect(await env.plans.findByKey(env.dealB, A, "confirm-key-0001")).toBeNull()
      expect((await loadBuilderPack(deps, env.dealB, A)).status).toBe("not_found")
      expect((await loadDealPassport(deps, env.dealB, A)).status).toBe("not_found")
      // and the other deal's own assessment has no plan of its own
      expect(await env.plans.getCurrent(env.dealB, other.assessmentId)).toBeNull()
      expect((await loadBuilderPack(deps, env.dealB, other.assessmentId)).status).toBe("no_plan")
      // a plan is never reachable through someone else's assessment id either
      expect((await loadDealPassport(deps, env.dealA, other.assessmentId)).status).toBe("not_found")
    })

    it("AI free text, including cost claims, never reaches a plan, a builder pack or the passport", async () => {
      const out = await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      expect(out.status).toBe("ok")
      const pack = await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
      const passport = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
      for (const doc of [out, pack, passport]) expect(JSON.stringify(doc)).not.toMatch(/roughly 40k|Replace whole roof/)
    })

    it("builder pack: needs a confirmed plan, is a draft, cites frames and times, and withholds our own estimate", async () => {
      expect((await loadBuilderPack(deps, env.dealA, seeded.assessmentId)).status).toBe("no_plan")
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      const out = await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
      expect(out.status).toBe("ok")
      if (out.status !== "ok") return
      const p = out.pack
      expect(p).toMatchObject({ kind: "BUILDER_QUOTATION_REQUEST_PACK", status: "DRAFT", approval: "NOT_APPROVED", assessmentId: seeded.assessmentId, confidentiality: { internalEstimateIncluded: false, engineRatesIncluded: false, investorFiguresIncluded: false, governanceInformationIncluded: false } })
      expect(p.simulatedDataWarning).toMatch(/SIMULATED/)
      expect(p.plan).toMatchObject({ version: 1, stale: false })
      const roof = p.items.find((i) => i.itemId === "roof")!
      expect(roof.evidence.map((e) => e.timestampSeconds).sort((a, b) => a - b)).toEqual([12, 31])
      expect(roof.evidence[0].observation).toBe("Slipped tiles on rear slope")
      expect(p.items.find((i) => i.itemId === "external-walls:inspect")).toMatchObject({ specialistInspectionRequired: true, priceRequested: false })
      expect(p.items.find((i) => i.itemId === "external-walls")).toMatchObject({ priceRequested: true, kind: "UNPRICED" })
      expect(p.pricingSheet.lines.map((l) => l.itemId).sort()).toEqual(["bathroom", "external-walls", "roof"]) // one blank line per item to price; none for the inspection
      expect(p.pricingSheet.lines.every((l) => l.priceExcludingVat === null && l.durationWorkingDays === null)).toBe(true)
      expect(p.exclusions.length).toBeGreaterThan(3)
      expect(p.builderVerificationRequired.join(" ")).toMatch(/is an estimate .*please check on site/)
      expect(p.requestedFromBuilder.length).toBeGreaterThan(3)
      expect(p.disclaimers.join(" ")).toMatch(/not a quotation, a contract/)

      // no monetary figures from our estimate anywhere in the pack
      const { internalKeysIn } = await import("./refurb-measure-finance-flow")
      expect(internalKeysIn(p)).toEqual([])
      expect(JSON.stringify(p)).not.toContain("£")
    })

    it("builder pack warns when the plan is stale", async () => {
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      await reviewProposalAction(env.viewing, { dealId: env.dealA, assessmentId: seeded.assessmentId, proposalId: ids.C39, body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-2" })
      const out = await loadBuilderPack(deps, env.dealA, seeded.assessmentId)
      expect(out.status === "ok" && out.pack.plan.stale).toBe(true)
      expect(out.status === "ok" && out.pack.disclaimers.join(" ")).toMatch(/Re-confirm the plan/)
    })

    it("Deal Passport: assembles the existing services' output unchanged, lists what is outstanding, and traces every source", async () => {
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      const out = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
      expect(out.status).toBe("ok")
      if (out.status !== "ok") return
      const p = out.passport
      const pack = (await env.loadPack(env.dealA, NOW.toISOString()))!
      const stored = (await env.getDeal(env.dealA))!

      expect(p).toMatchObject({ kind: "DEAL_PASSPORT", status: "DRAFT", approval: "NOT_APPROVED", generatedAt: NOW.toISOString() })
      expect(p.simulatedDataWarning).toMatch(/SIMULATED/)
      // reused services, unchanged
      expect(p.investorShield).toEqual(pack.investorShield)
      expect(p.deal.investorSummary).toEqual(pack.investorSummary)
      expect(p.evidence).toEqual(pack.evidenceIndex)
      expect(p.disclaimers).toEqual(pack.disclaimers)
      expect(p.provenance.packMeta).toEqual(pack.meta)
      // stored deal, shown as stored
      expect(p.deal.stored).toMatchObject({ classification: stored.classification, governanceState: stored.governance_state, capitalProtectionState: stored.capital_protection_state, pipelineState: stored.pipeline_state })
      expect(p.deal.stored.purchasePrice).toBe(Number(stored.purchase_price))
      // inspection + refurbishment + financial
      expect(p.inspection).toMatchObject({ assessmentId: seeded.assessmentId, analysisSource: "SIMULATED", findingsAwaitingReview: 1, specialistInspectionsRequired: 1, evidenceFrameCount: 4 })
      expect(p.refurbishment).toMatchObject({ status: "CONFIRMED", planVersion: 1, confirmedBy: "operator-7" })
      expect(p.financial.confirmedScopeSnapshot).toEqual(p.refurbishment.computation!.financialImpact)
      expect(p.financial.confirmedScopeSnapshot!.scenario!.refurbCost).toBe(p.refurbishment.computation!.estimate.totalRefurbCost)
      expect(p.financial.authoritative).toMatchObject({ dealId: env.dealA, governanceState: stored.governance_state })
      expect(p.financial.proposal.status).toBe("NONE") // a scope is not a financial proposal
      // outstanding decisions are explicit
      const codes = p.outstandingDecisions.map((d) => d.code)
      expect(codes).toEqual(expect.arrayContaining(["FINDINGS_AWAITING_REVIEW", "SPECIALIST_INSPECTIONS", "UNPRICED_ITEMS", "SIMULATED_DATA"]))
      expect(codes).not.toContain("NO_CONFIRMED_PLAN")
      // provenance: every source of every accepted item, with review ids and frames
      const sources = p.refurbishment.acceptedItems.flatMap((i) => i.sources.map((s) => [i.itemId, s.proposalId, s.reviewId]))
      expect(p.provenance.sourceTrail.map((t) => [t.itemId, t.proposalId, t.reviewId])).toEqual(sources)
      expect(p.provenance.sourceTrail.every((t) => t.evidenceIds.length > 0 && t.reviewerId === "operator-1")).toBe(true)
      expect(p.provenance.planHistory).toEqual([{ planId: p.refurbishment.planId, version: 1, confirmedAt: NOW.toISOString(), confirmedBy: "operator-7", measurementSetVersion: null }])
    })

    it("Deal Passport without a plan, or without an assessment, says so instead of inventing content", async () => {
      const noPlan = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
      expect(noPlan.status === "ok" && noPlan.passport.refurbishment.status).toBe("NO_PLAN")
      expect(noPlan.status === "ok" && noPlan.passport.outstandingDecisions.map((d) => d.code)).toContain("NO_CONFIRMED_PLAN")
      expect(noPlan.status === "ok" && noPlan.passport.financial.confirmedScopeSnapshot).toBeNull()
      expect(noPlan.status === "ok" && noPlan.passport.financial.proposal.status).toBe("NONE")
      const bare = await loadDealPassport(deps, env.dealA, null)
      expect(bare.status === "ok" && bare.passport.inspection).toBeNull()
      expect(bare.status === "ok" && bare.passport.outstandingDecisions.map((d) => d.code)).toEqual(expect.arrayContaining(["NO_INSPECTION", "NO_CONFIRMED_PLAN"]))
    })

    it("Deal Passport marks a stale plan and does not hide it", async () => {
      await confirmPlan(deps, env.dealA, seeded.assessmentId, "operator-7", request({ fingerprint: await fingerprint() }))
      await reviewProposalAction(env.viewing, { dealId: env.dealA, assessmentId: seeded.assessmentId, proposalId: ids.C39, body: { expectedRevision: 0, disposition: "ACCEPTED" }, reviewerId: "operator-2" })
      const out = await loadDealPassport(deps, env.dealA, seeded.assessmentId)
      expect(out.status === "ok" && out.passport.refurbishment.status).toBe("CONFIRMED_STALE")
      expect(out.status === "ok" && out.passport.outstandingDecisions.map((d) => d.code)).toContain("PLAN_STALE")
    })
  })
}
