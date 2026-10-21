"use client"

import { useState, type ReactNode } from "react"
import { filterChecks, summariseChecks, type CheckFilter, type CheckState, type CheckStateRow } from "@/lib/viewing-assessment/check-states"

// All checks, in checklist order, each with an explicit state. NOT ASSESSED is the default and stays the state until a
// person decides otherwise: an unreviewed AI suggestion is shown beside a check as a suggestion awaiting review, and
// never moves the check. Rows open lazily, so frame images are only requested for the checks being looked at.
//
// This component never imports checklist text. Titles and groups arrive from the server only when their reuse is approved;
// otherwise the rows show ids alone.

export type CheckMeta = { id: string; title?: string; group?: string }

type Props = {
  rows: readonly CheckStateRow[]
  meta: readonly CheckMeta[]
  /** Renders the suggestions for one check (the parent supplies the live review controls). */
  renderItems: (row: CheckStateRow, title: string | undefined) => ReactNode
}

const STATE_LABEL: Record<CheckState, string> = {
  NOT_ASSESSED: "NOT ASSESSED",
  OBSERVED: "OBSERVED (reviewed): not a pass",
  CONCERN: "CONCERN (reviewed)",
  SPECIALIST_REVIEW: "SPECIALIST INSPECTION RECOMMENDED",
  NOT_ACCESSIBLE: "NOT ACCESSIBLE",
  NOT_APPLICABLE: "NOT APPLICABLE",
}

const STATE_TONE: Record<CheckState, string> = {
  NOT_ASSESSED: "bg-slate-100 text-slate-700",
  OBSERVED: "bg-blue-100 text-blue-900",
  CONCERN: "bg-amber-100 text-amber-900",
  SPECIALIST_REVIEW: "bg-red-100 text-red-900",
  NOT_ACCESSIBLE: "bg-purple-100 text-purple-900",
  NOT_APPLICABLE: "bg-slate-100 text-slate-700",
}

const FILTERS: { value: CheckFilter; label: string }[] = [
  { value: "all", label: "All checks" },
  { value: "needs_review", label: "AI suggestion awaiting review" },
  { value: "specialist", label: "Specialist inspection recommended" },
  { value: "reviewed", label: "Reviewed by a person" },
  { value: "not_assessed", label: "Not assessed" },
]

function CheckRow({ row, title, children }: { row: CheckStateRow; title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <details
        className="rounded-lg border border-slate-200 bg-white"
        data-testid="check-row"
        data-check-id={row.checkId}
        data-state={row.state}
        onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-2 text-sm">
          <span className="font-semibold">
            {row.checkId}
            {title ? ` ${title}` : ""}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_TONE[row.state]}`} data-testid="check-state">
            {STATE_LABEL[row.state]}
          </span>
          {row.pendingCount > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900" data-testid="check-pending">
              AI suggestion awaiting review ({row.pendingCount})
            </span>
          ) : null}
          {row.rejectedCount > 0 ? <span className="text-xs text-slate-500">{row.rejectedCount} rejected</span> : null}
        </summary>
        {open ? (
          <div className="space-y-2 border-t border-slate-200 p-3">
            {row.items.length === 0 ? (
              <p className="text-sm text-slate-600" data-testid="check-empty">
                No evidence-backed suggestion for this check. It stays NOT ASSESSED until a person assesses it; absence of a suggestion is not a clean result.
              </p>
            ) : (
              <ul className="space-y-3">{children}</ul>
            )}
          </div>
        ) : null}
      </details>
    </li>
  )
}

export default function ChecklistReview({ rows, meta, renderItems }: Props) {
  const [filter, setFilter] = useState<CheckFilter>("all")
  const byId = new Map(meta.map((m) => [m.id, m]))
  const visible = filterChecks(rows, filter)
  const totals = summariseChecks(rows)

  // group headings only when the server supplied group names
  const groups: { name: string | null; rows: CheckStateRow[] }[] = []
  for (const row of visible) {
    const name = byId.get(row.checkId)?.group ?? null
    const last = groups[groups.length - 1]
    if (last && last.name === name) last.rows.push(row)
    else groups.push({ name, rows: [row] })
  }

  return (
    <section aria-labelledby="checklist-heading" className="space-y-2" data-testid="checklist">
      <h3 id="checklist-heading" className="text-base font-bold text-slate-950">
        Checklist ({totals.total} checks)
      </h3>
      <p className="text-sm text-slate-700" data-testid="checklist-summary">
        {totals.notAssessed} not assessed · {totals.humanReviewed} reviewed by a person · {totals.awaitingReview} with an AI suggestion awaiting review · {totals.specialist} needing specialist inspection
      </p>
      <label className="block text-sm">
        Show
        <select value={filter} onChange={(e) => setFilter(e.target.value as CheckFilter)} className="ml-2 rounded border border-slate-300 px-2 py-1" data-testid="checklist-filter">
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
      </label>
      {visible.length === 0 ? <p className="text-sm text-slate-600">No checks match this filter.</p> : null}
      {groups.map((group, i) => (
        <div key={`${group.name ?? "ungrouped"}-${i}`} className="space-y-1">
          {group.name ? <h4 className="pt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{group.name}</h4> : null}
          <ul className="space-y-1">
            {group.rows.map((row) => (
              <CheckRow key={row.checkId} row={row} title={byId.get(row.checkId)?.title}>
                {renderItems(row, byId.get(row.checkId)?.title)}
              </CheckRow>
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
