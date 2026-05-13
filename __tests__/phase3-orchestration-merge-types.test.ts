import { describe, expect, it } from "vitest"
import type {
  Phase3MergeResultMetadata,
  Phase3MergeWarning,
  Phase3MergedOrchestrationOutput,
  Phase3MergedTask,
} from "@/types/phase3-orchestration"

function makeMergeWarning(overrides?: Partial<Phase3MergeWarning>): Phase3MergeWarning {
  return {
    id: "warn-1",
    source: "orchestrator_guardrail",
    message: "Guardrail reminder: merged output remains advisory-only.",
    advisoryOnly: true,
    ...overrides,
  }
}

function makeMergedTask(overrides?: Partial<Phase3MergedTask>): Phase3MergedTask {
  return {
    id: "task-1",
    source: "deterministic_snapshot",
    title: "Deterministic review task",
    description: "Review deterministic orchestration output before progression.",
    category: "deterministic",
    trigger: "review_required_state",
    priority: "high",
    status: "pending",
    escalationRoute: "manual_review",
    blocksProgression: true,
    advisoryOnly: true,
    ...overrides,
  }
}

function makeMetadata(overrides?: Partial<Phase3MergeResultMetadata>): Phase3MergeResultMetadata {
  return {
    deterministicTaskCount: 2,
    evidenceHintCount: 1,
    mergedTaskCount: 3,
    warningCount: 1,
    reviewRequired: true,
    advisoryOnly: true,
    ...overrides,
  }
}

describe("phase3 orchestration merge type contracts", () => {
  it("supports a valid Phase3MergeWarning shape", () => {
    const warning = makeMergeWarning({
      source: "evidence_hint",
      relatedTaskId: "task-ev-1",
      relatedEvidenceItemId: "ev-1",
    })

    expect(warning.source).toBe("evidence_hint")
    expect(warning.advisoryOnly).toBe(true)
  })

  it("supports a valid deterministic_snapshot merged task shape", () => {
    const task = makeMergedTask({
      source: "deterministic_snapshot",
      trigger: "capital_protection_block",
      escalationRoute: "capital_protection",
      status: "blocked",
    })

    expect(task.source).toBe("deterministic_snapshot")
    expect(task.trigger).toBe("capital_protection_block")
    expect(task.advisoryOnly).toBe(true)
  })

  it("supports a valid evidence_hint merged task shape", () => {
    const task = makeMergedTask({
      id: "task-ev-1",
      source: "evidence_hint",
      category: "evidence",
      trigger: "missing_evidence",
      escalationRoute: "evidence_gap",
      blocksProgression: false,
    })

    expect(task.source).toBe("evidence_hint")
    expect(task.trigger).toBe("missing_evidence")
    expect(task.advisoryOnly).toBe(true)
  })

  it("supports a valid Phase3MergeResultMetadata shape", () => {
    const metadata = makeMetadata()

    expect(metadata.mergedTaskCount).toBe(3)
    expect(metadata.reviewRequired).toBe(true)
    expect(metadata.advisoryOnly).toBe(true)
  })

  it("supports a valid Phase3MergedOrchestrationOutput shape", () => {
    const output: Phase3MergedOrchestrationOutput = {
      workflowState: "review_required",
      globalDealState: "review_required",
      primaryEscalationRoute: "capital_protection",
      secondaryEscalationRoutes: ["evidence_gap", "valuation_review"],
      tasks: [
        makeMergedTask({
          id: "task-det-1",
          source: "deterministic_snapshot",
          escalationRoute: "capital_protection",
          status: "blocked",
        }),
        makeMergedTask({
          id: "task-ev-2",
          source: "evidence_hint",
          category: "evidence",
          trigger: "weak_evidence",
          escalationRoute: "valuation_review",
          blocksProgression: false,
        }),
      ],
      warnings: [
        makeMergeWarning({ id: "warn-a", source: "deterministic_snapshot" }),
        makeMergeWarning({
          id: "warn-b",
          source: "evidence_hint",
          relatedEvidenceItemId: "ev-2",
        }),
      ],
      metadata: makeMetadata({ warningCount: 2 }),
      advisoryOnly: true,
    }

    expect(output.primaryEscalationRoute).toBe("capital_protection")
    expect(output.secondaryEscalationRoutes).toEqual(["evidence_gap", "valuation_review"])
    expect(output.advisoryOnly).toBe(true)
    expect(output.tasks.every((task) => task.advisoryOnly)).toBe(true)
    expect(output.warnings.every((warning) => warning.advisoryOnly)).toBe(true)
    expect(output.metadata.advisoryOnly).toBe(true)
  })

  it("merged output does not include deterministic approval-changing fields", () => {
    const output = {
      workflowState: "analysis_ready",
      globalDealState: "proceed_candidate",
      primaryEscalationRoute: "none",
      secondaryEscalationRoutes: [],
      tasks: [],
      warnings: [],
      metadata: makeMetadata({
        deterministicTaskCount: 0,
        evidenceHintCount: 0,
        mergedTaskCount: 0,
        warningCount: 0,
        reviewRequired: false,
      }),
      advisoryOnly: true,
    } satisfies Phase3MergedOrchestrationOutput

    expect("finalClassification" in output).toBe(false)
    expect("governanceState" in output).toBe(false)
  })

  it("merged output does not include persistence, timestamps, ai, or integration fields", () => {
    const output = {
      workflowState: "analysis_ready",
      globalDealState: "conditional",
      primaryEscalationRoute: "manual_review",
      secondaryEscalationRoutes: ["evidence_gap"],
      tasks: [],
      warnings: [],
      metadata: makeMetadata({
        deterministicTaskCount: 0,
        evidenceHintCount: 0,
        mergedTaskCount: 0,
        warningCount: 0,
        reviewRequired: false,
      }),
      advisoryOnly: true,
    } satisfies Phase3MergedOrchestrationOutput

    expect("createdAt" in output).toBe(false)
    expect("updatedAt" in output).toBe(false)
    expect("persistedId" in output).toBe(false)
    expect("aiSummary" in output).toBe(false)
    expect("integrationSource" in output).toBe(false)
  })
})
