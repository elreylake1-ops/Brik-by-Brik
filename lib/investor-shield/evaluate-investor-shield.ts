import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import type {
  InvestorShieldEnforcementResult,
  InvestorShieldEvaluationInput,
  InvestorShieldTaskRecommendation,
  InvestorShieldTaskRecommendationType,
} from "@/types/investor-shield-enforcement"
import type {
  EvidenceItem,
  InvestorShieldCheck,
  InvestorShieldEvidenceType,
  InvestorShieldGateDefinition,
  InvestorShieldGateKey,
  InvestorShieldSeverity,
  ManualOverride,
} from "@/types/investor-shield"

const BLOCKING_SEVERITIES: readonly InvestorShieldSeverity[] = ["BLOCKER", "FATAL"] as const
const ADVISORY_SOURCES = new Set(["ai_advisory"])
const REFURB_HARD_EVIDENCE_TYPES = new Set<InvestorShieldEvidenceType>([
  "ROOM_MEASUREMENT",
  "BUILDER_QUOTE",
  "BUILDER_PROPOSAL",
  "BUILDER_CONTRACT",
  "SPECIALIST_SURVEY",
  "PLANNING_DOCUMENT",
  "BUILDING_CONTROL_DOCUMENT",
  "TITLE_DOCUMENT",
  "LEASE_DOCUMENT",
  "LENDER_CRITERIA",
  "SOLICITOR_FEEDBACK",
])

function hasBlockingSeverity(severity: InvestorShieldSeverity): boolean {
  return BLOCKING_SEVERITIES.includes(severity)
}

function isDeterministicReject(status?: string): boolean {
  if (!status) {
    return false
  }

  const normalized = status.trim().toUpperCase()
  return (
    normalized === "REJECT" ||
    normalized === "NO-GO" ||
    normalized === "NO_GO" ||
    normalized === "NOGO" ||
    normalized.includes("REJECT") ||
    normalized.includes("NO-GO") ||
    normalized.includes("NO_GO")
  )
}

function isAdvisoryEvidence(item: EvidenceItem): boolean {
  return item.advisoryOnly === true || ADVISORY_SOURCES.has(item.source)
}

function hasNonAdvisoryEvidence(items: readonly EvidenceItem[], evidenceTypes: readonly InvestorShieldEvidenceType[]) {
  return items.some(
    (item) => evidenceTypes.includes(item.evidenceType) && !isAdvisoryEvidence(item)
  )
}

function hasRefurbHardEvidence(items: readonly EvidenceItem[]): boolean {
  return items.some(
    (item) => REFURB_HARD_EVIDENCE_TYPES.has(item.evidenceType) && !isAdvisoryEvidence(item)
  )
}

function hasManualOverrideReason(
  gateKey: InvestorShieldGateKey,
  manualOverrides: readonly ManualOverride[]
): boolean {
  return manualOverrides.some(
    (override) => override.gateKey === gateKey && typeof override.reason === "string" && override.reason.trim().length > 0
  )
}

function pushUnique(values: InvestorShieldGateKey[], value: InvestorShieldGateKey) {
  if (!values.includes(value)) {
    values.push(value)
  }
}

function pushUniqueText(values: string[], value: string) {
  if (!values.includes(value)) {
    values.push(value)
  }
}

function buildTaskRecommendation(
  dealId: string,
  gate: InvestorShieldGateDefinition,
  type: InvestorShieldTaskRecommendationType,
  reason: string,
  subGateKey?: InvestorShieldCheck["subGateKey"]
): InvestorShieldTaskRecommendation {
  const titleByType: Record<InvestorShieldTaskRecommendationType, string> = {
    REQUEST_EVIDENCE: "Request evidence",
    REVIEW_GATE: "Review gate",
    OBTAIN_BUILDER_QUOTE: "Obtain builder quote",
    OBTAIN_BUILDER_CONTRACT: "Obtain builder contract",
    REQUEST_SPECIALIST_SURVEY: "Request specialist survey",
    REVIEW_SOLICITOR_FEEDBACK: "Review solicitor feedback",
    VERIFY_RENTAL_DEMAND: "Verify rental demand",
    REVIEW_LENDER_CRITERIA: "Review lender criteria",
  }

  return {
    gateKey: gate.key,
    subGateKey,
    type,
    title: titleByType[type],
    reason,
    severity: gate.defaultSeverity,
    source: "system_default",
    idempotencyKey: `investor-shield:${dealId}:${gate.key}:${type}`,
  }
}

function getRecommendationType(
  gate: InvestorShieldGateDefinition,
  check?: InvestorShieldCheck
): InvestorShieldTaskRecommendationType {
  if (gate.key === "REFURB_CERTAINTY") {
    if (check?.subGateKey === "SPECIALIST_SURVEY_EVIDENCE") {
      return "REQUEST_SPECIALIST_SURVEY"
    }

    return "OBTAIN_BUILDER_QUOTE"
  }

  if (gate.key === "BUILDER_PROPOSAL_CONTRACT") {
    return "OBTAIN_BUILDER_CONTRACT"
  }

  if (gate.key === "SOLICITOR_FEEDBACK") {
    return "REVIEW_SOLICITOR_FEEDBACK"
  }

  if (gate.key === "RENTAL_DEMAND") {
    return "VERIFY_RENTAL_DEMAND"
  }

  if (gate.key === "LENDER_CRITERIA") {
    return "REVIEW_LENDER_CRITERIA"
  }

  return "REQUEST_EVIDENCE"
}

function buildGateRecommendation(
  dealId: string,
  gate: InvestorShieldGateDefinition,
  reason: string,
  check?: InvestorShieldCheck
) {
  return buildTaskRecommendation(
    dealId,
    gate,
    getRecommendationType(gate, check),
    reason,
    check?.subGateKey
  )
}

export function evaluateInvestorShield(
  input: InvestorShieldEvaluationInput
): InvestorShieldEnforcementResult {
  const blockingGateKeys: InvestorShieldGateKey[] = []
  const cautionGateKeys: InvestorShieldGateKey[] = []
  const missingEvidenceGateKeys: InvestorShieldGateKey[] = []
  const advisoryOnlyEvidenceWarnings: string[] = []
  const taskRecommendations: InvestorShieldTaskRecommendation[] = []
  const blockingReasons: InvestorShieldEnforcementResult["blockingReasons"] extends readonly (infer T)[]
    ? T[]
    : never = []

  for (const gate of INVESTOR_SHIELD_DEFAULT_GATES) {
    const checks = input.checks.filter(
      (check) => check.gateKey === gate.key && check.dealId === input.dealId
    )
    const topLevelCheck = checks.find((check) => check.subGateKey == null) ?? checks[0]
    const evidenceItems = input.evidenceItems.filter(
      (item) => item.gateKey === gate.key && item.dealId === input.dealId
    )
    const hasOverrideReason = hasManualOverrideReason(gate.key, input.manualOverrides)
    const hardEvidencePresent = hasNonAdvisoryEvidence(evidenceItems, gate.evidenceTypes)
    const advisoryOnlyEvidencePresent =
      evidenceItems.length > 0 && evidenceItems.every((item) => isAdvisoryEvidence(item))
    const refurbHardEvidencePresent =
      gate.key !== "REFURB_CERTAINTY" ? true : hasRefurbHardEvidence(evidenceItems)

    if (advisoryOnlyEvidencePresent && evidenceItems.length > 0) {
      advisoryOnlyEvidenceWarnings.push(
        `${gate.key}: advisory-only evidence can support review but cannot satisfy hard evidence alone.`
      )
    }

    if (!topLevelCheck) {
      pushUnique(missingEvidenceGateKeys, gate.key)
      taskRecommendations.push(
        buildGateRecommendation(input.dealId, gate, `${gate.label} has no evaluation check yet.`)
      )

      if (hasBlockingSeverity(gate.defaultSeverity)) {
        pushUnique(blockingGateKeys, gate.key)
        pushUniqueText(blockingReasons, "REQUIRED_GATE_MISSING")
      } else {
        pushUnique(cautionGateKeys, gate.key)
      }

      continue
    }

    if (topLevelCheck.status === "SATISFIED") {
      if (advisoryOnlyEvidencePresent && !hardEvidencePresent) {
        pushUnique(blockingGateKeys, gate.key)
        pushUnique(missingEvidenceGateKeys, gate.key)
        pushUniqueText(blockingReasons, "ADVISORY_ONLY_EVIDENCE_INSUFFICIENT")
      }

      if (gate.key === "REFURB_CERTAINTY" && !refurbHardEvidencePresent) {
        pushUnique(blockingGateKeys, gate.key)
        pushUnique(missingEvidenceGateKeys, gate.key)
        pushUniqueText(blockingReasons, "REFURB_CERTAINTY_INSUFFICIENT")
      }

      continue
    }

    if (topLevelCheck.status === "FAILED") {
      if (hasBlockingSeverity(topLevelCheck.severity)) {
        pushUnique(blockingGateKeys, gate.key)
        pushUniqueText(blockingReasons, "BLOCKER_GATE_FAILED")
      } else {
        pushUnique(cautionGateKeys, gate.key)
      }

      taskRecommendations.push(
        buildGateRecommendation(
          input.dealId,
          gate,
          `${gate.label} failed and requires follow-up review or evidence.`,
          topLevelCheck
        )
      )
      continue
    }

    if (topLevelCheck.status === "WEAK") {
      pushUnique(cautionGateKeys, gate.key)
      taskRecommendations.push(
        buildGateRecommendation(
          input.dealId,
          gate,
          `${gate.label} is weak and needs stronger supporting evidence.`,
          topLevelCheck
        )
      )

      if (gate.key === "REFURB_CERTAINTY" && !refurbHardEvidencePresent) {
        pushUnique(blockingGateKeys, gate.key)
        pushUnique(missingEvidenceGateKeys, gate.key)
        pushUniqueText(blockingReasons, "REFURB_CERTAINTY_INSUFFICIENT")
      }

      continue
    }

    if (topLevelCheck.status === "WAIVED") {
      pushUnique(cautionGateKeys, gate.key)

      if (!hasOverrideReason) {
        pushUniqueText(blockingReasons, "MANUAL_OVERRIDE_REQUIRED")
        pushUnique(blockingGateKeys, gate.key)
      }

      taskRecommendations.push(
        buildTaskRecommendation(
          input.dealId,
          gate,
          "REVIEW_GATE",
          `${gate.label} was waived and requires manual justification review.`,
          topLevelCheck.subGateKey
        )
      )
      continue
    }

    if (topLevelCheck.status === "REQUIRED" || topLevelCheck.status === "NOT_STARTED") {
      pushUnique(missingEvidenceGateKeys, gate.key)
      taskRecommendations.push(
        buildGateRecommendation(
          input.dealId,
          gate,
          `${gate.label} is still awaiting required evidence.`,
          topLevelCheck
        )
      )

      if (hasBlockingSeverity(topLevelCheck.severity)) {
        pushUnique(blockingGateKeys, gate.key)
        pushUniqueText(blockingReasons, "REQUIRED_GATE_MISSING")
      } else {
        pushUnique(cautionGateKeys, gate.key)
      }

      if (gate.key === "REFURB_CERTAINTY" && !refurbHardEvidencePresent) {
        pushUniqueText(blockingReasons, "REFURB_CERTAINTY_INSUFFICIENT")
      }

      continue
    }

    if (topLevelCheck.status === "IN_PROGRESS") {
      pushUnique(cautionGateKeys, gate.key)
    }
  }

  const hasFatalRiskFlag = input.riskFlags.some(
    (flag) => flag.dealId === input.dealId && flag.severity === "FATAL"
  )

  if (hasFatalRiskFlag) {
    pushUniqueText(blockingReasons, "FATAL_RISK_FLAG")
  }

  const deterministicReject = isDeterministicReject(input.deterministicDealStatus)
  if (deterministicReject) {
    pushUniqueText(blockingReasons, "DETERMINISTIC_REJECT_DOMINATES")
  }

  const manualOverrideRequired = blockingReasons.includes("MANUAL_OVERRIDE_REQUIRED")
  const hasBlockingReason =
    blockingGateKeys.length > 0 || hasFatalRiskFlag || deterministicReject

  const overallStatus = deterministicReject || hasBlockingReason
    ? "BLOCKED"
    : cautionGateKeys.length > 0 ||
        missingEvidenceGateKeys.length > 0 ||
        advisoryOnlyEvidenceWarnings.length > 0 ||
        manualOverrideRequired
      ? "CAUTION"
      : "CLEAR"

  return {
    dealId: input.dealId,
    overallStatus,
    progressionDecision:
      overallStatus === "BLOCKED"
        ? "BLOCKED"
        : overallStatus === "CAUTION"
          ? "NEEDS_REVIEW"
          : "CAN_PROGRESS",
    canProgress: overallStatus === "CLEAR",
    blockingGateKeys,
    cautionGateKeys,
    missingEvidenceGateKeys,
    manualOverrideRequired,
    advisoryOnlyEvidenceWarnings,
    taskRecommendations,
    blockingReasons,
    deterministicDominanceNote: deterministicReject
      ? "Investor Shield may add caution or blocking, but it cannot soften deterministic rejection."
      : undefined,
    evaluatedAt: input.evaluatedAt,
  }
}
