import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "@/lib/viewing-assessment/ai/budget"
import { worstCaseCostMicros } from "@/lib/viewing-assessment/ai/pricing"
import { evaluateAll, evaluateCase, validateUsage, type EvalCase } from "@/lib/viewing-assessment/evaluation/evaluate"
import { CASES, FRAMES } from "./fixtures/evaluation/cases"

// Offline: recorded or synthetic responses only. No network, no key, no spend. Expected scores are worked out by hand
// from the fixture definitions (see fixtures/evaluation/cases.ts), so these tests check the harness, not echo it.

const ESTIMATE_6_FRAMES = worstCaseCostMicros("claude-opus-5-5", FRAMES.length, DEFAULT_LIMITS)
const DEFAULT_ACTUAL = 15_600 * 4 + 12_000 * 20 // opus 5.5: $4 in / $20 out per MTok => micro-dollars = tokens x price

describe("matching proposals to human findings", () => {
  it("scores a perfect answer 1.0 with exact references", () => {
    const r = evaluateCase(CASES.perfect)
    expect(r.counts).toMatchObject({ proposals: 4, supported: 4, unsupported: 0, falsePositives: 0, detectedGold: 4, missed: 0, statusMismatches: 0 })
    expect([r.precision, r.recall, r.f1]).toEqual([1, 1, 1])
    expect(r.references).toMatchObject({ cited: 4, existing: 4, acceptedCited: 4, supportive: 4, validityRate: 1, accuracyRate: 1 })
  })

  it("separates false positives, unsupported observations, status mismatches and misses", () => {
    const r = evaluateCase(CASES.mixed)
    expect(r.counts).toEqual({ proposals: 4, supported: 2, unsupported: 1, falsePositives: 1, detectedGold: 2, goldTotal: 4, missed: 2, statusMismatches: 1 })
    expect(r.missedChecks).toEqual(["C11", "C20"]) // C11 was reported, but on a frame that does not show it: still not detected
    expect([r.precision, r.recall, r.f1]).toEqual([0.5, 0.5, 0.5])
  })

  it("verifies exact frame references: phantom frames and unknown checks are rejected by the production validator", () => {
    const r = evaluateCase(CASES.mixed)
    expect(r.validator).toMatchObject({ accepted: 4, rejected: 2 })
    expect(r.validator.rejectionReasons).toEqual({ "Unknown or invalid evidence reference": 1, "Unknown checklist ID": 1 })
    expect(r.references.cited).toBe(6)
    expect(r.references.existing).toBe(5) // "ghost-frame" was never submitted
    expect(r.references.validityRate).toBeCloseTo(5 / 6)
    expect(r.references.accuracyRate).toBe(0.5) // of 4 frames cited by surviving proposals, 2 are frames a human says show the finding
  })

  it("merges duplicates and credits both references", () => {
    const r = evaluateCase(CASES.duplicates)
    expect(r.counts).toMatchObject({ proposals: 1, supported: 1 })
    expect(r.references).toMatchObject({ cited: 2, acceptedCited: 2, supportive: 2, accuracyRate: 1 })
  })

  it("does not let a model claim a pass, review state, costs or governance: those findings are rejected or stripped", () => {
    const r = evaluateCase(CASES.overreach)
    expect(r.validator.rejectionReasons).toEqual({ "Unsupported status": 1 })
    expect(r.counts).toMatchObject({ proposals: 1, supported: 1, missed: 3 })
    expect([r.precision, r.recall]).toEqual([1, 0.25])
  })

  it("reports an empty answer honestly: nothing detected, everything missed, precision undefined", () => {
    const r = evaluateCase(CASES.silent)
    expect(r.counts).toMatchObject({ proposals: 0, missed: 4, detectedGold: 0 })
    expect([r.precision, r.recall, r.f1]).toEqual([null, 0, null])
    expect(r.references.validityRate).toBeNull()
  })

  it("never divides by zero when there is nothing to find", () => {
    const empty: EvalCase = { ...CASES.silent, gold: [] }
    const r = evaluateCase(empty)
    expect([r.precision, r.recall, r.f1]).toEqual([null, null, null])
  })

  it("treats a malformed or hostile envelope as zero proposals instead of throwing", () => {
    for (const envelope of [null, "text", 42, [], {}, { kind: "brik-ai-findings", version: 1, assessmentId: "eval", modelVersion: "m", findings: "nope" }]) {
      const r = evaluateCase({ ...CASES.perfect, id: "bad", recorded: { ...CASES.perfect.recorded, envelope } })
      expect(r.counts.proposals).toBe(0)
      expect(r.validator.rejected).toBeGreaterThanOrEqual(1)
    }
  })
})

describe("usage validation and the estimate / actual cost separation", () => {
  it("recomputes actual cost from the provider-reported tokens and keeps it separate from the estimate", () => {
    const r = evaluateCase(CASES.perfect)
    expect(r.cost.actual).toEqual({ micros: DEFAULT_ACTUAL, basis: "provider_reported_usage" })
    expect(r.cost.estimate).toEqual({ micros: ESTIMATE_6_FRAMES, basis: "upper_bound_from_planning_assumptions" })
    expect(r.cost.actual!.micros).toBeLessThan(r.cost.estimate.micros!)
    expect(r.usage.flags).toEqual([])
  })

  it("treats simulated responses as free by definition, never as spend", () => {
    const r = evaluateCase(CASES.fixture)
    expect(r.cost.actual).toEqual({ micros: 0, basis: "simulated_free" })
    expect(r.usage.flags).toEqual([])
  })

  it.each([
    ["usageMissing", ["USAGE_MISSING"]],
    ["usageNegative", ["USAGE_NOT_NON_NEGATIVE_INTEGERS"]],
    ["usageFractional", ["USAGE_NOT_NON_NEGATIVE_INTEGERS"]],
    ["usageInputTooLow", ["INPUT_TOKENS_IMPLAUSIBLY_LOW"]],
    ["usageAboveEstimate", ["ACTUAL_EXCEEDS_ESTIMATE"]],
    ["ledgerMismatch", ["LEDGER_COST_MISMATCH"]],
    ["unpricedModel", ["UNPRICED_MODEL"]],
  ] as const)("flags %s", (name, flags) => {
    expect(evaluateCase(CASES[name]).usage.flags).toEqual(flags)
  })

  it("flags output beyond the configured limit, and the resulting overrun of the estimate", () => {
    expect(evaluateCase(CASES.usageOutputOverLimit).usage.flags).toEqual(["OUTPUT_EXCEEDS_LIMIT", "ACTUAL_EXCEEDS_ESTIMATE"])
  })

  it("leaves the actual cost UNKNOWN (null), not zero, when the report cannot be trusted", () => {
    for (const name of ["usageMissing", "usageNegative", "usageFractional", "unpricedModel"] as const) {
      expect(evaluateCase(CASES[name]).cost.actual, name).toBeNull()
    }
    expect(evaluateCase(CASES.unpricedModel).cost.estimate.micros).toBeNull()
  })

  it("validateUsage on its own: integers only, output within limit, plausible input", () => {
    const base = { simulated: false, frameCount: 6, limits: DEFAULT_LIMITS }
    expect(validateUsage({ ...base, usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 } })).toEqual([])
    expect(validateUsage({ ...base, usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: NaN } })).toEqual(["USAGE_NOT_NON_NEGATIVE_INTEGERS"])
    // cached tokens count toward the prompt, so a mostly-cached request is not mistaken for an implausibly small one
    expect(validateUsage({ ...base, usage: { inputTokens: 1, outputTokens: 10, cacheReadTokens: 9000, cacheWriteTokens: 0 } })).toEqual([])
  })
})

describe("aggregate report", () => {
  it("micro-averages across cases and tallies rejections, misses and flags", () => {
    const report = evaluateAll([CASES.perfect, CASES.mixed, CASES.overreach, CASES.silent])
    expect(report.totals).toMatchObject({ cases: 4, proposals: 9, supported: 7, unsupported: 1, falsePositives: 1, missed: 9, goldTotal: 16, statusMismatches: 1 })
    expect(report.totals.precision).toBeCloseTo(7 / 9)
    expect(report.totals.recall).toBeCloseTo(7 / 16)
    expect(report.validatorRejections).toEqual({ "Unknown or invalid evidence reference": 1, "Unknown checklist ID": 1, "Unsupported status": 1 })
    expect(report.missedByCheck).toEqual({ C08: 2, C10: 2, C11: 2, C20: 3 }) // 9 misses in total, matching totals.missed
  })

  it("reports estimated upper bound and real spend as separate figures, excluding simulated cases from spend", () => {
    const report = evaluateAll([CASES.perfect, CASES.mixed, CASES.fixture, CASES.usageMissing])
    expect(report.cost.actualProviderReportedMicros).toBe(DEFAULT_ACTUAL * 2) // perfect + mixed only
    expect(report.cost.estimatedUpperBoundMicros).toBe(ESTIMATE_6_FRAMES * 4)
    expect(report.cost.simulatedCases).toBe(1)
    expect(report.cost.casesWithUnknownActualCost).toBe(1) // usageMissing: unknown, deliberately not counted as zero
    expect(report.usageFlags).toEqual({ USAGE_MISSING: 1 })
  })

  it("is deterministic and does not mutate its input", () => {
    const before = JSON.stringify(CASES.mixed)
    const a = evaluateAll([CASES.mixed, CASES.perfect])
    const b = evaluateAll([CASES.mixed, CASES.perfect])
    expect(a).toEqual(b)
    expect(JSON.stringify(CASES.mixed)).toBe(before)
  })
})

describe("recorded-response format", () => {
  it("loads a recorded JSON sample and scores it", () => {
    const sample = JSON.parse(readFileSync(path.resolve(__dirname, "fixtures/evaluation/recorded-sample.json"), "utf8")) as EvalCase & { _comment?: string }
    const r = evaluateCase(sample)
    expect(r.counts).toMatchObject({ proposals: 2, supported: 1, falsePositives: 1, missed: 1 }) // C08 right; C10 has no human finding; C20 missed
    expect(r.cost.actual).toEqual({ micros: 66_000, basis: "provider_reported_usage" })
    expect(r.usage.flags).toEqual([]) // ledger cost 66,000 matches the recomputed 66,000
  })

  it("makes no network call and needs no credentials: the harness imports no provider client", () => {
    const src = readFileSync(path.resolve(__dirname, "../lib/viewing-assessment/evaluation/evaluate.ts"), "utf8")
    expect(src).not.toMatch(/@anthropic-ai\/sdk|fetch\(|process\.env|claude-provider|select-provider/)
  })
})
