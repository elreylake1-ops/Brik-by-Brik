import type { NegotiationPositionResult, Phase2IntelligenceInput } from "@/types/phase2-intelligence"

const NEGOTIATION_SIGNALS = [
  "probate",
  "vacant",
  "reduced",
  "price reduced",
  "chain-free",
  "chain free",
  "auction",
  "repossession",
  "landlord selling",
  "needs work",
  "motivated",
  "must sell",
] as const

function normalizeSignals(signals: string[] | undefined): string[] {
  return (signals ?? []).map((signal) => signal.trim().toLowerCase())
}

export function evaluateNegotiationPosition(
  input: Phase2IntelligenceInput
): NegotiationPositionResult {
  const motivationSignals = normalizeSignals(input.motivationSignals)
  const listingSignals = normalizeSignals(input.listingSignals)
  const allSignals = [...motivationSignals, ...listingSignals]

  const matchedSignals = NEGOTIATION_SIGNALS.filter((signal) =>
    allSignals.some((entry) => entry.includes(signal))
  )

  const urgencySignals = ["hot", "urgent", "fast sale", "must go"]
  const unsupportedUrgency =
    urgencySignals.some((signal) => listingSignals.some((entry) => entry.includes(signal))) &&
    matchedSignals.length === 0

  const strength: NegotiationPositionResult["strength"] =
    matchedSignals.length >= 2 ? "STRONG" : matchedSignals.length === 1 ? "NEUTRAL" : "WEAK"

  const heatModifier =
    matchedSignals.length >= 3
      ? 8
      : matchedSignals.length === 2
        ? 6
        : matchedSignals.length === 1
          ? 3
          : 0

  return {
    strength,
    matchedSignals,
    unsupportedUrgency,
    heatModifier: unsupportedUrgency ? heatModifier - 4 : heatModifier,
    explanation:
      matchedSignals.length > 0
        ? `Negotiation position strengthened by seller/listing signals: ${matchedSignals.join(", ")}.`
        : unsupportedUrgency
          ? "Urgency language appears unsupported by concrete seller motivation."
          : "No credible seller-motivation edge identified.",
  }
}
