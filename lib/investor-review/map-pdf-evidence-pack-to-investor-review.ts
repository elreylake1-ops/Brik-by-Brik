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

const EVIDENCE_COMMAND_TYPE_LABELS: Record<string, string> = {
  SOLD_COMPARABLE: "Sold comparable",
  TITLE_LEGAL: "Title / legal",
  LEASEHOLD: "Leasehold",
  PLANNING_BUILDING_CONTROL: "Planning / building control",
  REFURB: "Refurb",
  BUILDER_QUOTE: "Builder quote",
  DAMP_STRUCTURAL: "Damp / structural",
  LENDER_BROKER: "Lender / broker",
  RENTAL_DEMAND: "Rental demand",
  SOLICITOR_REVIEW: "Solicitor review",
  AGENT_RESPONSE: "Agent response",
  PHOTO_EVIDENCE: "Photo evidence",
  VIDEO_EVIDENCE: "Video evidence",
  SURVEYOR_EVIDENCE: "Surveyor evidence",
  OFFER_NEGOTIATION_EVIDENCE: "Offer / negotiation evidence",
  OTHER: "Other",
}

const EVIDENCE_COMMAND_STRENGTH_LABELS: Record<string, string> = {
  WEAK: "Weak",
  MODERATE: "Moderate",
  STRONG: "Strong",
}

const EVIDENCE_COMMAND_REVIEW_STATE_LABELS: Record<string, string> = {
  NOT_REVIEWED: "Not reviewed",
  REVIEWED_BY_OPERATOR: "Reviewed by operator",
  PROFESSIONAL_REVIEW_REQUIRED: "Professional review required",
  PROFESSIONAL_CONFIRMED: "Professional confirmed",
}

const EVIDENCE_COMMAND_BLOCKER_IMPACT_LABELS: Record<string, string> = {
  DOES_NOT_BLOCK: "Does not block",
  CAUTION_ONLY: "Caution only",
  BLOCKS_PROGRESSION: "Blocks progression",
  REQUIRES_MANUAL_REVIEW: "Requires manual review",
}

const EVIDENCE_COMMAND_PROFESSIONAL_GATE_LABELS: Record<string, string> = {
  NONE: "None",
  SOLICITOR_TITLE_REVIEW: "Solicitor title review",
  BROKER_CONFIRMATION: "Broker confirmation",
  SURVEYOR_REPORT: "Surveyor report",
  BUILDER_QUOTE: "Builder quote",
  PLANNING_BUILDING_CONTROL_CONFIRMATION: "Planning / building control confirmation",
  ACTUAL_SOLD_COMPARABLE_REVIEW: "Actual sold comparable review",
  LENDER_BROKER_CONFIRMATION: "Lender / broker confirmation",
  SPECIALIST_REPORT: "Specialist report",
}

function labelFromMap(value: string | null | undefined, labels: Record<string, string>): string {
  if (typeof value !== "string") {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  return labels[trimmed] ?? labelFor(trimmed)
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

function mapLegacyEvidenceTypeToCommandType(value: string): string {
  switch (value) {
    case "SOLD_COMP":
      return "SOLD_COMPARABLE"
    case "TITLE_REVIEW":
      return "TITLE_LEGAL"
    case "LEASEHOLD_REVIEW":
      return "LEASEHOLD"
    case "PLANNING_BUILDING_CONTROL":
      return "PLANNING_BUILDING_CONTROL"
    case "REFURB_NOTE":
      return "REFURB"
    case "BUILDER_QUOTE":
      return "BUILDER_QUOTE"
    case "SURVEY_NOTE":
      return "SURVEYOR_EVIDENCE"
    case "LENDER_NOTE":
      return "LENDER_BROKER"
    case "RENTAL_DEMAND":
      return "RENTAL_DEMAND"
    case "SOLICITOR_REVIEW":
      return "SOLICITOR_REVIEW"
    default:
      return "OTHER"
  }
}

function mapLegacyStatusToEvidenceStatus(value: string): string {
  switch (value) {
    case "MISSING":
      return "MISSING"
    case "RECORDED":
      return "RECEIVED"
    case "REVIEWED":
      return "REVIEWED"
    case "VERIFIED":
      return "SUFFICIENT"
    case "REJECTED":
      return "REJECTED"
    default:
      return "MISSING"
  }
}

function evidenceTypeLabelForItem(item: PdfEvidencePack["evidenceIndex"][number]): string {
  const commandType = item.evidenceCommandType ?? mapLegacyEvidenceTypeToCommandType(item.evidenceType)
  return labelFromMap(commandType, EVIDENCE_COMMAND_TYPE_LABELS)
}

function evidenceStatusForItem(item: PdfEvidencePack["evidenceIndex"][number]): string {
  return item.evidenceStatus ?? mapLegacyStatusToEvidenceStatus(item.reviewStatus)
}

function evidenceStatusToneForItem(item: PdfEvidencePack["evidenceIndex"][number]): InvestorReviewSemanticTone {
  const status = evidenceStatusForItem(item)
  switch (status) {
    case "SUFFICIENT":
      return "success"
    case "RECEIVED":
    case "REVIEWED":
    case "REQUESTED":
      return "informational"
    case "MISSING":
    case "INSUFFICIENT":
    case "EXPIRED":
      return "caution"
    case "REJECTED":
      return "blocked"
    default:
      return "neutral"
  }
}

function reviewStateForItem(item: PdfEvidencePack["evidenceIndex"][number]): string {
  return item.reviewState ?? (item.reviewedAt !== null ? "REVIEWED_BY_OPERATOR" : "NOT_REVIEWED")
}

function reviewStateLabelForItem(item: PdfEvidencePack["evidenceIndex"][number]): string {
  return labelFromMap(reviewStateForItem(item), EVIDENCE_COMMAND_REVIEW_STATE_LABELS)
}

function reviewStateToneForItem(item: PdfEvidencePack["evidenceIndex"][number]): InvestorReviewSemanticTone {
  const reviewState = reviewStateForItem(item)
  switch (reviewState) {
    case "PROFESSIONAL_CONFIRMED":
      return "success"
    case "REVIEWED_BY_OPERATOR":
      return "informational"
    case "NOT_REVIEWED":
    case "PROFESSIONAL_REVIEW_REQUIRED":
      return "caution"
    default:
      return "neutral"
  }
}

function evidenceStrengthLabelForItem(item: PdfEvidencePack["evidenceIndex"][number]): string {
  return labelFromMap(item.evidenceStrength ?? "WEAK", EVIDENCE_COMMAND_STRENGTH_LABELS)
}

function evidenceStrengthToneForItem(item: PdfEvidencePack["evidenceIndex"][number]): InvestorReviewSemanticTone {
  switch (item.evidenceStrength ?? "WEAK") {
    case "STRONG":
      return "success"
    case "MODERATE":
      return "informational"
    case "WEAK":
    default:
      return "caution"
  }
}

function blockerImpactLabelForItem(item: PdfEvidencePack["evidenceIndex"][number]): string {
  return labelFromMap(item.blockerImpact ?? "DOES_NOT_BLOCK", EVIDENCE_COMMAND_BLOCKER_IMPACT_LABELS)
}

function blockerImpactToneForItem(item: PdfEvidencePack["evidenceIndex"][number]): InvestorReviewSemanticTone {
  switch (item.blockerImpact ?? "DOES_NOT_BLOCK") {
    case "DOES_NOT_BLOCK":
      return "success"
    case "CAUTION_ONLY":
      return "caution"
    case "BLOCKS_PROGRESSION":
      return "blocked"
    case "REQUIRES_MANUAL_REVIEW":
    default:
      return "informational"
  }
}

function linkedInvestorShieldGateLabelForItem(
  item: PdfEvidencePack["evidenceIndex"][number]
): string {
  const value = item.linkedInvestorShieldGate ?? item.relatedGateIds[0] ?? null
  if (typeof value !== "string" || value.trim().length === 0) {
    return INVESTOR_REVIEW_NOT_AVAILABLE_LABEL
  }

  return gateLabelFor(value)
}

function linkedProfessionalGateLabelForItem(
  item: PdfEvidencePack["evidenceIndex"][number]
): string {
  return labelFromMap(item.linkedProfessionalGate ?? "NONE", EVIDENCE_COMMAND_PROFESSIONAL_GATE_LABELS)
}

function expiryOrUpdateDateForItem(item: PdfEvidencePack["evidenceIndex"][number]): string | null {
  return formatTimestamp(item.expiryOrUpdateDate)
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
    const evidenceStatus = evidenceStatusForItem(item)
    const reviewState = reviewStateForItem(item)
    const evidenceStrength = evidenceStrengthLabelForItem(item)
    const blockerImpact = blockerImpactLabelForItem(item)
    const evidenceSummary = item.evidenceSummary ?? item.description
    const recommendedNextAction = item.recommendedNextAction ?? null
    const expiryOrUpdateDate = expiryOrUpdateDateForItem(item)
    const source = item.source ?? null
    const mobileCaptureNote = item.mobileCaptureNote ?? null

    return {
      evidenceId: item.evidenceId,
      title: item.title,
      evidenceType: evidenceTypeLabelForItem(item),
      linkedGate:
        item.relatedGateIds.length > 0
          ? item.relatedGateIds.map(gateLabelFor).join(", ")
          : INVESTOR_REVIEW_NOT_AVAILABLE_LABEL,
      linkedInvestorShieldGate: linkedInvestorShieldGateLabelForItem(item),
      linkedProfessionalGate: linkedProfessionalGateLabelForItem(item),
      status: evidenceStatus,
      statusTone: evidenceStatusToneForItem(item),
      reviewedLabel: reviewStateLabelForItem(item),
      reviewedTone: reviewStateToneForItem(item),
      evidenceStatus,
      evidenceStatusTone: evidenceStatusToneForItem(item),
      reviewState,
      reviewStateTone: reviewStateToneForItem(item),
      evidenceStrength,
      evidenceStrengthTone: evidenceStrengthToneForItem(item),
      blockerImpact,
      blockerImpactTone: blockerImpactToneForItem(item),
      evidenceSummary,
      note: item.description,
      reviewerNote: null,
      recommendedNextAction,
      expiryOrUpdateDate,
      source,
      mobileCaptureNote,
      referenceLabel: item.controlledReferenceLabel,
      relevantTimestamp: formatTimestamp(item.reviewedAt ?? item.capturedAt),
      clarificationNote:
        evidenceStatus === "MISSING" && reviewState === "NOT_REVIEWED"
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
