"use client"

import { useEffect, useState } from "react"
import { formatLabel } from "@/lib/formatters"
import type { EvidenceLiteRecord } from "@/types/evidence-lite"

type Props = {
  savedDealId: string
  dealAddress?: string
}

const LABEL_OVERRIDES: Record<string, string> = {
  SOLD_COMP: "Sold comparables",
  TITLE_REVIEW: "Title review",
  TITLE: "Title",
  LEASEHOLD: "Leasehold",
  LEASEHOLD_REVIEW: "Leasehold review",
  PLANNING_BUILDING_CONTROL: "Planning / building control",
  REFURB_NOTE: "Refurb note",
  BUILDER_QUOTE: "Builder quote",
  SURVEY_NOTE: "Survey note",
  LENDER_NOTE: "Lender note",
  RENTAL_DEMAND: "Rental demand",
  SOLICITOR_REVIEW: "Solicitor Review",
  SOLICITOR_FEEDBACK: "Solicitor Review",
  SOLD_COMPS: "Sold comparables",
  BUILDER_PROPOSAL_CONTRACT: "Builder proposal / contract",
  DAMP_STRUCTURAL: "Damp / structural",
  LENDER_CRITERIA: "Lender criteria",
  REFURB_CERTAINTY: "Refurb certainty",
}

function labelFor(value: string): string {
  return LABEL_OVERRIDES[value] ?? formatLabel(value)
}

function formatTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`
}

async function readJsonResponse<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T
  } catch {
    return null
  }
}

function buildRouteUrl(savedDealId: string): string {
  return `/api/saved-deals/${encodeURIComponent(savedDealId.trim())}/evidence`
}

function getLoadErrorMessage(): string {
  return "Evidence Lite could not be loaded right now. Investor Shield requirements are unchanged."
}

function buildValidationMessage(
  payload:
    | {
        error?: string
        validation?: { errors?: Array<{ field: string; message: string }> }
      }
    | null,
  fallback: string
): string {
  const validationMessage = payload?.validation?.errors?.find((entry) => entry.message.trim().length > 0)?.message
  return validationMessage ?? payload?.error ?? fallback
}

export async function loadEvidenceLiteRecords(
  savedDealId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<EvidenceLiteRecord[]> {
  const response = await fetchImpl(buildRouteUrl(savedDealId), {
    headers: { accept: "application/json" },
  })

  const payload = await readJsonResponse<{
    success?: boolean
    evidence?: EvidenceLiteRecord[]
    error?: string
    validation?: { errors?: Array<{ field: string; message: string }> }
  }>(response)

  if (!response.ok || !payload?.success || !Array.isArray(payload.evidence)) {
    throw new Error(buildValidationMessage(payload, `Evidence Lite load failed (${response.status})`))
  }

  return payload.evidence
}

function getStatusBadgeClassName(status: EvidenceLiteRecord["status"]): string {
  switch (status) {
    case "MISSING":
      return "border-amber-300 bg-amber-50 text-amber-900"
    case "RECORDED":
      return "border-sky-300 bg-sky-50 text-sky-900"
    case "REVIEWED":
      return "border-slate-300 bg-slate-100 text-slate-900"
    case "VERIFIED":
      return "border-emerald-300 bg-emerald-50 text-emerald-900"
    case "REJECTED":
      return "border-rose-300 bg-rose-50 text-rose-900"
    default:
      return "border-gray-300 bg-gray-50 text-gray-900"
  }
}

export default function EvidenceLitePanel({ savedDealId, dealAddress }: Props) {
  const [records, setRecords] = useState<EvidenceLiteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      setError(null)

      try {
        const evidence = await loadEvidenceLiteRecords(savedDealId)
        if (!cancelled) {
          setRecords(evidence)
        }
      } catch {
        if (!cancelled) {
          setError(getLoadErrorMessage())
          setRecords([])
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [savedDealId])

  return (
    <section
      aria-busy={loading}
      className="rounded border border-gray-200 bg-white px-3 py-3 shadow-sm"
    >
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Evidence Lite</p>
            <h3 className="text-sm font-semibold text-gray-900">Evidence notes</h3>
            <p className="mt-1 text-sm text-gray-600">
              Deal-linked evidence notes for review and follow-up. Evidence Lite is
              read-only and informational only. It does not satisfy, waive, approve,
              or override Investor Shield requirements.
            </p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Evidence Lite does not replace required Investor Shield evidence.
          </div>
        </div>

        {dealAddress ? (
          <p className="text-xs text-gray-500">
            Saved deal: {dealAddress} <span className="text-gray-400">({savedDealId})</span>
          </p>
        ) : (
          <p className="text-xs text-gray-500">Saved deal id: {savedDealId}</p>
        )}

        <div aria-live="polite" className="min-h-5 text-sm">
          {loading ? (
            <p className="text-gray-500" role="status">
              Loading Evidence Lite records...
            </p>
          ) : null}
          {error ? (
            <p className="text-red-700" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
          <h4 className="text-sm font-semibold text-gray-900">Recorded evidence</h4>
          {!loading && records.length === 0 ? (
            <div className="mt-2 space-y-1">
              <p className="text-sm text-gray-700">
                No Evidence Lite records have been added for this deal.
              </p>
              <p className="text-sm text-gray-500">
                Evidence Lite does not replace required Investor Shield evidence.
              </p>
            </div>
          ) : null}

          {records.length > 0 ? (
            <div className="mt-3 space-y-2">
              {records.map((record) => (
                <article key={record.id} className="rounded border border-gray-200 bg-white px-3 py-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h5 className="text-sm font-semibold text-gray-900">{record.title}</h5>
                      <p className="mt-1 break-all text-xs text-gray-500">Evidence ID: {record.id}</p>
                      <p className="text-xs text-gray-600">
                        Evidence type: {labelFor(record.evidenceType)}
                      </p>
                      <p className="text-xs text-gray-600">
                        Linked gate: {labelFor(record.linkedGate)}
                      </p>
                    </div>
                    <div className="text-xs text-gray-500 sm:text-right">
                      <p>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 font-semibold tracking-wide ${getStatusBadgeClassName(record.status)}`}
                        >
                          {record.status}
                        </span>
                      </p>
                      <p className="mt-1">{record.reviewed ? "Reviewed" : "Not reviewed"}</p>
                      <p>
                        Created {formatTimestamp(record.createdAt)} <span className="text-gray-300">|</span> Updated{" "}
                        {formatTimestamp(record.updatedAt)}
                      </p>
                    </div>
                  </div>

                  {record.note ? <p className="mt-2 break-words text-sm text-gray-700">{record.note}</p> : null}
                  {record.reviewerNote ? (
                    <p className="mt-2 break-words text-sm text-gray-600">
                      Reviewer note: {record.reviewerNote}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
}
