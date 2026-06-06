import { NextResponse } from "next/server"
import {
  guardInvestorShieldPipelineMovement,
  isInvestorShieldProtectedStage,
} from "@/lib/investor-shield/guard-investor-shield-pipeline-movement"
import { loadAndEvaluateInvestorShield } from "@/lib/investor-shield/investor-shield-read-model"
import { evaluateOperatorGuard } from "@/lib/operator-command/evaluate-operator-guard"
import {
  getSavedDealById,
  updateSavedDealPipelineState,
} from "@/lib/operator-command/saved-deals-repository"
import type { PipelineState } from "@/types/operator-command"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

const PIPELINE_STATES: readonly PipelineState[] = [
  "UNDER_ANALYSIS",
  "READY_FOR_OFFER",
  "OFFER_SENT",
  "NEGOTIATING",
  "DUE_DILIGENCE",
  "FINANCE_REVIEW",
  "COMPLETED",
  "REJECTED",
  "ARCHIVED",
]

function isPipelineState(value: unknown): value is PipelineState {
  return typeof value === "string" && PIPELINE_STATES.includes(value as PipelineState)
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const params = await context.params
    const id = params?.id?.trim()
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Invalid saved deal id." },
        { status: 400 }
      )
    }

    const body = await request.json().catch(() => null)
    const requestedPipelineState = body?.requested_pipeline_state

    if (!isPipelineState(requestedPipelineState)) {
      return NextResponse.json(
        { success: false, error: "Invalid requested pipeline state." },
        { status: 400 }
      )
    }

    const savedDeal = await getSavedDealById(id)
    if (!savedDeal) {
      return NextResponse.json(
        { success: false, error: "Saved deal not found." },
        { status: 404 }
      )
    }

    const guard = evaluateOperatorGuard({
      deal_id: savedDeal.id,
      current_pipeline_state: savedDeal.pipeline_state as PipelineState,
      requested_pipeline_state: requestedPipelineState,
      governance_state: savedDeal.governance_state as
        | "REJECT"
        | "FATAL"
        | "MANUAL_REVIEW_REQUIRED"
        | "CONDITIONAL"
        | "STRONG_OPPORTUNITY"
        | "UNKNOWN_CONFLICT",
      classification: savedDeal.classification,
      workflow_action: "MOVE_PIPELINE_STATE",
      has_manual_review_task: false,
      has_blocking_tasks: false,
      has_missing_evidence: false,
      offer_amount: null,
      max_safe_offer: null,
      notes: null,
    })

    const shouldBlock =
      !guard.allowed ||
      guard.decision === "BLOCK" ||
      guard.decision === "REQUIRE_REVIEW" ||
      guard.decision === "REQUIRE_TASK"

    if (shouldBlock) {
      return NextResponse.json(
        {
          success: false,
          allowed: false,
          guard,
          error: guard.block_message ?? "Pipeline movement is blocked by governance guard.",
        },
        { status: 409 }
      )
    }

    let investorShieldGuard:
      | ReturnType<typeof guardInvestorShieldPipelineMovement>
      | undefined

    try {
      const enforcementResult = await loadAndEvaluateInvestorShield(savedDeal.id, {
        deterministicDealStatus: savedDeal.governance_state,
      })

      investorShieldGuard = guardInvestorShieldPipelineMovement({
        dealId: savedDeal.id,
        currentStage: savedDeal.pipeline_state,
        requestedStage: requestedPipelineState,
        enforcementResult,
        deterministicDealStatus: savedDeal.governance_state,
      })
    } catch {
      if (isInvestorShieldProtectedStage(requestedPipelineState)) {
        return NextResponse.json(
          {
            success: false,
            allowed: false,
            guard: {
              ...guard,
              investor_shield: {
                movementDecision: "BLOCK",
                protectedStage: true,
                reasons: ["INVESTOR_SHIELD_EVALUATION_FAILED"],
              },
            },
            error: "Pipeline movement is blocked pending Investor Shield review.",
          },
          { status: 409 }
        )
      }
    }

    if (
      investorShieldGuard &&
      (investorShieldGuard.movementDecision === "BLOCK" ||
        investorShieldGuard.movementDecision === "NEEDS_REVIEW")
    ) {
      return NextResponse.json(
        {
          success: false,
          allowed: false,
          guard: {
            ...guard,
            investor_shield: investorShieldGuard,
          },
          error:
            investorShieldGuard.movementDecision === "BLOCK"
              ? "Pipeline movement is blocked by Investor Shield guard."
              : "Pipeline movement requires Investor Shield review before progressing.",
        },
        { status: 409 }
      )
    }

    const updatedDeal = await updateSavedDealPipelineState(id, requestedPipelineState)

    return NextResponse.json(
      {
        success: true,
        deal: updatedDeal,
        guard: investorShieldGuard
          ? {
              ...guard,
              investor_shield: investorShieldGuard,
            }
          : guard,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: "Unable to update saved deal pipeline at this time." },
      { status: 500 }
    )
  }
}
