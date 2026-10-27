import { describe, expect, it } from "vitest"
import { mapComparableToVerifiedEvidence, validateComparableSet, validateGdvProposal, validateComparable, canTransitionValuation } from "@/lib/financial/comparable-contracts"
import type { DealSaleComparable } from "@/types/financial-comparables"

const accepted = (overrides: Partial<DealSaleComparable> = {}): DealSaleComparable => ({
  id: "comp-1", dealId: "deal-1", evidenceId: "ev-1", propertyAddress: "1 Test Road", postcode: "AB1 2CD", salePrice: 250000, saleDate: "2026-01-15", transactionReference: "TX-1", sourceType: "LAND_REGISTRY", sourceReference: "LR-1", reviewState: "ACCEPTED", reviewedBy: "operator-1", reviewedAt: "2026-02-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z", ...overrides,
})

describe("financial comparable contracts", () => {
  it("maps accepted qualifying sources and keeps portal evidence non-confirming", () => {
    expect(validateComparable(accepted(), "2026-02-02").valid).toBe(true)
    expect(validateComparable(accepted({ sourceType: "SURVEYOR" }), "2026-02-02").eligible).toBe(true)
    expect(validateComparable(accepted({ sourceType: "SOLICITOR" }), "2026-02-02").eligible).toBe(true)
    expect(mapComparableToVerifiedEvidence(accepted()).verification.status).toBe("CONFIRMED")
    expect(mapComparableToVerifiedEvidence(accepted({ sourceType: "RIGHTMOVE_SOLD_DATA" })).source).toBe("RIGHTMOVE_SOLD_DATA")
  })
  it("fails closed for review and structural defects", () => {
    expect(validateComparable(accepted({ reviewState: "PENDING" }), "2026-02-02").eligible).toBe(false)
    expect(validateComparable(accepted({ reviewState: "REJECTED", rejectionReason: undefined }), "2026-02-02").valid).toBe(false)
    expect(validateComparable(accepted({ reviewedBy: undefined }), "2026-02-02").valid).toBe(false)
    expect(validateComparable(accepted({ salePrice: 0 }), "2026-02-02").valid).toBe(false)
    expect(validateComparable(accepted({ transactionReference: "" }), "2026-02-02").valid).toBe(false)
    expect(validateComparable(accepted({ reviewDueAt: "2026-02-01" }), "2026-02-02").eligible).toBe(false)
    expect(mapComparableToVerifiedEvidence(accepted({ reviewState: "REJECTED", rejectionReason: "conflict" })).verification.status).toBe("REJECTED")
  })
  it("fails closed for duplicate or conflicting valuation bases", () => {
    expect(validateComparableSet([accepted(), accepted({ id: "comp-2" })], "2026-02-02").valid).toBe(false)
    expect(validateComparableSet([accepted(), accepted({ id: "comp-2", salePrice: 260000 })], "2026-02-02").valid).toBe(false)
  })
  it("requires an accepted comparable basis and does not derive GDV", () => {
    expect(validateGdvProposal({ gdvRealistic: 300000, rationale: "Human valuation", comparableIds: ["comp-1"] }, [accepted()], "2026-02-02").valid).toBe(true)
    expect(validateGdvProposal({ gdvRealistic: 0, rationale: "", comparableIds: [] }, [accepted({ reviewState: "PENDING" })], "2026-02-02").valid).toBe(false)
  })
  it("only permits safe valuation transitions", () => {
    expect(canTransitionValuation("DRAFT", "APPROVED")).toBe(true)
    expect(canTransitionValuation("DRAFT", "REJECTED")).toBe(true)
    expect(canTransitionValuation("APPROVED", "SUPERSEDED")).toBe(true)
    expect(canTransitionValuation("REJECTED", "APPROVED")).toBe(false)
    expect(canTransitionValuation("SUPERSEDED", "APPROVED")).toBe(false)
  })
})
