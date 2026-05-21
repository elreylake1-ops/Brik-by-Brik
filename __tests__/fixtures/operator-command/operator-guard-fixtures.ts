import type { OperatorGuardInput, OperatorGuardResult } from "@/types/operator-command"

export const OPERATOR_GUARD_INPUT_FIXTURE: OperatorGuardInput = {
  deal_id: "deal-001",
  current_pipeline_state: "UNDER_ANALYSIS",
  requested_pipeline_state: "READY_FOR_OFFER",
  governance_state: "MANUAL_REVIEW_REQUIRED",
  classification: "CONDITIONAL",
  workflow_action: "MOVE_PIPELINE_STATE",
  has_manual_review_task: false,
  has_blocking_tasks: true,
  has_missing_evidence: true,
  offer_amount: 175000,
  max_safe_offer: 182500,
  notes: "Manual review and evidence tasks still open.",
}

export const OPERATOR_GUARD_RESULT_FIXTURE: OperatorGuardResult = {
  decision: "REQUIRE_TASK",
  allowed: false,
  reasons: ["MANUAL_REVIEW_REQUIRED", "MISSING_EVIDENCE"],
  required_task_type: "MANUAL_REVIEW",
  block_message: "Manual review task required before progression.",
  warning_message: "Evidence gaps remain unresolved.",
}
