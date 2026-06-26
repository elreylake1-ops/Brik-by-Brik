"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { formatLabel } from "@/lib/formatters"
import {
  EVIDENCE_LITE_EVIDENCE_TYPES,
  EVIDENCE_LITE_GATES,
  EVIDENCE_LITE_STATUSES,
} from "@/types/evidence-lite"
import type {
  EvidenceLiteEvidenceType,
  EvidenceLiteGateKey,
  EvidenceLiteRecord,
  EvidenceLiteStatus,
} from "@/types/evidence-lite"

type EvidenceLiteDraft = {
  evidenceType: EvidenceLiteEvidenceType
  linkedGate: EvidenceLiteGateKey
  title: string
  note: string
  status: EvidenceLiteStatus
  reviewed: boolean
}

type Props = {
  savedDealId: string
  dealAddress?: string
}

const DEFAULT_DRAFT: EvidenceLiteDraft = {
  evidenceType: "TITLE_REVIEW",
  linkedGate: "TITLE",
  title: "",
  note: "",
  status: "MISSING",
  reviewed: false,
}

const LABEL_OVERRIDES: Record<string, string> = {
  MISSING: "Missing",
  RECORDED: "Recorded",
  REVIEWED: "Reviewed",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  SOLD_COMP: "Sold comparables",
  TITLE_REVIEW: "Title review",
  LEASEHOLD_REVIEW: "Leasehold review",
  PLANNING_BUILDING_CONTROL: "Planning / building control",
  REFURB_NOTE: "Refurb note",
  BUILDER_QUOTE: "Builder quote",
  SURVEY_NOTE: "Survey note",
  LENDER_NOTE: "Lender note",
  RENTAL_DEMAND: "Rental demand",
  SOLICITOR_REVIEW: "Solicitor review",
  SOLD_COMPS: "Sold comparables",
  BUILDER_PROPOSAL_CONTRACT: "Builder proposal / contract",
  DAMP_STRUCTURAL: "Damp / structural",
  LENDER_CRITERIA: "Lender criteria",
  REFURB_CERTAINTY: "Refurb certainty",
}

function labelFor(value: string): string {
  return LABEL_OVERRIDES[value] ?? formatLabel(value)
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

export async function loadEvidenceLiteRecords(
  savedDealId: string,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<EvidenceLiteRecord[]> {
  const response = await fetchImpl(buildRouteUrl(savedDealId), {
    headers: { accept: "application/json" },
  })

  const payload = await readJsonResponse<{ success?: boolean; evidence?: EvidenceLiteRecord[]; error?: string }>(
    response
  )

  if (!response.ok || !payload?.success || !Array.isArray(payload.evidence)) {
    throw new Error(payload?.error ?? `Evidence Lite load failed (${response.status})`)
  }

  return payload.evidence
}

export async function submitEvidenceLiteRecord(
  savedDealId: string,
  draft: EvidenceLiteDraft,
  fetchImpl: typeof fetch = globalThis.fetch
): Promise<EvidenceLiteRecord> {
  const response = await fetchImpl(buildRouteUrl(savedDealId), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(draft),
  })

  const payload = await readJsonResponse<{ success?: boolean; evidence?: EvidenceLiteRecord; error?: string }>(
    response
  )

  if (!response.ok || !payload?.success || !payload.evidence) {
    throw new Error(payload?.error ?? `Evidence Lite submit failed (${response.status})`)
  }

  return payload.evidence
}

function evidenceSummary(record: EvidenceLiteRecord): string {
  return [
    `Status: ${labelFor(record.status)}`,
    `Gate: ${labelFor(record.linkedGate)}`,
    `Reviewed: ${record.reviewed ? "Yes" : "No"}`,
  ].join(" | ")
}

export default function EvidenceLitePanel({ savedDealId, dealAddress }: Props) {
  const [records, setRecords] = useState<EvidenceLiteRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submissionMessage, setSubmissionMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [draft, setDraft] = useState<EvidenceLiteDraft>(DEFAULT_DRAFT)

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
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Evidence Lite load failed.")
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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setSubmissionMessage(null)

    try {
      await submitEvidenceLiteRecord(savedDealId, draft)
      const evidence = await loadEvidenceLiteRecords(savedDealId)
      setRecords(evidence)
      setSubmissionMessage("Evidence note recorded for local review only.")
      setDraft(DEFAULT_DRAFT)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Evidence Lite submit failed.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded border border-gray-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Evidence Lite</p>
            <h3 className="text-sm font-semibold text-gray-900">Development-only review panel</h3>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Evidence supports review only. Adding evidence does not satisfy or waive an Investor Shield gate.
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
          {loading ? <p className="text-gray-500">Loading Evidence Lite notes...</p> : null}
          {error ? <p className="text-red-700">{error}</p> : null}
          {submissionMessage ? <p className="text-green-700">{submissionMessage}</p> : null}
        </div>

        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
          <h4 className="text-sm font-semibold text-gray-900">Recorded evidence</h4>
          {!loading && records.length === 0 ? (
            <p className="mt-2 text-sm text-gray-700">No Evidence Lite records yet.</p>
          ) : null}

          {records.length > 0 ? (
            <div className="mt-3 space-y-2">
              {records.map((record) => (
                <article key={record.id} className="rounded border border-gray-200 bg-white px-3 py-2">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h5 className="text-sm font-semibold text-gray-900">{record.title}</h5>
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        {labelFor(record.evidenceType)} · {labelFor(record.linkedGate)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">{evidenceSummary(record)}</p>
                  </div>
                  {record.note ? <p className="mt-2 text-sm text-gray-700">{record.note}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} className="rounded border border-gray-200 bg-gray-50 px-3 py-3">
          <h4 className="text-sm font-semibold text-gray-900">Record a note</h4>
          <p className="mt-1 text-xs text-gray-500">
            Local-only helper for development review. It does not change governance or gate state.
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs uppercase tracking-wide text-gray-500">Evidence Type</span>
              <select
                value={draft.evidenceType}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, evidenceType: event.target.value as EvidenceLiteEvidenceType }))
                }
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {EVIDENCE_LITE_EVIDENCE_TYPES.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs uppercase tracking-wide text-gray-500">Linked Gate</span>
              <select
                value={draft.linkedGate}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, linkedGate: event.target.value as EvidenceLiteGateKey }))
                }
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {EVIDENCE_LITE_GATES.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs uppercase tracking-wide text-gray-500">Title</span>
              <input
                value={draft.title}
                onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                placeholder="Short evidence title"
                required
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              <span className="text-xs uppercase tracking-wide text-gray-500">Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, status: event.target.value as EvidenceLiteStatus }))
                }
                className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
              >
                {EVIDENCE_LITE_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {labelFor(value)}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700 sm:col-span-2">
              <span className="text-xs uppercase tracking-wide text-gray-500">Note</span>
              <textarea
                value={draft.note}
                onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                className="min-h-24 rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
                placeholder="Optional local review note"
              />
            </label>
          </div>

          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={draft.reviewed}
              onChange={(event) => setDraft((current) => ({ ...current, reviewed: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            Mark as reviewed
          </label>

          <div className="mt-3 flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting || !draft.title.trim()}
              className="rounded border border-gray-300 bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Recording..." : "Record Evidence"}
            </button>
            <p className="text-xs text-gray-500">The panel reloads the evidence list after a successful submit.</p>
          </div>
        </form>
      </div>
    </section>
  )
}
