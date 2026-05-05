"use client"

import { formatCurrency, formatPercent, formatProfit } from "@/lib/formatters"
import type { DealInputs } from "@/types/deal"
import type { DealWithRefurbResult } from "@/lib/engine/analyze-deal-with-refurb"

type Props = {
  inputs: DealInputs
  result: DealWithRefurbResult
}

function sectionTitle(label: string) {
  return <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</h3>
}

function verdictClasses(status: DealWithRefurbResult["verdict"]["status"]): string {
  if (status === "GO") return "border-green-200 bg-green-50 text-green-800"
  if (status === "CONDITIONAL") return "border-amber-200 bg-amber-50 text-amber-800"
  if (status === "NO-GO") return "border-red-200 bg-red-50 text-red-800"
  return "border-gray-200 bg-gray-50 text-gray-800"
}

export default function EngineAnalysisPanel({ inputs, result }: Props) {
  const refurbTotal = result.refurbSource === "generated"
    ? formatCurrency(result.refurb?.totalRefurbCost ?? 0)
    : `${formatCurrency(inputs.refurbCost)} (manual)`

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-800">Engine Analysis Output</h2>
      <p className="mt-1 text-xs text-gray-500">
        Client-demo view from engine output only. No UI-side calculation shortcuts.
      </p>

      {sectionTitle("Verdict and Confidence")}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={`rounded border p-4 ${verdictClasses(result.verdict.status)}`}>
          <div className="text-xs font-medium uppercase tracking-wide">Verdict</div>
          <div className="mt-1 text-xl font-bold">{result.verdict.status}</div>
          <p className="mt-2 text-xs">{result.verdict.reason}</p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Confidence</div>
          <div className="mt-1 text-xl font-bold text-gray-900">
            {result.confidence.score}%
          </div>
          <div className="text-sm font-medium text-gray-700">{result.confidence.band}</div>
          <p className="mt-2 text-xs text-gray-500">
            Confidence summarizes warning level, override usage, and input completeness.
          </p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <div className="text-xs text-gray-500">Refurb Mode</div>
          <div className="mt-1 text-base font-semibold text-gray-900">{result.refurbSource}</div>
          <p className="mt-2 text-xs text-gray-500">
            Manual mode uses input refurb cost. Scope mode uses task-generated refurb analysis.
          </p>
        </div>
      </div>

      {result.confidence.factors.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-gray-500">
          {result.confidence.factors.map((factor, idx) => (
            <li key={idx}>{factor}</li>
          ))}
        </ul>
      )}

      {sectionTitle("Deal Numbers")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Total Investment</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{formatCurrency(result.deal.totalCost)}</div>
        </div>
        <div className="rounded border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Profit</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">{formatProfit(result.deal.profit)}</div>
          <div className="text-xs text-gray-500">{formatPercent(result.deal.profitMargin)}</div>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">MAO Target</th>
              <th className="px-3 py-2">Max Purchase</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100"><td className="px-3 py-2">15%</td><td className="px-3 py-2">{formatCurrency(result.deal.trueMao.fifteenPercent)}</td></tr>
            <tr className="border-t border-gray-100"><td className="px-3 py-2">20%</td><td className="px-3 py-2">{formatCurrency(result.deal.trueMao.twentyPercent)}</td></tr>
            <tr className="border-t border-gray-100"><td className="px-3 py-2">25%</td><td className="px-3 py-2">{formatCurrency(result.deal.trueMao.twentyFivePercent)}</td></tr>
          </tbody>
        </table>
      </div>

      {sectionTitle("Refurb Breakdown")}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded border border-gray-200 p-3"><div className="text-xs text-gray-500">Refurb Cost</div><div className="mt-1 text-sm font-semibold text-gray-900">{refurbTotal}</div></div>
        <div className="rounded border border-gray-200 p-3"><div className="text-xs text-gray-500">Labour Cost</div><div className="mt-1 text-sm font-semibold text-gray-900">{result.refurb ? formatCurrency(result.refurb.labourCost) : "N/A (manual mode)"}</div></div>
        <div className="rounded border border-gray-200 p-3"><div className="text-xs text-gray-500">Material Cost</div><div className="mt-1 text-sm font-semibold text-gray-900">{result.refurb ? formatCurrency(result.refurb.materialCost) : "N/A (manual mode)"}</div></div>
      </div>

      {sectionTitle("Finance and Fees")}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Finance Cost</div>
          <div className="mt-1 text-sm text-gray-700">Interest: {formatCurrency(result.deal.financeCost.interest)}</div>
          <div className="text-sm text-gray-700">Arrangement: {formatCurrency(result.deal.financeCost.arrangementFee)}</div>
          <div className="text-sm text-gray-700">Exit: {formatCurrency(result.deal.financeCost.exitFee)}</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">Total: {formatCurrency(result.deal.financeCost.totalFinanceCost)}</div>
        </div>
        <div className="rounded border border-gray-200 p-3">
          <div className="text-xs text-gray-500">Fees</div>
          <div className="mt-1 text-sm text-gray-700">Stamp Duty: {formatCurrency(inputs.stampDuty)}</div>
          <div className="text-sm text-gray-700">Legal: {formatCurrency(inputs.legalCosts)}</div>
          <div className="text-sm text-gray-700">Sale: {formatCurrency(inputs.saleCosts)}</div>
          <div className="mt-1 text-sm font-semibold text-gray-900">Total Fees: {formatCurrency(inputs.stampDuty + inputs.legalCosts + inputs.saleCosts)}</div>
        </div>
      </div>

      {sectionTitle("Timeline")}
      {result.timeline ? (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Metric</th>
                <th className="px-3 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100"><td className="px-3 py-2">Working Days</td><td className="px-3 py-2">{result.timeline.totalWorkingDays}</td></tr>
              <tr className="border-t border-gray-100"><td className="px-3 py-2">With Contingency</td><td className="px-3 py-2">{result.timeline.totalWorkingDaysWithContingency}</td></tr>
              <tr className="border-t border-gray-100"><td className="px-3 py-2">Estimated Weeks</td><td className="px-3 py-2">{result.timeline.totalCalendarWeeks}</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Timeline available in generated scope mode only.</p>
      )}

      {sectionTitle("Assumptions and Warnings")}
      <p className="mb-2 text-xs text-gray-500">
        Assumptions and warnings keep estimate auditable. Review before relying on numbers for an offer.
      </p>
      {result.warnings.length > 0 ? (
        <ul className="space-y-2 text-sm text-amber-800">
          {result.warnings.map((warning, idx) => (
            <li key={idx} className="rounded border border-amber-200 bg-amber-50 px-3 py-2">{warning}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500">No warnings.</p>
      )}
      {result.assumptionsReport.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {result.assumptionsReport.map((assumption, idx) => (
            <li key={idx}>{assumption}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-gray-500">No assumptions report in manual mode.</p>
      )}

      {sectionTitle("Overrides Applied")}
      <p className="mb-2 text-xs text-gray-500">
        Overrides shown for audit trail so manual adjustments remain visible to reviewers.
      </p>
      {result.overridesApplied.length > 0 ? (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Override ID</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Target</th>
                <th className="px-3 py-2">Previous</th>
                <th className="px-3 py-2">New</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.overridesApplied.map((entry) => (
                <tr key={`${entry.overrideId}-${entry.target}`} className="border-t border-gray-100">
                  <td className="px-3 py-2">{entry.overrideId}</td>
                  <td className="px-3 py-2">{entry.type}</td>
                  <td className="px-3 py-2">{entry.target}</td>
                  <td className="px-3 py-2">{entry.previousValue === null ? "null" : String(entry.previousValue)}</td>
                  <td className="px-3 py-2">{String(entry.newValue)}</td>
                  <td className="px-3 py-2">{entry.reason ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">No overrides applied.</p>
      )}

      {sectionTitle("Room Breakdown")}
      {result.refurb ? (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-3 py-2">Room</th><th className="px-3 py-2">Cost</th></tr>
            </thead>
            <tbody>
              {Object.entries(result.refurb.roomBreakdown).map(([room, cost]) => (
                <tr key={room} className="border-t border-gray-100"><td className="px-3 py-2">{room}</td><td className="px-3 py-2">{formatCurrency(cost)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Room breakdown available in generated scope mode only.</p>
      )}

      {sectionTitle("Trade Breakdown")}
      {result.refurb ? (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-3 py-2">Trade</th><th className="px-3 py-2">Cost</th></tr>
            </thead>
            <tbody>
              {Object.entries(result.refurb.tradeBreakdown).map(([trade, cost]) => (
                <tr key={trade} className="border-t border-gray-100"><td className="px-3 py-2">{trade}</td><td className="px-3 py-2">{formatCurrency(cost ?? 0)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Trade breakdown available in generated scope mode only.</p>
      )}

      {sectionTitle("Task List")}
      {result.refurb ? (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2">Task ID</th>
                <th className="px-3 py-2">Task</th>
                <th className="px-3 py-2">Trade</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {result.refurb.taskList.map((task) => (
                <tr key={task.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">{task.id}</td>
                  <td className="px-3 py-2">{task.taskName}</td>
                  <td className="px-3 py-2">{task.trade}</td>
                  <td className="px-3 py-2">{task.quantity}</td>
                  <td className="px-3 py-2">{formatCurrency(task.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Task list available in generated scope mode only.</p>
      )}
    </div>
  )
}
