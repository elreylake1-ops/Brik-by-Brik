import type {
  ProfessionalEvidenceGatewayGate,
  ProfessionalEvidenceGatewayViewModel,
} from "@/types/professional-evidence-gateway"

export type ProfessionalEvidenceGatewayProofPanelProps = {
  readonly seededSavedDealId: string
  readonly viewModel: ProfessionalEvidenceGatewayViewModel
  readonly rightmoveRule: string
  readonly qualifyingRule: string
  readonly investorShieldUnchangedNotice: string
}

function formatToken(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ")
}

function getConfirmingStatus(gate: ProfessionalEvidenceGatewayGate): string {
  return gate.professionalGateStatus === "CONFIRMED" &&
    gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
    ? "Confirming"
    : "Visible / non-confirming"
}

function isRightmoveSoldComparable(gate: ProfessionalEvidenceGatewayGate): boolean {
  return (
    gate.professionalGateArea === "SOLD_COMPARABLE_REVIEW" &&
    gate.reviewSource === "RIGHTMOVE_SOLD_DATA"
  )
}

export default function ProfessionalEvidenceGatewayProofPanel({
  seededSavedDealId,
  viewModel,
  rightmoveRule,
  qualifyingRule,
  investorShieldUnchangedNotice,
}: ProfessionalEvidenceGatewayProofPanelProps) {
  return (
    <section className="space-y-5 rounded border border-slate-200 bg-white p-5 text-slate-900">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Read-only dev/demo proof
        </p>
        <h2 className="text-xl font-semibold">Professional Evidence Gateway Proof</h2>
        <p className="text-sm text-slate-700">
          Seeded saved deal identifier:{" "}
          <span className="font-mono">{seededSavedDealId}</span>
        </p>
      </header>

      <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
        {investorShieldUnchangedNotice}
      </div>

      <div className="space-y-2 text-sm text-slate-700">
        <p>{rightmoveRule}</p>
        <p>{qualifyingRule}</p>
      </div>

      <div className="grid gap-3">
        {viewModel.gates.map((gate) => (
          <article
            className="rounded border border-slate-200 p-4"
            key={`${gate.professionalGateArea}-${gate.reviewSource}-${gate.linkedEvidenceCommandEvidenceId}`}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold">
                  {formatToken(gate.professionalGateArea)}
                </h3>
                <p className="text-sm text-slate-700">
                  {gate.requiredEvidenceSummary}
                </p>
              </div>
              <span className="w-fit rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700">
                {getConfirmingStatus(gate)}
              </span>
            </div>

            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-medium text-slate-500">Source</dt>
                <dd>{gate.reviewSource}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Professional status</dt>
                <dd>{formatToken(gate.professionalGateStatus)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Readiness</dt>
                <dd>{formatToken(gate.professionalReadiness)}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-500">Linked evidence</dt>
                <dd>{gate.linkedEvidenceCommandEvidenceId ?? "None"}</dd>
              </div>
            </dl>

            <p className="mt-3 text-sm text-slate-700">
              {gate.professionalConfirmationSummary}
            </p>

            {isRightmoveSoldComparable(gate) ? (
              <p className="mt-2 text-sm font-medium text-amber-800">
                RIGHTMOVE_SOLD_DATA is visible but non-confirming by itself.
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
