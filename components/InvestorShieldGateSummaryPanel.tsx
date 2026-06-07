import type { InvestorShieldUiModel } from "@/lib/investor-shield/investor-shield-ui-adapter"

type Props = {
  model: InvestorShieldUiModel
}

type CountCardProps = {
  label: string
  value: number
}

type GateRow = InvestorShieldUiModel["gateSummaries"][number]

function countCard({ label, value }: CountCardProps) {
  return (
    <div className="rounded border border-gray-200 bg-white px-3 py-3">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function toneClasses(status: InvestorShieldUiModel["overallStatus"]): string {
  if (status === "CLEAR") {
    return "border-green-200 bg-green-50 text-green-800"
  }

  if (status === "CAUTION") {
    return "border-amber-200 bg-amber-50 text-amber-800"
  }

  return "border-red-200 bg-red-50 text-red-800"
}

function formatBooleanLabel(value: boolean): string {
  return value ? "Can progress" : "Cannot progress"
}

function getMissingEvidenceText(gate: GateRow): string | null {
  if (gate.missingEvidenceSummary.length === 0) {
    return null
  }

  const prefix =
    gate.severity === "BLOCKER" || gate.severity === "FATAL"
      ? "Missing evidence:"
      : "Missing evidence"

  return `${prefix} ${gate.missingEvidenceSummary.join(", ")}`
}

export default function InvestorShieldGateSummaryPanel({ model }: Props) {
  return (
    <section className="rounded border border-gray-200 bg-gray-50 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Investor Shield</h2>
          <p className="mt-1 text-xs text-gray-500">
            Read-only due diligence gate summary.
          </p>
        </div>

        <div className={`rounded border px-3 py-2 text-sm font-medium ${toneClasses(model.overallStatus)}`}>
          <p>Overall Status: {model.overallStatus}</p>
          <p className="mt-1">Progression Decision: {model.progressionDecision}</p>
          <p className="mt-1">{formatBooleanLabel(model.canProgress)}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {countCard({ label: "Blocking Gates", value: model.blockingGateKeys.length })}
        {countCard({ label: "Caution Gates", value: model.cautionGateKeys.length })}
        {countCard({ label: "Missing Evidence Gates", value: model.missingEvidenceGateKeys.length })}
        {countCard({ label: "Advisory Warnings", value: model.advisoryWarnings.length })}
      </div>

      <div className="mt-4 overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Gate</th>
              <th className="px-3 py-2">Label</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Confidence</th>
              <th className="px-3 py-2">Evidence</th>
              <th className="px-3 py-2">Explanation</th>
              <th className="px-3 py-2">Next Action</th>
            </tr>
          </thead>
          <tbody>
            {model.gateSummaries.length === 0 ? (
              <tr className="border-t border-gray-100">
                <td className="px-3 py-3 text-gray-500" colSpan={8}>
                  No Investor Shield gates available.
                </td>
              </tr>
            ) : (
              model.gateSummaries.map((gate) => (
                <tr key={gate.key} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-3 text-gray-900">{gate.label}</td>
                  <td className="px-3 py-3 text-gray-700">{gate.requiredLabel}</td>
                  <td className="px-3 py-3 text-gray-700">{gate.status}</td>
                  <td className="px-3 py-3 text-gray-700">{gate.severity}</td>
                  <td className="px-3 py-3 text-gray-700">{gate.confidence}</td>
                  <td className="px-3 py-3 text-gray-700">
                    <div className="space-y-1">
                      <div>{gate.evidenceCount}</div>
                      {getMissingEvidenceText(gate) && (
                        <p className="text-xs text-gray-500">{getMissingEvidenceText(gate)}</p>
                      )}
                      {gate.subGates && gate.subGates.length > 0 && (
                        <div className="space-y-2 pt-1">
                          {gate.subGates.map((subGate) => (
                            <div key={subGate.key} className="rounded border border-gray-200 bg-gray-50 px-2 py-2 text-xs text-gray-600">
                              <div className="font-medium text-gray-700">
                                {subGate.label}{" "}
                                <span className="text-gray-500">({subGate.requiredLabel})</span>
                              </div>
                              <div>Status: {subGate.status}</div>
                              <div>Severity: {subGate.severity}</div>
                              <div>Confidence: {subGate.confidence}</div>
                              <div>Evidence: {subGate.evidenceCount}</div>
                              {subGate.missingEvidenceSummary.length > 0 && (
                                <div className="text-gray-500">
                                  Missing: {subGate.missingEvidenceSummary.join(", ")}
                                </div>
                              )}
                              <div className="text-gray-500">{subGate.shortExplanation}</div>
                              {subGate.recommendedNextAction && (
                                <div className="text-gray-500">
                                  Next: {subGate.recommendedNextAction}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-700">
                    <div className="space-y-1">
                      <p>{gate.shortExplanation}</p>
                      {gate.recommendedNextAction ? (
                        <p className="text-xs text-gray-500">Next: {gate.recommendedNextAction}</p>
                      ) : (
                        <p className="text-xs text-gray-500">Next: N/A</p>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
