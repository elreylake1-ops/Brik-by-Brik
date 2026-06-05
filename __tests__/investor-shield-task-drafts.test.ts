import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { buildInvestorShieldTaskDrafts } from "@/lib/investor-shield/build-investor-shield-task-drafts"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

function makeResult(
  overrides?: Partial<InvestorShieldEnforcementResult>
): InvestorShieldEnforcementResult {
  return {
    dealId: "deal-task-draft-1",
    overallStatus: "CAUTION",
    progressionDecision: "NEEDS_REVIEW",
    canProgress: false,
    blockingGateKeys: [],
    cautionGateKeys: ["REFURB_CERTAINTY"],
    missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
    manualOverrideRequired: false,
    advisoryOnlyEvidenceWarnings: [],
    blockingReasons: [],
    taskRecommendations: [
      {
        gateKey: "REFURB_CERTAINTY",
        subGateKey: "BUILDER_QUOTE_EVIDENCE",
        type: "OBTAIN_BUILDER_QUOTE",
        title: "Obtain builder quote",
        reason: "Refurb certainty needs stronger builder evidence.",
        severity: "BLOCKER",
        source: "system_default",
        idempotencyKey:
          "investor-shield:deal-task-draft-1:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
      },
      {
        gateKey: "LENDER_CRITERIA",
        type: "REVIEW_LENDER_CRITERIA",
        title: "Review lender criteria",
        reason: "Lender criteria evidence must be confirmed.",
        severity: "CAUTION",
        source: "system_default",
        idempotencyKey:
          "investor-shield:deal-task-draft-1:LENDER_CRITERIA:REVIEW_LENDER_CRITERIA",
      },
    ],
    ...overrides,
  }
}

describe("investor shield task draft builder", () => {
  it("converts evaluator recommendations into in-memory task drafts", () => {
    const drafts = buildInvestorShieldTaskDrafts(makeResult())

    expect(drafts).toEqual([
      {
        dealId: "deal-task-draft-1",
        title: "Obtain builder quote",
        description:
          "Refurb certainty needs stronger builder evidence. Source: system_default. Investor Shield gate: REFURB_CERTAINTY / BUILDER_QUOTE_EVIDENCE.",
        status: "OPEN",
        priority: "HIGH",
        taskType: "EVIDENCE",
        source: "investor_shield",
        gateKey: "REFURB_CERTAINTY",
        subGateKey: "BUILDER_QUOTE_EVIDENCE",
        idempotencyKey:
          "investor-shield:deal-task-draft-1:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
      },
      {
        dealId: "deal-task-draft-1",
        title: "Review lender criteria",
        description:
          "Lender criteria evidence must be confirmed. Source: system_default. Investor Shield gate: LENDER_CRITERIA.",
        status: "OPEN",
        priority: "MEDIUM",
        taskType: "FINANCE_REVIEW",
        source: "investor_shield",
        gateKey: "LENDER_CRITERIA",
        subGateKey: undefined,
        idempotencyKey:
          "investor-shield:deal-task-draft-1:LENDER_CRITERIA:REVIEW_LENDER_CRITERIA",
      },
    ])
  })

  it("preserves dealId as string and gate references", () => {
    const drafts = buildInvestorShieldTaskDrafts(makeResult())

    expect(typeof drafts[0].dealId).toBe("string")
    expect(drafts[0].gateKey).toBe("REFURB_CERTAINTY")
    expect(drafts[0].subGateKey).toBe("BUILDER_QUOTE_EVIDENCE")
  })

  it("preserves deterministic idempotencyKey and deduplicates duplicates", () => {
    const result = makeResult({
      taskRecommendations: [
        ...makeResult().taskRecommendations,
        makeResult().taskRecommendations[0],
      ],
    })

    const drafts = buildInvestorShieldTaskDrafts(result)

    expect(drafts).toHaveLength(2)
    expect(drafts[0].idempotencyKey).toBe(
      "investor-shield:deal-task-draft-1:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE"
    )
  })

  it("returns empty array when no task recommendations exist", () => {
    const drafts = buildInvestorShieldTaskDrafts(
      makeResult({ taskRecommendations: [] })
    )

    expect(drafts).toEqual([])
  })

  it("does not mutate the input result", () => {
    const result = makeResult()
    const before = JSON.parse(JSON.stringify(result))

    buildInvestorShieldTaskDrafts(result)

    expect(result).toEqual(before)
  })

  it("output is deterministic for identical input", () => {
    const result = makeResult()

    expect(buildInvestorShieldTaskDrafts(result)).toEqual(
      buildInvestorShieldTaskDrafts(result)
    )
  })

  it("module does not import or call deal task repository", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "lib/investor-shield/build-investor-shield-task-drafts.ts"
      ),
      "utf8"
    )

    expect(source).not.toContain("@/lib/operator-command/deal-tasks-repository")
    expect(source).not.toContain("createTask(")
    expect(source).not.toContain("listTasksForDeal(")
    expect(source).not.toContain("query(")
  })
})
