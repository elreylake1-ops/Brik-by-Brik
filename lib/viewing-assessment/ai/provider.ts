// Frame-analysis provider contract (Task 4A).
//
// A provider turns submitted frames into an UNTRUSTED findings envelope. It never decides what is stored:
// the envelope always goes through validateAiProposals (known checklist ids, real submitted frame ids,
// enum checks, de-duplication), and everything it yields is an UNVERIFIED, PENDING proposal until a human
// reviews it. Providers have no access to deals, finance, Investor Shield, or the database.

import type { AnalysisProviderId } from "@/types/viewing-assessment"

export type FrameForAnalysis = {
  id: string // the exact evidence id; the ONLY id a finding may cite
  timestampSeconds: number
  room?: string
  jpeg: Uint8Array | null // null for providers that do not look at pixels (fixtures)
}

export type AnalysisLimits = {
  maxFrames: number
  maxOutputTokens: number
  timeoutMs: number
}

export type ProviderUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

export const ZERO_USAGE: ProviderUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }

export type ProviderOutcome =
  | { kind: "ok"; envelope: unknown; usage: ProviderUsage }
  | { kind: "refusal"; usage: ProviderUsage; category?: string } // provider declined; nothing to validate
  | { kind: "timeout" } // aborted by our deadline; usage unknown
  | { kind: "malformed"; usage: ProviderUsage; detail: string } // not JSON, or truncated at max tokens
  | { kind: "error"; detail: string } // network/API failure (status only: never message bodies or keys)

export type AnalysisRequest = {
  assessmentId: string
  frames: readonly FrameForAnalysis[]
  limits: AnalysisLimits
  signal: AbortSignal // aborted when the deadline passes; providers must stop work promptly
}

export type FrameAnalysisProvider = {
  readonly id: AnalysisProviderId
  /** True when results are made up for testing. Simulated usage is free and can never spend the allowance. */
  readonly simulated: boolean
  readonly modelVersion: string
  readonly promptVersion: string
  /** Whether frame pixels are required (and therefore loaded from private storage). */
  readonly needsImages: boolean
  analyse(request: AnalysisRequest): Promise<ProviderOutcome>
}
