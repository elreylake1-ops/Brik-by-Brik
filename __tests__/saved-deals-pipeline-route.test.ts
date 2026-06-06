import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getSavedDealByIdMock,
  updateSavedDealPipelineStateMock,
  evaluateOperatorGuardMock,
  loadAndEvaluateInvestorShieldMock,
  guardInvestorShieldPipelineMovementMock,
  persistInvestorShieldTaskDraftsMock,
} = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  updateSavedDealPipelineStateMock: vi.fn(),
  evaluateOperatorGuardMock: vi.fn(),
  loadAndEvaluateInvestorShieldMock: vi.fn(),
  guardInvestorShieldPipelineMovementMock: vi.fn(),
  persistInvestorShieldTaskDraftsMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
  updateSavedDealPipelineState: updateSavedDealPipelineStateMock,
}))

vi.mock("@/lib/operator-command/evaluate-operator-guard", () => ({
  evaluateOperatorGuard: evaluateOperatorGuardMock,
}))

vi.mock("@/lib/investor-shield/investor-shield-read-model", () => ({
  loadAndEvaluateInvestorShield: loadAndEvaluateInvestorShieldMock,
}))

vi.mock("@/lib/investor-shield/guard-investor-shield-pipeline-movement", () => ({
  guardInvestorShieldPipelineMovement: guardInvestorShieldPipelineMovementMock,
  isInvestorShieldProtectedStage: (stage: string) =>
    ["READY_FOR_OFFER", "OFFER_SENT", "NEGOTIATING", "DUE_DILIGENCE", "COMPLETED"].includes(stage),
}))

vi.mock("@/lib/investor-shield/persist-investor-shield-task-drafts", () => ({
  persistInvestorShieldTaskDrafts: persistInvestorShieldTaskDraftsMock,
}))

import { POST } from "@/app/api/saved-deals/[id]/pipeline/route"

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/saved-deals/deal-1/pipeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const savedDealFixture = {
  id: "deal-1",
  pipeline_state: "UNDER_ANALYSIS",
  governance_state: "STRONG_OPPORTUNITY",
  classification: "STRONG_OPPORTUNITY",
  engine_result_json: { untouched: true },
}

const operatorAllowFixture = {
  decision: "ALLOW",
  allowed: true,
  reasons: ["ALLOWED_BY_GOVERNANCE"],
  required_task_type: null,
  block_message: null,
  warning_message: null,
}

const investorShieldAllowFixture = {
  dealId: "deal-1",
  currentStage: "UNDER_ANALYSIS",
  requestedStage: "READY_FOR_OFFER",
  canMove: true,
  movementDecision: "ALLOW",
  reasons: ["INVESTOR_SHIELD_CLEAR_PROTECTED_STAGE"],
  protectedStage: true,
  enforcementOverallStatus: "CLEAR",
  enforcementProgressionDecision: "CAN_PROGRESS",
  blockingGateKeys: [],
  cautionGateKeys: [],
  taskDrafts: [],
  deterministicDominanceNote: undefined,
}

describe("phase 4a saved deal pipeline route", () => {
  beforeEach(() => {
    vi.resetAllMocks()

    getSavedDealByIdMock.mockResolvedValue(savedDealFixture)
    updateSavedDealPipelineStateMock.mockResolvedValue({
      ...savedDealFixture,
      pipeline_state: "READY_FOR_OFFER",
    })
    evaluateOperatorGuardMock.mockReturnValue(operatorAllowFixture)
    loadAndEvaluateInvestorShieldMock.mockResolvedValue({
      dealId: "deal-1",
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
    })
    guardInvestorShieldPipelineMovementMock.mockReturnValue(investorShieldAllowFixture)
  })

  it("returns 200 and updates pipeline when operator guard and investor shield allow", async () => {
    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(200)
    expect(loadAndEvaluateInvestorShieldMock).toHaveBeenCalledWith("deal-1", {
      deterministicDealStatus: savedDealFixture.governance_state,
    })
    expect(guardInvestorShieldPipelineMovementMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dealId: "deal-1",
        currentStage: savedDealFixture.pipeline_state,
        requestedStage: "READY_FOR_OFFER",
        deterministicDealStatus: savedDealFixture.governance_state,
      })
    )
    expect(updateSavedDealPipelineStateMock).toHaveBeenCalledWith("deal-1", "READY_FOR_OFFER")

    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        deal: expect.objectContaining({ pipeline_state: "READY_FOR_OFFER" }),
        guard: expect.objectContaining({
          decision: "ALLOW",
          investor_shield: expect.objectContaining({ movementDecision: "ALLOW" }),
        }),
      })
    )
    expect(persistInvestorShieldTaskDraftsMock).not.toHaveBeenCalled()
  })

  it("returns 404 when saved deal not found", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "missing" },
    })

    expect(response.status).toBe(404)
  })

  it("returns 400 for missing requested_pipeline_state", async () => {
    const response = await POST(makeRequest({}), { params: { id: "deal-1" } })
    expect(response.status).toBe(400)
  })

  it("preserves existing operator guard block behavior and does not run investor shield", async () => {
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "BLOCK",
      allowed: false,
      reasons: ["GOVERNANCE_REJECT_OR_FATAL"],
      required_task_type: null,
      block_message: "blocked",
      warning_message: null,
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(guardInvestorShieldPipelineMovementMock).not.toHaveBeenCalled()
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()
  })

  it("returns 409 and does not update when operator guard requires review/task", async () => {
    evaluateOperatorGuardMock.mockReturnValueOnce({
      decision: "REQUIRE_TASK",
      allowed: false,
      reasons: ["MANUAL_REVIEW_REQUIRED"],
      required_task_type: "MANUAL_REVIEW",
      block_message: null,
      warning_message: null,
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "DUE_DILIGENCE" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(loadAndEvaluateInvestorShieldMock).not.toHaveBeenCalled()
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()
  })

  it("returns 409 and does not update for protected movement when investor shield blocks", async () => {
    guardInvestorShieldPipelineMovementMock.mockReturnValueOnce({
      ...investorShieldAllowFixture,
      canMove: false,
      movementDecision: "BLOCK",
      reasons: ["INVESTOR_SHIELD_BLOCKED_PROTECTED_STAGE"],
      enforcementOverallStatus: "BLOCKED",
      enforcementProgressionDecision: "BLOCKED",
      blockingGateKeys: ["TITLE"],
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        allowed: false,
        guard: expect.objectContaining({
          decision: "ALLOW",
          investor_shield: expect.objectContaining({ movementDecision: "BLOCK" }),
        }),
        error: "Pipeline movement is blocked by Investor Shield guard.",
      })
    )
    expect(persistInvestorShieldTaskDraftsMock).not.toHaveBeenCalled()
  })

  it("returns 409 and does not update for protected movement when investor shield needs review", async () => {
    guardInvestorShieldPipelineMovementMock.mockReturnValueOnce({
      ...investorShieldAllowFixture,
      canMove: false,
      movementDecision: "NEEDS_REVIEW",
      reasons: ["INVESTOR_SHIELD_CAUTION_PROTECTED_STAGE"],
      enforcementOverallStatus: "CAUTION",
      enforcementProgressionDecision: "NEEDS_REVIEW",
      cautionGateKeys: ["REFURB_CERTAINTY"],
    })

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        allowed: false,
        guard: expect.objectContaining({
          decision: "ALLOW",
          investor_shield: expect.objectContaining({ movementDecision: "NEEDS_REVIEW" }),
        }),
        error: "Pipeline movement requires Investor Shield review before progressing.",
      })
    )
  })

  it("fails closed with 409 for protected movement when investor shield read/evaluation throws", async () => {
    loadAndEvaluateInvestorShieldMock.mockRejectedValueOnce(new Error("db details"))

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(409)
    expect(updateSavedDealPipelineStateMock).not.toHaveBeenCalled()

    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        success: false,
        allowed: false,
        guard: expect.objectContaining({
          decision: "ALLOW",
          investor_shield: expect.objectContaining({
            movementDecision: "BLOCK",
            protectedStage: true,
            reasons: ["INVESTOR_SHIELD_EVALUATION_FAILED"],
          }),
        }),
        error: "Pipeline movement is blocked pending Investor Shield review.",
      })
    )
  })

  it("guard input uses saved deal governance/classification/current pipeline", async () => {
    await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(evaluateOperatorGuardMock).toHaveBeenCalledWith(
      expect.objectContaining({
        governance_state: savedDealFixture.governance_state,
        classification: savedDealFixture.classification,
        current_pipeline_state: savedDealFixture.pipeline_state,
        requested_pipeline_state: "READY_FOR_OFFER",
      })
    )
  })

  it("returns safe 500 on repository failure", async () => {
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("db details"))

    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      success: false,
      error: "Unable to update saved deal pipeline at this time.",
    })
  })

  it("route does not import calculator modules or task persistence and does not mutate engine_result_json", async () => {
    await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    const routeSource = readFileSync(
      path.resolve(process.cwd(), "app/api/saved-deals/[id]/pipeline/route.ts"),
      "utf8"
    )
    expect(routeSource).not.toContain("@/lib/engine")
    expect(routeSource).not.toContain("@/lib/calculations")
    expect(routeSource).not.toContain("@/app/page")
    expect(routeSource).not.toContain("persistInvestorShieldTaskDrafts")
    expect(updateSavedDealPipelineStateMock.mock.calls[0]).toStrictEqual(["deal-1", "READY_FOR_OFFER"])
    expect(persistInvestorShieldTaskDraftsMock).not.toHaveBeenCalled()
  })

  it("does not introduce forbidden runtime keys and keeps response backward compatible", async () => {
    const response = await POST(makeRequest({ requested_pipeline_state: "READY_FOR_OFFER" }), {
      params: { id: "deal-1" },
    })

    const payload = await response.json()
    expect(payload).toEqual(
      expect.objectContaining({
        success: true,
        deal: expect.any(Object),
        guard: expect.any(Object),
      })
    )

    const serialized = JSON.stringify(payload)
    for (const forbidden of ["aiProvider", "scraping", "crm", "webhook", "runtimeWrite"]) {
      expect(serialized).not.toContain(`\"${forbidden}\"`)
    }
  })
})
