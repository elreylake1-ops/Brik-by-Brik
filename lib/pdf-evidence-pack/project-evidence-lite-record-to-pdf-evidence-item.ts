import type {
  PdfEvidencePackEvidenceItem,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"

const EVIDENCE_LITE_PROVENANCE_LABEL = "Evidence Lite" as const
const CONTROLLED_REFERENCE_MISSING_LABEL = "Controlled reference unavailable" as const
const CONTROLLED_REFERENCE_STATE = "MISSING" as const

export function projectEvidenceLiteRecordToPdfEvidenceItem(
  record: EvidenceLiteRecord
): PdfEvidencePackEvidenceItem {
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
  }
}
