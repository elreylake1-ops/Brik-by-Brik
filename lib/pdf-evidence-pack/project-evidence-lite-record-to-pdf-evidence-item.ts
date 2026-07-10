import type { PdfEvidencePackEvidenceItem } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"

const EVIDENCE_LITE_PROVENANCE_LABEL = "Evidence Lite" as const
const CONTROLLED_REFERENCE_MISSING_LABEL = "Controlled reference unavailable" as const
const CONTROLLED_REFERENCE_STATE = "MISSING" as const

type ProjectableEvidenceLiteRecord = EvidenceLiteRecord &
  Pick<
    PdfEvidencePackEvidenceItem,
    | "evidenceCommandType"
    | "linkedInvestorShieldGate"
    | "linkedProfessionalGate"
    | "evidenceSummary"
    | "evidenceStatus"
    | "evidenceStrength"
    | "reviewState"
    | "blockerImpact"
    | "recommendedNextAction"
    | "expiryOrUpdateDate"
    | "source"
    | "mobileCaptureNote"
  >

function mapLegacyEvidenceTypeToCommandType(
  value: EvidenceLiteRecord["evidenceType"]
): PdfEvidencePackEvidenceItem["evidenceCommandType"] {
  switch (value) {
    case "SOLD_COMP":
      return "SOLD_COMPARABLE"
    case "TITLE_REVIEW":
      return "TITLE_LEGAL"
    case "LEASEHOLD_REVIEW":
      return "LEASEHOLD"
    case "PLANNING_BUILDING_CONTROL":
      return "PLANNING_BUILDING_CONTROL"
    case "REFURB_NOTE":
      return "REFURB"
    case "BUILDER_QUOTE":
      return "BUILDER_QUOTE"
    case "SURVEY_NOTE":
      return "SURVEYOR_EVIDENCE"
    case "LENDER_NOTE":
      return "LENDER_BROKER"
    case "RENTAL_DEMAND":
      return "RENTAL_DEMAND"
    case "SOLICITOR_REVIEW":
      return "SOLICITOR_REVIEW"
    case "OTHER":
      return "OTHER"
    default:
      return "OTHER"
  }
}

function mapLegacyGateToInvestorShieldGate(
  value: EvidenceLiteRecord["linkedGate"]
): PdfEvidencePackEvidenceItem["linkedInvestorShieldGate"] {
  return value === "SOLICITOR_REVIEW" ? "SOLICITOR_REVIEW" : value
}

function mapLegacyStatusToEvidenceStatus(
  value: EvidenceLiteRecord["status"]
): PdfEvidencePackEvidenceItem["evidenceStatus"] {
  switch (value) {
    case "MISSING":
      return "MISSING"
    case "RECORDED":
      return "RECEIVED"
    case "REVIEWED":
      return "REVIEWED"
    case "VERIFIED":
      return "SUFFICIENT"
    case "REJECTED":
      return "REJECTED"
    default:
      return "MISSING"
  }
}

export function projectEvidenceLiteRecordToPdfEvidenceItem(
  record: ProjectableEvidenceLiteRecord
): PdfEvidencePackEvidenceItem {
  const evidenceCommandType =
    record.evidenceCommandType ?? mapLegacyEvidenceTypeToCommandType(record.evidenceType)
  const linkedInvestorShieldGate =
    record.linkedInvestorShieldGate ?? mapLegacyGateToInvestorShieldGate(record.linkedGate)
  const evidenceStatus = record.evidenceStatus ?? mapLegacyStatusToEvidenceStatus(record.status)

  return {
    evidenceId: record.id,
    evidenceType: record.evidenceType,
    title: record.title,
    description: record.note,
    provenanceLabel: EVIDENCE_LITE_PROVENANCE_LABEL,
    capturedAt: record.createdAt,
    reviewedAt: null,
    reviewStatus: record.status,
    relatedGateIds: [record.linkedGate],
    controlledReferenceState: CONTROLLED_REFERENCE_STATE,
    controlledReferenceLabel: CONTROLLED_REFERENCE_MISSING_LABEL,
    evidenceCommandType,
    linkedInvestorShieldGate,
    linkedProfessionalGate: record.linkedProfessionalGate ?? "NONE",
    evidenceSummary: record.evidenceSummary ?? record.note,
    evidenceStatus,
    evidenceStrength: record.evidenceStrength ?? "WEAK",
    reviewState: record.reviewState ?? "NOT_REVIEWED",
    blockerImpact: record.blockerImpact ?? "DOES_NOT_BLOCK",
    recommendedNextAction: record.recommendedNextAction ?? null,
    expiryOrUpdateDate: record.expiryOrUpdateDate ?? null,
    source: record.source ?? null,
    mobileCaptureNote: record.mobileCaptureNote ?? null,
  }
}
