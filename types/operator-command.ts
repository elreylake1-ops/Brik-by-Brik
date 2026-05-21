// Phase 4A operator command contracts are type definitions only.
// No runtime behavior, persistence logic, or UI wiring is implemented in this file.

export type PipelineState =
  | "UNDER_ANALYSIS"
  | "READY_FOR_OFFER"
  | "OFFER_SENT"
  | "NEGOTIATING"
  | "DUE_DILIGENCE"
  | "FINANCE_REVIEW"
  | "COMPLETED"
  | "REJECTED"
  | "ARCHIVED"

export type OperatorGovernanceState =
  | "REJECT"
  | "FATAL"
  | "MANUAL_REVIEW_REQUIRED"
  | "CONDITIONAL"
  | "STRONG_OPPORTUNITY"
  | "UNKNOWN_CONFLICT"

export type OfferType = "INITIAL" | "REVISED" | "COUNTER" | "FINAL" | "WITHDRAWN"

export type OfferResponseStatus =
  | "PENDING"
  | "ACCEPTED"
  | "REJECTED"
  | "COUNTERED"
  | "NO_RESPONSE"

export type TaskType =
  | "DUE_DILIGENCE"
  | "EVIDENCE"
  | "NEGOTIATION"
  | "MANUAL_REVIEW"
  | "FINANCE_REVIEW"
  | "BLOCKER"

export type TaskStatus = "OPEN" | "IN_PROGRESS" | "BLOCKED" | "COMPLETE" | "CANCELLED"

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH"

export type TaskCreatedBy = "SYSTEM" | "USER"

export type EvidenceCategory =
  | "COMPARABLES"
  | "REFURB"
  | "LEGAL"
  | "FINANCE"
  | "AGENT_NEGOTIATION"

export type AuditEventType =
  | "DEAL_SAVED"
  | "PIPELINE_STATE_CHANGED"
  | "OFFER_ADDED"
  | "OFFER_UPDATED"
  | "TASK_COMPLETED"
  | "GOVERNANCE_BLOCK_ENCOUNTERED"
  | "MANUAL_OVERRIDE_ATTEMPTED"

export type OperatorDeal = {
  id: string
  address: string
  source_url: string | null
  pipeline_state: PipelineState
  governance_state: OperatorGovernanceState
  classification: string
  notes: string | null
  created_at: string
  updated_at: string
  archived_at: string | null
}

export type DealSnapshot = {
  id: string
  deal_id: string
  engine_snapshot_json: Record<string, unknown>
  created_at: string
}

export type PipelineEvent = {
  id: string
  deal_id: string
  from_state: PipelineState
  to_state: PipelineState
  reason: string | null
  blocked: boolean
  block_reason: string | null
  created_at: string
}

export type OfferRecord = {
  id: string
  deal_id: string
  offer_amount: number
  offer_type: OfferType
  offer_rationale: string | null
  response_status: OfferResponseStatus
  counter_offer_amount: number | null
  negotiation_notes: string | null
  next_negotiation_action: string | null
  created_at: string
}

export type OperatorTask = {
  id: string
  deal_id: string
  task_type: TaskType
  title: string
  status: TaskStatus
  priority: TaskPriority
  blocking: boolean
  created_by: TaskCreatedBy
  due_date: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type EvidenceItem = {
  id: string
  deal_id: string
  category: EvidenceCategory
  title: string
  source_url: string | null
  notes: string | null
  file_placeholder: string | null
  created_at: string
}

export type AuditEvent = {
  id: string
  deal_id: string
  event_type: AuditEventType
  event_payload_json: Record<string, unknown>
  created_at: string
}
