import { readFileSync } from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import ProfessionalEvidenceGatewaySection from "@/components/investor-review/ProfessionalEvidenceGatewaySection"
import type { ProfessionalEvidenceGatewayViewModel } from "@/types/professional-evidence-gateway"

function makeGate(
  overrides: Partial<ProfessionalEvidenceGatewayViewModel["gates"][number]> = {}
): ProfessionalEvidenceGatewayViewModel["gates"][number] {
  return {
    savedDealId: "deal-1",
    professionalGateArea: "SOLICITOR_REVIEW",
    linkedInvestorShieldGate: "TITLE",
    professionalGateStatus: "CONFIRMED",
    professionalReadiness: "PROFESSIONALLY_CONFIRMED",
    reviewSource: "SOLICITOR",
    reviewState: "PROFESSIONAL_CONFIRMED",
    blockerImpact: "DOES_NOT_BLOCK",
    evidenceStrength: "STRONG",
    requiredEvidenceSummary: "Solicitor title evidence is visible for review.",
    professionalConfirmationSummary: "Solicitor has confirmed title review evidence.",
    recommendedNextAction: "Keep solicitor title evidence visible for review.",
    expiryOrReviewDate: "2026-08-01",
    linkedEvidenceCommandEvidenceId: "evi-1",
    linkedEvidenceIds: ["evi-1"],
    ...overrides,
  }
}

function makeViewModel(
  overrides: Partial<ProfessionalEvidenceGatewayViewModel> = {}
): ProfessionalEvidenceGatewayViewModel {
  const defaultGate = makeGate()
  const gates = overrides.gates ?? [defaultGate]

  return {
    savedDealId: "deal-1",
    gates,
    sections: [],
    decisionLock: {
      savedDealId: "deal-1",
      finalDecisionLockStatus: "LOCKED",
      lockReason: "Professional evidence remains display-only.",
      linkedGateAreas: gates.map((gate) => gate.professionalGateArea),
      linkedEvidenceIds: gates.flatMap((gate) => gate.linkedEvidenceIds),
    },
    readinessPresentation: {
      state: "PROFESSIONALLY_CONFIRMED",
      displayLabel: "Professionally confirmed",
      supportingSummary: defaultGate.professionalConfirmationSummary,
      authorityNotice:
        "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
    },
    professionalGateStatus: "CONFIRMED",
    professionalReadiness: "PROFESSIONALLY_CONFIRMED",
    reviewSource: "SOLICITOR",
    requiredEvidenceSummary: defaultGate.requiredEvidenceSummary,
    professionalConfirmationSummary: defaultGate.professionalConfirmationSummary,
    recommendedNextAction: defaultGate.recommendedNextAction,
    linkedEvidenceCommandEvidenceId: defaultGate.linkedEvidenceCommandEvidenceId,
    ...overrides,
  }
}

describe("ProfessionalEvidenceGatewaySection", () => {
  it("renders production title, exact authority notice, aggregate summary, and canonical gate fields", () => {
    const html = renderToStaticMarkup(
      <ProfessionalEvidenceGatewaySection viewModel={makeViewModel()} />
    )

    expect(html).toContain("Professional Evidence Gateway")
    expect(html).toContain(
      "Read-only professional decision support. This section does not satisfy, waive, approve, or override Investor Shield requirements."
    )
    expect(html).toContain("data-testid=\"professional-gateway-aggregate-status\"")
    expect(html).toContain("data-testid=\"professional-gateway-aggregate-readiness\"")
    expect(html).toContain("data-testid=\"professional-gateway-aggregate-lock-status\"")
    expect(html).toContain("data-testid=\"professional-gateway-aggregate-lock-reason\"")
    expect(html).toContain("data-testid=\"professional-gateway-readiness-block\"")
    expect(html).toContain("Professionally confirmed")
    expect(html).toContain(
      "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements."
    )
    expect(html).toContain("Solicitor title evidence is visible for review.")
    expect(html).toContain("Solicitor has confirmed title review evidence.")
    expect(html).toContain("Keep solicitor title evidence visible for review.")
    expect(html).toContain("Confirming")
    expect(html).toContain("evi-1")
    expect(html).toContain("2026-08-01")
  })

  it("never renders proof or demo wording", () => {
    const html = renderToStaticMarkup(
      <ProfessionalEvidenceGatewaySection viewModel={makeViewModel()} />
    )

    expect(html).not.toContain("Read-only dev/demo proof")
    expect(html).not.toContain("Professional Evidence Gateway Proof")
    expect(html).not.toContain("Seeded saved deal identifier")
  })

  it("renders exact empty state copy with notice and conservative aggregate defaults", () => {
    const html = renderToStaticMarkup(
      <ProfessionalEvidenceGatewaySection
        viewModel={makeViewModel({
          gates: [],
          decisionLock: {
            savedDealId: "deal-1",
            finalDecisionLockStatus: "LOCKED",
            lockReason: "Professional evidence remains display-only.",
            linkedGateAreas: [],
            linkedEvidenceIds: [],
          },
          readinessPresentation: {
            state: "MISSING",
            displayLabel: "Professional evidence missing",
            supportingSummary: "No compatible professional evidence is currently available for review.",
            authorityNotice:
              "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
          },
          professionalGateStatus: "NOT_STARTED",
          professionalReadiness: "NOT_READY",
          reviewSource: "OPERATOR_NOTE",
          requiredEvidenceSummary: "Professional evidence review required",
          professionalConfirmationSummary:
            "Professional confirmation requires explicit compatible qualifying source",
          recommendedNextAction: "Request compatible professional source confirmation",
          linkedEvidenceCommandEvidenceId: null,
        })}
      />
    )

    expect(html).toContain("Professional Evidence Gateway")
    expect(html).toContain(
      "Read-only professional decision support. This section does not satisfy, waive, approve, or override Investor Shield requirements."
    )
    expect(html).toContain("Professional evidence missing")
    expect(html).toContain("No compatible professional evidence is currently available for review.")
    expect(html).toContain("NOT STARTED")
    expect(html).toContain("NOT READY")
    expect(html).toContain("LOCKED")
  })

  it("marks weak evidence as visible and non-confirming", () => {
    const html = renderToStaticMarkup(
      <ProfessionalEvidenceGatewaySection
        viewModel={makeViewModel({
          gates: [
            makeGate({
              professionalGateStatus: "RECEIVED",
              professionalReadiness: "READY_FOR_REVIEW",
              evidenceStrength: "WEAK",
            }),
          ],
          readinessPresentation: {
            state: "WEAK_OR_NON_CONFIRMING",
            displayLabel: "Weak or non-confirming evidence",
            supportingSummary:
              "Professional confirmation requires explicit compatible qualifying source",
            authorityNotice:
              "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
          },
          professionalGateStatus: "RECEIVED",
          professionalReadiness: "READY_FOR_REVIEW",
        })}
      />
    )

    expect(html).toContain("Visible / non-confirming")
    expect(html).toContain("Weak or non-confirming evidence")
    expect(html).toContain("WEAK")
    expect(html).not.toContain(">Confirming<")
  })

  it("keeps adverse and expired evidence off success tones", () => {
    const html = renderToStaticMarkup(
      <ProfessionalEvidenceGatewaySection
        viewModel={makeViewModel({
          gates: [
            makeGate({
              professionalGateArea: "SURVEYOR_REPORT",
              professionalGateStatus: "ADVERSE",
              professionalReadiness: "BLOCKED",
              reviewSource: "SURVEYOR",
              linkedEvidenceCommandEvidenceId: "evi-adverse",
            }),
            makeGate({
              professionalGateArea: "BROKER_LENDER_CONFIRMATION",
              professionalGateStatus: "EXPIRED",
              professionalReadiness: "PARTIALLY_READY",
              reviewSource: "BROKER",
              linkedEvidenceCommandEvidenceId: "evi-expired",
            }),
          ],
          readinessPresentation: {
            state: "ADVERSE",
            displayLabel: "Adverse professional finding",
            supportingSummary: "Review professional evidence",
            authorityNotice:
              "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
          },
          professionalGateStatus: "ADVERSE",
          professionalReadiness: "BLOCKED",
        })}
      />
    )

    expect(html).toContain("evi-adverse")
    expect(html).toContain("evi-expired")
    expect(html).toContain("Adverse professional finding")
    expect(html).toContain("Visible / non-confirming")
    expect(html).toContain("border-red-200 bg-red-50 text-red-900")
    expect(html).toContain("border-amber-200 bg-amber-50 text-amber-900")
    expect(html).not.toContain(">Confirming<")
  })

  it("shows manual review as non-success and exposes no mutation, pdf, or download controls", () => {
    const html = renderToStaticMarkup(
      <ProfessionalEvidenceGatewaySection
        viewModel={makeViewModel({
          decisionLock: {
            savedDealId: "deal-1",
            finalDecisionLockStatus: "MANUAL_REVIEW_REQUIRED",
            lockReason: "Manual review remains required before progression.",
            linkedGateAreas: ["SOLICITOR_REVIEW"],
            linkedEvidenceIds: ["evi-1"],
          },
          readinessPresentation: {
            state: "MANUAL_REVIEW_REQUIRED",
            displayLabel: "Manual professional review required",
            supportingSummary: "Manual review remains required before progression.",
            authorityNotice:
              "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements.",
          },
        })}
      />
    )

    expect(html).toContain("MANUAL REVIEW REQUIRED")
    expect(html).toContain("Manual professional review required")
    expect(html).toContain(
      "data-testid=\"professional-gateway-aggregate-lock-status\" class=\"rounded-xl border px-4 py-3 border-amber-200 bg-amber-50 text-amber-900\""
    )
    expect(html).not.toContain("<button")
    expect(html).not.toContain("<form")
    expect(html).not.toContain("Download")
    expect(html).not.toContain("Print")
    expect(html).not.toContain("Approve")
  })

  it("does not import or call classifier logic in UI component", () => {
    const source = readFileSync(
      path.resolve(
        process.cwd(),
        "components/investor-review/ProfessionalEvidenceGatewaySection.tsx"
      ),
      "utf8"
    )

    expect(source).not.toContain("classifyProfessionalReadiness")
    expect(source).not.toContain(
      'from "@/lib/professional-evidence-gateway/classify-professional-readiness"'
    )
  })
})
