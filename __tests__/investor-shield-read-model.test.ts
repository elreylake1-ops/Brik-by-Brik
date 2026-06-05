import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  EvidenceItem,
  InvestorShieldCheck,
  ManualOverride,
  RiskFlag,
} from "@/types/investor-shield"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

const {
  listEvidenceItemsByDealIdMock,
  listInvestorShieldChecksByDealIdMock,
  listManualOverridesByDealIdMock,
  listRiskFlagsByDealIdMock,
  insertEvidenceItemMock,
  insertInvestorShieldChecksMock,
  insertManualOverrideMock,
  insertRiskFlagMock,
  evaluateInvestorShieldMock,
  buildDefaultInvestorShieldChecksMock,
} = vi.hoisted(() => ({
  listEvidenceItemsByDealIdMock: vi.fn(),
  listInvestorShieldChecksByDealIdMock: vi.fn(),
  listManualOverridesByDealIdMock: vi.fn(),
  listRiskFlagsByDealIdMock: vi.fn(),
  insertEvidenceItemMock: vi.fn(),
  insertInvestorShieldChecksMock: vi.fn(),
  insertManualOverrideMock: vi.fn(),
  insertRiskFlagMock: vi.fn(),
  evaluateInvestorShieldMock: vi.fn(),
  buildDefaultInvestorShieldChecksMock: vi.fn(),
}))

vi.mock("@/lib/investor-shield/investor-shield-repository", () => ({
  listInvestorShieldChecksByDealId: listInvestorShieldChecksByDealIdMock,
  listEvidenceItemsByDealId: listEvidenceItemsByDealIdMock,
  listRiskFlagsByDealId: listRiskFlagsByDealIdMock,
  listManualOverridesByDealId: listManualOverridesByDealIdMock,
  insertInvestorShieldChecks: insertInvestorShieldChecksMock,
  insertEvidenceItem: insertEvidenceItemMock,
  insertRiskFlag: insertRiskFlagMock,
  insertManualOverride: insertManualOverrideMock,
}))

vi.mock("@/lib/investor-shield/evaluate-investor-shield", () => ({
  evaluateInvestorShield: evaluateInvestorShieldMock,
}))

vi.mock("@/lib/investor-shield/default-checks", () => ({
  buildDefaultInvestorShieldChecks: buildDefaultInvestorShieldChecksMock,
}))

import {
  loadAndEvaluateInvestorShield,
  loadInvestorShieldEvaluationInput,
} from "@/lib/investor-shield/investor-shield-read-model"

const sampleChecks: readonly InvestorShieldCheck[] = [
  {
    dealId: "deal-read-1",
    gateKey: "SOLD_COMPS",
    status: "REQUIRED",
    severity: "BLOCKER",
    confidence: "UNKNOWN",
    requiredEvidence: ["SOLD_COMPARABLE"],
  },
]

const sampleEvidenceItems: readonly EvidenceItem[] = [
  {
    dealId: "deal-read-1",
    gateKey: "SOLD_COMPS",
    evidenceType: "SOLD_COMPARABLE",
    source: "document",
    confidence: "HIGH",
    label: "sold-comparable-pack",
  },
]

const sampleRiskFlags: readonly RiskFlag[] = [
  {
    dealId: "deal-read-1",
    gateKey: "SOLD_COMPS",
    severity: "CAUTION",
    message: "Comparable age needs review.",
    source: "professional",
  },
]

const sampleManualOverrides: readonly ManualOverride[] = [
  {
    dealId: "deal-read-1",
    gateKey: "SOLICITOR_FEEDBACK",
    reason: "Override reason present.",
  },
]

const sampleEvaluationResult: InvestorShieldEnforcementResult = {
  dealId: "deal-read-1",
  overallStatus: "CAUTION",
  progressionDecision: "NEEDS_REVIEW",
  canProgress: false,
  blockingGateKeys: [],
  cautionGateKeys: ["SOLD_COMPS"],
  missingEvidenceGateKeys: ["SOLD_COMPS"],
  manualOverrideRequired: false,
  advisoryOnlyEvidenceWarnings: [],
  taskRecommendations: [],
  blockingReasons: [],
}

describe("investor shield read model helper", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    listInvestorShieldChecksByDealIdMock.mockResolvedValue(sampleChecks)
    listEvidenceItemsByDealIdMock.mockResolvedValue(sampleEvidenceItems)
    listRiskFlagsByDealIdMock.mockResolvedValue(sampleRiskFlags)
    listManualOverridesByDealIdMock.mockResolvedValue(sampleManualOverrides)
    evaluateInvestorShieldMock.mockReturnValue(sampleEvaluationResult)
  })

  it("loads checks, evidence, risk flags, and manual overrides by dealId", async () => {
    const result = await loadInvestorShieldEvaluationInput("deal-read-1")

    expect(listInvestorShieldChecksByDealIdMock).toHaveBeenCalledWith("deal-read-1")
    expect(listEvidenceItemsByDealIdMock).toHaveBeenCalledWith("deal-read-1")
    expect(listRiskFlagsByDealIdMock).toHaveBeenCalledWith("deal-read-1")
    expect(listManualOverridesByDealIdMock).toHaveBeenCalledWith("deal-read-1")
    expect(result).toEqual({
      dealId: "deal-read-1",
      checks: sampleChecks,
      evidenceItems: sampleEvidenceItems,
      riskFlags: sampleRiskFlags,
      manualOverrides: sampleManualOverrides,
      deterministicDealStatus: undefined,
      evaluatedAt: undefined,
    })
  })

  it("passes deterministicDealStatus and evaluatedAt through unchanged", async () => {
    const result = await loadInvestorShieldEvaluationInput("deal-read-1", {
      deterministicDealStatus: "REJECT",
      evaluatedAt: "2026-06-05T00:00:00.000Z",
    })

    expect(result.deterministicDealStatus).toBe("REJECT")
    expect(result.evaluatedAt).toBe("2026-06-05T00:00:00.000Z")
    expect(typeof result.dealId).toBe("string")
  })

  it("remains read-only and does not call insert helpers or default check builders", async () => {
    await loadInvestorShieldEvaluationInput("deal-read-1")

    expect(insertInvestorShieldChecksMock).not.toHaveBeenCalled()
    expect(insertEvidenceItemMock).not.toHaveBeenCalled()
    expect(insertRiskFlagMock).not.toHaveBeenCalled()
    expect(insertManualOverrideMock).not.toHaveBeenCalled()
    expect(buildDefaultInvestorShieldChecksMock).not.toHaveBeenCalled()
  })

  it("does not create deal tasks or any task persistence side effects", async () => {
    await loadInvestorShieldEvaluationInput("deal-read-1")

    expect(insertInvestorShieldChecksMock).not.toHaveBeenCalled()
    expect(insertEvidenceItemMock).not.toHaveBeenCalled()
    expect(insertRiskFlagMock).not.toHaveBeenCalled()
    expect(insertManualOverrideMock).not.toHaveBeenCalled()
  })

  it("loadAndEvaluateInvestorShield returns the pure evaluator result", async () => {
    const result = await loadAndEvaluateInvestorShield("deal-read-1", {
      deterministicDealStatus: "NO-GO",
      evaluatedAt: "2026-06-05T12:00:00.000Z",
    })

    expect(evaluateInvestorShieldMock).toHaveBeenCalledWith({
      dealId: "deal-read-1",
      checks: sampleChecks,
      evidenceItems: sampleEvidenceItems,
      riskFlags: sampleRiskFlags,
      manualOverrides: sampleManualOverrides,
      deterministicDealStatus: "NO-GO",
      evaluatedAt: "2026-06-05T12:00:00.000Z",
    })
    expect(result).toBe(sampleEvaluationResult)
  })
})
