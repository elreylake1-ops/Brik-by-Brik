"use client"

import { useEffect, useState } from "react"
import type { ReactNode } from "react"
import InvestorSummaryPanel from "@/components/investor-summary/InvestorSummaryPanel"
import {
  fetchInvestorSummary,
  type FetchInvestorSummaryResult,
} from "@/lib/investor-summary/fetch-investor-summary"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"

type InvestorSummaryRoutePanelProps = {
  savedDealId: string | null | undefined
}

const INVALID_ID_MESSAGE = "Select a saved deal to view read-only Investor Summary."
const LOADING_MESSAGE = "Loading Investor Summary..."
const NOT_FOUND_MESSAGE = "Investor Summary not found for this saved deal."
const INVALID_MESSAGE = "Investor Summary deal id is invalid."
const SAFE_FAILURE_MESSAGE = "Investor Summary could not be loaded."

function mapFailureMessage(_result: Extract<FetchInvestorSummaryResult, { success: false }>): string {
  if (_result.status === 400) {
    return INVALID_MESSAGE
  }

  if (_result.status === 404) {
    return NOT_FOUND_MESSAGE
  }

  return SAFE_FAILURE_MESSAGE
}

function TraceId({ traceId }: { traceId: string }) {
  return <p className="mt-2 text-xs text-gray-500">Trace ID: {traceId}</p>
}

function RoutePanelShell({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="investor-summary-route-heading"
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <header className="border-b border-gray-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          Route-backed investor summary
        </p>
        <h3 id="investor-summary-route-heading" className="mt-2 text-lg font-semibold text-gray-900">
          Investor Summary
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          Read-only summary loaded from the approved GET route. No direct repository access is used here.
        </p>
      </header>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function InvestorSummaryRoutePanel({ savedDealId }: InvestorSummaryRoutePanelProps) {
  const [summary, setSummary] = useState<InvestorSummaryViewModel | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [traceId, setTraceId] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const nextSavedDealId = typeof savedDealId === "string" ? savedDealId.trim() : ""

    if (!nextSavedDealId) {
      return () => {
        active = false
      }
    }

    void (async () => {
      setLoading(true)
      setError(null)
      setTraceId(null)
      setSummary(null)

      const result = await fetchInvestorSummary(nextSavedDealId)

      if (!active) {
        return
      }

      if (result.success) {
        setSummary(result.investorSummary)
        setError(null)
        setTraceId(null)
      } else {
        setSummary(null)
        setError(mapFailureMessage(result))
        setTraceId(result.traceId ?? null)
      }

      setLoading(false)
    })()

    return () => {
      active = false
    }
  }, [savedDealId])

  if (summary) {
    return <InvestorSummaryPanel summary={summary} />
  }

  return (
    <RoutePanelShell>
      {!savedDealId?.trim() ? (
        <p className="text-sm text-gray-600">{INVALID_ID_MESSAGE}</p>
      ) : loading ? (
        <p className="text-sm text-gray-600">{LOADING_MESSAGE}</p>
      ) : error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-3">
          <p className="text-sm font-medium text-red-900">{error}</p>
          {traceId ? <TraceId traceId={traceId} /> : null}
        </div>
      ) : (
        <p className="text-sm text-gray-600">{INVALID_ID_MESSAGE}</p>
      )}
    </RoutePanelShell>
  )
}
