import { describe, expect, it } from "vitest"
import {
  EVIDENCE_LITE_EVIDENCE_TYPES,
  EVIDENCE_LITE_GATES,
  EVIDENCE_LITE_STATUSES,
} from "@/types/evidence-lite"
import {
  normalizeEvidenceLiteGateKey,
  validateCreateEvidenceLiteInput,
  validateUpdateEvidenceLiteInput,
} from "@/lib/evidence-lite/evidence-lite-validation"

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
      extra: true,
    }
    const before = JSON.stringify(input)

    const result = validateCreateEvidenceLiteInput(input)

    expect(result.valid).toBe(false)
    expect(result.errors.map((error) => error.field)).toEqual(
      expect.arrayContaining(["extra", "evidenceType", "linkedGate", "title", "note", "status", "reviewed"])
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
})
