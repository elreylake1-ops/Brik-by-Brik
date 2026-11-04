import { notFound, redirect } from "next/navigation"
import InvestorReviewDocument from "@/components/investor-review/InvestorReviewDocument"
import InvestorReviewUnavailable from "@/components/investor-review/InvestorReviewUnavailable"
import { loadInvestorReviewPageModel } from "@/lib/investor-review/load-investor-review-page-model"
import { requireServerOperator } from "@/lib/auth/operator-auth"
import { isDevelopmentOpen } from "@/lib/operator-command/guard-saved-deal-api"

export const dynamic = "force-dynamic"
export const revalidate = 0

type RouteContext = {
  params: Promise<{ id?: string }> | { id?: string }
}

export default async function InvestorReviewPage({ params }: RouteContext) {
  if (!isDevelopmentOpen()) {
    const auth = await requireServerOperator()
    if (!auth.ok) {
      if (auth.status === 401) {
        redirect("/sign-in")
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-100 p-4">
          <div className="max-w-md bg-slate-800 border border-red-500/50 p-6 rounded text-center">
            <h1 className="text-xl font-bold text-red-400 mb-2">Access Denied</h1>
            <p className="text-slate-300 text-sm">
              Your account is not an approved operator for this company deal review document.
            </p>
          </div>
        </div>
      )
    }
  }

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
