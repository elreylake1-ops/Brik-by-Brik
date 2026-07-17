import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  PROFESSIONAL_EVIDENCE_REVIEW_SOURCES,
  PROFESSIONAL_GATE_AREAS,
  type ProfessionalEvidenceReviewSource,
  type ProfessionalGateArea,
} from "@/types/professional-evidence-gateway"
import {
  assertProfessionalGateSourceCompatibility,
  getNonQualifyingReviewSourcesForGate,
  getQualifyingReviewSourcesForGate,
  isProfessionalEvidenceReviewSourceQualifyingForGate,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility"

const compatibilityMatrix = {
  SOLICITOR_REVIEW: ["SOLICITOR", "LAND_REGISTRY"],
  LEASEHOLD_ADVICE: ["SOLICITOR", "LAND_REGISTRY"],
  BROKER_LENDER_CONFIRMATION: ["BROKER", "LENDER"],
  BUILDER_QUOTE_CONFIRMATION: ["BUILDER", "SURVEYOR"],
  SURVEYOR_REPORT: ["SURVEYOR"],
  SOLD_COMPARABLE_REVIEW: ["SURVEYOR", "SOLICITOR", "LAND_REGISTRY"],
} as const satisfies Record<
  ProfessionalGateArea,
  readonly ProfessionalEvidenceReviewSource[]
>

describe("professional evidence gateway source compatibility", () => {
  it.each([
    ["SOLICITOR_REVIEW", "SOLICITOR"],
    ["SOLICITOR_REVIEW", "LAND_REGISTRY"],
    ["LEASEHOLD_ADVICE", "SOLICITOR"],
    ["LEASEHOLD_ADVICE", "LAND_REGISTRY"],
    ["BROKER_LENDER_CONFIRMATION", "BROKER"],
    ["BROKER_LENDER_CONFIRMATION", "LENDER"],
    ["BUILDER_QUOTE_CONFIRMATION", "BUILDER"],
    ["BUILDER_QUOTE_CONFIRMATION", "SURVEYOR"],
    ["SURVEYOR_REPORT", "SURVEYOR"],
    ["SOLD_COMPARABLE_REVIEW", "SURVEYOR"],
    ["SOLD_COMPARABLE_REVIEW", "SOLICITOR"],
    ["SOLD_COMPARABLE_REVIEW", "LAND_REGISTRY"],
  ] as const)("%s accepts %s", (area, source) => {
    expect(
      isProfessionalEvidenceReviewSourceQualifyingForGate(area, source)
    ).toBe(true)
    expect(assertProfessionalGateSourceCompatibility(area, source)).toEqual({
      compatible: true,
      errors: [],
    })
  })

  it("SOLICITOR_REVIEW rejects OPERATOR_NOTE", () => {
    expect(
      isProfessionalEvidenceReviewSourceQualifyingForGate(
        "SOLICITOR_REVIEW",
        "OPERATOR_NOTE"
      )
    ).toBe(false)
    expect(
      assertProfessionalGateSourceCompatibility(
        "SOLICITOR_REVIEW",
        "OPERATOR_NOTE"
      )
    ).toEqual({
      compatible: false,
      errors: [
        {
          field: "reviewSource",
          message:
            "reviewSource is not qualifying for professionalGateArea SOLICITOR_REVIEW",
        },
      ],
    })
  })

  it("SOLD_COMPARABLE_REVIEW rejects RIGHTMOVE_SOLD_DATA as qualifying confirmation", () => {
    expect(
      isProfessionalEvidenceReviewSourceQualifyingForGate(
        "SOLD_COMPARABLE_REVIEW",
        "RIGHTMOVE_SOLD_DATA"
      )
    ).toBe(false)
    expect(
      assertProfessionalGateSourceCompatibility(
        "SOLD_COMPARABLE_REVIEW",
        "RIGHTMOVE_SOLD_DATA"
      )
    ).toEqual({
      compatible: false,
      errors: [
        {
          field: "reviewSource",
          message:
            "reviewSource is not qualifying for professionalGateArea SOLD_COMPARABLE_REVIEW",
        },
      ],
    })
  })

  it.each(["OPERATOR_NOTE", "AGENT", "OTHER"] as const)(
    "every gate rejects %s",
    (source) => {
      for (const area of PROFESSIONAL_GATE_AREAS) {
        expect(
          isProfessionalEvidenceReviewSourceQualifyingForGate(area, source)
        ).toBe(false)
        expect(
          assertProfessionalGateSourceCompatibility(area, source).compatible
        ).toBe(false)
      }
    }
  )

  it("rejects incompatible but valid sources", () => {
    expect(
      assertProfessionalGateSourceCompatibility("SURVEYOR_REPORT", "SOLICITOR")
    ).toEqual({
      compatible: false,
      errors: [
        {
          field: "reviewSource",
          message:
            "reviewSource is not qualifying for professionalGateArea SURVEYOR_REPORT",
        },
      ],
    })
  })

  it("rejects missing source", () => {
    const result = assertProfessionalGateSourceCompatibility(
      "SOLICITOR_REVIEW",
      undefined
    )

    expect(result.compatible).toBe(false)
    expect(result.errors).toEqual([
      {
        field: "reviewSource",
        message: `reviewSource must be one of: ${PROFESSIONAL_EVIDENCE_REVIEW_SOURCES.join(", ")}`,
      },
    ])
  })

  it("rejects unknown sources", () => {
    const result = assertProfessionalGateSourceCompatibility(
      "SOLICITOR_REVIEW",
      "UNKNOWN"
    )

    expect(result.compatible).toBe(false)
    expect(result.errors).toEqual([
      {
        field: "reviewSource",
        message: `reviewSource must be one of: ${PROFESSIONAL_EVIDENCE_REVIEW_SOURCES.join(", ")}`,
      },
    ])
  })

  it("keeps SOLICITOR_REVIEW canonical and rejects SOLICITOR_FEEDBACK as canonical", () => {
    expect(PROFESSIONAL_GATE_AREAS).toContain("SOLICITOR_REVIEW")
    expect(PROFESSIONAL_GATE_AREAS).not.toContain("SOLICITOR_FEEDBACK")
    expect(
      assertProfessionalGateSourceCompatibility(
        "SOLICITOR_FEEDBACK",
        "SOLICITOR"
      )
    ).toEqual({
      compatible: false,
      errors: [
        {
          field: "professionalGateArea",
          message: `professionalGateArea must be one of: ${PROFESSIONAL_GATE_AREAS.join(", ")}`,
        },
      ],
    })
  })

  it("returns the qualifying source matrix without exposing mutable internals", () => {
    for (const area of PROFESSIONAL_GATE_AREAS) {
      expect(getQualifyingReviewSourcesForGate(area)).toEqual(
        compatibilityMatrix[area]
      )
    }

    const qualifyingSources = getQualifyingReviewSourcesForGate("SOLICITOR_REVIEW")
    ;(qualifyingSources as ProfessionalEvidenceReviewSource[]).push("BROKER")

    expect(getQualifyingReviewSourcesForGate("SOLICITOR_REVIEW")).toEqual([
      "SOLICITOR",
      "LAND_REGISTRY",
    ])
  })

  it("returns non-qualifying sources for each gate", () => {
    for (const area of PROFESSIONAL_GATE_AREAS) {
      const nonQualifyingSources = getNonQualifyingReviewSourcesForGate(area)

      expect(nonQualifyingSources).toEqual(
        PROFESSIONAL_EVIDENCE_REVIEW_SOURCES.filter(
          (source) => !compatibilityMatrix[area].includes(source)
        )
      )
      expect(nonQualifyingSources).toEqual(
        expect.arrayContaining(["OPERATOR_NOTE", "AGENT", "OTHER"])
      )
    }
  })

  it("keeps RIGHTMOVE_SOLD_DATA as known visible evidence but non-confirming for SOLD_COMPARABLE_REVIEW", () => {
    expect(PROFESSIONAL_EVIDENCE_REVIEW_SOURCES).toContain(
      "RIGHTMOVE_SOLD_DATA"
    )
    expect(
      getNonQualifyingReviewSourcesForGate("SOLD_COMPARABLE_REVIEW")
    ).toContain("RIGHTMOVE_SOLD_DATA")
  })

  it("does not import API, UI, database, production, migration, repository, or persistence modules", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility.ts"
      ),
      "utf8"
    )

    expect(source).toContain('from "@/types/professional-evidence-gateway"')
    expect(source).toMatch(/^import\s/m)
    expect(source.match(/^import\s/gm)?.length).toBe(1)
    expect(source).not.toContain("@/app/")
    expect(source).not.toContain("@/components/")
    expect(source).not.toContain("@/db/")
    expect(source).not.toContain("@/api/")
    expect(source).not.toContain("/api/")
    expect(source).not.toContain("database")
    expect(source).not.toContain("production")
    expect(source).not.toContain("migration")
    expect(source).not.toContain("repository")
    expect(source).not.toContain("persistence")
  })
})
