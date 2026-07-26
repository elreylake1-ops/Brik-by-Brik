import { formatCurrency, formatLabel, formatPercent, formatProfit } from "@/lib/formatters"
import {
  INVESTOR_REVIEW_CONFIDENTIALITY_LABEL,
  INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL,
  INVESTOR_REVIEW_EMPTY_OFFERS_LABEL,
  INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
  type InvestorReviewAdvisoryItem,
  type InvestorReviewEvidenceLiteRow,
  type InvestorReviewField,
  type InvestorReviewGateRow,
  type InvestorReviewReadyViewModel,
  type InvestorReviewSemanticTone,
} from "@/lib/investor-review/investor-review-view-model"
import type { DealFormulationMonetaryValue } from "@/types/deal-formulation"
import type {
  InvestorDealSummaryAdvisoryItem,
  InvestorDealSummaryEvidenceLiteRow,
  InvestorDealSummaryField,
  InvestorDealSummaryGateRow,
  InvestorDealSummarySemanticTone,
  InvestorDealSummaryUnsupportedValue,
  InvestorDealSummaryViewModel,
} from "@/types/investor-deal-summary"
import type { ProfessionalReadinessPresentationState } from "@/types/professional-evidence-gateway"

const HEADER_TITLE = "Brik by Brik Investor and Deal Summary"
const PURPOSE_TEXT = "Confidential controlled review material for investor decision support."
const NON_RELIANCE_NOTICE =
  "This summary is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence."
const TRUE_MAO_NOTICE =
  "No single investor-facing True MAO band has been selected in the current canonical model."
const OFFER_LADDER_NOTICE = "No canonical monetary offer ladder currently exists."
const ACQUISITION_COST_REASON = "No canonical acquisition-cost aggregate currently exists."
const ROI_REASON = "ROI is not available from the current canonical engine output."
const SHIELD_AUTHORITY_NOTICE =
  "Investor Shield progression authority remains separate from Deal Formulation financial presentation."
const PROFESSIONAL_READINESS_NOTICE =
  "Professional readiness is read-only decision support. It does not satisfy, waive, approve, clear, or override Investor Shield requirements."
const EVIDENCE_LITE_NOTICE =
  "Evidence Lite records are informational and do not constitute professional confirmation."
const CURRENT_STATE_NOTICE =
  "This page reflects current canonical application output and is not a historical snapshot."

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function toneClassesValue(tone: InvestorReviewSemanticTone | undefined): InvestorDealSummarySemanticTone {
  return tone ?? "neutral"
}

function displayValue(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
}

function displayToken(value: string | null | undefined): string {
  const resolved = displayValue(value)
  if (resolved === INVESTOR_REVIEW_NOT_AVAILABLE_LABEL || !resolved.includes("_")) {
    return resolved
  }

  return formatLabel(resolved.toLowerCase())
}

function moneyValue(value: DealFormulationMonetaryValue): string {
  return value.amount === null ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL : formatCurrency(value.amount)
}

function moneySupport(value: DealFormulationMonetaryValue): string | null {
  return value.amount === null ? value.unavailableReason : null
}

function verdictTone(value: string | null): InvestorDealSummarySemanticTone {
  const normalized = value?.trim().toUpperCase() ?? ""

  if (normalized === "GO") {
    return "success"
  }
  if (normalized === "CONDITIONAL") {
    return "caution"
  }
  if (normalized === "NO-GO") {
    return "blocked"
  }

  return "neutral"
}

function capitalProtectionTone(value: string | null): InvestorDealSummarySemanticTone {
  const normalized = value?.trim().toUpperCase() ?? ""

  if (normalized === "SAFE" || normalized === "PROTECTED") {
    return "success"
  }
  if (normalized === "CAUTION") {
    return "caution"
  }
  if (normalized === "HIGH_RISK" || normalized === "NO_DEAL") {
    return "blocked"
  }

  return "neutral"
}

function projectedProfitTone(value: DealFormulationMonetaryValue): InvestorDealSummarySemanticTone {
  if (value.amount === null) {
    return "neutral"
  }

  return value.amount < 0 ? "blocked" : "neutral"
}

function profitMarginTone(value: number | null): InvestorDealSummarySemanticTone {
  if (value === null) {
    return "neutral"
  }

  return value < 0 ? "blocked" : "neutral"
}

function readinessTone(
  state: ProfessionalReadinessPresentationState
): InvestorDealSummarySemanticTone {
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

function moneyField(
  label: string,
  value: DealFormulationMonetaryValue,
  tone?: InvestorDealSummarySemanticTone
): InvestorDealSummaryField {
  return {
    label,
    value: moneyValue(value),
    supportingText: moneySupport(value),
    tone,
  }
}

function mappedReviewField(field: InvestorReviewField): InvestorDealSummaryField {
  return {
    label: field.label,
    value: field.value,
    tone: toneClassesValue(field.tone),
  }
}

function mapGateRow(row: InvestorReviewGateRow): InvestorDealSummaryGateRow {
  return {
    gateKey: row.gateKey,
    label: row.label,
    status: row.status,
    statusTone: row.statusTone,
    blockerState: row.blockerState,
    blockerTone: row.blockerTone,
    missingEvidenceState: row.missingEvidenceState,
    missingEvidenceTone: row.missingEvidenceTone,
    evidenceReferenceCount: row.evidenceReferenceCount,
    latestReferenceUpdate: row.latestReferenceUpdate,
    helperText: row.helperText,
  }
}

function mapAdvisoryItem(item: InvestorReviewAdvisoryItem): InvestorDealSummaryAdvisoryItem {
  return {
    id: item.id,
    label: item.label,
    message: item.message,
    tone: item.tone,
    sourceLabel: item.sourceLabel,
  }
}

function mapEvidenceLiteRow(row: InvestorReviewEvidenceLiteRow): InvestorDealSummaryEvidenceLiteRow {
  return {
    evidenceId: row.evidenceId,
    evidenceType: row.evidenceType,
    linkedGate: row.linkedGate,
    status: row.status,
    statusTone: row.statusTone,
    reviewedState: row.reviewedLabel,
    reviewedTone: row.reviewedTone,
    note: row.evidenceSummary ?? row.note ?? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
    reviewerNote: row.reviewerNote,
    relevantTimestamp: row.relevantTimestamp,
  }
}

function unsupportedValue(label: string, reason: string): InvestorDealSummaryUnsupportedValue {
  return {
    label,
    value: INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
    reason,
  }
}

export function mapInvestorReviewToDealSummary(input: {
  review: InvestorReviewReadyViewModel
  generatedAt: string
}): InvestorDealSummaryViewModel {
  const { review, generatedAt } = input

  return {
    header: {
      title: HEADER_TITLE,
      confidentialityLabel: INVESTOR_REVIEW_CONFIDENTIALITY_LABEL,
      generatedAt,
      dealId: review.header.dealId,
      propertyIdentity: review.overview.propertyIdentity.value,
      purposeText: PURPOSE_TEXT,
      nonRelianceNotice: NON_RELIANCE_NOTICE,
    },
    executiveDecisionSnapshot: [
      {
        label: "Verdict",
        value: displayToken(review.dealFormulation.decision.verdictStatus),
        tone: verdictTone(review.dealFormulation.decision.verdictStatus),
      },
      {
        label: "Persisted classification",
        value: displayToken(review.dealFormulation.decision.classification),
      },
      mappedReviewField(review.overview.governance),
      {
        label: "Capital protection",
        value: displayToken(review.dealFormulation.decision.capitalProtectionState),
        tone: capitalProtectionTone(review.dealFormulation.decision.capitalProtectionState),
      },
      mappedReviewField(review.overview.pipeline),
      {
        label: "Investor Shield progression",
        value: review.decisionSummary.progressionDecision.value,
        tone: toneClassesValue(review.decisionSummary.progressionDecision.tone),
      },
      {
        label: "Professional readiness",
        value: review.professionalEvidenceGateway.readinessPresentation.displayLabel,
        tone: readinessTone(review.professionalEvidenceGateway.readinessPresentation.state),
      },
    ],
    coreFinancialPosition: [
      moneyField("Purchase price", review.dealFormulation.financialSummary.purchasePrice),
      moneyField("Realistic GDV", review.dealFormulation.financialSummary.gdvRealistic),
      moneyField("Downside GDV", review.dealFormulation.financialSummary.gdvDownside),
      moneyField("Strong GDV", review.dealFormulation.financialSummary.gdvStrong),
      moneyField(
        "Refurbishment cost",
        review.dealFormulation.financialSummary.refurbishmentCost
      ),
      moneyField("Stamp duty", review.dealFormulation.financialSummary.stampDuty),
      moneyField("Legal costs", review.dealFormulation.financialSummary.legalCosts),
      moneyField("Sale costs", review.dealFormulation.financialSummary.saleCosts),
      moneyField("Finance cost", review.dealFormulation.financialSummary.financeCost),
      moneyField("Total investment", review.dealFormulation.financialSummary.totalInvestment),
      {
        label: "Projected profit",
        value:
          review.dealFormulation.financialSummary.projectedProfit.amount === null
            ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
            : formatProfit(review.dealFormulation.financialSummary.projectedProfit.amount),
        supportingText: moneySupport(review.dealFormulation.financialSummary.projectedProfit),
        tone: projectedProfitTone(review.dealFormulation.financialSummary.projectedProfit),
      },
      {
        label: "Profit margin",
        value:
          review.dealFormulation.financialSummary.profitMargin === null
            ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
            : formatPercent(review.dealFormulation.financialSummary.profitMargin),
        supportingText:
          review.dealFormulation.financialSummary.profitMargin === null
            ? "Not available"
            : null,
        tone: profitMarginTone(review.dealFormulation.financialSummary.profitMargin),
      },
    ],
    trueMao: {
      bands: [
        moneyField("25% profit target", review.dealFormulation.trueMao.twentyFivePercent),
        moneyField("20% profit target", review.dealFormulation.trueMao.twentyPercent),
        moneyField("15% profit target", review.dealFormulation.trueMao.fifteenPercent),
      ],
      note: TRUE_MAO_NOTICE,
    },
    offerPosition: {
      latestRecordedOfferAmount: {
        label: "Latest recorded offer amount",
        value:
          review.dealFormulation.offerPosition.latestRecordedOffer === null
            ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
            : formatCurrency(review.dealFormulation.offerPosition.latestRecordedOffer),
      },
      latestRecordedOfferStatus: {
        label: "Latest recorded offer status",
        value: displayToken(review.dealFormulation.offerPosition.latestOfferStatus),
      },
      unsupportedOfferValues: [
        {
          label: "Opening offer",
          value: INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
        },
        {
          label: "Target offer",
          value: INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
        },
        {
          label: "Final offer",
          value: INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
        },
        {
          label: "Walk-away amount",
          value: INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
        },
        {
          label: "Walk-away threshold",
          value: INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
        },
      ],
      noOfferMessage: INVESTOR_REVIEW_EMPTY_OFFERS_LABEL,
      offerLadderNotice: OFFER_LADDER_NOTICE,
    },
    unsupportedValues: [
      unsupportedValue("Acquisition-cost aggregate", ACQUISITION_COST_REASON),
      unsupportedValue("ROI", ROI_REASON),
    ],
    investorShield: {
      summaryFields: [
        {
          label: "Overall status",
          value: review.decisionSummary.overallStatus.value,
          tone: toneClassesValue(review.decisionSummary.overallStatus.tone),
        },
        {
          label: "Progression",
          value: review.decisionSummary.progressionDecision.value,
          tone: toneClassesValue(review.decisionSummary.progressionDecision.tone),
        },
        {
          label: "Can progress",
          value: review.decisionSummary.canProgress.value,
          tone: toneClassesValue(review.decisionSummary.canProgress.tone),
        },
        {
          label: "Blocking-gate count",
          value: review.decisionSummary.blockedGateCount.value,
          tone: toneClassesValue(review.decisionSummary.blockedGateCount.tone),
        },
        {
          label: "Caution-gate count",
          value: String(review.advisoryItems.length),
          tone: review.advisoryItems.length > 0 ? "caution" : "neutral",
        },
        {
          label: "Missing-evidence count",
          value: review.decisionSummary.missingEvidenceCount.value,
          tone: toneClassesValue(review.decisionSummary.missingEvidenceCount.tone),
        },
      ],
      authorityNotice: SHIELD_AUTHORITY_NOTICE,
      requiredHardGates: review.requiredGateRows.map(mapGateRow),
      advisoryGates: review.advisoryItems.map(mapAdvisoryItem),
    },
    professionalReadiness: {
      displayLabel: review.professionalEvidenceGateway.readinessPresentation.displayLabel,
      supportingSummary: displayValue(
        review.professionalEvidenceGateway.readinessPresentation.supportingSummary
      ),
      authorityNotice: PROFESSIONAL_READINESS_NOTICE,
      tone: readinessTone(review.professionalEvidenceGateway.readinessPresentation.state),
    },
    evidenceLite: {
      notice: EVIDENCE_LITE_NOTICE,
      emptyText: INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL,
      rows: review.evidenceLiteRows.map(mapEvidenceLiteRow),
    },
    risks: {
      warnings: unique([...review.dealFormulation.warnings.canonicalWarnings]),
      blockers: unique(review.blockerRows.map((row) => `${row.label}: ${row.blockerReason}`)),
      missingEvidence: unique([...review.followUpRequirements]),
      unavailableFields: unique([...review.dealFormulation.warnings.unavailableFields]),
    },
    recommendedNextAction: {
      label: "Recommended next action",
      value: displayValue(review.dealFormulation.decision.recommendedNextAction),
    },
    footer: {
      confidentialityLabel: INVESTOR_REVIEW_CONFIDENTIALITY_LABEL,
      generatedAt,
      dealId: review.header.dealId,
      nonRelianceNotice: NON_RELIANCE_NOTICE,
      currentStateNotice: CURRENT_STATE_NOTICE,
      notices: [
        "Investor Shield remains authoritative for application progression.",
        "Missing evidence must not be interpreted as completed verification.",
        "Unsupported values remain unavailable and are not estimated.",
      ],
    },
  }
}
