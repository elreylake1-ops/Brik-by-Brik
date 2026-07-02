import { buildDefaultInvestorShieldChecks } from "@/lib/investor-shield/default-checks"
import { INVESTOR_SHIELD_DEFAULT_GATES } from "@/lib/investor-shield/default-gates"
import type {
  EvidenceItem,
  InvestorShieldCheck,
  InvestorShieldGateKey,
  ManualOverride,
  RiskFlag,
} from "@/types/investor-shield"
import type {
  InvestorShieldEnforcementResult,
  InvestorShieldEvaluationInput,
} from "@/types/investor-shield-enforcement"

export const INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID = "saved-deal-text-id-4c3"
const DETERMINISTIC_DOMINANCE_NOTE =
  "Investor Shield may add caution or blocking, but it cannot soften deterministic rejection."

type CheckOverride = Partial<InvestorShieldCheck> & { gateKey: InvestorShieldGateKey }

export type InvestorShieldEvaluatorFixture = {
  id: string
  name: string
  input: InvestorShieldEvaluationInput
  expected: {
    overallStatus: InvestorShieldEnforcementResult["overallStatus"]
    progressionDecision: InvestorShieldEnforcementResult["progressionDecision"]
    canProgress: boolean
    blockingReasons: readonly InvestorShieldEnforcementResult["blockingReasons"][number][]
    blockingGateKeys: readonly InvestorShieldGateKey[]
    cautionGateKeys: readonly InvestorShieldGateKey[]
    missingEvidenceGateKeys: readonly InvestorShieldGateKey[]
    advisoryOnlyEvidenceWarnings: readonly string[]
    taskRecommendations: InvestorShieldEnforcementResult["taskRecommendations"]
    deterministicDominanceNote?: string
  }
}

function makeChecks(overrides: readonly CheckOverride[] = []): readonly InvestorShieldCheck[] {
  const base = buildDefaultInvestorShieldChecks(INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID)

  return base.map((check) => {
    const override = overrides.find((candidate) => candidate.gateKey === check.gateKey)

    return {
      ...check,
      status: "SATISFIED",
      confidence: "HIGH",
      ...override,
    }
  })
}

function makeEvidence(): readonly EvidenceItem[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.flatMap((gate) => {
    const evidenceTypes =
      gate.key === "REFURB_CERTAINTY"
        ? (["REFURB_PHOTO", "ROOM_MEASUREMENT"] as const)
        : gate.evidenceTypes.slice(0, 1)

    return evidenceTypes.map((evidenceType, index) => ({
      dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
      gateKey: gate.key,
      evidenceType,
      source: index === 0 ? "document" : "professional",
      confidence: "HIGH" as const,
      label: `${gate.key}-${evidenceType}-${index + 1}`,
    }))
  })
}

function replaceEvidenceForGate(
  evidenceItems: readonly EvidenceItem[],
  gateKey: InvestorShieldGateKey,
  replacements: readonly EvidenceItem[]
): readonly EvidenceItem[] {
  return evidenceItems.filter((item) => item.gateKey !== gateKey).concat(replacements)
}

function removeChecksForGate(
  checks: readonly InvestorShieldCheck[],
  gateKey: InvestorShieldGateKey
): readonly InvestorShieldCheck[] {
  return checks.filter((check) => check.gateKey !== gateKey)
}

function makeInput(args?: {
  checks?: readonly InvestorShieldCheck[]
  evidenceItems?: readonly EvidenceItem[]
  manualOverrides?: readonly ManualOverride[]
  riskFlags?: readonly RiskFlag[]
  deterministicDealStatus?: string
  evaluatedAt?: string
}): InvestorShieldEvaluationInput {
  return {
    dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
    checks: args?.checks ?? makeChecks(),
    evidenceItems: args?.evidenceItems ?? makeEvidence(),
    manualOverrides: args?.manualOverrides ?? [],
    riskFlags: args?.riskFlags ?? [],
    deterministicDealStatus: args?.deterministicDealStatus,
    evaluatedAt: args?.evaluatedAt,
  }
}

export const INVESTOR_SHIELD_EVALUATOR_FIXTURES: readonly InvestorShieldEvaluatorFixture[] = [
  {
    id: "all_gates_satisfied",
    name: "all gates satisfied",
    input: makeInput(),
    expected: {
      overallStatus: "CLEAR",
      progressionDecision: "CAN_PROGRESS",
      canProgress: true,
      blockingReasons: [],
      blockingGateKeys: [],
      cautionGateKeys: [],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [],
    },
  },
  {
    id: "missing_sold_comps",
    name: "missing sold comps",
    input: makeInput({
      checks: makeChecks([{ gateKey: "SOLD_COMPS", status: "REQUIRED", severity: "BLOCKER" }]),
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: ["REQUIRED_GATE_MISSING"],
      blockingGateKeys: ["SOLD_COMPS"],
      cautionGateKeys: [],
      missingEvidenceGateKeys: ["SOLD_COMPS"],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "SOLD_COMPS",
          type: "REQUEST_EVIDENCE",
          title: "Request evidence",
          reason: "Sold Comparables is still awaiting required evidence.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey:
            "investor-shield:saved-deal-text-id-4c3:SOLD_COMPS:REQUEST_EVIDENCE",
        },
      ],
    },
  },
  {
    id: "failed_title_blocker",
    name: "failed title blocker",
    input: makeInput({
      checks: makeChecks([{ gateKey: "TITLE", status: "FAILED", severity: "BLOCKER" }]),
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: ["BLOCKER_GATE_FAILED"],
      blockingGateKeys: ["TITLE"],
      cautionGateKeys: [],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "TITLE",
          type: "REQUEST_EVIDENCE",
          title: "Request evidence",
          reason: "Title Review failed and requires follow-up review or evidence.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey: "investor-shield:saved-deal-text-id-4c3:TITLE:REQUEST_EVIDENCE",
        },
      ],
    },
  },
  {
    id: "weak_refurb_certainty",
    name: "weak refurb certainty",
    input: makeInput({
      checks: makeChecks([
        { gateKey: "REFURB_CERTAINTY", status: "WEAK", severity: "BLOCKER" },
      ]),
    }),
    expected: {
      overallStatus: "CAUTION",
      progressionDecision: "NEEDS_REVIEW",
      canProgress: false,
      blockingReasons: [],
      blockingGateKeys: [],
      cautionGateKeys: ["REFURB_CERTAINTY"],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "REFURB_CERTAINTY",
          type: "OBTAIN_BUILDER_QUOTE",
          title: "Obtain builder quote",
          reason: "Refurb Certainty is weak and needs stronger supporting evidence.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey:
            "investor-shield:saved-deal-text-id-4c3:REFURB_CERTAINTY:OBTAIN_BUILDER_QUOTE",
        },
      ],
    },
  },
  {
    id: "refurb_ai_advisory_only",
    name: "refurb certainty with AI advisory evidence only",
    input: makeInput({
      evidenceItems: replaceEvidenceForGate(makeEvidence(), "REFURB_CERTAINTY", [
        {
          dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
          gateKey: "REFURB_CERTAINTY",
          evidenceType: "REFURB_PHOTO",
          source: "ai_advisory",
          confidence: "LOW",
          label: "refurb-ai-advisory-photo",
          advisoryOnly: true,
        },
      ]),
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: [
        "ADVISORY_ONLY_EVIDENCE_INSUFFICIENT",
        "REFURB_CERTAINTY_INSUFFICIENT",
      ],
      blockingGateKeys: ["REFURB_CERTAINTY"],
      cautionGateKeys: [],
      missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
      advisoryOnlyEvidenceWarnings: [
        "REFURB_CERTAINTY: advisory-only evidence can support review but cannot satisfy hard evidence alone.",
      ],
      taskRecommendations: [],
    },
  },
  {
    id: "refurb_with_builder_quote_hard_evidence",
    name: "refurb certainty with hard builder quote evidence",
    input: makeInput({
      evidenceItems: replaceEvidenceForGate(makeEvidence(), "REFURB_CERTAINTY", [
        {
          dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
          gateKey: "REFURB_CERTAINTY",
          evidenceType: "BUILDER_QUOTE",
          source: "professional",
          confidence: "HIGH",
          label: "builder-quote-hard-evidence",
        },
      ]),
    }),
    expected: {
      overallStatus: "CLEAR",
      progressionDecision: "CAN_PROGRESS",
      canProgress: true,
      blockingReasons: [],
      blockingGateKeys: [],
      cautionGateKeys: [],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [],
    },
  },
  {
    id: "manual_waiver_without_reason",
    name: "manual waiver without reason",
    input: makeInput({
      checks: makeChecks([
        { gateKey: "SOLICITOR_FEEDBACK", status: "WAIVED", severity: "BLOCKER" },
      ]),
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: ["MANUAL_OVERRIDE_REQUIRED"],
      blockingGateKeys: ["SOLICITOR_FEEDBACK"],
      cautionGateKeys: ["SOLICITOR_FEEDBACK"],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "SOLICITOR_FEEDBACK",
          type: "REVIEW_GATE",
          title: "Review gate",
          reason: "Solicitor Review was waived and requires manual justification review.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey:
            "investor-shield:saved-deal-text-id-4c3:SOLICITOR_FEEDBACK:REVIEW_GATE",
        },
      ],
    },
  },
  {
    id: "manual_waiver_with_reason",
    name: "manual waiver with reason",
    input: makeInput({
      checks: makeChecks([
        { gateKey: "SOLICITOR_FEEDBACK", status: "WAIVED", severity: "BLOCKER" },
      ]),
      manualOverrides: [
        {
          dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
          gateKey: "SOLICITOR_FEEDBACK",
          reason: "Solicitor issue logged and explicitly reviewed before progression.",
        },
      ],
    }),
    expected: {
      overallStatus: "CAUTION",
      progressionDecision: "NEEDS_REVIEW",
      canProgress: false,
      blockingReasons: [],
      blockingGateKeys: [],
      cautionGateKeys: ["SOLICITOR_FEEDBACK"],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "SOLICITOR_FEEDBACK",
          type: "REVIEW_GATE",
          title: "Review gate",
          reason: "Solicitor Review was waived and requires manual justification review.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey:
            "investor-shield:saved-deal-text-id-4c3:SOLICITOR_FEEDBACK:REVIEW_GATE",
        },
      ],
    },
  },
  {
    id: "rental_demand_caution_only",
    name: "rental demand caution only",
    input: makeInput({
      checks: makeChecks([
        { gateKey: "RENTAL_DEMAND", status: "REQUIRED", severity: "CAUTION" },
      ]),
    }),
    expected: {
      overallStatus: "CAUTION",
      progressionDecision: "NEEDS_REVIEW",
      canProgress: false,
      blockingReasons: [],
      blockingGateKeys: [],
      cautionGateKeys: ["RENTAL_DEMAND"],
      missingEvidenceGateKeys: ["RENTAL_DEMAND"],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "RENTAL_DEMAND",
          type: "VERIFY_RENTAL_DEMAND",
          title: "Verify rental demand",
          reason: "Rental Demand is still awaiting required evidence.",
          severity: "CAUTION",
          source: "system_default",
          idempotencyKey:
            "investor-shield:saved-deal-text-id-4c3:RENTAL_DEMAND:VERIFY_RENTAL_DEMAND",
        },
      ],
    },
  },
  {
    id: "deterministic_no_go_dominates",
    name: "deterministic NO-GO with otherwise satisfied gates",
    input: makeInput({
      deterministicDealStatus: "NO-GO",
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: ["DETERMINISTIC_REJECT_DOMINATES"],
      blockingGateKeys: [],
      cautionGateKeys: [],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [],
      deterministicDominanceNote: DETERMINISTIC_DOMINANCE_NOTE,
    },
  },
  {
    id: "duplicate_refurb_advisory_evidence",
    name: "duplicate evidence items should not inflate confidence",
    input: makeInput({
      evidenceItems: replaceEvidenceForGate(makeEvidence(), "REFURB_CERTAINTY", [
        {
          dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
          gateKey: "REFURB_CERTAINTY",
          evidenceType: "REFURB_PHOTO",
          source: "ai_advisory",
          confidence: "LOW",
          label: "duplicate-ai-advisory-photo-1",
          advisoryOnly: true,
        },
        {
          dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
          gateKey: "REFURB_CERTAINTY",
          evidenceType: "REFURB_PHOTO",
          source: "ai_advisory",
          confidence: "LOW",
          label: "duplicate-ai-advisory-photo-2",
          advisoryOnly: true,
        },
      ]),
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: [
        "ADVISORY_ONLY_EVIDENCE_INSUFFICIENT",
        "REFURB_CERTAINTY_INSUFFICIENT",
      ],
      blockingGateKeys: ["REFURB_CERTAINTY"],
      cautionGateKeys: [],
      missingEvidenceGateKeys: ["REFURB_CERTAINTY"],
      advisoryOnlyEvidenceWarnings: [
        "REFURB_CERTAINTY: advisory-only evidence can support review but cannot satisfy hard evidence alone.",
      ],
      taskRecommendations: [],
    },
  },
  {
    id: "unknown_gate_ignored",
    name: "unknown/non-default gate should not crash evaluator",
    input: makeInput({
      checks: makeChecks().concat({
        dealId: INVESTOR_SHIELD_EVALUATOR_FIXTURE_DEAL_ID,
        gateKey: "UNKNOWN_GATE" as InvestorShieldGateKey,
        status: "FAILED",
        severity: "FATAL",
        confidence: "LOW",
        requiredEvidence: ["OTHER"],
      }),
    }),
    expected: {
      overallStatus: "CLEAR",
      progressionDecision: "CAN_PROGRESS",
      canProgress: true,
      blockingReasons: [],
      blockingGateKeys: [],
      cautionGateKeys: [],
      missingEvidenceGateKeys: [],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [],
    },
  },
  {
    id: "missing_check_record_for_blocker_gate",
    name: "missing blocker gate record blocks",
    input: makeInput({
      checks: removeChecksForGate(makeChecks(), "TITLE"),
    }),
    expected: {
      overallStatus: "BLOCKED",
      progressionDecision: "BLOCKED",
      canProgress: false,
      blockingReasons: ["REQUIRED_GATE_MISSING"],
      blockingGateKeys: ["TITLE"],
      cautionGateKeys: [],
      missingEvidenceGateKeys: ["TITLE"],
      advisoryOnlyEvidenceWarnings: [],
      taskRecommendations: [
        {
          gateKey: "TITLE",
          type: "REQUEST_EVIDENCE",
          title: "Request evidence",
          reason: "Title Review has no evaluation check yet.",
          severity: "BLOCKER",
          source: "system_default",
          idempotencyKey: "investor-shield:saved-deal-text-id-4c3:TITLE:REQUEST_EVIDENCE",
        },
      ],
    },
  },
] as const

export const INVESTOR_SHIELD_EVALUATOR_DETERMINISM_FIXTURE = makeInput({
  checks: makeChecks([{ gateKey: "LENDER_CRITERIA", status: "REQUIRED", severity: "BLOCKER" }]),
  evaluatedAt: "2026-06-05T00:00:00.000Z",
})
