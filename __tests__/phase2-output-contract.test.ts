import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { validatePhase2Output } from "@/lib/validators/validate-phase2-output"
import type { Phase2AnalysisOutput } from "@/types/phase2"

function loadFixture(fileName: string): Phase2AnalysisOutput {
  const fixturePath = path.resolve(process.cwd(), "tests", "fixtures", "phase2", fileName)
  return JSON.parse(readFileSync(fixturePath, "utf8")) as Phase2AnalysisOutput
}

describe("phase2 output contract", () => {
  const sampleOutput = loadFixture("sample-phase2-output.json")
  const governanceBlockedOutput = loadFixture("sample-governance-blocked-output.json")

  it("sample Phase 2 output passes validation", () => {
    expect(validatePhase2Output(sampleOutput)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it("governance blocked sample passes validation", () => {
    expect(validatePhase2Output(governanceBlockedOutput)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it("governance blocked sample proves scoring can be HOT while final classification is NO_DEAL", () => {
    expect(governanceBlockedOutput.dealHeatScore.score).toBeGreaterThan(80)
    expect(governanceBlockedOutput.dealHeatScore.band).toBe("HOT")
    expect(governanceBlockedOutput.governance.fatalRisk).toBe(true)
    expect(governanceBlockedOutput.governance.governanceOverrideApplied).toBe(true)
    expect(governanceBlockedOutput.governance.finalClassification).toBe("NO_DEAL")
    expect(governanceBlockedOutput.governance.state).toBe("BLOCKED")
  })

  it("missing top-level sections fail validation", () => {
    const { governance, ...missingGovernance } = sampleOutput
    void governance

    const result = validatePhase2Output(missingGovernance)

    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Missing top-level section: governance.")
  })

  it("invalid governance state fails validation", () => {
    const invalid = {
      ...sampleOutput,
      governance: {
        ...sampleOutput.governance,
        state: "STOP",
      },
    }

    const result = validatePhase2Output(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("governance.state"))).toBe(true)
  })

  it("invalid classification fails validation", () => {
    const invalid = {
      ...sampleOutput,
      governance: {
        ...sampleOutput.governance,
        finalClassification: "GREEN_LIGHT",
      },
    }

    const result = validatePhase2Output(invalid)

    expect(result.valid).toBe(false)
    expect(result.errors.some((error) => error.includes("governance.finalClassification"))).toBe(true)
  })
})
