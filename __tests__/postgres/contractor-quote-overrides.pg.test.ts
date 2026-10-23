import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { getPostgresPool, query } from "@/lib/db/postgres"
import { qaGate } from "./qa-gate"
import { pgQuoteOverridesRepository, toCostOverrides } from "@/lib/refurb-integration/quote-overrides-repository"
import { computePlan } from "@/lib/refurb-integration/plan-compute"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import { generateTasksFromScope } from "@/lib/engine/scope-to-tasks"
import { calculateRefurbCost } from "@/lib/engine/refurb-cost-engine"
import { evaluateInvestorShield } from "@/lib/investor-shield/evaluate-investor-shield"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

const gate = qaGate("PostgreSQL contractor quote overrides repository (isolated QA only)")
const describeIf = gate.enabled ? describe : describe.skip

describeIf("PostgreSQL contractor quote overrides repository (isolated QA only)", () => {
  const dealId = "deal-wp4b-qa-001"
  const assessmentId = "asmt-wp4b-qa-001"

  beforeAll(async () => {
    process.env.DATABASE_URL = gate.url
    const db = await import("@/lib/db/postgres")
    db.__resetPostgresPoolForTests()

    // Ensure parent viewing assessment and saved deal exist in local QA database
    await query(
      `INSERT INTO brik_by_brik_engine.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state, pipeline_state,
        engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES (
        $1, '10 Park Lane, Leeds LS1 2TW', 450000, 750000, 50000,
        'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION',
        '{"deal":{"totalCost":550000,"profit":120000}}'::jsonb, '{}'::jsonb, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`,
      [dealId]
    )

    await query(
      `INSERT INTO brik_by_brik_engine.viewing_assessments (
        id, deal_id, checklist_version, idempotency_key, created_by, created_at
      ) VALUES (
        $1, $2, 'v1', 'idemp-wp4b-qa-001', 'operator-qa', NOW()
      ) ON CONFLICT (deal_id, id) DO NOTHING`,
      [assessmentId, dealId]
    )
  })

  beforeEach(async () => {
    await query(
      `DELETE FROM brik_by_brik_engine.contractor_quote_overrides WHERE deal_id = $1 AND assessment_id = $2`,
      [dealId, assessmentId]
    )
  })

  afterAll(async () => {
    await query(
      `DELETE FROM brik_by_brik_engine.contractor_quote_overrides WHERE deal_id = $1 AND assessment_id = $2`,
      [dealId, assessmentId]
    )
    await query(
      `DELETE FROM brik_by_brik_engine.viewing_assessments WHERE deal_id = $1 AND id = $2`,
      [dealId, assessmentId]
    )
    await query(
      `DELETE FROM brik_by_brik_engine.saved_deals WHERE id = $1`,
      [dealId]
    )
  })

  it("1. Persists an approved contractor quote override to PostgreSQL", async () => {
    const created = await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors Ltd quote #APX-3500",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
    })

    expect(created.id).toMatch(/^cvr-/)
    expect(created.dealId).toBe(dealId)
    expect(created.assessmentId).toBe(assessmentId)
    expect(created.taskId).toBe("bathroom-partial-unsupported")
    expect(created.approvedAmount).toBe(3500)
    expect(created.status).toBe("APPROVED")
    expect(created.supersededBy).toBeNull()

    const activeList = await pgQuoteOverridesRepository.list(dealId, assessmentId, true)
    expect(activeList.length).toBe(1)
    expect(activeList[0].id).toBe(created.id)
    expect(activeList[0].approvedAmount).toBe(3500)
  })

  it("2. Supersedes previous approved quote for the same task and maintains immutable audit trail", async () => {
    // Quote 1: £4,200
    const quote1 = await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors initial estimate",
      approvedAmount: 4200,
      approvedBy: "operator-wp4b",
    })

    // Quote 2: Negotiated down to £3,500
    const quote2 = await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors revised quote #APX-3500",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
    })

    const allOverrides = await pgQuoteOverridesRepository.list(dealId, assessmentId, false)
    expect(allOverrides.length).toBe(2)

    const activeOverrides = await pgQuoteOverridesRepository.list(dealId, assessmentId, true)
    expect(activeOverrides.length).toBe(1)
    expect(activeOverrides[0].id).toBe(quote2.id)
    expect(activeOverrides[0].approvedAmount).toBe(3500)
    expect(activeOverrides[0].status).toBe("APPROVED")

    const superseded = allOverrides.find((o) => o.id === quote1.id)
    expect(superseded).toBeDefined()
    expect(superseded?.status).toBe("SUPERSEDED")
    expect(superseded?.supersededBy).toBe(quote2.id)
  })

  it("3. Approved quotes survive simulation of browser refresh (re-read from PostgreSQL)", async () => {
    await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors Ltd #APX-3500",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
    })

    // Simulate brand new request / client connection after page refresh
    const reloaded = await pgQuoteOverridesRepository.list(dealId, assessmentId, true)
    expect(reloaded.length).toBe(1)
    expect(reloaded[0].taskId).toBe("bathroom-partial-unsupported")
    expect(reloaded[0].approvedAmount).toBe(3500)

    const costOverrides = toCostOverrides(reloaded)
    expect(costOverrides).toEqual([
      {
        id: reloaded[0].id,
        type: "contractor_quote",
        targetTaskId: "bathroom-partial-unsupported",
        value: 3500,
        reason: "Apex Contractors Ltd #APX-3500: approved £3500 by operator-wp4b",
      },
    ])
  })

  it("4. Integrates persisted approved price into calculation and True MAO while unpriced kitchen keeps verdict CONDITIONAL", async () => {
    // Persist bathroom quote override of £3,500
    await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors Ltd #APX-3500",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
    })

    const activeOverrides = await pgQuoteOverridesRepository.list(dealId, assessmentId, true)
    const costOverrides = toCostOverrides(activeOverrides)

    const scopeWithBathroomAndKitchen: RefurbScopeInput = {
      bedrooms: 4,
      bathrooms: 2,
      floorAreaSqm: 180,
      kitchen: { scope: "refresh", size: "medium" }, // Unpriced
      bathroom: { scope: "partial" }, // Quoted at £3,500
      bedroom: { scope: "none" },
      flooring: { replaceWholeProperty: false },
      majorWorks: { roof: false, boiler: false, rewire: false },
    }

    const authoritativeDeal: DealInputs = {
      purchasePrice: 450000,
      gdv: 750000,
      refurbCost: 50000,
      saleCosts: 9000,
      stampDuty: 22500,
      legalCosts: 3500,
      bridgeTermMonths: 9,
    }

    const analysis = analyzeDealWithRefurb(authoritativeDeal, scopeWithBathroomAndKitchen, costOverrides)

    // Bathroom is priced at £3,500
    expect(analysis.refurb?.totalRefurbCost).toBe(3500)
    expect(analysis.refurb?.pricingCompleteness).toBe("PARTIALLY_PRICED")
    expect(analysis.refurb?.hasUnpricedItems).toBe(true)

    // True MAO reflects the £3,500 refurb cost
    expect(analysis.deal.trueMao.twentyPercent).toBeGreaterThan(450000)

    // MANDATORY REQUIREMENT: Final verdict MUST remain CONDITIONAL because kitchen is still unpriced!
    expect(analysis.verdict.status).toBe("CONDITIONAL")
    expect(analysis.verdict.reason).toContain("PROVISIONAL")
    expect(analysis.verdict.reason).toContain("kitchen refresh — no templates yet")

    // Investor Shield reflects remaining unpriced work
    const shieldResult = evaluateInvestorShield({
      dealId,
      checks: INVESTOR_SHIELD_DEFAULT_GATES.map((g) => ({
        id: `chk-${g.key}`,
        dealId,
        gateKey: g.key,
        severity: g.defaultSeverity,
        status: "SATISFIED",
        confidence: "HIGH",
        requiredEvidence: g.evidenceTypes,
      })),
      evidenceItems: [
        {
          id: "ev-quote-bathroom-001",
          dealId,
          gateKey: "REFURB_CERTAINTY",
          evidenceType: "BUILDER_QUOTE",
          title: "Apex Contractors £3,500 quotation",
          source: "professional",
          status: "REVIEWED",
          reviewState: "REVIEWED_BY_OPERATOR",
          quoteAccepted: true,
          incorporatedIntoCalculations: true,
          remainingUnpricedWork: true,
        },
      ],
      manualOverrides: [],
      riskFlags: [],
      refurbPricing: {
        quoteReceived: true,
        quoteReviewedAndAccepted: true,
        priceIncorporatedIntoCalculations: true,
        hasRemainingUnpricedWork: true,
        unpricedTaskNames: ["kitchen refresh — no templates yet"],
      },
    })

    expect(shieldResult.canProgress).toBe(false)
    expect(shieldResult.overallStatus).toBe("CAUTION")
    expect(shieldResult.cautionGateKeys).toContain("REFURB_CERTAINTY")
    expect(shieldResult.taskRecommendations.some((t) => t.reason.includes("kitchen refresh — no templates yet"))).toBe(true)
  })
})
