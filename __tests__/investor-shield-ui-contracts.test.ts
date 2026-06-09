import { describe, expect, it } from "vitest"
import type {
  InvestorShieldUiViewModel,
  InvestorShieldUiGateKey,
} from "@/types/investor-shield-ui"

describe("Investor Shield UI contract types", () => {
  it("supports a display-only view model shape", () => {
    const model = {
      dealId: "deal-123",
      summary: {
        headline: "Investor Shield review ready",
        subheadline: "Read-only gate presentation",
        overallStatus: "caution",
        canProgress: false,
        blockingGateCount: 1,
        cautionGateCount: 2,
        message: "Blocked movement remains blocked until evidence is clear.",
      },
      deterministicGovernance: {
        classification: "Strong Deal",
        governanceState: "LOCKED",
        capitalProtectionState: "PROTECTED",
        trueMaoStatus: "within_threshold",
        isDominant: true,
        warningText: "Deterministic governance remains visually dominant.",
      },
      gates: [
        {
          gateKey: "SOLD_COMPS" as InvestorShieldUiGateKey,
          label: "Sold Comparables",
          gateType: "required",
          status: "missing_evidence",
          evidenceStatus: "not_provided",
          isBlocking: true,
          missingEvidenceWarnings: ["Sold comparables are missing."],
          taskRecommendationIds: ["task-1"],
          waiver: {
            isWaived: false,
          },
          manualReviewRequired: true,
          displayPriority: 1,
          helperText: "Required evidence is still missing.",
        },
      ],
      advisorySignals: [
        {
          signalKey: "ai-visual-review",
          label: "AI Visual Review",
          source: "ai_advisory",
          confidenceLabel: "low",
          warningText: "Advisory only, cannot satisfy hard gates.",
          advisoryOnly: true,
          cannotSatisfyHardGate: true,
        },
      ],
      protectedMovement: {
        currentPipelineState: "UNDER_ANALYSIS",
        attemptedPipelineState: "READY_FOR_OFFER",
        movementAllowed: false,
        blockedReason: "Required gates remain incomplete.",
        blockingGateKeys: ["SOLD_COMPS" as InvestorShieldUiGateKey],
        pipelineMutationPrevented: true,
        explanation: "Movement is blocked until required evidence is satisfied.",
      },
      taskRecommendations: [
        {
          taskKey: "task-1",
          gateKey: "SOLD_COMPS" as InvestorShieldUiGateKey,
          title: "Request sold comparables",
          description: "Collect sold comparable evidence before proceeding.",
          status: "open",
          duplicateSafe: true,
          actionType: "request_evidence",
        },
      ],
      manualReview: {
        required: true,
        reason: "Manual review is required for blocked movement.",
        causedBy: ["SOLD_COMPS"],
        doesNotClearGate: true,
      },
      waiverSummary: {
        isWaived: false,
        warningText: "Waiver is not the same as satisfied evidence.",
      },
      metadata: {
        modelVersion: "phase4d-ui-contract-v1",
        sourceRoute: "/api/saved-deals/[id]/investor-shield-ui",
        readOnly: true,
      },
    } satisfies InvestorShieldUiViewModel

    expect(model.dealId).toBe("deal-123")
    expect(model.deterministicGovernance.isDominant).toBe(true)
    expect(model.protectedMovement.pipelineMutationPrevented).toBe(true)
    expect(model.advisorySignals[0]?.cannotSatisfyHardGate).toBe(true)
  })
})
