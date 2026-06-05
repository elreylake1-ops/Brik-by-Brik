import { buildInvestorShieldTaskDrafts } from "@/lib/investor-shield/build-investor-shield-task-drafts"
import type { InvestorShieldTaskDraft } from "@/lib/investor-shield/build-investor-shield-task-drafts"
import type { PipelineState } from "@/types/operator-command"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"

export type InvestorShieldMovementDecision = "ALLOW" | "NEEDS_REVIEW" | "BLOCK"

export type InvestorShieldPipelineMovementInput = {
  dealId: string
  currentStage: string
  requestedStage: string
  enforcementResult: InvestorShieldEnforcementResult
  deterministicDealStatus?: string
}

export type InvestorShieldPipelineMovementGuardResult = {
  dealId: string
  currentStage: string
  requestedStage: string
  canMove: boolean
  movementDecision: InvestorShieldMovementDecision
  reasons: string[]
  protectedStage: boolean
  enforcementOverallStatus: InvestorShieldEnforcementResult["overallStatus"]
  enforcementProgressionDecision: InvestorShieldEnforcementResult["progressionDecision"]
  blockingGateKeys: InvestorShieldEnforcementResult["blockingGateKeys"]
  cautionGateKeys: InvestorShieldEnforcementResult["cautionGateKeys"]
  taskDrafts?: readonly InvestorShieldTaskDraft[]
  deterministicDominanceNote?: string
}

const KNOWN_PROTECTED_STAGES: readonly PipelineState[] = [
  "READY_FOR_OFFER",
  "OFFER_SENT",
  "NEGOTIATING",
  "DUE_DILIGENCE",
  "COMPLETED",
] as const

const KNOWN_NON_PROTECTED_STAGES: readonly PipelineState[] = [
  "UNDER_ANALYSIS",
  "FINANCE_REVIEW",
  "REJECTED",
  "ARCHIVED",
] as const

function normalizeStage(stage: string): string {
  return stage.trim().toUpperCase().replace(/[\s-]+/g, "_")
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

export function isInvestorShieldProtectedStage(stage: string): boolean {
  const normalized = normalizeStage(stage)

  if (KNOWN_PROTECTED_STAGES.includes(normalized as PipelineState)) {
    return true
  }

  if (KNOWN_NON_PROTECTED_STAGES.includes(normalized as PipelineState)) {
    return false
  }

  if (
    normalized.includes("INVESTOR_PACK") ||
    normalized.includes("EXCHANGE") ||
    normalized.includes("OFFER") ||
    normalized.includes("DUE_DILIGENCE_COMPLETE") ||
    normalized.endsWith("_COMPLETE") ||
    normalized === "COMPLETE"
  ) {
    return true
  }

  if (
    normalized.includes("UNDER_ANALYSIS") ||
    normalized.includes("DRAFT") ||
    normalized.includes("ANALYSIS") ||
    normalized.includes("REVIEW") ||
    normalized.includes("EVIDENCE") ||
    normalized.includes("NEGOTIATION_PREP")
  ) {
    return false
  }

  return false
}

function buildResult(
  input: InvestorShieldPipelineMovementInput,
  args: {
    movementDecision: InvestorShieldMovementDecision
    reasons: string[]
    protectedStage: boolean
  }
): InvestorShieldPipelineMovementGuardResult {
  const taskDrafts =
    input.enforcementResult.taskRecommendations.length > 0
      ? buildInvestorShieldTaskDrafts(input.enforcementResult)
      : undefined

  return {
    dealId: input.dealId,
    currentStage: input.currentStage,
    requestedStage: input.requestedStage,
    canMove: args.movementDecision === "ALLOW",
    movementDecision: args.movementDecision,
    reasons: args.reasons,
    protectedStage: args.protectedStage,
    enforcementOverallStatus: input.enforcementResult.overallStatus,
    enforcementProgressionDecision: input.enforcementResult.progressionDecision,
    blockingGateKeys: input.enforcementResult.blockingGateKeys,
    cautionGateKeys: input.enforcementResult.cautionGateKeys,
    taskDrafts,
    deterministicDominanceNote: input.enforcementResult.deterministicDominanceNote,
  }
}

export function guardInvestorShieldPipelineMovement(
  input: InvestorShieldPipelineMovementInput
): InvestorShieldPipelineMovementGuardResult {
  const protectedStage = isInvestorShieldProtectedStage(input.requestedStage)
  const enforcement = input.enforcementResult
  const reasons: string[] = []

  if (isDeterministicReject(input.deterministicDealStatus)) {
    reasons.push("DETERMINISTIC_REJECT_DOMINATES")

    if (protectedStage) {
      return buildResult(input, {
        movementDecision: "BLOCK",
        reasons,
        protectedStage,
      })
    }
  }

  if (!protectedStage) {
    if (enforcement.overallStatus === "BLOCKED") {
      reasons.push("INVESTOR_SHIELD_BLOCKED_NON_PROTECTED_STAGE_REVIEW")
      if (enforcement.manualOverrideRequired) {
        reasons.push("MANUAL_OVERRIDE_REQUIRED")
      }
      if (enforcement.advisoryOnlyEvidenceWarnings.length > 0) {
        reasons.push("ADVISORY_ONLY_EVIDENCE_WARNING")
      }

      return buildResult(input, {
        movementDecision: "NEEDS_REVIEW",
        reasons,
        protectedStage,
      })
    }

    if (
      enforcement.overallStatus === "CAUTION" ||
      enforcement.manualOverrideRequired ||
      enforcement.advisoryOnlyEvidenceWarnings.length > 0
    ) {
      reasons.push("INVESTOR_SHIELD_CAUTION_NON_PROTECTED_STAGE")

      return buildResult(input, {
        movementDecision: "NEEDS_REVIEW",
        reasons,
        protectedStage,
      })
    }

    reasons.push("INVESTOR_SHIELD_CLEAR_NON_PROTECTED_STAGE")

    return buildResult(input, {
      movementDecision: "ALLOW",
      reasons,
      protectedStage,
    })
  }

  if (enforcement.manualOverrideRequired) {
    reasons.push("MANUAL_OVERRIDE_REQUIRED")

    return buildResult(input, {
      movementDecision: "BLOCK",
      reasons,
      protectedStage,
    })
  }

  if (
    enforcement.overallStatus === "BLOCKED" ||
    enforcement.progressionDecision === "BLOCKED"
  ) {
    reasons.push("INVESTOR_SHIELD_BLOCKED_PROTECTED_STAGE")

    return buildResult(input, {
      movementDecision: "BLOCK",
      reasons,
      protectedStage,
    })
  }

  if (
    enforcement.overallStatus === "CAUTION" ||
    enforcement.progressionDecision === "NEEDS_REVIEW" ||
    enforcement.advisoryOnlyEvidenceWarnings.length > 0
  ) {
    reasons.push("INVESTOR_SHIELD_CAUTION_PROTECTED_STAGE")
    if (enforcement.advisoryOnlyEvidenceWarnings.length > 0) {
      reasons.push("ADVISORY_ONLY_EVIDENCE_WARNING")
    }

    return buildResult(input, {
      movementDecision: "NEEDS_REVIEW",
      reasons,
      protectedStage,
    })
  }

  reasons.push("INVESTOR_SHIELD_CLEAR_PROTECTED_STAGE")

  return buildResult(input, {
    movementDecision: "ALLOW",
    reasons,
    protectedStage,
  })
}
