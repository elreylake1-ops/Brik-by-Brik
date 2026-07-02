import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import {
  INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL,
  INVESTOR_REVIEW_EMPTY_OFFERS_LABEL,
  INVESTOR_REVIEW_EMPTY_TASKS_LABEL,
  INVESTOR_REVIEW_EVIDENCE_LITE_NOTICE,
  INVESTOR_REVIEW_EVIDENCE_NOT_SUFFICIENT_NOTICE,
  INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
  type InvestorReviewAdvisoryItem,
  type InvestorReviewBlockerRow,
  type InvestorReviewEvidenceLiteRow,
  type InvestorReviewGateRow,
  type InvestorReviewOfferSummary,
  type InvestorReviewSemanticTone,
  type InvestorReviewTaskRow,
  type InvestorReviewViewModel,
} from "@/lib/investor-review/investor-review-view-model"
import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import { formatCurrency, formatLabel } from "@/lib/formatters"
import type { SavedDealRecord } from "@/lib/operator-command/saved-deals-repository"

export type MapPdfEvidencePackToInvestorReviewInput = {
  pack: PdfEvidencePack
  savedDeal: SavedDealRecord
}

function text(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
}

function money(value: number | null): string {
  return value === null ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL : formatCurrency(value)
}

function count(value: number | null): string {
  return value === null ? INVESTOR_REVIEW_NOT_AVAILABLE_LABEL : String(value)
}

function formatTimestamp(value: string | null | undefined): string {
  if (typeof value !== "string") {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`
}

function labelFor(value: string): string {
  return formatLabel(value)
}

function gateLabelFor(value: string): string {
  if (value === "SOLICITOR_FEEDBACK" || value === "SOLICITOR_REVIEW") {
    return "Solicitor Review"
  }

  return (
    INVESTOR_SHIELD_DEFAULT_GATES.find((gate) => gate.key === value)?.label ??
    labelFor(value)
  )
}

function displayGateKey(gateKey: string): string {
  return gateKey === "SOLICITOR_FEEDBACK" || gateKey === "SOLICITOR_REVIEW"
    ? "Solicitor Review"
    : gateKey
}

function evidenceTypeLabelFor(value: string): string {
  if (value === "SOLICITOR_REVIEW" || value === "SOLICITOR_FEEDBACK") {
    return "Solicitor Review"
  }

  return labelFor(value)
}

function displayActionText(actionText: string): string {
  return actionText === "Review solicitor feedback" ? "Complete Solicitor Review" : actionText
}

function displayDecisionValue(value: string): string {
  if (!value.includes("_")) {
    return value
  }

  return value
    .split("_")
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(" ")
}

function overallStatusTone(status: string | null | undefined): InvestorReviewSemanticTone {
  const normalized = status?.trim().toUpperCase() ?? ""
  if (normalized === "CLEAR") {
    return "success"
  }
  if (normalized === "CAUTION" || normalized === "NEEDS_REVIEW") {
    return "caution"
  }
  return "blocked"
}

function progressionDecisionTone(decision: string | null | undefined): InvestorReviewSemanticTone {
  const normalized = decision?.trim().toUpperCase() ?? ""
  if (normalized === "CAN_PROGRESS") {
    return "success"
  }
  if (normalized === "CAUTION" || normalized === "NEEDS_REVIEW") {
    return "caution"
  }
  return "blocked"
}

function gateStatusFromArrays(input: {
  gateKey: string
  blockingGateKeys: readonly string[]
  cautionGateKeys: readonly string[]
  missingEvidenceGateKeys: readonly string[]
}): { label: string; tone: InvestorReviewSemanticTone } {
  if (input.blockingGateKeys.includes(input.gateKey)) {
    return { label: "Blocked", tone: "blocked" }
  }
  if (input.cautionGateKeys.includes(input.gateKey)) {
    return { label: "Caution", tone: "caution" }
  }
  if (input.missingEvidenceGateKeys.includes(input.gateKey)) {
    return { label: "Missing evidence", tone: "caution" }
  }
  return { label: "No active blocker recorded", tone: "neutral" }
}

function blockerState(
  gateKey: string,
  blockingGateKeys: readonly string[]
): { label: string; tone: InvestorReviewSemanticTone } {
  return blockingGateKeys.includes(gateKey)
    ? { label: "Blocking", tone: "blocked" }
    : { label: "No active blocker recorded", tone: "neutral" }
}

function missingEvidenceState(
  gateKey: string,
  missingEvidenceGateKeys: readonly string[]
): { label: string; tone: InvestorReviewSemanticTone } {
  return missingEvidenceGateKeys.includes(gateKey)
    ? { label: "Missing evidence recorded", tone: "caution" }
    : { label: "No missing evidence recorded", tone: "neutral" }
}

function referenceCountForGate(pack: PdfEvidencePack, gateKey: string): string {
  const countValue = pack.evidenceIndex.filter((item) =>
    item.relatedGateIds.some((relatedGateId) => relatedGateId === gateKey)
  ).length
  return String(countValue)
}

function latestReferenceUpdateForGate(pack: PdfEvidencePack, gateKey: string): string {
  const timestamps = pack.evidenceIndex
    .filter((item) => item.relatedGateIds.some((relatedGateId) => relatedGateId === gateKey))
    .flatMap((item) => [item.reviewedAt, item.capturedAt])
    .filter((value): value is string => typeof value === "string")
    .sort()

  const latest = timestamps.at(-1)
  return latest ? formatTimestamp(latest) : INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
}

function mapRequiredGateRows(pack: PdfEvidencePack): readonly InvestorReviewGateRow[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.filter((gate) => gate.required).map((gate) => {
    const status = gateStatusFromArrays({
      gateKey: gate.key,
      blockingGateKeys: pack.investorShield.blockingGateKeys,
      cautionGateKeys: pack.investorShield.cautionGateKeys,
      missingEvidenceGateKeys: pack.investorShield.missingEvidenceGateKeys,
    })
    const blocker = blockerState(gate.key, pack.investorShield.blockingGateKeys)
    const missingEvidence = missingEvidenceState(
      gate.key,
      pack.investorShield.missingEvidenceGateKeys
    )

    return {
      gateKey: displayGateKey(gate.key),
      label: gate.label,
      status: status.label,
      statusTone: status.tone,
      blockerState: blocker.label,
      blockerTone: blocker.tone,
      missingEvidenceState: missingEvidence.label,
      missingEvidenceTone: missingEvidence.tone,
      evidenceReferenceCount: referenceCountForGate(pack, gate.key),
      latestReferenceUpdate: latestReferenceUpdateForGate(pack, gate.key),
      helperText: gate.description,
    }
  })
}

function mapAdvisoryItems(pack: PdfEvidencePack): readonly InvestorReviewAdvisoryItem[] {
  const cautionItems = pack.investorShield.cautionGateKeys.map((gateKey) => {
    const defaultGate = INVESTOR_SHIELD_DEFAULT_GATES.find((gate) => gate.key === gateKey)

    return {
      id: `caution-${gateKey}`,
      label: defaultGate?.label ?? labelFor(gateKey),
      message: defaultGate?.description ?? "Cautionary gate context recorded.",
      tone: "caution" as const,
      sourceLabel: "Caution gate",
    }
  })

  const advisoryWarningItems = pack.investorShield.advisoryOnlyEvidenceWarnings.map((warning, index) => ({
    id: `advisory-warning-${index + 1}`,
    label: "Advisory warning",
    message: warning,
    tone: "informational" as const,
    sourceLabel: "Canonical advisory warning",
  }))

  return [...cautionItems, ...advisoryWarningItems]
}

function mapEvidenceLiteRows(pack: PdfEvidencePack): readonly InvestorReviewEvidenceLiteRow[] {
  return pack.evidenceIndex.map((item) => {
    const statusTone =
      item.reviewStatus === "VERIFIED"
        ? "success"
        : item.reviewStatus === "REVIEWED" || item.reviewStatus === "RECORDED"
          ? "informational"
          : item.reviewStatus === "MISSING"
            ? "caution"
            : "blocked"

    const reviewed = item.reviewedAt !== null

    return {
      evidenceId: item.evidenceId,
      title: item.title,
      evidenceType: evidenceTypeLabelFor(item.evidenceType),
      linkedGate:
        item.relatedGateIds.length > 0
          ? item.relatedGateIds.map(gateLabelFor).join(", ")
          : INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
      status: item.reviewStatus,
      statusTone,
      reviewedLabel: reviewed ? "Reviewed" : "Not reviewed",
      reviewedTone: reviewed ? "informational" : "caution",
      note: item.description,
      reviewerNote: null,
      referenceLabel: item.controlledReferenceLabel,
      relevantTimestamp: formatTimestamp(item.reviewedAt ?? item.capturedAt),
      clarificationNote:
        item.reviewStatus === "MISSING" && !reviewed
          ? INVESTOR_REVIEW_EVIDENCE_NOT_SUFFICIENT_NOTICE
          : null,
    }
  })
}

function mapBlockerRows(pack: PdfEvidencePack): readonly InvestorReviewBlockerRow[] {
  return pack.investorSummary.investorShield.blockedGates.map((gate) => ({
    gateKey: displayGateKey(gate.gateKey),
    label: gate.label ?? labelFor(gate.gateKey),
    blockerReason: text(gate.blockerReason),
  }))
}

function mapFollowUpRequirements(pack: PdfEvidencePack): readonly string[] {
  const fromTasks = pack.investorShield.taskRecommendations.map((item) => displayActionText(item.title))
  const fromAction =
    pack.investorSummary.recommendedNextAction.actionText === null
      ? []
      : [displayActionText(pack.investorSummary.recommendedNextAction.actionText)]

  return [...new Set([...fromTasks, ...fromAction])]
}

function mapTasks(pack: PdfEvidencePack): readonly InvestorReviewTaskRow[] {
  return pack.investorSummary.activeTasks.map((task) => ({
    taskId: task.taskId,
    title: task.title,
    taskType: displayDecisionValue(task.taskType),
    status: displayDecisionValue(task.status),
    priority: task.priority,
    dueDate: text(task.dueDate),
    blockerReason: text(task.blockerReason),
  }))
}

function mapLatestOffer(pack: PdfEvidencePack): InvestorReviewOfferSummary {
  const offer = pack.investorSummary.latestOffer
  if (offer === null) {
    return null
  }

  return {
    amount: money(offer.amount),
    offerType: displayDecisionValue(offer.offerType),
    offerStatus: displayDecisionValue(offer.offerStatus),
    rationale: text(offer.rationale),
    sellerResponse: text(offer.sellerResponse),
    createdAt: formatTimestamp(offer.createdAt),
  }
}

function buildPurpose(pack: PdfEvidencePack): string {
  if (pack.meta.audience === "INVESTOR" && pack.meta.purpose === "INVESTOR_DECISION_SUPPORT") {
    return "Investor decision support"
  }

  return `${labelFor(pack.meta.audience)} ${labelFor(pack.meta.purpose)}`
}

export function mapPdfEvidencePackToInvestorReview(
  input: MapPdfEvidencePackToInvestorReviewInput
): InvestorReviewViewModel {
  const { pack, savedDeal } = input

  return {
    header: {
      title: "Brik by Brik Investor Review",
      confidentialityLabel: pack.meta.confidentialityLabel,
      generatedAt: formatTimestamp(pack.meta.generatedAt),
      dealId: pack.meta.savedDealId,
      reviewPurpose: buildPurpose(pack),
      notices: [
        "Confidential controlled review material for investor decision support.",
        "This review is read-only investor decision support. It is not a valuation, legal advice, lending advice, or a substitute for professional due diligence.",
      ],
    },
    overview: {
      propertyIdentity: { label: "Property identity", value: text(pack.identity.address) },
      classification: {
        label: "Classification",
        value: displayDecisionValue(text(pack.investorSummary.classification)),
      },
      governance: {
        label: "Governance",
        value: displayDecisionValue(text(savedDeal.governance_state)),
      },
      capitalProtection: {
        label: "Capital protection",
        value: displayDecisionValue(text(pack.investorSummary.capitalProtectionState)),
        tone:
          pack.investorSummary.capitalProtectionState === "SAFE"
            ? "success"
            : pack.investorSummary.capitalProtectionState === null
              ? "neutral"
              : "caution",
      },
      pipeline: {
        label: "Pipeline",
        value: displayDecisionValue(text(savedDeal.pipeline_state)),
      },
    },
    investmentSummary: {
      purchasePrice: { label: "Purchase price", value: money(pack.investorSummary.purchasePrice) },
      gdvDownside: { label: "GDV downside", value: money(pack.investorSummary.gdvRange.downside) },
      gdvRealistic: { label: "GDV realistic", value: money(pack.investorSummary.gdvRange.realistic) },
      gdvStrong: { label: "GDV strong", value: money(pack.investorSummary.gdvRange.strong) },
      trueMao15: { label: "True MAO 15%", value: money(pack.investorSummary.trueMao.fifteenPercent) },
      trueMao20: { label: "True MAO 20%", value: money(pack.investorSummary.trueMao.twentyPercent) },
      trueMao25: { label: "True MAO 25%", value: money(pack.investorSummary.trueMao.twentyFivePercent) },
      latestOfferAmount: {
        label: "Latest offer",
        value:
          pack.investorSummary.latestOffer === null
            ? INVESTOR_REVIEW_EMPTY_OFFERS_LABEL
            : money(pack.investorSummary.latestOffer.amount),
      },
    },
    decisionSummary: {
      overallStatus: {
        label: "Shield overall status",
        value: displayDecisionValue(pack.investorShield.overallStatus),
        tone: overallStatusTone(pack.investorShield.overallStatus),
      },
      progressionDecision: {
        label: "Progression decision",
        value: displayDecisionValue(pack.investorShield.progressionDecision),
        tone: progressionDecisionTone(pack.investorShield.progressionDecision),
      },
      canProgress: {
        label: "Can progress",
        value: pack.investorShield.canProgress ? "Yes" : "No",
        tone: pack.investorShield.canProgress ? "success" : "blocked",
      },
      missingEvidenceCount: {
        label: "Missing evidence count",
        value: count(pack.investorSummary.investorShield.missingEvidenceCount),
        tone:
          (pack.investorSummary.investorShield.missingEvidenceCount ?? 0) > 0
            ? "caution"
            : "neutral",
      },
      blockedGateCount: {
        label: "Blocked gate count",
        value: String(pack.investorShield.blockingGateKeys.length),
        tone: pack.investorShield.blockingGateKeys.length > 0 ? "blocked" : "neutral",
      },
      explanation:
        pack.investorShield.deterministicDominanceNote ??
        (pack.investorShield.canProgress
          ? "Required gates are currently clear or non-blocking in the canonical result."
          : "Required evidence remains incomplete or blocked in the canonical result."),
    },
    requiredGateRows: mapRequiredGateRows(pack),
    advisoryItems: mapAdvisoryItems(pack),
    evidenceLiteNotice: INVESTOR_REVIEW_EVIDENCE_LITE_NOTICE,
    evidenceLiteRows: mapEvidenceLiteRows(pack),
    emptyEvidenceLiteText: INVESTOR_REVIEW_EMPTY_EVIDENCE_LITE_LABEL,
    blockerRows: mapBlockerRows(pack),
    followUpRequirements: mapFollowUpRequirements(pack),
    tasks: mapTasks(pack),
    emptyTasksText: INVESTOR_REVIEW_EMPTY_TASKS_LABEL,
    latestOffer: mapLatestOffer(pack),
    emptyOffersText: INVESTOR_REVIEW_EMPTY_OFFERS_LABEL,
    recommendedNextAction: displayActionText(text(pack.investorSummary.recommendedNextAction.actionText)),
    footer: {
      confidentialityLabel: pack.meta.confidentialityLabel,
      generatedAt: formatTimestamp(pack.meta.generatedAt),
      dealId: pack.meta.savedDealId,
      notices: [
        "Investor Shield status remains authoritative within this application.",
        "Missing evidence must not be interpreted as completed verification.",
      ],
      disclaimers: pack.disclaimers.map((disclaimer) => ({
        code: disclaimer.code,
        title: disclaimer.title,
        body: disclaimer.body,
        required: disclaimer.required,
      })),
    },
  }
}
