"use client"

import { useState } from "react"
import CalculatorForm from "@/components/CalculatorForm"
import ResultsDisplay from "@/components/ResultsDisplay"
import RefurbScopeForm from "@/components/RefurbScopeForm"
import RefurbBreakdownSummary from "@/components/RefurbBreakdownSummary"
import EngineAnalysisPanel from "@/components/EngineAnalysisPanel"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import type { DealInputs } from "@/types/deal"
import type { RefurbScopeInput } from "@/types/scope"

const defaultInputs: DealInputs = {
  purchasePrice: 0,
  gdv: 0,
  refurbCost: 0,
  stampDuty: 0,
  legalCosts: 0,
  saleCosts: 0,
  bridgeTermMonths: 0,
}

const defaultScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  kitchen: { scope: "keep", size: "medium" },
  bathroom: { scope: "cosmetic" },
  bedroom: { scope: "none" },
  flooring: { replaceWholeProperty: false },
  majorWorks: { rewire: false, boiler: false, roof: false },
}

const sampleDemoInputs: DealInputs = {
  purchasePrice: 120000,
  gdv: 200000,
  refurbCost: 25000,
  stampDuty: 3600,
  legalCosts: 2000,
  saleCosts: 3000,
  bridgeTermMonths: 6,
}

const sampleDemoScope: RefurbScopeInput = {
  bedrooms: 3,
  bathrooms: 1,
  floorAreaSqm: 80,
  kitchen: { scope: "full_replace", size: "medium" },
  bathroom: { scope: "full_replace" },
  bedroom: { scope: "cosmetic_refresh" },
  flooring: { replaceWholeProperty: true },
  majorWorks: { rewire: true, boiler: false, roof: false },
}

export default function Home() {
  const [inputs, setInputs] = useState<DealInputs>(defaultInputs)
  const [useScope, setUseScope] = useState(false)
  const [scope, setScope] = useState<RefurbScopeInput>(defaultScope)

  function handleChange(field: keyof DealInputs, raw: string) {
    const value = raw === "" ? 0 : Math.max(0, parseFloat(raw) || 0)
    setInputs((prev) => ({ ...prev, [field]: value }))
  }

  function loadSampleScenario() {
    setInputs(sampleDemoInputs)
    setScope(sampleDemoScope)
    setUseScope(true)
  }

  const result = analyzeDealWithRefurb(inputs, useScope ? scope : undefined)

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">Brik Engine v1</h1>
          <p className="mt-1 text-sm text-gray-500">Phase 1 - Deal Analysis Calculator</p>
          <p className="mt-2 text-sm text-gray-400">by Lake Views Property</p>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
          <button
            role="switch"
            aria-checked={useScope}
            onClick={() => setUseScope((v) => !v)}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
              useScope ? "bg-blue-600" : "bg-gray-200"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                useScope ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">
            Use task-based refurb scope
          </span>
          {useScope && (
            <span className="ml-auto rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-600">
              Active - refurb cost generated from scope
            </span>
          )}
        </div>

        <div className="mb-6 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={loadSampleScenario}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Load sample 3-bed terrace
            </button>
            <span className="text-xs text-gray-500">
              Demo preset uses mandatory Phase 1B sample scenario for quick client walkthrough.
            </span>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Manual mode uses your entered refurb cost. Scope mode calculates refurb cost from selected rooms, tasks, timeline, warnings, and assumptions.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <CalculatorForm
            values={inputs}
            onChange={handleChange}
            refurbScopeActive={useScope}
          />
          <ResultsDisplay result={result.deal} />
        </div>

        {useScope && (
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <RefurbScopeForm value={scope} onChange={setScope} />
            <RefurbBreakdownSummary
              refurb={result.refurb!}
              timeline={result.timeline!}
            />
          </div>
        )}

        <EngineAnalysisPanel inputs={inputs} result={result} />

        <div className="mt-10 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-400">(c) Lake Views Property</p>
          <p className="mt-1 text-xs text-gray-400">For guidance only. Not financial advice.</p>
        </div>
      </div>
    </main>
  )
}
