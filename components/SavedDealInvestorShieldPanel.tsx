import InvestorShieldPanel from "@/components/InvestorShieldPanel"
import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"
import { mapInvestorShieldUiViewModel } from "@/lib/investor-shield/map-investor-shield-ui-view-model"

type SavedDealContext = {
  id: string
  pipeline_state: string
  classification: string
  governance_state: string
  capital_protection_state: string
}

type Props = {
  deal: SavedDealContext | null
  investorShieldModel: InvestorShieldUiModel | null
  loading?: boolean
  error?: string | null
}

function statusToneClasses(status: "clear" | "caution" | "blocked"): string {
  if (status === "clear") {
    return "border-green-200 bg-green-50 text-green-800"
  }

  if (status === "caution") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }

  return "border-red-200 bg-red-50 text-red-800"
}

export default function SavedDealInvestorShieldPanel({
  deal,
  investorShieldModel,
  loading = false,
  error = null,
}: Props) {
  if (!deal) {
    return (
      <section className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Investor Shield</h3>
        <p className="mt-1 text-sm text-gray-700">Select a saved deal to view read-only Investor Shield status.</p>
      </section>
    )
  }

  const model = mapInvestorShieldUiViewModel({
    dealId: deal.id,
    deal: {
      pipelineState: deal.pipeline_state,
      classification: deal.classification,
      governanceState: deal.governance_state,
      capitalProtectionState: deal.capital_protection_state,
    },
    investorShield: investorShieldModel,
  })

  return (
    <section className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-gray-500">Investor Shield</p>
          <h3 className="text-sm font-semibold text-gray-900">Read-only saved deal binding</h3>
        </div>
        <div className={`rounded border px-3 py-2 text-xs font-medium ${statusToneClasses(model.summary.overallStatus)}`}>
          <p>Status: {model.summary.overallStatus.toUpperCase()}</p>
          <p className="mt-1">{model.summary.canProgress ? "Can progress" : "Blocked or incomplete"}</p>
        </div>
      </div>

      {loading ? <p className="mt-2 text-sm text-gray-700">Loading Investor Shield status...</p> : null}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <p className="mt-2 text-sm text-gray-700">{model.summary.message}</p>

      <div className="mt-3">
        <InvestorShieldPanel model={model} />
      </div>
    </section>
  )
}
