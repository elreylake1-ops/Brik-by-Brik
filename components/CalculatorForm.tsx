"use client"

import { useState } from "react"
import type { DealInputs } from "@/types/deal"
import Tooltip from "@/components/Tooltip"
import { formatCurrency, formatWithCommas } from "@/lib/formatters"

type Props = {
  values: DealInputs
  onChange: (field: keyof DealInputs, value: string) => void
}

const fields: { key: keyof DealInputs; label: string; tooltip: string }[] = [
  {
    key: "purchasePrice",
    label: "Purchase Price (£)",
    tooltip: "What you plan to pay for the property.",
  },
  {
    key: "gdv",
    label: "GDV — Gross Development Value (£)",
    tooltip: "Estimated value of the property after refurbishment (ARV).",
  },
  {
    key: "refurbCost",
    label: "Refurb Cost (£)",
    tooltip: "Estimated cost to renovate or improve the property.",
  },
]

export default function CalculatorForm({ values, onChange }: Props) {
  const [focused, setFocused] = useState<keyof DealInputs | null>(null)

  function getDisplayValue(key: keyof DealInputs): string {
    if (focused === key) return formatWithCommas(values[key])
    return values[key] === 0 ? "" : formatCurrency(values[key])
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-gray-800">Deal Inputs</h2>
      <div className="flex flex-col gap-4">
        {fields.map(({ key, label, tooltip }) => (
          <div key={key}>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-gray-600">
              {label}
              <Tooltip text={tooltip}>
                <span className="cursor-default text-gray-400 hover:text-gray-600">ⓘ</span>
              </Tooltip>
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={getDisplayValue(key)}
              onFocus={() => setFocused(key)}
              onBlur={() => setFocused(null)}
              onChange={(e) => onChange(key, e.target.value.replace(/,/g, ""))}
              placeholder="£0.00"
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
