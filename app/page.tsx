"use client"

import { useState, useRef, useEffect } from "react"
import CalculatorForm from "@/components/CalculatorForm"
import ResultsDisplay from "@/components/ResultsDisplay"
import RefurbScopeForm from "@/components/RefurbScopeForm"
import RefurbBreakdownSummary from "@/components/RefurbBreakdownSummary"
import EngineAnalysisPanel from "@/components/EngineAnalysisPanel"
import { analyzeDealWithRefurb } from "@/lib/engine/analyze-deal-with-refurb"
import {
  CALCULATOR_WALKTHROUGH_PRESETS,
  getCalculatorWalkthroughPresetState,
} from "@/lib/calculator-walkthrough-presets"
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

export default function Home() {
  const [inputs, setInputs] = useState<DealInputs>(defaultInputs)
  const [useScope, setUseScope] = useState(false)
  const [scope, setScope] = useState<RefurbScopeInput>(defaultScope)
  const [selectedWalkthroughPresetId, setSelectedWalkthroughPresetId] = useState(
    CALCULATOR_WALKTHROUGH_PRESETS[0]?.id ?? ""
  )
  const [presetDropdownOpen, setPresetDropdownOpen] = useState(false)
  const presetDropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (presetDropdownRef.current && !presetDropdownRef.current.contains(event.target as Node)) {
        setPresetDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleChange(field: keyof DealInputs, raw: string) {
    const value = raw === "" ? 0 : Math.max(0, parseFloat(raw) || 0)
    setInputs((prev) => ({ ...prev, [field]: value }))
  }

  function loadSelectedWalkthroughPreset() {
    const presetState = getCalculatorWalkthroughPresetState(selectedWalkthroughPresetId)

    if (!presetState) {
      return
    }

    setInputs(presetState.inputs)
    setScope(presetState.scope)
    setUseScope(presetState.useScope)
  }

  const result = analyzeDealWithRefurb(inputs, useScope ? scope : undefined)

  const hasDealInput =
    inputs.purchasePrice > 0 ||
    inputs.gdv > 0 ||
    inputs.refurbCost > 0

  const selectedPresetLabel =
    CALCULATOR_WALKTHROUGH_PRESETS.find((p) => p.id === selectedWalkthroughPresetId)?.label ?? "Select preset"

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
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-700">Walkthrough preset</span>
                <div ref={presetDropdownRef} className="relative mt-1">
                  <button
                    type="button"
                    onClick={() => setPresetDropdownOpen((v) => !v)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 flex items-center justify-between"
                  >
                    <span>{selectedPresetLabel}</span>
                    <span className="ml-2 text-gray-400 text-xs">▾</span>
                  </button>
                  {presetDropdownOpen && (
                    <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden">
                      {CALCULATOR_WALKTHROUGH_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => {
                            setSelectedWalkthroughPresetId(preset.id)
                            setPresetDropdownOpen(false)
                          }}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 ${
                            preset.id === selectedWalkthroughPresetId
                              ? "bg-blue-50 text-blue-700 font-medium"
                              : "text-gray-900"
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={loadSelectedWalkthroughPreset}
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                Load selected walkthrough
              </button>
            </div>
            <p className="text-xs text-gray-500">
              These presets reproduce the validated live calculator walkthrough screenshots.
              Official Phase 2 fixture validation remains available at <code>/phase-2-live-review</code>.
            </p>
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
          {hasDealInput ? (
            <ResultsDisplay result={result.deal} />
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
              <p className="text-base font-semibold text-gray-500">No analysis yet</p>
              <p className="mt-2 text-sm text-gray-400">Enter deal inputs or load the demo scenario to generate results.</p>
            </div>
          )}
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

        {hasDealInput && <EngineAnalysisPanel inputs={inputs} result={result} />}

        <div className="mt-10 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-400">(c) Lake Views Property</p>
          <p className="mt-1 text-xs text-gray-400">For guidance only. Not financial advice.</p>
        </div>
      </div>
    </main>
  )
}
