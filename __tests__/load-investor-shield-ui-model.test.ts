import { describe, expect, it, beforeEach, vi } from "vitest"
import * as evaluateModule from "@/lib/investor-shield/evaluate-investor-shield"
import * as adapterModule from "@/lib/investor-shield/investor-shield-ui-adapter"
import { loadInvestorShieldUiModelForDeal } from "@/lib/investor-shield/load-investor-shield-ui-model"
import { loadInvestorShieldEvaluationInput } from "@/lib/investor-shield/investor-shield-read-model"
import { persistInvestorShieldTaskDrafts } from "@/lib/investor-shield/persist-investor-shield-task-drafts"
import type { InvestorShieldEvaluationInput } from "@/types/investor-shield-enforcement"

vi.mock("@/lib/investor-shield/investor-shield-read-model", () => ({
  loadInvestorShieldEvaluationInput: vi.fn(),
}))

vi.mock("@/lib/investor-shield/persist-investor-shield-task-drafts", () => ({
  persistInvestorShieldTaskDrafts: vi.fn(),
}))

const sparseInput: InvestorShieldEvaluationInput = {
  dealId: "deal-loader-1",
  checks: [],
  evidenceItems: [],
  riskFlags: [],
  manualOverrides: [],
  deterministicDealStatus: "REVIEW",
  evaluatedAt: "2026-06-06T12:00:00.000Z",
}

describe("loadInvestorShieldUiModelForDeal", () => {
  const evaluateSpy = vi.spyOn(evaluateModule, "evaluateInvestorShield")
  const adapterSpy = vi.spyOn(adapterModule, "buildInvestorShieldUiModel")

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(loadInvestorShieldEvaluationInput).mockResolvedValue(sparseInput)
  })

  it("returns a UI model for a valid deal id", async () => {
    const model = await loadInvestorShieldUiModelForDeal("deal-loader-1")

    expect(model.dealId).toBe("deal-loader-1")
    expect(model.gateSummaries.length).toBeGreaterThan(0)
    expect(model.gateSummaries[0]).toHaveProperty("label")
    expect(loadInvestorShieldEvaluationInput).toHaveBeenCalledTimes(1)
    expect(evaluateSpy).toHaveBeenCalledTimes(1)
    expect(adapterSpy).toHaveBeenCalledTimes(1)
    expect(persistInvestorShieldTaskDrafts).not.toHaveBeenCalled()
  })

  it("rejects an empty deal id safely", async () => {
    await expect(loadInvestorShieldUiModelForDeal("   ")).rejects.toThrow(
      "Investor Shield deal id is required."
    )
  })

  it("passes sparse read-model state through without crashing", async () => {
    const model = await loadInvestorShieldUiModelForDeal("deal-loader-1")

    expect(model.gateSummaries.length).toBeGreaterThan(0)
    expect(model.blockingGateKeys).toBeDefined()
    expect(model.cautionGateKeys).toBeDefined()
    expect(model.missingEvidenceGateKeys).toBeDefined()
    expect(model.advisoryWarnings).toBeDefined()
  })

  it("returns a stable shape for repeated calls with the same mocked data", async () => {
    const first = await loadInvestorShieldUiModelForDeal("deal-loader-1")
    const second = await loadInvestorShieldUiModelForDeal("deal-loader-1")

    expect(second).toEqual(first)
  })
})

