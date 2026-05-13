import type {
  EvidenceCategory,
  EvidenceOrchestrationHint,
  EvidenceOrchestrationHintSeverity,
  EvidenceOrchestrationHintTrigger,
  EvidenceOrchestrationHints,
  EvidenceStatus,
  Phase3EvidenceBundle,
  Phase3EvidenceItem,
} from "@/types/phase3-evidence"
import type {
  GovernanceEscalationRoute,
  Phase3TaskCategory,
  Phase3TaskPriority,
} from "@/types/phase3-orchestration"

// Advisory adapter only. No side effects, no external calls, no mutation of input.
// Output is never used to change deterministic deal decisions, governance states,
// engine formulas, or deal classifications. All outputs carry advisoryOnly: true.
// Reserved source labels (future_ai_extracted, future_integration) are not active
// behavior — they produce reserved_source_review hints only.

const RESERVED_SOURCES: readonly string[] = ["future_ai_extracted", "future_integration"]

const REVIEW_TRIGGERS: readonly EvidenceOrchestrationHintTrigger[] = [
  "missing_evidence",
  "weak_evidence",
  "conflicting_evidence",
  "reserved_source_review",
]

const CATEGORY_SHORT: Record<EvidenceCategory, string> = {
  comparable_evidence: "comparable",
  listing_evidence: "listing",
  refurb_evidence: "refurb",
  legal_survey_evidence: "legal",
  lender_refinance_evidence: "lender",
  market_evidence: "market",
  operator_note: "operator note",
  system_generated_evidence: "system generated",
}

const CATEGORY_LABEL: Record<EvidenceCategory, string> = {
  comparable_evidence: "Comparable evidence",
  listing_evidence: "Listing evidence",
  refurb_evidence: "Refurb evidence",
  legal_survey_evidence: "Legal and survey evidence",
  lender_refinance_evidence: "Lender refinance evidence",
  market_evidence: "Market evidence",
  operator_note: "Operator note",
  system_generated_evidence: "System generated evidence",
}

const STATUS_TRIGGER: Record<EvidenceStatus, EvidenceOrchestrationHintTrigger> = {
  missing: "missing_evidence",
  weak: "weak_evidence",
  conflicting: "conflicting_evidence",
  requires_review: "missing_evidence",
  rejected: "contract_warning",
  accepted: "accepted_evidence_awareness",
  provided: "accepted_evidence_awareness",
  not_applicable: "accepted_evidence_awareness",
}

const STATUS_SEVERITY: Record<EvidenceStatus, EvidenceOrchestrationHintSeverity> = {
  missing: "high",
  weak: "high",
  conflicting: "high",
  requires_review: "medium",
  rejected: "medium",
  accepted: "low",
  provided: "low",
  not_applicable: "low",
}

const TRIGGER_STATUS_WORD: Record<EvidenceOrchestrationHintTrigger, string> = {
  missing_evidence: "missing",
  weak_evidence: "weak",
  conflicting_evidence: "conflicting",
  accepted_evidence_awareness: "accepted",
  reserved_source_review: "reserved",
  contract_warning: "contract",
  duplicate_evidence: "duplicate",
  operator_note: "operator",
}

// Advisory bundle-level risk phrases per category+trigger. These surface
// visibility requirements — they do not create governance decisions.
const BUNDLE_RISK_PHRASES: Partial<
  Record<EvidenceCategory, Partial<Record<EvidenceOrchestrationHintTrigger, readonly string[]>>>
> = {
  comparable_evidence: {
    weak_evidence: ["comparable evidence is weak and must not be presented as clean"],
    missing_evidence: ["comparable evidence is missing and must not be hidden from deal review"],
  },
  legal_survey_evidence: {
    conflicting_evidence: [
      "conflicting legal evidence must not be hidden from manual reviewer",
      "legal conflict may affect deal progression — manual legal review required",
    ],
    missing_evidence: ["missing legal evidence must not be hidden from deal review"],
  },
  lender_refinance_evidence: {
    missing_evidence: [
      "lender evidence gap must not be hidden behind finance confidence output",
    ],
    weak_evidence: ["weak lender evidence must not appear as settled finance confidence"],
  },
  refurb_evidence: {
    weak_evidence: [
      "weak refurb evidence must not be used as authoritative scope or cost estimate",
    ],
    missing_evidence: [
      "missing refurb evidence must not be hidden behind rules-based assumptions",
    ],
  },
}

function categoryToEscalationRoute(
  category: EvidenceCategory,
  status: EvidenceStatus
): GovernanceEscalationRoute {
  const needsReview: readonly EvidenceStatus[] = [
    "missing",
    "weak",
    "conflicting",
    "requires_review",
  ]
  const escalates = needsReview.includes(status)

  switch (category) {
    case "comparable_evidence":
      return "valuation_review"
    case "legal_survey_evidence":
      return "legal_review"
    case "lender_refinance_evidence":
      return "lender_review"
    case "refurb_evidence":
      return "refurb_review"
    case "listing_evidence":
      return escalates ? "evidence_gap" : "none"
    case "market_evidence":
      return escalates ? "valuation_review" : "none"
    case "operator_note":
      return escalates ? "manual_review" : "none"
    case "system_generated_evidence":
      return status === "weak" || status === "conflicting" ? "manual_review" : "none"
  }
}

function triggerToTaskCategory(trigger: EvidenceOrchestrationHintTrigger): Phase3TaskCategory {
  switch (trigger) {
    case "conflicting_evidence":
    case "reserved_source_review":
    case "duplicate_evidence":
      return "manual_review"
    case "contract_warning":
      return "governance"
    case "accepted_evidence_awareness":
    case "operator_note":
      return "limitations_awareness"
    case "missing_evidence":
    case "weak_evidence":
      return "evidence"
  }
}

function severityToTaskPriority(severity: EvidenceOrchestrationHintSeverity): Phase3TaskPriority {
  return severity
}

function hintIdFromItem(item: Phase3EvidenceItem): string {
  if (item.stableCode) {
    return `hint-${item.stableCode.toLowerCase().replace(/_/g, "-")}`
  }
  return `hint-${item.id}`
}

function buildSummary(
  item: Phase3EvidenceItem,
  trigger: EvidenceOrchestrationHintTrigger
): string {
  const label = CATEGORY_LABEL[item.category]
  switch (trigger) {
    case "missing_evidence":
      return `${label} is missing. Review required before progression.`
    case "weak_evidence":
      return `${label} is weak. Manual review required before confidence can be presented as clean.`
    case "conflicting_evidence":
      return `${label} conflict detected. Manual review required before progression.`
    case "accepted_evidence_awareness":
      return `Accepted ${label.toLowerCase()} captured for context. Awareness-only — no deterministic decision effect.`
    case "reserved_source_review":
      return `Reserved source label (${item.source}) requires manual confirmation before evidence can be accepted.`
    case "contract_warning":
      return `Evidence contract warning for ${label.toLowerCase()}. Review required.`
    case "duplicate_evidence":
      return `Duplicate evidence detected for ${item.id}. Review required.`
    case "operator_note":
      return `Operator note captured for context. Awareness-only — no deterministic decision effect.`
  }
}

function buildHintWarnings(
  item: Phase3EvidenceItem,
  trigger: EvidenceOrchestrationHintTrigger
): readonly string[] | undefined {
  const result: string[] = []
  const statusWord = TRIGGER_STATUS_WORD[trigger]
  const categoryShort = CATEGORY_SHORT[item.category]

  if (item.issues) {
    for (const issue of item.issues) {
      result.push(`${statusWord} ${categoryShort} evidence: ${issue}`)
    }
  }
  if (item.warnings) {
    for (const w of item.warnings) {
      result.push(w)
    }
  }
  return result.length > 0 ? result : undefined
}

function buildHintForItem(item: Phase3EvidenceItem): EvidenceOrchestrationHint | null {
  // Reserved sources always require a hint, regardless of status
  if (RESERVED_SOURCES.includes(item.source)) {
    return {
      id: hintIdFromItem(item),
      evidenceItemId: item.id,
      category: item.category,
      trigger: "reserved_source_review",
      severity: "medium",
      suggestedTaskCategory: "manual_review",
      suggestedTaskPriority: "medium",
      suggestedEscalationRoute: "manual_review",
      summary: buildSummary(item, "reserved_source_review"),
      warnings: [`reserved source label only: ${item.source}`],
      advisoryOnly: true,
    }
  }

  if (item.status === "provided" || item.status === "not_applicable") {
    return null
  }

  const trigger = STATUS_TRIGGER[item.status]
  const severity = STATUS_SEVERITY[item.status]
  const route = categoryToEscalationRoute(item.category, item.status)
  const hintWarnings = buildHintWarnings(item, trigger)

  const hint: EvidenceOrchestrationHint = {
    id: hintIdFromItem(item),
    evidenceItemId: item.id,
    category: item.category,
    trigger,
    severity,
    suggestedTaskCategory: triggerToTaskCategory(trigger),
    suggestedTaskPriority: severityToTaskPriority(severity),
    suggestedEscalationRoute: route,
    summary: buildSummary(item, trigger),
    advisoryOnly: true,
  }

  if (hintWarnings !== undefined) {
    return { ...hint, warnings: hintWarnings }
  }
  return hint
}

// Pure adapter. No side effects, no timestamps, no random values.
// Output order is stable: duplicate hint first (if any), then items in input order.
// Does not create Phase3Task objects. Does not change deterministic engine behavior.
export function mapEvidenceBundleToOrchestrationHints(
  bundle: Phase3EvidenceBundle
): EvidenceOrchestrationHints {
  const hints: EvidenceOrchestrationHint[] = []

  // Detect duplicate item IDs
  const seenIds = new Set<string>()
  const duplicateIds: string[] = []
  for (const item of bundle.items) {
    if (seenIds.has(item.id)) {
      duplicateIds.push(item.id)
    } else {
      seenIds.add(item.id)
    }
  }

  if (duplicateIds.length > 0) {
    hints.push({
      id: "hint-duplicate-evidence-detected",
      category: "system_generated_evidence",
      trigger: "duplicate_evidence",
      severity: "medium",
      suggestedTaskCategory: "manual_review",
      suggestedTaskPriority: "medium",
      suggestedEscalationRoute: "manual_review",
      summary: `Duplicate evidence item IDs detected: ${duplicateIds.join(", ")}. Review required.`,
      warnings: duplicateIds.map((id) => `duplicate item id: ${id}`),
      advisoryOnly: true,
    })
  }

  // Build hints for unique items in input order
  const processedIds = new Set<string>()
  for (const item of bundle.items) {
    if (processedIds.has(item.id)) continue
    processedIds.add(item.id)
    const hint = buildHintForItem(item)
    if (hint !== null) {
      hints.push(hint)
    }
  }

  // Collect escalation routes
  const routeSet = new Set<GovernanceEscalationRoute>()
  for (const hint of hints) {
    if (hint.suggestedEscalationRoute !== "none") {
      routeSet.add(hint.suggestedEscalationRoute)
    }
  }
  if (bundle.missingCriticalEvidence.length > 0) {
    routeSet.add("evidence_gap")
  }
  // Preserve "none" sentinel when hints exist but no real routes apply
  if (hints.length > 0 && routeSet.size === 0) {
    routeSet.add("none")
  }

  // Build bundle warnings: risk phrases first, then missing critical evidence entries
  const bundleWarnings: string[] = []
  for (const hint of hints) {
    const phrases = BUNDLE_RISK_PHRASES[hint.category]?.[hint.trigger]
    if (phrases) {
      for (const phrase of phrases) {
        bundleWarnings.push(phrase)
      }
    }
  }
  for (const missing of bundle.missingCriticalEvidence) {
    bundleWarnings.push(`${missing} is missing from critical evidence`)
  }

  const reviewRequired =
    bundle.reviewRequired ||
    hints.some((h) => (REVIEW_TRIGGERS as readonly string[]).includes(h.trigger))

  return {
    tasks: hints,
    escalationRoutes: Array.from(routeSet),
    warnings: bundleWarnings,
    reviewRequired,
    advisoryOnly: true,
  }
}
