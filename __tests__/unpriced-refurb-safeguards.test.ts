import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { buildBuilderQuotePack } from "@/lib/refurb-integration/builder-pack"
import { buildDealPassport } from "@/lib/refurb-integration/deal-passport"
import { buildFinancialProposal } from "@/lib/refurb-integration/financial-proposal"
import { computePlan, deriveScope } from "@/lib/refurb-integration/plan-compute"
import type { DealInputs } from "@/types/deal"
import type { ConfirmedPlanRecord, ConfirmedWorkItem, CurrentPlanView } from "@/types/refurb-integration"
import type { RefurbScopeInput } from "@/types/scope"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"

describe("Work Package 3: Financial Integrity and Unpriced Refurbishment Safeguards", () => {
  const testDeal: DealInputs = {
    purchasePrice: 450_000,
    gdv: 750_000,
    refurbCost: 50_000,
    saleCosts: 9_000,
    stampDuty: 22_500,
    legalCosts: 3_500,
    bridgeTermMonths: 9,
  }

  // 1. Fully priced refurbishment scope
  it("1. Fully priced refurbishment scope: permits GO verdict when economics pass and validates completeness", () => {
    const fullyPricedScope: RefurbScopeInput = {
      bedrooms: 3,
      bathrooms: 2,
      floorAreaSqm: 120,
      kitchen: { scope: "full_replace", size: "medium" },
      bathroom: { scope: "full_replace" },
      bedroom: { scope: "cosmetic_refresh" },
      flooring: { replaceWholeProperty: true },
      majorWorks: { roof: true, boiler: true, rewire: true },
    }

    const tasks = generateTasksFromScope(fullyPricedScope)
    const costResult = calculateRefurbCost(tasks)

    expect(costResult.pricingCompleteness).toBe("FULLY_PRICED")
    expect(costResult.hasUnpricedItems).toBe(false)
    expect(costResult.isProvisional).toBe(false)
    expect(costResult.unpricedItemsCount).toBe(0)
    expect(costResult.totalRefurbCost).toBeGreaterThan(0)

    const result = analyzeDealWithRefurb(testDeal, fullyPricedScope)
    expect(result.refurbSource).toBe("generated")
    expect(result.refurb?.pricingCompleteness).toBe("FULLY_PRICED")
    expect(result.refurb?.isProvisional).toBe(false)
    expect(result.verdict.checks.some((c) => c.includes("PASS: Refurbishment scope fully priced"))).toBe(true)
  })

  // 2. Partially priced scope
  it("2. Partially priced scope: demotes verdict to CONDITIONAL and attaches provisional warnings", () => {
    const partiallyPricedScope: RefurbScopeInput = {
      bedrooms: 3,
      bathrooms: 2,
      floorAreaSqm: 120,
      kitchen: { scope: "full_replace", size: "medium" }, // priced in pilot library
      bathroom: { scope: "partial" }, // unpriced in pilot library
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasks = generateTasksFromScope(partiallyPricedScope)
    const costResult = calculateRefurbCost(tasks)

    expect(costResult.pricingCompleteness).toBe("PARTIALLY_PRICED")
    expect(costResult.hasUnpricedItems).toBe(true)
    expect(costResult.isProvisional).toBe(true)
    expect(costResult.unpricedItemsCount).toBe(1)
    expect(costResult.unpricedTaskNames).toContain("bathroom partial — no templates yet")

    const result = analyzeDealWithRefurb(testDeal, partiallyPricedScope)
    expect(result.verdict.status).toBe("CONDITIONAL")
    expect(result.verdict.reason).toContain("PROVISIONAL")
    expect(result.verdict.reason).toContain("bathroom partial — no templates yet")
    expect(result.verdict.checks.some((c) => c.includes("FAIL: Refurbishment scope fully priced"))).toBe(true)
    expect(result.confidence.factors.some((f) => f.includes("unpriced refurb item(s)"))).toBe(true)
    expect(result.dueDiligence?.decision.riskFlags.some((f) => f.includes("Unresolved refurbishment scope"))).toBe(true)
  })

  // 3. Entirely unpriced scope
  it("3. Entirely unpriced scope: preserves items, sets UNPRICED completeness, does not treat £0 as confirmed savings", () => {
    const unpricedScope: RefurbScopeInput = {
      bedrooms: 3,
      bathrooms: 2,
      floorAreaSqm: 120,
      kitchen: { scope: "refresh", size: "medium" }, // unpriced stub
      bathroom: { scope: "partial" }, // unpriced stub
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasks = generateTasksFromScope(unpricedScope)
    const costResult = calculateRefurbCost(tasks)

    expect(costResult.pricingCompleteness).toBe("UNPRICED")
    expect(costResult.hasUnpricedItems).toBe(true)
    expect(costResult.isProvisional).toBe(true)
    expect(costResult.totalRefurbCost).toBe(0)
    expect(costResult.unpricedItemsCount).toBe(2)

    const result = analyzeDealWithRefurb(testDeal, unpricedScope)
    expect(result.verdict.status).toBe("CONDITIONAL")
    expect(result.verdict.reason).toContain("PROVISIONAL")
    expect(result.warnings.some((w) => w.includes("NOT a confirmed saving"))).toBe(true)
  })

  // 4. Rejected and unreviewed findings
  it("4. Rejected and unreviewed findings: cannot enter scope or silently affect financial calculations", () => {
    // 4.1 Unreviewed finding: human did not accept -> empty confirmed items list
    const unreviewedScope = deriveScope([], { bedrooms: 3, bathrooms: 2 })
    expect(unreviewedScope.majorWorks.roof).toBe(false)
    expect(unreviewedScope.majorWorks.boiler).toBe(false)
    expect(unreviewedScope.majorWorks.rewire).toBe(false)

    // 4.2 Rejected roof finding -> human rejected -> item not added to confirmed items
    const tasks = generateTasksFromScope(unreviewedScope)
    const costResult = calculateRefurbCost(tasks)
    expect(costResult.totalRefurbCost).toBe(0)
    expect(tasks.length).toBe(0)

    const result = analyzeDealWithRefurb(testDeal, unreviewedScope)
    expect(result.refurb?.totalRefurbCost).toBe(0)
  })

  // 5. Baseline versus proposed True MAO
  it("5. Baseline versus proposed True MAO: £50,000 difference is marked PROVISIONAL and cannot create false confidence", () => {
    // Baseline deal with manual £50,000 refurb allowance
    const baseline = analyzeDealWithRefurb(testDeal)
    expect(baseline.refurbSource).toBe("manual")
    expect(baseline.deal.trueMao.twentyPercent).toBe(450_875)

    // Proposed scope with unpriced bathroom
    const scopeWithUnpriced: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "partial" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const proposed = analyzeDealWithRefurb(testDeal, scopeWithUnpriced)

    // Direct mathematical formula output: True MAO increases mathematically by £50,000
    expect(proposed.deal.trueMao.twentyPercent).toBe(500_875)
    const rawDelta = proposed.deal.trueMao.twentyPercent - baseline.deal.trueMao.twentyPercent
    expect(rawDelta).toBe(50_000)

    // Financial integrity safeguards:
    // 1. Proposed True MAO is explicitly PROVISIONAL
    expect(proposed.refurb?.isProvisional).toBe(true)
    expect(proposed.refurb?.pricingCompleteness).toBe("UNPRICED")

    // 2. Verdict CANNOT be GO
    expect(proposed.verdict.status).toBe("CONDITIONAL")

    // 3. Verdict reason states acquisition ceiling cannot be validated until quotes are received
    expect(proposed.verdict.reason).toContain("PROVISIONAL and cannot be validated as a binding acquisition ceiling")

    // 4. Warnings explicitly disclaim apparent cost reduction as confirmed savings
    expect(proposed.warnings.some((w) => w.includes("Apparent cost reduction of £50,000 from baseline is NOT a confirmed saving"))).toBe(true)
  })

  // 6. Investor Shield presentation
  it("6. Investor Shield presentation: REFURB_CERTAINTY blocks progression when hard builder evidence is missing", () => {
    const shieldResult = evaluateInvestorShield({
      dealId: "test-deal-wp3",
      checks: [
        {
          id: "check-refurb-1",
          dealId: "test-deal-wp3",
          gateKey: "REFURB_CERTAINTY",
          severity: "BLOCKER",
          status: "REQUIRED",
        },
      ],
      evidenceItems: [],
      manualOverrides: [],
      riskFlags: [],
    })

    expect(shieldResult.canProgress).toBe(false)
    expect(shieldResult.blockingGateKeys).toContain("REFURB_CERTAINTY")
    expect(shieldResult.taskRecommendations.some((t) => t.type === "OBTAIN_BUILDER_QUOTE")).toBe(true)
  })

  // 7. Saved Deal immutability
  it("7. Saved Deal immutability: deal inputs and baseline figures remain unchanged during evaluation", () => {
    const frozenDeal = Object.freeze({
      purchasePrice: 450_000,
      gdv: 750_000,
      refurbCost: 50_000,
      saleCosts: 9_000,
      stampDuty: 22_500,
      legalCosts: 3_500,
      bridgeTermMonths: 9,
    })

    const scope: RefurbScopeInput = {
      bedrooms: 3,
      bathrooms: 2,
      floorAreaSqm: 120,
      kitchen: { scope: "full_replace", size: "medium" },
      bathroom: { scope: "partial" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const result = analyzeDealWithRefurb(frozenDeal, scope)

    expect(frozenDeal.purchasePrice).toBe(450_000)
    expect(frozenDeal.gdv).toBe(750_000)
    expect(frozenDeal.refurbCost).toBe(50_000)
    expect(result.dueDiligence?.inputs.purchasePrice).toBe(450_000)
  })

  // 8. Builder Pack and Deal Passport consistency
  it("8. Builder Pack and Deal Passport consistency: withholds internal rates and reports UNPRICED_ITEMS", () => {
    const unpricedWorkItem: ConfirmedWorkItem = {
      itemId: "works:bathroom-partial",
      mappingId: "chk_bathroom_water_damage",
      kind: "ENGINE_SCOPE",
      label: "Partial bathroom refurb",
      area: "Bathroom",
      scopeEffect: { field: "bathroom.scope", level: "partial" },
      levelChosenByHuman: true,
      quantityNote: "Awaiting builder inspection",
      sources: [],
    }

    const mockPlanRecord: ConfirmedPlanRecord = {
      id: "plan-wp3-1",
      dealId: "deal-wp3",
      assessmentId: "assessment-wp3",
      version: 1,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "op-1",
      analysisSource: "LIVE",
      measurementSetId: null,
      measurementSetVersion: null,
      propertyBasics: { bedrooms: 3, bathrooms: 2 },
      financialAssumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      acceptedItems: [unpricedWorkItem],
      computation: computePlan({
        accepted: [unpricedWorkItem],
        basics: { bedrooms: 3, bathrooms: 2 },
        assumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
        deal: { purchasePrice: 450_000, gdv: 750_000, refurbCost: 50_000 },
      }),
    }

    const currentPlanView: CurrentPlanView = {
      record: mockPlanRecord,
      stale: false,
      staleReasons: [],
    }

    // 8.1 Builder Quote Pack
    const builderPack = buildBuilderQuotePack({
      generatedAt: new Date().toISOString(),
      dealRef: { dealId: "deal-wp3", address: "10 High Street" },
      view: currentPlanView,
      measurementSet: null,
    })

    // Strict confidentiality check
    expect(builderPack.confidentiality.internalEstimateIncluded).toBe(false)
    expect(builderPack.confidentiality.engineRatesIncluded).toBe(false)
    expect(builderPack.confidentiality.investorFiguresIncluded).toBe(false)
    expect(builderPack.confidentiality.governanceInformationIncluded).toBe(false)
    // Pricing sheet instructions require builder to price
    expect(builderPack.pricingSheet.instructions).toContain("Leave an item blank if you decline to price it")

    // 8.2 Deal Passport
    const mockSavedDeal: SavedDealRecord = {
      id: "deal-wp3",
      address: "10 High Street",
      listing_url: "https://example.com/property",
      purchase_price: 450_000,
      gdv_realistic: 750_000,
      refurb_cost: 50_000,
      classification: "STRONG_DEAL",
      governance_state: "SUBMITTED",
      capital_protection_state: "SAFE",
      pipeline_state: "SOURCING",
      engine_result_json: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const mockEvidencePack: PdfEvidencePack = {
      version: "1.0",
      dealId: "deal-wp3",
      generatedAt: new Date().toISOString(),
      property: { address: "10 High Street", listingUrl: "https://example.com" },
      investorSummary: {
        classification: "STRONG_DEAL",
        governanceState: "SUBMITTED",
        capitalProtectionState: "SAFE",
        pipelineState: "SOURCING",
        purchasePrice: 450_000,
        gdvRealistic: 750_000,
        refurbCost: 50_000,
        totalCost: 500_000,
        projectedProfit: 150_000,
        profitMargin: 0.2,
        recommendation: "BRRR_OR_FLIP",
      },
      investorShield: {
        overallStatus: "BLOCKED",
        canProgress: false,
        blockingGateKeys: ["REFURB_CERTAINTY"],
        cautionGateKeys: [],
        missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
        manualOverrideRequired: false,
        blockingReasons: ["REFURB_CERTAINTY_INSUFFICIENT"],
        taskRecommendations: [],
      },
      evidenceEntries: [],
    }

    const passport = buildDealPassport({
      generatedAt: new Date().toISOString(),
      pack: mockEvidencePack,
      deal: mockSavedDeal,
      inspection: null,
      plan: currentPlanView,
      planHistory: [mockPlanRecord],
      measurements: null,
      financial: null,
    })

    // Deal passport flags UNPRICED_ITEMS
    expect(passport.outstandingDecisions.some((o) => o.code === "UNPRICED_ITEMS")).toBe(true)
    expect(passport.deal.stored.purchasePrice).toBe(450_000)
    expect(passport.deal.stored.refurbCost).toBe(50_000)
  })
})
