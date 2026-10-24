"use client"

import { useEffect, useRef, useState } from "react"
import { formatCurrency } from "@/lib/formatters"
import type { FinancialState } from "@/types/refurb-financial"
import type { ConfirmedPlanRecord, PlanComputation, ProposedWorkItem, ScopeLevel, WorkProposal } from "@/types/refurb-integration"
import type { MeasurementSetRecord } from "@/types/refurb-measurements"

// Human steps between reviewed findings and an approved financial-impact PROPOSAL. It only asks the server; it computes nothing.
// Costs, schedule and financial impact are the existing engine's output. Measurements are typed in by the operator and are
// never read from video. Confirming a proposal approves a proposed adjustment only; the Saved Deal is never changed here.

export type MeasurementSpecRow = { key: string; label: string; unit: string; usedByEngine: boolean; perRoom: boolean; values: readonly string[] | null }

export type ContractorQuoteOverrideView = {
  id: string
  itemId: string
  taskId: string
  quoteRef: string
  approvedAmount: number
  approvedBy: string
  approvedAt: string
  status: "APPROVED" | "SUPERSEDED" | "DECLINED"
  supersededBy: string | null
  vatBasis?: "GROSS" | "NET_PLUS_VAT" | "EXEMPT"
  quoteType?: "VERIFIED_CONTRACTOR_QUOTE" | "OPERATOR_PROVISIONAL_ESTIMATE"
  scopeVerified?: boolean
  quoteEvidenceId?: string | null
}

export type PanelState = {
  proposal: WorkProposal
  current: { record: ConfirmedPlanRecord; stale: boolean; staleReasons: string[] } | null
  measurements: MeasurementSetRecord | null
  financial: FinancialState
  quoteOverrides?: ContractorQuoteOverrideView[]
}

type Props = { dealId: string; assessmentId: string; initial: PanelState; spec: readonly MeasurementSpecRow[]; fetchImpl?: typeof fetch }

type Row = { key: string; room: string; value: string; basis: string; source: string; confidence: string; note: string; acknowledgedImplausible: boolean }

const ENGINE_KEYS = ["bedrooms", "bathrooms", "floorAreaSqm", "kitchenSize"]
const SOURCES = ["TAPE_MEASURE", "LASER_MEASURE", "FLOOR_PLAN", "EPC_OR_LISTING", "AGENT_OR_VENDOR", "OTHER"]
const blankRow = (key: string): Row => ({ key, room: "", value: "", basis: "MEASURED", source: "TAPE_MEASURE", confidence: "high", note: "", acknowledgedImplausible: false })

const money = (n: number | null | undefined) => (typeof n === "number" ? formatCurrency(n) : "not computed")

function rowsFrom(set: MeasurementSetRecord | null): Row[] {
  if (!set) return ENGINE_KEYS.map(blankRow)
  const rows: Row[] = set.entries.map((e) => ({
    key: e.key,
    room: e.room ?? "",
    value: e.value === null ? "" : String(e.value),
    basis: e.basis,
    source: e.source ?? "TAPE_MEASURE",
    confidence: e.confidence ?? "high",
    note: e.note,
    acknowledgedImplausible: e.acknowledgedImplausible === true,
  }))
  for (const k of ENGINE_KEYS) if (!rows.some((r) => r.key === k && !r.room)) rows.push(blankRow(k))
  return rows
}

export default function RefurbPlanPanel({ dealId, assessmentId, initial, spec, fetchImpl }: Props) {
  const doFetch = fetchImpl ?? fetch
  const base = `/api/saved-deals/${encodeURIComponent(dealId)}/viewing-assessments/${encodeURIComponent(assessmentId)}`
  const [state, setState] = useState<PanelState>(initial)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [picked, setPicked] = useState<Record<string, ScopeLevel | true>>({})
  const [rows, setRows] = useState<Row[]>(() => rowsFrom(initial.measurements))
  const [changeNote, setChangeNote] = useState("")
  const [assumptions, setAssumptions] = useState({ stampDuty: "", legalCosts: "", saleCosts: "", bridgeTermMonths: "" })
  const [preview, setPreview] = useState<PlanComputation | null>(null)
  const [note, setNote] = useState("")
  const [ack, setAck] = useState({ notWriteBack: false, exclusions: false, unresolvedQuantities: false })
  const [quoteOverrides, setQuoteOverrides] = useState<ContractorQuoteOverrideView[]>(initial.quoteOverrides ?? [])
  const [quoteForms, setQuoteForms] = useState<Record<string, { quoteRef?: string; approvedAmount?: string; vatBasis?: "GROSS" | "NET_PLUS_VAT" | "EXEMPT"; quoteEvidenceId?: string }>>({})
  const [showQuoteForm, setShowQuoteForm] = useState<Record<string, boolean>>({})

  // One key per attempt, created when the button is pressed and kept until it succeeds, so a retry after a network failure
  // replays the same request instead of creating a second one.
  const keys = useRef<Record<string, string | null>>({})
  const keyFor = (name: string) => (keys.current[name] ??= `${name}-${crypto.randomUUID()}`)
  const clearKey = (name: string) => void (keys.current[name] = null)

  async function reload() {
    try {
      const [plan, meas, fin] = await Promise.all([
        doFetch(`${base}/refurb-plan`),
        doFetch(`${base}/measurements`),
        doFetch(`${base}/financial-proposal`),
      ])
      const [p, m, f] = await Promise.all([plan.json(), meas.json(), fin.json()])
      if (!plan.ok || !meas.ok || !fin.ok) return setError("Could not reload.")
      if (Array.isArray(p.quoteOverrides)) setQuoteOverrides(p.quoteOverrides)
      setState({ proposal: p.proposal, current: p.current, measurements: m.current, financial: { proposals: f.proposals, latest: f.latest, decision: f.decision, outdated: f.outdated, outdatedReasons: f.outdatedReasons, status: f.status } })
      setRows(rowsFrom(m.current))
      setPicked({})
      setPreview(null)
      setAck({ notWriteBack: false, exclusions: false, unresolvedQuantities: false })
    } catch {
      setError("Could not reload.")
    }
  }

  async function send(path: string, body: unknown) {
    setBusy(true)
    setError(null)
    setDone(null)
    try {
      const res = await doFetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      const json = await res.json()
      if (!res.ok) {
        const known: Record<string, string> = {
          STALE_FINDINGS: "Findings have been reviewed again since you opened this. Reload and check the proposal.",
          STALE_MEASUREMENTS: "The measurements changed since you opened this. Reload and check them.",
          PROPOSAL_OUTDATED: "That proposal is out of date. Create a new one.",
          PROPOSAL_CHANGED: "The proposal changed. Reload it.",
          ALREADY_DECIDED: "That proposal already has a decision.",
        }
        setError(known[json?.error] ?? (json?.validation?.errors ?? [json?.error ?? "Request failed"]).join("; "))
        return null
      }
      return json
    } catch {
      setError("Request failed.")
      return null
    } finally {
      setBusy(false)
    }
  }

  // ---- measurements
  const entriesBody = () =>
    rows
      .filter((r) => r.value.trim() !== "" || r.basis === "UNKNOWN")
      .map((r) => {
        const sp = spec.find((s) => s.key === r.key)
        const unknown = r.basis === "UNKNOWN"
        const value = unknown ? null : sp?.unit === "category" ? r.value.trim() : Number(r.value)
        return {
          key: r.key,
          ...(r.room.trim() ? { room: r.room.trim() } : {}),
          value,
          basis: r.basis,
          source: unknown ? null : r.source,
          confidence: unknown ? null : r.confidence,
          note: r.note,
          ...(r.acknowledgedImplausible ? { acknowledgedImplausible: true } : {}),
        }
      })

  async function saveMeasurements() {
    const basedOnVersion = state.measurements?.version ?? 0
    const json = await send(`${base}/measurements`, { idempotencyKey: keyFor("measure"), basedOnVersion, ...(basedOnVersion > 0 ? { changeNote } : {}), entries: entriesBody() })
    if (json) {
      clearKey("measure")
      setChangeNote("")
      await reload()
      setDone(`Measurements saved (version ${json.measurementSet.version}).${json.measurementSet.warnings.length ? ` ${json.measurementSet.warnings.length} warning(s) recorded.` : ""}`)
    }
  }

  // ---- scope
  const scopeBody = () => ({
    accepted: Object.entries(picked).map(([itemId, level]) => ({ itemId, ...(level === true ? {} : { level }) })),
    ...(state.measurements ? { measurementSetId: state.measurements.id } : {}),
    ...(Object.values(assumptions).every((v) => v !== "")
      ? { financialAssumptions: { stampDuty: Number(assumptions.stampDuty), legalCosts: Number(assumptions.legalCosts), saleCosts: Number(assumptions.saleCosts), bridgeTermMonths: Number(assumptions.bridgeTermMonths) } }
      : {}),
  })

  async function runPreview() {
    const body = scopeBody()
    const json = await send(`${base}/refurb-plan/preview`, { ...body, ...(body.accepted.length ? {} : { accepted: undefined }) })
    if (json) setPreview(json.computation)
  }

  async function confirmScope() {
    const body = scopeBody()
    if (!body.accepted.length) return setError("Choose at least one item.")
    if (!body.measurementSetId) return setError("Record and save measurements first (bedrooms and bathrooms at least).")
    const json = await send(`${base}/refurb-plan`, { idempotencyKey: keyFor("plan"), expectedFingerprint: state.proposal.fingerprint, ...body, financialAssumptions: body.financialAssumptions ?? null })
    if (json) {
      clearKey("plan")
      await reload()
      setDone(`Scope confirmed (version ${json.plan.version}). Nothing on the Saved Deal, Investor Shield or pipeline was changed.`)
    }
  }

  // ---- financial proposal
  async function createProposal() {
    const json = await send(`${base}/financial-proposal`, { idempotencyKey: keyFor("proposal") })
    if (json) {
      clearKey("proposal")
      await reload()
      setDone(json.replayed ? "That proposal already exists unchanged." : `Proposal version ${json.proposal.version} created. It changes nothing on the Saved Deal.`)
    }
  }

  async function decide(decision: "CONFIRMED" | "DECLINED") {
    const latest = state.financial.latest
    if (!latest) return
    const name = `decision-${latest.id}`
    const json = await send(`${base}/financial-proposal/${encodeURIComponent(latest.id)}/decision`, { idempotencyKey: keyFor(name), decision, proposalHash: latest.contentHash, ...(note.trim() ? { note: note.trim() } : {}), acknowledge: ack })
    if (json) {
      clearKey(name)
      await reload()
      setDone(decision === "CONFIRMED" ? "Proposed adjustment approved. The Saved Deal figures were not changed." : "Proposal declined.")
    }
  }

  const defaultTaskIdForItem = (item: ProposedWorkItem, level?: ScopeLevel | true) => {
    if (item.itemId === "bathroom") return "bathroom-partial-unsupported"
    if (item.itemId === "kitchen") {
      if (level === "upgrade") return "kitchen-upgrade-unsupported"
      return "kitchen-refresh-unsupported"
    }
    return `${item.itemId}-unsupported`
  }

  async function approveQuote(itemId: string, taskId: string) {
    const formData = quoteForms[itemId] ?? { quoteRef: "", approvedAmount: "", vatBasis: "GROSS", quoteEvidenceId: "" }
    const ref = (formData.quoteRef ?? "").trim()
    const amount = Number(formData.approvedAmount)
    const vatBasis = formData.vatBasis ?? "GROSS"
    const quoteEvidenceId = formData.quoteEvidenceId?.trim() || null

    if (!ref) return setError("Contractor or quote reference is required.")
    if (!Number.isFinite(amount) || amount <= 0) return setError("Approved amount must be a positive number.")
    const json = await send(`${base}/quote-overrides`, { itemId, taskId, quoteRef: ref, approvedAmount: amount, vatBasis, quoteEvidenceId })
    if (json) {
      setDone(`Contractor price approved: ${money(amount)} for ${ref}. Recomputing...`)
      setShowQuoteForm((prev) => ({ ...prev, [itemId]: false }))
      setQuoteForms((prev) => ({ ...prev, [itemId]: { quoteRef: "", approvedAmount: "", vatBasis: "GROSS", quoteEvidenceId: "" } }))
      await reload()
      await runPreview()
    }
  }

  const { proposal, current, financial } = state
  const toggle = (item: ProposedWorkItem) =>
    setPicked((p) => {
      const next = { ...p }
      if (item.itemId in next) delete next[item.itemId]
      else next[item.itemId] = item.scopeEffect ? (item.allowedLevels[0] as ScopeLevel) : true
      return next
    })
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const extraKeys = spec.filter((s) => !s.usedByEngine)
  const content = financial.latest?.content ?? null
  const needsExclusionAck = (content?.exclusions.length ?? 0) > 0
  const needsUnresolvedAck = (content?.unresolvedQuantities.length ?? 0) > 0
  const canConfirm = Boolean(content) && content!.completeness !== "NOT_COMPUTABLE" && !financial.outdated && !financial.decision && ack.notWriteBack && (!needsExclusionAck || ack.exclusions) && (!needsUnresolvedAck || ack.unresolvedQuantities)

  return (
    <section aria-label="Refurbishment scope" className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-sm text-gray-900">
      <h2 className="text-lg font-semibold">Refurbishment scope and financial impact</h2>
      <p className="mt-1 text-xs text-gray-600">
        Proposed from findings a person has reviewed. Nothing is accepted until you confirm it. Costs, schedule and financial impact are the existing engine&apos;s figures. Measurements are entered by you, never read from video. Approving a proposal records your agreement to a proposed adjustment only; it does not change the Saved Deal.
      </p>
      {proposal.analysisSource === "SIMULATED" || proposal.analysisSource === "MIXED" ? (
        <p role="note" className="mt-2 rounded bg-amber-50 p-2 text-xs text-amber-900">These findings come from SIMULATED analysis: demonstration data, not an inspection result.</p>
      ) : null}
      {error ? <p role="alert" className="mt-2 text-xs text-red-700">{error}</p> : null}
      {done ? <p role="status" className="mt-2 text-xs text-green-800">{done}</p> : null}

      <fieldset className="mt-4" aria-label="Measurements">
        <legend className="font-semibold text-slate-900">
          1. Measurements {state.measurements ? `(saved version ${state.measurements.version})` : "(none saved yet)"}
        </legend>
        <p className="text-xs text-slate-600 mt-0.5">
          Specify how each dimension is verified. Bedrooms and bathrooms are required for engine calculations. Measurements are entered by you, never read from video.
        </p>
        <div className="mt-3 space-y-2.5">
          {rows.map((r, i) => {
            const sp = spec.find((s) => s.key === r.key)
            return (
              <div key={`${r.key}-${i}`} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-xs shadow-xs transition-all hover:border-slate-300">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6 items-end">
                  <label className="block">
                    <span className="font-medium text-slate-700">
                      {sp?.label ?? r.key}{sp && !sp.usedByEngine ? " (Builder Specification)" : ""}
                    </span>
                    {sp?.values ? (
                      <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" value={r.value} aria-label={`${sp.label} value`} onChange={(e) => setRow(i, { value: e.target.value })}>
                        <option value="" />{sp.values.map((v) => <option key={v}>{v}</option>)}
                      </select>
                    ) : (
                      <input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" inputMode="decimal" value={r.value} aria-label={`${sp?.label ?? r.key} value`} onChange={(e) => setRow(i, { value: e.target.value })} />
                    )}
                  </label>
                  {sp?.perRoom || !sp?.usedByEngine ? (
                    <label className="block">
                      <span className="font-medium text-slate-700">Room</span>
                      <input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" value={r.room} aria-label={`${sp?.label ?? r.key} room`} onChange={(e) => setRow(i, { room: e.target.value })} />
                    </label>
                  ) : <span className="hidden sm:block" />}
                  <label className="block">
                    <span className="font-medium text-slate-700">Basis</span>
                    <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" value={r.basis} aria-label={`${sp?.label ?? r.key} basis`} onChange={(e) => setRow(i, { basis: e.target.value })}>
                      <option>MEASURED</option><option>OPERATOR_ESTIMATE</option><option>UNKNOWN</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Source</span>
                    <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 disabled:opacity-50" value={r.source} disabled={r.basis === "UNKNOWN"} aria-label={`${sp?.label ?? r.key} source`} onChange={(e) => setRow(i, { source: e.target.value })}>
                      {SOURCES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Confidence</span>
                    <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 disabled:opacity-50" value={r.confidence} disabled={r.basis === "UNKNOWN"} aria-label={`${sp?.label ?? r.key} confidence`} onChange={(e) => setRow(i, { confidence: e.target.value })}>
                      <option>high</option><option>medium</option><option>low</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="font-medium text-slate-700">Note</span>
                    <input className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800" value={r.note} aria-label={`${sp?.label ?? r.key} note`} onChange={(e) => setRow(i, { note: e.target.value })} />
                  </label>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center gap-2">
                  <input id={`ack-impl-${i}`} type="checkbox" checked={r.acknowledgedImplausible} onChange={(e) => setRow(i, { acknowledgedImplausible: e.target.checked })} className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                  <label htmlFor={`ack-impl-${i}`} className="text-[11px] text-slate-600 cursor-pointer select-none">
                    Confirm unusual dimension verified on site (acknowledged)
                  </label>
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <select aria-label="Add a measurement" className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800" value="" onChange={(e) => e.target.value && setRows((rs) => [...rs, blankRow(e.target.value)])}>
            <option value="">Add another measurement...</option>
            {extraKeys.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          {state.measurements ? (
            <input
              aria-label="What was wrong with the previous version"
              placeholder="Reason for revision (e.g. on-site re-measurement)"
              className="min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              value={changeNote}
              onChange={(e) => setChangeNote(e.target.value)}
            />
          ) : null}
          <button type="button" disabled={busy} onClick={saveMeasurements} className="rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-colors">
            Save measurements
          </button>
        </div>
      </fieldset>

      <div className="mt-5">
        <h3 className="font-medium">2. Scope from reviewed findings</h3>
        {current ? (
          <p className="mt-1 text-xs">
            Confirmed scope: version {current.record.version}, {new Date(current.record.confirmedAt).toLocaleString()}{current.record.measurementSetVersion ? `, measurements v${current.record.measurementSetVersion}` : ""}.{" "}
            {current.stale ? <strong className="text-red-700">Out of date ({current.staleReasons.join(", ").toLowerCase().replace(/_/g, " ")}). Re-confirm.</strong> : null}{" "}
            <a className="underline font-medium text-slate-900" href={`/saved-deals/${encodeURIComponent(dealId)}/builder-pack?assessmentId=${encodeURIComponent(assessmentId)}`}>Builder pack (draft)</a> ·{" "}
            <a className="underline font-medium text-slate-900" href={`/saved-deals/${encodeURIComponent(dealId)}/passport?assessmentId=${encodeURIComponent(assessmentId)}`}>Deal Passport (draft)</a> ·{" "}
            <a className="underline text-slate-500" href={`${base}/builder-pack`} title="Raw JSON API output" target="_blank" rel="noreferrer">JSON</a>
          </p>
        ) : null}
        {proposal.items.length === 0 ? (
          <p className="mt-2 text-sm">No reviewed finding currently proposes work. {proposal.excluded.filter((e) => e.reason === "UNREVIEWED").length} suggestion(s) are still waiting for review.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {proposal.items.map((item) => (
              <li key={item.itemId} className="rounded border border-gray-200 p-3">
                <label className="flex items-start gap-2">
                  <input type="checkbox" checked={item.itemId in picked} onChange={() => toggle(item)} aria-label={`Accept ${item.label}`} />
                  <span>
                    <span className="font-medium">{item.label}</span>{" "}
                    <span className="text-xs text-gray-600">({item.kind === "ENGINE_SCOPE" ? "priced by the engine where it can" : item.kind === "UNPRICED" ? "builder to price" : "inspection first"})</span>
                    <span className="block text-xs text-gray-600">{item.quantityNote}</span>
                    <span className="block text-xs text-gray-600">Seen at {item.sources.flatMap((s) => s.evidence.map((e) => `${e.timestampSeconds}s${e.room ? ` (${e.room})` : ""}`)).join(", ")} · reviewed by {[...new Set(item.sources.map((s) => s.reviewerId))].join(", ")}</span>
                  </span>
                </label>
                {item.itemId in picked && item.scopeEffect && item.allowedLevels.length > 1 ? (
                  <label className="mt-2 block text-xs">Level{" "}
                    <select value={String(picked[item.itemId])} onChange={(e) => setPicked((p) => ({ ...p, [item.itemId]: item.allowedLevels.find((l) => String(l) === e.target.value) as ScopeLevel }))} className="rounded border border-gray-300 px-1 py-0.5">
                      {item.allowedLevels.map((l) => <option key={String(l)} value={String(l)}>{String(l).replace(/_/g, " ")}</option>)}
                    </select>
                  </label>
                ) : null}
                {(() => {
                  const taskId = defaultTaskIdForItem(item, picked[item.itemId])
                  const activeQuote = quoteOverrides.find((o) => o.status === "APPROVED" && (o.itemId === item.itemId || o.taskId === taskId))
                  const formVisible = showQuoteForm[item.itemId] || !activeQuote
                  return (
                    <div className="mt-2 space-y-2">
                      {activeQuote ? (
                        <div className={`flex flex-wrap items-center justify-between rounded px-2.5 py-1.5 text-xs border ${
                          activeQuote.quoteType === "VERIFIED_CONTRACTOR_QUOTE"
                            ? "bg-emerald-50 text-emerald-950 border-emerald-200"
                            : "bg-amber-50 text-amber-950 border-amber-200"
                        }`}>
                          <span>
                            <strong className={`font-semibold ${activeQuote.quoteType === "VERIFIED_CONTRACTOR_QUOTE" ? "text-emerald-800" : "text-amber-800"}`}>
                              {activeQuote.quoteType === "VERIFIED_CONTRACTOR_QUOTE" ? "Verified contractor quote:" : "Operator provisional estimate (unverified):"}
                            </strong>{" "}
                            {money(activeQuote.approvedAmount)} ({activeQuote.quoteRef}, VAT: {activeQuote.vatBasis ?? "GROSS"}) approved by {activeQuote.approvedBy} at {new Date(activeQuote.approvedAt).toLocaleDateString()}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowQuoteForm((p) => ({ ...p, [item.itemId]: !p[item.itemId] }))}
                            className="ml-2 font-medium text-emerald-700 underline hover:text-emerald-900"
                          >
                            {showQuoteForm[item.itemId] ? "Cancel" : "Supersede quote"}
                          </button>
                        </div>
                      ) : null}

                      {formVisible ? (
                        <div className="rounded border border-dashed border-gray-300 bg-gray-50/50 p-2 text-xs">
                          <p className="font-medium text-gray-700">{activeQuote ? "Supersede contractor quote" : "Approve contractor quote for this scope"}</p>
                          <div className="mt-1 grid grid-cols-1 gap-2 sm:grid-cols-4">
                            <label>Contractor quote reference
                              <input
                                aria-label={`Contractor quote reference for ${item.label}`}
                                placeholder="e.g. Apex Contractors APX-3500"
                                className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5"
                                value={quoteForms[item.itemId]?.quoteRef ?? ""}
                                onInput={(e) => {
                                  const val = e.currentTarget.value
                                  setQuoteForms((f) => ({ ...f, [item.itemId]: { ...f[item.itemId], quoteRef: val } }))
                                }}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setQuoteForms((f) => ({ ...f, [item.itemId]: { ...f[item.itemId], quoteRef: val } }))
                                }}
                              />
                            </label>
                            <label>Approved price (GBP)
                              <input
                                aria-label={`Approved price for ${item.label}`}
                                inputMode="decimal"
                                placeholder="e.g. 3500"
                                className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5"
                                value={quoteForms[item.itemId]?.approvedAmount ?? ""}
                                onInput={(e) => {
                                  const val = e.currentTarget.value
                                  setQuoteForms((f) => ({ ...f, [item.itemId]: { ...f[item.itemId], approvedAmount: val } }))
                                }}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setQuoteForms((f) => ({ ...f, [item.itemId]: { ...f[item.itemId], approvedAmount: val } }))
                                }}
                              />
                            </label>
                            <label>VAT Basis
                              <select
                                aria-label={`VAT basis for ${item.label}`}
                                className="mt-0.5 w-full rounded border border-gray-300 bg-white px-1 py-0.5"
                                value={quoteForms[item.itemId]?.vatBasis ?? "GROSS"}
                                onChange={(e) => {
                                  const val = e.target.value as "GROSS" | "NET_PLUS_VAT" | "EXEMPT"
                                  setQuoteForms((f) => ({ ...f, [item.itemId]: { ...f[item.itemId], vatBasis: val } }))
                                }}
                              >
                                <option value="GROSS">GROSS (inclusive)</option>
                                <option value="NET_PLUS_VAT">NET + 20% VAT</option>
                                <option value="EXEMPT">EXEMPT</option>
                              </select>
                            </label>
                            <div className="flex items-end">
                              <button
                                type="button"
                                disabled={busy}
                                aria-label={`Approve contractor quote for ${item.label}`}
                                onClick={() => approveQuote(item.itemId, taskId)}
                                className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-800 disabled:opacity-50"
                              >
                                Approve Contractor Quote
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}
              </li>
            ))}
          </ul>
        )}
        {quoteOverrides.length > 0 ? (
          <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3 text-xs" aria-label="Contractor quote audit log">
            <p className="font-semibold text-gray-800">Contractor quote overrides (persisted audit trail)</p>
            <table className="mt-1 w-full text-left">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-1">Task / Item</th>
                  <th className="py-1">Quote Reference</th>
                  <th className="py-1">Approved Price</th>
                  <th className="py-1">VAT Basis</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Status</th>
                  <th className="py-1">Approved By</th>
                  <th className="py-1">Approved At</th>
                </tr>
              </thead>
              <tbody>
                {quoteOverrides.map((o) => (
                  <tr key={o.id} className={o.status === "SUPERSEDED" ? "text-gray-400 line-through" : "text-gray-900 font-medium"}>
                    <td className="py-1">{o.taskId}</td>
                    <td className="py-1">{o.quoteRef}</td>
                    <td className="py-1">{money(o.approvedAmount)}</td>
                    <td className="py-1">{o.vatBasis ?? "GROSS"}</td>
                    <td className="py-1">{o.quoteType === "VERIFIED_CONTRACTOR_QUOTE" ? "Verified quote" : "Provisional"}</td>
                    <td className="py-1">{o.status}</td>
                    <td className="py-1">{o.approvedBy}</td>
                    <td className="py-1">{new Date(o.approvedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <fieldset className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <legend className="font-medium">Deal assumptions for the financial figures (all four needed; no defaults are assumed)</legend>
          {(["stampDuty", "legalCosts", "saleCosts", "bridgeTermMonths"] as const).map((k) => (
            <label key={k}>{k}<input className="mt-1 w-full rounded border border-gray-300 px-1 py-0.5" inputMode="decimal" value={assumptions[k]} onChange={(e) => setAssumptions({ ...assumptions, [k]: e.target.value })} /></label>
          ))}
        </fieldset>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={busy} onClick={runPreview} className="rounded border border-gray-400 px-3 py-1.5 text-sm">Preview cost, schedule and financial impact</button>
          <button type="button" disabled={busy || Object.keys(picked).length === 0} onClick={confirmScope} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">Confirm selected scope</button>
        </div>
        {preview ? (
          <div className="mt-3 rounded bg-gray-50 p-3 text-xs" aria-label="Preview">
            <p className="font-medium">Preview (draft; nothing saved)</p>
            <p>Estimate: {preview.estimate.status === "COMPUTED" ? `${money(preview.estimate.totalRefurbCost)} (labour ${money(preview.estimate.labourCost)}, materials ${money(preview.estimate.materialCost)})` : `blocked: ${preview.estimate.blockedBy.join(", ")}`}</p>
            {preview.estimate.unpricedItems.length ? <p>No price in this estimate: {preview.estimate.unpricedItems.map((u) => u.label).join("; ")}.</p> : null}
            <p>Schedule: {preview.schedule.timeline ? `about ${preview.schedule.timeline.totalCalendarWeeks} week(s) for priced items (includes contingency)` : "blocked"}{preview.schedule.unscheduledItems.length ? `; ${preview.schedule.unscheduledItems.length} item(s) unscheduled` : ""}</p>
            {preview.financialImpact.status === "COMPUTED" && preview.financialImpact.delta && preview.financialImpact.baseline && preview.financialImpact.scenario ? (
              <p>Financial impact (existing engine): refurbishment cost {money(preview.financialImpact.baseline.refurbCost)} → {money(preview.financialImpact.scenario.refurbCost)}; profit {money(preview.financialImpact.baseline.profit)} → {money(preview.financialImpact.scenario.profit)}; engine verdict {preview.financialImpact.baseline.verdictStatus} → {preview.financialImpact.scenario.verdictStatus} (informational only).</p>
            ) : <p>Financial impact not computed: {preview.financialImpact.blockedBy.join(", ")}.</p>}
            {preview.warnings.map((w) => <p key={w} className="text-amber-900">{w}</p>)}
          </div>
        ) : null}
      </div>

      <div className="mt-5" aria-label="Financial-impact proposal">
        <h3 className="font-medium">3. Financial-impact proposal (status: {financial.status}{financial.outdated ? ", out of date" : ""})</h3>
        {!current ? <p className="mt-1 text-xs text-gray-600">Confirm a scope first.</p> : (
          <>
            <button type="button" disabled={busy || current.stale} onClick={createProposal} className="mt-1 rounded border border-gray-400 px-3 py-1.5 text-sm disabled:opacity-50">Create proposal from the confirmed scope</button>
            {current.stale ? <span className="ml-2 text-xs text-red-700">Re-confirm the scope first.</span> : null}
          </>
        )}
        {content ? (
          <div className="mt-3 text-xs">
            <p className="text-gray-600">Proposal version {financial.latest!.version}, made by {financial.latest!.createdBy}. Built from scope version {content.plan.planVersion} confirmed by {content.plan.confirmedBy}; findings reviewed by {content.plan.sourceReviewers.join(", ") || "n/a"}. Not authoritative: the Saved Deal figures are.</p>
            {financial.outdatedReasons.map((r) => <p key={r} className="text-red-700">{r}</p>)}
            <table className="mt-2 w-full max-w-2xl text-left">
              <thead><tr><th></th><th>Saved Deal (stored)</th><th>Saved Deal (recalculated)</th><th>Proposed</th></tr></thead>
              <tbody>
                <tr><td>Refurbishment cost</td><td>{money(content.authoritative.refurbCost)}</td><td>{money(content.recalculatedBaseline?.refurbCost)}</td><td>{money(content.proposed?.refurbCost)}</td></tr>
                <tr><td>Total cost</td><td>{money(content.authoritative.storedEngineResult?.totalCost)}</td><td>{money(content.recalculatedBaseline?.totalCost)}</td><td>{money(content.proposed?.totalCost)}</td></tr>
                <tr><td>Profit</td><td>{money(content.authoritative.storedEngineResult?.profit)}</td><td>{money(content.recalculatedBaseline?.profit)}</td><td>{money(content.proposed?.profit)}</td></tr>
                <tr><td>Engine verdict (informational)</td><td>{content.authoritative.storedEngineResult?.verdictStatus ?? "n/a"}</td><td>{content.recalculatedBaseline?.verdictStatus ?? "n/a"}</td><td>{content.proposed?.verdictStatus ?? "n/a"}</td></tr>
              </tbody>
            </table>
            {content.blockedBy.length ? <p className="mt-1 text-red-700">Not computable: {content.blockedBy.join(", ")}.</p> : null}
            <p className="mt-2 font-medium">What changed</p><ul className="list-disc pl-5">{content.changedAssumptions.map((a) => <li key={a}>{a}</li>)}</ul>
            {content.exclusions.length ? (<><p className="mt-1 font-medium">Excluded from these figures</p><ul className="list-disc pl-5">{content.exclusions.map((e) => <li key={e.itemId}>{e.label}: {e.reason}</li>)}</ul></>) : null}
            {content.unresolvedQuantities.length ? (<><p className="mt-1 font-medium">Unresolved quantities</p><ul className="list-disc pl-5">{content.unresolvedQuantities.map((u) => <li key={u}>{u}</li>)}</ul></>) : null}
            {content.storedVersusRecalculated.differences.map((d) => <p key={d} className="mt-1 text-amber-900">{d}</p>)}

            {financial.decision ? (
              <p className="mt-2 rounded bg-gray-50 p-2">Decision: <strong>{financial.decision.decision}</strong> by {financial.decision.actor} at {financial.decision.occurredAt}. {financial.decision.decision === "CONFIRMED" ? "This approves a proposed adjustment only; the Saved Deal is unchanged." : ""}</p>
            ) : (
              <fieldset className="mt-3 space-y-1 rounded border border-gray-200 p-2">
                <legend className="font-medium">Your decision</legend>
                <label className="flex items-start gap-2"><input type="checkbox" checked={ack.notWriteBack} onChange={(e) => setAck({ ...ack, notWriteBack: e.target.checked })} /> I understand confirming approves this proposed adjustment only. It does not change the Saved Deal, Investor Shield or any approval.</label>
                {needsExclusionAck ? <label className="flex items-start gap-2"><input type="checkbox" checked={ack.exclusions} onChange={(e) => setAck({ ...ack, exclusions: e.target.checked })} /> I have read what is excluded from these figures.</label> : null}
                {needsUnresolvedAck ? <label className="flex items-start gap-2"><input type="checkbox" checked={ack.unresolvedQuantities} onChange={(e) => setAck({ ...ack, unresolvedQuantities: e.target.checked })} /> I have read which quantities are unresolved.</label> : null}
                <input aria-label="Decision note" placeholder="Note (optional)" className="mt-1 w-full rounded border border-gray-300 px-1 py-0.5" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="mt-1 flex gap-2">
                  <button type="button" disabled={busy || !canConfirm} onClick={() => decide("CONFIRMED")} className="rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50">Confirm proposed adjustment</button>
                  <button type="button" disabled={busy} onClick={() => decide("DECLINED")} className="rounded border border-gray-400 px-3 py-1.5 text-sm">Decline</button>
                </div>
              </fieldset>
            )}
          </div>
        ) : null}
      </div>
    </section>
  )
}
