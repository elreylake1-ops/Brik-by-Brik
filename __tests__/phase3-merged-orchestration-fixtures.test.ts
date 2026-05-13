import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { Phase3MergedOrchestrationOutput } from "@/types/phase3-orchestration"

const FIXTURE_NAMES = [
  "no-deal-with-weak-comparable-hints-merged.json",
  "review-required-with-legal-conflict-hints-merged.json",
  "clean-proceed-with-accepted-operator-note-merged.json",
  "intake-with-missing-lender-hints-merged.json",
] as const

function loadMergedFixture(name: (typeof FIXTURE_NAMES)[number]): Phase3MergedOrchestrationOutput {
  const fixturesDir = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    "phase3-merged-orchestration"
  )

  return JSON.parse(
    readFileSync(path.join(fixturesDir, name), "utf8")
  ) as Phase3MergedOrchestrationOutput
}

describe("phase3 merged orchestration expected fixtures", () => {
  it.each(FIXTURE_NAMES)("matches merged output contract shape: %s", (name) => {
    const output = loadMergedFixture(name)

    expect(output.advisoryOnly).toBe(true)
    expect(typeof output.primaryEscalationRoute).toBe("string")
    expect(Array.isArray(output.secondaryEscalationRoutes)).toBe(true)
    expect(Array.isArray(output.tasks)).toBe(true)
    expect(Array.isArray(output.warnings)).toBe(true)
    expect(output.metadata).toBeDefined()
    expect(output.metadata.advisoryOnly).toBe(true)
  })

  it.each(FIXTURE_NAMES)(
    "does not include unsupported runtime fields or deterministic approval fields: %s",
    (name) => {
      const output = loadMergedFixture(name) as Record<string, unknown>

      expect("finalClassification" in output).toBe(false)
      expect("governanceState" in output).toBe(false)
      expect("createdAt" in output).toBe(false)
      expect("updatedAt" in output).toBe(false)
      expect("persistedId" in output).toBe(false)
      expect("aiSummary" in output).toBe(false)
      expect("integrationSource" in output).toBe(false)
    }
  )
})
