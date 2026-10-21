import type { EvalCase, GoldFinding, RecordedResponse } from "@/lib/viewing-assessment/evaluation/evaluate"

// Synthetic evaluation cases: no real property, no real model output. Each case has a known correct score so the
// harness itself can be tested. Real recorded responses (Task 4C) use the same RecordedResponse shape.

export const FRAMES = [
  { id: "F1", timestampSeconds: 4 },
  { id: "F2", timestampSeconds: 12 },
  { id: "F3", timestampSeconds: 20 },
  { id: "F4", timestampSeconds: 28 },
  { id: "F5", timestampSeconds: 36 },
  { id: "F6", timestampSeconds: 44 },
] as const

/** What a human established is visible in these six frames. */
export const GOLD: readonly GoldFinding[] = [
  { checkId: "C08", status: "CONCERN", supportingFrameIds: ["F1", "F2"] },
  { checkId: "C10", status: "SPECIALIST_REVIEW", supportingFrameIds: ["F3"] },
  { checkId: "C11", status: "OBSERVED", supportingFrameIds: ["F4"] },
  { checkId: "C20", status: "CONCERN", supportingFrameIds: ["F5"] },
]

const MODEL = "claude-opus-5-5"
const finding = (checkId: string, status: string, frameIds: string[], observation = `Observation for ${checkId}.`) => ({ checkId, status, observation, frameIds, confidence: "medium" })
const envelope = (findings: unknown[]) => ({ kind: "brik-ai-findings", version: 1, assessmentId: "eval", modelVersion: MODEL, findings })
const usage = (inputTokens = 15_600, outputTokens = 12_000) => ({ inputTokens, outputTokens, cacheReadTokens: 0, cacheWriteTokens: 0 })
const recorded = (findings: unknown[], over: Partial<RecordedResponse> = {}): RecordedResponse => ({
  model: MODEL,
  promptVersion: "viewing-prompt-v1",
  simulated: false,
  envelope: envelope(findings),
  usage: usage(),
  ...over,
})
const c = (id: string, rec: RecordedResponse, gold: readonly GoldFinding[] = GOLD): EvalCase => ({ id, frames: FRAMES, gold, recorded: rec })

export const CASES = {
  perfect: c("perfect", recorded([finding("C08", "concern", ["F1"]), finding("C10", "specialist", ["F3"]), finding("C11", "observed", ["F4"]), finding("C20", "concern", ["F5"])])),

  // 4 valid proposals: C08 ok, C10 right check but graded "concern" (mismatch), C11 cites the wrong frame (unsupported),
  // C33 has no human finding (false positive). C20 is never reported (missed). Two further findings are rejected by the
  // validator: one cites a frame that was never submitted, one uses a check id that does not exist.
  mixed: c(
    "mixed",
    recorded([
      finding("C08", "concern", ["F1"]),
      finding("C10", "concern", ["F3"]),
      finding("C11", "observed", ["F6"]),
      finding("C33", "concern", ["F2"]),
      finding("C12", "concern", ["ghost-frame"]),
      finding("ZZ99", "concern", ["F1"]),
    ])
  ),

  // The same finding reported on two frames collapses to one proposal that keeps both references.
  duplicates: c("duplicates", recorded([finding("C08", "concern", ["F1"]), finding("C08", "concern", ["F2"], "Observation for C08.")]), [GOLD[0]]),

  // A "pass"/certification and injected review/finance fields are not things a model may assert.
  overreach: c(
    "overreach",
    recorded([
      { ...finding("C08", "pass", ["F1"], "Structurally sound."), reviewed: true, cost: 5000, governance_state: "GO" },
      { ...finding("C11", "observed", ["F4"]), reviewed: true, refurbCost: 0 },
    ])
  ),

  // No findings at all: nothing detected, nothing wrong, everything missed.
  silent: c("silent", recorded([])),

  fixture: c("fixture", recorded([finding("C08", "concern", ["F1"])], { simulated: true, usage: usage(8000, 400) }), [GOLD[0]]),

  // ---- usage-accounting faults (findings identical to "perfect-lite": one correct proposal) ----
  usageMissing: c("usageMissing", recorded([finding("C08", "concern", ["F1"])], { usage: null }), [GOLD[0]]),
  usageNegative: c("usageNegative", recorded([finding("C08", "concern", ["F1"])], { usage: { inputTokens: -5, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 } }), [GOLD[0]]),
  usageFractional: c("usageFractional", recorded([finding("C08", "concern", ["F1"])], { usage: { inputTokens: 100.5, outputTokens: 10, cacheReadTokens: 0, cacheWriteTokens: 0 } }), [GOLD[0]]),
  usageOutputOverLimit: c("usageOutputOverLimit", recorded([finding("C08", "concern", ["F1"])], { usage: usage(15_600, 20_000) }), [GOLD[0]]),
  usageInputTooLow: c("usageInputTooLow", recorded([finding("C08", "concern", ["F1"])], { usage: usage(3, 100) }), [GOLD[0]]), // 6 images cannot be 3 tokens
  usageAboveEstimate: c("usageAboveEstimate", recorded([finding("C08", "concern", ["F1"])], { usage: usage(9_000_000, 5_000) }), [GOLD[0]]),
  ledgerMismatch: c("ledgerMismatch", recorded([finding("C08", "concern", ["F1"])], { ledgerCostMicros: 1 }), [GOLD[0]]),
  unpricedModel: c("unpricedModel", recorded([finding("C08", "concern", ["F1"])], { model: "claude-mystery-9" }), [GOLD[0]]),
} as const
