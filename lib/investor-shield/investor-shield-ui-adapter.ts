import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import type {
  InvestorShieldEnforcementResult,
  InvestorShieldTaskRecommendation,
} from "@/types/investor-shield-enforcement"
import type {
  EvidenceItem,
  InvestorShieldCheck,
  InvestorShieldConfidence,
  InvestorShieldGateKey,
  InvestorShieldSeverity,
  InvestorShieldStatus,
  InvestorShieldSubGateKey,
} from "@/types/investor-shield"

type InvestorShieldRequiredLabel = "Required" | "Advisory"
type InvestorShieldTaskPriority = "HIGH" | "MEDIUM" | "LOW"

export type InvestorShieldTaskRecommendationUiSummary = {
  title: string
  reason: string
  gateKey: InvestorShieldTaskRecommendation["gateKey"]
  subGateKey?: InvestorShieldTaskRecommendation["subGateKey"]
  severity: InvestorShieldTaskRecommendation["severity"]
  priority: InvestorShieldTaskPriority
  source: InvestorShieldTaskRecommendation["source"]
}

export type InvestorShieldSubGateUiSummary = {
  key: InvestorShieldSubGateKey
  label: string
  description: string
  requiredLabel: InvestorShieldRequiredLabel
  status: InvestorShieldStatus
  severity: InvestorShieldSeverity
  confidence: InvestorShieldConfidence
  evidenceCount: number
  missingEvidenceSummary: readonly string[]
  shortExplanation: string
  recommendedNextAction?: string
  advisoryOnly: boolean
  updatedAt?: string
}

export type InvestorShieldGateUiSummary = {
  key: InvestorShieldGateKey
  label: string
  description: string
  requiredLabel: InvestorShieldRequiredLabel
  status: InvestorShieldStatus
  severity: InvestorShieldSeverity
  confidence: InvestorShieldConfidence
  evidenceCount: number
  missingEvidenceSummary: readonly string[]
  shortExplanation: string
  recommendedNextAction?: string
  advisoryOnly: boolean
  updatedAt?: string
  subGates?: readonly InvestorShieldSubGateUiSummary[]
}

export type InvestorShieldUiModel = {
  dealId: string
  overallStatus: InvestorShieldEnforcementResult["overallStatus"]
  progressionDecision: InvestorShieldEnforcementResult["progressionDecision"]
  canProgress: boolean
  gateSummaries: readonly InvestorShieldGateUiSummary[]
  blockingGateKeys: InvestorShieldEnforcementResult["blockingGateKeys"]
  cautionGateKeys: InvestorShieldEnforcementResult["cautionGateKeys"]
  missingEvidenceGateKeys: InvestorShieldEnforcementResult["missingEvidenceGateKeys"]
  advisoryWarnings: readonly string[]
  manualOverrideRequired: boolean
  taskRecommendations: readonly InvestorShieldTaskRecommendationUiSummary[]
  protectedMovementExplanation?: string
}

type BuildInvestorShieldUiModelInput = {
  dealId: string
  checks: readonly InvestorShieldCheck[]
  evidenceItems: readonly EvidenceItem[]
  enforcementResult: InvestorShieldEnforcementResult
}

const SUB_GATE_METADATA: Record<
  InvestorShieldSubGateKey,
  {
    label: string
    description: string
    evidenceTypes: readonly EvidenceItem["evidenceType"][]
    advisoryOnly: boolean
  }
> = {
  MEDIA_EVIDENCE_PACK: {
    label: "Media Evidence Pack",
    description:
      "Media evidence should document the current condition clearly enough to support refurbishment review.",
    evidenceTypes: ["REFURB_PHOTO", "REFURB_VIDEO"],
    advisoryOnly: false,
  },
  ROOM_MEASUREMENT_SCHEDULE: {
    label: "Room Measurement Schedule",
    description:
      "Room-by-room measurements should support scope clarity, valuation assumptions, and refurbishment planning.",
    evidenceTypes: ["ROOM_MEASUREMENT"],
    advisoryOnly: false,
  },
  AI_VISUAL_REVIEW_ADVISORY: {
    label: "AI Visual Review Advisory",
    description:
      "AI visual review may support human review, but it cannot replace builder, professional, document, or measurement evidence.",
    evidenceTypes: [],
    advisoryOnly: true,
  },
  BUILDER_QUOTE_EVIDENCE: {
    label: "Builder Quote Evidence",
    description:
      "Builder pricing and scope evidence should support refurbishment certainty before progression.",
    evidenceTypes: ["BUILDER_QUOTE", "BUILDER_PROPOSAL", "BUILDER_CONTRACT"],
    advisoryOnly: false,
  },
  SPECIALIST_SURVEY_EVIDENCE: {
    label: "Specialist Survey Evidence",
    description:
      "Specialist survey evidence should support material condition, risk, or scope assumptions where relevant.",
    evidenceTypes: ["SPECIALIST_SURVEY"],
    advisoryOnly: false,
  },
}

function mapSeverityToPriority(severity: InvestorShieldSeverity): InvestorShieldTaskPriority {
  if (severity === "FATAL" || severity === "BLOCKER") {
    return "HIGH"
  }

  if (severity === "CAUTION") {
    return "MEDIUM"
  }

  return "LOW"
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)]
}

function buildMissingEvidenceSummary(
  expectedEvidence: readonly EvidenceItem["evidenceType"][],
  evidenceItems: readonly EvidenceItem[]
): readonly string[] {
  if (expectedEvidence.length === 0) {
    return []
  }

  const presentEvidence = new Set(evidenceItems.map((item) => item.evidenceType))
  return expectedEvidence.filter((type) => !presentEvidence.has(type))
}

function buildShortExplanation(
  summary: string | undefined,
  fallbackDescription: string,
  status: InvestorShieldStatus
): string {
  if (summary && summary.trim().length > 0) {
    return summary.trim()
  }

  if (status === "REQUIRED" || status === "NOT_STARTED") {
    return `Required evidence is still outstanding. ${fallbackDescription}`
  }

  if (status === "WEAK") {
    return `Current evidence is weak. ${fallbackDescription}`
  }

  if (status === "FAILED") {
    return `This gate is currently failed. ${fallbackDescription}`
  }

  if (status === "WAIVED") {
    return `This gate is currently waived and requires traceable review. ${fallbackDescription}`
  }

  return fallbackDescription
}

function findNextAction(
  recommendations: readonly InvestorShieldTaskRecommendation[],
  gateKey: InvestorShieldGateKey,
  subGateKey?: InvestorShieldSubGateKey
): string | undefined {
  return recommendations.find(
    (recommendation) =>
      recommendation.gateKey === gateKey &&
      recommendation.subGateKey === subGateKey
  )?.title
}

function buildTaskRecommendationUiSummary(
  recommendation: InvestorShieldTaskRecommendation
): InvestorShieldTaskRecommendationUiSummary {
  return {
    title: recommendation.title,
    reason: recommendation.reason,
    gateKey: recommendation.gateKey,
    subGateKey: recommendation.subGateKey,
    severity: recommendation.severity,
    priority: mapSeverityToPriority(recommendation.severity),
    source: recommendation.source,
  }
}

export function buildInvestorShieldUiModel(
  input: BuildInvestorShieldUiModelInput
): InvestorShieldUiModel {
  const checks = [...input.checks]
  const evidenceItems = [...input.evidenceItems]
  const taskRecommendations = input.enforcementResult.taskRecommendations.map(
    buildTaskRecommendationUiSummary
  )

  const gateSummaries = INVESTOR_SHIELD_DEFAULT_GATES.map((gate) => {
    const gateChecks = checks.filter(
      (check) => check.dealId === input.dealId && check.gateKey === gate.key
    )
    const topLevelCheck = gateChecks.find((check) => check.subGateKey == null)
    const gateEvidenceItems = evidenceItems.filter(
      (item) => item.dealId === input.dealId && item.gateKey === gate.key
    )
    const expectedEvidence = topLevelCheck?.requiredEvidence ?? gate.evidenceTypes

    const subGates = gate.subGates?.map((subGateKey) => {
      const subGateCheck = gateChecks.find((check) => check.subGateKey === subGateKey)
      const subGateEvidenceItems = gateEvidenceItems.filter(
        (item) => item.subGateKey === subGateKey
      )
      const metadata = SUB_GATE_METADATA[subGateKey]
      const missingEvidenceSummary = buildMissingEvidenceSummary(
        subGateCheck?.requiredEvidence ?? metadata.evidenceTypes,
        subGateEvidenceItems
      )

      return {
        key: subGateKey,
        label: metadata.label,
        description: metadata.description,
        requiredLabel: metadata.advisoryOnly ? "Advisory" : "Required",
        status: subGateCheck?.status ?? "NOT_STARTED",
        severity: subGateCheck?.severity ?? gate.defaultSeverity,
        confidence: subGateCheck?.confidence ?? "UNKNOWN",
        evidenceCount: subGateEvidenceItems.length,
        missingEvidenceSummary,
        shortExplanation: buildShortExplanation(
          subGateCheck?.summary,
          metadata.description,
          subGateCheck?.status ?? "NOT_STARTED"
        ),
        recommendedNextAction: findNextAction(
          input.enforcementResult.taskRecommendations,
          gate.key,
          subGateKey
        ),
        advisoryOnly: metadata.advisoryOnly,
        updatedAt: subGateCheck?.updatedAt,
      } satisfies InvestorShieldSubGateUiSummary
    })

    return {
      key: gate.key,
      label: gate.label,
      description: gate.description,
      requiredLabel: "Required",
      status: topLevelCheck?.status ?? "NOT_STARTED",
      severity: topLevelCheck?.severity ?? gate.defaultSeverity,
      confidence: topLevelCheck?.confidence ?? "UNKNOWN",
      evidenceCount: gateEvidenceItems.length,
      missingEvidenceSummary: buildMissingEvidenceSummary(
        expectedEvidence,
        gateEvidenceItems
      ),
      shortExplanation: buildShortExplanation(
        topLevelCheck?.summary,
        gate.description,
        topLevelCheck?.status ?? "NOT_STARTED"
      ),
      recommendedNextAction: findNextAction(
        input.enforcementResult.taskRecommendations,
        gate.key
      ),
      advisoryOnly: gate.advisoryOnly === true,
      updatedAt: topLevelCheck?.updatedAt,
      subGates,
    } satisfies InvestorShieldGateUiSummary
  })

  return {
    dealId: input.dealId,
    overallStatus: input.enforcementResult.overallStatus,
    progressionDecision: input.enforcementResult.progressionDecision,
    canProgress: input.enforcementResult.canProgress,
    gateSummaries,
    blockingGateKeys: [...input.enforcementResult.blockingGateKeys],
    cautionGateKeys: [...input.enforcementResult.cautionGateKeys],
    missingEvidenceGateKeys: [...input.enforcementResult.missingEvidenceGateKeys],
    advisoryWarnings: uniqueStrings(input.enforcementResult.advisoryOnlyEvidenceWarnings),
    manualOverrideRequired: input.enforcementResult.manualOverrideRequired,
    taskRecommendations,
    protectedMovementExplanation: input.enforcementResult.deterministicDominanceNote,
  }
}
