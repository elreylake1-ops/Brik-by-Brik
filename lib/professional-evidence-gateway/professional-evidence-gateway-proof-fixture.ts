import {
  loadProfessionalEvidenceGatewayViewModel,
  type LoadedProfessionalEvidenceGatewayEvidence,
} from "@/lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model"
import type { ProfessionalEvidenceGatewayViewModel } from "@/types/professional-evidence-gateway"

export const PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID =
  "seeded-phase-5a-4b-proof-deal"

export const PROFESSIONAL_GATEWAY_RIGHTMOVE_RULE =
  "RIGHTMOVE_SOLD_DATA remains visible sold-comparable / portal evidence and can support valuation, Market Value Position, negotiation context and operator review, but it does not professionally confirm SOLD_COMPARABLE_REVIEW by itself."

export const PROFESSIONAL_GATEWAY_SOLD_COMPARABLE_QUALIFYING_RULE =
  "Qualifying confirmation for SOLD_COMPARABLE_REVIEW remains limited to SURVEYOR, SOLICITOR, and LAND_REGISTRY."

export const PROFESSIONAL_GATEWAY_INVESTOR_SHIELD_UNCHANGED_NOTICE =
  "Investor Shield remains unchanged. This proof does not clear gates or mutate pipeline state."

export type ProfessionalEvidenceGatewayProofFixture = {
  readonly seededSavedDealId: string
  readonly seededEvidence: readonly LoadedProfessionalEvidenceGatewayEvidence[]
  readonly viewModel: ProfessionalEvidenceGatewayViewModel
  readonly rightmoveRule: string
  readonly qualifyingRule: string
  readonly investorShieldUnchangedNotice: string
}

export const professionalEvidenceGatewayProofEvidence =
  [
    {
      id: "seeded-solicitor-title-evidence",
      dealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
      evidenceType: "TITLE_REVIEW",
      linkedGate: "TITLE",
      linkedInvestorShieldGate: "TITLE",
      evidenceCommandType: "TITLE_LEGAL",
      title: "Seeded solicitor title evidence",
      note: "Seeded proof record for solicitor title review.",
      evidenceSummary:
        "Seeded solicitor title evidence confirms title review evidence for seeded proof only.",
      evidenceStatus: "SUFFICIENT",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_CONFIRMED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "SOLICITOR_TITLE_REVIEW",
      recommendedNextAction:
        "Keep solicitor title evidence visible for professional review.",
      expiryOrUpdateDate: "2026-08-01",
      source: "SOLICITOR",
      mobileCaptureNote: "Seeded proof data, not production data.",
    },
    {
      id: "seeded-rightmove-sold-comparable",
      dealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
      evidenceType: "SOLD_COMP",
      linkedGate: "SOLD_COMPS",
      linkedInvestorShieldGate: "SOLD_COMPS",
      evidenceCommandType: "SOLD_COMPARABLE",
      title: "Seeded Rightmove sold comparable evidence",
      note: "Visible sold-comparable portal evidence.",
      evidenceSummary:
        "Seeded Rightmove sold comparable evidence is visible but non-confirming by itself.",
      evidenceStatus: "SUFFICIENT",
      evidenceStrength: "MODERATE",
      reviewState: "PROFESSIONAL_CONFIRMED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
      recommendedNextAction:
        "Use as valuation context and request qualifying professional confirmation.",
      expiryOrUpdateDate: "2026-08-01",
      source: "RIGHTMOVE_SOLD_DATA",
      mobileCaptureNote: "Seeded proof data, not production data.",
    },
    {
      id: "seeded-land-registry-sold-comparable-confirmation",
      dealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
      evidenceType: "SOLD_COMP",
      linkedGate: "SOLD_COMPS",
      linkedInvestorShieldGate: "SOLD_COMPS",
      evidenceCommandType: "SOLD_COMPARABLE",
      title: "Seeded Land Registry sold comparable confirmation",
      note: "Qualifying sold-comparable confirmation.",
      evidenceSummary:
        "Seeded Land Registry sold comparable confirmation qualifies sold comparable evidence for seeded proof only.",
      evidenceStatus: "SUFFICIENT",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_CONFIRMED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
      recommendedNextAction:
        "Keep qualifying sold comparable confirmation visible for review.",
      expiryOrUpdateDate: "2026-08-01",
      source: "LAND_REGISTRY",
      mobileCaptureNote: "Seeded proof data, not production data.",
    },
    {
      id: "seeded-surveyor-sold-comparable-confirmation",
      dealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
      evidenceType: "SOLD_COMP",
      linkedGate: "SOLD_COMPS",
      linkedInvestorShieldGate: "SOLD_COMPS",
      evidenceCommandType: "SOLD_COMPARABLE",
      title: "Seeded surveyor sold comparable confirmation",
      note: "Qualifying surveyor sold-comparable confirmation.",
      evidenceSummary:
        "SURVEYOR confirms sold comparable review evidence for seeded proof only.",
      evidenceStatus: "SUFFICIENT",
      evidenceStrength: "STRONG",
      reviewState: "PROFESSIONAL_CONFIRMED",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
      recommendedNextAction:
        "Keep surveyor sold comparable confirmation visible for review.",
      expiryOrUpdateDate: "2026-08-01",
      source: "SURVEYOR",
      mobileCaptureNote: "Seeded proof data, not production data.",
    },
    {
      id: "seeded-agent-context-evidence",
      dealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
      evidenceType: "OTHER",
      linkedGate: "SOLD_COMPS",
      linkedInvestorShieldGate: "SOLD_COMPS",
      evidenceCommandType: "SOLD_COMPARABLE",
      title: "Seeded agent sold comparable context",
      note: "Agent context remains visible but non-confirming.",
      evidenceSummary:
        "Agent sold comparable context is visible but requires qualifying confirmation.",
      evidenceStatus: "RECEIVED",
      evidenceStrength: "MODERATE",
      reviewState: "REVIEWED_BY_OPERATOR",
      blockerImpact: "DOES_NOT_BLOCK",
      linkedProfessionalGate: "ACTUAL_SOLD_COMPARABLE_REVIEW",
      recommendedNextAction:
        "Use as operator context only until a qualifying source confirms.",
      expiryOrUpdateDate: null,
      source: "AGENT",
      mobileCaptureNote: "Seeded proof data, not production data.",
    },
  ] as const satisfies readonly LoadedProfessionalEvidenceGatewayEvidence[]

export function getProfessionalEvidenceGatewayProofFixture(): ProfessionalEvidenceGatewayProofFixture {
  const seededEvidence = professionalEvidenceGatewayProofEvidence.map((evidence) => ({
    ...evidence,
  }))

  return {
    seededSavedDealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
    seededEvidence,
    viewModel: loadProfessionalEvidenceGatewayViewModel({
      savedDealId: PROFESSIONAL_GATEWAY_PROOF_SAVED_DEAL_ID,
      evidence: seededEvidence,
      finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
      lockReason:
        "Read-only seeded Phase 5A-4B proof. Investor Shield remains unchanged.",
      referenceDate: "2026-07-25T00:00:00.000Z",
    }),
    rightmoveRule: PROFESSIONAL_GATEWAY_RIGHTMOVE_RULE,
    qualifyingRule: PROFESSIONAL_GATEWAY_SOLD_COMPARABLE_QUALIFYING_RULE,
    investorShieldUnchangedNotice:
      PROFESSIONAL_GATEWAY_INVESTOR_SHIELD_UNCHANGED_NOTICE,
  }
}
