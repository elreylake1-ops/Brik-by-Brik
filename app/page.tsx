"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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

type SavedDealListItem = {
  id: string
  address: string
  classification: string
  pipeline_state: string
  created_at: string
}

type SavedDealDetail = {
  id: string
  address: string
  classification: string
  governance_state: string
  capital_protection_state: string
  pipeline_state: string
  purchase_price: number | null
  gdv_realistic: number | null
  refurb_cost: number | null
  next_action: string | null
  engine_result_json: Record<string, unknown>
}

type DealOfferListItem = {
  id: string
  offer_amount: number
  offer_type: string
  offer_status: string
  offer_rationale: string | null
  seller_response: string | null
  created_at: string
}

export default function Home() {
  const PIPELINE_STATE_OPTIONS = [
    "UNDER_ANALYSIS",
    "READY_FOR_OFFER",
    "OFFER_SENT",
    "NEGOTIATING",
    "DUE_DILIGENCE",
    "COMPLETED",
    "REJECTED",
    "ARCHIVED",
  ] as const

  const [inputs, setInputs] = useState<DealInputs>(defaultInputs)
  const [useScope, setUseScope] = useState(false)
  const [scope, setScope] = useState<RefurbScopeInput>(defaultScope)
  const [saveAddress, setSaveAddress] = useState("")
  const [saveListingUrl, setSaveListingUrl] = useState("")
  const [saveNextAction, setSaveNextAction] = useState("")
  const [isSavingDeal, setIsSavingDeal] = useState(false)
  const [saveDealSuccessId, setSaveDealSuccessId] = useState<string | null>(null)
  const [saveDealError, setSaveDealError] = useState<string | null>(null)
  const [savedDeals, setSavedDeals] = useState<SavedDealListItem[]>([])
  const [isLoadingSavedDeals, setIsLoadingSavedDeals] = useState(true)
  const [savedDealsError, setSavedDealsError] = useState<string | null>(null)
  const [selectedSavedDeal, setSelectedSavedDeal] = useState<SavedDealDetail | null>(null)
  const [isLoadingSelectedSavedDeal, setIsLoadingSelectedSavedDeal] = useState(false)
  const [selectedSavedDealError, setSelectedSavedDealError] = useState<string | null>(null)
  const [selectedPipelineState, setSelectedPipelineState] = useState<string>("UNDER_ANALYSIS")
  const [isUpdatingPipeline, setIsUpdatingPipeline] = useState(false)
  const [pipelineUpdateMessage, setPipelineUpdateMessage] = useState<string | null>(null)
  const [pipelineUpdateError, setPipelineUpdateError] = useState<string | null>(null)
  const [offers, setOffers] = useState<DealOfferListItem[]>([])
  const [isLoadingOffers, setIsLoadingOffers] = useState(false)
  const [offersError, setOffersError] = useState<string | null>(null)
  const [offerAmount, setOfferAmount] = useState("")
  const [offerType, setOfferType] = useState("INITIAL")
  const [offerStatus, setOfferStatus] = useState("DRAFT")
  const [offerRationale, setOfferRationale] = useState("")
  const [sellerResponse, setSellerResponse] = useState("")
  const [isAddingOffer, setIsAddingOffer] = useState(false)
  const [addOfferMessage, setAddOfferMessage] = useState<string | null>(null)
  const [addOfferError, setAddOfferError] = useState<string | null>(null)
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

  const loadSavedDeals = useCallback(async () => {
    setIsLoadingSavedDeals(true)
    setSavedDealsError(null)

    try {
      const response = await fetch("/api/saved-deals")
      const payload = await response.json()

      if (!response.ok || !payload?.success || !Array.isArray(payload?.deals)) {
        setSavedDeals([])
        setSavedDealsError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to load saved deals at this time."
        )
        return
      }

      setSavedDeals(payload.deals as SavedDealListItem[])
    } catch {
      setSavedDeals([])
      setSavedDealsError("Unable to load saved deals at this time.")
    } finally {
      setIsLoadingSavedDeals(false)
    }
  }, [])

  useEffect(() => {
    const loadTimer = window.setTimeout(() => {
      void loadSavedDeals()
    }, 0)

    return () => {
      window.clearTimeout(loadTimer)
    }
  }, [loadSavedDeals])

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

  async function handleSaveDeal() {
    if (isSavingDeal) {
      return
    }

    if (!saveAddress.trim()) {
      setSaveDealSuccessId(null)
      setSaveDealError("Address is required before saving.")
      return
    }

    setIsSavingDeal(true)
    setSaveDealSuccessId(null)
    setSaveDealError(null)

    const classification =
      result.dueDiligence?.decision.dealClassification ?? result.verdict.status
    const governanceState = result.verdict.status
    const capitalProtectionState =
      result.dueDiligence?.decision.capitalProtectionStatus ?? "UNKNOWN"
    const refurbCost =
      result.refurbSource === "generated"
        ? (result.refurb?.totalRefurbCost ?? inputs.refurbCost)
        : inputs.refurbCost
    const riskSummary = {
      riskFlags: result.dueDiligence?.decision.riskFlags ?? [],
      warnings: result.warnings,
    }

    try {
      const response = await fetch("/api/saved-deals", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: saveAddress.trim(),
          listing_url: saveListingUrl.trim() || null,
          purchase_price: inputs.purchasePrice,
          gdv_realistic: inputs.gdv,
          refurb_cost: refurbCost,
          classification,
          governance_state: governanceState,
          capital_protection_state: capitalProtectionState,
          pipeline_state: "UNDER_ANALYSIS",
          engine_result_json: result,
          risk_summary_json: riskSummary,
          next_action: saveNextAction.trim() || null,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        setSaveDealError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to save deal at this time."
        )
        return
      }

      setSaveDealSuccessId(payload.deal?.id ?? null)
      await loadSavedDeals()
    } catch {
      setSaveDealError("Unable to save deal at this time.")
    } finally {
      setIsSavingDeal(false)
    }
  }

  function formatSavedDealCreatedAt(value: string): string {
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) {
      return value
    }

    return parsed.toLocaleString()
  }

  async function loadOffersForDeal(dealId: string) {
    setIsLoadingOffers(true)
    setOffersError(null)

    try {
      const response = await fetch(`/api/saved-deals/${encodeURIComponent(dealId)}/offers`)
      const payload = await response.json()

      if (!response.ok || !payload?.success || !Array.isArray(payload?.offers)) {
        setOffers([])
        setOffersError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to load offers at this time."
        )
        return
      }

      setOffers(payload.offers as DealOfferListItem[])
    } catch {
      setOffers([])
      setOffersError("Unable to load offers at this time.")
    } finally {
      setIsLoadingOffers(false)
    }
  }

  function formatCurrency(value: number | null): string {
    if (typeof value !== "number") {
      return "N/A"
    }

    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(value)
  }

  async function handleViewSavedDeal(id: string) {
    if (isLoadingSelectedSavedDeal) {
      return
    }

    setIsLoadingSelectedSavedDeal(true)
    setSelectedSavedDealError(null)

    try {
      const response = await fetch(`/api/saved-deals/${encodeURIComponent(id)}`)
      const payload = await response.json()

      if (!response.ok || !payload?.success || typeof payload?.deal !== "object" || !payload.deal) {
        setSelectedSavedDeal(null)
        setSelectedSavedDealError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to load saved deal at this time."
        )
        return
      }

      setSelectedSavedDeal(payload.deal as SavedDealDetail)
      setSelectedPipelineState(payload.deal.pipeline_state ?? "UNDER_ANALYSIS")
      setPipelineUpdateMessage(null)
      setPipelineUpdateError(null)
      setAddOfferMessage(null)
      setAddOfferError(null)
      setOfferAmount("")
      setOfferType("INITIAL")
      setOfferStatus("DRAFT")
      setOfferRationale("")
      setSellerResponse("")
      await loadOffersForDeal(id)
    } catch {
      setSelectedSavedDeal(null)
      setSelectedSavedDealError("Unable to load saved deal at this time.")
      setOffers([])
      setOffersError(null)
    } finally {
      setIsLoadingSelectedSavedDeal(false)
    }
  }

  async function handleAddOffer() {
    if (!selectedSavedDeal || isAddingOffer) {
      return
    }

    const parsedAmount = Number(offerAmount)
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setAddOfferMessage(null)
      setAddOfferError("Offer amount is required and must be a valid number.")
      return
    }

    setIsAddingOffer(true)
    setAddOfferMessage(null)
    setAddOfferError(null)

    try {
      const response = await fetch(`/api/saved-deals/${encodeURIComponent(selectedSavedDeal.id)}/offers`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offer_amount: parsedAmount,
          offer_type: offerType,
          offer_status: offerStatus,
          offer_rationale: offerRationale.trim() || null,
          seller_response: sellerResponse.trim() || null,
        }),
      })

      const payload = await response.json()
      if (!response.ok || !payload?.success) {
        setAddOfferError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to add offer at this time."
        )
        return
      }

      setAddOfferMessage("Offer added.")
      setOfferAmount("")
      setOfferType("INITIAL")
      setOfferStatus("DRAFT")
      setOfferRationale("")
      setSellerResponse("")
      await loadOffersForDeal(selectedSavedDeal.id)
    } catch {
      setAddOfferError("Unable to add offer at this time.")
    } finally {
      setIsAddingOffer(false)
    }
  }

  async function handleUpdatePipeline() {
    if (!selectedSavedDeal || isUpdatingPipeline) {
      return
    }

    setIsUpdatingPipeline(true)
    setPipelineUpdateMessage(null)
    setPipelineUpdateError(null)

    try {
      const response = await fetch(`/api/saved-deals/${encodeURIComponent(selectedSavedDeal.id)}/pipeline`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requested_pipeline_state: selectedPipelineState }),
      })

      const payload = await response.json()

      if (!response.ok || !payload?.success) {
        setPipelineUpdateError(
          typeof payload?.error === "string"
            ? payload.error
            : "Unable to update pipeline at this time."
        )
        return
      }

      setPipelineUpdateMessage(`Pipeline updated to ${payload.deal?.pipeline_state ?? selectedPipelineState}.`)
      await Promise.all([
        handleViewSavedDeal(selectedSavedDeal.id),
        loadSavedDeals(),
      ])
    } catch {
      setPipelineUpdateError("Unable to update pipeline at this time.")
    } finally {
      setIsUpdatingPipeline(false)
    }
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
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 20 20"
                      fill="none"
                      className={`ml-2 h-4 w-4 flex-shrink-0 text-gray-500 transition-transform ${
                        presetDropdownOpen ? "rotate-180" : ""
                      }`}
                    >
                      <path
                        d="M6 8l4 4 4-4"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
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

        {hasDealInput && (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-gray-800">Save Current Deal</h2>
            <p className="mt-1 text-xs text-gray-500">
              Saves the current analysed deal snapshot only. No reopen/list actions are added in this step.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-sm font-medium text-gray-600">Address</span>
                <input
                  type="text"
                  value={saveAddress}
                  onChange={(e) => setSaveAddress(e.target.value)}
                  placeholder="Property address"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-600">Listing URL (optional)</span>
                <input
                  type="text"
                  value={saveListingUrl}
                  onChange={(e) => setSaveListingUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-gray-600">Next Action (optional)</span>
                <input
                  type="text"
                  value={saveNextAction}
                  onChange={(e) => setSaveNextAction(e.target.value)}
                  placeholder="Short action note"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveDeal}
                disabled={isSavingDeal}
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingDeal ? "Saving..." : "Save Deal"}
              </button>

              {saveDealSuccessId && (
                <p className="text-sm text-green-700">Saved deal id: {saveDealSuccessId}</p>
              )}
              {saveDealError && <p className="text-sm text-red-700">{saveDealError}</p>}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Saved Deals</h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only saved deals list. Reopen/detail behavior is intentionally not added in this step.
          </p>

          {isLoadingSavedDeals ? (
            <p className="mt-4 text-sm text-gray-500">Loading saved deals...</p>
          ) : savedDealsError ? (
            <p className="mt-4 text-sm text-red-700">{savedDealsError}</p>
          ) : savedDeals.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No saved deals yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Address</th>
                    <th className="px-3 py-2">Classification</th>
                    <th className="px-3 py-2">Pipeline</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {savedDeals.map((deal) => (
                    <tr key={deal.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-gray-900">{deal.address}</td>
                      <td className="px-3 py-2 text-gray-700">{deal.classification}</td>
                      <td className="px-3 py-2 text-gray-700">{deal.pipeline_state}</td>
                      <td className="px-3 py-2 text-gray-700">{formatSavedDealCreatedAt(deal.created_at)}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => void handleViewSavedDeal(deal.id)}
                          disabled={isLoadingSelectedSavedDeal}
                          className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800">Saved Deal Detail</h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only saved deal detail. No edit, archive, pipeline, or calculator reload behavior is added in this step.
          </p>

          {isLoadingSelectedSavedDeal ? (
            <p className="mt-4 text-sm text-gray-500">Loading saved deal detail...</p>
          ) : selectedSavedDealError ? (
            <p className="mt-4 text-sm text-red-700">{selectedSavedDealError}</p>
          ) : !selectedSavedDeal ? (
            <p className="mt-4 text-sm text-gray-500">Select a saved deal from the list to view read-only detail.</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Address</p>
                  <p className="text-sm text-gray-900">{selectedSavedDeal.address}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Classification</p>
                  <p className="text-sm text-gray-900">{selectedSavedDeal.classification}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Governance State</p>
                  <p className="text-sm text-gray-900">{selectedSavedDeal.governance_state}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Capital Protection State</p>
                  <p className="text-sm text-gray-900">{selectedSavedDeal.capital_protection_state}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Pipeline State</p>
                  <p className="text-sm text-gray-900">{selectedSavedDeal.pipeline_state}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Next Action</p>
                  <p className="text-sm text-gray-900">{selectedSavedDeal.next_action ?? "N/A"}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Purchase Price</p>
                  <p className="text-sm text-gray-900">{formatCurrency(selectedSavedDeal.purchase_price)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">GDV Realistic</p>
                  <p className="text-sm text-gray-900">{formatCurrency(selectedSavedDeal.gdv_realistic)}</p>
                </div>
                <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 sm:col-span-2">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Refurb Cost</p>
                  <p className="text-sm text-gray-900">{formatCurrency(selectedSavedDeal.refurb_cost)}</p>
                </div>
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                <p className="text-xs uppercase tracking-wide text-gray-500">Saved Engine Snapshot</p>
                <p className="mt-1 text-sm text-gray-700">
                  Stored keys: {Object.keys(selectedSavedDeal.engine_result_json ?? {}).length}
                </p>
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Pipeline Update</p>
                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    value={selectedPipelineState}
                    onChange={(event) => setSelectedPipelineState(event.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-auto"
                  >
                    {PIPELINE_STATE_OPTIONS.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleUpdatePipeline()}
                    disabled={isUpdatingPipeline}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isUpdatingPipeline ? "Updating..." : "Update Pipeline"}
                  </button>
                </div>
                {pipelineUpdateMessage && (
                  <p className="mt-2 text-sm text-green-700">{pipelineUpdateMessage}</p>
                )}
                {pipelineUpdateError && (
                  <p className="mt-2 text-sm text-red-700">{pipelineUpdateError}</p>
                )}
              </div>

              <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Offers</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Offer Amount</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={offerAmount}
                      onChange={(event) => setOfferAmount(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Offer Type</span>
                    <input
                      type="text"
                      value={offerType}
                      onChange={(event) => setOfferType(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Offer Status</span>
                    <input
                      type="text"
                      value={offerStatus}
                      onChange={(event) => setOfferStatus(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-xs text-gray-600">Offer Rationale (optional)</span>
                    <input
                      type="text"
                      value={offerRationale}
                      onChange={(event) => setOfferRationale(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                  <label className="flex flex-col gap-1 sm:col-span-2">
                    <span className="text-xs text-gray-600">Seller Response (optional)</span>
                    <input
                      type="text"
                      value={sellerResponse}
                      onChange={(event) => setSellerResponse(event.target.value)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </label>
                </div>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => void handleAddOffer()}
                    disabled={isAddingOffer}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isAddingOffer ? "Adding..." : "Add Offer"}
                  </button>
                </div>
                {addOfferMessage && <p className="mt-2 text-sm text-green-700">{addOfferMessage}</p>}
                {addOfferError && <p className="mt-2 text-sm text-red-700">{addOfferError}</p>}

                <div className="mt-3">
                  {isLoadingOffers ? (
                    <p className="text-sm text-gray-500">Loading offers...</p>
                  ) : offersError ? (
                    <p className="text-sm text-red-700">{offersError}</p>
                  ) : offers.length === 0 ? (
                    <p className="text-sm text-gray-500">No offers yet.</p>
                  ) : (
                    <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                          <tr>
                            <th className="px-3 py-2">Amount</th>
                            <th className="px-3 py-2">Type</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Rationale</th>
                            <th className="px-3 py-2">Seller Response</th>
                            <th className="px-3 py-2">Created</th>
                          </tr>
                        </thead>
                        <tbody>
                          {offers.map((offer) => (
                            <tr key={offer.id} className="border-t border-gray-100">
                              <td className="px-3 py-2 text-gray-900">{formatCurrency(offer.offer_amount)}</td>
                              <td className="px-3 py-2 text-gray-700">{offer.offer_type}</td>
                              <td className="px-3 py-2 text-gray-700">{offer.offer_status}</td>
                              <td className="px-3 py-2 text-gray-700">{offer.offer_rationale ?? "N/A"}</td>
                              <td className="px-3 py-2 text-gray-700">{offer.seller_response ?? "N/A"}</td>
                              <td className="px-3 py-2 text-gray-700">{formatSavedDealCreatedAt(offer.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-10 border-t border-gray-200 pt-6 text-center">
          <p className="text-xs text-gray-400">(c) Lake Views Property</p>
          <p className="mt-1 text-xs text-gray-400">For guidance only. Not financial advice.</p>
        </div>
      </div>
    </main>
  )
}
