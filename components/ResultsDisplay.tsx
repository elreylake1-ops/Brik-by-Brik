import type { DealResult } from "@/types/deal"
import { formatCurrency, formatProfit, formatPercent } from "@/lib/formatters"
import Tooltip from "@/components/Tooltip"

type Props = {
  result: DealResult
}

function Row({ label, tooltip, value, valueClass }: { label: string; tooltip: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="flex items-center gap-1 text-sm text-gray-600">
        {label}
        <Tooltip text={tooltip}>
          <span className="cursor-default text-gray-400 hover:text-gray-600">ⓘ</span>
        </Tooltip>
      </span>
      <span className={`text-sm font-semibold ${valueClass ?? "text-gray-900"}`}>
        {value}
      </span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">{children}</h3>
}

export default function ResultsDisplay({ result }: Props) {
  const { totalCost, financeCost, profit, profitMargin, trueMao } = result
  const { interest, arrangementFee, exitFee, totalFinanceCost } = financeCost

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-gray-800">Results</h2>
      <p className="mb-2 text-xs text-gray-500">
        Core deal outputs. Detailed refurb/timeline assumptions shown in engine analysis section below.
      </p>

      <SectionHeading>Finance Cost Breakdown</SectionHeading>
      <div className="flex flex-col gap-3">
        <Row label="Interest" tooltip="Purchase Price × 15% × (Bridge Term ÷ 12)" value={formatCurrency(interest)} />
        <Row label="Arrangement Fee" tooltip="Purchase Price × 2%" value={formatCurrency(arrangementFee)} />
        <Row label="Exit Fee" tooltip="Purchase Price × 1%" value={formatCurrency(exitFee)} />
        <div className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
          <span className="text-sm font-semibold text-gray-700">Total Finance Cost</span>
          <span className="text-sm font-bold text-gray-900">{formatCurrency(totalFinanceCost)}</span>
        </div>
      </div>

      <SectionHeading>Deal Summary</SectionHeading>
      <div className="flex flex-col gap-3">
        <Row
          label="Total Cost"
          tooltip="Purchase Price + Refurb + Stamp Duty + Legal Costs + Finance Costs + Sale Costs"
          value={formatCurrency(totalCost)}
        />
        <Row
          label="Profit"
          tooltip="GDV minus Total Cost."
          value={formatProfit(profit)}
          valueClass={profit >= 0 ? "text-green-600" : "text-red-600"}
        />
        <Row
          label="Profit Margin"
          tooltip="(Profit ÷ GDV) × 100"
          value={formatPercent(profitMargin)}
          valueClass={profitMargin >= 0 ? "text-green-600" : "text-red-600"}
        />
      </div>

      <SectionHeading>True MAO</SectionHeading>
      <div className="flex flex-col gap-3">
        <Row
          label="At 15% Profit"
          tooltip="Max you should pay to achieve 15% profit on GDV."
          value={formatCurrency(trueMao.fifteenPercent)}
        />
        <Row
          label="At 20% Profit"
          tooltip="Max you should pay to achieve 20% profit on GDV."
          value={formatCurrency(trueMao.twentyPercent)}
        />
        <Row
          label="At 25% Profit"
          tooltip="Max you should pay to achieve 25% profit on GDV."
          value={formatCurrency(trueMao.twentyFivePercent)}
        />
      </div>
    </div>
  )
}
