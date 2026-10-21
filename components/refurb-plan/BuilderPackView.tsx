import type { BuilderQuotePack } from "@/types/deal-documents"

// Operator-facing view of the Confidential Builder Quotation Pack.
// CONFIDENTIALITY RULE: Contains NO engine day-rates, internal margins, profit targets, or proprietary calculation data.
// Contains reviewed scope, recorded measurements, evidence timestamps, exclusions, and a blank contractor pricing sheet.

export default function BuilderPackView({ pack }: { pack: BuilderQuotePack }) {
  return (
    <article aria-label="Builder Quotation Request Pack" className="space-y-6 text-sm text-gray-900">
      <header className="rounded-2xl border border-slate-300 bg-slate-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            {pack.status} · {pack.approval.replace(/_/g, " ")} · Quotation Schedule
          </p>
          <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold text-slate-800">
            Version {pack.plan.version}
          </span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">Builder Quotation Request Pack</h1>
        <p className="mt-1 font-medium text-slate-800">{pack.dealRef.address}</p>
        <p className="text-xs text-slate-600">
          Generated {new Date(pack.generatedAt).toLocaleString()} · Assessment {pack.assessmentId} · Deal ref: {pack.dealRef.dealId}
        </p>

        {pack.simulatedDataWarning ? (
          <p role="note" className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950">
            <strong>Demonstration Notice:</strong> {pack.simulatedDataWarning}
          </p>
        ) : null}

        <p className="mt-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700">
          <strong>Confidentiality Notice:</strong> This document is prepared for contractor quotation. Internal proprietary rates, labour allowances, financial targets, investor returns, and engine formulas are strictly excluded.
        </p>
      </header>

      {/* 1. Property Measurements */}
      <section aria-label="Property measurements" className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">1. Property Measurements & Dimensions</h2>
        <p className="text-xs text-slate-600">{pack.measurements.statement}</p>
        {pack.measurements.entries.length === 0 ? (
          <p className="text-xs text-slate-500">No measurements recorded on file.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-700">
                <tr>
                  <th className="px-3 py-2 font-medium">Element</th>
                  <th className="px-3 py-2 font-medium">Room</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Basis</th>
                  <th className="px-3 py-2 font-medium">Source / Confidence</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {pack.measurements.entries.map((m, idx) => (
                  <tr key={`${m.label}-${m.room ?? ""}-${idx}`}>
                    <td className="px-3 py-2 font-medium text-slate-900">{m.label}</td>
                    <td className="px-3 py-2 text-slate-600">{m.room || "—"}</td>
                    <td className="px-3 py-2 font-semibold text-slate-900">
                      {m.value === null ? "To be established" : `${m.value} ${m.unit === "category" ? "" : m.unit}`}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{m.basis.replace(/_/g, " ")}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {m.source ? m.source.replace(/_/g, " ") : "—"} {m.confidence ? `(${m.confidence})` : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{m.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 2. Requested Scope of Works */}
      <section aria-label="Requested scope of works" className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">2. Requested Scope of Works</h2>
        <p className="text-xs text-slate-600">
          Works identified and confirmed by operator review. Quantities and specifications must be independently verified on site.
        </p>
        <div className="space-y-3">
          {pack.items.map((item) => (
            <div key={item.itemId} className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-1">
                <h3 className="font-semibold text-slate-900">{item.label}</h3>
                <div className="flex items-center gap-1.5">
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                    Area: {item.area.replace(/_/g, " ")}
                  </span>
                  {item.specialistInspectionRequired ? (
                    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                      Specialist Inspection Needed
                    </span>
                  ) : null}
                </div>
              </div>
              <p className="text-xs text-slate-800">{item.scopeRequested}</p>
              <p className="text-[11px] text-slate-500">Basis: {item.quantityBasis}</p>
              {item.evidence.length > 0 ? (
                <div className="rounded border border-slate-100 bg-slate-50 p-2 text-xs">
                  <span className="font-medium text-slate-700">Recorded evidence:</span>
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-slate-600">
                    {item.evidence.map((ev, i) => (
                      <li key={i}>
                        {ev.timestampSeconds.toFixed(1)}s {ev.room ? `(${ev.room})` : ""}: {ev.observation}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* 3. Assumptions and Exclusions */}
      <section aria-label="Assumptions and exclusions" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">Specification Assumptions</h3>
          <ul className="mt-2 list-disc pl-4 text-xs text-slate-700 space-y-1">
            {pack.assumptions.length === 0 ? <li>Standard trade practice applies.</li> : null}
            {pack.assumptions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="font-semibold text-slate-900">Excluded Items</h3>
          <ul className="mt-2 list-disc pl-4 text-xs text-slate-700 space-y-1">
            {pack.exclusions.length === 0 ? <li>No specific exclusions recorded.</li> : null}
            {pack.exclusions.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Blank Builder Pricing Sheet */}
      <section aria-label="Contractor pricing sheet" className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-950">3. Contractor Pricing Schedule (Blank)</h2>
        <p className="text-xs text-slate-600">
          To be completed by the tendering contractor. Please provide fixed pricing excluding VAT.
        </p>
        {pack.pricingSheet.instructions ? (
          <p className="text-xs text-slate-500 italic">{pack.pricingSheet.instructions}</p>
        ) : null}
        <div className="overflow-x-auto rounded-xl border border-slate-300">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-300 bg-slate-100 text-slate-800">
              <tr>
                <th className="px-3 py-2 font-medium">Work Item</th>
                <th className="px-3 py-2 font-medium">Price (ex. VAT)</th>
                <th className="px-3 py-2 font-medium">Included Works</th>
                <th className="px-3 py-2 font-medium">Excluded Works</th>
                <th className="px-3 py-2 font-medium">Working Days</th>
                <th className="px-3 py-2 font-medium">Contractor Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {pack.pricingSheet.lines.map((line) => (
                <tr key={line.itemId} className="h-10">
                  <td className="px-3 py-2 font-medium text-slate-900">{line.label}</td>
                  <td className="px-3 py-2 border-l border-dashed border-slate-200 text-slate-400 font-mono">£ ____________</td>
                  <td className="px-3 py-2 border-l border-dashed border-slate-200 text-slate-400">____________________</td>
                  <td className="px-3 py-2 border-l border-dashed border-slate-200 text-slate-400">____________________</td>
                  <td className="px-3 py-2 border-l border-dashed border-slate-200 text-slate-400 font-mono">____ days</td>
                  <td className="px-3 py-2 border-l border-dashed border-slate-200 text-slate-400">____________________</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className="border-t border-slate-200 pt-3 text-xs text-slate-500">
        <p>Draft quotation schedule issued for pricing purposes only. All dimensions and conditions are subject to contractor site survey.</p>
      </footer>
    </article>
  )
}
