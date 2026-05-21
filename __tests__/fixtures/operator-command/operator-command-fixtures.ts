import type {
  AuditEvent,
  DealSnapshot,
  EvidenceItem,
  OfferRecord,
  OperatorDeal,
  OperatorTask,
  PipelineEvent,
} from "@/types/operator-command"

export const OPERATOR_DEAL_FIXTURE: OperatorDeal = {
  id: "deal-001",
  address: "12 Lake View Road, Leeds",
  source_url: "https://example.com/property/12-lake-view-road",
  pipeline_state: "UNDER_ANALYSIS",
  governance_state: "MANUAL_REVIEW_REQUIRED",
  classification: "CONDITIONAL",
  notes: "Needs finance review before offer progression.",
  created_at: "2026-01-15T09:00:00.000Z",
  updated_at: "2026-01-16T10:30:00.000Z",
  archived_at: null,
}

export const DEAL_SNAPSHOT_FIXTURE: DealSnapshot = {
  id: "snapshot-001",
  deal_id: "deal-001",
  engine_snapshot_json: {
    true_mao: 182500,
    verdict: "CONDITIONAL",
    governance_state: "MANUAL_REVIEW_REQUIRED",
  },
  created_at: "2026-01-15T09:05:00.000Z",
}

export const PIPELINE_EVENT_FIXTURE: PipelineEvent = {
  id: "pipe-001",
  deal_id: "deal-001",
  from_state: "UNDER_ANALYSIS",
  to_state: "DUE_DILIGENCE",
  reason: "Manual review required before offer path.",
  blocked: false,
  block_reason: null,
  created_at: "2026-01-16T11:00:00.000Z",
}

export const OFFER_RECORD_FIXTURE: OfferRecord = {
  id: "offer-001",
  deal_id: "deal-001",
  offer_amount: 175000,
  offer_type: "INITIAL",
  offer_rationale: "Aligned to MAO with evidence caveat.",
  response_status: "PENDING",
  counter_offer_amount: null,
  negotiation_notes: "Awaiting agent response.",
  next_negotiation_action: "Follow up in 48 hours.",
  created_at: "2026-01-17T08:45:00.000Z",
}

export const OPERATOR_TASK_FIXTURE: OperatorTask = {
  id: "task-001",
  deal_id: "deal-001",
  task_type: "MANUAL_REVIEW",
  title: "Confirm finance blocker evidence",
  status: "IN_PROGRESS",
  priority: "HIGH",
  blocking: true,
  created_by: "USER",
  due_date: "2026-01-19T17:00:00.000Z",
  completed_at: null,
  created_at: "2026-01-16T11:05:00.000Z",
  updated_at: "2026-01-17T09:00:00.000Z",
}

export const EVIDENCE_ITEM_FIXTURE: EvidenceItem = {
  id: "evidence-001",
  deal_id: "deal-001",
  category: "FINANCE",
  title: "Lender terms summary",
  source_url: "https://example.com/lender/terms",
  notes: "Rate confirmation pending final lender callback.",
  file_placeholder: "lender-terms-summary.pdf",
  created_at: "2026-01-16T12:00:00.000Z",
}

export const AUDIT_EVENT_FIXTURE: AuditEvent = {
  id: "audit-001",
  deal_id: "deal-001",
  event_type: "PIPELINE_STATE_CHANGED",
  event_payload_json: {
    from_state: "UNDER_ANALYSIS",
    to_state: "DUE_DILIGENCE",
    blocked: false,
  },
  created_at: "2026-01-16T11:00:05.000Z",
}
