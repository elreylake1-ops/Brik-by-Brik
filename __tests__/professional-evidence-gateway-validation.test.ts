import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS,
  PROFESSIONAL_EVIDENCE_REVIEW_SOURCES,
  PROFESSIONAL_GATE_AREAS,
  PROFESSIONAL_GATE_STATUSES,
  PROFESSIONAL_READINESS_STATUSES,
  FINAL_DECISION_LOCK_STATUSES,
} from "@/types/professional-evidence-gateway"
import {
  normalizeProfessionalEvidenceGatewayDraft,
  validateFinalDecisionLockStatus,
  validateProfessionalEvidenceGatewayDraft,
  validateProfessionalEvidenceReviewSource,
  validateProfessionalGateArea,
  validateProfessionalGateStatus,
  validateProfessionalReadiness,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-validation"

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

function makeDraft(overrides: Record<string, unknown> = {}) {
  return {
    savedDealId: " deal-123 ",
    linkedEvidenceCommandEvidenceId: " evi-123 ",
    linkedInvestorShieldGate: " SOLICITOR_REVIEW ",
    professionalGateArea: " SOLICITOR_REVIEW ",
    professionalGateStatus: " RECEIVED ",
    professionalReadiness: " READY_FOR_REVIEW ",
    reviewState: " PROFESSIONAL_REVIEW_REQUIRED ",
    blockerImpact: " REQUIRES_MANUAL_REVIEW ",
    evidenceStrength: " STRONG ",
    requiredEvidenceSummary: " Required evidence summary ",
    professionalConfirmationSummary: " Professional confirmation summary ",
    recommendedNextAction: " Request solicitor confirmation ",
    expiryOrReviewDate: "2026-07-14",
    finalDecisionLockStatus: " UNLOCKED_FOR_REVIEW ",
    lockReason: " Lock reason ",
    reviewSource: " SOLICITOR ",
    linkedEvidenceIds: [" evi-1 ", "evi-2", "evi-1"],
    ...overrides,
  }
}

describe("professional evidence gateway validation", () => {
  it("exports the approved contract values", () => {
    expect(PROFESSIONAL_GATE_AREAS).toEqual([
      "SOLICITOR_REVIEW",
      "LEASEHOLD_ADVICE",
      "BROKER_LENDER_CONFIRMATION",
      "BUILDER_QUOTE_CONFIRMATION",
      "SURVEYOR_REPORT",
      "SOLD_COMPARABLE_REVIEW",
    ])
    expect(PROFESSIONAL_GATE_STATUSES).toEqual([
      "NOT_STARTED",
      "REQUESTED",
      "RECEIVED",
      "UNDER_REVIEW",
      "CONFIRMED",
      "ADVERSE",
      "EXPIRED",
      "NOT_REQUIRED",
    ])
    expect(PROFESSIONAL_READINESS_STATUSES).toEqual([
      "NOT_READY",
      "PARTIALLY_READY",
      "READY_FOR_REVIEW",
      "PROFESSIONALLY_CONFIRMED",
      "BLOCKED",
    ])
    expect(FINAL_DECISION_LOCK_STATUSES).toEqual([
      "LOCKED",
      "UNLOCKED_FOR_REVIEW",
      "BLOCKED_BY_HARD_GATE",
      "BLOCKED_BY_PROFESSIONAL_EVIDENCE",
      "MANUAL_REVIEW_REQUIRED",
    ])
    expect(PROFESSIONAL_EVIDENCE_REVIEW_SOURCES).toEqual([
      "OPERATOR_NOTE",
      "SOLICITOR",
      "BROKER",
      "LENDER",
      "BUILDER",
      "SURVEYOR",
      "LAND_REGISTRY",
      "RIGHTMOVE_SOLD_DATA",
      "AGENT",
      "OTHER",
    ])
  })

  it("accepts controlled enum values and rejects unknown values", () => {
    expect(validateProfessionalGateArea("SOLICITOR_REVIEW")).toBe("SOLICITOR_REVIEW")
    expect(validateProfessionalGateArea("SOLICITOR_FEEDBACK")).toBeUndefined()
    expect(validateProfessionalGateArea("UNKNOWN")).toBeUndefined()

    expect(validateProfessionalGateStatus("CONFIRMED")).toBe("CONFIRMED")
    expect(validateProfessionalGateStatus("UNKNOWN")).toBeUndefined()

    expect(validateProfessionalReadiness("PROFESSIONALLY_CONFIRMED")).toBe(
      "PROFESSIONALLY_CONFIRMED"
    )
    expect(validateProfessionalReadiness("UNKNOWN")).toBeUndefined()

    expect(validateFinalDecisionLockStatus("LOCKED")).toBe("LOCKED")
    expect(validateFinalDecisionLockStatus("UNKNOWN")).toBeUndefined()

    expect(validateProfessionalEvidenceReviewSource("SOLICITOR")).toBe("SOLICITOR")
    expect(validateProfessionalEvidenceReviewSource("UNKNOWN")).toBeUndefined()
  })

  it("validates a complete draft and trims text safely", () => {
    const result = validateProfessionalEvidenceGatewayDraft(makeDraft())
    const normalized = normalizeProfessionalEvidenceGatewayDraft(makeDraft())

    expect(result.valid).toBe(true)
    expect(normalized).toEqual(result.value)
    expect(result.value).toEqual({
      savedDealId: "deal-123",
      linkedEvidenceCommandEvidenceId: "evi-123",
      linkedInvestorShieldGate: "SOLICITOR_REVIEW",
      professionalGateArea: "SOLICITOR_REVIEW",
      professionalGateStatus: "RECEIVED",
      professionalReadiness: "READY_FOR_REVIEW",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      evidenceStrength: "STRONG",
      requiredEvidenceSummary: "Required evidence summary",
      professionalConfirmationSummary: "Professional confirmation summary",
      recommendedNextAction: "Request solicitor confirmation",
      expiryOrReviewDate: "2026-07-14",
      finalDecisionLockStatus: "UNLOCKED_FOR_REVIEW",
      lockReason: "Lock reason",
      reviewSource: "SOLICITOR",
      linkedEvidenceIds: ["evi-1", "evi-2"],
    })
    expect(result.errors).toEqual([])
    expect(result.warnings).toEqual([])
  })

  it("rejects CONFIRMED without an explicit qualifying review source", () => {
    const missingReviewSource = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalGateStatus: "CONFIRMED",
        reviewSource: undefined,
      })
    )
    const operatorNoteReviewSource = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalGateStatus: "CONFIRMED",
        reviewSource: "OPERATOR_NOTE",
      })
    )

    expect(missingReviewSource.valid).toBe(false)
    expect(operatorNoteReviewSource.valid).toBe(false)
    expect(missingReviewSource.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "reviewSource",
        }),
      ])
    )
    expect(operatorNoteReviewSource.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "reviewSource",
        }),
      ])
    )
  })

  it("accepts CONFIRMED with a qualifying review source", () => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalGateStatus: "CONFIRMED",
        reviewSource: "SOLICITOR",
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.reviewSource).toBe("SOLICITOR")
  })

  it.each([
    ["missing review source", undefined],
    ["operator note", "OPERATOR_NOTE"],
  ] as const)("rejects PROFESSIONALLY_CONFIRMED with %s", (_, reviewSource) => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalReadiness: "PROFESSIONALLY_CONFIRMED",
        reviewSource,
      })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "reviewSource",
        }),
      ])
    )
  })

  it("accepts PROFESSIONALLY_CONFIRMED with a qualifying review source", () => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalGateStatus: "RECEIVED",
        professionalReadiness: "PROFESSIONALLY_CONFIRMED",
        reviewSource: "BROKER",
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.professionalReadiness).toBe("PROFESSIONALLY_CONFIRMED")
    expect(result.value?.reviewSource).toBe("BROKER")
  })

  it("rejects unlocked-for-review professional confirmation backed only by operator notes", () => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalGateStatus: "CONFIRMED",
        finalDecisionLockStatus: "UNLOCKED_FOR_REVIEW",
        reviewSource: "OPERATOR_NOTE",
      })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "reviewSource",
        }),
      ])
    )
  })

  it("defaults conservatively and never implies approval", () => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        professionalGateStatus: undefined,
        professionalReadiness: undefined,
        finalDecisionLockStatus: undefined,
        reviewSource: undefined,
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.professionalGateStatus).toBe(
      PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalGateStatus
    )
    expect(result.value?.professionalReadiness).toBe(
      PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.professionalReadiness
    )
    expect(result.value?.finalDecisionLockStatus).toBe(
      PROFESSIONAL_EVIDENCE_GATEWAY_DEFAULTS.finalDecisionLockStatus
    )
    expect(result.value?.professionalGateStatus).not.toBe("CONFIRMED")
    expect(result.value?.professionalReadiness).not.toBe("PROFESSIONALLY_CONFIRMED")
    expect(result.value?.finalDecisionLockStatus).not.toBe("UNLOCKED_FOR_REVIEW")
    expect(result.value?.reviewSource).toBe("OPERATOR_NOTE")
  })

  it("rejects invalid values with structured safe errors", () => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({
        savedDealId: "   ",
        professionalGateArea: "SURVEYOR_PHOTOS",
        professionalGateStatus: "APPROVED",
        professionalReadiness: "READY",
        finalDecisionLockStatus: "OPEN",
        reviewSource: "HACKER",
        linkedEvidenceIds: ["ok", 42],
      })
    )

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "savedDealId",
        "professionalGateArea",
        "professionalGateStatus",
        "professionalReadiness",
        "finalDecisionLockStatus",
        "reviewSource",
        "linkedEvidenceIds",
      ])
    )
    expect(JSON.stringify(result.errors)).not.toContain("SURVEYOR_PHOTOS")
    expect(JSON.stringify(result.errors)).not.toContain("APPROVED")
    expect(JSON.stringify(result.errors)).not.toContain("HACKER")
  })

  it("rejects a non-canonical solicitor alias", () => {
    const result = validateProfessionalEvidenceGatewayDraft(
      makeDraft({ professionalGateArea: "SOLICITOR_FEEDBACK" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "professionalGateArea",
        }),
      ])
    )
  })

  it("has no mutation side effects", () => {
    const draft = deepFreeze(makeDraft())
    const before = JSON.stringify(draft)

    const result = validateProfessionalEvidenceGatewayDraft(draft)

    expect(result.valid).toBe(true)
    expect(JSON.stringify(draft)).toBe(before)
  })

  it("does not import runtime modules", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/professional-evidence-gateway-validation.ts"
      ),
      "utf8"
    )

    expect(source).toContain('from "@/types/professional-evidence-gateway"')
    expect(source).toMatch(/^import\s/m)
    expect(source.match(/^import\s/gm)?.length).toBe(1)
    expect(source).not.toContain("@/app/")
    expect(source).not.toContain("@/components/")
    expect(source).not.toContain("@/db/")
    expect(source).not.toContain("/api/")
    expect(source).not.toContain("migration")
  })
})
