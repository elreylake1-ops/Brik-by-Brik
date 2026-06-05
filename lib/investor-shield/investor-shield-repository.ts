import { query } from "@/lib/db/postgres"
import type {
  BuilderContractCheck,
  BuilderProposal,
  EvidenceItem,
  InvestorShieldCheck,
  ManualOverride,
  RiskFlag,
} from "@/types/investor-shield"

const INVESTOR_SHIELD_CHECK_FIELDS =
  "id, deal_id, gate_key, sub_gate_key, status, severity, confidence, required_evidence, summary, created_at, updated_at"

const EVIDENCE_ITEM_FIELDS =
  "id, deal_id, gate_key, sub_gate_key, evidence_type, source, label, notes, file_url, advisory_only, created_at"

const RISK_FLAG_FIELDS = "id, deal_id, gate_key, severity, message, source, created_at"

const MANUAL_OVERRIDE_FIELDS = "id, deal_id, gate_key, reason, approved_by, created_at"

const BUILDER_PROPOSAL_FIELDS =
  "id, deal_id, builder_name, quoted_amount, scope_summary, status, created_at"

const BUILDER_CONTRACT_CHECK_FIELDS =
  "id, deal_id, builder_proposal_id, status, has_signed_contract, has_payment_schedule, has_scope_of_works, has_start_date, has_insurance_evidence, notes, created_at"

type InvestorShieldCheckRow = {
  id: string
  deal_id: string
  gate_key: InvestorShieldCheck["gateKey"]
  sub_gate_key: InvestorShieldCheck["subGateKey"] | null
  status: InvestorShieldCheck["status"]
  severity: InvestorShieldCheck["severity"]
  confidence: InvestorShieldCheck["confidence"]
  required_evidence: InvestorShieldCheck["requiredEvidence"]
  summary: string | null
  created_at: string
  updated_at: string
}

type EvidenceItemRow = {
  id: string
  deal_id: string
  gate_key: EvidenceItem["gateKey"]
  sub_gate_key: EvidenceItem["subGateKey"] | null
  evidence_type: EvidenceItem["evidenceType"]
  source: EvidenceItem["source"]
  label: string
  notes: string | null
  file_url: string | null
  advisory_only: boolean
  created_at: string
}

type RiskFlagRow = {
  id: string
  deal_id: string
  gate_key: RiskFlag["gateKey"] | null
  severity: RiskFlag["severity"]
  message: string
  source: RiskFlag["source"]
  created_at: string
}

type ManualOverrideRow = {
  id: string
  deal_id: string
  gate_key: ManualOverride["gateKey"]
  reason: string
  approved_by: string | null
  created_at: string
}

type BuilderProposalRow = {
  id: string
  deal_id: string
  builder_name: string | null
  quoted_amount: number | null
  scope_summary: string | null
  status: BuilderProposal["status"]
  created_at: string
}

type BuilderContractCheckRow = {
  id: string
  deal_id: string
  builder_proposal_id: string | null
  status: BuilderContractCheck["status"]
  has_signed_contract: boolean
  has_payment_schedule: boolean
  has_scope_of_works: boolean
  has_start_date: boolean
  has_insurance_evidence: boolean
  notes: string | null
  created_at: string
}

function mapInvestorShieldCheckRow(row: InvestorShieldCheckRow): InvestorShieldCheck {
  return {
    id: row.id,
    dealId: row.deal_id,
    gateKey: row.gate_key,
    subGateKey: row.sub_gate_key ?? undefined,
    status: row.status,
    severity: row.severity,
    confidence: row.confidence,
    requiredEvidence: row.required_evidence,
    summary: row.summary ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapEvidenceItemRow(row: EvidenceItemRow): EvidenceItem {
  return {
    id: row.id,
    dealId: row.deal_id,
    gateKey: row.gate_key,
    subGateKey: row.sub_gate_key ?? undefined,
    evidenceType: row.evidence_type,
    source: row.source,
    confidence: "UNKNOWN",
    label: row.label,
    notes: row.notes ?? undefined,
    fileUrl: row.file_url ?? undefined,
    advisoryOnly: row.advisory_only,
    createdAt: row.created_at,
  }
}

function mapRiskFlagRow(row: RiskFlagRow): RiskFlag {
  return {
    id: row.id,
    dealId: row.deal_id,
    gateKey: row.gate_key ?? undefined,
    severity: row.severity,
    message: row.message,
    source: row.source,
    createdAt: row.created_at,
  }
}

function mapManualOverrideRow(row: ManualOverrideRow): ManualOverride {
  return {
    id: row.id,
    dealId: row.deal_id,
    gateKey: row.gate_key,
    reason: row.reason,
    approvedBy: row.approved_by ?? undefined,
    createdAt: row.created_at,
  }
}

function mapBuilderProposalRow(row: BuilderProposalRow): BuilderProposal {
  return {
    id: row.id,
    dealId: row.deal_id,
    builderName: row.builder_name ?? undefined,
    quotedAmount: row.quoted_amount ?? undefined,
    scopeSummary: row.scope_summary ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapBuilderContractCheckRow(row: BuilderContractCheckRow): BuilderContractCheck {
  return {
    id: row.id,
    dealId: row.deal_id,
    builderProposalId: row.builder_proposal_id ?? undefined,
    status: row.status,
    hasSignedContract: row.has_signed_contract,
    hasPaymentSchedule: row.has_payment_schedule,
    hasScopeOfWorks: row.has_scope_of_works,
    hasStartDate: row.has_start_date,
    hasInsuranceEvidence: row.has_insurance_evidence,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  }
}

async function insertInvestorShieldCheck(check: InvestorShieldCheck): Promise<InvestorShieldCheck> {
  const result = await query<InvestorShieldCheckRow>(
    `INSERT INTO brik_by_brik_engine.investor_shield_checks (
      id,
      deal_id,
      gate_key,
      sub_gate_key,
      status,
      severity,
      confidence,
      required_evidence,
      summary,
      created_at,
      updated_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::text[],
      $9,
      COALESCE($10::timestamptz, NOW()),
      COALESCE($11::timestamptz, NOW())
    ) RETURNING ${INVESTOR_SHIELD_CHECK_FIELDS}`,
    [
      check.id ?? null,
      check.dealId,
      check.gateKey,
      check.subGateKey ?? null,
      check.status,
      check.severity,
      check.confidence,
      check.requiredEvidence,
      check.summary ?? null,
      check.createdAt ?? null,
      check.updatedAt ?? null,
    ]
  )

  return mapInvestorShieldCheckRow(result.rows[0])
}

export async function listInvestorShieldChecksByDealId(
  dealId: string
): Promise<InvestorShieldCheck[]> {
  const result = await query<InvestorShieldCheckRow>(
    `SELECT ${INVESTOR_SHIELD_CHECK_FIELDS}
     FROM brik_by_brik_engine.investor_shield_checks
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows.map(mapInvestorShieldCheckRow)
}

export async function insertInvestorShieldChecks(
  checks: readonly InvestorShieldCheck[]
): Promise<InvestorShieldCheck[]> {
  return Promise.all(checks.map(insertInvestorShieldCheck))
}

export async function listEvidenceItemsByDealId(dealId: string): Promise<EvidenceItem[]> {
  const result = await query<EvidenceItemRow>(
    `SELECT ${EVIDENCE_ITEM_FIELDS}
     FROM brik_by_brik_engine.evidence_items
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows.map(mapEvidenceItemRow)
}

export async function insertEvidenceItem(item: EvidenceItem): Promise<EvidenceItem> {
  const result = await query<EvidenceItemRow>(
    `INSERT INTO brik_by_brik_engine.evidence_items (
      id,
      deal_id,
      gate_key,
      sub_gate_key,
      evidence_type,
      source,
      label,
      notes,
      file_url,
      advisory_only,
      created_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      COALESCE($10, false),
      COALESCE($11::timestamptz, NOW())
    ) RETURNING ${EVIDENCE_ITEM_FIELDS}`,
    [
      item.id ?? null,
      item.dealId,
      item.gateKey,
      item.subGateKey ?? null,
      item.evidenceType,
      item.source,
      item.label,
      item.notes ?? null,
      item.fileUrl ?? null,
      item.advisoryOnly ?? false,
      item.createdAt ?? null,
    ]
  )

  return {
    ...mapEvidenceItemRow(result.rows[0]),
    confidence: item.confidence,
  }
}

export async function listRiskFlagsByDealId(dealId: string): Promise<RiskFlag[]> {
  const result = await query<RiskFlagRow>(
    `SELECT ${RISK_FLAG_FIELDS}
     FROM brik_by_brik_engine.risk_flags
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows.map(mapRiskFlagRow)
}

export async function insertRiskFlag(flag: RiskFlag): Promise<RiskFlag> {
  const result = await query<RiskFlagRow>(
    `INSERT INTO brik_by_brik_engine.risk_flags (
      id,
      deal_id,
      gate_key,
      severity,
      message,
      source,
      created_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      $2,
      $3,
      $4,
      $5,
      $6,
      COALESCE($7::timestamptz, NOW())
    ) RETURNING ${RISK_FLAG_FIELDS}`,
    [
      flag.id ?? null,
      flag.dealId,
      flag.gateKey ?? null,
      flag.severity,
      flag.message,
      flag.source,
      flag.createdAt ?? null,
    ]
  )

  return {
    ...mapRiskFlagRow(result.rows[0]),
    advisoryOnly: flag.advisoryOnly,
  }
}

export async function listManualOverridesByDealId(dealId: string): Promise<ManualOverride[]> {
  const result = await query<ManualOverrideRow>(
    `SELECT ${MANUAL_OVERRIDE_FIELDS}
     FROM brik_by_brik_engine.manual_overrides
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows.map(mapManualOverrideRow)
}

export async function insertManualOverride(
  override: ManualOverride
): Promise<ManualOverride> {
  const result = await query<ManualOverrideRow>(
    `INSERT INTO brik_by_brik_engine.manual_overrides (
      id,
      deal_id,
      gate_key,
      reason,
      approved_by,
      created_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      $2,
      $3,
      $4,
      $5,
      COALESCE($6::timestamptz, NOW())
    ) RETURNING ${MANUAL_OVERRIDE_FIELDS}`,
    [
      override.id ?? null,
      override.dealId,
      override.gateKey,
      override.reason,
      override.approvedBy ?? null,
      override.createdAt ?? null,
    ]
  )

  return {
    ...mapManualOverrideRow(result.rows[0]),
    advisoryOnly: override.advisoryOnly,
  }
}

export async function listBuilderProposalsByDealId(
  dealId: string
): Promise<BuilderProposal[]> {
  const result = await query<BuilderProposalRow>(
    `SELECT ${BUILDER_PROPOSAL_FIELDS}
     FROM brik_by_brik_engine.builder_proposals
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows.map(mapBuilderProposalRow)
}

export async function insertBuilderProposal(
  proposal: BuilderProposal
): Promise<BuilderProposal> {
  const result = await query<BuilderProposalRow>(
    `INSERT INTO brik_by_brik_engine.builder_proposals (
      id,
      deal_id,
      builder_name,
      quoted_amount,
      scope_summary,
      status,
      created_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      $2,
      $3,
      $4,
      $5,
      $6,
      COALESCE($7::timestamptz, NOW())
    ) RETURNING ${BUILDER_PROPOSAL_FIELDS}`,
    [
      proposal.id ?? null,
      proposal.dealId,
      proposal.builderName ?? null,
      proposal.quotedAmount ?? null,
      proposal.scopeSummary ?? null,
      proposal.status,
      proposal.createdAt ?? null,
    ]
  )

  return {
    ...mapBuilderProposalRow(result.rows[0]),
    advisoryOnly: proposal.advisoryOnly,
  }
}

export async function listBuilderContractChecksByDealId(
  dealId: string
): Promise<BuilderContractCheck[]> {
  const result = await query<BuilderContractCheckRow>(
    `SELECT ${BUILDER_CONTRACT_CHECK_FIELDS}
     FROM brik_by_brik_engine.builder_contract_checks
     WHERE deal_id = $1
     ORDER BY created_at DESC`,
    [dealId]
  )

  return result.rows.map(mapBuilderContractCheckRow)
}

export async function insertBuilderContractCheck(
  contractCheck: BuilderContractCheck
): Promise<BuilderContractCheck> {
  const result = await query<BuilderContractCheckRow>(
    `INSERT INTO brik_by_brik_engine.builder_contract_checks (
      id,
      deal_id,
      builder_proposal_id,
      status,
      has_signed_contract,
      has_payment_schedule,
      has_scope_of_works,
      has_start_date,
      has_insurance_evidence,
      notes,
      created_at
    ) VALUES (
      COALESCE($1, gen_random_uuid()::text),
      $2,
      $3,
      $4,
      COALESCE($5, false),
      COALESCE($6, false),
      COALESCE($7, false),
      COALESCE($8, false),
      COALESCE($9, false),
      $10,
      COALESCE($11::timestamptz, NOW())
    ) RETURNING ${BUILDER_CONTRACT_CHECK_FIELDS}`,
    [
      contractCheck.id ?? null,
      contractCheck.dealId,
      contractCheck.builderProposalId ?? null,
      contractCheck.status,
      contractCheck.hasSignedContract,
      contractCheck.hasPaymentSchedule,
      contractCheck.hasScopeOfWorks,
      contractCheck.hasStartDate,
      contractCheck.hasInsuranceEvidence,
      contractCheck.notes ?? null,
      contractCheck.createdAt ?? null,
    ]
  )

  return {
    ...mapBuilderContractCheckRow(result.rows[0]),
    advisoryOnly: contractCheck.advisoryOnly,
  }
}
