import type {
  OperatorGuardInput,
  OperatorGuardReason,
  OperatorGuardResult,
  PipelineState,
  TaskType,
} from "@/types/operator-command"

const BLOCKED_PROGRESS_STATES: readonly PipelineState[] = [
  "READY_FOR_OFFER",
  "OFFER_SENT",
  "NEGOTIATING",
  "DUE_DILIGENCE",
]

const SAFE_STATES: readonly PipelineState[] = ["UNDER_ANALYSIS", "REJECTED", "ARCHIVED"]

function buildResult(args: {
  decision: OperatorGuardResult["decision"]
  allowed: boolean
  reasons: OperatorGuardReason[]
  requiredTaskType?: TaskType | null
  blockMessage?: string | null
  warningMessage?: string | null
}): OperatorGuardResult {
  return {
    decision: args.decision,
    allowed: args.allowed,
    reasons: args.reasons,
    required_task_type: args.requiredTaskType ?? null,
    block_message: args.blockMessage ?? null,
    warning_message: args.warningMessage ?? null,
  }
}

function hasNonEmptyNotes(notes: string | null): boolean {
  return typeof notes === "string" && notes.trim().length > 0
}

function isOfferAboveMaxSafe(input: OperatorGuardInput): boolean {
  return (
    typeof input.offer_amount === "number" &&
    typeof input.max_safe_offer === "number" &&
    input.offer_amount > input.max_safe_offer
  )
}

export function evaluateOperatorGuard(input: OperatorGuardInput): OperatorGuardResult {
  const requested = input.requested_pipeline_state
  const action = input.workflow_action

  if (input.governance_state === "REJECT" || input.governance_state === "FATAL") {
    if (action === "CREATE_OFFER" || action === "UPDATE_OFFER") {
      return buildResult({
        decision: "BLOCK",
        allowed: false,
        reasons: ["GOVERNANCE_REJECT_OR_FATAL"],
        blockMessage: "Offer actions are blocked for REJECT or FATAL governance state.",
      })
    }

    if (action === "MOVE_PIPELINE_STATE" && requested !== null && BLOCKED_PROGRESS_STATES.includes(requested)) {
      return buildResult({
        decision: "BLOCK",
        allowed: false,
        reasons: ["GOVERNANCE_REJECT_OR_FATAL"],
        blockMessage: "Pipeline progression is blocked for REJECT or FATAL governance state.",
      })
    }

    if (action === "MOVE_PIPELINE_STATE" && requested !== null && SAFE_STATES.includes(requested)) {
      return buildResult({
        decision: "ALLOW",
        allowed: true,
        reasons: ["ALLOWED_BY_GOVERNANCE"],
      })
    }

    return buildResult({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
    })
  }

  if (input.governance_state === "MANUAL_REVIEW_REQUIRED") {
    if (action === "CREATE_OFFER" || action === "UPDATE_OFFER") {
      return buildResult({
        decision: "REQUIRE_REVIEW",
        allowed: false,
        reasons: ["MANUAL_REVIEW_REQUIRED"],
      })
    }

    if (action === "MOVE_PIPELINE_STATE") {
      if (requested === "DUE_DILIGENCE") {
        if (input.has_manual_review_task) {
          return buildResult({
            decision: "ALLOW",
            allowed: true,
            reasons: ["ALLOWED_BY_GOVERNANCE"],
          })
        }

        return buildResult({
          decision: "REQUIRE_TASK",
          allowed: false,
          reasons: ["MANUAL_REVIEW_REQUIRED"],
          requiredTaskType: "MANUAL_REVIEW",
        })
      }

      if (requested === "FINANCE_REVIEW") {
        return buildResult({
          decision: "REQUIRE_REVIEW",
          allowed: true,
          reasons: ["MANUAL_REVIEW_REQUIRED"],
        })
      }

      if (requested === "READY_FOR_OFFER" || requested === "OFFER_SENT" || requested === "NEGOTIATING") {
        return buildResult({
          decision: "BLOCK",
          allowed: false,
          reasons: ["MANUAL_REVIEW_REQUIRED"],
          blockMessage: "Manual review state blocks offer progression until review blockers are resolved.",
        })
      }
    }

    return buildResult({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
    })
  }

  if (input.governance_state === "CONDITIONAL") {
    if (action === "MOVE_PIPELINE_STATE" && requested === "READY_FOR_OFFER" && !input.has_blocking_tasks) {
      return buildResult({
        decision: "REQUIRE_TASK",
        allowed: false,
        reasons: ["CONDITIONAL_BLOCKERS_REQUIRED"],
        requiredTaskType: "BLOCKER",
      })
    }

    if (action === "MOVE_PIPELINE_STATE" && (requested === "OFFER_SENT" || requested === "NEGOTIATING")) {
      return buildResult({
        decision: "REQUIRE_REVIEW",
        allowed: false,
        reasons: ["OFFER_RATIONALE_REQUIRED"],
      })
    }

    if (action === "CREATE_OFFER" || action === "UPDATE_OFFER") {
      if (!hasNonEmptyNotes(input.notes)) {
        return buildResult({
          decision: "REQUIRE_REVIEW",
          allowed: false,
          reasons: ["OFFER_RATIONALE_REQUIRED"],
        })
      }

      return buildResult({
        decision: "ALLOW",
        allowed: true,
        reasons: ["ALLOWED_BY_GOVERNANCE"],
      })
    }

    return buildResult({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
    })
  }

  if (input.governance_state === "STRONG_OPPORTUNITY") {
    if (
      input.has_missing_evidence &&
      ((action === "MOVE_PIPELINE_STATE" && requested === "READY_FOR_OFFER") || action === "CREATE_OFFER")
    ) {
      return buildResult({
        decision: "REQUIRE_TASK",
        allowed: false,
        reasons: ["MISSING_EVIDENCE"],
        requiredTaskType: "EVIDENCE",
      })
    }

    if ((action === "CREATE_OFFER" || action === "UPDATE_OFFER") && isOfferAboveMaxSafe(input)) {
      return buildResult({
        decision: "WARN",
        allowed: true,
        reasons: ["OFFER_ABOVE_MAO"],
        warningMessage: "Offer is above max safe offer and requires MAO discipline review.",
      })
    }

    return buildResult({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
    })
  }

  if (input.governance_state === "UNKNOWN_CONFLICT") {
    if (action === "CREATE_OFFER" || action === "UPDATE_OFFER") {
      return buildResult({
        decision: "BLOCK",
        allowed: false,
        reasons: ["UNKNOWN_GOVERNANCE_CONFLICT"],
        blockMessage: "Offer actions are blocked under unknown governance conflict.",
      })
    }

    if (
      action === "MOVE_PIPELINE_STATE" &&
      requested !== null &&
      ["READY_FOR_OFFER", "OFFER_SENT", "NEGOTIATING", "COMPLETED"].includes(requested)
    ) {
      return buildResult({
        decision: "BLOCK",
        allowed: false,
        reasons: ["UNKNOWN_GOVERNANCE_CONFLICT"],
        blockMessage: "Pipeline progression is blocked under unknown governance conflict.",
      })
    }

    if (action === "MOVE_PIPELINE_STATE" && requested !== null && SAFE_STATES.includes(requested)) {
      return buildResult({
        decision: "ALLOW",
        allowed: true,
        reasons: ["ALLOWED_BY_GOVERNANCE"],
      })
    }

    return buildResult({
      decision: "ALLOW",
      allowed: true,
      reasons: ["ALLOWED_BY_GOVERNANCE"],
    })
  }

  return buildResult({
    decision: "ALLOW",
    allowed: true,
    reasons: ["ALLOWED_BY_GOVERNANCE"],
  })
}
