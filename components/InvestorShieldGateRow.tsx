import type { InvestorShieldGateDisplay } from "@/types/investor-shield-ui"

type Props = {
  gate: InvestorShieldGateDisplay
}

function statusToneClasses(gate: InvestorShieldGateDisplay): string {
  if (gate.gateType === "advisory") {
    return "border-blue-200 bg-blue-50"
  }

  if (gate.waiver.isWaived || gate.status === "waived") {
    return "border-amber-200 bg-amber-50"
  }

  if (gate.isBlocking) {
    return "border-red-200 bg-red-50"
  }

  if (gate.status === "satisfied") {
    return "border-green-200 bg-green-50"
  }

  if (gate.manualReviewRequired) {
    return "border-amber-200 bg-amber-50"
  }

  return "border-gray-200 bg-white"
}

function statusLabel(gate: InvestorShieldGateDisplay): string {
  if (gate.gateType === "advisory") {
    return "Advisory signal"
  }

  switch (gate.status) {
    case "blocked":
      return "Blocked"
    case "failed":
      return "Failed"
    case "missing_evidence":
      return "Missing evidence"
    case "weak_evidence":
      return "Weak evidence"
    case "manual_review_required":
      return "Manual review required"
    case "waived":
      return "Waived"
    case "satisfied":
      return "Satisfied"
    default:
      return "Not started"
  }
}

function evidenceLabel(gate: InvestorShieldGateDisplay): string {
  switch (gate.evidenceStatus) {
    case "not_provided":
      return "Not provided"
    case "weak":
      return "Weak"
    case "sufficient":
      return "Sufficient"
    case "failed":
      return "Failed"
    case "waived":
      return "Waived"
    case "advisory_only":
      return "Advisory only"
    case "not_applicable":
      return "Not applicable"
    default:
      return gate.evidenceStatus
  }
}

function gateTypeLabel(gate: InvestorShieldGateDisplay): string {
  return gate.gateType === "advisory" ? "Advisory Signal" : "Required Gate"
}

export default function InvestorShieldGateRow({ gate }: Props) {
  return (
    <article className={`rounded-lg border px-3 py-3 ${statusToneClasses(gate)}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-900">{gate.label}</p>
          <p className="text-xs uppercase tracking-wide text-gray-500">{gateTypeLabel(gate)}</p>
        </div>
        <div className="text-right text-xs text-gray-600">
          <p>Status: {statusLabel(gate)}</p>
          <p>Evidence: {evidenceLabel(gate)}</p>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm text-gray-800 sm:grid-cols-2">
        <p>
          Blocking state:{" "}
          <span className={gate.isBlocking ? "font-semibold text-red-700" : "text-gray-700"}>
            {gate.isBlocking ? "Blocking" : "Not blocking"}
          </span>
        </p>
        <p>
          Manual review:{" "}
          <span className={gate.manualReviewRequired ? "font-semibold text-amber-700" : "text-gray-700"}>
            {gate.manualReviewRequired ? "Required" : "Not required"}
          </span>
        </p>
        <p className="sm:col-span-2">
          Task recommendations:{" "}
          {gate.taskRecommendationIds.length > 0
            ? `${gate.taskRecommendationIds.length} (${gate.taskRecommendationIds.join(", ")})`
            : "None"}
        </p>
      </div>

      {gate.missingEvidenceWarnings.length > 0 ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-medium">Missing evidence warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {gate.missingEvidenceWarnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {gate.waiver.isWaived ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <p className="font-medium">Waiver active</p>
          <p className="mt-1">
            {gate.waiver.reason ?? "Waived"} - distinct from satisfied evidence.
          </p>
          {gate.waiver.warningText ? (
            <p className="mt-1 text-xs text-amber-800">{gate.waiver.warningText}</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">Waiver: none</p>
      )}

      <p className="mt-3 text-sm text-gray-700">{gate.helperText}</p>
    </article>
  )
}
