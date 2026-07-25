import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  PROFESSIONAL_READINESS_CLASSIFIER_STATES,
  classifyProfessionalReadiness,
  type ProfessionalReadinessClassifierInput,
} from "@/lib/professional-evidence-gateway/classify-professional-readiness"

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

function makeInput(
  overrides: Partial<ProfessionalReadinessClassifierInput> = {}
): ProfessionalReadinessClassifierInput {
  return {
    linkedInvestorShieldGate: "SOLICITOR_REVIEW",
    professionalGateArea: "SOLICITOR_REVIEW",
    evidenceType: "TITLE_LEGAL",
    linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW",
    reviewSource: "SOLICITOR",
    evidenceStatus: "REVIEWED",
    evidenceStrength: "STRONG",
    reviewState: "PROFESSIONAL_REVIEW_REQUIRED",
    blockerImpact: "DOES_NOT_BLOCK",
    expiryOrUpdateDate: "2026-08-01",
    ...overrides,
  }
}

describe("classifyProfessionalReadiness", () => {
  it("exports exact seven-state readiness type", () => {
    expect(PROFESSIONAL_READINESS_CLASSIFIER_STATES).toEqual([
      "READY_FOR_REVIEW",
      "PROFESSIONALLY_CONFIRMED",
      "WEAK_OR_NON_CONFIRMING",
      "MISSING",
      "ADVERSE",
      "EXPIRED",
      "MANUAL_REVIEW_REQUIRED",
    ])
  })

  it("explicit adverse evidence returns ADVERSE", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          evidenceStatus: "REJECTED",
          reviewState: "PROFESSIONAL_CONFIRMED",
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("ADVERSE")
  })

  it("expired professional evidence returns EXPIRED", () => {
    expect(
      classifyProfessionalReadiness(makeInput(), { referenceDate: "2026-08-02" })
    ).toBe("EXPIRED")
  })

  it("required professional evidence absent returns MISSING", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          evidenceStatus: "MISSING",
          reviewSource: null,
          expiryOrUpdateDate: null,
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("MISSING")
  })

  it("weak or non-confirming professional evidence returns WEAK_OR_NON_CONFIRMING", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          reviewSource: "OPERATOR_NOTE",
          reviewState: "REVIEWED_BY_OPERATOR",
          evidenceStrength: "WEAK",
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("WEAK_OR_NON_CONFIRMING")
  })

  it("ambiguous or conflicting evidence returns MANUAL_REVIEW_REQUIRED", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          evidenceStatus: "RECEIVED",
          reviewState: "PROFESSIONAL_CONFIRMED",
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("MANUAL_REVIEW_REQUIRED")
  })

  it("explicit professional confirmation returns PROFESSIONALLY_CONFIRMED", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          evidenceStatus: "SUFFICIENT",
          reviewState: "PROFESSIONAL_CONFIRMED",
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("PROFESSIONALLY_CONFIRMED")
  })

  it("complete evidence awaiting professional review returns READY_FOR_REVIEW", () => {
    expect(
      classifyProfessionalReadiness(makeInput(), { referenceDate: "2026-07-25" })
    ).toBe("READY_FOR_REVIEW")
  })

  it("mere record presence does not create confirmation", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          evidenceStatus: "RECEIVED",
          reviewState: "NOT_REVIEWED",
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("READY_FOR_REVIEW")
  })

  it("Evidence Lite does not create professional confirmation", () => {
    expect(
      classifyProfessionalReadiness(
        makeInput({
          reviewSource: "OPERATOR_NOTE",
          reviewState: "REVIEWED_BY_OPERATOR",
          evidenceStatus: "REVIEWED",
          evidenceStrength: "MODERATE",
        }),
        { referenceDate: "2026-07-25" }
      )
    ).toBe("WEAK_OR_NON_CONFIRMING")
  })

  it("readiness result does not mutate input", () => {
    const input = deepFreeze(
      makeInput({
        evidenceStatus: "SUFFICIENT",
        reviewState: "PROFESSIONAL_CONFIRMED",
      })
    )
    const before = JSON.stringify(input)

    const result = classifyProfessionalReadiness(input, {
      referenceDate: "2026-07-25",
    })

    expect(result).toBe("PROFESSIONALLY_CONFIRMED")
    expect(JSON.stringify(input)).toBe(before)
  })

  it("repeated calls with identical inputs return identical outputs", () => {
    const input = makeInput({
      evidenceStatus: "SUFFICIENT",
      reviewState: "PROFESSIONAL_CONFIRMED",
    })

    expect(
      classifyProfessionalReadiness(input, { referenceDate: "2026-07-25" })
    ).toBe(
      classifyProfessionalReadiness(input, { referenceDate: "2026-07-25" })
    )
  })

  it("no database, API, environment variable, or live infrastructure is required", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/classify-professional-readiness.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("@/app/")
    expect(source).not.toContain("@/lib/db/")
    expect(source).not.toContain("@/api/")
    expect(source).not.toContain("/api/")
    expect(source).not.toContain("process.env")
    expect(source).not.toContain("fetch(")
    expect(source).not.toContain("query(")
  })

  it("Investor Shield status is not modified or recalculated", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/classify-professional-readiness.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("@/lib/investor-shield/")
    expect(source).not.toContain("@/types/investor-shield")
    expect(source).not.toContain("evaluateInvestorShield")
    expect(source).not.toContain("canProgress")
    expect(source).not.toContain("progressionDecision")
  })

  it.each([
    [
      "adverse",
      makeInput({
        evidenceStatus: "REJECTED",
        reviewState: "PROFESSIONAL_CONFIRMED",
      }),
      "ADVERSE",
    ],
    [
      "expired",
      makeInput({
        evidenceStatus: "SUFFICIENT",
        reviewState: "PROFESSIONAL_CONFIRMED",
      }),
      "EXPIRED",
    ],
    [
      "missing",
      makeInput({
        evidenceStatus: "MISSING",
        reviewState: "PROFESSIONAL_CONFIRMED",
        expiryOrUpdateDate: null,
      }),
      "MISSING",
    ],
    [
      "weak",
      makeInput({
        evidenceStatus: "SUFFICIENT",
        reviewState: "PROFESSIONAL_CONFIRMED",
        evidenceStrength: "WEAK",
        expiryOrUpdateDate: "2026-12-31",
      }),
      "WEAK_OR_NON_CONFIRMING",
    ],
  ] as const)(
    "%s input cannot be downgraded into safer readiness state",
    (_, input, expected) => {
      expect(
        classifyProfessionalReadiness(input, { referenceDate: "2026-08-02" })
      ).toBe(expected)
    }
  )
})
