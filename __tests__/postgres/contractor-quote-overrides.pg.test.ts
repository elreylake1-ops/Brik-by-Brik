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

    // Second deal for cross-tenant isolation testing
    await query(
      `INSERT INTO brik_by_brik_engine.saved_deals (
        id, address, purchase_price, gdv_realistic, refurb_cost,
        classification, governance_state, capital_protection_state, pipeline_state,
        engine_result_json, risk_summary_json, created_at, updated_at
      ) VALUES (
        'deal-wp4b-qa-002', '24 Queen Street, Manchester M2 5JB', 300000, 500000, 40000,
        'RESIDENTIAL', 'PENDING_REVIEW', 'ACTIVE', 'EVALUATION',
        '{"deal":{"totalCost":380000,"profit":80000}}'::jsonb, '{}'::jsonb, NOW(), NOW()
      ) ON CONFLICT (id) DO NOTHING`
    )

    await query(
      `INSERT INTO brik_by_brik_engine.viewing_assessments (
        id, deal_id, checklist_version, idempotency_key, created_by, created_at
      ) VALUES (
        'asmt-wp4b-qa-002', 'deal-wp4b-qa-002', 'v1', 'idemp-wp4b-qa-002', 'operator-qa', NOW()
      ) ON CONFLICT (deal_id, id) DO NOTHING`
    )

    // Seed valid contractor quote evidence for Deal A
    await query(
      `INSERT INTO brik_by_brik_engine.deal_evidence (
        id, deal_id, evidence_type, linked_gate, title, note, status, reviewed
      ) VALUES (
        'ev-quote-qa-dealA', $1, 'BUILDER_QUOTE', 'REFURB_CERTAINTY',
        'Apex Contractors Written Quotation', 'Full bathroom scope itemised quotation', 'VERIFIED', TRUE
      ) ON CONFLICT (id) DO NOTHING`,
      [dealId]
    )

    // Seed contractor quote evidence belonging to Deal B (foreign tenant)
    await query(
      `INSERT INTO brik_by_brik_engine.deal_evidence (
        id, deal_id, evidence_type, linked_gate, title, note, status, reviewed
      ) VALUES (
        'ev-quote-qa-dealB', 'deal-wp4b-qa-002', 'BUILDER_QUOTE', 'REFURB_CERTAINTY',
        'Manchester Builders Ltd Quotation', 'Scope itemised quotation for Deal B', 'VERIFIED', TRUE
      ) ON CONFLICT (id) DO NOTHING`
    )
  })

  beforeEach(async () => {
    await query(
      `DELETE FROM brik_by_brik_engine.contractor_quote_overrides WHERE deal_id IN ($1, 'deal-wp4b-qa-002')`,
      [dealId]
    )
  })

  afterAll(async () => {
    await query(
      `DELETE FROM brik_by_brik_engine.contractor_quote_overrides WHERE deal_id IN ($1, 'deal-wp4b-qa-002')`,
      [dealId]
    )
    await query(
      `DELETE FROM brik_by_brik_engine.deal_evidence WHERE id IN ('ev-quote-qa-dealA', 'ev-quote-qa-dealB')`
    )
    await query(
      `DELETE FROM brik_by_brik_engine.viewing_assessments WHERE deal_id IN ($1, 'deal-wp4b-qa-002')`,
      [dealId]
    )
    await query(
      `DELETE FROM brik_by_brik_engine.saved_deals WHERE id IN ($1, 'deal-wp4b-qa-002')`,
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
        reason: "Apex Contractors Ltd #APX-3500 (Provisional estimate, VAT: GROSS): approved £3500 by operator-wp4b",
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

  it("5. Prohibits cross-deal quotation evidence linking and non-existent evidence IDs", async () => {
    // Attempting to link quote evidence from Deal B to Deal A must be rejected
    await expect(
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Cross-deal spoof quote",
        quoteEvidenceId: "ev-quote-qa-dealB", // belongs to deal-wp4b-qa-002
        approvedAmount: 3500,
        approvedBy: "operator-wp4b",
      })
    ).rejects.toThrow(/Cross-deal quotation evidence reference forbidden/)

    // Attempting to link a non-existent evidence ID must be rejected
    await expect(
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Fake evidence ID quote",
        quoteEvidenceId: "ev-does-not-exist",
        approvedAmount: 3500,
        approvedBy: "operator-wp4b",
      })
    ).rejects.toThrow(/Invalid quoteEvidenceId/)

    // Valid evidence belonging to Deal A succeeds and sets quoteType to VERIFIED_CONTRACTOR_QUOTE
    const validVerified = await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors verified written quote",
      quoteEvidenceId: "ev-quote-qa-dealA",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
      vatBasis: "GROSS",
    })

    expect(validVerified.quoteType).toBe("VERIFIED_CONTRACTOR_QUOTE")
    expect(validVerified.scopeVerified).toBe(true)
    expect(validVerified.quoteEvidenceId).toBe("ev-quote-qa-dealA")
  })

  it("6. Enforces bounds checking on approved amount (rejects negative, zero, and out-of-range amounts)", async () => {
    // Exactly £0 rejected by repository
    await expect(
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Zero price quote",
        approvedAmount: 0,
        approvedBy: "operator-wp4b",
      })
    ).rejects.toThrow(/approvedAmount must be a positive number greater than 0/)

    // Direct PostgreSQL insert of £0 is rejected by ck_quote_override_amount
    await expect(
      query(
        `INSERT INTO brik_by_brik_engine.contractor_quote_overrides (
          id, deal_id, assessment_id, item_id, task_id, quote_ref, approved_amount, approved_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED')`,
        ["cvr-zero-direct", dealId, assessmentId, "bathroom", "bathroom-partial-unsupported", "Direct Zero", 0, "op"]
      )
    ).rejects.toThrow(/ck_quote_override_amount/)

    // Negative amount rejected by repository
    await expect(
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Negative price quote",
        approvedAmount: -500,
        approvedBy: "operator-wp4b",
      })
    ).rejects.toThrow(/approvedAmount must be a positive number greater than 0/)

    // Direct PostgreSQL insert of negative amount is rejected
    await expect(
      query(
        `INSERT INTO brik_by_brik_engine.contractor_quote_overrides (
          id, deal_id, assessment_id, item_id, task_id, quote_ref, approved_amount, approved_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED')`,
        ["cvr-neg-direct", dealId, assessmentId, "bathroom", "bathroom-partial-unsupported", "Direct Neg", -500, "op"]
      )
    ).rejects.toThrow(/ck_quote_override_amount/)

    // Out-of-range (>10M) rejected by repository
    await expect(
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Absurd out-of-range price quote",
        approvedAmount: 15_000_000,
        approvedBy: "operator-wp4b",
      })
    ).rejects.toThrow(/approvedAmount must be a positive number greater than 0 and at most 10,000,000/)

    // Direct PostgreSQL insert of >10M is rejected
    await expect(
      query(
        `INSERT INTO brik_by_brik_engine.contractor_quote_overrides (
          id, deal_id, assessment_id, item_id, task_id, quote_ref, approved_amount, approved_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED')`,
        ["cvr-huge-direct", dealId, assessmentId, "bathroom", "bathroom-partial-unsupported", "Direct Huge", 15000000, "op"]
      )
    ).rejects.toThrow(/ck_quote_override_amount/)
  })

  it("7. Simultaneous first approvals for the same unquoted task cannot retain two active approved quotations in PostgreSQL", async () => {
    // Unique partial index uq_contractor_quote_active_task guarantees exactly one active quote per task
    const id1 = `cvr-concurrent-task-1`
    const id2 = `cvr-concurrent-task-2`
    const taskId = "task-unquoted-concurrent"

    await query(
      `INSERT INTO brik_by_brik_engine.contractor_quote_overrides (
        id, deal_id, assessment_id, item_id, task_id, quote_ref, approved_amount, approved_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED')`,
      [id1, dealId, assessmentId, "bathroom", taskId, "Active 1", 1000, "op1"]
    )

    // Second simultaneous active insert for the exact same task must violate unique partial index
    await expect(
      query(
        `INSERT INTO brik_by_brik_engine.contractor_quote_overrides (
          id, deal_id, assessment_id, item_id, task_id, quote_ref, approved_amount, approved_by, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'APPROVED')`,
        [id2, dealId, assessmentId, "bathroom", taskId, "Active 2", 1200, "op2"]
      )
    ).rejects.toThrow(/uq_contractor_quote_active_task/)

    // Exactly one active quote remains in database
    const activeRes = await query(
      `SELECT id FROM brik_by_brik_engine.contractor_quote_overrides WHERE deal_id = $1 AND assessment_id = $2 AND task_id = $3 AND status = 'APPROVED'`,
      [dealId, assessmentId, taskId]
    )
    expect(activeRes.rows.length).toBe(1)
    expect(activeRes.rows[0].id).toBe(id1)
  })

  it("7b. Atomically handles concurrent / parallel quote approvals with FOR UPDATE locking and supersession", async () => {
    // Fire two concurrent approvals for the same task
    const [res1, res2] = await Promise.all([
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Concurrent Quote Candidate A",
        approvedAmount: 3400,
        approvedBy: "operator-a",
      }),
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Concurrent Quote Candidate B",
        approvedAmount: 3600,
        approvedBy: "operator-b",
      }),
    ])

    // Both succeeded, but exactly ONE is active APPROVED and the other is SUPERSEDED
    const activeList = await pgQuoteOverridesRepository.list(dealId, assessmentId, true)
    expect(activeList.length).toBe(1)
    const activeId = activeList[0].id
    expect([res1.id, res2.id]).toContain(activeId)

    const fullHistory = await pgQuoteOverridesRepository.list(dealId, assessmentId, false)
    expect(fullHistory.length).toBe(2)
    const supersededRecord = fullHistory.find((r) => r.id !== activeId)
    expect(supersededRecord?.status).toBe("SUPERSEDED")
    expect(supersededRecord?.supersededBy).toBe(activeId)
  })

  it("8. Guarantees transactional rollback on failure without leaving phantom records", async () => {
    const countBefore = (await query(`SELECT count(*)::int as c FROM brik_by_brik_engine.contractor_quote_overrides`)).rows[0].c

    // Attempt invalid cross-deal approval
    await expect(
      pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
        itemId: "bathroom",
        taskId: "bathroom-partial-unsupported",
        quoteRef: "Failing transaction",
        quoteEvidenceId: "ev-quote-qa-dealB", // foreign deal
        approvedAmount: 2500,
        approvedBy: "operator-wp4b",
      })
    ).rejects.toThrow()

    const countAfter = (await query(`SELECT count(*)::int as c FROM brik_by_brik_engine.contractor_quote_overrides`)).rows[0].c
    expect(countAfter).toBe(countBefore)
  })

  it("9. Enforces row-level isolation between deals", async () => {
    // Create override for Deal A
    await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Deal A bathroom quote",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
    })

    // Create override for Deal B
    await pgQuoteOverridesRepository.createAndApprove("deal-wp4b-qa-002", "asmt-wp4b-qa-002", {
      itemId: "kitchen",
      taskId: "kitchen-refresh-unsupported",
      quoteRef: "Deal B kitchen quote",
      approvedAmount: 6200,
      approvedBy: "operator-deal-b",
    })

    const dealAActive = await pgQuoteOverridesRepository.list(dealId, assessmentId, true)
    expect(dealAActive.length).toBe(1)
    expect(dealAActive[0].quoteRef).toBe("Deal A bathroom quote")

    const dealBActive = await pgQuoteOverridesRepository.list("deal-wp4b-qa-002", "asmt-wp4b-qa-002", true)
    expect(dealBActive.length).toBe(1)
    expect(dealBActive[0].quoteRef).toBe("Deal B kitchen quote")
  })

  it("10. Distinguishes explicitly between operator provisional estimates and verified quotes in Investor Shield", async () => {
    // Unverified provisional estimate (no quote evidence attached)
    const provisional = await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Operator estimate #1",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
    })
    expect(provisional.quoteType).toBe("OPERATOR_PROVISIONAL_ESTIMATE")
    expect(provisional.scopeVerified).toBe(false)
    expect(provisional.quoteEvidenceId).toBeNull()

    // Verified contractor quotation (with evidence linked)
    const verified = await pgQuoteOverridesRepository.createAndApprove(dealId, assessmentId, {
      itemId: "bathroom",
      taskId: "bathroom-partial-unsupported",
      quoteRef: "Apex Contractors verified #APX-3500",
      quoteEvidenceId: "ev-quote-qa-dealA",
      approvedAmount: 3500,
      approvedBy: "operator-wp4b",
      vatBasis: "GROSS",
    })
    expect(verified.quoteType).toBe("VERIFIED_CONTRACTOR_QUOTE")
    expect(verified.scopeVerified).toBe(true)
    expect(verified.quoteEvidenceId).toBe("ev-quote-qa-dealA")

    // Investor Shield requires hard evidence and reviewed status; a provisional estimate alone CANNOT satisfy it
    const provisionalOnlyEvaluation = evaluateInvestorShield({
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
      evidenceItems: [], // No hard evidence
      manualOverrides: [],
      riskFlags: [],
      refurbPricing: {
        quoteReceived: false,
        quoteReviewedAndAccepted: false,
        priceIncorporatedIntoCalculations: true,
        hasRemainingUnpricedWork: false,
      },
    })

    // Must block or remain in caution with REFURB_CERTAINTY_INSUFFICIENT
    expect(provisionalOnlyEvaluation.canProgress).toBe(false)
    expect(provisionalOnlyEvaluation.missingEvidenceGateKeys).toContain("REFURB_CERTAINTY")
    expect(provisionalOnlyEvaluation.blockingReasons).toContain("REFURB_CERTAINTY_INSUFFICIENT")
  })
})
