import type { TimeRiskResult } from "@/types/phase2-intelligence"

export function evaluateTimeRisk(
  bridgeTermMonths: number | undefined,
  refurbExposure: number | null
): TimeRiskResult {
  const deductions: string[] = []
  const reviewReasons: string[] = []

  if (bridgeTermMonths === undefined) {
    return {
      severity: "MEDIUM",
      deductions: ["Bridge term not provided; time risk assumed medium."],
      reviewReasons: ["Bridge term is not confirmed."],
      explanation: "Time risk defaults to medium when bridge term is unknown.",
    }
  }

  let severity: TimeRiskResult["severity"] = "LOW"

  if (bridgeTermMonths <= 6) {
    severity = refurbExposure !== null && refurbExposure > 0.3 ? "MEDIUM" : "LOW"
  } else if (bridgeTermMonths <= 12) {
    severity = "MEDIUM"
  } else if (bridgeTermMonths <= 18) {
    severity = "HIGH"
  } else {
    severity = "FATAL"
  }

  if (bridgeTermMonths > 12) {
    deductions.push(`Bridge term of ${bridgeTermMonths} months increases time and finance risk.`)
    reviewReasons.push("Bridge term is longer than preferred range.")
  } else if (bridgeTermMonths > 6) {
    deductions.push(`Bridge term of ${bridgeTermMonths} months is longer than ideal flip timing.`)
    reviewReasons.push("Bridge term is moderate rather than short.")
  }

  if (refurbExposure !== null && refurbExposure > 0.3) {
    deductions.push("Heavy refurb exposure amplifies timeline risk.")
    reviewReasons.push("High refurb exposure may extend the timeline.")
    if (severity === "LOW") severity = "MEDIUM"
  }

  return {
    severity,
    deductions,
    reviewReasons,
    explanation:
      severity === "LOW"
        ? "Time risk is low based on short bridge duration and manageable exposure."
        : severity === "MEDIUM"
          ? "Time risk is moderate due to bridge duration or refurb complexity."
          : severity === "HIGH"
            ? "Time risk is high because the bridge duration is extended."
            : "Time risk is fatal because the bridge duration exceeds safe tolerance.",
  }
}
