import { formatCurrency } from "@/lib/formatters"
import type { DealPassport } from "@/types/deal-documents"

// Read-only rendering of the draft Deal Passport. No client code, no actions: it displays what the server assembled.
// The three financial layers are shown in separate, labelled sections and never merged.

const money = (n: number | null | undefined) => (typeof n === "number" ? formatCurrency(n) : "not available")

export default function DealPassportView({ passport }: { passport: DealPassport }) {
  const plan = passport.refurbishment
  const comp = plan.computation
  const fin = passport.financial
  const proposal = fin.proposal.latest?.content ?? null
  return (
    <article aria-label="Deal Passport" className="space-y-6 text-sm text-gray-900">
      <header className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">Draft · not approved · internal use only</p>
        <h1 className="mt-1 text-2xl font-bold">Deal Passport</h1>
        <p className="mt-1">{passport.deal.address}</p>
        {passport.simulatedDataWarning ? <p role="note" className="mt-2 text-xs text-amber-900">{passport.simulatedDataWarning}</p> : null}
        <ul className="mt-2 list-disc pl-5 text-xs text-gray-700">{passport.passportNotes.map((n) => <li key={n}>{n}</li>)}</ul>
      </header>

      <section aria-label="Authoritative Saved Deal">
        <h2 className="text-lg font-semibold">1. Authoritative: Saved Deal (as stored)</h2>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          <div><dt className="text-xs text-gray-600">Classification</dt><dd>{passport.deal.stored.classification}</dd></div>
          <div><dt className="text-xs text-gray-600">Governance state</dt><dd>{passport.deal.stored.governanceState}</dd></div>
          <div><dt className="text-xs text-gray-600">Capital protection</dt><dd>{passport.deal.stored.capitalProtectionState}</dd></div>
          <div><dt className="text-xs text-gray-600">Pipeline</dt><dd>{passport.deal.stored.pipelineState}</dd></div>
          <div><dt className="text-xs text-gray-600">Purchase price</dt><dd>{money(passport.deal.stored.purchasePrice)}</dd></div>
          <div><dt className="text-xs text-gray-600">GDV (realistic)</dt><dd>{money(passport.deal.stored.gdvRealistic)}</dd></div>
          <div><dt className="text-xs text-gray-600">Stored refurbishment cost</dt><dd>{money(passport.deal.stored.refurbCost)}</dd></div>
        </dl>
        <h3 className="mt-3 font-medium">Investor Shield (unchanged)</h3>
        <p>Status: <strong>{passport.investorShield.overallStatus}</strong> · progression: {passport.investorShield.progressionDecision} · can progress: {passport.investorShield.canProgress ? "yes" : "no"}</p>
        {passport.investorShield.blockingGateKeys.length ? <p>Blocking gates: {passport.investorShield.blockingGateKeys.join(", ")}</p> : null}
      </section>

      <section aria-label="Outstanding decisions">
        <h2 className="text-lg font-semibold">Outstanding decisions</h2>
        {passport.outstandingDecisions.length === 0 ? <p>None recorded.</p> : <ul className="list-disc pl-5">{passport.outstandingDecisions.map((d) => <li key={d.code}><strong>{d.code}</strong>: {d.message}</li>)}</ul>}
      </section>

      <section aria-label="Inspection">
        <h2 className="text-lg font-semibold">Inspection</h2>
        {passport.inspection ? (
          <p>
            {passport.inspection.checksHumanReviewed} of {passport.inspection.checksTotal} checks have a human-reviewed finding; {passport.inspection.findingsAwaitingReview} suggestion(s) awaiting review; {passport.inspection.specialistInspectionsRequired} need specialist inspection; {passport.inspection.evidenceFrameCount} evidence frames. Analysis source: {passport.inspection.analysisSource}.
          </p>
        ) : <p>No viewing assessment is attached.</p>}
      </section>

      <section aria-label="Measurements">
        <h2 className="text-lg font-semibold">Measurements (entered by an operator)</h2>
        {passport.measurements.current ? (
          <>
            <p className="text-xs text-gray-600">Version {passport.measurements.current.version}, recorded {passport.measurements.current.recordedAt} by {passport.measurements.current.recordedBy}. None are derived from video.</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {passport.measurements.current.entries.map((e) => (
                <li key={`${e.key}-${e.room ?? ""}`}>{e.key}{e.room ? ` (${e.room})` : ""}: {e.value === null ? "unknown" : `${e.value}${e.unit === "category" ? "" : ` ${e.unit}`}`} [{e.basis}{e.source ? `, ${e.source}` : ""}{e.confidence ? `, ${e.confidence}` : ""}] {e.note}</li>
              ))}
            </ul>
            {passport.measurements.unresolved.length ? <ul className="mt-1 list-disc pl-5 text-xs text-amber-900">{passport.measurements.unresolved.map((u) => <li key={u}>{u}</li>)}</ul> : null}
            {passport.measurements.history.length > 1 ? (
              <details className="mt-1 text-xs"><summary>Correction history ({passport.measurements.history.length} versions)</summary>
                <ul className="list-disc pl-5">{passport.measurements.history.map((h) => <li key={h.version}>v{h.version} by {h.recordedBy} at {h.recordedAt}{h.changeNote ? `: ${h.changeNote}` : ""} ({h.changes.length} change(s))</li>)}</ul>
              </details>
            ) : null}
          </>
        ) : <p>No measurements recorded.</p>}
      </section>

      <section aria-label="Confirmed scope">
        <h2 className="text-lg font-semibold">2. Confirmed scope ({plan.status.replace(/_/g, " ").toLowerCase()})</h2>
        {plan.status === "NO_PLAN" ? <p>No scope has been confirmed by a person yet.</p> : (
          <>
            <p className="text-xs text-gray-600">Version {plan.planVersion}, confirmed {plan.confirmedAt} by {plan.confirmedBy}.{plan.staleReasons.length ? ` Out of date: ${plan.staleReasons.join(", ")}.` : ""}</p>
            <ul className="mt-2 space-y-1">
              {plan.acceptedItems.map((i) => (
                <li key={i.itemId} className="rounded border border-gray-200 p-2">
                  <strong>{i.label}</strong> <span className="text-xs text-gray-600">({i.kind.replace(/_/g, " ").toLowerCase()})</span>
                  <span className="block text-xs text-gray-600">{i.quantityNote}</span>
                  <span className="block text-xs text-gray-600">Evidence: {i.sources.flatMap((s) => s.evidence.map((e) => `${e.evidenceId} @ ${e.timestampSeconds}s`)).join(", ")}</span>
                </li>
              ))}
            </ul>
            {comp ? (
              <div className="mt-3">
                <p>Engine estimate at confirmation: {comp.estimate.status === "COMPUTED" ? money(comp.estimate.totalRefurbCost) : `blocked (${comp.estimate.blockedBy.join(", ")})`}</p>
                {comp.estimate.unpricedItems.length ? <p>No price: {comp.estimate.unpricedItems.map((u) => u.label).join("; ")}</p> : null}
                <p>Schedule: {comp.schedule.timeline ? `about ${comp.schedule.timeline.totalCalendarWeeks} week(s) for priced items` : "blocked"}</p>
                <ul className="mt-1 list-disc pl-5 text-xs text-gray-700">{comp.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-label="Financial-impact proposal">
        <h2 className="text-lg font-semibold">3. Proposal: financial impact of the confirmed scope (not authoritative)</h2>
        <p className="text-xs text-gray-600">{fin.statement}</p>
        <p className="mt-1">Status: <strong>{fin.proposal.status}</strong>{fin.proposal.outdated ? " (out of date)" : ""}</p>
        {fin.proposal.outdatedReasons.length ? <ul className="list-disc pl-5 text-xs text-amber-900">{fin.proposal.outdatedReasons.map((r) => <li key={r}>{r}</li>)}</ul> : null}
        {proposal && proposal.recalculatedBaseline && proposal.proposed && proposal.delta ? (
          <table className="mt-2 w-full max-w-xl text-left text-xs">
            <thead><tr><th></th><th>Saved Deal (recalculated)</th><th>Proposed</th><th>Change</th></tr></thead>
            <tbody>
              <tr><td>Refurbishment cost</td><td>{money(proposal.recalculatedBaseline.refurbCost)}</td><td>{money(proposal.proposed.refurbCost)}</td><td>{money(proposal.delta.refurbCost)}</td></tr>
              <tr><td>Total cost</td><td>{money(proposal.recalculatedBaseline.totalCost)}</td><td>{money(proposal.proposed.totalCost)}</td><td>{money(proposal.delta.totalCost)}</td></tr>
              <tr><td>Profit</td><td>{money(proposal.recalculatedBaseline.profit)}</td><td>{money(proposal.proposed.profit)}</td><td>{money(proposal.delta.profit)}</td></tr>
              <tr><td>Engine verdict (informational)</td><td>{proposal.recalculatedBaseline.verdictStatus}</td><td>{proposal.proposed.verdictStatus}</td><td></td></tr>
            </tbody>
          </table>
        ) : <p className="mt-1 text-xs">{proposal ? `Not computable: ${proposal.blockedBy.join(", ")}.` : "No proposal has been made."}</p>}
        {proposal ? (
          <div className="mt-2 text-xs">
            <p>Completeness: {proposal.completeness.replace(/_/g, " ").toLowerCase()}. Built from scope version {proposal.plan.planVersion} confirmed by {proposal.plan.confirmedBy}; findings reviewed by {proposal.plan.sourceReviewers.join(", ") || "n/a"}.</p>
            {proposal.exclusions.length ? <p>Excluded from the figures: {proposal.exclusions.map((e) => e.label).join("; ")}.</p> : null}
            {proposal.storedVersusRecalculated.differences.map((d) => <p key={d} className="text-amber-900">{d}</p>)}
          </div>
        ) : null}
        {fin.proposal.decision ? (
          <p className="mt-2 rounded bg-gray-50 p-2 text-xs">
            Decision: <strong>{fin.proposal.decision.decision}</strong> by {fin.proposal.decision.actor} at {fin.proposal.decision.occurredAt}
            {fin.proposal.decision.decision === "CONFIRMED" ? ". This approves a proposed adjustment only; the Saved Deal figures above are unchanged." : "."}
          </p>
        ) : null}
        {fin.proposal.history.length > 1 ? <details className="mt-1 text-xs"><summary>Proposal history ({fin.proposal.history.length})</summary><ul className="list-disc pl-5">{fin.proposal.history.map((h) => <li key={h.proposalId}>v{h.version} by {h.createdBy} at {h.createdAt}: {h.decision ?? "no decision"}{h.decidedBy ? ` by ${h.decidedBy}` : ""}</li>)}</ul></details> : null}
      </section>

      <section aria-label="Evidence">
        <h2 className="text-lg font-semibold">Evidence on file</h2>
        {passport.evidence.length === 0 ? <p>No evidence records.</p> : <ul className="list-disc pl-5">{passport.evidence.map((e) => <li key={e.evidenceId}>{e.title} ({e.reviewStatus})</li>)}</ul>}
      </section>

      <section aria-label="Provenance">
        <h2 className="text-lg font-semibold">Review history and provenance</h2>
        <p className="text-xs text-gray-600">Generated {passport.generatedAt} · {passport.provenance.integrationVersion} · pack {passport.provenance.packMeta.schemaVersion}</p>
        <ul className="mt-1 list-disc pl-5 text-xs">
          {passport.provenance.sourceTrail.map((t) => <li key={`${t.itemId}-${t.reviewId}`}>{t.itemId}: check {t.checkId}, {t.disposition.toLowerCase()} by {t.reviewerId} at {t.reviewedAt} (review {t.reviewId} r{t.reviewRevision}; frames {t.evidenceIds.join(", ")})</li>)}
        </ul>
      </section>

      <footer className="border-t border-gray-200 pt-3 text-xs text-gray-600">
        {passport.disclaimers.map((d) => <p key={d.code}><strong>{d.title}.</strong> {d.body}</p>)}
      </footer>
    </article>
  )
}
