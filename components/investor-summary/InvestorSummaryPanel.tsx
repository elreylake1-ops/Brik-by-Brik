import { formatCurrency } from "@/lib/formatters"
import type { InvestorSummaryViewModel } from "@/types/investor-summary"

export type InvestorSummaryPanelProps = {
  summary: InvestorSummaryViewModel
}

const UNAVAILABLE_LABEL = "Unavailable"

function money(value: number | null): string {
  return value === null ? UNAVAILABLE_LABEL : formatCurrency(value)
}

function text(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : UNAVAILABLE_LABEL
}

function collectWarnings(summary: InvestorSummaryViewModel): string[] {
  const warnings: string[] = []

  if (summary.purchasePrice === null) warnings.push("Purchase price unavailable.")
  if (summary.gdvRange.downside === null) warnings.push("GDV downside unavailable.")
  if (summary.gdvRange.realistic === null) warnings.push("GDV realistic unavailable.")
  if (summary.gdvRange.strong === null) warnings.push("GDV strong unavailable.")
  if (summary.trueMao.fifteenPercent === null) warnings.push("True MAO 15% unavailable.")
  if (summary.trueMao.twentyPercent === null) warnings.push("True MAO 20% unavailable.")
  if (summary.trueMao.twentyFivePercent === null) warnings.push("True MAO 25% unavailable.")
  if (summary.capitalProtectionState === null) warnings.push("Capital protection state unavailable.")
  if (summary.classification === null) warnings.push("Classification unavailable.")
  if (summary.investorShield.overallStatus === null) warnings.push("Investor Shield status unavailable.")
  if (summary.investorShield.missingEvidenceCount === null) warnings.push("Missing evidence count unavailable.")
  if (summary.latestOffer === null) warnings.push("Latest offer unavailable.")
  if (summary.recommendedNextAction.actionText === null) warnings.push("Recommended action unavailable.")

  return warnings
}

function SectionTitle({ children }: { children: string }) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{children}</h3>
}

export default function InvestorSummaryPanel({ summary }: InvestorSummaryPanelProps) {
  const warnings = collectWarnings(summary)

  return (
    <section aria-labelledby="investor-summary-heading" className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <header className="border-b border-gray-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Read-only investor summary</p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 id="investor-summary-heading" className="text-xl font-semibold text-gray-900">
              Investor Summary
            </h2>
            <p className="mt-1 text-sm text-gray-600">{summary.deal.address}</p>
            <p className="text-xs text-gray-500">Deal ID: {summary.deal.dealId}</p>
          </div>
          <div className="grid gap-2 sm:min-w-72">
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Primary Status</p>
              <p className="mt-1 text-sm font-medium text-gray-900">Classification: {text(summary.classification)}</p>
              <p className="text-sm text-gray-900">Capital Protection: {text(summary.capitalProtectionState)}</p>
            </div>
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
              <p className="text-xs uppercase tracking-wide text-gray-500">Investor Shield</p>
              <p className="mt-1 text-sm font-medium text-gray-900">
                Overall Status: {text(summary.investorShield.overallStatus)}
              </p>
              <p className="text-sm text-gray-900">
                Missing Evidence Count: {summary.investorShield.missingEvidenceCount ?? UNAVAILABLE_LABEL}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-6 space-y-4">
        <section aria-labelledby="investor-summary-financial-heading" className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <SectionTitle>Financial Snapshot</SectionTitle>
          <h3 id="investor-summary-financial-heading" className="mt-1 text-sm font-semibold text-gray-900">
            Financial Snapshot
          </h3>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">Purchase Price</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.purchasePrice)}</dd>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">GDV Downside</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.gdvRange.downside)}</dd>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">GDV Realistic</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.gdvRange.realistic)}</dd>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">GDV Strong</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.gdvRange.strong)}</dd>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">True MAO 15%</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.trueMao.fifteenPercent)}</dd>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">True MAO 20%</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.trueMao.twentyPercent)}</dd>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <dt className="text-xs uppercase tracking-wide text-gray-500">True MAO 25%</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">{money(summary.trueMao.twentyFivePercent)}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="investor-summary-shield-heading" className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <SectionTitle>Capital Protection and Investor Shield</SectionTitle>
          <h3 id="investor-summary-shield-heading" className="mt-1 text-sm font-semibold text-gray-900">
            Capital Protection and Investor Shield
          </h3>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Capital Protection State</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{text(summary.capitalProtectionState)}</p>
            </div>
            <div className="rounded border border-gray-200 bg-white px-3 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Investor Shield Status</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{text(summary.investorShield.overallStatus)}</p>
              <p className="text-sm text-gray-700">
                Missing Evidence Count: {summary.investorShield.missingEvidenceCount ?? UNAVAILABLE_LABEL}
              </p>
              <p className="mt-2 text-xs text-gray-600">
                Deterministic risk remains visible when blocked or cautionary values are present.
              </p>
            </div>
          </div>
          <div className="mt-4 rounded border border-gray-200 bg-white px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Blocked Gates</p>
            {summary.investorShield.blockedGates.length === 0 ? (
              <p className="mt-1 text-sm text-gray-700">No blocked gates recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2" aria-label="Blocked gates">
                {summary.investorShield.blockedGates.map((gate) => (
                  <li key={gate.gateKey} className="rounded border border-gray-200 bg-gray-50 px-3 py-2">
                    <p className="text-sm font-medium text-gray-900">{gate.label ?? gate.gateKey}</p>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Gate Key: {gate.gateKey}</p>
                    <p className="text-sm text-gray-700">Gate Type: {text(gate.gateType)}</p>
                    <p className="text-sm text-gray-700">Blocker Reason: {text(gate.blockerReason)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section aria-labelledby="investor-summary-actions-heading" className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <SectionTitle>Recommended Actions</SectionTitle>
          <h3 id="investor-summary-actions-heading" className="mt-1 text-sm font-semibold text-gray-900">
            Recommended Actions
          </h3>
          <div className="mt-4 rounded border border-gray-200 bg-white px-3 py-3">
            <p className="text-xs uppercase tracking-wide text-gray-500">Recommended Next Action</p>
            <p className="mt-1 text-sm font-medium text-gray-900">{text(summary.recommendedNextAction.actionText)}</p>
            <p className="text-sm text-gray-700">Source: {summary.recommendedNextAction.source}</p>
          </div>
        </section>

        <section aria-labelledby="investor-summary-tasks-heading" className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <SectionTitle>Active Tasks and Blockers</SectionTitle>
          <h3 id="investor-summary-tasks-heading" className="mt-1 text-sm font-semibold text-gray-900">
            Active Tasks and Blockers
          </h3>
          {summary.activeTasks.length === 0 ? (
            <p className="mt-4 text-sm text-gray-700">No active tasks.</p>
          ) : (
            <ul className="mt-4 space-y-3" aria-label="Active tasks">
              {summary.activeTasks.map((task) => (
                <li key={task.taskId} className="rounded border border-gray-200 bg-white px-3 py-3">
                  <p className="text-sm font-medium text-gray-900">{task.title}</p>
                  <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Task Type</dt>
                      <dd className="text-sm text-gray-700">{task.taskType}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
                      <dd className="text-sm text-gray-700">{task.status}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Priority</dt>
                      <dd className="text-sm text-gray-700">{task.priority}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Due Date</dt>
                      <dd className="text-sm text-gray-700">{text(task.dueDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Blocker Reason</dt>
                      <dd className="text-sm text-gray-700">{text(task.blockerReason)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Created At</dt>
                      <dd className="text-sm text-gray-700">{task.createdAt}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-gray-500">Completed At</dt>
                      <dd className="text-sm text-gray-700">{text(task.completedAt)}</dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="investor-summary-offer-heading" className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <SectionTitle>Latest Offer</SectionTitle>
          <h3 id="investor-summary-offer-heading" className="mt-1 text-sm font-semibold text-gray-900">
            Latest Offer
          </h3>
          {summary.latestOffer === null ? (
            <p className="mt-4 text-sm text-gray-700">No latest offer available.</p>
          ) : (
            <div className="mt-4 rounded border border-gray-200 bg-white px-3 py-3">
              <p className="text-sm font-medium text-gray-900">{money(summary.latestOffer.amount)}</p>
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Offer Type</dt>
                  <dd className="text-sm text-gray-700">{summary.latestOffer.offerType}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Offer Status</dt>
                  <dd className="text-sm text-gray-700">{summary.latestOffer.offerStatus}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Rationale</dt>
                  <dd className="text-sm text-gray-700">{text(summary.latestOffer.rationale)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Seller Response</dt>
                  <dd className="text-sm text-gray-700">{text(summary.latestOffer.sellerResponse)}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-gray-500">Created At</dt>
                  <dd className="text-sm text-gray-700">{summary.latestOffer.createdAt}</dd>
                </div>
              </dl>
            </div>
          )}
        </section>

        <section aria-labelledby="investor-summary-warnings-heading" className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
          <SectionTitle>Warnings and Unavailable Data</SectionTitle>
          <h3 id="investor-summary-warnings-heading" className="mt-1 text-sm font-semibold text-gray-900">
            Warnings and Unavailable Data
          </h3>
          {warnings.length === 0 ? (
            <p className="mt-4 text-sm text-gray-700">No warnings or unavailable fields.</p>
          ) : (
            <ul className="mt-4 space-y-2" aria-label="Warnings">
              {warnings.map((warning) => (
                <li key={warning} className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {warning}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  )
}
