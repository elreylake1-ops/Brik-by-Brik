import type { AnalysisLimits } from "./provider"

// Visible cost and safety configuration for AI analysis. Nothing here is hidden in calculation code.
//
// Approved allowance for testing: USD 150 in total. Paid processing is DISABLED unless explicitly enabled
// (see select-provider.ts) and, even then, every run is checked against these figures before a request is sent.

export const BUDGET = Object.freeze({
  totalAllowanceUsd: 150,
  hardStopUsd: 120, // no paid run starts once recorded spend plus this run's worst case would pass this
  reserveUsd: 30, // deliberately never spent by the application
  // How the hard-stop amount is intended to be used. Informational; asserted to sum to the hard stop.
  allocationsUsd: Object.freeze({
    promptAndEvaluationIteration: 40,
    acceptanceRuns: 20,
    contingency: 60,
  }),
  maxPaidRunsPerDay: 25,
})

// Per-run limits. Conservative by design; raise only with evidence.
export const DEFAULT_LIMITS: AnalysisLimits = Object.freeze({
  maxFrames: 40, // same ceiling as the supplied viewing module
  maxOutputTokens: 16_000,
  timeoutMs: 120_000,
})

// Planning assumptions for the worst-case estimate made BEFORE a request. They are assumptions, not measurements:
// confirm with the (free) count_tokens endpoint on real frames before the first paid run.
export const ESTIMATE_ASSUMPTIONS = Object.freeze({
  inputTokensPerFrame: 1_600,
  promptTokens: 6_000, // checklist + rules
})

export const usdToMicros = (usd: number) => Math.round(usd * 1_000_000)

export type BudgetDecision =
  | { allowed: true }
  | { allowed: false; reason: "HARD_STOP" | "DAILY_RUN_CAP" }

/** Pure guard. All amounts are integer micro-dollars. */
export function checkBudget(input: {
  spentMicros: number
  worstCaseMicros: number
  runsToday: number
  hardStopMicros?: number
  maxRunsPerDay?: number
}): BudgetDecision {
  const hardStop = input.hardStopMicros ?? usdToMicros(BUDGET.hardStopUsd)
  const maxRuns = input.maxRunsPerDay ?? BUDGET.maxPaidRunsPerDay
  if (input.runsToday >= maxRuns) return { allowed: false, reason: "DAILY_RUN_CAP" }
  if (input.spentMicros + input.worstCaseMicros > hardStop) return { allowed: false, reason: "HARD_STOP" }
  return { allowed: true }
}

/** Start of the current UTC day, for the daily run cap. */
export const startOfUtcDay = (now: Date) =>
  new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
