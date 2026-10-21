import { ESTIMATE_ASSUMPTIONS } from "./budget"
import type { AnalysisLimits, ProviderUsage } from "./provider"

// Price table for paid analysis, in USD per million tokens. Visible configuration, not buried in logic.
//
// SOURCE: the Claude API reference's model table (cached 2026-10-06) and its notes on cache pricing. These are
// first-party list prices. They MUST be re-verified against the live pricing page before the first paid run;
// the table exists so that cost is computed from recorded token counts, never guessed.
//
// A model that is not in this table cannot be used: its cost would be unknowable, so the budget cannot be enforced.
// Where a cache price is not confirmed (cacheReadPerMTok === null) cache reads are charged at the full input
// price: deliberately pessimistic.
export type ModelPrice = {
  inputPerMTok: number
  outputPerMTok: number
  cacheReadPerMTok: number | null
  /** Prompts above this many tokens are priced at the `long*` rates (Haiku 5.5 only). */
  longPromptThreshold?: number
  longInputPerMTok?: number
  longOutputPerMTok?: number
}

export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = Object.freeze({
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20, cacheReadPerMTok: 0.2 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10, cacheReadPerMTok: 0.2 },
  "claude-haiku-5-5": {
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    cacheReadPerMTok: null,
    longPromptThreshold: 100_000,
    longInputPerMTok: 0.5,
    longOutputPerMTok: 2.5,
  },
  "claude-fable-5-1": { inputPerMTok: 10, outputPerMTok: 50, cacheReadPerMTok: 0.25 },
})

// 5-minute cache writes cost 1.25x the input price (the only TTL this application would use).
const CACHE_WRITE_MULTIPLIER = 1.25

export class UnknownModelPriceError extends Error {
  constructor(model: string) {
    super(`No verified price for model ${JSON.stringify(model)}; paid analysis with it is refused.`)
    this.name = "UnknownModelPriceError"
  }
}

export const hasPrice = (model: string) => Object.hasOwn(MODEL_PRICES, model)

function priceFor(model: string): ModelPrice {
  if (!hasPrice(model)) throw new UnknownModelPriceError(model)
  return MODEL_PRICES[model]
}

/** Exact cost of recorded usage, in integer micro-dollars (tokens x USD/MTok is already micro-dollars). */
export function costMicros(model: string, usage: ProviderUsage): number {
  const p = priceFor(model)
  const promptTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  const long = p.longPromptThreshold !== undefined && promptTokens > p.longPromptThreshold
  const input = long ? (p.longInputPerMTok ?? p.inputPerMTok) : p.inputPerMTok
  const output = long ? (p.longOutputPerMTok ?? p.outputPerMTok) : p.outputPerMTok
  const cacheRead = p.cacheReadPerMTok ?? input
  return Math.ceil(
    usage.inputTokens * input +
      usage.outputTokens * output +
      usage.cacheReadTokens * cacheRead +
      usage.cacheWriteTokens * input * CACHE_WRITE_MULTIPLIER
  )
}

/** Upper bound for one run, used by the budget guard BEFORE anything is sent. */
export function worstCaseCostMicros(model: string, frameCount: number, limits: AnalysisLimits): number {
  return costMicros(model, {
    inputTokens: frameCount * ESTIMATE_ASSUMPTIONS.inputTokensPerFrame + ESTIMATE_ASSUMPTIONS.promptTokens,
    outputTokens: limits.maxOutputTokens,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  })
}
