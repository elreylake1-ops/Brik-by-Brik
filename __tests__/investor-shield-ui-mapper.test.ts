import { describe, expect, it } from "vitest"
import { mapInvestorShieldUiViewModel } from "@/lib/investor-shield/map-investor-shield-ui-view-model"
import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"
import {
  advisoryOnlyFixture,
  blockedRequiredGateFixture,
  clearedRequiredGatesFixture,
} from "./fixtures/investor-shield-ui-fixtures"

function makeSourceModel(
  overrides: Partial<InvestorShieldUiModel> = {}
): Partial<InvestorShieldUiModel> {
  return {
    overallStatus: "CLEAR",
    progressionDecision: "CAN_PROGRESS",
    canProgress: true,
    blockingGateKeys: [],
    cautionGateKeys: [],
    missingEvidenceGateKeys: [],
    advisoryWarnings: [],
    manualOverrideRequired: false,
    taskRecommendations: [],
    gateSummaries: [],
    protectedMovementExplanation: "Deterministic governance remains visually dominant.",
    ...overrides,
  }
}

describe("Investor Shield UI view model mapper", () => {
  it("maps blocked required gate input safely", () => {
    const mapped = mapInvestorShieldUiViewModel({
      dealId: blockedRequiredGateFixture.dealId,
      deal: {
        pipelineState: blockedRequiredGateFixture.protectedMovement.currentPipelineState,
        classification: blockedRequiredGateFixture.deterministicGovernance.classification,
        governanceState: blockedRequiredGateFixture.deterministicGovernance.governanceState,
        capitalProtectionState: blockedRequiredGateFixture.deterministicGovernance.capitalProtectionState,
      },
      investorShield: makeSourceModel({
        overallStatus: "BLOCKED",
        progressionDecision: "BLOCKED",
        canProgress: false,
        blockingGateKeys: ["SOLD_COMPS"],
        cautionGateKeys: [],
        missingEvidenceGateKeys: ["SOLD_COMPS"],
        advisoryWarnings: ["Advisory only and cannot satisfy hard evidence."],
        manualOverrideRequired: true,
        taskRecommendations: [
          {
            gateKey: "SOLD_COMPS",
            title: "Request sold comparables",
            reason: "Collect sold comparables before moving forward.",
            severity: "BLOCKER",
            source: "system_default",
            idempotencyKey: "task-block-sold-comps",
          },
        ],
        gateSummaries: [
          {
            key: "SOLD_COMPS",
            label: "Sold Comparables",
            description: "Required sold comparables.",
            requiredLabel: "Required",
            status: "FAILED",
            severity: "BLOCKER",
            confidence: "LOW",
            evidenceCount: 0,
            missingEvidenceSummary: ["Sold comparables are missing."],
            shortExplanation: "Required evidence is missing.",
            recommendedNextAction: "Request sold comparables",
            advisoryOnly: false,
            updatedAt: "2026-06-09T00:00:00.000Z",
          },
        ],
      }),
    })

    expect(mapped.protectedMovement.movementAllowed).toBe(false)
    expect(mapped.protectedMovement.pipelineMutationPrevented).toBe(true)
    expect(mapped.deterministicGovernance.isDominant).toBe(true)
    expect(mapped.advisorySignals.every((signal) => signal.advisoryOnly && signal.cannotSatisfyHardGate)).toBe(true)
    expect(mapped.manualReview.doesNotClearGate).toBe(true)
    expect(mapped.taskRecommendations[0]?.status).toBe("open")
    expect(mapped.taskRecommendations[0]?.duplicateSafe).toBe(true)
  })

  it("maps cleared and waived gates with waiver detail", () => {
    const mapped = mapInvestorShieldUiViewModel({
      dealId: clearedRequiredGatesFixture.dealId,
      deal: {
        pipelineState: clearedRequiredGatesFixture.protectedMovement.currentPipelineState,
        classification: clearedRequiredGatesFixture.deterministicGovernance.classification,
        governanceState: clearedRequiredGatesFixture.deterministicGovernance.governanceState,
        capitalProtectionState: clearedRequiredGatesFixture.deterministicGovernance.capitalProtectionState,
      },
      investorShield: makeSourceModel({
        overallStatus: "CLEAR",
        progressionDecision: "CAN_PROGRESS",
        canProgress: true,
        gateSummaries: [
          {
            key: "TITLE",
            label: "Title Review",
            description: "Title evidence is sufficient.",
            requiredLabel: "Required",
            status: "SATISFIED",
            severity: "CAUTION",
            confidence: "HIGH",
            evidenceCount: 1,
            missingEvidenceSummary: [],
            shortExplanation: "Title evidence is sufficient.",
            recommendedNextAction: undefined,
            advisoryOnly: false,
            updatedAt: "2026-06-09T00:00:00.000Z",
          },
          {
            key: "LEASEHOLD",
            label: "Leasehold Review",
            description: "Waived for a controlled case.",
            requiredLabel: "Required",
            status: "WAIVED",
            severity: "BLOCKER",
            confidence: "MEDIUM",
            evidenceCount: 0,
            missingEvidenceSummary: [],
            shortExplanation: "Waived with traceable review.",
            recommendedNextAction: "Review gate",
            waiverReason: "Leasehold issue reviewed and approved for this controlled case.",
            advisoryOnly: false,
            updatedAt: "2026-06-09T00:00:00.000Z",
          },
        ],
        taskRecommendations: [],
      }),
    })

    expect(mapped.protectedMovement.movementAllowed).toBe(true)
    expect(mapped.protectedMovement.pipelineMutationPrevented).toBe(false)
    expect(mapped.gates.find((gate) => gate.gateKey === "LEASEHOLD")?.waiver.reason).toBeTruthy()
    expect(mapped.gates.find((gate) => gate.gateKey === "LEASEHOLD")?.status).toBe("waived")
    expect(mapped.waiverSummary.isWaived).toBe(true)
  })

  it("maps advisory, manual review, and task recommendation states", () => {
    const mapped = mapInvestorShieldUiViewModel({
      dealId: advisoryOnlyFixture.dealId,
      deal: {
        pipelineState: advisoryOnlyFixture.protectedMovement.currentPipelineState,
        classification: advisoryOnlyFixture.deterministicGovernance.classification,
        governanceState: advisoryOnlyFixture.deterministicGovernance.governanceState,
        capitalProtectionState: advisoryOnlyFixture.deterministicGovernance.capitalProtectionState,
      },
      investorShield: makeSourceModel({
        overallStatus: "CAUTION",
        progressionDecision: "NEEDS_REVIEW",
        canProgress: false,
        blockingGateKeys: ["REFURB_CERTAINTY"],
        cautionGateKeys: ["REFURB_CERTAINTY"],
        missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
        advisoryWarnings: ["AI visual review is advisory only."],
        manualOverrideRequired: false,
        gateSummaries: [
          {
            key: "REFURB_CERTAINTY",
            label: "Refurb Certainty",
            description: "Advisory signals are separate.",
            requiredLabel: "Required",
            status: "REQUIRED",
            severity: "BLOCKER",
            confidence: "LOW",
            evidenceCount: 0,
            missingEvidenceSummary: ["Builder and measurement evidence remain required."],
            shortExplanation: "Required evidence is still outstanding.",
            recommendedNextAction: "Review refurb certainty",
            advisoryOnly: false,
            updatedAt: "2026-06-09T00:00:00.000Z",
            subGates: [
              {
                key: "AI_VISUAL_REVIEW_ADVISORY",
                label: "AI Visual Review Advisory",
                description: "AI review can support human review only.",
                requiredLabel: "Advisory",
                status: "NOT_STARTED",
                severity: "INFO",
                confidence: "UNKNOWN",
                evidenceCount: 0,
                missingEvidenceSummary: [],
                shortExplanation: "Advisory only.",
                advisoryOnly: true,
                updatedAt: "2026-06-09T00:00:00.000Z",
              },
            ],
          },
        ],
        taskRecommendations: [
          {
            gateKey: "REFURB_CERTAINTY",
            title: "Review refurb certainty",
            reason: "Collect supporting evidence for refurb certainty.",
            severity: "BLOCKER",
            source: "system_default",
            idempotencyKey: "task-refurb-review",
          },
        ],
      }),
    })

    expect(mapped.advisorySignals.every((signal) => signal.advisoryOnly && signal.cannotSatisfyHardGate)).toBe(true)
    expect(mapped.manualReview.doesNotClearGate).toBe(true)
    expect(mapped.manualReview.required).toBe(true)
    expect(mapped.taskRecommendations[0]?.duplicateSafe).toBe(true)
    expect(mapped.taskRecommendations[0]?.gateKey).toBe("REFURB_CERTAINTY")
    expect(mapped.gates[0]?.taskRecommendationIds).toContain(mapped.taskRecommendations[0]?.taskKey ?? "")
  })

  it("maps incomplete input safely", () => {
    const mapped = mapInvestorShieldUiViewModel({
      dealId: "deal-empty",
    })

    expect(mapped.dealId).toBe("deal-empty")
    expect(mapped.summary.overallStatus).toBe("blocked")
    expect(mapped.deterministicGovernance.isDominant).toBe(true)
    expect(mapped.protectedMovement.pipelineMutationPrevented).toBe(true)
    expect(mapped.gates).toEqual([])
    expect(mapped.advisorySignals).toEqual([])
    expect(mapped.manualReview.doesNotClearGate).toBe(true)
  })
})
