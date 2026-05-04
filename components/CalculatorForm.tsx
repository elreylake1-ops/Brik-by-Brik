"use client"

import { useState } from "react"
import type { DealInputs } from "@/types/deal"
import Tooltip from "@/components/Tooltip"
import { formatCurrency, formatWithCommas } from "@/lib/formatters"

type Props = {
  values: DealInputs
  onChange: (field: keyof DealInputs, value: string) => void
}

type FieldConfig = {
  key: keyof DealInputs
  label: string
  tooltip: string
  isCurrency: boolean
  unit?: string
}

const fields: FieldConfig[] = [
  {
    key: "purchasePrice",
    label: "Purchase Price (£)",
    tooltip: "What you plan to pay for the property.",
    isCurrency: true,
  },
  {
    key: "gdv",
    label: "GDV — Gross Development Value (£)",
    tooltip: "Estimated value of the property after refurbishment (ARV).",
    isCurrency: true,
  },
  {
    key: "refurbCost",
    label: "Refurb Cost (£)",
    tooltip: "Estimated cost to renovate or improve the property.",
    isCurrency: true,
  },
  {
    key: "stampDuty",
    label: "Stamp Duty (£)",
    tooltip: "Stamp Duty Land Tax payable on purchase.",
    isCurrency: true,
  },
  {
    key: "legalCosts",
    label: "Legal Costs (£)",
    tooltip: "Solicitor and conveyancing fees.",
    isCurrency: true,
  },
  {
    key: "saleCosts",
    label: "Sale Costs (£)",
    tooltip: "Agent fees and other costs incurred on sale.",
    isCurrency: true,
  },
  {
    key: "bridgeTermMonths",
    label: "Bridge Term (months)",
    tooltip: "Duration of the bridging loan in months. Used to calculate finance cost.",
    isCurrency: false,
    unit: "months",
  },
]

export default function CalculatorForm({ values, onChange }: Props) {
  const [focused, setFocused] = useState<keyof DealInputs | null>(null)

  function getDisplayValue(key: keyof DealInputs, isCurrency: boolean, unit?: string): string {
    const val = values[key]
    if (isCurrency) {
      if (focused === key) return formatWithCommas(val)
      return val === 0 ? "" : formatCurrency(val)
    } else {
      if (focused === key) return val === 0 ? "" : String(val)
      return val === 0 ? "" : unit ? `${val} ${unit}` : String(val)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-semibold text-gray-800">Deal Inputs</h2>
      <div className="flex flex-col gap-4">
        {fields.map(({ key, label, tooltip, isCurrency, unit }) => (
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
              value={getDisplayValue(key, isCurrency, unit)}
              onFocus={() => setFocused(key)}
              onBlur={() => setFocused(null)}
              onChange={(e) => onChange(key, e.target.value.replace(/,/g, "").replace(/[^0-9.]/g, ""))}
              placeholder={isCurrency ? "£0.00" : "0"}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
