import type { RefurbCostResult } from "@/types/scope"
import type { RefurbTimeline } from "@/types/refurb"
import { formatCurrency } from "@/lib/formatters"

type Props = {
  refurb: RefurbCostResult
  timeline: RefurbTimeline
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wider text-gray-400">
      {children}
    </h3>
  )
}

export default function RefurbBreakdownSummary({ refurb, timeline }: Props) {
  const taskCount = refurb.taskList.length

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6 shadow-sm">
      <h2 className="mb-2 text-lg font-semibold text-gray-800">Refurb Scope Breakdown</h2>
      <p className="mb-1 text-xs text-gray-500">Generated from task-based refurb scope. This is an estimate, not a contractor quote.</p>

      <SectionHeading>Cost Summary</SectionHeading>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm">
          <span className="text-sm font-semibold text-gray-700">Generated Refurb Cost</span>
          <span className="text-sm font-bold text-blue-700">
            {formatCurrency(refurb.totalRefurbCost)}
          </span>
        </div>
        <Row label="Labour Cost" value={formatCurrency(refurb.labourCost)} />
        <Row label="Material Cost" value={formatCurrency(refurb.materialCost)} />
        <Row label="Tasks Generated" value={`${taskCount} task${taskCount !== 1 ? "s" : ""}`} />
      </div>

      <SectionHeading>Timeline Estimate</SectionHeading>
      <div className="flex flex-col gap-3">
        <Row
          label="Estimated Duration"
          value={`${timeline.totalCalendarWeeks} week${timeline.totalCalendarWeeks !== 1 ? "s" : ""}`}
        />
        <Row
          label="Working Days (inc. contingency)"
          value={`${timeline.totalWorkingDaysWithContingency} days`}
        />
        <p className="text-xs text-gray-400">
          Includes {((timeline.contingencyFactor - 1) * 100).toFixed(0)}% contingency. Trades working in parallel within phases.
        </p>
      </div>

      {refurb.confidenceFlags.length > 0 && (
        <>
          <SectionHeading>Warnings</SectionHeading>
          <ul className="flex flex-col gap-2">
            {refurb.confidenceFlags.map((flag, i) => (
              <li
                key={i}
                className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800"
              >
                {flag}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
