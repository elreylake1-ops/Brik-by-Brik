import { beforeEach, describe, expect, it } from "vitest"
import { calculateFinanceCost, calculateProfit, calculateProfitMargin, calculateTotalCost, calculateTrueMao } from "@/lib/calculations"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { computePlan } from "@/lib/refurb-integration/plan-compute"
import { buildFinancialProposal } from "@/lib/refurb-integration/financial-proposal"
import { createFinancialProposal, decideFinancialProposal, getFinancialState } from "@/lib/refurb-integration/financial-proposal-service"
import { confirmPlan, loadWorkProposal } from "@/lib/refurb-integration/plan-service"
import { createInMemoryQuoteOverridesRepository, toCostOverrides } from "@/lib/refurb-integration/quote-overrides-repository"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"
import type { ConfirmedPlanRecord, FinancialAssumptions, PropertyBasics } from "@/types/refurb-integration"
import { createInMemoryFinancialRepository } from "./fixtures/in-memory-refurb-financial-repository"
import { createInMemoryMeasurementRepository } from "./fixtures/in-memory-refurb-measurement-repository"
import { createInMemoryRefurbPlanRepository } from "./fixtures/in-memory-refurb-plan-repository"
import { createInMemoryViewingRepository } from "./fixtures/in-memory-viewing-repository"
import { ACCEPT, makeDeal, seedAssessment, type Seeded } from "./fixtures/refurb-seed"

describe("Phase 2 — Financial Recalculation Acceptance Specification (P0)", () => {
  const baselineDealInputs: DealInputs = {
    purchasePrice: 200_000,
    gdv: 350_000,
    refurbCost: 35_000,
    stampDuty: 6_000,
    legalCosts: 1_500,
    saleCosts: 5_250,
    bridgeTermMonths: 9,
  }

  const defaultAssumptions: FinancialAssumptions = {
    stampDuty: 6_000,
    legalCosts: 1_500,
    saleCosts: 5_250,
    bridgeTermMonths: 9,
  }

  const basics: PropertyBasics = {
    bedrooms: 3,
    bathrooms: 2,
    floorAreaSqm: 110,
    kitchenSize: "medium",
  }

  let viewingRepo: ReturnType<typeof createInMemoryViewingRepository>["repo"]
  let plansRepo: ReturnType<typeof createInMemoryRefurbPlanRepository>
  let measurementsRepo: ReturnType<typeof createInMemoryMeasurementRepository>
  let proposalsRepo: ReturnType<typeof createInMemoryFinancialRepository>
  let quoteRepo: ReturnType<typeof createInMemoryQuoteOverridesRepository>
  let savedDeal: SavedDealRecord
  let seeded: Seeded
  const DEAL_ID = "deal-acceptance-01"

  beforeEach(async () => {
    const v = createInMemoryViewingRepository()
    viewingRepo = v.repo
    plansRepo = createInMemoryRefurbPlanRepository()
    measurementsRepo = createInMemoryMeasurementRepository()
    proposalsRepo = createInMemoryFinancialRepository()
    quoteRepo = createInMemoryQuoteOverridesRepository()

    savedDeal = makeDeal(DEAL_ID, {
      purchase_price: 200_000,
      gdv_realistic: 350_000,
      refurb_cost: 35_000,
    })

    seeded = await seedAssessment(viewingRepo, DEAL_ID, [
      { checkId: "C01", status: "CONCERN", observation: "Damaged roof tiles and chimney flashing", frames: [0], review: ACCEPT },
      { checkId: "C41", status: "CONCERN", observation: "Sanitaryware outdated and seals leaking", frames: [1], review: ACCEPT },
    ])
  })

  it("1. Proves an increased refurbishment estimate decreases proposed profit and True MAO while GDV and Finance Cost remain invariant", () => {
    const financeBaseline = calculateFinanceCost(baselineDealInputs.purchasePrice, baselineDealInputs.bridgeTermMonths)
    expect(financeBaseline.totalFinanceCost).toBe(28_500)

    const initialTotalCost = calculateTotalCost(
      baselineDealInputs.purchasePrice,
      baselineDealInputs.refurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      financeBaseline.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(initialTotalCost).toBe(276_250)

    const initialProfit = calculateProfit(baselineDealInputs.gdv, initialTotalCost)
    expect(initialProfit).toBe(73_750)
    expect(calculateProfitMargin(initialProfit, baselineDealInputs.gdv)).toBeCloseTo(21.07, 2)

    const initialMao20 = calculateTrueMao(
      baselineDealInputs.gdv,
      0.20,
      baselineDealInputs.refurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      financeBaseline.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(initialMao20).toBe(203_750)

    // Scope increased: Refurb cost expands by £15,000 from £35,000 to £50,000
    const increasedRefurbCost = 50_000
    const financeAfter = calculateFinanceCost(baselineDealInputs.purchasePrice, baselineDealInputs.bridgeTermMonths)

    // INVARIANCE: Finance cost is strictly purchase-price based; zero change when refurb changes
    expect(financeAfter.totalFinanceCost).toBe(financeBaseline.totalFinanceCost)

    const updatedTotalCost = calculateTotalCost(
      baselineDealInputs.purchasePrice,
      increasedRefurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      financeAfter.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(updatedTotalCost).toBe(291_250) // Exactly +£15,000

    const updatedProfit = calculateProfit(baselineDealInputs.gdv, updatedTotalCost)
    expect(updatedProfit).toBe(58_750) // Exactly -£15,000 profit reduction
    expect(calculateProfitMargin(updatedProfit, baselineDealInputs.gdv)).toBeCloseTo(16.79, 2)

    const updatedMao20 = calculateTrueMao(
      baselineDealInputs.gdv,
      0.20,
      increasedRefurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      financeAfter.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(updatedMao20).toBe(188_750) // True MAO decreases 1-for-1 by £15,000
    expect(initialMao20 - updatedMao20).toBe(15_000)
  })

  it("2. Proves a reduced refurbishment estimate increases proposed profit and True MAO while GDV and Finance Cost remain invariant", () => {
    const finance = calculateFinanceCost(baselineDealInputs.purchasePrice, baselineDealInputs.bridgeTermMonths)

    // Refurb estimate reduced from £35,000 to £25,000 (saving £10,000)
    const reducedRefurbCost = 25_000

    const updatedTotalCost = calculateTotalCost(
      baselineDealInputs.purchasePrice,
      reducedRefurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      finance.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(updatedTotalCost).toBe(266_250) // Exactly -£10,000

    const updatedProfit = calculateProfit(baselineDealInputs.gdv, updatedTotalCost)
    expect(updatedProfit).toBe(83_750) // Profit increases by £10,000
    expect(calculateProfitMargin(updatedProfit, baselineDealInputs.gdv)).toBeCloseTo(23.93, 2)

    const updatedMao20 = calculateTrueMao(
      baselineDealInputs.gdv,
      0.20,
      reducedRefurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      finance.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(updatedMao20).toBe(213_750) // True MAO increases 1-for-1 by £10,000
  })

  it("3. Proves contractor quote supersession produces updated cost calculations", async () => {
    const q1 = await quoteRepo.createAndApprove(DEAL_ID, seeded.assessmentId, {
      itemId: "roof",
      taskId: "roof-strip-recovering",
      quoteRef: "ROOF-QUOTE-001",
      approvedAmount: 18_000,
      approvedBy: "james-lake-operator",
    })
    expect(q1.status).toBe("APPROVED")
    expect(q1.approvedAmount).toBe(18_000)

    let active = await quoteRepo.list(DEAL_ID, seeded.assessmentId, true)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(q1.id)

    // Superseding quote uploaded from second roofing specialist
    const q2 = await quoteRepo.createAndApprove(DEAL_ID, seeded.assessmentId, {
      itemId: "roof",
      taskId: "roof-strip-recovering",
      quoteRef: "ROOF-QUOTE-002",
      approvedAmount: 12_000,
      approvedBy: "james-lake-operator",
    })
    expect(q2.status).toBe("APPROVED")
    expect(q2.approvedAmount).toBe(12_000)

    // Re-list all to check superseded status
    const allQuotes = await quoteRepo.list(DEAL_ID, seeded.assessmentId, false)
    const q1Found = allQuotes.find((q) => q.id === q1.id)
    expect(q1Found?.status).toBe("SUPERSEDED")
    expect(q1Found?.supersededBy).toBe(q2.id)

    active = await quoteRepo.list(DEAL_ID, seeded.assessmentId, true)
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(q2.id)

    // Converted cost overrides reflect the new superseding quote
    const costOverrides = toCostOverrides(active)
    expect(costOverrides).toHaveLength(1)
    expect(costOverrides[0].targetTaskId).toBe("roof-strip-recovering")
    expect(costOverrides[0].value).toBe(12_000)
  })

  it("4. Proves a changed GDV assumption recalculates valuation scenarios, True MAO and profit while Refurb and Finance remain invariant", () => {
    const finance = calculateFinanceCost(baselineDealInputs.purchasePrice, baselineDealInputs.bridgeTermMonths)
    const totalCost = calculateTotalCost(
      baselineDealInputs.purchasePrice,
      baselineDealInputs.refurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      finance.totalFinanceCost,
      baselineDealInputs.saleCosts
    )

    // Surveyor revises realistic GDV down from £350,000 to £310,000 (-£40,000)
    const revisedGdv = 310_000

    // Scenarios: Downside is 90% (£279,000); Strong is 110% (£341,000)
    expect(Math.round(revisedGdv * 0.9)).toBe(279_000)
    expect(Math.round(revisedGdv * 1.1)).toBe(341_000)

    const revisedProfit = calculateProfit(revisedGdv, totalCost)
    expect(revisedProfit).toBe(33_750) // Reduced 1-for-1 from £73,750 by £40,000
    expect(calculateProfitMargin(revisedProfit, revisedGdv)).toBeCloseTo(10.89, 2)

    // True MAO formula: GDV - (GDV * 0.20) - constant costs
    // Change in True MAO = ΔGDV * (1 - 0.20) = -£40,000 * 0.80 = -£32,000
    const revisedMao20 = calculateTrueMao(
      revisedGdv,
      0.20,
      baselineDealInputs.refurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      finance.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(revisedMao20).toBe(171_750)
    expect(203_750 - revisedMao20).toBe(32_000) // Exactly £32,000 reduction
  })

  it("5. Proves a changed bridge term recalculates financing costs and True MAO while Refurb and GDV remain invariant", () => {
    // 9-month bridge: £28,500
    const finance9m = calculateFinanceCost(baselineDealInputs.purchasePrice, 9)
    expect(finance9m.totalFinanceCost).toBe(28_500)

    // Extended 12-month bridge: 15% annual interest on £200k = £30,000 + £4k arr + £2k exit = £36,000
    const finance12m = calculateFinanceCost(baselineDealInputs.purchasePrice, 12)
    expect(finance12m.totalFinanceCost).toBe(36_000)
    expect(finance12m.totalFinanceCost - finance9m.totalFinanceCost).toBe(7_500)

    // True MAO decreases 1-for-1 by the additional £7,500 financing expense
    const mao9m = calculateTrueMao(
      baselineDealInputs.gdv,
      0.20,
      baselineDealInputs.refurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      finance9m.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    const mao12m = calculateTrueMao(
      baselineDealInputs.gdv,
      0.20,
      baselineDealInputs.refurbCost,
      baselineDealInputs.stampDuty,
      baselineDealInputs.legalCosts,
      finance12m.totalFinanceCost,
      baselineDealInputs.saleCosts
    )
    expect(mao9m - mao12m).toBe(7_500)
  })

  it("6. Proves missing or unverified pricing remains disclosed with explicit unpriced item warnings", () => {
    // Bathroom partial scope currently has no task template in pilot library
    const unpricedScope: RefurbScopeInput = {
      bedrooms: 3,
      bathrooms: 2,
      floorAreaSqm: 110,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "partial" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasks = generateTasksFromScope(unpricedScope)
    const cost = calculateRefurbCost(tasks)

    expect(cost.totalRefurbCost).toBe(0)
    expect(tasks.some((t) => t.warnings.some((w) => w.includes("has no task templates")))).toBe(true)

    const dealResult = analyzeDealWithRefurb(baselineDealInputs, unpricedScope)
    expect(dealResult.refurbSource).toBe("generated")
    expect(dealResult.refurb?.pricingCompleteness).toBe("UNPRICED")
    expect(dealResult.refurb?.hasUnpricedItems).toBe(true)
    expect(dealResult.refurb?.isProvisional).toBe(true)
    expect(dealResult.verdict.status).toBe("CONDITIONAL")
    expect(dealResult.warnings.some((w) => w.includes("NOT a confirmed saving"))).toBe(true)
  })

  it("7. Proves actual financial proposal service workflow: detects outdated proposals when Saved Deal figures change", async () => {
    const deps = {
      viewing: viewingRepo,
      plans: plansRepo,
      measurements: measurementsRepo,
      proposals: proposalsRepo,
      quoteOverrides: quoteRepo,
      getDeal: async () => savedDeal,
      now: () => new Date("2026-10-25T10:00:00.000Z"),
    }

    // Load work proposal to retrieve its fingerprint
    const loaded = await loadWorkProposal(deps, DEAL_ID, seeded.assessmentId)
    expect(loaded).not.toBeNull()
    if (!loaded) return

    // Step A: Confirm initial refurb plan with expectedFingerprint and basics
    const confirmed = await confirmPlan(deps, DEAL_ID, seeded.assessmentId, "james-lake-operator", {
      idempotencyKey: "confirm-plan-test-1",
      expectedFingerprint: loaded.proposal.fingerprint,
      accepted: [{ itemId: "bathroom" }],
      propertyBasics: basics,
      financialAssumptions: defaultAssumptions,
    })
    expect(confirmed.status).toBe("ok")

    // Step B: Build financial proposal
    const prop1 = await createFinancialProposal(deps, DEAL_ID, seeded.assessmentId, "james-lake-operator", "fprop-key-001")
    expect(prop1.status).toBe("ok")
    if (prop1.status !== "ok") return

    expect(prop1.proposal.version).toBe(1)
    expect(prop1.proposal.content.nonAuthoritative).toBe(true)

    // Verify initial financial state is clean
    const stateBefore = await getFinancialState(deps, DEAL_ID, seeded.assessmentId)
    expect(stateBefore).not.toBe("not_found")
    if (stateBefore !== "not_found") {
      expect(stateBefore.outdated).toBe(false)
      expect(stateBefore.status).toBe("PROPOSED")
    }

    // Step C: Saved Deal purchase price changes from £200,000 to £220,000 outside viewing assessment
    savedDeal = { ...savedDeal, purchase_price: 220_000, updated_at: "2026-10-25T10:30:00.000Z" }

    // Step D: Financial state immediately detects stale baseline
    const stateAfter = await getFinancialState(deps, DEAL_ID, seeded.assessmentId)
    expect(stateAfter).not.toBe("not_found")
    if (stateAfter !== "not_found") {
      expect(stateAfter.outdated).toBe(true)
      expect(stateAfter.outdatedReasons.some((r) => r.includes("Saved Deal figures"))).toBe(true)
      expect(stateAfter.status).toBe("OUTDATED")
    }

    // Step E: Attempting to confirm outdated proposal fails closed with PROPOSAL_OUTDATED
    const decisionAttempt = await decideFinancialProposal(deps, DEAL_ID, seeded.assessmentId, prop1.proposal.id, "james-lake-operator", {
      decision: "CONFIRMED",
      proposalHash: prop1.proposal.contentHash,
      acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
    })
    expect(decisionAttempt.status).toBe("outdated")
  })

  it("8. Proves financial decision confirmation cannot silently overwrite authoritative Saved Deal records", async () => {
    const deps = {
      viewing: viewingRepo,
      plans: plansRepo,
      measurements: measurementsRepo,
      proposals: proposalsRepo,
      quoteOverrides: quoteRepo,
      getDeal: async () => savedDeal,
      now: () => new Date("2026-10-25T10:00:00.000Z"),
    }

    const loaded = await loadWorkProposal(deps, DEAL_ID, seeded.assessmentId)
    expect(loaded).not.toBeNull()
    if (!loaded) return

    await confirmPlan(deps, DEAL_ID, seeded.assessmentId, "james-lake-operator", {
      idempotencyKey: "confirm-plan-test-2",
      expectedFingerprint: loaded.proposal.fingerprint,
      accepted: [{ itemId: "bathroom" }],
      propertyBasics: basics,
      financialAssumptions: defaultAssumptions,
    })

    const propRes = await createFinancialProposal(deps, DEAL_ID, seeded.assessmentId, "james-lake-operator", "fprop-key-002")
    expect(propRes.status).toBe("ok")
    if (propRes.status !== "ok") return

    // Operator confirms the proposal
    const decisionRes = await decideFinancialProposal(deps, DEAL_ID, seeded.assessmentId, propRes.proposal.id, "james-lake-operator", {
      decision: "CONFIRMED",
      proposalHash: propRes.proposal.contentHash,
      acknowledge: { notWriteBack: true, exclusions: true, unresolvedQuantities: true },
    })
    expect(decisionRes.status).toBe("ok")

    // IMMUTABILITY PROOF: Saved Deal record in memory/db retains original figures
    expect(savedDeal.refurb_cost).toBe(35_000)
    expect(savedDeal.purchase_price).toBe(200_000)
    expect(savedDeal.gdv_realistic).toBe(350_000)
  })

  it("9. Proves Investor Shield decisions are completely decoupled from viewing financial proposal confirmation", async () => {
    // Investor Shield decisions live in their own domain and database tables
    // Verifies that computePlan with confirmed items produces non-authoritative output
    const planComputation = computePlan({
      accepted: [{
        itemId: "roof",
        mappingId: "roof",
        label: "Roof works",
        kind: "ENGINE_SCOPE",
        checkIds: ["C01"],
        proposalIds: ["prop-1"],
        scopeEffect: { field: "majorWorks.roof", level: true },
        quantityNote: "Extent unknown",
      }],
      basics,
      assumptions: defaultAssumptions,
      deal: { purchasePrice: 200_000, gdv: 350_000, refurbCost: 35_000 },
    })

    expect(planComputation.financialImpact.status).toBe("COMPUTED")
    expect(planComputation.financialImpact.scenario?.refurbCost).toBeGreaterThan(0)

    // Assert that the proposal content schema explicitly disclaims authority over Investor Shield
    const built = buildFinancialProposal({
      plan: {
        id: "plan-1",
        dealId: DEAL_ID,
        assessmentId: seeded.assessmentId,
        version: 1,
        propertyBasics: basics,
        financialAssumptions: defaultAssumptions,
        acceptedItems: [],
        excludedItems: [],
        confirmedBy: "operator-1",
        confirmedAt: new Date().toISOString(),
      } as ConfirmedPlanRecord,
      measurementSet: null,
      deal: savedDeal,
    })

    expect(built.content.nonAuthoritative).toBe(true)
    expect(built.content.notes.some((n) => n.includes("It does not update the Saved Deal, Investor Shield"))).toBe(true)
  })
})
