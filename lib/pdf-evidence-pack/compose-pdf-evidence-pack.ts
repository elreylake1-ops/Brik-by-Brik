import {
  PDF_EVIDENCE_PACK_AUDIENCE,
  PDF_EVIDENCE_PACK_GENERATION_MODE,
  PDF_EVIDENCE_PACK_PURPOSE,
  PDF_EVIDENCE_PACK_SCHEMA_VERSION,
  type PdfEvidencePack,
  type PdfEvidencePackDisclaimer,
  type PdfEvidencePackEvidenceItem,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import type { InvestorShieldEnforcementResult } from "@/types/investor-shield-enforcement"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"

export type ComposePdfEvidencePackInput = {
  generatedAt: string
  confidentialityLabel: string
  investorSummary: InvestorSummaryViewModel
  investorShield: InvestorShieldEnforcementResult
  evidenceIndex: readonly PdfEvidencePackEvidenceItem[]
  disclaimers: readonly PdfEvidencePackDisclaimer[]
}

export function composePdfEvidencePack(
  input: ComposePdfEvidencePackInput
): PdfEvidencePack {
  return {
    meta: {
      schemaVersion: PDF_EVIDENCE_PACK_SCHEMA_VERSION,
      generatedAt: input.generatedAt,
      savedDealId: input.investorSummary.deal.dealId,
      audience: PDF_EVIDENCE_PACK_AUDIENCE,
      purpose: PDF_EVIDENCE_PACK_PURPOSE,
      generationMode: PDF_EVIDENCE_PACK_GENERATION_MODE,
      confidentialityLabel: input.confidentialityLabel,
    },
    identity: input.investorSummary.deal,
    investorSummary: input.investorSummary,
    investorShield: input.investorShield,
    evidenceIndex: input.evidenceIndex,
    disclaimers: input.disclaimers,
  }
}
