import type {
  PdfEvidencePackEvidenceItem,
  PdfEvidencePackReferenceState,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { EvidenceLiteGateKey, EvidenceLiteRecord } from "@/types/evidence-lite"

type EvidenceLiteProjectionInput = EvidenceLiteRecord & {
  relatedGateIds?: readonly EvidenceLiteGateKey[]
}

const EVIDENCE_LITE_PROVENANCE_LABEL = "Evidence Lite" as const
const CONTROLLED_REFERENCE_AVAILABLE_LABEL = "Controlled reference available" as const
const CONTROLLED_REFERENCE_RESTRICTED_LABEL = "Controlled reference restricted" as const
const CONTROLLED_REFERENCE_MISSING_LABEL = "Controlled reference unavailable" as const

function resolveControlledReferenceState(
  record: EvidenceLiteRecord
): {
  state: PdfEvidencePackReferenceState
  label: string
} {
  if (record.reviewed) {
    return {
      state: "AVAILABLE",
      label: CONTROLLED_REFERENCE_AVAILABLE_LABEL,
    }
  }

  if (record.status === "MISSING" || record.status === "REJECTED") {
    return {
      state: "MISSING",
      label: CONTROLLED_REFERENCE_MISSING_LABEL,
    }
  }

  return {
    state: "RESTRICTED",
    label: CONTROLLED_REFERENCE_RESTRICTED_LABEL,
  }
}

export function projectEvidenceLiteRecordToPdfEvidenceItem(
  record: EvidenceLiteRecord
): PdfEvidencePackEvidenceItem {
  const projection = record as EvidenceLiteProjectionInput
  const controlledReference = resolveControlledReferenceState(record)

  return {
    evidenceId: projection.id,
    evidenceType: projection.evidenceType,
    title: projection.title,
    description: projection.note,
    provenanceLabel: EVIDENCE_LITE_PROVENANCE_LABEL,
    capturedAt: projection.createdAt,
    reviewedAt: projection.reviewed ? projection.updatedAt : null,
    reviewStatus: projection.status,
    relatedGateIds: projection.relatedGateIds ?? [projection.linkedGate],
    controlledReferenceState: controlledReference.state,
    controlledReferenceLabel: controlledReference.label,
  }
}
