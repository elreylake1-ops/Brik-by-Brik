import type { DealResult } from "@/types/deal"
import { formatCurrency, formatProfit } from "@/lib/formatters"
import Tooltip from "@/components/Tooltip"

type Props = {
  result: DealResult
}

type ResultRow = {
  label: string
  tooltip: string
  value: string
  valueClass?: string
}

export default function ResultsDisplay({ result }: Props) {
  const { totalCost, profit, maxOffer, verdict } = result

  const rows: ResultRow[] = [
    {
      label: "Total Cost",
      tooltip: "Purchase Price + Refurb Cost.",
      value: formatCurrency(totalCost),
    },
    {
      label: "Profit",
      tooltip: "GDV minus Total Cost. Shows potential profit before fees.",
      value: formatProfit(profit),
      valueClass: profit >= 0 ? "text-green-600" : "text-red-600",
    },
    {
      label: "Max Offer (70% Rule)",
      tooltip: "Maximum price you should pay: (70% of GDV) minus refurbishment costs.",
      value: formatCurrency(maxOffer),
    },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-gray-800">Results</h2>

      <div className="flex flex-col gap-3">
        {rows.map(({ label, tooltip, value, valueClass }) => (
          <div key={label} className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
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
        ))}
      </div>

      {verdict !== null && (
        <div className="mt-5">
          <Tooltip text="Indicates whether the deal meets the 70% rule criteria.">
            <div
              className={`flex w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-bold tracking-wide ${
                verdict === "DEAL"
                  ? "bg-green-50 text-green-700 ring-1 ring-green-200"
                  : "bg-red-50 text-red-700 ring-1 ring-red-200"
              }`}
            >
              {verdict === "DEAL" ? "✓ DEAL" : "✗ NO DEAL"}
            </div>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
