import { describe, expect, it } from "vitest"
import { classifyVerifiedComparableEvidence, type VerifiedComparableEvidence } from "@/lib/financial/verified-comparable-evidence"

const qualifying: VerifiedComparableEvidence = {
  evidenceId: "ev-comp-1",
  property: { address: "1 Example Street", postcode: "LS1 1AA" },
  soldPrice: 250_000,
  transactionDate: "2026-01-10",
  transaction: { status: "COMPLETED", reference: "TX-1" },
  source: "LAND_REGISTRY",
  sourceReference: "LR-1",
  verification: { status: "CONFIRMED", reviewerId: "surveyor-1", reviewedAt: "2026-02-01" },
  similarity: { bedrooms: 3, distanceMiles: 0.4, notes: "Same street and tenure" },
  supportingDocumentReference: "evidence/lr-1.pdf",
}

describe("verified comparable evidence", () => {
  it("classifies qualifying sold evidence as verified", () => {
    expect(classifyVerifiedComparableEvidence([qualifying], "2026-03-01")).toMatchObject({ status: "VERIFIED", verifiedCount: 1 })
  })
  it("keeps portal asking-price evidence non-confirming", () => {
    expect(classifyVerifiedComparableEvidence([{ ...qualifying, source: "RIGHTMOVE_SOLD_DATA" }], "2026-03-01").status).toBe("NON_CONFIRMING")
  })
  it("fails closed for missing provenance or human verification", () => {
    expect(classifyVerifiedComparableEvidence([{ ...qualifying, sourceReference: "" }], "2026-03-01").status).toBe("REVIEW_REQUIRED")
    expect(classifyVerifiedComparableEvidence([{ ...qualifying, verification: { status: "UNVERIFIED", reviewerId: null, reviewedAt: null } }], "2026-03-01").status).toBe("REVIEW_REQUIRED")
  })
  it("does not silently improve mixed evidence", () => {
    const result = classifyVerifiedComparableEvidence([qualifying, { ...qualifying, evidenceId: "ev-comp-2", source: "RIGHTMOVE_SOLD_DATA" }], "2026-03-01")
    expect(result.status).toBe("MIXED")
    expect(result.verifiedCount).toBe(1)
    expect(result.nonConfirmingCount).toBe(1)
  })
  it("reports stale review evidence without inventing a recency policy", () => {
    const result = classifyVerifiedComparableEvidence([{ ...qualifying, verification: { ...qualifying.verification, reviewDueAt: "2026-02-15" } }], "2026-03-01")
    expect(result.status).toBe("REVIEW_REQUIRED")
    expect(result.issues.some((issue) => issue.includes("verification review is stale"))).toBe(true)
  })

  it.each(["ASKING", "UNDER_OFFER", "EXCHANGED_NOT_COMPLETED", "UNKNOWN", "WITHDRAWN"] as const)("does not confirm %s transactions", (status) => {
    const result = classifyVerifiedComparableEvidence([{ ...qualifying, transaction: { status, reference: "TX-1" } }], "2026-03-01")
    expect(result.status).toBe("REVIEW_REQUIRED")
    expect(result.verifiedCount).toBe(0)
  })

  it("requires a stable transaction identity before detecting conflicts", () => {
    const result = classifyVerifiedComparableEvidence([
      qualifying,
      { ...qualifying, evidenceId: "ev-comp-2", soldPrice: 260_000 },
    ], "2026-03-01")
    expect(result.status).toBe("REVIEW_REQUIRED")
    expect(result.conflicts).toContain("TX-1: sold price conflicts")
  })

  it("does not treat different transaction references as conflicts", () => {
    const result = classifyVerifiedComparableEvidence([
      qualifying,
      { ...qualifying, evidenceId: "ev-comp-2", transaction: { status: "COMPLETED", reference: "TX-2" }, soldPrice: 260_000 },
    ], "2026-03-01")
    expect(result.status).toBe("VERIFIED")
    expect(result.conflicts).toEqual([])
  })

  it("fails closed when transaction status is missing", () => {
    const result = classifyVerifiedComparableEvidence([{ ...qualifying, transaction: { status: undefined as never, reference: "TX-1" } }], "2026-03-01")
    expect(result.status).toBe("REVIEW_REQUIRED")
  })

  it("reports status and date conflicts for one transaction", () => {
    const result = classifyVerifiedComparableEvidence([
      qualifying,
      { ...qualifying, evidenceId: "ev-comp-2", transactionDate: "2026-01-11", transaction: { status: "ASKING", reference: "TX-1" } },
    ], "2026-03-01")
    expect(result.conflicts).toEqual(expect.arrayContaining(["TX-1: completion status conflicts", "TX-1: transaction date conflicts"]))
    expect(result.status).toBe("REVIEW_REQUIRED")
  })
})
