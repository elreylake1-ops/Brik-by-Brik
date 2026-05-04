"use client"

import { useState } from "react"
import CalculatorForm from "@/components/CalculatorForm"
import ResultsDisplay from "@/components/ResultsDisplay"
import { analyzeDeal } from "@/lib/calculations"
import type { DealInputs } from "@/types/deal"

const defaultInputs: DealInputs = {
  purchasePrice: 0,
  gdv: 0,
  refurbCost: 0,
  stampDuty: 0,
  legalCosts: 0,
  saleCosts: 0,
  bridgeTermMonths: 0,
}

export default function Home() {
  const [inputs, setInputs] = useState<DealInputs>(defaultInputs)

  function handleChange(field: keyof DealInputs, raw: string) {
    const value = raw === "" ? 0 : Math.max(0, parseFloat(raw) || 0)
    setInputs((prev) => ({ ...prev, [field]: value }))
  }

  const result = analyzeDeal(inputs)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Brik Engine v1</h1>
          <p className="mt-1 text-sm text-gray-500">Phase 1 — Deal Analysis Calculator</p>
          <p className="mt-2 text-sm text-gray-400">by Lake Views Property</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <CalculatorForm values={inputs} onChange={handleChange} />
          <ResultsDisplay result={result} />
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-400">© Lake Views Property</p>
          <p className="mt-1 text-xs text-gray-400">For guidance only. Not financial advice.</p>
        </div>
      </div>
    </main>
  )
}
