import type { TaskPriority, TaskStatus, TaskType } from "@/types/operator-command"
import type {
  InvestorShieldEnforcementResult,
  InvestorShieldTaskRecommendation,
} from "@/types/investor-shield-enforcement"

export type InvestorShieldTaskDraft = {
  dealId: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  taskType: TaskType
  source: "investor_shield"
  gateKey: InvestorShieldTaskRecommendation["gateKey"]
  subGateKey?: InvestorShieldTaskRecommendation["subGateKey"]
  idempotencyKey: string
}

function mapSeverityToPriority(
  severity: InvestorShieldTaskRecommendation["severity"]
): TaskPriority {
  if (severity === "FATAL" || severity === "BLOCKER") {
    return "HIGH"
  }

  if (severity === "CAUTION") {
    return "MEDIUM"
  }

  return "LOW"
}

function mapRecommendationTypeToTaskType(
  type: InvestorShieldTaskRecommendation["type"]
): TaskType {
  if (type === "REVIEW_LENDER_CRITERIA") {
    return "FINANCE_REVIEW"
  }

  if (type === "REVIEW_GATE") {
    return "MANUAL_REVIEW"
  }

  if (type === "OBTAIN_BUILDER_CONTRACT") {
    return "BLOCKER"
  }

  return "EVIDENCE"
}

function buildDescription(recommendation: InvestorShieldTaskRecommendation): string {
  const gateText = recommendation.subGateKey
    ? `${recommendation.gateKey} / ${recommendation.subGateKey}`
    : recommendation.gateKey

  return `${recommendation.reason} Source: ${recommendation.source}. Investor Shield gate: ${gateText}.`
}

function buildDraft(
  dealId: string,
  recommendation: InvestorShieldTaskRecommendation
): InvestorShieldTaskDraft {
  return {
    dealId,
    title: recommendation.title,
    description: buildDescription(recommendation),
    status: "OPEN",
    priority: mapSeverityToPriority(recommendation.severity),
    taskType: mapRecommendationTypeToTaskType(recommendation.type),
    source: "investor_shield",
    gateKey: recommendation.gateKey,
    subGateKey: recommendation.subGateKey,
    idempotencyKey: recommendation.idempotencyKey,
  }
}

export function buildInvestorShieldTaskDrafts(
  result: InvestorShieldEnforcementResult
): InvestorShieldTaskDraft[] {
  const draftsByKey = new Map<string, InvestorShieldTaskDraft>()

  for (const recommendation of result.taskRecommendations) {
    if (!draftsByKey.has(recommendation.idempotencyKey)) {
      draftsByKey.set(
        recommendation.idempotencyKey,
        buildDraft(result.dealId, recommendation)
      )
    }
  }

  return [...draftsByKey.values()]
}
