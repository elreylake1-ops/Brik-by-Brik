import Anthropic from "@anthropic-ai/sdk"
import { VIEWING_CHECKLIST_V1 } from "../checklist-v1"
import { createClaudeProvider, type ClaudeClient } from "./claude-provider"
import { createFixtureProvider, type FixtureScenario } from "./fixture-provider"
import { hasPrice } from "./pricing"
import type { FrameAnalysisProvider } from "./provider"

// Chooses the analysis provider from configuration. Everything paid is OFF unless every condition is met:
//
//   VIEWING_AI_PROVIDER unset or "fixture"  -> free simulated fixture (refused in a deployed environment unless
//                                              VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION=true)
//   VIEWING_AI_PROVIDER = "claude"          -> needs ALL of:
//        VIEWING_AI_ENABLED=true               explicit opt-in
//        ANTHROPIC_API_KEY present             (only its presence is checked here; the SDK reads the value itself)
//        VIEWING_AI_MODEL with a verified price (unpriced model => budget cannot be enforced => refused)
//        VIEWING_CHECKLIST_WORDING_APPROVED=true  third-party wording is not sent to any service until cleared
//   anything else                           -> unavailable
//
// The result lists unmet requirements by NAME only; it never echoes a value.

export type ProviderSelection =
  | { ok: true; provider: FrameAnalysisProvider }
  | { ok: false; reasons: string[] }

const SCENARIOS: readonly FixtureScenario[] = ["default", "complete_flow", "refusal", "timeout", "malformed", "error", "phantom_frames", "duplicates", "overreach"]

export function selectAnalysisProvider(
  env: Record<string, string | undefined> = process.env,
  deps: { client?: ClaudeClient } = {}
): ProviderSelection {
  const which = env.VIEWING_AI_PROVIDER?.trim() || "fixture"

  if (which === "fixture") {
    if (env.NODE_ENV === "production" && env.VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION !== "true") {
      return { ok: false, reasons: ["fixture analysis is not available in a deployed environment (VIEWING_AI_ALLOW_FIXTURE_IN_PRODUCTION)"] }
    }
    const scenario = (env.VIEWING_AI_FIXTURE_SCENARIO ?? "default") as FixtureScenario
    if (!SCENARIOS.includes(scenario)) return { ok: false, reasons: ["VIEWING_AI_FIXTURE_SCENARIO is not a known scenario"] }
    return { ok: true, provider: createFixtureProvider(scenario) }
  }

  if (which === "claude") {
    const reasons: string[] = []
    if (env.VIEWING_AI_ENABLED !== "true") reasons.push("VIEWING_AI_ENABLED is not true")
    if (!deps.client && !env.ANTHROPIC_API_KEY) reasons.push("ANTHROPIC_API_KEY is not set")
    const model = env.VIEWING_AI_MODEL?.trim()
    if (!model) reasons.push("VIEWING_AI_MODEL is not set")
    else if (!hasPrice(model)) reasons.push("VIEWING_AI_MODEL has no verified price")
    if (env.VIEWING_CHECKLIST_WORDING_APPROVED !== "true") reasons.push("VIEWING_CHECKLIST_WORDING_APPROVED is not true (checklist reuse rights unconfirmed)")
    if (reasons.length > 0 || !model) return { ok: false, reasons }

    // Client construction does not touch the network. A test passes a fake; production code lets the SDK read its key.
    const client = deps.client ?? (new Anthropic() as unknown as ClaudeClient)
    return { ok: true, provider: createClaudeProvider({ client, model, checklist: VIEWING_CHECKLIST_V1 }) }
  }

  return { ok: false, reasons: ["VIEWING_AI_PROVIDER is not a known provider"] }
}
