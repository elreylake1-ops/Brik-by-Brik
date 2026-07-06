import { describe, expect, it } from "vitest"
import {
  EVIDENCE_COMMAND_BLOCKER_IMPACTS,
  EVIDENCE_COMMAND_DEFAULTS,
  EVIDENCE_COMMAND_PROFESSIONAL_GATES,
  EVIDENCE_COMMAND_REVIEW_STATES,
  EVIDENCE_COMMAND_STATUSES,
  EVIDENCE_COMMAND_STRENGTHS,
  EVIDENCE_COMMAND_TYPES,
  EVIDENCE_LITE_EVIDENCE_TYPES,
  EVIDENCE_LITE_GATES,
  EVIDENCE_LITE_STATUSES,
} from "@/types/evidence-lite"
import {
  normalizeEvidenceLiteGateKey,
  validateEvidenceCommandInput,
  validateCreateEvidenceLiteInput,
  validateUpdateEvidenceLiteInput,
} from "@/lib/evidence-lite/evidence-lite-validation"

function makeEvidenceCommandInput(overrides: Record<string, unknown> = {}) {
  return {
    evidenceType: "TITLE_LEGAL",
    linkedInvestorShieldGate: "TITLE",
    linkedProfessionalGate: "SURVEYOR_REPORT",
    title: " Title ",
    evidenceSummary: " Summary ",
    evidenceStatus: "RECEIVED",
    evidenceStrength: "STRONG",
    reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
    blockerImpact: "REQUIRES_MANUAL_REVIEW",
    recommendedNextAction: " Follow up ",
    expiryOrUpdateDate: "2026-06-26",
    source: " operator_entered ",
    mobileCaptureNote: " captured on phone ",
    ...overrides,
  }
}

describe("evidence lite contract validation", () => {
  it("locks the canonical contract constants", () => {
    expect(EVIDENCE_LITE_STATUSES).toEqual([
      "MISSING",
      "RECORDED",
      "REVIEWED",
      "VERIFIED",
      "REJECTED",
    ])
    expect(EVIDENCE_LITE_GATES).toEqual([
      "SOLD_COMPS",
      "TITLE",
      "LEASEHOLD",
      "PLANNING_BUILDING_CONTROL",
      "REFURB_CERTAINTY",
      "BUILDER_PROPOSAL_CONTRACT",
      "DAMP_STRUCTURAL",
      "LENDER_CRITERIA",
      "RENTAL_DEMAND",
      "SOLICITOR_REVIEW",
    ])
    expect(EVIDENCE_LITE_EVIDENCE_TYPES).toEqual([
      "SOLD_COMP",
      "TITLE_REVIEW",
      "LEASEHOLD_REVIEW",
      "PLANNING_BUILDING_CONTROL",
      "REFURB_NOTE",
      "BUILDER_QUOTE",
      "SURVEY_NOTE",
      "LENDER_NOTE",
      "RENTAL_DEMAND",
      "SOLICITOR_REVIEW",
      "OTHER",
    ])
  })

  it("normalizes the legacy solicitor feedback alias to solicitor review", () => {
    expect(normalizeEvidenceLiteGateKey(" SOLICITOR_FEEDBACK ")).toBe("SOLICITOR_REVIEW")
    expect(normalizeEvidenceLiteGateKey("SOLICITOR_REVIEW")).toBe("SOLICITOR_REVIEW")
  })

  it("rejects general and arbitrary gate names", () => {
    expect(normalizeEvidenceLiteGateKey("GENERAL")).toBeUndefined()
    expect(normalizeEvidenceLiteGateKey("some-other-gate")).toBeUndefined()
  })

  it("accepts and normalizes a complete create payload", () => {
    const result = validateCreateEvidenceLiteInput({
      dealId: " deal-123 ",
      evidenceType: "TITLE_REVIEW",
      linkedGate: " SOLICITOR_FEEDBACK ",
      title: " Title evidence ",
      note: " Solicitor note ",
      status: "RECORDED",
      reviewed: false,
    })

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      dealId: "deal-123",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      title: "Title evidence",
      note: "Solicitor note",
      status: "RECORDED",
      reviewed: false,
    })
    expect(result.warnings).toEqual([
      "linkedGate normalized from SOLICITOR_FEEDBACK to SOLICITOR_REVIEW",
    ])
  })

  it("rejects unsupported create values without mutating the input", () => {
    const input = {
      dealId: "deal-123",
      evidenceType: "INVALID",
      linkedGate: "GENERAL",
      title: " ",
      note: "",
      status: "SATISFIED",
      reviewed: "nope",
      reviewerNote: "Reviewed by James",
      extra: true,
    }
    const before = JSON.stringify(input)

    const result = validateCreateEvidenceLiteInput(input)

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "extra",
        "reviewerNote",
        "evidenceType",
        "linkedGate",
        "title",
        "note",
        "status",
        "reviewed",
      ])
    )
    expect(JSON.stringify(input)).toBe(before)
  })

  it("rejects immutable fields, unknown fields, and empty update payloads", () => {
    const invalidResult = validateUpdateEvidenceLiteInput({
      id: "evi-1",
      dealId: "deal-123",
      evidenceId: "evi-2",
      createdAt: "2026-06-26T00:00:00.000Z",
      updatedAt: "2026-06-26T00:00:00.000Z",
      status: "VERIFIED",
      reviewerNote: "Reviewed by James",
      extra: true,
    })

    expect(invalidResult.valid).toBe(false)
    expect(invalidResult.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining([
        "id",
        "dealId",
        "evidenceId",
        "createdAt",
        "updatedAt",
        "status",
        "reviewerNote",
        "extra",
      ])
    )

    const emptyResult = validateUpdateEvidenceLiteInput({})
    expect(emptyResult.valid).toBe(false)
    expect(emptyResult.errors).toEqual(
      expect.arrayContaining([{ field: "root", message: "update input must include at least one mutable field" }])
    )
  })

  it("accepts a single mutable field without adding defaults", () => {
    const result = validateUpdateEvidenceLiteInput({
      reviewed: true,
    })

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      reviewed: true,
    })
    expect(result.warnings).toEqual([])
  })

  it("accepts multiple mutable fields, trims text, and normalizes solicitor feedback", () => {
    const result = validateUpdateEvidenceLiteInput({
      title: " Updated title ",
      note: " Updated note ",
      evidenceType: "TITLE_REVIEW",
      linkedGate: " SOLICITOR_FEEDBACK ",
      reviewed: false,
    })

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      title: "Updated title",
      note: "Updated note",
      evidenceType: "TITLE_REVIEW",
      linkedGate: "SOLICITOR_REVIEW",
      reviewed: false,
    })
    expect(result.warnings).toEqual([
      "linkedGate normalized from SOLICITOR_FEEDBACK to SOLICITOR_REVIEW",
    ])
  })

  it("rejects overlong mutable text fields", () => {
    const longTitle = "x".repeat(201)
    const longNote = "y".repeat(5001)

    const titleResult = validateUpdateEvidenceLiteInput({
      title: longTitle,
    })
    expect(titleResult.valid).toBe(false)
    expect(titleResult.errors).toEqual(
      expect.arrayContaining([
        { field: "title", message: "title must be 200 characters or fewer" },
      ])
    )

    const noteResult = validateUpdateEvidenceLiteInput({
      note: longNote,
    })
    expect(noteResult.valid).toBe(false)
    expect(noteResult.errors).toEqual(
      expect.arrayContaining([
        { field: "note", message: "note must be 5000 characters or fewer" },
      ])
    )
  })

  it("locks the evidence command contract constants", () => {
    expect(EVIDENCE_COMMAND_TYPES).toEqual([
      "SOLD_COMPARABLE",
      "TITLE_LEGAL",
      "LEASEHOLD",
      "PLANNING_BUILDING_CONTROL",
      "REFURB",
      "BUILDER_QUOTE",
      "DAMP_STRUCTURAL",
      "LENDER_BROKER",
      "RENTAL_DEMAND",
      "SOLICITOR_REVIEW",
      "AGENT_RESPONSE",
      "PHOTO_EVIDENCE",
      "VIDEO_EVIDENCE",
      "SURVEYOR_EVIDENCE",
      "OFFER_NEGOTIATION_EVIDENCE",
      "OTHER",
    ])
    expect(EVIDENCE_COMMAND_STATUSES).toEqual([
      "MISSING",
      "REQUESTED",
      "RECEIVED",
      "REVIEWED",
      "SUFFICIENT",
      "INSUFFICIENT",
      "REJECTED",
      "EXPIRED",
    ])
    expect(EVIDENCE_COMMAND_STRENGTHS).toEqual(["WEAK", "MODERATE", "STRONG"])
    expect(EVIDENCE_COMMAND_REVIEW_STATES).toEqual([
      "NOT_REVIEWED",
      "REVIEWED_BY_OPERATOR",
      "PROFESSIONAL_REVIEW_REQUIRED",
      "PROFESSIONAL_CONFIRMED",
    ])
    expect(EVIDENCE_COMMAND_BLOCKER_IMPACTS).toEqual([
      "DOES_NOT_BLOCK",
      "CAUTION_ONLY",
      "BLOCKS_PROGRESSION",
      "REQUIRES_MANUAL_REVIEW",
    ])
    expect(EVIDENCE_COMMAND_PROFESSIONAL_GATES).toEqual([
      "NONE",
      "SOLICITOR_TITLE_REVIEW",
      "BROKER_CONFIRMATION",
      "SURVEYOR_REPORT",
      "BUILDER_QUOTE",
      "PLANNING_BUILDING_CONTROL_CONFIRMATION",
      "ACTUAL_SOLD_COMPARABLE_REVIEW",
      "LENDER_BROKER_CONFIRMATION",
      "SPECIALIST_REPORT",
    ])
    expect(EVIDENCE_COMMAND_DEFAULTS).toEqual({
      evidenceStatus: "MISSING",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "NONE",
    })
  })

  it("accepts and normalizes a complete evidence command payload", () => {
    const result = validateEvidenceCommandInput(makeEvidenceCommandInput())

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      evidenceType: "TITLE_LEGAL",
      linkedInvestorShieldGate: "TITLE",
      linkedProfessionalGate: "SURVEYOR_REPORT",
      title: "Title",
      evidenceSummary: "Summary",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
      blockerImpact: "REQUIRES_MANUAL_REVIEW",
      recommendedNextAction: "Follow up",
      expiryOrUpdateDate: "2026-06-26",
      source: "operator_entered",
      mobileCaptureNote: "captured on phone",
    })
    expect(result.warnings).toEqual([])
  })

  it("uses safe defaults without implying approval", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({
        linkedProfessionalGate: undefined,
        evidenceStatus: undefined,
        evidenceStrength: undefined,
        reviewState: undefined,
        blockerImpact: undefined,
        recommendedNextAction: undefined,
        expiryOrUpdateDate: undefined,
        source: undefined,
        mobileCaptureNote: undefined,
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value).toEqual({
      evidenceType: "TITLE_LEGAL",
      linkedInvestorShieldGate: "TITLE",
      linkedProfessionalGate: "NONE",
      title: "Title",
      evidenceSummary: "Summary",
      evidenceStatus: "MISSING",
      evidenceStrength: "WEAK",
      reviewState: "NOT_REVIEWED",
      blockerImpact: "DOES_NOT_BLOCK",
      recommendedNextAction: null,
      expiryOrUpdateDate: null,
      source: null,
      mobileCaptureNote: null,
    })
    expect(result.warnings).toEqual([])
  })

  it("rejects an unknown evidence type", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ evidenceType: "NOT_A_TYPE" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "evidenceType",
        }),
      ])
    )
  })

  it("rejects GENERAL as an evidence type", () => {
    const result = validateEvidenceCommandInput(makeEvidenceCommandInput({ evidenceType: "GENERAL" }))

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "evidenceType",
        }),
      ])
    )
  })

  it("rejects an invalid Investor Shield gate", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ linkedInvestorShieldGate: "GENERAL" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "linkedInvestorShieldGate",
        }),
      ])
    )
  })

  it("rejects an unknown evidence status", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ evidenceStatus: "SATISFIED" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "evidenceStatus",
        }),
      ])
    )
  })

  it("rejects an unknown strength", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ evidenceStrength: "HARD" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "evidenceStrength",
        }),
      ])
    )
  })

  it("rejects an unknown review state", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ reviewState: "APPROVED" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "reviewState",
        }),
      ])
    )
  })

  it("rejects an unknown blocker impact", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ blockerImpact: "BLOCKS_ALL_THINGS" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "blockerImpact",
        }),
      ])
    )
  })

  it("rejects an unknown professional gate", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ linkedProfessionalGate: "SURVEYOR_PHOTOS" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "linkedProfessionalGate",
        }),
      ])
    )
  })

  it("accepts photo evidence as a structured evidence type", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ evidenceType: "PHOTO_EVIDENCE" })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.evidenceType).toBe("PHOTO_EVIDENCE")
  })

  it("accepts video evidence as a structured evidence type", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ evidenceType: "VIDEO_EVIDENCE" })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.evidenceType).toBe("VIDEO_EVIDENCE")
  })

  it("rejects an empty title", () => {
    const result = validateEvidenceCommandInput(makeEvidenceCommandInput({ title: "   " }))

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "title",
        }),
      ])
    )
  })

  it("rejects an empty evidence summary", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ evidenceSummary: "   " })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "evidenceSummary",
        }),
      ])
    )
  })

  it("trims optional source and mobile capture note fields", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({
        source: "  operator_entered  ",
        mobileCaptureNote: "  captured on phone  ",
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.source).toBe("operator_entered")
    expect(result.value?.mobileCaptureNote).toBe("captured on phone")
  })

  it("rejects an invalid expiry/update date", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({ expiryOrUpdateDate: "not-a-date" })
    )

    expect(result.valid).toBe(false)
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: "expiryOrUpdateDate",
        }),
      ])
    )
  })

  it("keeps SUFFICIENT evidence from implying professional confirmation", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({
        evidenceStatus: "SUFFICIENT",
        reviewState: "NOT_REVIEWED",
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.evidenceStatus).toBe("SUFFICIENT")
    expect(result.value?.reviewState).toBe("NOT_REVIEWED")
  })

  it("keeps PROFESSIONAL_CONFIRMED explicit and not defaulted", () => {
    const result = validateEvidenceCommandInput(
      makeEvidenceCommandInput({
        reviewState: "PROFESSIONAL_CONFIRMED",
      })
    )

    expect(result.valid).toBe(true)
    expect(result.value?.reviewState).toBe("PROFESSIONAL_CONFIRMED")
  })
})
