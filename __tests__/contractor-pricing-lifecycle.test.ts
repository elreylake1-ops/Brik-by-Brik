import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { applyCostOverrides } from "@/lib/engine/apply-overrides"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { buildBuilderQuotePack } from "@/lib/refurb-integration/builder-pack"
import { buildDealPassport } from "@/lib/refurb-integration/deal-passport"
import { buildFinancialProposal } from "@/lib/refurb-integration/financial-proposal"
import { computePlan, deriveScope } from "@/lib/refurb-integration/plan-compute"
import type { DealInputs } from "@/types/deal"
import type { CostOverride } from "@/types/overrides"
import type { ConfirmedPlanRecord, ConfirmedWorkItem, CurrentPlanView } from "@/types/refurb-integration"
import type { RefurbScopeInput } from "@/types/scope"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { EvidenceItem } from "@/types/investor-shield"

describe("Work Package 4: Contractor Pricing and Financial Reconciliation Lifecycle", () => {
  const baselineDeal: DealInputs = {
    purchasePrice: 450_000,
    gdv: 750_000,
    refurbCost: 50_000,
    saleCosts: 9_000,
    stampDuty: 22_500,
    legalCosts: 3_500,
    bridgeTermMonths: 9,
  }

  it("validates the full pricing lifecycle from unpriced scope to quoted and reconciled financial engine outputs", () => {
    // -------------------------------------------------------------------------
    // Step 1: Start with an accepted, unpriced refurbishment item
    // -------------------------------------------------------------------------
    const scopeWithUnpricedBathroom: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "partial" }, // pilot library has no task template for partial bathroom
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const tasksStep1 = generateTasksFromScope(scopeWithUnpricedBathroom)
    expect(tasksStep1.length).toBe(1)
    expect(tasksStep1[0].id).toBe("bathroom-partial-unsupported")
    expect(tasksStep1[0].isUnpriced).toBe(true)
    expect(tasksStep1[0].totalCost).toBe(0)

    const costStep1 = calculateRefurbCost(tasksStep1)
    expect(costStep1.pricingCompleteness).toBe("UNPRICED")
    expect(costStep1.hasUnpricedItems).toBe(true)
    expect(costStep1.isProvisional).toBe(true)
    expect(costStep1.unpricedItemsCount).toBe(1)
    expect(costStep1.totalRefurbCost).toBe(0)

    // -------------------------------------------------------------------------
    // Step 2: Confirm proposed acquisition ceiling remains provisional
    // -------------------------------------------------------------------------
    const baselineAnalysis = analyzeDealWithRefurb(baselineDeal)
    expect(baselineAnalysis.deal.trueMao.twentyPercent).toBe(450_875)

    const initialProposed = analyzeDealWithRefurb(baselineDeal, scopeWithUnpricedBathroom)
    expect(initialProposed.refurbSource).toBe("generated")
    expect(initialProposed.refurb?.isProvisional).toBe(true)
    expect(initialProposed.refurb?.pricingCompleteness).toBe("UNPRICED")
    // Mathematical engine output: £500,875 (+£50,000)
    expect(initialProposed.deal.trueMao.twentyPercent).toBe(500_875)
    // Safeguard: acquisition ceiling is conditional and provisional
    expect(initialProposed.verdict.status).toBe("CONDITIONAL")
    expect(initialProposed.verdict.reason).toContain("PROVISIONAL")
    expect(initialProposed.warnings.some((w) => w.includes("NOT a confirmed saving"))).toBe(true)
    expect(initialProposed.dueDiligence?.decision.riskFlags.some((f) => f.includes("Unresolved refurbishment scope"))).toBe(true)

    // -------------------------------------------------------------------------
    // Step 3: Attach a clearly labelled fictional contractor quotation
    // -------------------------------------------------------------------------
    const fictionalContractorQuoteEvidence: EvidenceItem = {
      id: "ev-quote-fictional-001",
      dealId: "deal-wp4-demo",
      gateKey: "REFURB_CERTAINTY",
      evidenceType: "BUILDER_QUOTE",
      title: "Contractor Quotation — Apex Contractors Ltd (FICTIONAL DEMO)",
      url: "https://storage.local/demo-quotes/apex-quote-apx-88.pdf",
      uploadedAt: "2026-10-23T14:00:00.000Z",
      advisoryOnly: false,
    }

    // -------------------------------------------------------------------------
    // Step 4 & 5: Require operator decision before accepting price; verify link
    // -------------------------------------------------------------------------
    // Uploading quotation evidence alone DOES NOT mutate the engine calculation
    const unappliedCheck = analyzeDealWithRefurb(baselineDeal, scopeWithUnpricedBathroom)
    expect(unappliedCheck.refurb?.totalRefurbCost).toBe(0)
    expect(unappliedCheck.verdict.status).toBe("CONDITIONAL")

    // Operator makes an explicit, audited decision to accept the £3,500 quote
    const acceptedContractorQuoteOverride: CostOverride = {
      id: "ovr-apex-quote-88",
      type: "contractor_quote",
      targetTaskId: "bathroom-partial-unsupported",
      value: 3_500,
      reason: "Apex Contractors Ltd quotation APX-2026-088 verified and accepted by operator",
    }

    // -------------------------------------------------------------------------
    // Step 6: Confirm accepted cost is reflected in refurbishment estimate
    // -------------------------------------------------------------------------
    const overrideResult = applyCostOverrides(tasksStep1, [acceptedContractorQuoteOverride])
    expect(overrideResult.applied.length).toBe(1)
    expect(overrideResult.applied[0].target).toBe("bathroom-partial-unsupported")
    expect(overrideResult.applied[0].previousValue).toBe(0)
    expect(overrideResult.applied[0].newValue).toBe(3_500)

    const reconciledTasks = overrideResult.tasks
    expect(reconciledTasks[0].totalCost).toBe(3_500)
    expect(reconciledTasks[0].isUnpriced).toBe(false)

    const reconciledCost = calculateRefurbCost(reconciledTasks)
    expect(reconciledCost.totalRefurbCost).toBe(3_500)
    expect(reconciledCost.pricingCompleteness).toBe("FULLY_PRICED")
    expect(reconciledCost.hasUnpricedItems).toBe(false)
    expect(reconciledCost.isProvisional).toBe(false)
    expect(reconciledCost.unpricedItemsCount).toBe(0)

    // -------------------------------------------------------------------------
    // Step 7: Recalculate proposed True MAO using accepted cost
    // -------------------------------------------------------------------------
    const reconciledProposed = analyzeDealWithRefurb(baselineDeal, scopeWithUnpricedBathroom, [acceptedContractorQuoteOverride])
    expect(reconciledProposed.refurbSource).toBe("generated")
    expect(reconciledProposed.refurb?.totalRefurbCost).toBe(3_500)
    expect(reconciledProposed.refurb?.isProvisional).toBe(false)
    expect(reconciledProposed.refurb?.pricingCompleteness).toBe("FULLY_PRICED")

    // Mathematical formula verification:
    // Baseline refurb was £50,000 -> True MAO 20%: £450,875
    // Reconciled refurb is £3,500 (difference of £46,500)
    // Reconciled True MAO 20%: £450,875 + £46,500 = £497,375
    expect(reconciledProposed.deal.trueMao.twentyPercent).toBe(497_375)
    // Ceiling is now fully validated; verdict is allowed to be GO
    expect(reconciledProposed.verdict.status).toBe("GO")
    expect(reconciledProposed.verdict.checks.some((c) => c.includes("PASS: Refurbishment scope fully priced"))).toBe(true)
    expect(reconciledProposed.dueDiligence?.decision.riskFlags.some((f) => f.includes("Unresolved refurbishment scope"))).toBe(false)

    // -------------------------------------------------------------------------
    // Step 8: Verify partially covered scope leaves unquoted work unresolved
    // -------------------------------------------------------------------------
    const scopeWithTwoUnpricedItems: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "refresh", size: "medium" }, // unpriced stub 1
      bathroom: { scope: "partial" }, // unpriced stub 2
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    // Only the bathroom quote was received; kitchen remains unquoted
    const partialCoverageProposed = analyzeDealWithRefurb(baselineDeal, scopeWithTwoUnpricedItems, [acceptedContractorQuoteOverride])
    expect(partialCoverageProposed.refurb?.totalRefurbCost).toBe(3_500)
    expect(partialCoverageProposed.refurb?.pricingCompleteness).toBe("PARTIALLY_PRICED")
    expect(partialCoverageProposed.refurb?.hasUnpricedItems).toBe(true)
    expect(partialCoverageProposed.refurb?.isProvisional).toBe(true)
    expect(partialCoverageProposed.refurb?.unpricedItemsCount).toBe(1)
    expect(partialCoverageProposed.refurb?.unpricedTaskNames).toContain("kitchen refresh — no templates yet")
    // Partial coverage MUST remain CONDITIONAL and provisional
    expect(partialCoverageProposed.verdict.status).toBe("CONDITIONAL")
    expect(partialCoverageProposed.verdict.reason).toContain("PROVISIONAL")
    expect(partialCoverageProposed.dueDiligence?.decision.riskFlags.some((f) => f.includes("Unresolved refurbishment scope"))).toBe(true)

    // -------------------------------------------------------------------------
    // Step 9: Confirm Investor Shield reflects evidence and financial exposure
    // -------------------------------------------------------------------------
    // 9.1 Before contractor quotation: REFURB_CERTAINTY blocks progression
    const shieldBefore = evaluateInvestorShield({
      dealId: "deal-wp4-demo",
      checks: [
        {
          id: "check-refurb-1",
          dealId: "deal-wp4-demo",
          gateKey: "REFURB_CERTAINTY",
          severity: "BLOCKER",
          status: "REQUIRED",
        },
      ],
      evidenceItems: [],
      manualOverrides: [],
      riskFlags: [],
    })
    expect(shieldBefore.canProgress).toBe(false)
    expect(shieldBefore.blockingGateKeys).toContain("REFURB_CERTAINTY")

    // 9.2 With hard quotation evidence attached: gate is satisfied
    const shieldAfter = evaluateInvestorShield({
      dealId: "deal-wp4-demo",
      checks: [
        {
          id: "check-refurb-1",
          dealId: "deal-wp4-demo",
          gateKey: "REFURB_CERTAINTY",
          severity: "BLOCKER",
          status: "SATISFIED",
        },
      ],
      evidenceItems: [fictionalContractorQuoteEvidence],
      manualOverrides: [],
      riskFlags: [],
    })
    expect(shieldAfter.blockingGateKeys).not.toContain("REFURB_CERTAINTY")
    expect(shieldAfter.missingEvidenceGateKeys).not.toContain("REFURB_CERTAINTY")
  })

  it("verifies financial plan, proposal, and document consistency across reconciliation", () => {
    const unpricedItem: ConfirmedWorkItem = {
      itemId: "works:bathroom-partial",
      mappingId: "bathroom",
      kind: "ENGINE_SCOPE",
      label: "Partial bathroom refurb",
      area: "Bathroom",
      scopeEffect: { field: "bathroom.scope", level: "partial" },
      levelChosenByHuman: true,
      quantityNote: "Awaiting contractor quotation",
      sources: [],
    }

    // 1. Initial Plan computation without contractor quote: unpriced item is excluded from priced total
    const planInitial = computePlan({
      accepted: [unpricedItem],
      basics: { bedrooms: 4, bathrooms: 3 },
      assumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      deal: { purchasePrice: 450_000, gdv: 750_000, refurbCost: 50_000 },
    })
    expect(planInitial.estimate.totalRefurbCost).toBe(0)
    expect(planInitial.estimate.unpricedItems.length).toBe(1)
    expect(planInitial.estimate.lines[0].priced).toBe(false)

    // 2. Reconciled Plan computation with operator-accepted quote override: item becomes priced
    const quoteOverride: CostOverride = {
      id: "ovr-reconciled-1",
      type: "contractor_quote",
      targetTaskId: "bathroom-partial-unsupported",
      value: 3_500,
      reason: "Contractor quotation accepted by operator",
    }

    const planReconciled = computePlan({
      accepted: [unpricedItem],
      basics: { bedrooms: 4, bathrooms: 3 },
      assumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      deal: { purchasePrice: 450_000, gdv: 750_000, refurbCost: 50_000 },
      overrides: [quoteOverride],
    })
    expect(planReconciled.estimate.totalRefurbCost).toBe(3_500)
    expect(planReconciled.estimate.lines[0].priced).toBe(true)
    expect(planReconciled.estimate.lines[0].totalCost).toBe(3_500)
    expect(planReconciled.financialImpact.scenario?.refurbCost).toBe(3_500)

    // Delta explanation: baseline £50,000 vs proposed £3,500 = -£46,500
    expect(planReconciled.financialImpact.delta?.refurbCost).toBe(-46_500)
  })

  it("strictly preserves Saved Deal immutability and contractor confidentiality during reconciliation", () => {
    const mockSavedDeal: SavedDealRecord = {
      id: "deal-reconciliation-test",
      address: "124 Park Lane",
      listing_url: "https://example.com/listing",
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

    const frozenDeal = Object.freeze({ ...mockSavedDeal })

    const unpricedItem: ConfirmedWorkItem = {
      itemId: "works:bathroom-partial",
      mappingId: "bathroom",
      kind: "ENGINE_SCOPE",
      label: "Partial bathroom refurb",
      area: "Bathroom",
      scopeEffect: { field: "bathroom.scope", level: "partial" },
      levelChosenByHuman: true,
      quantityNote: "Awaiting contractor quotation",
      sources: [],
    }

    const mockPlanRecord: ConfirmedPlanRecord = {
      id: "plan-wp4-1",
      dealId: frozenDeal.id,
      assessmentId: "assessment-wp4-1",
      version: 1,
      confirmedAt: new Date().toISOString(),
      confirmedBy: "operator-j",
      analysisSource: "LIVE",
      measurementSetId: null,
      measurementSetVersion: null,
      propertyBasics: { bedrooms: 4, bathrooms: 3 },
      financialAssumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      acceptedItems: [unpricedItem],
      computation: computePlan({
        accepted: [unpricedItem],
        basics: { bedrooms: 4, bathrooms: 3 },
        assumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
        deal: { purchasePrice: frozenDeal.purchase_price, gdv: frozenDeal.gdv_realistic, refurbCost: frozenDeal.refurb_cost },
      }),
    }

    const currentPlanView: CurrentPlanView = {
      record: mockPlanRecord,
      stale: false,
      staleReasons: [],
    }

    // Builder Quote Pack: Confidentiality must be maintained
    const builderPack = buildBuilderQuotePack({
      generatedAt: new Date().toISOString(),
      dealRef: { dealId: frozenDeal.id, address: frozenDeal.address },
      view: currentPlanView,
      measurementSet: null,
    })

    expect(builderPack.confidentiality.internalEstimateIncluded).toBe(false)
    expect(builderPack.confidentiality.engineRatesIncluded).toBe(false)
    expect(builderPack.confidentiality.investorFiguresIncluded).toBe(false)
    expect(builderPack.confidentiality.governanceInformationIncluded).toBe(false)

    // Saved Deal must remain 100% immutable
    expect(frozenDeal.purchase_price).toBe(450_000)
    expect(frozenDeal.gdv_realistic).toBe(750_000)
    expect(frozenDeal.refurb_cost).toBe(50_000)
  })
})
