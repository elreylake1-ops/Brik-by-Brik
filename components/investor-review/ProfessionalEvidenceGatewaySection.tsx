import {
  INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
  type InvestorReviewSemanticTone,
} from "@/lib/investor-review/investor-review-view-model"
import { formatLabel } from "@/lib/formatters"
import type {
  FinalDecisionLockStatus,
  ProfessionalEvidenceGatewayGate,
  ProfessionalEvidenceGatewayViewModel,
  ProfessionalGateStatus,
  ProfessionalReadiness,
  ProfessionalReadinessPresentationState,
} from "@/types/professional-evidence-gateway"

export type ProfessionalEvidenceGatewaySectionProps = {
  viewModel: ProfessionalEvidenceGatewayViewModel
}

const AUTHORITY_NOTICE =
  "Read-only professional decision support. This section does not satisfy, waive, approve, or override Investor Shield requirements."

const EMPTY_STATE_MESSAGE =
  "No compatible professional evidence is currently available for review."

function readinessPresentationTone(
  state: ProfessionalReadinessPresentationState
): InvestorReviewSemanticTone {
  switch (state) {
    case "PROFESSIONALLY_CONFIRMED":
      return "success"
    case "READY_FOR_REVIEW":
      return "informational"
    case "ADVERSE":
    case "EXPIRED":
      return "blocked"
    case "WEAK_OR_NON_CONFIRMING":
    case "MISSING":
    case "MANUAL_REVIEW_REQUIRED":
      return "caution"
    default:
      return "neutral"
  }
}

function toneClasses(tone: InvestorReviewSemanticTone | undefined): string {
  switch (tone) {
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-900"
    case "blocked":
      return "border-red-200 bg-red-50 text-red-900"
    case "caution":
      return "border-amber-200 bg-amber-50 text-amber-900"
    case "informational":
      return "border-sky-200 bg-sky-50 text-sky-900"
    default:
      return "border-gray-200 bg-gray-50 text-gray-900"
  }
}

function displayValue(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
}

function displayToken(value: string | null | undefined): string {
  const text = displayValue(value)
  return text === INVESTOR_REVIEW_NOT_AVAILABLE_LABEL ? text : formatLabel(text)
}

function aggregateStatusTone(status: ProfessionalGateStatus): InvestorReviewSemanticTone {
  switch (status) {
    case "CONFIRMED":
      return "success"
    case "ADVERSE":
      return "blocked"
    case "EXPIRED":
      return "caution"
    case "RECEIVED":
    case "UNDER_REVIEW":
      return "informational"
    case "REQUESTED":
      return "caution"
    default:
      return "neutral"
  }
}

function readinessTone(readiness: ProfessionalReadiness): InvestorReviewSemanticTone {
  switch (readiness) {
    case "PROFESSIONALLY_CONFIRMED":
      return "success"
    case "BLOCKED":
      return "blocked"
    case "READY_FOR_REVIEW":
      return "informational"
    case "PARTIALLY_READY":
      return "caution"
    default:
      return "neutral"
  }
}

function lockTone(status: FinalDecisionLockStatus): InvestorReviewSemanticTone {
  switch (status) {
    case "BLOCKED_BY_HARD_GATE":
    case "BLOCKED_BY_PROFESSIONAL_EVIDENCE":
      return "blocked"
    case "MANUAL_REVIEW_REQUIRED":
      return "caution"
    case "UNLOCKED_FOR_REVIEW":
      return "informational"
    default:
      return "neutral"
  }
}

function gateTone(gate: ProfessionalEvidenceGatewayGate): InvestorReviewSemanticTone {
  if (
    gate.professionalGateStatus === "CONFIRMED" &&
    gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
  ) {
    return "success"
  }

  if (gate.professionalGateStatus === "ADVERSE" || gate.professionalReadiness === "BLOCKED") {
    return "blocked"
  }

  if (gate.professionalGateStatus === "EXPIRED" || gate.evidenceStrength === "WEAK") {
    return "caution"
  }

  if (
    gate.professionalReadiness === "READY_FOR_REVIEW" ||
    gate.professionalGateStatus === "UNDER_REVIEW" ||
    gate.professionalGateStatus === "RECEIVED"
  ) {
    return "informational"
  }

  return "neutral"
}

function confirmationClassification(gate: ProfessionalEvidenceGatewayGate): {
  label: string
  tone: InvestorReviewSemanticTone
} {
  if (
    gate.professionalGateStatus === "CONFIRMED" &&
    gate.professionalReadiness === "PROFESSIONALLY_CONFIRMED"
  ) {
    return { label: "Confirming", tone: "success" }
  }

  return { label: "Visible / non-confirming", tone: "caution" }
}

function SummaryCard({
  label,
  value,
  tone,
  testId,
}: {
  label: string
  value: string
  tone?: InvestorReviewSemanticTone
  testId?: string
}) {
  return (
    <div data-testid={testId} className={`rounded-xl border px-4 py-3 ${toneClasses(tone)}`}>
      <p className="text-xs uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}

function GateField({
  label,
  value,
  tone,
  testId,
}: {
  label: string
  value: string
  tone?: InvestorReviewSemanticTone
  testId?: string
}) {
  return (
    <div data-testid={testId}>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-1 inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-medium ${toneClasses(tone)}`}>
        <span className="break-words">{value}</span>
      </dd>
    </div>
  )
}

export default function ProfessionalEvidenceGatewaySection({
  viewModel,
}: ProfessionalEvidenceGatewaySectionProps) {
  return (
    <section
      aria-labelledby="professional-evidence-gateway"
      className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="flex flex-col gap-4">
        <div>
          <h2 id="professional-evidence-gateway" className="text-lg font-semibold text-gray-950">
            Professional Evidence Gateway
          </h2>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p>{AUTHORITY_NOTICE}</p>
        </div>

        <div
          data-testid="professional-gateway-readiness-block"
          className={`rounded-2xl border p-4 ${toneClasses(
            readinessPresentationTone(viewModel.readinessPresentation.state)
          )}`}
        >
          <p className="text-xs uppercase tracking-wide opacity-80">Professional Readiness</p>
          <p
            data-testid="professional-gateway-readiness-label"
            className="mt-1 text-sm font-semibold"
          >
            {viewModel.readinessPresentation.displayLabel}
          </p>
          <p
            data-testid="professional-gateway-readiness-summary"
            className="mt-2 break-words text-sm"
          >
            {displayValue(viewModel.readinessPresentation.supportingSummary)}
          </p>
          <p
            data-testid="professional-gateway-readiness-authority"
            className="mt-3 break-words text-sm"
          >
            {viewModel.readinessPresentation.authorityNotice}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            testId="professional-gateway-aggregate-status"
            label="Professional gate status"
            value={displayToken(viewModel.professionalGateStatus)}
            tone={aggregateStatusTone(viewModel.professionalGateStatus)}
          />
          <SummaryCard
            testId="professional-gateway-aggregate-readiness"
            label="Professional readiness"
            value={displayToken(viewModel.professionalReadiness)}
            tone={readinessTone(viewModel.professionalReadiness)}
          />
          <SummaryCard
            testId="professional-gateway-aggregate-lock-status"
            label="Final decision-lock status"
            value={displayToken(viewModel.decisionLock.finalDecisionLockStatus)}
            tone={lockTone(viewModel.decisionLock.finalDecisionLockStatus)}
          />
          <SummaryCard
            testId="professional-gateway-aggregate-lock-reason"
            label="Lock reason"
            value={displayValue(viewModel.decisionLock.lockReason)}
            tone={lockTone(viewModel.decisionLock.finalDecisionLockStatus)}
          />
        </div>

        {viewModel.gates.length === 0 ? (
          <p
            data-testid="professional-gateway-empty-state"
            className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700"
          >
            {EMPTY_STATE_MESSAGE}
          </p>
        ) : (
          <ul className="space-y-4">
            {viewModel.gates.map((gate) => {
              const confirmation = confirmationClassification(gate)
              const linkedEvidenceId =
                gate.linkedEvidenceCommandEvidenceId ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
              const expiryOrReviewDate =
                gate.expiryOrReviewDate ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL

              return (
                <li
                  key={`${gate.professionalGateArea}-${gate.reviewSource}-${gate.linkedEvidenceCommandEvidenceId ?? "none"}`}
                  data-testid={`professional-gateway-gate-${gate.professionalGateArea}`}
                  className={`rounded-2xl border p-4 shadow-sm ${toneClasses(gateTone(gate))}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold text-gray-950">
                        {displayToken(gate.professionalGateArea)}
                      </h3>
                      <p className="mt-2 break-words text-sm text-gray-700">
                        {displayValue(gate.requiredEvidenceSummary)}
                      </p>
                    </div>
                    <div
                      data-testid={`professional-gateway-gate-${gate.professionalGateArea}-classification`}
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${toneClasses(confirmation.tone)}`}
                    >
                      {confirmation.label}
                    </div>
                  </div>

                  <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    <GateField
                      testId={`professional-gateway-gate-${gate.professionalGateArea}-source`}
                      label="Review source"
                      value={displayToken(gate.reviewSource)}
                    />
                    <GateField
                      testId={`professional-gateway-gate-${gate.professionalGateArea}-status`}
                      label="Professional gate status"
                      value={displayToken(gate.professionalGateStatus)}
                      tone={aggregateStatusTone(gate.professionalGateStatus)}
                    />
                    <GateField
                      testId={`professional-gateway-gate-${gate.professionalGateArea}-readiness`}
                      label="Professional readiness"
                      value={displayToken(gate.professionalReadiness)}
                      tone={readinessTone(gate.professionalReadiness)}
                    />
                    <GateField
                      testId={`professional-gateway-gate-${gate.professionalGateArea}-evidence-id`}
                      label="Linked Evidence Command evidence ID"
                      value={linkedEvidenceId}
                    />
                    <GateField
                      testId={`professional-gateway-gate-${gate.professionalGateArea}-expiry`}
                      label="Expiry or review date"
                      value={displayValue(expiryOrReviewDate)}
                      tone={
                        gate.professionalGateStatus === "EXPIRED" ? "caution" : undefined
                      }
                    />
                    <GateField
                      testId={`professional-gateway-gate-${gate.professionalGateArea}-evidence-strength`}
                      label="Evidence strength"
                      value={displayToken(gate.evidenceStrength)}
                      tone={gate.evidenceStrength === "WEAK" ? "caution" : undefined}
                    />
                  </dl>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Professional confirmation summary
                      </p>
                      <p className="mt-2 break-words text-sm text-gray-700">
                        {displayValue(gate.professionalConfirmationSummary)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-wide text-gray-500">
                        Recommended next action
                      </p>
                      <p className="mt-2 break-words text-sm text-gray-700">
                        {displayValue(gate.recommendedNextAction)}
                      </p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
