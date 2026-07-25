import { adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence } from "@/lib/investor-review/adapt-pdf-evidence-pack-evidence-to-professional-gateway"
import { loadDealFormulationViewModel } from "@/lib/deal-formulation/load-deal-formulation-view-model"
import { loadPdfEvidencePackForDeal } from "@/lib/pdf-evidence-pack/load-pdf-evidence-pack"
import { mapPdfEvidencePackToInvestorReview } from "@/lib/investor-review/map-pdf-evidence-pack-to-investor-review"
import { loadProfessionalEvidenceGatewayViewModel } from "@/lib/professional-evidence-gateway/load-professional-evidence-gateway-view-model"
import {
  INVESTOR_REVIEW_CONFIDENTIALITY_LABEL,
  type InvestorReviewReadyViewModel,
} from "@/lib/investor-review/investor-review-view-model"
import { getSavedDealById } from "@/lib/operator-command/saved-deals-repository"

export type LoadInvestorReviewPageModelResult =
  | {
      status: "ready"
      viewModel: InvestorReviewReadyViewModel
    }
  | {
      status: "not_found"
    }
  | {
      status: "unavailable"
    }

function normalizeDealId(dealId: string): string | null {
  const trimmed = dealId.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function loadInvestorReviewPageModel(
  dealId: string
): Promise<LoadInvestorReviewPageModelResult> {
  const normalizedDealId = normalizeDealId(dealId)
  if (!normalizedDealId) {
    return { status: "not_found" }
  }

  let savedDeal
  try {
    savedDeal = await getSavedDealById(normalizedDealId)
  } catch {
    return { status: "unavailable" }
  }

  if (!savedDeal) {
    return { status: "not_found" }
  }

  const generatedAt = new Date().toISOString()

  let pack
  try {
    pack = await loadPdfEvidencePackForDeal({
      dealId: normalizedDealId,
      generatedAt,
      confidentialityLabel: INVESTOR_REVIEW_CONFIDENTIALITY_LABEL,
    })
  } catch {
    return { status: "unavailable" }
  }

  if (!pack) {
    return { status: "not_found" }
  }

  let dealFormulation
  try {
    dealFormulation = await loadDealFormulationViewModel(normalizedDealId)
  } catch {
    return { status: "unavailable" }
  }

  if (!dealFormulation) {
    return { status: "unavailable" }
  }

  try {
    const standardViewModel = mapPdfEvidencePackToInvestorReview({ pack, savedDeal })
    const professionalEvidence = adaptPdfEvidencePackEvidenceToProfessionalGatewayEvidence(
      pack.evidenceIndex
    )
    const professionalEvidenceGateway = loadProfessionalEvidenceGatewayViewModel({
      savedDealId: normalizedDealId,
      evidence: professionalEvidence,
      referenceDate: generatedAt,
    })

    const readyViewModel = {
      ...standardViewModel,
      dealFormulation,
      professionalEvidenceGateway,
    } satisfies InvestorReviewReadyViewModel

    return {
      status: "ready",
      viewModel: readyViewModel,
    }
  } catch {
    return { status: "unavailable" }
  }
}
