import type { PdfEvidencePack } from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import {
  PDF_EVIDENCE_PACK_AUDIENCE,
  PDF_EVIDENCE_PACK_GENERATION_MODE,
  PDF_EVIDENCE_PACK_PURPOSE,
  PDF_EVIDENCE_PACK_SCHEMA_VERSION,
} from "@/lib/pdf-evidence-pack/pdf-evidence-pack-types"
import {
  INVESTOR_SUMMARY_PRESENTATION_BLOCKED_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_EMPTY_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_UNAVAILABLE_FIXTURE,
  INVESTOR_SUMMARY_PRESENTATION_WARNING_FIXTURE,
} from "./investor-summary-fixtures"

const COMPLETE_SHIELD = {
  dealId: "deal-pdf-complete-001",
  overallStatus: "CLEAR",
  progressionDecision: "CAN_PROGRESS",
  canProgress: true,
  blockingGateKeys: [],
  cautionGateKeys: [],
  missingEvidenceGateKeys: [],
  manualOverrideRequired: false,
  advisoryOnlyEvidenceWarnings: [],
  taskRecommendations: [],
  blockingReasons: [],
  evaluatedAt: "2026-06-14T10:30:00.000Z",
} as const

const BLOCKED_SHIELD = {
  dealId: "deal-pdf-blocked-001",
  overallStatus: "BLOCKED",
  progressionDecision: "BLOCKED",
  canProgress: false,
  blockingGateKeys: ["TITLE", "REFURB_CERTAINTY"],
  cautionGateKeys: [],
  missingEvidenceGateKeys: ["TITLE", "REFURB_CERTAINTY"],
  manualOverrideRequired: true,
  advisoryOnlyEvidenceWarnings: [],
  taskRecommendations: [
    {
      gateKey: "TITLE",
      type: "REQUEST_EVIDENCE",
      title: "Request evidence",
      reason: "Title review evidence is still missing.",
      severity: "BLOCKER",
      source: "system_default",
      idempotencyKey: "investor-shield:deal-pdf-blocked-001:TITLE:REQUEST_EVIDENCE",
    },
  ],
  blockingReasons: ["REQUIRED_GATE_MISSING", "BLOCKER_GATE_FAILED"],
  deterministicDominanceNote: "Blocked canonical status remains dominant.",
  evaluatedAt: "2026-06-14T10:45:00.000Z",
} as const

const PRIVACY_MINIMIZED_SHIELD = {
  dealId: "deal-pdf-private-001",
  overallStatus: "CAUTION",
  progressionDecision: "NEEDS_REVIEW",
  canProgress: false,
  blockingGateKeys: [],
  cautionGateKeys: ["RENTAL_DEMAND"],
  missingEvidenceGateKeys: ["RENTAL_DEMAND"],
  manualOverrideRequired: false,
  advisoryOnlyEvidenceWarnings: [],
  taskRecommendations: [],
  blockingReasons: [],
  evaluatedAt: "2026-06-14T11:00:00.000Z",
} as const

const COMPLETE_EVIDENCE = [
  {
    evidenceId: "evi-pdf-complete-001",
    evidenceType: "TITLE_REVIEW",
    title: "Title review metadata",
    description: "Controlled title review reference only.",
    provenanceLabel: "Evidence Lite",
    capturedAt: "2026-06-12T09:00:00.000Z",
    reviewedAt: "2026-06-12T10:00:00.000Z",
    reviewStatus: "REVIEWED",
    relatedGateIds: ["TITLE"],
    controlledReferenceState: "AVAILABLE",
    controlledReferenceLabel: "title-ref-001",
  },
  {
    evidenceId: "evi-pdf-complete-002",
    evidenceType: "BUILDER_QUOTE",
    title: "Builder quote metadata",
    description: "Controlled builder quote reference only.",
    provenanceLabel: "Evidence Lite",
    capturedAt: "2026-06-12T11:00:00.000Z",
    reviewedAt: "2026-06-12T12:00:00.000Z",
    reviewStatus: "VERIFIED",
    relatedGateIds: ["REFURB_CERTAINTY"],
    controlledReferenceState: "AVAILABLE",
    controlledReferenceLabel: "builder-ref-002",
  },
] as const

const BLOCKED_EVIDENCE = [
  {
    evidenceId: "evi-pdf-blocked-001",
    evidenceType: "TITLE_REVIEW",
    title: "Blocked title metadata",
    description: null,
    provenanceLabel: "Evidence Lite",
    capturedAt: null,
    reviewedAt: null,
    reviewStatus: "MISSING",
    relatedGateIds: ["TITLE"],
    controlledReferenceState: "MISSING",
    controlledReferenceLabel: null,
  },
] as const

const NULL_VS_ZERO_EVIDENCE = [
  {
    evidenceId: "evi-pdf-null-zero-001",
    evidenceType: "LENDER_NOTE",
    title: "Lender note metadata",
    description: "Preserves zero amount and null uncertainty distinctly.",
    provenanceLabel: "Evidence Lite",
    capturedAt: "2026-06-13T09:00:00.000Z",
    reviewedAt: null,
    reviewStatus: "RECORDED",
    relatedGateIds: ["LENDER_CRITERIA"],
    controlledReferenceState: "AVAILABLE",
    controlledReferenceLabel: "lender-note-001",
  },
] as const

const EMPTY_EVIDENCE: readonly [] = []

const PRIVACY_MINIMIZED_EVIDENCE = [
  {
    evidenceId: "evi-pdf-private-001",
    evidenceType: "MANUAL_NOTE",
    title: "Redacted evidence reference",
    description: null,
    provenanceLabel: null,
    capturedAt: null,
    reviewedAt: null,
    reviewStatus: "MISSING",
    relatedGateIds: [],
    controlledReferenceState: "RESTRICTED",
    controlledReferenceLabel: null,
  },
] as const

const COMPLETE_DISCLAIMERS = [
  {
    code: "informational-only",
    title: "Informational decision support",
    body: "This pack is an investor decision-support summary and is not legal, valuation, or survey advice.",
    required: true,
  },
  {
    code: "legal-review",
    title: "Legal review required",
    body: "Project-authored disclaimer text must be reviewed before production use.",
    required: true,
  },
] as const

const MINIMAL_DISCLAIMER = [
  {
    code: "informational-only",
    title: "Informational decision support",
    body: "This pack is read-only and uses canonical source data only.",
    required: true,
  },
] as const

export const PDF_EVIDENCE_PACK_COMPLETE_FIXTURE: PdfEvidencePack = {
  meta: {
    schemaVersion: PDF_EVIDENCE_PACK_SCHEMA_VERSION,
    generatedAt: "2026-06-14T12:00:00.000Z",
    savedDealId: "deal-pdf-complete-001",
    audience: PDF_EVIDENCE_PACK_AUDIENCE,
    purpose: PDF_EVIDENCE_PACK_PURPOSE,
    generationMode: PDF_EVIDENCE_PACK_GENERATION_MODE,
    confidentialityLabel: "INTERNAL USE ONLY",
  },
  identity: {
    dealId: "deal-pdf-complete-001",
    address: "22 Lake View Road, Leeds",
  },
  investorSummary: INVESTOR_SUMMARY_PRESENTATION_COMPLETE_FIXTURE,
  investorShield: COMPLETE_SHIELD,
  evidenceIndex: COMPLETE_EVIDENCE,
  disclaimers: COMPLETE_DISCLAIMERS,
}

export const PDF_EVIDENCE_PACK_BLOCKED_FIXTURE: PdfEvidencePack = {
  meta: {
    schemaVersion: PDF_EVIDENCE_PACK_SCHEMA_VERSION,
    generatedAt: "2026-06-14T12:15:00.000Z",
    savedDealId: "deal-pdf-blocked-001",
    audience: PDF_EVIDENCE_PACK_AUDIENCE,
    purpose: PDF_EVIDENCE_PACK_PURPOSE,
    generationMode: PDF_EVIDENCE_PACK_GENERATION_MODE,
    confidentialityLabel: "INTERNAL USE ONLY",
  },
  identity: {
    dealId: "deal-pdf-blocked-001",
    address: "12 Lake View Road, Leeds",
  },
  investorSummary: INVESTOR_SUMMARY_PRESENTATION_BLOCKED_FIXTURE,
  investorShield: BLOCKED_SHIELD,
  evidenceIndex: BLOCKED_EVIDENCE,
  disclaimers: COMPLETE_DISCLAIMERS,
}

export const PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE: PdfEvidencePack = {
  meta: {
    schemaVersion: PDF_EVIDENCE_PACK_SCHEMA_VERSION,
    generatedAt: "2026-06-14T12:30:00.000Z",
    savedDealId: "deal-pdf-null-zero-001",
    audience: PDF_EVIDENCE_PACK_AUDIENCE,
    purpose: PDF_EVIDENCE_PACK_PURPOSE,
    generationMode: PDF_EVIDENCE_PACK_GENERATION_MODE,
    confidentialityLabel: "INTERNAL USE ONLY",
  },
  identity: {
    dealId: "deal-pdf-null-zero-001",
    address: "8 Marina Crescent, Manchester",
  },
  investorSummary: INVESTOR_SUMMARY_PRESENTATION_WARNING_FIXTURE,
  investorShield: {
    dealId: "deal-pdf-null-zero-001",
    overallStatus: "CAUTION",
    progressionDecision: "NEEDS_REVIEW",
    canProgress: false,
    blockingGateKeys: [],
    cautionGateKeys: ["LENDER_CRITERIA"],
    missingEvidenceGateKeys: ["LENDER_CRITERIA"],
    manualOverrideRequired: false,
    advisoryOnlyEvidenceWarnings: [],
    taskRecommendations: [],
    blockingReasons: [],
    evaluatedAt: "2026-06-14T12:25:00.000Z",
  },
  evidenceIndex: NULL_VS_ZERO_EVIDENCE,
  disclaimers: COMPLETE_DISCLAIMERS,
}

export const PDF_EVIDENCE_PACK_EMPTY_FIXTURE: PdfEvidencePack = {
  meta: {
    schemaVersion: PDF_EVIDENCE_PACK_SCHEMA_VERSION,
    generatedAt: "2026-06-14T12:45:00.000Z",
    savedDealId: "deal-pdf-empty-001",
    audience: PDF_EVIDENCE_PACK_AUDIENCE,
    purpose: PDF_EVIDENCE_PACK_PURPOSE,
    generationMode: PDF_EVIDENCE_PACK_GENERATION_MODE,
    confidentialityLabel: "INTERNAL USE ONLY",
  },
  identity: {
    dealId: "deal-pdf-empty-001",
    address: "18 Lake View Road, Leeds",
  },
  investorSummary: INVESTOR_SUMMARY_PRESENTATION_EMPTY_FIXTURE,
  investorShield: {
    dealId: "deal-pdf-empty-001",
    overallStatus: "CLEAR",
    progressionDecision: "CAN_PROGRESS",
    canProgress: true,
    blockingGateKeys: [],
    cautionGateKeys: [],
    missingEvidenceGateKeys: [],
    manualOverrideRequired: false,
    advisoryOnlyEvidenceWarnings: [],
    taskRecommendations: [],
    blockingReasons: [],
    evaluatedAt: "2026-06-14T12:40:00.000Z",
  },
  evidenceIndex: EMPTY_EVIDENCE,
  disclaimers: MINIMAL_DISCLAIMER,
}

export const PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE: PdfEvidencePack = {
  meta: {
    schemaVersion: PDF_EVIDENCE_PACK_SCHEMA_VERSION,
    generatedAt: "2026-06-14T13:00:00.000Z",
    savedDealId: "deal-pdf-private-001",
    audience: PDF_EVIDENCE_PACK_AUDIENCE,
    purpose: PDF_EVIDENCE_PACK_PURPOSE,
    generationMode: PDF_EVIDENCE_PACK_GENERATION_MODE,
    confidentialityLabel: "INTERNAL USE ONLY",
  },
  identity: {
    dealId: "deal-pdf-private-001",
    address: "Address unavailable",
  },
  investorSummary: INVESTOR_SUMMARY_PRESENTATION_UNAVAILABLE_FIXTURE,
  investorShield: PRIVACY_MINIMIZED_SHIELD,
  evidenceIndex: PRIVACY_MINIMIZED_EVIDENCE,
  disclaimers: MINIMAL_DISCLAIMER,
}

export const PDF_EVIDENCE_PACK_FIXTURES = [
  PDF_EVIDENCE_PACK_COMPLETE_FIXTURE,
  PDF_EVIDENCE_PACK_BLOCKED_FIXTURE,
  PDF_EVIDENCE_PACK_NULL_VS_ZERO_FIXTURE,
  PDF_EVIDENCE_PACK_EMPTY_FIXTURE,
  PDF_EVIDENCE_PACK_PRIVACY_MINIMIZED_FIXTURE,
] as const satisfies readonly PdfEvidencePack[]
