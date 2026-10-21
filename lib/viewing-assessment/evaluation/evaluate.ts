import { DEFAULT_LIMITS } from "../ai/budget"
import { costMicros, hasPrice, worstCaseCostMicros } from "../ai/pricing"
import type { AnalysisLimits, ProviderUsage } from "../ai/provider"
import { validateAiProposals } from "../validate-ai-proposals"
import type { AiProposableStatus } from "@/types/viewing-assessment"

// Offline evaluation of AI checklist suggestions. It makes no network call, spends nothing, and changes nothing:
// it replays RECORDED (or synthetic) provider responses through the SAME validator production uses, then compares the
// surviving proposals with what a human established. It is the yardstick for any future prompt or model change; it does
// not train, tune or promote anything.
//
// Definitions (kept deliberately strict):
//  - supported match      a proposal on a check that a human found, citing at least one frame the human says shows it
//  - unsupported          right check, but none of its cited frames is one the human says shows it
//  - false positive       a proposal on a check the human found nothing on
//  - missed               a human finding that no supported proposal detected
//  - status mismatch      a supported match whose proposed status differs from the human's (detected, but graded wrong)
// precision = supported proposals / all proposals;  recall = detected human findings / human findings.
//
// Cost is reported as two separate things and never blended: an ESTIMATE (an upper bound from planning assumptions) and
// the ACTUAL cost recomputed from the token counts the provider reported. Simulated responses cost nothing by definition.

export type GoldFinding = {
  checkId: string
  status: AiProposableStatus
  /** Frames that, in a human's judgement, actually show this finding. */
  supportingFrameIds: readonly string[]
}

export type RecordedResponse = {
  model: string
  promptVersion: string
  /** True for fixtures and synthetic responses: free by definition, never counted as spend. */
  simulated: boolean
  /** Exactly what the provider returned. Untrusted: it goes through the production validator. */
  envelope: unknown
  /** Token counts as REPORTED by the provider; null if none were reported. */
  usage: ProviderUsage | null
  /** Cost the usage ledger recorded for this call, if any, to cross-check against the recomputed cost. */
  ledgerCostMicros?: number | null
}

export type EvalCase = {
  id: string
  frames: readonly { id: string; timestampSeconds: number }[]
  gold: readonly GoldFinding[]
  recorded: RecordedResponse
}

export type UsageFlag =
  | "USAGE_MISSING"
  | "USAGE_NOT_NON_NEGATIVE_INTEGERS"
  | "OUTPUT_EXCEEDS_LIMIT"
  | "INPUT_TOKENS_IMPLAUSIBLY_LOW"
  | "UNPRICED_MODEL"
  | "LEDGER_COST_MISMATCH"
  | "ACTUAL_EXCEEDS_ESTIMATE"

export type CaseResult = {
  caseId: string
  model: string
  promptVersion: string
  simulated: boolean
  validator: { accepted: number; rejected: number; rejectionReasons: Record<string, number> }
  counts: { proposals: number; supported: number; unsupported: number; falsePositives: number; detectedGold: number; goldTotal: number; missed: number; statusMismatches: number }
  missedChecks: string[]
  references: {
    cited: number
    existing: number // cited frame ids that exist among the submitted frames
    acceptedCited: number // frame ids cited by proposals that survived the validator (the denominator of accuracy)
    supportive: number // of those, ids a human says show the finding
    validityRate: number | null
    accuracyRate: number | null
  }
  precision: number | null
  recall: number | null
  f1: number | null
  usage: { reported: ProviderUsage | null; flags: UsageFlag[] }
  cost: {
    estimate: { micros: number | null; basis: "upper_bound_from_planning_assumptions" }
    actual: { micros: number; basis: "provider_reported_usage" | "simulated_free" } | null
    ledgerMicros: number | null
  }
}

export type EvaluationReport = {
  cases: CaseResult[]
  totals: {
    cases: number
    proposals: number
    supported: number
    unsupported: number
    falsePositives: number
    missed: number
    goldTotal: number
    statusMismatches: number
    precision: number | null
    recall: number | null
    f1: number | null
    referenceValidityRate: number | null
    referenceAccuracyRate: number | null
  }
  validatorRejections: Record<string, number>
  missedByCheck: Record<string, number>
  usageFlags: Record<string, number>
  cost: {
    /** Sum of upper-bound estimates (priced models only). Not spend. */
    estimatedUpperBoundMicros: number
    /** Sum of costs recomputed from provider-reported tokens on non-simulated responses. This is the real-spend figure. */
    actualProviderReportedMicros: number
    /** Non-simulated cases with no usable token report: their actual cost is UNKNOWN, not zero. */
    casesWithUnknownActualCost: number
    simulatedCases: number
  }
}

const ratio = (n: number, d: number) => (d === 0 ? null : n / d)
const f1Of = (p: number | null, r: number | null) => (p === null || r === null || p + r === 0 ? null : (2 * p * r) / (p + r))
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0

function rawCitedFrameIds(envelope: unknown): string[] {
  const findings = (envelope as { findings?: unknown } | null)?.findings
  if (!Array.isArray(findings)) return []
  return findings.flatMap((f) => {
    const ids = (f as { frameIds?: unknown } | null)?.frameIds
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string") : []
  })
}

export function validateUsage(args: {
  usage: ProviderUsage | null
  simulated: boolean
  frameCount: number
  limits: AnalysisLimits
}): UsageFlag[] {
  const { usage, simulated, frameCount, limits } = args
  if (!usage) return simulated ? [] : ["USAGE_MISSING"]
  const flags: UsageFlag[] = []
  const fields = [usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheWriteTokens]
  if (!fields.every(isCount)) return ["USAGE_NOT_NON_NEGATIVE_INTEGERS"] // nothing else about these numbers can be trusted
  if (usage.outputTokens > limits.maxOutputTokens) flags.push("OUTPUT_EXCEEDS_LIMIT")
  // every submitted image costs at least one input token; fewer than that cannot be a real report
  if (!simulated && usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens < frameCount) flags.push("INPUT_TOKENS_IMPLAUSIBLY_LOW")
  return flags
}

export function evaluateCase(c: EvalCase, limits: AnalysisLimits = DEFAULT_LIMITS): CaseResult {
  const { recorded } = c
  const frameIds = new Set(c.frames.map((f) => f.id))
  const duration = Math.max(1, ...c.frames.map((f) => f.timestampSeconds)) + 1

  // 1. the production trust boundary
  const { proposals, rejected } = validateAiProposals(recorded.envelope, {
    assessmentId: (recorded.envelope as { assessmentId?: string } | null)?.assessmentId ?? "eval",
    evidence: c.frames.map((f) => ({ id: f.id, assetId: "eval", timestampSeconds: f.timestampSeconds })),
    assets: [{ id: "eval", durationSeconds: duration }],
  })
  const rejectionReasons: Record<string, number> = {}
  for (const r of rejected) rejectionReasons[r.reason] = (rejectionReasons[r.reason] ?? 0) + 1

  // 2. compare with the human findings
  const detected = new Set<number>()
  let supported = 0
  let unsupported = 0
  let falsePositives = 0
  let statusMismatches = 0
  let supportive = 0
  let citedOnAccepted = 0
  for (const p of proposals) {
    citedOnAccepted += p.evidenceIds.length
    const candidates = c.gold.map((g, i) => ({ g, i })).filter(({ g }) => g.checkId === p.checkId)
    if (candidates.length === 0) {
      falsePositives++
      continue
    }
    const overlap = (g: GoldFinding) => p.evidenceIds.filter((id) => g.supportingFrameIds.includes(id)).length
    const best = candidates.reduce((a, b) => (overlap(b.g) > overlap(a.g) ? b : a))
    if (overlap(best.g) === 0) {
      unsupported++
      continue
    }
    supported++
    detected.add(best.i)
    supportive += overlap(best.g)
    if (p.status !== best.g.status) statusMismatches++
  }
  const missedChecks = c.gold.filter((_, i) => !detected.has(i)).map((g) => g.checkId)

  // 3. references: validity is measured on the RAW answer, before the validator drops anything
  const cited = rawCitedFrameIds(recorded.envelope)
  const existing = cited.filter((id) => frameIds.has(id)).length

  // 4. usage and cost
  const usageFlags = validateUsage({ usage: recorded.usage, simulated: recorded.simulated, frameCount: c.frames.length, limits })
  const priced = hasPrice(recorded.model)
  if (!recorded.simulated && !priced) usageFlags.push("UNPRICED_MODEL")
  const estimateMicros = priced ? worstCaseCostMicros(recorded.model, c.frames.length, limits) : null
  let actual: CaseResult["cost"]["actual"] = null
  if (recorded.simulated) actual = { micros: 0, basis: "simulated_free" }
  else if (recorded.usage && priced && !usageFlags.includes("USAGE_NOT_NON_NEGATIVE_INTEGERS")) {
    actual = { micros: costMicros(recorded.model, recorded.usage), basis: "provider_reported_usage" }
    if (estimateMicros !== null && actual.micros > estimateMicros) usageFlags.push("ACTUAL_EXCEEDS_ESTIMATE")
    if (recorded.ledgerCostMicros != null && recorded.ledgerCostMicros !== actual.micros) usageFlags.push("LEDGER_COST_MISMATCH")
  }

  const precision = ratio(supported, proposals.length)
  const recall = ratio(detected.size, c.gold.length)
  return {
    caseId: c.id,
    model: recorded.model,
    promptVersion: recorded.promptVersion,
    simulated: recorded.simulated,
    validator: { accepted: proposals.length, rejected: rejected.length, rejectionReasons },
    counts: { proposals: proposals.length, supported, unsupported, falsePositives, detectedGold: detected.size, goldTotal: c.gold.length, missed: missedChecks.length, statusMismatches },
    missedChecks,
    references: { cited: cited.length, existing, acceptedCited: citedOnAccepted, supportive, validityRate: ratio(existing, cited.length), accuracyRate: ratio(supportive, citedOnAccepted) },
    precision,
    recall,
    f1: f1Of(precision, recall),
    usage: { reported: recorded.usage, flags: usageFlags },
    cost: { estimate: { micros: estimateMicros, basis: "upper_bound_from_planning_assumptions" }, actual, ledgerMicros: recorded.ledgerCostMicros ?? null },
  }
}

export function evaluateAll(cases: readonly EvalCase[], limits: AnalysisLimits = DEFAULT_LIMITS): EvaluationReport {
  const results = cases.map((c) => evaluateCase(c, limits))
  const sum = (pick: (r: CaseResult) => number) => results.reduce((n, r) => n + pick(r), 0)
  const proposals = sum((r) => r.counts.proposals)
  const supported = sum((r) => r.counts.supported)
  const goldTotal = sum((r) => r.counts.goldTotal)
  const detectedGold = sum((r) => r.counts.detectedGold)
  const precision = ratio(supported, proposals)
  const recall = ratio(detectedGold, goldTotal)

  const tally = (items: string[]) => items.reduce<Record<string, number>>((acc, k) => ({ ...acc, [k]: (acc[k] ?? 0) + 1 }), {})
  const validatorRejections: Record<string, number> = {}
  for (const r of results) for (const [reason, n] of Object.entries(r.validator.rejectionReasons)) validatorRejections[reason] = (validatorRejections[reason] ?? 0) + n

  const real = results.filter((r) => !r.simulated)
  return {
    cases: results,
    totals: {
      cases: results.length,
      proposals,
      supported,
      unsupported: sum((r) => r.counts.unsupported),
      falsePositives: sum((r) => r.counts.falsePositives),
      missed: sum((r) => r.counts.missed),
      goldTotal,
      statusMismatches: sum((r) => r.counts.statusMismatches),
      precision,
      recall,
      f1: f1Of(precision, recall),
      referenceValidityRate: ratio(sum((r) => r.references.existing), sum((r) => r.references.cited)),
      referenceAccuracyRate: ratio(sum((r) => r.references.supportive), sum((r) => r.references.acceptedCited)),
    },
    validatorRejections,
    missedByCheck: tally(results.flatMap((r) => r.missedChecks)),
    usageFlags: tally(results.flatMap((r) => r.usage.flags)),
    cost: {
      estimatedUpperBoundMicros: sum((r) => r.cost.estimate.micros ?? 0),
      actualProviderReportedMicros: real.reduce((n, r) => n + (r.cost.actual?.basis === "provider_reported_usage" ? r.cost.actual.micros : 0), 0),
      casesWithUnknownActualCost: real.filter((r) => r.cost.actual === null).length,
      simulatedCases: results.length - real.length,
    },
  }
}
