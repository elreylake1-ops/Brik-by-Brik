import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  PROFESSIONAL_GATE_AREAS,
  type ProfessionalEvidenceGatewayGate,
} from "@/types/professional-evidence-gateway"
import { assertProfessionalGateSourceCompatibility } from "@/lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility"
import {
  buildProfessionalEvidenceGatewayViewModel,
  deriveProfessionalDecisionLock,
  mapEvidenceToProfessionalGatewayRecord,
  mapProfessionalGateReadiness,
  type ProfessionalEvidenceGatewayEvidenceInput,
} from "@/lib/professional-evidence-gateway/professional-evidence-gateway-read-model"

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

function makeEvidence(
  overrides: Partial<ProfessionalEvidenceGatewayEvidenceInput> = {}
): ProfessionalEvidenceGatewayEvidenceInput {
  return {
    savedDealId: " deal-123 ",
    linkedEvidenceCommandEvidenceId: " evidence-command-1 ",
    linkedInvestorShieldGate: " SOLICITOR_REVIEW ",
    professionalGateArea: " SOLICITOR_REVIEW ",
    professionalGateStatus: " CONFIRMED ",
    professionalReadiness: " PROFESSIONALLY_CONFIRMED ",
    reviewSource: " SOLICITOR ",
    reviewState: " PROFESSIONAL_REVIEW_COMPLETE ",
    blockerImpact: " NONE ",
    evidenceStrength: " STRONG ",
    requiredEvidenceSummary: " Solicitor review required ",
    professionalConfirmationSummary: " Solicitor confirmed review ",
    recommendedNextAction: " Continue review ",
    expiryOrReviewDate: "2026-08-01",
    finalDecisionLockStatus: " UNLOCKED_FOR_REVIEW ",
    lockReason: " Display-only lock ",
    linkedEvidenceIds: [" evidence-1 ", "evidence-2", "evidence-1"],
    ...overrides,
  }
}

describe("professional evidence gateway read model mapping", () => {
  it("valid qualifying evidence can surface confirmed professional status", () => {
    const record = mapEvidenceToProfessionalGatewayRecord(makeEvidence())

    expect(record.professionalGateStatus).toBe("CONFIRMED")
    expect(record.professionalReadiness).toBe("PROFESSIONALLY_CONFIRMED")
    expect(record.reviewSource).toBe("SOLICITOR")
    expect(record.professionalConfirmationSummary).toBe(
      "Solicitor confirmed review"
    )
  })

  it("operator-only evidence remains visible but non-confirming", () => {
    const record = mapEvidenceToProfessionalGatewayRecord(
      makeEvidence({ reviewSource: "OPERATOR_NOTE" })
    )

    expect(record.reviewSource).toBe("OPERATOR_NOTE")
    expect(record.reviewState).toBe("PROFESSIONAL_REVIEW_COMPLETE")
    expect(record.professionalGateStatus).toBe("UNDER_REVIEW")
    expect(record.professionalReadiness).toBe("READY_FOR_REVIEW")
    expect(record.professionalConfirmationSummary).toBe(
      "Professional confirmation requires explicit compatible qualifying source"
    )
  })

  it("missing review source cannot confirm", () => {
    const record = mapEvidenceToProfessionalGatewayRecord(
      makeEvidence({ reviewSource: undefined })
    )

    expect(record.reviewSource).toBe("OPERATOR_NOTE")
    expect(record.professionalGateStatus).toBe("UNDER_REVIEW")
    expect(record.professionalReadiness).toBe("READY_FOR_REVIEW")
  })

  it("incompatible source cannot confirm", () => {
    const record = mapEvidenceToProfessionalGatewayRecord(
      makeEvidence({
        professionalGateArea: "SURVEYOR_REPORT",
        linkedInvestorShieldGate: "SURVEYOR_REPORT",
        reviewSource: "SOLICITOR",
      })
    )

    expect(record.professionalGateArea).toBe("SURVEYOR_REPORT")
    expect(record.reviewSource).toBe("SOLICITOR")
    expect(record.professionalGateStatus).toBe("UNDER_REVIEW")
    expect(record.professionalReadiness).toBe("READY_FOR_REVIEW")
  })

  it("each gate preserves its own review source", () => {
    const viewModel = buildProfessionalEvidenceGatewayViewModel({
      savedDealId: "deal-123",
      evidence: [
        makeEvidence({
          professionalGateArea: "SOLICITOR_REVIEW",
          linkedInvestorShieldGate: "SOLICITOR_REVIEW",
          reviewSource: "LAND_REGISTRY",
        }),
        makeEvidence({
          professionalGateArea: "BROKER_LENDER_CONFIRMATION",
          linkedInvestorShieldGate: "BROKER_LENDER_CONFIRMATION",
          reviewSource: "BROKER",
        }),
      ],
    })

    expect(viewModel.gates.map((gate) => gate.reviewSource)).toEqual([
      "LAND_REGISTRY",
      "BROKER",
    ])
  })

  it("linked evidence ids are preserved", () => {
    const record = mapEvidenceToProfessionalGatewayRecord(
      makeEvidence({ linkedEvidenceIds: [" e-1 ", "e-2", "e-1"] })
    )

    expect(record.linkedEvidenceIds).toEqual(["e-1", "e-2"])
  })

  it("blocker and caution values are mapped without clearing gates", () => {
    const record = mapEvidenceToProfessionalGatewayRecord(
      makeEvidence({
        professionalGateStatus: "ADVERSE",
        professionalReadiness: "BLOCKED",
        blockerImpact: " HARD_GATE_BLOCKER ",
        evidenceStrength: " CAUTION ",
        reviewSource: "SOLICITOR",
      })
    )

    expect(record.professionalGateStatus).toBe("ADVERSE")
    expect(record.professionalReadiness).toBe("BLOCKED")
    expect(record.blockerImpact).toBe("HARD_GATE_BLOCKER")
    expect(record.evidenceStrength).toBe("CAUTION")
    expect(record.linkedInvestorShieldGate).toBe("SOLICITOR_REVIEW")
  })

  it("final decision lock is display-only", () => {
    const gates: readonly ProfessionalEvidenceGatewayGate[] = [
      {
        savedDealId: "deal-123",
        professionalGateArea: "SOLICITOR_REVIEW",
        linkedInvestorShieldGate: "SOLICITOR_REVIEW",
        professionalGateStatus: "CONFIRMED",
        professionalReadiness: "PROFESSIONALLY_CONFIRMED",
        reviewSource: "SOLICITOR",
        reviewState: "VISIBLE_EVIDENCE",
        blockerImpact: "NONE",
        evidenceStrength: "STRONG",
        requiredEvidenceSummary: "Required",
        professionalConfirmationSummary: "Confirmed",
        recommendedNextAction: "Continue",
        expiryOrReviewDate: null,
        linkedEvidenceCommandEvidenceId: "cmd-1",
        linkedEvidenceIds: ["e-1"],
      },
    ]

    expect(
      deriveProfessionalDecisionLock({
        savedDealId: "deal-123",
        gates,
        finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
        lockReason: "Review professional evidence",
      })
    ).toEqual({
      savedDealId: "deal-123",
      finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
      lockReason: "Review professional evidence",
      linkedGateAreas: ["SOLICITOR_REVIEW"],
      linkedEvidenceIds: ["e-1"],
    })
  })

  it("input objects are not mutated", () => {
    const input = deepFreeze({
      savedDealId: "deal-123",
      evidence: [
        makeEvidence({
          linkedEvidenceIds: ["e-1", "e-2", "e-1"],
        }),
      ],
      finalDecisionLockStatus: "LOCKED",
      lockReason: "Locked",
    })
    const before = JSON.stringify(input)

    const viewModel = buildProfessionalEvidenceGatewayViewModel(input)

    expect(JSON.stringify(input)).toBe(before)
    expect(viewModel.gates[0].linkedEvidenceIds).toEqual(["e-1", "e-2"])
  })

  it("read-model module does not import API, UI, database, production, migration, or config modules", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts"
      ),
      "utf8"
    )

    expect(source).toContain('from "@/types/professional-evidence-gateway"')
    expect(source).toContain(
      'from "@/lib/professional-evidence-gateway/professional-evidence-gateway-source-compatibility"'
    )
    expect(source).not.toContain("@/app/")
    expect(source).not.toContain("@/components/")
    expect(source).not.toContain("@/db/")
    expect(source).not.toContain("@/api/")
    expect(source).not.toContain("/api/")
    expect(source).not.toContain("database")
    expect(source).not.toContain("production")
    expect(source).not.toContain("migration")
    expect(source).not.toContain("config")
  })

  it("no Investor Shield mutation path exists", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts"
      ),
      "utf8"
    )

    expect(source).not.toMatch(/clear.*InvestorShield/i)
    expect(source).not.toMatch(/update.*InvestorShield/i)
    expect(source).not.toMatch(/set.*InvestorShield/i)
  })

  it("no pipeline mutation path exists", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/professional-evidence-gateway-read-model.ts"
      ),
      "utf8"
    )

    expect(source).not.toMatch(/pipeline/i)
  })

  it("SOLICITOR_REVIEW remains canonical", () => {
    expect(PROFESSIONAL_GATE_AREAS).toContain("SOLICITOR_REVIEW")
    expect(
      mapProfessionalGateReadiness({
        professionalGateArea: "SOLICITOR_REVIEW",
        professionalGateStatus: "CONFIRMED",
        professionalReadiness: "PROFESSIONALLY_CONFIRMED",
        reviewSource: "SOLICITOR",
      })
    ).toEqual({
      professionalGateArea: "SOLICITOR_REVIEW",
      professionalGateStatus: "CONFIRMED",
      professionalReadiness: "PROFESSIONALLY_CONFIRMED",
      reviewSource: "SOLICITOR",
      professionallyConfirming: true,
    })
  })

  it("SOLICITOR_FEEDBACK remains rejected as canonical where applicable", () => {
    expect(PROFESSIONAL_GATE_AREAS).not.toContain("SOLICITOR_FEEDBACK")
    expect(() =>
      mapProfessionalGateReadiness({
        professionalGateArea: "SOLICITOR_FEEDBACK",
        professionalGateStatus: "CONFIRMED",
        professionalReadiness: "PROFESSIONALLY_CONFIRMED",
        reviewSource: "SOLICITOR",
      })
    ).toThrow("professionalGateArea must be canonical")
    expect(
      assertProfessionalGateSourceCompatibility(
        "SOLICITOR_FEEDBACK",
        "SOLICITOR"
      ).compatible
    ).toBe(false)
  })
})
