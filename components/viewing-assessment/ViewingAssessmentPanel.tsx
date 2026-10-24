"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import ChecklistReview, { type CheckMeta } from "./ChecklistReview"
import ProposalCard, { type ReviewBody } from "./ProposalCard"
import VideoCapture from "./VideoCapture"
import VideoEvidencePanel from "./VideoEvidencePanel"
import { buildCheckStates } from "@/lib/viewing-assessment/check-states"
import { formatClock } from "@/lib/viewing-assessment/capture/capture-logic"
import type { OutcomeInput, ViewingAssessmentDetail, ViewingAssessmentRecord } from "@/types/viewing-assessment"

// Saved Deal viewing-assessment surface. Display and API calls only: no business logic, no financial figures, no
// Investor Shield. Simulated analysis is labelled everywhere it appears.
// Checklist wording is NOT imported here: the server supplies titles and groups only when reuse rights are approved
// (see app/saved-deals/[id]/viewing/page.tsx), so the third-party text never ships in the client bundle by default.

type Props = {
  dealId: string
  assessments: readonly ViewingAssessmentRecord[]
  detail: ViewingAssessmentDetail | null
  /** All checks, in order. Ids always; title and group only when approved for display. */
  checks: readonly CheckMeta[]
  fetchImpl?: typeof fetch
  /** Authentication headers from the login layer, once it exists. */
  headers?: () => Record<string, string>
}

const MOCK_CLIP = { filename: "mock-viewing-clip.mp4", mimeType: "video/mp4", sizeBytes: 1_000_000, durationSeconds: 60 }
const MOCK_FRAMES = [
  { timestampSeconds: 4, room: "Front elevation" },
  { timestampSeconds: 12, room: "Kitchen" },
  { timestampSeconds: 30, room: "Bedroom 1" },
]

const newKey = () => `ui-${crypto.randomUUID()}`
const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"

export default function ViewingAssessmentPanel({ dealId, assessments, detail, checks, fetchImpl, headers }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const base = `/api/saved-deals/${encodeURIComponent(dealId)}/viewing-assessments`

  async function call(url: string, body: unknown) {
    setBusy(true)
    setError(null)
    try {
      const res = await (fetchImpl ?? fetch)(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(headers?.() ?? {}) },
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string; reasons?: string[]; validation?: { errors?: string[] } }
      if (!res.ok) {
        setError(
          data.validation?.errors?.join("; ") ??
            (data.reasons?.length ? `${data.error}: ${data.reasons.join("; ")}` : data.error) ??
            `Request failed (${res.status})`
        )
        return false
      }
      router.refresh()
      return true
    } finally {
      setBusy(false)
    }
  }

  const assessmentId = detail?.assessment.id
  const assessmentBase = `${base}/${assessmentId}`
  const evidenceById = new Map((detail?.evidence ?? []).map((e) => [e.id, e]))
  const imageIds = new Set((detail?.blobs ?? []).map((b) => b.evidenceId))
  const runProviders = new Map((detail?.runs ?? []).map((r) => [r.id, r.provider]))
  const latestRun = detail?.runs[0]
  const rows = buildCheckStates(checks.map((c) => c.id), detail?.proposals ?? [])

  return (
    <section aria-labelledby="viewing-assessment-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="viewing-assessment-heading" className="text-xl font-bold text-slate-950">
          Viewing assessment
        </h2>
        {assessments.length > 1 && assessmentId ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Assessment:</span>
            <select
              aria-label="Select viewing assessment"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800"
              value={assessmentId}
              onChange={(e) => {
                if (e.target.value !== assessmentId) {
                  router.push(`?assessment=${encodeURIComponent(e.target.value)}`)
                }
              }}
            >
              {assessments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} ({new Date(a.createdAt).toLocaleDateString("en-GB")})
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      <p role="note" data-testid="mock-banner" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <strong>Simulated AI findings.</strong> Unless a live provider has been enabled, findings below come from a deterministic fixture, not real
        AI video analysis. Video footage is processed directly in isolated local storage for frame extraction; raw footage is never sent to external third-party cloud services. All findings are unverified drafts
        until a person reviews them; accepting one does not certify condition.
      </p>

      {error ? (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}

      {busy ? (
        <div role="status" className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <span className="inline-block h-2 w-2 animate-ping rounded-full bg-blue-600"></span>
          <span>Processing request...</span>
        </div>
      ) : null}

      {!detail ? (
        <div className="space-y-2">
          {assessments.length > 0 ? (
            <ul className="list-disc pl-5 text-sm">
              {assessments.map((a) => (
                <li key={a.id}>
                  <a className="underline" href={`?assessment=${encodeURIComponent(a.id)}`}>
                    Assessment {a.id} ({new Date(a.createdAt).toLocaleDateString("en-GB")})
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-700">No viewing assessment exists for this deal yet.</p>
          )}
          <button type="button" className={BUTTON} disabled={busy} onClick={() => call(base, { idempotencyKey: newKey() })}>
            Create viewing assessment
          </button>
        </div>
      ) : (
        <>
          {/* Operator Workflow Stepper */}
          <nav aria-label="Assessment progress" className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Operator Workflow</span>
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${detail.evidence.length > 0 ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>
                  1. Evidence ({detail.evidence.length} frame{detail.evidence.length === 1 ? "" : "s"})
                </span>
                <span className="text-slate-300">→</span>
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${detail.runs.length > 0 && detail.summary.awaitingReview === 0 && detail.proposals.length > 0 ? "bg-emerald-100 text-emerald-900" : detail.summary.awaitingReview > 0 ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}>
                  2. Review {detail.summary.awaitingReview > 0 ? `(${detail.summary.awaitingReview} pending)` : detail.proposals.length > 0 ? "(reviewed)" : ""}
                </span>
                <span className="text-slate-300">→</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                  3. Scope & Measurements
                </span>
                <span className="text-slate-300">→</span>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-medium text-slate-700">
                  4. Financial Impact & Passport
                </span>
              </div>
            </div>
          </nav>

          <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4" data-testid="summary">
            <Stat label="Analysis source" value={detail.summary.analysisSource} />
            <Stat label="Evidence frames" value={detail.summary.evidenceFrameCount} />
            <Stat label="Suggestions awaiting review" value={detail.summary.awaitingReview} />
            <Stat label="Run status" value={latestRun ? `${latestRun.status} (attempt ${latestRun.attemptCount})` : "No run yet"} />
            <Stat label="Accepted" value={detail.summary.accepted} />
            <Stat label="Edited" value={detail.summary.edited} />
            <Stat label="Rejected" value={detail.summary.rejected} />
            <Stat label="Checks not assessed" value={`${detail.summary.checksWithoutReviewedFinding} of ${detail.summary.checklistTotal}`} />
          </dl>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              disabled={busy || detail.summary.evidenceFrameCount === 0}
              onClick={() => call(`${assessmentBase}/analysis-runs`, { idempotencyKey: newKey() })}
            >
              Run analysis
            </button>
            <button
              type="button"
              className={BUTTON}
              disabled={busy}
              onClick={() => call(`${assessmentBase}/evidence`, { clip: { ...MOCK_CLIP, contentSha256: null }, frames: MOCK_FRAMES })}
            >
              Add simulated evidence (metadata only, no image)
            </button>
          </div>
          {detail.summary.evidenceFrameCount === 0 ? (
            <p className="text-sm text-slate-700">No evidence registered: nothing can be analysed, and every check stays not assessed.</p>
          ) : null}

          <VideoEvidencePanel
            dealId={dealId}
            assessmentId={detail.assessment.id}
            checks={checks}
            onEvidenceAttached={() => router.refresh()}
            headers={headers}
          />

          {/* Alternative In-Browser Capture Workflow (Collapsible Fallback) */}
          <details className="group rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
            <summary className="flex cursor-pointer items-center justify-between bg-slate-50/80 px-4 py-3 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors select-none">
              <span className="flex items-center gap-2">
                <span className="text-slate-400">📹</span>
                <span>Alternative In-Browser Video Capture (Client-Side Canvas Sampling)</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">Optional Fallback Tool</span>
            </summary>
            <div className="p-3 border-t border-slate-200">
              <VideoCapture baseUrl={assessmentBase} onSaved={() => router.refresh()} />
            </div>
          </details>

          {detail.evidence.length > 0 ? (
            <details className="text-sm" data-testid="evidence-list">
              <summary className="cursor-pointer font-medium">
                Evidence frames ({detail.evidence.length}; {detail.blobs.length} with a stored image)
              </summary>
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {detail.evidence.map((e) => (
                  <li key={e.id}>
                    {e.clipFilename ?? "clip"} @ {formatClock(e.timestampSeconds)}
                    {e.room ? ` (${e.room})` : ""}: {imageIds.has(e.id) ? "image stored privately" : "no image (metadata only)"}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {detail.runs.length > 0 ? (
            <ul className="text-xs text-slate-700" data-testid="runs">
              {detail.runs.map((r) => (
                <li key={r.id}>
                  Run {r.status}
                  {r.errorCode ? ` (${r.errorCode})` : ""} · {r.provider === "claude" ? "live provider" : "simulated"} · model {r.modelVersion} · attempt{" "}
                  {r.attemptCount} · {r.proposalsCount} proposals
                </li>
              ))}
            </ul>
          ) : null}

          <ChecklistReview
            rows={rows}
            meta={checks}
            renderItems={(row, title) =>
              row.items.map((it) => (
                <ProposalCard
                  key={it.proposal.id}
                  item={{ proposal: it.proposal, currentReview: it.currentReview, reviewHistory: it.reviewHistory }}
                  title={title}
                  simulated={runProviders.get(it.proposal.runId) !== "claude"}
                  busy={busy}
                  evidence={evidenceById}
                  imageIds={imageIds}
                  assessmentBase={assessmentBase}
                  outcomes={detail.feedback.filter((f) => f.kind === "ACTUAL_OUTCOME" && f.proposalId === it.proposal.id)}
                  fetchImpl={fetchImpl}
                  headers={headers}
                  onReview={(body: ReviewBody) =>
                    call(`${assessmentBase}/proposals/${encodeURIComponent(it.proposal.id)}/review`, { expectedRevision: it.reviewHistory.length, ...body })
                  }
                  onOutcome={(body: OutcomeInput) => call(`${assessmentBase}/proposals/${encodeURIComponent(it.proposal.id)}/outcome`, body)}
                />
              ))
            }
          />
        </>
      )}
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  )
}
