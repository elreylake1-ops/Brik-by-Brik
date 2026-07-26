import { notFound } from "next/navigation"
import InvestorDealSummaryDocument from "@/components/investor-summary/InvestorDealSummaryDocument"
import InvestorDealSummaryUnavailable from "@/components/investor-summary/InvestorDealSummaryUnavailable"
import { mapInvestorReviewToDealSummary } from "@/lib/investor-summary/map-investor-review-to-deal-summary"
import { loadInvestorReviewPageModel } from "@/lib/investor-review/load-investor-review-page-model"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

export default async function InvestorDealSummaryPage({ params }: RouteContext) {
  const resolvedParams = await params
  const dealId = resolvedParams?.id ?? ""

  const result = await loadInvestorReviewPageModel(dealId)

  if (result.status === "not_found") {
    notFound()
  }

  if (result.status === "unavailable") {
    return <InvestorDealSummaryUnavailable />
  }

  const viewModel = mapInvestorReviewToDealSummary({
    review: result.viewModel,
    generatedAt: result.viewModel.header.generatedAt,
  })

  return <InvestorDealSummaryDocument viewModel={viewModel} />
}
