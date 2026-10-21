"use client"

import { useState, type FormEvent } from "react"
import FrameThumb from "./FrameThumb"
import {
  OUTCOME_RESULTS,
  OUTCOME_SOURCES,
  VIEWING_CHECK_STATUSES,
  type FeedbackEntry,
  type OutcomeInput,
  type OutcomeResult,
  type OutcomeSource,
  type ProposalWithReview,
  type VideoEvidenceRef,
  type ViewingCheckStatus,
} from "@/types/viewing-assessment"

// One AI suggestion, with everything needed to judge it and nothing that decides for the reviewer:
//  - the ORIGINAL prediction, shown as the model produced it and never replaced by an edit;
//  - the frames it cites, with their recorded times;
//  - accept / edit / reject, each an appended revision;
//  - the reviewer's correction and the full revision history, kept separate from the prediction;
//  - what actually turned out, recorded later as evaluation evidence.
// Nothing here touches Investor Shield, governance, or any figure.

export type ReviewBody =
  | { disposition: "ACCEPTED" }
  | { disposition: "REJECTED"; reason: string }
  | { disposition: "EDITED"; status: ViewingCheckStatus; observation: string }

type Props = {
  item: ProposalWithReview
  title?: string
  simulated: boolean
  busy: boolean
  evidence: ReadonlyMap<string, VideoEvidenceRef>
  imageIds: ReadonlySet<string>
  /** /api/saved-deals/:id/viewing-assessments/:assessmentId */
  assessmentBase: string
  outcomes: readonly FeedbackEntry[]
  onReview: (body: ReviewBody) => Promise<boolean>
  onOutcome: (body: OutcomeInput) => Promise<boolean>
  fetchImpl?: typeof fetch
  headers?: () => Record<string, string>
}

const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-slate-50 disabled:opacity-50"
const label = (value: string) => value.replace(/_/g, " ")

function Badge({ tone, children }: { tone: "amber" | "slate" | "red"; children: string }) {
  const cls = tone === "amber" ? "bg-amber-100 text-amber-900" : tone === "red" ? "bg-red-100 text-red-900" : "bg-slate-100 text-slate-800"
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>
}

export default function ProposalCard({ item, title, simulated, busy, evidence, imageIds, assessmentBase, outcomes, onReview, onOutcome, fetchImpl, headers }: Props) {
  const { proposal, currentReview, reviewHistory } = item
  const [mode, setMode] = useState<"edit" | "reject" | "outcome" | null>(null)
  const [status, setStatus] = useState<ViewingCheckStatus>(proposal.status)
  const [text, setText] = useState(proposal.observation)
  const [result, setResult] = useState<OutcomeResult>("CONFIRMED")
  const [source, setSource] = useState<OutcomeSource>("SURVEY")
  const [observed, setObserved] = useState<ViewingCheckStatus | "">("")
  const [note, setNote] = useState("")

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (mode === "outcome") {
      const ok = await onOutcome({ result, source, observedStatus: observed || null, note })
      if (ok) {
        setMode(null)
        setNote("")
      }
      return
    }
    const ok = await onReview(mode === "edit" ? { disposition: "EDITED", status, observation: text } : { disposition: "REJECTED", reason: text })
    if (ok) setMode(null)
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white p-3 text-sm" data-testid="proposal">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {proposal.checkId}
          {title ? ` ${title}` : ""}
        </span>
        <Badge tone="amber">{simulated ? "UNVERIFIED AI DRAFT (simulated)" : "UNVERIFIED AI DRAFT"}</Badge>
        <Badge tone="slate">{currentReview ? `Review: ${currentReview.disposition}` : "Pending review"}</Badge>
        {proposal.status === "SPECIALIST_REVIEW" ? <Badge tone="red">Specialist inspection suggested</Badge> : null}
      </div>

      <p className="mt-2" data-testid="original-prediction">
        <span className="font-medium">AI proposed ({label(proposal.status)}, {proposal.confidence} confidence):</span> {proposal.observation}
      </p>
      {proposal.suggestedWork ? (
        <p className="mt-1 text-slate-700" data-testid="suggested-work">
          <span className="font-medium">Suggested next step (conditional, not a quote):</span> {proposal.suggestedWork}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2" data-testid="proposal-frames">
        {proposal.evidenceIds.map((id) => {
          const e = evidence.get(id)
          return e ? (
            <FrameThumb
              key={id}
              src={`${assessmentBase}/evidence/${encodeURIComponent(id)}/image`}
              hasImage={imageIds.has(id)}
              timestampSeconds={e.timestampSeconds}
              room={e.room}
              clipFilename={e.clipFilename}
              fetchImpl={fetchImpl}
              headers={headers}
            />
          ) : (
            <span key={id} className="rounded border border-red-300 bg-red-50 p-1 text-xs text-red-900">
              missing frame reference
            </span>
          )
        })}
      </div>

      {currentReview?.disposition === "EDITED" ? (
        <p className="mt-2" data-testid="reviewer-correction">
          <span className="font-medium">Reviewer correction ({label(currentReview.editedStatus ?? "")}):</span> {currentReview.editedObservation}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={BUTTON} disabled={busy} onClick={() => onReview({ disposition: "ACCEPTED" })}>
          Accept
        </button>
        <button type="button" className={BUTTON} disabled={busy} onClick={() => setMode("edit")}>
          Edit
        </button>
        <button type="button" className={BUTTON} disabled={busy} onClick={() => setMode("reject")}>
          Reject
        </button>
        <button type="button" className={BUTTON} disabled={busy} onClick={() => setMode("outcome")}>
          Record what actually turned out
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-600" data-testid="accept-notice">
        Accepting records that you agree this matches the frame. It does not certify the property&apos;s condition and does not change any Investor Shield or governance decision.
      </p>

      {mode ? (
        <form onSubmit={submit} className="mt-2 space-y-2" data-testid="proposal-form">
          {mode === "edit" ? (
            <label className="block">
              Status
              <select value={status} onChange={(e) => setStatus(e.target.value as ViewingCheckStatus)} className="ml-2 rounded border border-slate-300 px-2 py-1">
                {VIEWING_CHECK_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {label(s)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {mode === "outcome" ? (
            <div className="flex flex-wrap gap-3">
              <label className="block">
                Result
                <select value={result} onChange={(e) => setResult(e.target.value as OutcomeResult)} className="ml-2 rounded border border-slate-300 px-2 py-1">
                  {OUTCOME_RESULTS.map((r) => (
                    <option key={r} value={r}>
                      {label(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Source
                <select value={source} onChange={(e) => setSource(e.target.value as OutcomeSource)} className="ml-2 rounded border border-slate-300 px-2 py-1">
                  {OUTCOME_SOURCES.map((r) => (
                    <option key={r} value={r}>
                      {label(r)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                Condition actually found
                <select value={observed} onChange={(e) => setObserved(e.target.value as ViewingCheckStatus | "")} className="ml-2 rounded border border-slate-300 px-2 py-1">
                  <option value="">not known</option>
                  {VIEWING_CHECK_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {label(s)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}
          <label className="block">
            {mode === "edit" ? "Corrected observation" : mode === "reject" ? "Reason for rejection" : "What was found (evidence for evaluating the model)"}
            <textarea
              value={mode === "outcome" ? note : text}
              onChange={(e) => (mode === "outcome" ? setNote(e.target.value) : setText(e.target.value))}
              maxLength={mode === "reject" ? 500 : 1000}
              required
              className="mt-1 block w-full rounded border border-slate-300 p-2"
            />
          </label>
          <button type="submit" className={BUTTON} disabled={busy}>
            {mode === "edit" ? "Save edit" : mode === "reject" ? "Save rejection" : "Save outcome"}
          </button>
        </form>
      ) : null}

      {reviewHistory.length > 0 ? (
        <ol className="mt-2 list-decimal pl-5 text-slate-700" data-testid="review-history">
          {reviewHistory.map((r) => (
            <li key={r.id}>
              Rev {r.revision}: {r.disposition} by {r.reviewerId} at {new Date(r.reviewedAt).toISOString()}
              {r.disposition === "EDITED" ? ` → ${label(r.editedStatus ?? "")}: ${r.editedObservation}` : ""}
              {r.reason ? ` - ${r.reason}` : ""}
            </li>
          ))}
        </ol>
      ) : null}

      {outcomes.length > 0 ? (
        <ul className="mt-2 list-disc pl-5 text-slate-700" data-testid="outcome-history">
          {outcomes.map((o) => (
            <li key={o.id}>
              Actual outcome: {label(o.actualOutcome?.result ?? "")} ({label(o.actualOutcome?.source ?? "")}
              {o.actualOutcome?.observedStatus ? `; found: ${label(o.actualOutcome.observedStatus)}` : ""}) at {new Date(o.reviewedAt).toISOString()}: {o.actualOutcome?.note}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}
