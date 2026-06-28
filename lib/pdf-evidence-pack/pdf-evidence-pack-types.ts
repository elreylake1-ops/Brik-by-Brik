import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"
import type { EvidenceLiteEvidenceType, EvidenceLiteGateKey, EvidenceLiteStatus } from "@/types/evidence-lite"

export const PDF_EVIDENCE_PACK_SCHEMA_VERSION = "pdf-evidence-pack-v1" as const
export type PdfEvidencePackSchemaVersion = typeof PDF_EVIDENCE_PACK_SCHEMA_VERSION

export const PDF_EVIDENCE_PACK_AUDIENCE = "INVESTOR" as const
export type PdfEvidencePackAudience = typeof PDF_EVIDENCE_PACK_AUDIENCE

export const PDF_EVIDENCE_PACK_PURPOSE = "INVESTOR_DECISION_SUPPORT" as const
export type PdfEvidencePackPurpose = typeof PDF_EVIDENCE_PACK_PURPOSE

export const PDF_EVIDENCE_PACK_GENERATION_MODE = "MANUAL_CURRENT_LIVE_STATE" as const
export type PdfEvidencePackGenerationMode = typeof PDF_EVIDENCE_PACK_GENERATION_MODE

export const PDF_EVIDENCE_PACK_REFERENCE_STATES = ["AVAILABLE", "MISSING", "RESTRICTED"] as const
export type PdfEvidencePackReferenceState = typeof PDF_EVIDENCE_PACK_REFERENCE_STATES[number]

export type PdfEvidencePackMeta = {
  schemaVersion: PdfEvidencePackSchemaVersion
  generatedAt: string
  savedDealId: string
  audience: PdfEvidencePackAudience
  purpose: PdfEvidencePackPurpose
  generationMode: PdfEvidencePackGenerationMode
  confidentialityLabel: string
}

export type PdfEvidencePackIdentity = InvestorSummaryViewModel["deal"]

export type PdfEvidencePackEvidenceItem = {
  evidenceId: string
  evidenceType: EvidenceLiteEvidenceType
  title: string
  description: string | null
  provenanceLabel: string | null
  capturedAt: string | null
  reviewedAt: string | null
  reviewStatus: EvidenceLiteStatus
  relatedGateIds: readonly EvidenceLiteGateKey[]
  controlledReferenceState: PdfEvidencePackReferenceState
  controlledReferenceLabel: string | null
}

export type PdfEvidencePackDisclaimer = {
  code: string
  title: string
  body: string
  required: boolean
}

export type PdfEvidencePack = {
  meta: PdfEvidencePackMeta
  identity: PdfEvidencePackIdentity
  investorSummary: InvestorSummaryViewModel
  investorShield: InvestorShieldEnforcementResult
  evidenceIndex: readonly PdfEvidencePackEvidenceItem[]
  disclaimers: readonly PdfEvidencePackDisclaimer[]
}
