import { notFound } from "next/navigation"
import InvestorReviewDocument from "@/components/investor-review/InvestorReviewDocument"
import InvestorReviewUnavailable from "@/components/investor-review/InvestorReviewUnavailable"
import { loadInvestorReviewPageModel } from "@/lib/investor-review/load-investor-review-page-model"

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

export default async function InvestorReviewPage({ params }: RouteContext) {
  const resolvedParams = await params
  const dealId = resolvedParams?.id ?? ""

  const result = await loadInvestorReviewPageModel(dealId)

  if (result.status === "not_found") {
    notFound()
  }

  if (result.status === "unavailable") {
    return <InvestorReviewUnavailable />
  }

  return <InvestorReviewDocument viewModel={result.viewModel} />
}
