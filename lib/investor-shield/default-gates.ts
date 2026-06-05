import {
  INVESTOR_SHIELD_GATE_KEYS,
  INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS,
  type InvestorShieldGateDefinition,
  type InvestorShieldGateKey,
  type InvestorShieldRefurbSubGateKey,
} from "@/types/investor-shield"

const INVESTOR_SHIELD_REFURB_ADVISORY_ONLY_SUB_GATES: readonly InvestorShieldRefurbSubGateKey[] = [
  "AI_VISUAL_REVIEW_ADVISORY",
] as const

const REFURB_CERTAINTY_DESCRIPTION =
  "Requires human-supported refurbishment evidence across media, measurements, builder quote support, and specialist inputs. " +
  `${INVESTOR_SHIELD_REFURB_ADVISORY_ONLY_SUB_GATES.join(", ")} is advisory-only and cannot replace human, professional, builder, document, or measurement evidence.`

export const INVESTOR_SHIELD_DEFAULT_GATES: readonly InvestorShieldGateDefinition[] = [
  {
    key: "SOLD_COMPS",
    label: "Sold Comparables",
    description:
      "Requires recent sold comparable evidence strong enough to validate pricing and exit assumptions.",
    required: true,
    defaultSeverity: "BLOCKER",
    evidenceTypes: ["SOLD_COMPARABLE"],
  },
  {
    key: "TITLE",
    label: "Title Review",
    description:
      "Requires title documentation review so restrictive covenants, access issues, and ownership risks are not missed.",
    required: true,
    defaultSeverity: "BLOCKER",
    evidenceTypes: ["TITLE_DOCUMENT"],
  },
  {
    key: "LEASEHOLD",
    label: "Leasehold Review",
    description:
      "Requires lease documentation when relevant so term, ground rent, service charge, and restrictions are reviewed before progression.",
    required: true,
    defaultSeverity: "CAUTION",
    evidenceTypes: ["LEASE_DOCUMENT"],
  },
  {
    key: "PLANNING_BUILDING_CONTROL",
    label: "Planning and Building Control",
    description:
      "Requires planning and building control evidence where applicable to confirm prior works and intended scope are supportable.",
    required: true,
    defaultSeverity: "CAUTION",
    evidenceTypes: ["PLANNING_DOCUMENT", "BUILDING_CONTROL_DOCUMENT"],
  },
  {
    key: "REFURB_CERTAINTY",
    label: "Refurb Certainty",
    description: REFURB_CERTAINTY_DESCRIPTION,
    required: true,
    defaultSeverity: "BLOCKER",
    subGates: INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS,
    evidenceTypes: [
      "REFURB_PHOTO",
      "REFURB_VIDEO",
      "ROOM_MEASUREMENT",
      "BUILDER_QUOTE",
      "SPECIALIST_SURVEY",
    ],
  },
  {
    key: "BUILDER_PROPOSAL_CONTRACT",
    label: "Builder Proposal and Contract",
    description:
      "Requires builder proposal and contract evidence so pricing, scope, payment schedule, and contractual protection are not assumed.",
    required: true,
    defaultSeverity: "BLOCKER",
    evidenceTypes: ["BUILDER_PROPOSAL", "BUILDER_CONTRACT", "BUILDER_QUOTE"],
  },
  {
    key: "DAMP_STRUCTURAL",
    label: "Damp and Structural Review",
    description:
      "Requires specialist or documentary evidence where damp or structural concerns may materially affect risk, cost, or viability.",
    required: true,
    defaultSeverity: "BLOCKER",
    evidenceTypes: ["SPECIALIST_SURVEY", "MANUAL_NOTE", "OTHER"],
  },
  {
    key: "LENDER_CRITERIA",
    label: "Lender Criteria",
    description:
      "Requires lender criteria evidence to confirm the deal fits financing constraints and does not rely on unsupported lending assumptions.",
    required: true,
    defaultSeverity: "BLOCKER",
    evidenceTypes: ["LENDER_CRITERIA"],
  },
  {
    key: "RENTAL_DEMAND",
    label: "Rental Demand",
    description:
      "Requires rental demand evidence where rental fallback, refinance, or letting viability informs downside protection.",
    required: true,
    defaultSeverity: "CAUTION",
    evidenceTypes: ["RENTAL_EVIDENCE"],
  },
  {
    key: "SOLICITOR_FEEDBACK",
    label: "Solicitor Feedback",
    description:
      "Requires solicitor feedback before progression where legal issues may affect title certainty, timing, or transaction safety.",
    required: true,
    defaultSeverity: "BLOCKER",
    evidenceTypes: ["SOLICITOR_FEEDBACK"],
  },
] as const

const INVESTOR_SHIELD_DEFAULT_GATE_LOOKUP = new Map<InvestorShieldGateKey, InvestorShieldGateDefinition>(
  INVESTOR_SHIELD_DEFAULT_GATES.map((definition) => [definition.key, definition])
)

export function getInvestorShieldGateDefinition(
  key: string
): InvestorShieldGateDefinition | undefined {
  return INVESTOR_SHIELD_DEFAULT_GATE_LOOKUP.get(key as InvestorShieldGateKey)
}

export function getInvestorShieldRequiredGateKeys(): readonly InvestorShieldGateKey[] {
  return INVESTOR_SHIELD_DEFAULT_GATES.filter((definition) => definition.required).map(
    (definition) => definition.key
  )
}

export function getInvestorShieldRefurbSubGateKeys(): readonly InvestorShieldRefurbSubGateKey[] {
  return [...INVESTOR_SHIELD_REFURB_SUB_GATE_KEYS]
}

if (INVESTOR_SHIELD_DEFAULT_GATES.length !== INVESTOR_SHIELD_GATE_KEYS.length) {
  throw new Error("Investor Shield default gate definitions are out of sync with gate key contracts.")
}
