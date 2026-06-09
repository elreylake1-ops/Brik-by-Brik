import type { InvestorShieldUiViewModel } from "@/types/investor-shield-ui"
import InvestorShieldGateList from "@/components/InvestorShieldGateList"
import InvestorShieldAdvisoryList from "@/components/InvestorShieldAdvisoryList"

type Props = {
  model: InvestorShieldUiViewModel
}

function sectionHeading(label: string) {
  return <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h3>
}

export default function InvestorShieldPanel({ model }: Props) {
  const requiredGates = model.gates.filter((gate) => gate.gateType === "required")

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="mb-4 border-b border-gray-100 pb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">
          Investor Shield / Due Diligence Lock
        </p>
        <h2 className="mt-2 text-xl font-semibold text-gray-900">Investor Shield</h2>
        <p className="mt-1 text-sm text-gray-600">{model.summary.subheadline}</p>
      </header>

      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          {sectionHeading("Deterministic Governance")}
          <div className="mt-2 space-y-1 text-sm text-gray-800">
            <p>Classification: {model.deterministicGovernance.classification}</p>
            <p>Governance State: {model.deterministicGovernance.governanceState}</p>
            <p>Capital Protection: {model.deterministicGovernance.capitalProtectionState}</p>
            <p>Dominant: {model.deterministicGovernance.isDominant ? "Yes" : "No"}</p>
            {model.deterministicGovernance.warningText ? (
              <p className="text-xs text-amber-700">{model.deterministicGovernance.warningText}</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          {sectionHeading("Required Gates")}
          <p className="mt-2 text-sm text-gray-700">
            Blocking gates: {model.summary.blockingGateCount}. Caution gates:{" "}
            {model.summary.cautionGateCount}.
          </p>
          <InvestorShieldGateList gates={requiredGates} />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          {sectionHeading("Advisory Signals")}
          <InvestorShieldAdvisoryList signals={model.advisorySignals} />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          {sectionHeading("Protected Movement")}
          <div className="mt-2 space-y-1 text-sm text-gray-800">
            <p>Current Pipeline State: {model.protectedMovement.currentPipelineState}</p>
            <p>Movement Allowed: {model.protectedMovement.movementAllowed ? "Yes" : "No"}</p>
            <p>
              Pipeline Mutation Prevented:{" "}
              {model.protectedMovement.pipelineMutationPrevented ? "Yes" : "No"}
            </p>
            {model.protectedMovement.blockedReason ? (
              <p className="font-medium text-red-700">Blocked: {model.protectedMovement.blockedReason}</p>
            ) : null}
            <p className="text-xs text-gray-600">{model.protectedMovement.explanation}</p>
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          {sectionHeading("Task Recommendations")}
          {model.taskRecommendations.length > 0 ? (
            <div className="mt-3 space-y-2 text-sm text-gray-800">
              {model.taskRecommendations.map((task) => (
                <div key={task.taskKey} className="rounded border border-blue-200 bg-white px-3 py-2">
                  <p className="font-medium text-gray-900">{task.title}</p>
                  <p className="text-xs text-gray-600">{task.description}</p>
                  <p className="text-xs text-gray-600">Gate: {task.gateKey}</p>
                  <p className="text-xs text-gray-600">Open task recommendation only</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-gray-700">No task recommendations.</p>
          )}
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          {sectionHeading("Manual Review / Waiver")}
          <div className="mt-2 space-y-1 text-sm text-gray-800">
            <p>Manual Review Required: {model.manualReview.required ? "Yes" : "No"}</p>
            <p className="text-xs text-gray-600">{model.manualReview.reason}</p>
            <p className="text-xs text-gray-600">
              Does Not Clear Gate: {model.manualReview.doesNotClearGate ? "Yes" : "No"}
            </p>
            <p>Waiver Active: {model.waiverSummary.isWaived ? "Yes" : "No"}</p>
            {model.waiverSummary.reason ? (
              <p className="text-xs text-amber-700">
                Waiver reason: {model.waiverSummary.reason}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
