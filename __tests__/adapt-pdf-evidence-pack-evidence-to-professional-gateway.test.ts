import { describe, expect, it } from "vitest"
import { adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence } from "@/lib/investor-review/adapt-pdf-evidence-pack-evidence-to-professional-gateway"
import type { PdfEvidencePackEvidenceItem } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value)
    for (const nested of Object.values(value as Record<string, unknown>)) {
      if (nested && typeof nested === "object" && !Object.isFrozen(nested)) {
        deepFreeze(nested)
      }
    }
  }

  return value
}

function makeEvidenceItem(
  overrides: Partial<PdfEvidencePackEvidenceItem> = {}
): PdfEvidencePackEvidenceItem {
  return {
    evidenceId: "evi-1",
    evidenceType: "TITLE_REVIEW",
    title: "Solicitor title pack",
    description: "Canonical evidence description",
    provenanceLabel: "Evidence Lite",
    capturedAt: "2026-07-01T09:00:00.000Z",
    reviewedAt: "2026-07-02T09:00:00.000Z",
    reviewStatus: "REVIEWED",
    relatedGateIds: ["TITLE"],
    controlledReferenceState: "AVAILABLE",
    controlledReferenceLabel: "Canonical ref",
    evidenceCommandType: "TITLE_LEGAL",
    linkedInvestorShieldGate: "TITLE",
    linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW",
    evidenceSummary: "Solicitor title evidence summary",
    evidenceStatus: "SUFFICIENT",
    evidenceStrength: "STRONG",
    reviewState: "PROFESSIONAL_CONFIRMED",
    blockerImpact: "DOES_NOT_BLOCK",
    recommendedNextAction: "Keep solicitor title evidence visible",
    expiryOrUpdateDate: "2026-08-01",
    source: "SOLICITOR",
    mobileCaptureNote: "Canonical capture note",
    ...overrides,
  }
}

describe("adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence", () => {
  it("maps canonical evidence-index records to Gateway loader input fields", () => {
    const result = adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence([
      makeEvidenceItem(),
    ])

    expect(result).toEqual([
      {
        id: "evi-1",
        evidenceType: "TITLE_REVIEW",
        linkedGate: "TITLE",
        linkedInvestorShieldGate: "TITLE",
        evidenceCommandType: "TITLE_LEGAL",
        title: "Solicitor title pack",
        note: "Canonical evidence description",
        evidenceSummary: "Solicitor title evidence summary",
        evidenceStatus: "SUFFICIENT",
        evidenceStrength: "STRONG",
        reviewState: "PROFESSIONAL_CONFIRMED",
        blockerImpact: "DOES_NOT_BLOCK",
        linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW",
        recommendedNextAction: "Keep solicitor title evidence visible",
        expiryOrUpdateDate: "2026-08-01",
        source: "SOLICITOR",
        mobileCaptureNote: "Canonical capture note",
      },
    ])
  })

  it("preserves record order and supported linked gate values", () => {
    const result = adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence([
      makeEvidenceItem({
        evidenceId: "evi-first",
        linkedInvestorShieldGate: "TITLE",
        linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW",
      }),
      makeEvidenceItem({
        evidenceId: "evi-second",
        evidenceType: "SOLD_COMP",
        relatedGateIds: ["SOLD_COMPS"],
        linkedInvestorShieldGate: "SOLD_COMPS",
        linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
      }),
    ])

    expect(result.map((item) => item.id)).toEqual(["evi-first", "evi-second"])
    expect(result[0]?.linkedInvestorShieldGate).toBe("TITLE")
    expect(result[1]?.linkedProfessionalGate).toBe("ACTUAL_SOLD_COMPARABLE_REVIEW")
    expect(result[1]?.linkedGate).toBe("SOLD_COMPS")
  })

  it("preserves canonical status, review, strength, blocker, action, and expiry fields", () => {
    const result = adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence([
      makeEvidenceItem({
        evidenceStatus: "RECEIVED",
        reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
        evidenceStrength: "MODERATE",
        blockerImpact: "REQUIRES_MANUAL_REVIEW",
        recommendedNextAction: "Request surveyor confirmation",
        expiryOrUpdateDate: "2026-09-15",
      }),
    ])

    expect(result[0]).toMatchObject({
      evidenceStatus: "RECEIVED",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      evidenceStrength: "MODERATE",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      recommendedNextAction: "Request surveyor confirmation",
      expiryOrUpdateDate: "2026-09-15",
    })
  })

  it("does not calculate readiness or compatibility outputs", () => {
    const result = adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence([
      makeEvidenceItem(),
    ])

    expect(result[0]).not.toHaveProperty("professionalGateStatus")
    expect(result[0]).not.toHaveProperty("professionalReadiness")
    expect(result[0]).not.toHaveProperty("reviewSource")
  })

  it("returns an empty array for empty input", () => {
    expect(adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence([])).toEqual([])
  })

  it("does not mutate input records", () => {
    const input = deepFreeze([
      makeEvidenceItem({
        evidenceId: " immutable-id ",
        relatedGateIds: ["TITLE", "SOLD_COMPS"],
      }),
    ])
    const before = JSON.stringify(input)

    const result = adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence(input)

    expect(JSON.stringify(input)).toBe(before)
    expect(result[0]?.id).toBe(" immutable-id ")
    expect(input[0]?.relatedGateIds).toEqual(["TITLE", "SOLD_COMPS"])
  })
})
