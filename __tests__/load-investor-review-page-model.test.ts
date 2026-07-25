import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { InvestorReviewViewModel } from "@/lib/investor-review/investor-review-view-model"
import type { ProfessionalEvidenceGatewayViewModel } from "@/types/professional-evidence-gateway"

const {
  getSavedDealByIdMock,
  loadPdfEvidencePackForDealMock,
  mapPdfEvidencePackToInvestorReviewMock,
  adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock,
  loadProfessionalEvidenceGatewayViewModelMock,
} = vi.hoisted(() => ({
  getSavedDealByIdMock: vi.fn(),
  loadPdfEvidencePackForDealMock: vi.fn(),
  mapPdfEvidencePackToInvestorReviewMock: vi.fn(),
  adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock: vi.fn(),
  loadProfessionalEvidenceGatewayViewModelMock: vi.fn(),
}))

vi.mock("@/lib/operator-command/saved-deals-repository", () => ({
  getSavedDealById: getSavedDealByIdMock,
}))

vi.mock("@/lib/pdf-evidence-pack/load-pdf-evidence-pack", () => ({
  loadPdfEvidencePackForDeal: loadPdfEvidencePackForDealMock,
}))

vi.mock("@/lib/investor-review/map-pdf-evidence-pack-to-investor-review", () => ({
  mapPdfEvidencePackToInvestorReview: mapPdfEvidencePackToInvestorReviewMock,
}))

vi.mock("@/lib/investor-review/adapt-pdf-evidence-pack-evidence-to-professional-gateway", () => ({
  adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence:
    adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock,
}))

vi.mock("@/lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model", () => ({
  loadProfessionalEvidenceGatewayViewModel: loadProfessionalEvidenceGatewayViewModelMock,
}))

import { loadInvestorReviewPageModel } from "@/lib/investor-review/load-investor-review-page-model"

function makeSavedDealRecord(overrides: Partial<SavedDealRecord> = {}): SavedDealRecord {
  return {
    id: "deal-123",
    created_at: "2026-06-27T00:00:00.000Z",
    updated_at: "2026-06-27T00:00:00.000Z",
    archived_at: null,
    address: "1 Lake View Road",
    listing_url: null,
    purchase_price: 125000,
    gdv_realistic: 165000,
    refurb_cost: 18000,
    classification: "CONDITIONAL",
    governance_state: "MANUAL_REVIEW_REQUIRED",
    capital_protection_state: "PROTECTED",
    pipeline_state: "UNDER_ANALYSIS",
    engine_result_json: {},
    risk_summary_json: {},
    next_action: null,
    ...overrides,
  }
}

const samplePack = {
  meta: { savedDealId: "deal-123" },
  evidenceIndex: [{ evidenceId: "evi-1" }],
} as unknown as PdfEvidencePack
const sampleViewModel = { header: { dealId: "deal-123" } } as unknown as InvestorReviewViewModel
const sampleAdaptedEvidence = [{ id: "evi-1", linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW" }]
const sampleProfessionalEvidenceGateway = {
  savedDealId: "deal-123",
  gates: [],
  sections: [],
  decisionLock: {
    savedDealId: "deal-123",
    finalDecisionLockStatus: "LOCKED",
    lockReason: "Display-only professional evidence lock state",
    linkedGateAreas: [],
    linkedEvidenceIds: [],
  },
  professionalGateStatus: "NOT_STARTED",
  professionalReadiness: "NOT_READY",
  reviewSource: "OPERATOR_NOTE",
  requiredEvidenceSummary: "Professional evidence review required",
  professionalConfirmationSummary:
    "Professional confirmation requires explicit compatible qualifying source",
  recommendedNextAction: "Request compatible professional source confirmation",
  linkedEvidenceCommandEvidenceId: null,
} as unknown as ProfessionalEvidenceGatewayViewModel

describe("loadInvestorReviewPageModel", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-01T10:00:00.000Z"))

    getSavedDealByIdMock.mockReset()
    loadPdfEvidencePackForDealMock.mockReset()
    mapPdfEvidencePackToInvestorReviewMock.mockReset()
    adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock.mockReset()
    loadProfessionalEvidenceGatewayViewModelMock.mockReset()

    getSavedDealByIdMock.mockResolvedValue(makeSavedDealRecord())
    loadPdfEvidencePackForDealMock.mockResolvedValue(samplePack)
    mapPdfEvidencePackToInvestorReviewMock.mockReturnValue(sampleViewModel)
    adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock.mockReturnValue(
      sampleAdaptedEvidence
    )
    loadProfessionalEvidenceGatewayViewModelMock.mockReturnValue(
      sampleProfessionalEvidenceGateway
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("trims surrounding whitespace before calling the saved-deal repository", async () => {
    await loadInvestorReviewPageModel("  deal-123  ")

    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-123")
  })

  it("returns not_found for a blank id and calls no dependency", async () => {
    const result = await loadInvestorReviewPageModel("   ")

    expect(result).toEqual({ status: "not_found" })
    expect(getSavedDealByIdMock).not.toHaveBeenCalled()
    expect(loadPdfEvidencePackForDealMock).not.toHaveBeenCalled()
    expect(mapPdfEvidencePackToInvestorReviewMock).not.toHaveBeenCalled()
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).not.toHaveBeenCalled()
    expect(loadProfessionalEvidenceGatewayViewModelMock).not.toHaveBeenCalled()
  })

  it("returns not_found when the saved deal is missing and stops before pack loading", async () => {
    getSavedDealByIdMock.mockResolvedValueOnce(null)

    const result = await loadInvestorReviewPageModel("deal-404")

    expect(result).toEqual({ status: "not_found" })
    expect(getSavedDealByIdMock).toHaveBeenCalledWith("deal-404")
    expect(loadPdfEvidencePackForDealMock).not.toHaveBeenCalled()
    expect(mapPdfEvidencePackToInvestorReviewMock).not.toHaveBeenCalled()
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).not.toHaveBeenCalled()
    expect(loadProfessionalEvidenceGatewayViewModelMock).not.toHaveBeenCalled()
  })

  it("returns unavailable when the saved-deal lookup throws and stops downstream calls", async () => {
    getSavedDealByIdMock.mockRejectedValueOnce(new Error("connection refused at 10.0.0.5"))

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({ status: "unavailable" })
    expect(loadPdfEvidencePackForDealMock).not.toHaveBeenCalled()
    expect(mapPdfEvidencePackToInvestorReviewMock).not.toHaveBeenCalled()
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).not.toHaveBeenCalled()
    expect(loadProfessionalEvidenceGatewayViewModelMock).not.toHaveBeenCalled()
  })

  it("loads the pack with the normalized id, one ISO timestamp, and the fixed confidentiality label", async () => {
    await loadInvestorReviewPageModel("  deal-123  ")

    expect(loadPdfEvidencePackForDealMock).toHaveBeenCalledTimes(1)
    expect(loadPdfEvidencePackForDealMock).toHaveBeenCalledWith({
      dealId: "deal-123",
      generatedAt: "2026-07-01T10:00:00.000Z",
      confidentialityLabel: "INTERNAL INVESTOR DECISION SUPPORT",
    })
  })

  it("returns not_found when the pack loader returns null and prevents mapper execution", async () => {
    loadPdfEvidencePackForDealMock.mockResolvedValueOnce(null)

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({ status: "not_found" })
    expect(mapPdfEvidencePackToInvestorReviewMock).not.toHaveBeenCalled()
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).not.toHaveBeenCalled()
    expect(loadProfessionalEvidenceGatewayViewModelMock).not.toHaveBeenCalled()
  })

  it("returns unavailable when the pack loader rejects and prevents mapper execution", async () => {
    loadPdfEvidencePackForDealMock.mockRejectedValueOnce(new Error("SELECT failed: relation missing"))

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({ status: "unavailable" })
    expect(mapPdfEvidencePackToInvestorReviewMock).not.toHaveBeenCalled()
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).not.toHaveBeenCalled()
    expect(loadProfessionalEvidenceGatewayViewModelMock).not.toHaveBeenCalled()
  })

  it("maps the exact canonical saved deal and pack exactly once on success", async () => {
    const savedDeal = makeSavedDealRecord({ id: "deal-123" })
    getSavedDealByIdMock.mockResolvedValueOnce(savedDeal)
    loadPdfEvidencePackForDealMock.mockResolvedValueOnce(samplePack)

    await loadInvestorReviewPageModel("deal-123")

    expect(mapPdfEvidencePackToInvestorReviewMock).toHaveBeenCalledTimes(1)
    expect(mapPdfEvidencePackToInvestorReviewMock).toHaveBeenCalledWith({
      pack: samplePack,
      savedDeal,
    })
  })

  it("adapts canonical pack evidence and passes the normalized id to the Gateway loader", async () => {
    await loadInvestorReviewPageModel("  deal-123  ")

    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).toHaveBeenCalledTimes(1)
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).toHaveBeenCalledWith(
      samplePack.evidenceIndex
    )
    expect(loadProfessionalEvidenceGatewayViewModelMock).toHaveBeenCalledTimes(1)
    expect(loadProfessionalEvidenceGatewayViewModelMock).toHaveBeenCalledWith({
      savedDealId: "deal-123",
      evidence: sampleAdaptedEvidence,
    })
  })

  it("returns ready with the standard Investor Review fields unchanged and the attached professional gateway model", async () => {
    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({
      status: "ready",
      viewModel: {
        ...sampleViewModel,
        professionalEvidenceGateway: sampleProfessionalEvidenceGateway,
      },
    })
  })

  it("returns unavailable when the mapper throws and leaks no internal detail", async () => {
    mapPdfEvidencePackToInvestorReviewMock.mockImplementationOnce(() => {
      throw new Error("mapper exploded: stack trace at internal/module.js:42")
    })

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({ status: "unavailable" })
    expect(JSON.stringify(result)).not.toContain("stack trace")
    expect(JSON.stringify(result)).not.toContain("internal/module.js")
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).not.toHaveBeenCalled()
    expect(loadProfessionalEvidenceGatewayViewModelMock).not.toHaveBeenCalled()
  })

  it("returns unavailable when the adapter throws and leaks no internal detail", async () => {
    adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock.mockImplementationOnce(() => {
      throw new Error("adapter exploded: internal/adapter.ts:99")
    })

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({ status: "unavailable" })
    expect(JSON.stringify(result)).not.toContain("internal/adapter.ts")
  })

  it("returns unavailable when the Gateway model builder throws and leaks no internal detail", async () => {
    loadProfessionalEvidenceGatewayViewModelMock.mockImplementationOnce(() => {
      throw new Error("gateway exploded: internal/gateway.ts:99")
    })

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({ status: "unavailable" })
    expect(JSON.stringify(result)).not.toContain("internal/gateway.ts")
  })

  it("does not generate a second timestamp for a single load", async () => {
    const nowSpy = vi.spyOn(Date, "now")

    await loadInvestorReviewPageModel("deal-123")

    const isoCallArg = loadPdfEvidencePackForDealMock.mock.calls[0]?.[0]?.generatedAt
    expect(isoCallArg).toBe("2026-07-01T10:00:00.000Z")
    nowSpy.mockRestore()
  })

  it("keeps zero evidence as a valid ready result with the attached conservative Gateway model", async () => {
    const emptyPack = { ...samplePack, evidenceIndex: [] } as PdfEvidencePack
    loadPdfEvidencePackForDealMock.mockResolvedValueOnce(emptyPack)
    adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock.mockReturnValueOnce([])

    const result = await loadInvestorReviewPageModel("deal-123")

    expect(result).toEqual({
      status: "ready",
      viewModel: {
        ...sampleViewModel,
        professionalEvidenceGateway: sampleProfessionalEvidenceGateway,
      },
    })
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).toHaveBeenCalledWith(
      []
    )
    expect(loadProfessionalEvidenceGatewayViewModelMock).toHaveBeenCalledWith({
      savedDealId: "deal-123",
      evidence: [],
    })
  })

  it("does not introduce a second evidence read or modify Investor Shield-owned canonical loading", async () => {
    await loadInvestorReviewPageModel("deal-123")

    expect(getSavedDealByIdMock).toHaveBeenCalledTimes(1)
    expect(loadPdfEvidencePackForDealMock).toHaveBeenCalledTimes(1)
    expect(mapPdfEvidencePackToInvestorReviewMock).toHaveBeenCalledTimes(1)
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidenceMock).toHaveBeenCalledTimes(1)
    expect(loadProfessionalEvidenceGatewayViewModelMock).toHaveBeenCalledTimes(1)
  })
})
