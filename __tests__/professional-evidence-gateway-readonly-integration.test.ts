import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import {
  loadProfessionalEvidenceGatewayViewModel,
  mapLoadedEvidenceToProfessionalGatewayEvidenceInput,
  type LoadedProfessionalEvidenceGatewayEvidence,
} from "@/lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model"

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
  overrides: Partial<LoadedProfessionalEvidenceGatewayEvidence> = {}
): LoadedProfessionalEvidenceGatewayEvidence {
  return {
    id: "evidence-1",
    dealId: "deal-1",
    evidenceType: "TITLE_REVIEW",
    linkedGate: "SOLICITOR_REVIEW",
    linkedInvestorShieldGate: "SOLICITOR_REVIEW",
    evidenceCommandType: "TITLE_LEGAL",
    title: "Title pack",
    note: "Legal evidence note",
    evidenceSummary: "Legal evidence summary",
    evidenceStatus: "SUFFICIENT",
    evidenceStrength: "STRONG",
    reviewState: "PROFESSIONAL_CONFIRMED",
    blockerImpact: "DOES_NOT_BLOCK",
    linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW",
    recommendedNextAction: "Continue read-only review",
    expiryOrUpdateDate: "2026-08-01",
    source: "SOLICITOR",
    mobileCaptureNote: null,
    ...overrides,
  }
}

describe("professional evidence gateway read-only integration", () => {
  it("maps already loaded evidence into a Professional Evidence Gateway view model", () => {
    const viewModel = loadProfessionalEvidenceGatewayViewModel({
      savedDealId: "deal-1",
      evidence: [makeEvidence()],
      finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
      lockReason: "Display-only professional gateway state",
    })

    expect(viewModel.savedDealId).toBe("deal-1")
    expect(viewModel.gates).toHaveLength(1)
    expect(viewModel.gates[0]).toMatchObject({
      linkedEvidenceCommandEvidenceId: "evidence-1",
      professionalGateArea: "SOLICITOR_REVIEW",
      professionalGateStatus: "CONFIRMED",
      professionalReadiness: "PROFESSIONALLY_CONFIRMED",
      reviewSource: "SOLICITOR",
      reviewState: "PROFESSIONAL_CONFIRMED",
    })
    expect(viewModel.decisionLock).toMatchObject({
      finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
      linkedEvidenceIds: ["evidence-1"],
    })
  })

  it("keeps RIGHTMOVE_SOLD_DATA visible but non-confirming by itself", () => {
    const viewModel = loadProfessionalEvidenceGatewayViewModel({
      savedDealId: "deal-rightmove",
      evidence: [
        makeEvidence({
          id: "rightmove-1",
          evidenceType: "SOLD_COMP",
          linkedGate: "SOLD_COMPS",
          linkedInvestorShieldGate: "SOLD_COMPS",
          evidenceCommandType: "SOLD_COMPARABLE",
          linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
          source: "RIGHTMOVE_SOLD_DATA",
          evidenceSummary: "Rightmove sold comparable visible",
          evidenceStatus: "SUFFICIENT",
          reviewState: "PROFESSIONAL_CONFIRMED",
        }),
      ],
    })

    expect(viewModel.gates[0]).toMatchObject({
      professionalGateArea: "SOLD_COMPARABLE_REVIEW",
      reviewSource: "RIGHTMOVE_SOLD_DATA",
      professionalGateStatus: "UNDER_REVIEW",
      professionalReadiness: "READY_FOR_REVIEW",
      professionalConfirmationSummary:
        "Professional confirmation requires explicit compatible qualifying source",
    })
  })

  it.each(["SURVEYOR", "SOLICITOR", "LAND_REGISTRY"] as const)(
    "allows RIGHTMOVE context plus compatible qualifying source %s to support confirmation",
    (source) => {
      const viewModel = loadProfessionalEvidenceGatewayViewModel({
        savedDealId: "deal-sold-comp",
        evidence: [
          makeEvidence({
            id: `sold-comp-${source}`,
            evidenceType: "SOLD_COMP",
            linkedGate: "SOLD_COMPS",
            linkedInvestorShieldGate: "SOLD_COMPS",
            evidenceCommandType: "SOLD_COMPARABLE",
            linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
            source,
            evidenceSummary: "Professional sold comparable review",
            evidenceStatus: "SUFFICIENT",
            reviewState: "PROFESSIONAL_CONFIRMED",
          }),
        ],
      })

      expect(viewModel.gates[0]).toMatchObject({
        professionalGateArea: "SOLD_COMPARABLE_REVIEW",
        reviewSource: source,
        professionalGateStatus: "CONFIRMED",
        professionalReadiness: "PROFESSIONALLY_CONFIRMED",
      })
    }
  )

  it.each([
    ["RIGHTMOVE_SOLD_DATA", "SOLD_COMPARABLE", "SOLD_COMPARABLE_REVIEW"],
    ["AGENT", "AGENT_RESPONSE", "SOLICITOR_REVIEW"],
    ["OPERATOR_NOTE", "TITLE_LEGAL", "SOLICITOR_REVIEW"],
  ] as const)(
    "keeps %s evidence visible but non-confirming",
    (source, evidenceCommandType, expectedGateArea) => {
      const mapped = mapLoadedEvidenceToProfessionalGatewayEvidenceInput(
        makeEvidence({
          evidenceCommandType,
          linkedProfessionalGate:
            expectedGateArea === "SOLD_COMPARABLE_REVIEW"
              ? "ACTUAL_SOLD_COMPARABLE_REVIEW"
              : "SOLICITOR_TITLE_REVIEW",
          source,
          evidenceStatus: "SUFFICIENT",
          reviewState: "PROFESSIONAL_CONFIRMED",
        }),
        "deal-non-confirming"
      )

      expect(mapped).toMatchObject({
        professionalGateArea: expectedGateArea,
        reviewSource: source,
      })

      const viewModel = loadProfessionalEvidenceGatewayViewModel({
        savedDealId: "deal-non-confirming",
        evidence: [
          makeEvidence({
            evidenceCommandType,
            linkedProfessionalGate:
              expectedGateArea === "SOLD_COMPARABLE_REVIEW"
                ? "ACTUAL_SOLD_COMPARABLE_REVIEW"
                : "SOLICITOR_TITLE_REVIEW",
            source,
            evidenceStatus: "SUFFICIENT",
            reviewState: "PROFESSIONAL_CONFIRMED",
          }),
        ],
      })

      expect(viewModel.gates[0].professionalGateStatus).toBe("UNDER_REVIEW")
      expect(viewModel.gates[0].professionalReadiness).toBe("READY_FOR_REVIEW")
    }
  )

  it("does not clear Investor Shield gates or mutate pipeline-shaped state", () => {
    const state = deepFreeze({
      investorShieldGate: {
        key: "SOLD_COMPS",
        status: "BLOCKED",
        cleared: false,
      },
      pipeline: {
        stage: "EVIDENCE_REVIEW",
        history: ["BLOCKED"],
      },
      evidence: [
        makeEvidence({
          source: "RIGHTMOVE_SOLD_DATA",
          evidenceCommandType: "SOLD_COMPARABLE",
          linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
          linkedInvestorShieldGate: "SOLD_COMPS",
        }),
      ],
    })
    const before = JSON.stringify(state)

    const viewModel = loadProfessionalEvidenceGatewayViewModel({
      savedDealId: "deal-state",
      evidence: state.evidence,
    })

    expect(JSON.stringify(state)).toBe(before)
    expect(state.investorShieldGate).toEqual({
      key: "SOLD_COMPS",
      status: "BLOCKED",
      cleared: false,
    })
    expect(state.pipeline).toEqual({
      stage: "EVIDENCE_REVIEW",
      history: ["BLOCKED"],
    })
    expect(viewModel.gates[0].linkedInvestorShieldGate).toBe("SOLD_COMPS")
  })

  it("does not mutate input evidence objects", () => {
    const input = deepFreeze({
      savedDealId: " deal-immutable ",
      evidence: [
        makeEvidence({
          id: " immutable-evidence ",
          source: " SOLICITOR ",
        }),
      ],
    })
    const before = JSON.stringify(input)

    const viewModel = loadProfessionalEvidenceGatewayViewModel(input)

    expect(JSON.stringify(input)).toBe(before)
    expect(viewModel.savedDealId).toBe("deal-immutable")
    expect(viewModel.gates[0].linkedEvidenceIds).toEqual(["immutable-evidence"])
  })

  it("has no exported write function or persistence mutation surface", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts"
      ),
      "utf8"
    )

    expect(source).not.toMatch(/export\s+(async\s+)?function\s+(create|update|delete|insert|save|persist)/i)
    expect(source).not.toContain("@/lib/evidence-lite/evidence-lite-repository")
    expect(source).not.toContain("@/lib/db/")
    expect(source).not.toContain("query(")
    expect(source).not.toContain("INSERT INTO")
    expect(source).not.toContain("UPDATE ")
    expect(source).not.toContain("DELETE ")
  })

  it("does not require migrations or new tables", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("CREATE TABLE")
    expect(source).not.toContain("ALTER TABLE")
    expect(source).not.toContain("deal_evidence")
    expect(source).not.toContain("migration")
  })

  it("does not change True MAO or scoring", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model.ts"
      ),
      "utf8"
    )

    expect(source).not.toMatch(/trueMao/i)
    expect(source).not.toMatch(/score|scoring/i)
  })
})
