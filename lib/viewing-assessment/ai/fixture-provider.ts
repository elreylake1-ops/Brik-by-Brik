import { mockVideoAnalysisService } from "../mock-video-analysis-service"
import { ESTIMATE_ASSUMPTIONS } from "./budget"
import {
  ZERO_USAGE,
  type AnalysisRequest,
  type FrameAnalysisProvider,
  type ProviderOutcome,
  type ProviderUsage,
} from "./provider"

// Fixture-backed analysis for local development and tests. Deterministic, free, offline, and SIMULATED:
// nothing here looks at pixels, and every result it produces is labelled simulated by the system. It exists to
// exercise the whole pipeline (storage -> analysis -> validation -> review) and every failure path without a
// paid provider. The scenarios reproduce the hostile or broken behaviour a real provider could exhibit.

export const FIXTURE_MODEL_VERSION = "fixture-frame-analysis-v1"
export const FIXTURE_PROMPT_VERSION = "fixture-prompt-v1"

export type FixtureScenario =
  | "default" // plausible findings, each citing a real submitted frame
  | "complete_flow" // synthetic findings covering ENGINE_SCOPE (roof C01, bathroom C41) and UNPRICED (facade C08)
  | "refusal" // the provider declines
  | "timeout" // never answers until the deadline aborts it
  | "malformed" // answer is not usable JSON
  | "error" // provider/network failure
  | "phantom_frames" // cites frames that were never submitted
  | "duplicates" // repeats the same finding across frames
  | "overreach" // tries to set review state, status "pass", costs and financial fields

const usageFor = (frames: number, findings: number): ProviderUsage => ({
  inputTokens: frames * ESTIMATE_ASSUMPTIONS.inputTokensPerFrame + ESTIMATE_ASSUMPTIONS.promptTokens,
  outputTokens: 400 * findings,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

export function createFixtureProvider(scenario: FixtureScenario = "default"): FrameAnalysisProvider {
  return {
    id: "fixture",
    simulated: true,
    modelVersion: FIXTURE_MODEL_VERSION,
    promptVersion: FIXTURE_PROMPT_VERSION,
    needsImages: false,

    async analyse({ assessmentId, frames, signal }: AnalysisRequest): Promise<ProviderOutcome> {
      const envelope = (findings: unknown[]) => ({
        kind: "brik-ai-findings",
        version: 1,
        assessmentId,
        modelVersion: FIXTURE_MODEL_VERSION,
        findings,
      })
      const first = frames[0]?.id

      switch (scenario) {
        case "complete_flow": {
          const f0 = frames[0]?.id
          const f1 = frames[1]?.id ?? f0
          const f2 = frames[2]?.id ?? f1 ?? f0
          const findings = [
            {
              checkId: "C01",
              status: "concern" as const,
              observation: "Synthetic observation: slipped roof tiles visible on rear slope.",
              frameIds: [f0],
              confidence: "high" as const,
            },
            {
              checkId: "C41",
              status: "concern" as const,
              observation: "Synthetic observation: damaged sealant and tile cracks around bath.",
              frameIds: [f1],
              confidence: "high" as const,
            },
            {
              checkId: "C08",
              status: "concern" as const,
              observation: "Synthetic observation: cracked exterior render near masonry opening.",
              frameIds: [f2],
              confidence: "medium" as const,
            },
          ]
          return {
            kind: "ok",
            usage: usageFor(frames.length, findings.length),
            envelope: envelope(findings),
          }
        }
        case "refusal":
          return { kind: "refusal", usage: usageFor(frames.length, 0), category: "fixture" }
        case "timeout":
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve()
            else signal.addEventListener("abort", () => resolve(), { once: true })
          })
          return { kind: "timeout" }
        case "malformed":
          return { kind: "malformed", usage: usageFor(frames.length, 0), detail: "response was not valid JSON" }
        case "error":
          return { kind: "error", detail: "fixture provider error (503)" }
        case "phantom_frames":
          return {
            kind: "ok",
            usage: usageFor(frames.length, 2),
            envelope: envelope([
              { checkId: "C08", status: "concern", observation: "Cracked render (cites a frame never submitted).", frameIds: ["ghost-frame"], confidence: "high" },
              { checkId: "C10", status: "observed", observation: "Genuine observation on a real frame.", frameIds: [first], confidence: "low" },
            ]),
          }
        case "duplicates":
          return {
            kind: "ok",
            usage: usageFor(frames.length, 2),
            envelope: envelope(
              frames.slice(0, 2).map((f) => ({ checkId: "C08", status: "concern", observation: "Render appears cracked.", frameIds: [f.id], confidence: "low" }))
            ),
          }
        case "overreach":
          return {
            kind: "ok",
            usage: usageFor(frames.length, 1),
            envelope: envelope([
              {
                checkId: "C08",
                status: "pass", // not a status a model may assert: no "pass"
                observation: "Structure is certified safe.",
                frameIds: [first],
                confidence: "high",
                reviewed: true,
                reviewerId: "model",
                disposition: "ACCEPTED",
                cost: 1_000_000,
                refurbCost: 0,
                governance_state: "GO",
                investorShield: "CLEAR",
              },
              {
                checkId: "C11",
                status: "observed",
                observation: "Window frame visible.",
                frameIds: [first],
                confidence: "low",
                reviewed: true,
                reviewerId: "model",
                governance_state: "GO",
                refurbCost: 0,
              },
            ]),
          }
        default: {
          // Reuse the Task 2 deterministic findings, restated against the submitted frames.
          const base = await mockVideoAnalysisService.analyse({
            assessmentId,
            evidence: frames.map((f) => ({ id: f.id, assetId: "fixture", timestampSeconds: f.timestampSeconds, ...(f.room ? { room: f.room } : {}) })),
          })
          return {
            kind: "ok",
            usage: usageFor(frames.length, base.findings.length),
            envelope: { ...base, modelVersion: FIXTURE_MODEL_VERSION },
          }
        }
      }
    },
  }
}

export { ZERO_USAGE }
