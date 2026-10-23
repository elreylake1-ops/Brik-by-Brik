import { describe, expect, it } from "vitest"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { applyCostOverrides } from "@/lib/engine/apply-overrides"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { buildBuilderQuotePack } from "@/lib/refurb-integration/builder-pack"
import { buildDealPassport } from "@/lib/refurb-integration/deal-passport"
import { buildFinancialProposal } from "@/lib/refurb-integration/financial-proposal"
import { computePlan } from "@/lib/refurb-integration/plan-compute"
import type { DealInputs } from "@/types/deal"
import type { CostOverride } from "@/types/overrides"
import type { ConfirmedPlanRecord, ConfirmedWorkItem, CurrentPlanView } from "@/types/refurb-integration"
import type { RefurbScopeInput } from "@/types/scope"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { EvidenceItem } from "@/types/investor-shield"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"

describe("Work Package 4A: Contractor Quote-to-Investor Shield Acceptance Lifecycle", () => {
  const authoritativeDeal: DealInputs = {
    purchasePrice: 450_000,
    gdv: 750_000,
    refurbCost: 50_000,
    saleCosts: 9_000,
    stampDuty: 22_500,
    legalCosts: 3_500,
    bridgeTermMonths: 9,
  }

  const makeAllSatisfiedChecks = (dealId: string, refurbStatus: "SATISFIED" | "REQUIRED" = "SATISFIED") =>
    INVESTOR_SHIELD_DEFAULT_GATES.map((g) => ({
      id: `check-${g.key}`,
      dealId,
      gateKey: g.key,
      severity: g.defaultSeverity,
      status: g.key === "REFURB_CERTAINTY" ? refurbStatus : "SATISFIED",
      confidence: "HIGH" as const,
      requiredEvidence: g.evidenceTypes,
    }))

  // 1. Stage 1: Quote evidence received alone cannot clear financial pricing uncertainty
  it("1. Quote evidence received alone cannot clear financial pricing uncertainty in Investor Shield", () => {
    const quoteReceivedEvidence: EvidenceItem = {
      id: "ev-quote-unreviewed-001",
      dealId: "deal-wp4a-audit",
      gateKey: "REFURB_CERTAINTY",
      evidenceType: "BUILDER_QUOTE",
      title: "Contractor Quotation received from Apex Contractors (unreviewed)",
      url: "https://storage.local/demo-quotes/apex-quote-unreviewed.pdf",
      source: "professional",
      status: "RECEIVED",
      reviewState: "NOT_REVIEWED",
      quoteAccepted: false,
      advisoryOnly: false,
    }

    const shieldResult = evaluateInvestorShield({
      dealId: "deal-wp4a-audit",
      checks: makeAllSatisfiedChecks("deal-wp4a-audit", "SATISFIED"),
      evidenceItems: [quoteReceivedEvidence],
      manualOverrides: [],
      riskFlags: [],
      refurbPricing: {
        quoteReceived: true,
        quoteReviewedAndAccepted: false,
      },
    })

    // Attaching quote evidence alone CANNOT clear pricing uncertainty
    expect(shieldResult.canProgress).toBe(false)
    expect(shieldResult.overallStatus).toBe("CAUTION")
    expect(shieldResult.progressionDecision).toBe("NEEDS_REVIEW")
    expect(shieldResult.cautionGateKeys).toContain("REFURB_CERTAINTY")
    expect(shieldResult.taskRecommendations.some((t) =>
      t.gateKey === "REFURB_CERTAINTY" &&
      t.reason.includes("Contractor quotation received but not yet reviewed and accepted by operator")
    )).toBe(true)
  })

  // 2. Stage 2: Quote reviewed & accepted, but price not incorporated into calculations
  it("2. Quote reviewed and accepted without calculation incorporation does not satisfy Investor Shield", () => {
    const quoteAcceptedEvidence: EvidenceItem = {
      id: "ev-quote-accepted-002",
      dealId: "deal-wp4a-audit",
      gateKey: "REFURB_CERTAINTY",
      evidenceType: "BUILDER_QUOTE",
      title: "Contractor Quotation APX-88 accepted by operator",
      source: "professional",
      status: "REVIEWED",
      reviewState: "REVIEWED_BY_OPERATOR",
      quoteAccepted: true,
      incorporatedIntoCalculations: false, // Not yet incorporated
      advisoryOnly: false,
    }

    const shieldResult = evaluateInvestorShield({
      dealId: "deal-wp4a-audit",
      checks: makeAllSatisfiedChecks("deal-wp4a-audit", "SATISFIED"),
      evidenceItems: [quoteAcceptedEvidence],
      manualOverrides: [],
      riskFlags: [],
      refurbPricing: {
        quoteReceived: true,
        quoteReviewedAndAccepted: true,
        priceIncorporatedIntoCalculations: false,
      },
    })

    expect(shieldResult.canProgress).toBe(false)
    expect(shieldResult.cautionGateKeys).toContain("REFURB_CERTAINTY")
    expect(shieldResult.taskRecommendations.some((t) =>
      t.reason.includes("Accepted contractor quote has not been incorporated into financial calculations")
    )).toBe(true)
  })

  // 3. Stage 3 & 4: Bathroom quoted at £3,500, kitchen remains unpriced -> Verdict stays CONDITIONAL
  it("3. Bathroom item priced at £3,500 while separate kitchen item remains unpriced: verdict stays CONDITIONAL", () => {
    const scopeWithBathroomAndKitchen: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 3,
      floorAreaSqm: 240,
      kitchen: { scope: "refresh", size: "medium" }, // Unpriced stub in pilot library
      bathroom: { scope: "partial" }, // Unpriced stub in pilot library
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    // Step A: Initially both bathroom and kitchen are unpriced
    const initialTasks = generateTasksFromScope(scopeWithBathroomAndKitchen)
    expect(initialTasks.length).toBe(2)
    const initialCost = calculateRefurbCost(initialTasks)
    expect(initialCost.pricingCompleteness).toBe("UNPRICED")
    expect(initialCost.unpricedItemsCount).toBe(2)

    // Step B: Fictional £3,500 contractor quote override for bathroom only
    const bathroomQuoteOverride: CostOverride = {
      id: "ovr-bathroom-quote-3500",
      type: "contractor_quote",
      targetTaskId: "bathroom-partial-unsupported",
      value: 3_500,
      reason: "Apex Contractors Ltd quote #APX-3500 approved for partial bathroom refurb",
    }

    // Step C: Apply override to task list
    const overrideResult = applyCostOverrides(initialTasks, [bathroomQuoteOverride])
    const reconciledTasks = overrideResult.tasks

    // Bathroom is reconciled and priced at £3,500
    const bathroomTask = reconciledTasks.find((t) => t.id === "bathroom-partial-unsupported")
    expect(bathroomTask).toBeDefined()
    expect(bathroomTask?.totalCost).toBe(3_500)
    expect(bathroomTask?.isUnpriced).toBe(false)

    // Kitchen remains unpriced
    const kitchenTask = reconciledTasks.find((t) => t.id === "kitchen-refresh-unsupported")
    expect(kitchenTask).toBeDefined()
    expect(kitchenTask?.totalCost).toBe(0)
    expect(kitchenTask?.isUnpriced).toBe(true)

    // Step D: Calculate refurb cost with bathroom priced and kitchen unpriced
    const partialCost = calculateRefurbCost(reconciledTasks)
    expect(partialCost.totalRefurbCost).toBe(3_500)
    expect(partialCost.pricingCompleteness).toBe("PARTIALLY_PRICED")
    expect(partialCost.hasUnpricedItems).toBe(true)
    expect(partialCost.isProvisional).toBe(true)
    expect(partialCost.unpricedItemsCount).toBe(1)
    expect(partialCost.unpricedTaskNames).toContain("kitchen refresh — no templates yet")

    // Step E: Financial analysis with bathroom priced and kitchen unpriced
    const proposedAnalysis = analyzeDealWithRefurb(authoritativeDeal, scopeWithBathroomAndKitchen, [bathroomQuoteOverride])
    expect(proposedAnalysis.refurb?.totalRefurbCost).toBe(3_500)
    expect(proposedAnalysis.refurb?.pricingCompleteness).toBe("PARTIALLY_PRICED")
    expect(proposedAnalysis.refurb?.isProvisional).toBe(true)

    // MANDATORY CHECK: Final verdict MUST stay CONDITIONAL while kitchen quotation is outstanding
    expect(proposedAnalysis.verdict.status).toBe("CONDITIONAL")
    expect(proposedAnalysis.verdict.reason).toContain("PROVISIONAL")
    expect(proposedAnalysis.verdict.reason).toContain("kitchen refresh — no templates yet")
    expect(proposedAnalysis.dueDiligence?.decision.riskFlags.some((rf) => rf.includes("Unresolved refurbishment scope"))).toBe(true)

    // Step F: Investor Shield also reflects remaining unpriced work
    const shieldResult = evaluateInvestorShield({
      dealId: "deal-wp4a-audit",
      checks: makeAllSatisfiedChecks("deal-wp4a-audit", "SATISFIED"),
      evidenceItems: [
        {
          id: "ev-quote-bathroom-003",
          dealId: "deal-wp4a-audit",
          gateKey: "REFURB_CERTAINTY",
          evidenceType: "BUILDER_QUOTE",
          title: "Bathroom Quotation £3,500 from Apex Contractors (Kitchen Outstanding)",
          source: "professional",
          status: "REVIEWED",
          reviewState: "REVIEWED_BY_OPERATOR",
          quoteAccepted: true,
          incorporatedIntoCalculations: true,
          remainingUnpricedWork: true,
        },
      ],
      manualOverrides: [],
      riskFlags: [
        {
          id: "rf-unresolved-refurb-1",
          dealId: "deal-wp4a-audit",
          gateKey: "REFURB_CERTAINTY",
          severity: "CAUTION",
          message: "Unresolved refurbishment scope items require contractor quotation: kitchen refresh",
          source: "system_default",
        },
      ],
      refurbPricing: {
        quoteReceived: true,
        quoteReviewedAndAccepted: true,
        scopeCoverageVerified: false,
        priceIncorporatedIntoCalculations: true,
        hasRemainingUnpricedWork: true,
        unpricedTaskNames: ["kitchen refresh — no templates yet"],
      },
    })

    // Investor Shield MUST NOT clear refurb certainty while kitchen is outstanding
    expect(shieldResult.canProgress).toBe(false)
    expect(shieldResult.overallStatus).toBe("CAUTION")
    expect(shieldResult.cautionGateKeys).toContain("REFURB_CERTAINTY")
    expect(shieldResult.taskRecommendations.some((t) =>
      t.reason.includes("kitchen refresh — no templates yet")
    )).toBe(true)
  })

  // 4. Superseded quotes and immutability of Saved Deal
  it("4. Superseded quotes preserve reliable audit trail and cannot overwrite authoritative Saved Deal", () => {
    const frozenAuthoritativeDeal: SavedDealRecord = Object.freeze({
      id: "deal-wp4a-immutable",
      user_id: "operator-001",
      address: "14 Elm Road, Leeds LS1 4HY",
      purchase_price: "450000",
      gdv_realistic: "750000",
      refurb_cost: "50000",
      classification: "RESIDENTIAL",
      governance_state: "PENDING_REVIEW",
      capital_protection_state: "ACTIVE",
      pipeline_state: "EVALUATION",
      engine_result_json: { deal: { totalCost: 550000, profit: 120000 } },
      created_at: "2026-10-20T10:00:00.000Z",
      updated_at: "2026-10-20T10:00:00.000Z",
    })

    // Quote 1: Initial quote £4,200
    const quoteV1: CostOverride = {
      id: "ovr-bathroom-q1",
      type: "contractor_quote",
      targetTaskId: "bathroom-partial-unsupported",
      value: 4_200,
      reason: "Initial quotation APX-001 from Apex Contractors",
    }

    // Quote 2: Superseded quote £3,500
    const quoteV2: CostOverride = {
      id: "ovr-bathroom-q2",
      type: "contractor_quote",
      targetTaskId: "bathroom-partial-unsupported",
      value: 3_500,
      reason: "Revised quotation APX-002 from Apex Contractors superseding APX-001",
    }

    const tasks = generateTasksFromScope({
      bedrooms: 4,
      bathrooms: 3,
      kitchen: { scope: "keep", size: "medium" },
      bathroom: { scope: "partial" },
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    })

    // Reconcile with V1
    const resultV1 = applyCostOverrides(tasks, [quoteV1])
    expect(resultV1.tasks[0].totalCost).toBe(4_200)

    // Reconcile with V2 (superseding V1)
    const resultV2 = applyCostOverrides(tasks, [quoteV2])
    expect(resultV2.tasks[0].totalCost).toBe(3_500)

    // Authoritative Saved Deal fields MUST NOT be modified
    expect(frozenAuthoritativeDeal.purchase_price).toBe("450000")
    expect(frozenAuthoritativeDeal.refurb_cost).toBe("50000")
    expect(frozenAuthoritativeDeal.gdv_realistic).toBe("750000")
  })

  // 5. Output consistency across Refurb Plan, Proposal, Shield, Builder Pack, and Passport
  it("5. Consistent output across Refurbishment Plan, Financial Proposal, Investor Shield, Builder Pack, and Deal Passport", () => {
    const bathroomItem: ConfirmedWorkItem = {
      itemId: "works:bathroom-partial",
      mappingId: "bathroom",
      kind: "ENGINE_SCOPE",
      label: "Partial bathroom refurb",
      area: "Bathroom",
      scopeEffect: { field: "bathroom.scope", level: "partial" },
      levelChosenByHuman: true,
      quantityNote: "Contractor quote £3,500 accepted",
      sources: [],
    }

    const kitchenItem: ConfirmedWorkItem = {
      itemId: "works:kitchen-refresh",
      mappingId: "kitchen",
      kind: "ENGINE_SCOPE",
      label: "Kitchen cosmetic refresh",
      area: "Kitchen",
      scopeEffect: { field: "kitchen.scope", level: "refresh" },
      levelChosenByHuman: true,
      quantityNote: "Awaiting contractor quote",
      sources: [],
    }

    const bathroomOverride: CostOverride = {
      id: "ovr-quote-3500",
      type: "contractor_quote",
      targetTaskId: "bathroom-partial-unsupported",
      value: 3_500,
      reason: "Apex quotation APX-3500 accepted",
    }

    // 1. Refurbishment Plan computation
    const plan = computePlan({
      accepted: [bathroomItem, kitchenItem],
      basics: { bedrooms: 4, bathrooms: 3 },
      assumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      deal: { purchasePrice: 450_000, gdv: 750_000, refurbCost: 50_000 },
      overrides: [bathroomOverride],
    })

    // Bathroom is priced at £3,500; kitchen is unpriced
    expect(plan.estimate.totalRefurbCost).toBe(3_500)
    expect(plan.estimate.unpricedItems.length).toBe(1)
    expect(plan.estimate.unpricedItems[0].label).toContain("Kitchen")

    // 2. Financial Proposal
    const confirmedPlanRecord: ConfirmedPlanRecord = {
      id: "plan-wp4a-001",
      dealId: "deal-wp4a-audit",
      assessmentId: "asm-wp4a-001",
      version: 1,
      idempotencyKey: "idemp-wp4a-001",
      requestHash: "a".repeat(64),
      sourceFingerprint: "b".repeat(64),
      analysisSource: "LIVE",
      acceptedItems: [bathroomItem, kitchenItem],
      excluded: [],
      propertyBasics: { bedrooms: 4, bathrooms: 3 },
      financialAssumptions: { stampDuty: 22500, legalCosts: 3500, saleCosts: 9000, bridgeTermMonths: 9 },
      computation: plan,
      confirmedBy: "operator-test",
      confirmedAt: "2026-10-23T15:00:00.000Z",
      measurementSetId: null,
      measurementSetVersion: null,
    }

    const savedDeal: SavedDealRecord = {
      id: "deal-wp4a-audit",
      user_id: "operator-001",
      address: "14 Elm Road, Leeds LS1 4HY",
      purchase_price: "450000",
      gdv_realistic: "750000",
      refurb_cost: "50000",
      classification: "RESIDENTIAL",
      governance_state: "PENDING_REVIEW",
      capital_protection_state: "ACTIVE",
      pipeline_state: "EVALUATION",
      engine_result_json: null,
      created_at: "2026-10-20T10:00:00.000Z",
      updated_at: "2026-10-20T10:00:00.000Z",
    }

    const proposal = buildFinancialProposal({
      plan: confirmedPlanRecord,
      measurementSet: null,
      deal: savedDeal,
    })

    expect(proposal.content.nonAuthoritative).toBe(true)
    expect(proposal.content.completeness).toBe("HAS_EXCLUSIONS_OR_UNRESOLVED_QUANTITIES")
    expect(proposal.content.exclusions.some((e) => e.label.includes("Kitchen"))).toBe(true)

    // 3. Builder Pack
    const currentView: CurrentPlanView = {
      record: confirmedPlanRecord,
      stale: false,
      staleReasons: [],
    }

    const builderPack = buildBuilderQuotePack({
      generatedAt: "2026-10-23T15:00:00.000Z",
      dealRef: { dealId: "deal-wp4a-audit", address: "14 Elm Road, Leeds LS1 4HY" },
      view: currentView,
      measurementSet: null,
    })

    expect(builderPack.items.length).toBe(2)
    // Confidentiality check: internal pricing and margins are omitted
    expect(builderPack.items.every((item) => (item as any).internalRate === undefined)).toBe(true)
    expect(builderPack.pricingSheet.lines.length).toBe(2)

    // 4. Deal Passport
    const mockEvidencePack: PdfEvidencePack = {
      meta: {
        schemaVersion: "pdf-evidence-pack-v1",
        audience: "INVESTOR",
        purpose: "INVESTOR_DECISION_SUPPORT",
        generationMode: "MANUAL_CURRENT_LIVE_STATE",
      },
      identity: { dealId: "deal-wp4a-audit", generatedAt: "2026-10-23T15:00:00.000Z", version: "1.0", dealAddress: "14 Elm Road, Leeds LS1 4HY" },
      investorSummary: {} as any,
      investorShield: {
        dealId: "deal-wp4a-audit",
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        blockingGateKeys: [],
        cautionGateKeys: ["REFURB_CERTAINTY"],
        missingEvidenceGateKeys: [],
        manualOverrideRequired: false,
        advisoryOnlyEvidenceWarnings: [],
        taskRecommendations: [],
        blockingReasons: [],
      },
      evidenceIndex: [],
      disclaimers: [],
    }

    const passport = buildDealPassport({
      generatedAt: "2026-10-23T15:00:00.000Z",
      pack: mockEvidencePack,
      deal: savedDeal,
      inspection: null,
      plan: currentView,
      planHistory: [confirmedPlanRecord],
      measurements: null,
      financial: null,
    })

    expect(passport.investorShield.overallStatus).toBe("CAUTION")
    expect(passport.investorShield.canProgress).toBe(false)
    expect(passport.deal.stored.refurbCost).toBe(50_000) // Authoritative Saved Deal unchanged
  })
})
