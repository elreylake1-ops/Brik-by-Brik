import type { PdfEvidencePackEvidenceItem } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { LoadedProfessionalEvidenceGatewayEvidence } from "@/lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model"

export function adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence(
  evidenceIndex: readonly PdfEvidencePackEvidenceItem[]
): readonly LoadedProfessionalEvidenceGatewayEvidence[] {
  return evidenceIndex.map((item) => ({
    id: item.evidenceId,
    evidenceType: item.evidenceType,
    linkedGate: item.relatedGateIds[0],
    linkedInvestorShieldGate: item.linkedInvestorShieldGate,
    evidenceCommandType: item.evidenceCommandType,
    title: item.title,
    note: item.description,
    evidenceSummary: item.evidenceSummary,
    evidenceStatus: item.evidenceStatus,
    evidenceStrength: item.evidenceStrength,
    reviewState: item.reviewState,
    blockerImpact: item.blockerImpact,
    linkedProfessionalGate: item.linkedProfessionalGate,
    recommendedNextAction: item.recommendedNextAction,
    expiryOrUpdateDate: item.expiryOrUpdateDate,
    source: item.source,
    mobileCaptureNote: item.mobileCaptureNote,
  }))
}
