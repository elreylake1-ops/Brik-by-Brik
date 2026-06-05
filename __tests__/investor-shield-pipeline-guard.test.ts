import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  guardInvestorShieldPipelineMovement,
  isInvestorShieldProtectedStage,
} from "@/lib/investor-shield/guard-investor-shield-pipeline-movement"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

function makeEnforcementResult(
  overrides?: Partial<InvestorShieldEnforcementResult>
): InvestorShieldEnforcementResult {
  return {
    dealId: "deal-pipeline-1",
    overallStatus: "CLEAR",
    progressionDecision: "CAN_PROGRESS",
    canProgress: true,
    blockingGateKeys: [],
    cautionGateKeys: [],
    missingEvidenceGateKeys: [],
    manualOverrideRequired: false,
    advisoryOnlyEvidenceWarnings: [],
    taskRecommendations: [],
    blockingReasons: [],
    ...overrides,
  }
}

describe("investor shield pipeline guard helper", () => {
  it("CLEAR allows protected movement", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      enforcementResult: makeEnforcementResult(),
    })

    expect(result.movementDecision).toBe("ALLOW")
    expect(result.canMove).toBe(true)
    expect(result.protectedStage).toBe(true)
  })

  it("CAUTION returns NEEDS_REVIEW for protected movement", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "DUE_DILIGENCE",
      enforcementResult: makeEnforcementResult({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        cautionGateKeys: ["REFURB_CERTAINTY"],
      }),
    })

    expect(result.movementDecision).toBe("NEEDS_REVIEW")
    expect(result.canMove).toBe(false)
    expect(result.reasons).toContain("INVESTOR_SHIELD_CAUTION_PROTECTED_STAGE")
  })

  it("BLOCKED blocks protected movement", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      enforcementResult: makeEnforcementResult({
        overallStatus: "BLOCKED",
        progressionDecision: "BLOCKED",
        canProgress: false,
        blockingGateKeys: ["TITLE"],
        blockingReasons: ["BLOCKER_GATE_FAILED"],
      }),
    })

    expect(result.movementDecision).toBe("BLOCK")
    expect(result.canMove).toBe(false)
    expect(result.reasons).toContain("INVESTOR_SHIELD_BLOCKED_PROTECTED_STAGE")
  })

  it("CAUTION returns NEEDS_REVIEW for non-protected movement under current policy", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "FINANCE_REVIEW",
      enforcementResult: makeEnforcementResult({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        cautionGateKeys: ["RENTAL_DEMAND"],
      }),
    })

    expect(result.protectedStage).toBe(false)
    expect(result.movementDecision).toBe("NEEDS_REVIEW")
    expect(result.reasons).toContain("INVESTOR_SHIELD_CAUTION_NON_PROTECTED_STAGE")
  })

  it("deterministic NO-GO blocks protected movement even with CLEAR investor shield", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      deterministicDealStatus: "NO-GO",
      enforcementResult: makeEnforcementResult(),
    })

    expect(result.movementDecision).toBe("BLOCK")
    expect(result.reasons).toContain("DETERMINISTIC_REJECT_DOMINATES")
  })

  it("manualOverrideRequired prevents protected ALLOW", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      enforcementResult: makeEnforcementResult({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        manualOverrideRequired: true,
        blockingReasons: ["MANUAL_OVERRIDE_REQUIRED"],
      }),
    })

    expect(result.movementDecision).toBe("BLOCK")
    expect(result.reasons).toContain("MANUAL_OVERRIDE_REQUIRED")
  })

  it("advisory-only warnings preserve review status", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      enforcementResult: makeEnforcementResult({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        advisoryOnlyEvidenceWarnings: [
          "REFURB_CERTAINTY: advisory-only evidence can support review but cannot satisfy hard evidence alone.",
        ],
      }),
    })

    expect(result.movementDecision).toBe("NEEDS_REVIEW")
    expect(result.reasons).toContain("ADVISORY_ONLY_EVIDENCE_WARNING")
  })

  it("protected stage detection works for current known stages", () => {
    expect(isInvestorShieldProtectedStage("READY_FOR_OFFER")).toBe(true)
    expect(isInvestorShieldProtectedStage("OFFER_SENT")).toBe(true)
    expect(isInvestorShieldProtectedStage("NEGOTIATING")).toBe(true)
    expect(isInvestorShieldProtectedStage("DUE_DILIGENCE")).toBe(true)
    expect(isInvestorShieldProtectedStage("COMPLETED")).toBe(true)
    expect(isInvestorShieldProtectedStage("UNDER_ANALYSIS")).toBe(false)
    expect(isInvestorShieldProtectedStage("FINANCE_REVIEW")).toBe(false)
  })

  it("unknown future protected-like stage names are handled conservatively", () => {
    expect(isInvestorShieldProtectedStage("exchange-ready")).toBe(true)
    expect(isInvestorShieldProtectedStage("investor-pack-ready")).toBe(true)
    expect(isInvestorShieldProtectedStage("due-diligence-complete")).toBe(true)
    expect(isInvestorShieldProtectedStage("evidence-gathering")).toBe(false)
    expect(isInvestorShieldProtectedStage("negotiation-prep")).toBe(false)
  })

  it("returns in-memory task drafts only when recommendations exist", () => {
    const result = guardInvestorShieldPipelineMovement({
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      enforcementResult: makeEnforcementResult({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        taskRecommendations: [
          {
            gateKey: "TITLE",
            type: "REVIEW_GATE",
            title: "Review title pack",
            reason: "Title evidence is incomplete.",
            severity: "BLOCKER",
            source: "system_default",
            idempotencyKey: "investor-shield:deal-pipeline-1:TITLE:REVIEW_GATE",
          },
        ],
      }),
    })

    expect(result.taskDrafts).toEqual([
      {
        dealId: "deal-pipeline-1",
        title: "Review title pack",
        description:
          "Title evidence is incomplete. Source: system_default. Investor Shield gate: TITLE.",
        status: "OPEN",
        priority: "HIGH",
        taskType: "MANUAL_REVIEW",
        source: "investor_shield",
        gateKey: "TITLE",
        subGateKey: undefined,
        idempotencyKey: "investor-shield:deal-pipeline-1:TITLE:REVIEW_GATE",
      },
    ])
  })

  it("helper is deterministic for identical input", () => {
    const input = {
      dealId: "deal-pipeline-1",
      currentStage: "UNDER_ANALYSIS",
      requestedStage: "READY_FOR_OFFER",
      enforcementResult: makeEnforcementResult({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        cautionGateKeys: ["TITLE"],
      }),
      deterministicDealStatus: "CONDITIONAL",
    }

    expect(guardInvestorShieldPipelineMovement(input)).toEqual(
      guardInvestorShieldPipelineMovement(input)
    )
  })

  it("module does not call repositories, task persistence, or routes", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/investor-shield/guard-investor-shield-pipeline-movement.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("@/lib/operator-command/saved-deals-repository")
    expect(source).not.toContain("@/lib/operator-command/deal-tasks-repository")
    expect(source).not.toContain("persistInvestorShieldTaskDrafts")
    expect(source).not.toContain("@/app/api/saved-deals")
    expect(source).not.toContain("query(")
  })
})
