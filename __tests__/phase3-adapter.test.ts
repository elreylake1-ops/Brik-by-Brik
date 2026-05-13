import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { mapPhase2OutputToPhase3Snapshot } from "@/lib/engine/phase3-adapter"
import { buildPhase3Orchestration } from "@/lib/engine/phase3-orchestrator"
import type { Phase2AnalysisOutput } from "@/types/phase2"

function loadPhase2Fixture(fileName: string): Phase2AnalysisOutput {
  const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", "phase2", fileName)
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Phase2AnalysisOutput
}

describe("phase3 phase2 snapshot adapter", () => {
  it("maps governance state, final classification, fatal risk, and reviewRequired directly", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const snapshot = mapPhase2OutputToPhase3Snapshot(sample)

    expect(snapshot.governanceState).toBe(sample.governance.state)
    expect(snapshot.finalClassification).toBe(sample.governance.finalClassification)
    expect(snapshot.fatalRisk).toBe(sample.governance.fatalRisk)
    expect(snapshot.reviewRequired).toBe(sample.governance.reviewRequired)
  })

  it("maps missingCriticalEvidence and blockedBy directly", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const withEvidence = {
      ...sample,
      evidenceStatus: {
        ...sample.evidenceStatus,
        missingCriticalEvidence: ["comparables", "survey"],
      },
      governance: {
        ...sample.governance,
        blockedBy: ["LEGAL_REVIEW_PENDING"],
      },
    }

    const snapshot = mapPhase2OutputToPhase3Snapshot(withEvidence)

    expect(snapshot.missingCriticalEvidence).toEqual(["comparables", "survey"])
    expect(snapshot.blockedBy).toEqual(["LEGAL_REVIEW_PENDING"])
  })

  it("flattens risk flags deterministically in stable order using code-first rule", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const withMixedRiskFlags = {
      ...sample,
      riskRadar: {
        ...sample.riskRadar,
        riskFlags: [
          { code: "FIRST_CODE", label: "First Label" },
          { code: "", label: "Label Fallback" },
          { label: "Only Label" },
          { code: "SECOND_CODE", label: "Second Label" },
        ] as unknown as Phase2AnalysisOutput["riskRadar"]["riskFlags"],
      },
    }

    const snapshot = mapPhase2OutputToPhase3Snapshot(withMixedRiskFlags)

    expect(snapshot.riskFlags).toEqual([
      "FIRST_CODE",
      "Label Fallback",
      "Only Label",
      "SECOND_CODE",
    ])
  })

  it("does not mutate the input Phase 2 output", () => {
    const sample = loadPhase2Fixture("sample-governance-blocked-output.json")
    const before = JSON.stringify(sample)

    mapPhase2OutputToPhase3Snapshot(sample)

    expect(JSON.stringify(sample)).toBe(before)
  })

  it("does not invent accepted limitations when no exact mapping exists", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const snapshot = mapPhase2OutputToPhase3Snapshot(sample)
    const orchestration = buildPhase3Orchestration({ deterministicResult: snapshot })

    expect(orchestration.metadata.acceptedLimitations).toEqual([])
    expect(orchestration.metadata.acceptedWithLimitations).toBe(false)
  })

  it("handles missing optional arrays safely with empty-array fallback", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const malformed = {
      ...sample,
      governance: {
        ...sample.governance,
        blockedBy: undefined,
      },
      evidenceStatus: {
        ...sample.evidenceStatus,
        missingCriticalEvidence: undefined,
      },
      riskRadar: {
        ...sample.riskRadar,
        riskFlags: undefined,
      },
    } as unknown as Phase2AnalysisOutput

    const snapshot = mapPhase2OutputToPhase3Snapshot(malformed)

    expect(snapshot.blockedBy).toEqual([])
    expect(snapshot.missingCriticalEvidence).toEqual([])
    expect(snapshot.riskFlags).toEqual([])
  })

  it("adapter output can be passed into buildPhase3Orchestration", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const snapshot = mapPhase2OutputToPhase3Snapshot(sample)
    const orchestration = buildPhase3Orchestration({ deterministicResult: snapshot })

    expect(orchestration.metadata.deterministicResultProvided).toBe(true)
    expect(orchestration.globalDealState).toBe("review_required")
  })

  it("no-deal Phase 2 output maps through adapter and orchestrator to capital_protection/no_deal", () => {
    const blockedSample = loadPhase2Fixture("sample-governance-blocked-output.json")
    const snapshot = mapPhase2OutputToPhase3Snapshot(blockedSample)
    const orchestration = buildPhase3Orchestration({ deterministicResult: snapshot })

    expect(orchestration.globalDealState).toBe("no_deal")
    expect(orchestration.governanceEscalationRoute).toBe("capital_protection")
  })

  it("review-required evidence-gap output maps through adapter and orchestrator to evidence/manual review routing", () => {
    const sample = loadPhase2Fixture("sample-phase2-output.json")
    const withEvidenceGap = {
      ...sample,
      governance: {
        ...sample.governance,
        state: "REVIEW_REQUIRED",
        finalClassification: "REVIEW_REQUIRED",
        reviewRequired: true,
      },
      evidenceStatus: {
        ...sample.evidenceStatus,
        missingCriticalEvidence: ["proof_of_funds"],
      },
    } as Phase2AnalysisOutput

    const snapshot = mapPhase2OutputToPhase3Snapshot(withEvidenceGap)
    const orchestration = buildPhase3Orchestration({ deterministicResult: snapshot })

    expect(orchestration.globalDealState).toBe("review_required")
    expect(orchestration.governanceEscalationRoute).toBe("evidence_gap")
    expect(
      orchestration.tasks.some(
        (task) => task.id === "manual-review-routing" && task.status === "in_progress"
      )
    ).toBe(true)
  })
})
