import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { mergeOrchestrationWithEvidenceHints } from "@/lib/engine/phase3-orchestration-merge"
import type { EvidenceOrchestrationHints } from "@/types/phase3-evidence"
import type {
  Phase3MergedOrchestrationOutput,
  Phase3OrchestrationOutput,
} from "@/types/phase3-orchestration"

type FixturePair = {
  orchestration: string
  hints: string
  merged: string
}

const FIXTURE_PAIRS: readonly FixturePair[] = [
  {
    orchestration: "no-deal-capital-protection.json",
    hints: "weak-comparable-evidence-hints.json",
    merged: "no-deal-with-weak-comparable-hints-merged.json",
  },
  {
    orchestration: "review-required-evidence-gap.json",
    hints: "conflicting-legal-evidence-hints.json",
    merged: "review-required-with-legal-conflict-hints-merged.json",
  },
  {
    orchestration: "accepted-limitations-awareness.json",
    hints: "accepted-operator-note-hints.json",
    merged: "clean-proceed-with-accepted-operator-note-merged.json",
  },
  {
    orchestration: "intake-missing-deterministic.json",
    hints: "missing-lender-evidence-hints.json",
    merged: "intake-with-missing-lender-hints-merged.json",
  },
] as const

function loadJsonFixture<T>(...parts: string[]): T {
  const fixturePath = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", ...parts)
  return JSON.parse(readFileSync(fixturePath, "utf8")) as T
}

describe("phase3 orchestration merge", () => {
  it.each(FIXTURE_PAIRS)("matches locked merged fixture: %s + %s", (pair) => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      pair.orchestration
    )
    const hints = loadJsonFixture<EvidenceOrchestrationHints>(
      "phase3-evidence-orchestration-hints",
      pair.hints
    )
    const expected = loadJsonFixture<Phase3MergedOrchestrationOutput>(
      "phase3-merged-orchestration",
      pair.merged
    )

    const actual = mergeOrchestrationWithEvidenceHints(orchestration, hints)
    expect(actual).toEqual(expected)
  })

  it("preserves capital_protection as primary and evidence routes as secondary when blocked", () => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      "no-deal-capital-protection.json"
    )
    const hints = loadJsonFixture<EvidenceOrchestrationHints>(
      "phase3-evidence-orchestration-hints",
      "weak-comparable-evidence-hints.json"
    )

    const result = mergeOrchestrationWithEvidenceHints(orchestration, hints)

    expect(result.primaryEscalationRoute).toBe("capital_protection")
    expect(result.secondaryEscalationRoutes).toContain("valuation_review")
    expect(result.secondaryEscalationRoutes).toContain("evidence_gap")
  })

  it("preserves deterministic tasks and does not remove deterministic ids", () => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      "review-required-evidence-gap.json"
    )
    const hints = loadJsonFixture<EvidenceOrchestrationHints>(
      "phase3-evidence-orchestration-hints",
      "conflicting-legal-evidence-hints.json"
    )

    const deterministicIds = orchestration.tasks.map((task) => task.id)
    const result = mergeOrchestrationWithEvidenceHints(orchestration, hints)

    for (const taskId of deterministicIds) {
      expect(result.tasks.some((task) => task.id === taskId)).toBe(true)
    }
  })

  it("deduplicates duplicate routes and duplicate warning messages", () => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      "intake-missing-deterministic.json"
    )
    const hints: EvidenceOrchestrationHints = {
      tasks: [
        {
          id: "hint-lender-missing-001",
          evidenceItemId: "ev-lender-missing-1",
          category: "lender_refinance_evidence",
          trigger: "missing_evidence",
          severity: "high",
          suggestedTaskCategory: "evidence",
          suggestedTaskPriority: "high",
          suggestedEscalationRoute: "lender_review",
          summary: "Lender refinance evidence is missing. Review required before progression.",
          advisoryOnly: true,
        },
      ],
      escalationRoutes: ["lender_review", "lender_review", "evidence_gap"],
      warnings: [
        "duplicate warning",
        "duplicate warning",
      ],
      reviewRequired: true,
      advisoryOnly: true,
    }

    const result = mergeOrchestrationWithEvidenceHints(orchestration, hints)

    expect(result.secondaryEscalationRoutes).toEqual(["lender_review", "evidence_gap"])
    const warningMessages = result.warnings.map((warning) => warning.message)
    expect(new Set(warningMessages).size).toBe(warningMessages.length)
  })

  it("keeps accepted operator note as awareness-only", () => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      "accepted-limitations-awareness.json"
    )
    const hints = loadJsonFixture<EvidenceOrchestrationHints>(
      "phase3-evidence-orchestration-hints",
      "accepted-operator-note-hints.json"
    )

    const result = mergeOrchestrationWithEvidenceHints(orchestration, hints)
    const task = result.tasks.find((entry) => entry.id === "hint-op-note-001")

    expect(task).toBeDefined()
    expect(task?.category).toBe("limitations_awareness")
    expect(task?.blocksProgression).toBe(false)
  })

  it("does not mutate orchestration or evidence hint inputs", () => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      "review-required-evidence-gap.json"
    )
    const hints = loadJsonFixture<EvidenceOrchestrationHints>(
      "phase3-evidence-orchestration-hints",
      "conflicting-legal-evidence-hints.json"
    )
    const beforeOrchestration = JSON.stringify(orchestration)
    const beforeHints = JSON.stringify(hints)

    mergeOrchestrationWithEvidenceHints(orchestration, hints)

    expect(JSON.stringify(orchestration)).toBe(beforeOrchestration)
    expect(JSON.stringify(hints)).toBe(beforeHints)
  })

  it("is deterministic and has no random/timestamp/runtime fields", () => {
    const orchestration = loadJsonFixture<Phase3OrchestrationOutput>(
      "phase3-orchestration",
      "no-deal-capital-protection.json"
    )
    const hints = loadJsonFixture<EvidenceOrchestrationHints>(
      "phase3-evidence-orchestration-hints",
      "weak-comparable-evidence-hints.json"
    )

    const first = mergeOrchestrationWithEvidenceHints(orchestration, hints)
    const second = mergeOrchestrationWithEvidenceHints(orchestration, hints)

    expect(first).toEqual(second)
    expect(JSON.stringify(first)).not.toMatch(
      /"createdAt"\s*:|"timestamp"\s*:|"generatedAt"\s*:|"random"\s*:|"uuid"\s*:|"idempotencyKey"\s*:/i
    )
    expect("finalClassification" in (first as unknown as Record<string, unknown>)).toBe(false)
    expect("governanceState" in (first as unknown as Record<string, unknown>)).toBe(false)
  })
})
